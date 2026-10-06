module.exports = {
  workflow: '09-invoice-receipt-extractor-gst.json',
  trigger: 'New File in Drive Folder',
  pin: { 'New File in Drive Folder': [
    { id: 'f1', name: 'dup-1.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/d/f1/view' },
    { id: 'f2', name: 'dup-2.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/d/f2/view' },
  ] },
  patch: {
    Config: (node) => { for (const a of node.parameters.assignments.assignments) if (a.name === 'processed_folder_id') a.value = 'https://drive.google.com/drive/folders/PROCESSED123'; return node; },
    'Download File': (node) => ({ ...node, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, parameters: { url: 'http://localhost:9999/fixture/invoice.pdf', options: { response: { response: { responseFormat: 'file' } } } } }),
    'AI: Read Invoice': (node) => { node.parameters.url = 'http://localhost:9999/v1/chat/completions'; return node; },
  },
  probes: { 'Save to Invoice Register': {}, 'Move to Processed Folder': { id: 'moved' } },
  overrides: [{ match: 'file name: dup-', respond: { is_invoice_or_receipt: true, document_type: 'invoice', vendor_name: 'Stripe', vendor_gstin: null, vendor_address: null, buyer_name: null, buyer_gstin: null, invoice_number: 'ST-1001', invoice_date: '2026-10-01', due_date: null, place_of_supply: null, currency: 'USD', taxable_value: 100, cgst: null, sgst: null, igst: null, cess: null, other_tax: 20, total_tax: 20, round_off: null, total_amount: 120, payment_method: 'Card', expense_category: 'Software & SaaS', line_items: [], notes: null, confidence: 0.95 } }],
  show: ['Drive File Info', 'Invoice Row', 'Move to Processed Folder'],
  async check({ getAll, expect }) {
    const info = getAll('Drive File Info');
    expect(info.length === 2 && info[0].file_link === 'https://drive.google.com/file/d/f1/view' && info[0].source === 'Google Drive', 'drive file info');
    const rows = getAll('Invoice Row');
    expect(rows.length === 2, 'two rows');
    expect(rows[0].Checks === '✅ All checks passed' && rows[0]['GSTIN Check'] === '', 'non-Indian invoice passes without GST noise: ' + rows[0].Checks);
    expect(/Possible duplicate/.test(rows[1].Checks), 'second copy flagged as duplicate: ' + rows[1].Checks);
    const moved = getAll('Move to Processed Folder');
    expect(moved.length === 2 && moved[0]['_probe.folderId'] === 'PROCESSED123' && moved[0]['_probe.fileId'] === 'f1', 'files moved to processed folder (id from URL)');
  },
};
