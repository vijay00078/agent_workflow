const PDF = "JVBERi0xLjQKMSAwIG9iajw8Pj5lbmRvYmoKdHJhaWxlcjw8Pj4KJSVFT0YK";
const JPG = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const TXT = "aGVsbG8=";
const bin = (data, mimeType, fileName) => ({ data, mimeType, fileName, fileExtension: fileName.split('.').pop() });
module.exports = {
  workflow: '09-invoice-receipt-extractor-gst.json',
  trigger: 'Upload Form',
  pin: {
    'Upload Form': [{
      json: { 'Invoices or receipts': [{ filename: 'invoice-acme.pdf' }, { filename: 'receipt.jpg' }, { filename: 'notes.txt' }], 'Notes (optional)': 'Project X', submittedAt: '2026-10-06T10:00:00Z', formMode: 'production' },
      binary: { Invoices_or_receipts_0: bin(PDF, 'application/pdf', 'invoice-acme.pdf'), Invoices_or_receipts_1: bin(JPG, 'image/jpeg', 'receipt.jpg'), Invoices_or_receipts_2: bin(TXT, 'text/plain', 'notes.txt') },
    }],
  },
  patch: {
    Config: (node) => { for (const a of node.parameters.assignments.assignments) if (a.name === 'your_gstin') a.value = '29AAGCB7383J1Z4'; return node; },
    'AI: Read Invoice': (node) => { node.parameters.url = 'http://localhost:9999/v1/chat/completions'; return node; },
  },
  probes: { 'Save to Invoice Register': {} },
  overrides: [
    { match: 'file name: invoice-acme.pdf', respond: { is_invoice_or_receipt: true, document_type: 'tax_invoice', vendor_name: 'Acme Supplies Pvt Ltd', vendor_gstin: '27 AAPFU 0939F1ZV', vendor_address: 'Pune', buyer_name: 'Bright Labs', buyer_gstin: '29AAGCB7383J1Z4', invoice_number: 'INV-2026/0042', invoice_date: '2026-09-28', due_date: null, place_of_supply: '29-Karnataka', currency: 'INR', taxable_value: 10000, cgst: 900, sgst: 900, igst: null, cess: null, other_tax: null, total_tax: 1800, round_off: null, total_amount: 11800, payment_method: 'Bank transfer', expense_category: 'Office supplies', line_items: [{ description: 'Printer paper A4', hsn_sac: '4802', quantity: 20, unit_price: 500, tax_rate_percent: 18, amount: 10000 }], notes: null, confidence: 0.96 } },
    { match: 'file name: receipt.jpg', respond: { is_invoice_or_receipt: true, document_type: 'receipt', vendor_name: 'Cafe Mocha', vendor_gstin: '29ABCDE1234F1Z5', vendor_address: null, buyer_name: null, buyer_gstin: null, invoice_number: 'R-77', invoice_date: '2026-10-01', due_date: null, place_of_supply: 'Karnataka', currency: 'INR', taxable_value: 500, cgst: 12.5, sgst: 12.5, igst: null, cess: null, other_tax: null, total_tax: 25, round_off: null, total_amount: 600, payment_method: 'UPI', expense_category: 'Meals & entertainment', line_items: [], notes: null, confidence: 0.6 } },
  ],
  show: ['Prepare AI Request', 'Check & Enrich (GST)', 'Invoice Row'],
  showItems: 3,
  showChars: 900,
  async check({ get, getAll, expect, requests }) {
    const prep = get('Prepare AI Request');
    expect(prep.length === 3, 'three files prepared');
    expect(prep.find((p) => p.file_name === 'notes.txt').skip_reason.startsWith('Unsupported file type'), 'txt skipped');
    const ai = requests.filter((r) => r.url.includes('chat/completions'));
    expect(ai.length === 2, 'two AI calls (pdf + jpg): ' + ai.length);
    const pdfReq = ai.find((r) => JSON.stringify(r.body).includes('invoice-acme.pdf'));
    expect(pdfReq && pdfReq.body.response_format.type === 'json_schema' && pdfReq.body.response_format.json_schema.strict === true, 'strict json schema');
    const parts = pdfReq.body.messages[1].content;
    expect(parts[1].type === 'file' && parts[1].file.file_data.startsWith('data:application/pdf;base64,'), 'pdf sent as file part');
    const jpgReq = ai.find((r) => JSON.stringify(r.body).includes('receipt.jpg'));
    expect(jpgReq.body.messages[1].content[1].image_url.url.startsWith('data:image/jpeg;base64,'), 'image sent as image_url');
    expect(JSON.stringify(pdfReq.body).includes('Notes from the uploader: Project X'), 'notes passed');
    const rows = getAll('Invoice Row');
    expect(rows.length === 3, 'three register rows (incl. skipped file)');
    const inv = rows.find((r) => r.File === 'invoice-acme.pdf');
    expect(inv['Vendor GSTIN'] === '27AAPFU0939F1ZV' && inv['GSTIN Check'] === '✅ Valid', 'gstin cleaned + valid: ' + inv['GSTIN Check']);
    expect(inv['Vendor State'] === '27 – Maharashtra' && inv['Place of Supply'] === '29 – Karnataka', 'states resolved');
    expect(inv['Supply Type'] === 'Inter-state (IGST)' && /should be IGST/.test(inv.Checks), 'inter-state supply with CGST/SGST flagged: ' + inv.Checks);
    expect(inv['Purchase / Sales'] === 'Purchase (ITC eligible)', 'purchase detected via your_gstin');
    expect(inv['HSN / SAC'] === '4802' && inv['Line Items'].includes('Printer paper A4 × 20 @ 500'), 'line items summarised');
    const rec = rows.find((r) => r.File === 'receipt.jpg');
    expect(/Totals don't add up/.test(rec.Checks) && /Low AI confidence/.test(rec.Checks), 'receipt totals + confidence flagged: ' + rec.Checks);
    expect(/Checksum failed/i.test(rec['GSTIN Check']), 'bad gstin checksum flagged: ' + rec['GSTIN Check']);
    const skipped = rows.find((r) => r.File === 'notes.txt');
    expect(skipped.Checks.includes('Skipped: Unsupported file type'), 'skipped file logged');
  },
};
