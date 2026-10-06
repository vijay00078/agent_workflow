// Turns the AI answer into a GST-ready register row and runs accounting checks:
// GSTIN format + checksum, state codes, intra/inter-state tax logic, totals,
// duplicates (same vendor + invoice number) and purchase vs. sales.
const cfg = $('Config').first().json;
const file = $('Prepare AI Request').item.json;
const res = $json;

const STATES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland',
  '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra', '28': 'Andhra Pradesh (old)', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '96': 'Other Country',
  '97': 'Other Territory', '99': 'Centre Jurisdiction',
};
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const cleanId = (v) => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
const isGstinFormat = (g) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g);
function gstinChecksumOk(g) {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(v / 36) + (v % 36);
  }
  return CHARS[(36 - (total % 36)) % 36] === g[14];
}
function stateCodeFrom(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const code = s.match(/\b(\d{2})\b/);
  if (code && STATES[code[1]]) return code[1];
  const norm = (x) => x.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
  const target = norm(s);
  for (const [c, name] of Object.entries(STATES)) if (norm(name) && target.includes(norm(name))) return c;
  return '';
}
const n = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);

const checks = [];
let d = null;
if (file.skip_reason) {
  checks.push('⛔ Skipped: ' + file.skip_reason);
} else if (res.error || !res.choices) {
  checks.push('⛔ AI extraction failed: ' + String((res.error && (res.error.message || res.error)) || 'no response').slice(0, 200));
} else {
  try {
    const msg = res.choices[0].message;
    if (msg.refusal) throw new Error(msg.refusal);
    d = JSON.parse(msg.content);
  } catch (e) {
    checks.push('⛔ Could not read the AI answer: ' + e.message);
  }
}
d = d || {};

const vendorGstin = cleanId(d.vendor_gstin);
const buyerGstin = cleanId(d.buyer_gstin);
const myGstin = cleanId(cfg.your_gstin);
const currency = String(d.currency || cfg.home_currency || '').toUpperCase();
const isIndian = currency === 'INR' || isGstinFormat(vendorGstin) || isGstinFormat(buyerGstin);

let gstinStatus = '';
if (vendorGstin) {
  if (!isGstinFormat(vendorGstin)) gstinStatus = isIndian ? '❌ Invalid format' : 'n/a (not an Indian GSTIN)';
  else if (!gstinChecksumOk(vendorGstin)) gstinStatus = '⚠️ Checksum failed';
  else gstinStatus = '✅ Valid';
} else if (isIndian && d.document_type === 'tax_invoice') {
  gstinStatus = '❌ Missing';
}
if (gstinStatus.startsWith('❌') || gstinStatus.startsWith('⚠️')) checks.push(`Vendor GSTIN: ${gstinStatus.replace(/^\S+\s/, '')} – verify on the GST portal before claiming ITC`);
if (buyerGstin && isGstinFormat(buyerGstin) && !gstinChecksumOk(buyerGstin)) checks.push('Buyer GSTIN checksum failed');

const vendorState = isGstinFormat(vendorGstin) ? vendorGstin.slice(0, 2) : '';
const posState = stateCodeFrom(d.place_of_supply) || (isGstinFormat(buyerGstin) ? buyerGstin.slice(0, 2) : '');
const cgst = n(d.cgst) || 0;
const sgst = n(d.sgst) || 0;
const igst = n(d.igst) || 0;
const cess = n(d.cess) || 0;
const otherTax = n(d.other_tax) || 0;

let supplyType = '';
if (isIndian && vendorState && posState) {
  supplyType = vendorState === posState ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)';
  if (vendorState === posState && igst > 0) checks.push('IGST charged on an intra-state supply – should be CGST + SGST');
  if (vendorState !== posState && (cgst > 0 || sgst > 0)) checks.push('CGST/SGST charged on an inter-state supply – should be IGST');
} else if (isIndian && (cgst || sgst || igst)) {
  supplyType = igst ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)';
}
if (cgst && sgst && Math.abs(cgst - sgst) > 1) checks.push(`CGST (${cgst}) and SGST (${sgst}) differ`);

const taxable = n(d.taxable_value);
const total = n(d.total_amount);
const totalTax = n(d.total_tax) ?? Math.round((cgst + sgst + igst + cess + otherTax) * 100) / 100;
if (taxable !== null && total !== null) {
  const expected = taxable + cgst + sgst + igst + cess + otherTax + (n(d.round_off) || 0);
  const diff = Math.round((total - expected) * 100) / 100;
  if (Math.abs(diff) > Math.max(1, Math.abs(total) * 0.01)) checks.push(`Totals don't add up: taxable + taxes = ${Math.round(expected * 100) / 100}, invoice total = ${total}`);
}
if (d.is_invoice_or_receipt === false) checks.push('Does not look like an invoice or receipt');
if (d.confidence !== undefined && Number(d.confidence) < 0.7) checks.push(`Low AI confidence (${Math.round(Number(d.confidence) * 100)}%) – please double-check`);
if (!d.invoice_number && d.document_type && d.document_type !== 'receipt') checks.push('Invoice number missing');

// Duplicate detection (remembers invoices processed by the active workflow)
let duplicate = '';
if (d.invoice_number) {
  const key = `${vendorGstin || String(d.vendor_name || '').toLowerCase()}|${cleanId(d.invoice_number)}`;
  const store = $getWorkflowStaticData('global');
  store.invoices = store.invoices || {};
  if (store.invoices[key]) duplicate = `Possible duplicate – same vendor & invoice no. processed on ${store.invoices[key]}`;
  else store.invoices[key] = $now.toFormat('yyyy-MM-dd');
  if (duplicate) checks.push(duplicate);
}

let direction = 'Expense / Purchase';
if (myGstin && vendorGstin === myGstin) direction = 'Sales (issued by you)';
else if (myGstin && buyerGstin === myGstin) direction = 'Purchase (ITC eligible)';
else if (myGstin && buyerGstin && buyerGstin !== myGstin) checks.push('Buyer GSTIN is not yours – ITC may not be claimable');

const lineItems = Array.isArray(d.line_items) ? d.line_items : [];
const hsn = [...new Set(lineItems.map((l) => l.hsn_sac).filter(Boolean))].join(', ');
const lines = lineItems
  .map((l) => `${l.description}${l.quantity !== null && l.quantity !== undefined ? ` × ${l.quantity}` : ''}${l.unit_price !== null && l.unit_price !== undefined ? ` @ ${l.unit_price}` : ''}${l.hsn_sac ? ` [HSN/SAC ${l.hsn_sac}]` : ''}${l.tax_rate_percent !== null && l.tax_rate_percent !== undefined ? ` (${l.tax_rate_percent}%)` : ''} = ${l.amount ?? '?'}`)
  .join('\n');

return {
  json: {
    row: {
      'Processed At': $now.toFormat('yyyy-MM-dd HH:mm'),
      File: file.file_name,
      Source: file.source,
      'Doc Type': (d.document_type || '').replace(/_/g, ' '),
      'Purchase / Sales': direction,
      Vendor: d.vendor_name || '',
      'Vendor GSTIN': vendorGstin,
      'GSTIN Check': gstinStatus,
      'Vendor State': vendorState ? `${vendorState} – ${STATES[vendorState] || ''}` : '',
      Buyer: d.buyer_name || '',
      'Buyer GSTIN': buyerGstin,
      'Invoice No': d.invoice_number || '',
      'Invoice Date': d.invoice_date || '',
      'Due Date': d.due_date || '',
      'Place of Supply': posState ? `${posState} – ${STATES[posState] || ''}` : d.place_of_supply || '',
      'Supply Type': supplyType,
      Currency: currency,
      'Taxable Value': taxable ?? '',
      CGST: n(d.cgst) ?? '',
      SGST: n(d.sgst) ?? '',
      IGST: n(d.igst) ?? '',
      Cess: n(d.cess) ?? '',
      'Other Tax / VAT': n(d.other_tax) ?? '',
      'Total Tax': totalTax || '',
      'Total Amount': total ?? '',
      Category: d.expense_category || '',
      'Payment Method': d.payment_method || '',
      'HSN / SAC': hsn,
      'Line Items': lines,
      Checks: checks.length ? checks.map((c) => '• ' + c).join('\n') : '✅ All checks passed',
      Confidence: d.confidence !== undefined ? Math.round(Number(d.confidence) * 100) + '%' : '',
      'File Link': file.file_link,
      Notes: d.notes || '',
    },
    line_items: lineItems.map((l) => ({
      'Invoice No': d.invoice_number || '',
      Vendor: d.vendor_name || '',
      'Invoice Date': d.invoice_date || '',
      Description: l.description,
      'HSN / SAC': l.hsn_sac || '',
      Quantity: l.quantity ?? '',
      'Unit Price': l.unit_price ?? '',
      'Tax Rate %': l.tax_rate_percent ?? '',
      Amount: l.amount ?? '',
    })),
    drive_file_id: file.drive_file_id,
    source: file.source,
    ok: !checks.some((c) => c.startsWith('⛔')),
  },
};
