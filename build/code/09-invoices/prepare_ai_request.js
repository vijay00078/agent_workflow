// Builds one OpenAI request per file. PDFs (also scanned ones) and photos are
// sent directly to the vision model with a strict JSON schema, so the answer
// always has exactly the fields we need.
const cfg = $('Config').first().json;
const MODEL = String(cfg.openai_model || 'gpt-4.1-mini').trim();
const num = { type: ['number', 'null'] };
const str = { type: ['string', 'null'] };
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    is_invoice_or_receipt: { type: 'boolean' },
    document_type: { type: 'string', enum: ['tax_invoice', 'invoice', 'receipt', 'bill_of_supply', 'credit_note', 'debit_note', 'proforma', 'purchase_order', 'other'] },
    vendor_name: str,
    vendor_gstin: { type: ['string', 'null'], description: 'Seller GSTIN / VAT number / tax ID exactly as printed, without spaces' },
    vendor_address: str,
    buyer_name: str,
    buyer_gstin: { type: ['string', 'null'], description: 'Buyer GSTIN / VAT number if printed' },
    invoice_number: str,
    invoice_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    place_of_supply: { type: ['string', 'null'], description: 'State name and/or 2-digit state code exactly as printed' },
    currency: { type: 'string', description: 'ISO 4217 code such as INR, USD, EUR, GBP' },
    taxable_value: { type: ['number', 'null'], description: 'Total amount before tax' },
    cgst: num,
    sgst: { type: ['number', 'null'], description: 'SGST or UTGST amount' },
    igst: num,
    cess: num,
    other_tax: { type: ['number', 'null'], description: 'VAT / sales tax / any tax not covered by CGST, SGST, IGST or cess' },
    total_tax: num,
    round_off: num,
    total_amount: { type: ['number', 'null'], description: 'Final amount payable' },
    payment_method: str,
    expense_category: {
      type: 'string',
      enum: ['Software & SaaS', 'Office supplies', 'Travel', 'Meals & entertainment', 'Fuel & transport', 'Utilities & telecom', 'Rent', 'Professional services', 'Advertising & marketing', 'Inventory / goods for resale', 'Equipment & hardware', 'Repairs & maintenance', 'Insurance', 'Bank & payment fees', 'Taxes & government', 'Other'],
    },
    line_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { description: { type: 'string' }, hsn_sac: str, quantity: num, unit_price: num, tax_rate_percent: num, amount: num },
        required: ['description', 'hsn_sac', 'quantity', 'unit_price', 'tax_rate_percent', 'amount'],
      },
    },
    notes: { type: ['string', 'null'], description: 'Anything unclear, handwritten or important' },
    confidence: { type: 'number', description: 'From 0 to 1: how sure you are about the extracted values' },
  },
};
SCHEMA.required = Object.keys(SCHEMA.properties);

const SYSTEM = `You are a meticulous accountant's assistant. Extract data from invoices and receipts with perfect accuracy. Read every page.
Rules:
- Copy identifiers (GSTIN, VAT ID, invoice number) exactly as printed, without spaces.
- Dates as YYYY-MM-DD. For ambiguous dates like 03/04/2026 use day-first (India/Europe) unless the document is clearly American.
- Amounts are plain numbers: no currency symbols, no thousands separators. Use null when a value is not on the document — never guess or calculate missing taxes.
- Indian GST: Central tax → cgst, State/UT tax → sgst, Integrated tax → igst. taxable_value is the amount before GST.
- Other countries: VAT / sales tax → other_tax.
- total_amount is the final amount payable printed on the document.
- If the document is not an invoice or receipt, set is_invoice_or_receipt to false and fill in what you can.`;

const out = [];
const items = $input.all();
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const info = {
    file_name: item.json.file_name || 'file',
    file_link: item.json.file_link || '',
    drive_file_id: item.json.drive_file_id || '',
    source: item.json.source || '',
    notes: item.json.notes || '',
  };
  const bin = item.binary && item.binary.data;
  if (!bin) {
    out.push({ json: { ...info, skip_reason: 'No file found' }, pairedItem: { item: i } });
    continue;
  }
  const mime = String(bin.mimeType || '').toLowerCase();
  const isPdf = mime.includes('pdf') || /\.pdf$/i.test(info.file_name);
  const isImage = /^image\/(jpeg|jpg|png|webp|gif)$/.test(mime) || /\.(jpe?g|png|webp|gif)$/i.test(info.file_name);
  if (!isPdf && !isImage) {
    out.push({ json: { ...info, skip_reason: `Unsupported file type (${mime || 'unknown'}) – please use PDF, JPG, PNG or WEBP` }, pairedItem: { item: i } });
    continue;
  }
  const buffer = await this.helpers.getBinaryDataBuffer(i, 'data');
  if (buffer.length > 20 * 1024 * 1024) {
    out.push({ json: { ...info, skip_reason: 'File is larger than 20 MB' }, pairedItem: { item: i } });
    continue;
  }
  const b64 = buffer.toString('base64');
  const filePart = isPdf
    ? { type: 'file', file: { filename: /\.pdf$/i.test(info.file_name) ? info.file_name : `${info.file_name}.pdf`, file_data: `data:application/pdf;base64,${b64}` } }
    : { type: 'image_url', image_url: { url: `data:${mime.startsWith('image/') ? mime : 'image/jpeg'};base64,${b64}`, detail: 'high' } };

  out.push({
    json: {
      ...info,
      skip_reason: '',
      requestBody: {
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: { name: 'invoice_data', strict: true, schema: SCHEMA } },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Extract the data from this document (file name: ${info.file_name}).${info.notes ? ` Notes from the uploader: ${info.notes}` : ''}` },
              filePart,
            ],
          },
        ],
      },
    },
    pairedItem: { item: i },
  });
}
return out;
