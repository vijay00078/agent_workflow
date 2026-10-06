from lib.n8n import (Workflow, code, set_fields, code_node, if_params, condition, http_node, rl, sheet_doc,
                     sheet_tab, GREEN, BLUE, PURPLE, YELLOW, ORANGE, GRAY, RED)

CFG = "$('Config').first().json"


def build():
    wf = Workflow("09 · Invoice & Receipt Extractor → Google Sheets (GST-ready)", "09-invoice-receipt-extractor")

    wf.sticky("""## 🧾 Invoice & Receipt Extractor (GST-ready)
**Drop invoices into a Google Drive folder — or snap receipts with your phone via the upload form — and AI types everything into a clean Google Sheet register.** 📊

Reads **PDFs (even scanned), JPG, PNG, WEBP** · vendor, GSTIN/VAT, invoice no., dates, taxable value, **CGST / SGST / IGST**, cess, totals, HSN/SAC, line items & expense category.

### 🇮🇳 Built-in GST checks
GSTIN format + checksum · state codes · intra- vs inter-state tax logic · totals that don't add up · duplicate invoices · purchase vs. sales (set `your_gstin`).
🌍 Works for VAT / sales tax invoices worldwide too.

### ⚡ Setup (≈10 min)
1. **OpenAI** credential on **AI: Read Invoice** (uses your OpenAI key)
2. **New File in Drive Folder** → connect Google Drive → pick your *Invoices* folder
3. **Config** → paste your Google Sheet URL (+ your GSTIN)
4. **Save to Invoice Register** → connect Google Sheets
5. **Activate / Publish** → drop a PDF into the folder or open the **Upload Form** URL 📱

💡 Cost: ≈ $0.002–0.01 per document · Only use the form? Disable the Drive trigger (select → **D**).""", (-760, -340), 680, None, YELLOW)

    wf.section("### 1️⃣ New file in Drive OR uploaded via the form", ['New File in Drive Folder', 'Upload Form', 'Config', 'From Google Drive?', 'Download File', 'Drive File Info', 'Split Uploaded Files'], GREEN)
    wf.section("### 2️⃣ AI reads the document (PDF/photo → JSON)", ['Prepare AI Request', 'Readable?', 'AI: Read Invoice'], BLUE)
    wf.section("### 3️⃣ GST checks → Invoice register", ['Check & Enrich (GST)', 'Invoice Row', 'Save to Invoice Register', 'Move to Processed?', 'Move to Processed Folder', 'Line Item Rows', 'Save Line Items'], ORANGE)

    wf.add("New File in Drive Folder", "n8n-nodes-base.googleDriveTrigger", 1, {
        "pollTimes": {"item": [{"mode": "everyMinute"}]},
        "triggerOn": "specificFolder",
        "folderToWatch": rl("", "list"),
        "event": "fileCreated",
        "options": {},
    }, (0, 160), notes="👉 Pick your Invoices folder", notesInFlow=True)
    wf.add("Upload Form", "n8n-nodes-base.formTrigger", 2.2, {
        "formTitle": "🧾 Upload invoices & receipts",
        "formDescription": "PDFs or photos (JPG, PNG, WEBP). You can select several files at once — they'll appear in the invoice register in about a minute.",
        "formFields": {"values": [
            {"fieldLabel": "Invoices or receipts", "fieldType": "file", "multipleFiles": True, "acceptFileTypes": ".pdf,.jpg,.jpeg,.png,.webp", "requiredField": True},
            {"fieldLabel": "Notes (optional)", "placeholder": "e.g. client dinner, project X"},
        ]},
        "responseMode": "onReceived",
        "options": {
            "appendAttribution": False,
            "buttonLabel": "Upload 📤",
            "path": "upload-invoices",
            "respondWithOptions": {"values": {"respondWith": "text", "formSubmittedText": "✅ Got it! Your documents are being processed and will appear in your invoice sheet within a minute."}},
        },
    }, (0, 400), webhook=True)

    cfg = set_fields(wf, [
        ("google_sheet_url", "https://docs.google.com/spreadsheets/d/PASTE-YOUR-SHEET-ID/edit", "string"),
        ("sheet_tab", "Invoices", "string"),
        ("your_gstin", "", "string"),
        ("home_currency", "INR", "string"),
        ("openai_model", "gpt-4.1-mini", "string"),
        ("processed_folder_id", "", "string"),
        ("line_items_tab", "Line Items", "string"),
    ])
    cfg["options"] = {"stripBinary": False}
    wf.add("Config", "n8n-nodes-base.set", 3.4, cfg, (240, 280), notes="✏️ Sheet URL + your GSTIN", notesInFlow=True)

    wf.add("From Google Drive?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "not-form", "={{ $json.formMode }}", "string", "empty"),
    ]), (460, 280))
    wf.add("Download File", "n8n-nodes-base.googleDrive", 3, {
        "operation": "download",
        "fileId": rl("={{ $json.id }}", "id"),
        "options": {},
    }, (700, 160), retryOnFail=True, maxTries=2)
    code_node(wf, "Drive File Info", (920, 160), code("09-invoices/drive_file_info.js"), each_item=True)
    code_node(wf, "Split Uploaded Files", (700, 420), code("09-invoices/split_uploads.js"))

    code_node(wf, "Prepare AI Request", (1160, 280), code("09-invoices/prepare_ai_request.js"))
    wf.add("Readable?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "readable", "={{ $json.skip_reason }}", "string", "empty"),
    ]), (1380, 280))
    http_node(wf, "AI: Read Invoice", (1600, 260), {
        "method": "POST",
        "url": "https://api.openai.com/v1/chat/completions",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "openAiApi",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ $json.requestBody }}",
        "options": {
            "batching": {"batch": {"batchSize": 3, "batchInterval": 1000}},
            "timeout": 180000,
        },
    }, onError="continueRegularOutput", retryOnFail=True, maxTries=2, waitBetweenTries=5000,
        notes="GPT-4.1-mini vision · strict JSON schema", notesInFlow=True)

    code_node(wf, "Check & Enrich (GST)", (1860, 280), code("09-invoices/check_and_enrich.js"), each_item=True)
    wf.add("Invoice Row", "n8n-nodes-base.set", 3.4, {
        "mode": "raw",
        "jsonOutput": "={{ $json.row }}",
        "options": {},
    }, (2080, 160))
    wf.add("Save to Invoice Register", "n8n-nodes-base.googleSheets", 4.6, {
        "operation": "append",
        "documentId": sheet_doc(f"={{{{ {CFG}.google_sheet_url }}}}"),
        "sheetName": sheet_tab(f"={{{{ {CFG}.sheet_tab }}}}"),
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []},
        "options": {},
    }, (2300, 160), retryOnFail=True, maxTries=3, waitBetweenTries=5000)

    wf.add("Move to Processed?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "from-drive", "={{ $json.source }}", "string", "equals", "Google Drive"),
        condition(wf, "folder-set", f"={{{{ {CFG}.processed_folder_id }}}}", "string", "notEmpty"),
        condition(wf, "ok", "={{ $json.ok }}", "boolean", "true"),
    ]), (2080, 380))
    wf.add("Move to Processed Folder", "n8n-nodes-base.googleDrive", 3, {
        "operation": "move",
        "fileId": rl("={{ $json.drive_file_id }}", "id"),
        "driveId": rl("My Drive", "list", "My Drive"),
        "folderId": rl(f"={{{{ ({CFG}.processed_folder_id.match(/folders\\/([A-Za-z0-9_-]+)/) || [])[1] || {CFG}.processed_folder_id.trim() }}}}", "id"),
    }, (2300, 360), onError="continueRegularOutput")

    code_node(wf, "Line Item Rows", (2080, 580), "return $input.all().flatMap((item) => (item.json.line_items || []).map((row) => ({ json: row })));\n", disabled=True)
    wf.add("Save Line Items", "n8n-nodes-base.googleSheets", 4.6, {
        "operation": "append",
        "documentId": sheet_doc(f"={{{{ {CFG}.google_sheet_url }}}}"),
        "sheetName": sheet_tab(f"={{{{ {CFG}.line_items_tab }}}}"),
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []},
        "options": {},
    }, (2300, 580), disabled=True, notes="Optional: item-level detail (enable both nodes)", notesInFlow=True)

    wf.connect("New File in Drive Folder", "Config")
    wf.connect("Upload Form", "Config")
    wf.connect("Config", "From Google Drive?")
    wf.connect("From Google Drive?", "Download File", out=0)
    wf.connect("From Google Drive?", "Split Uploaded Files", out=1)
    wf.chain("Download File", "Drive File Info", "Prepare AI Request")
    wf.connect("Split Uploaded Files", "Prepare AI Request")
    wf.connect("Prepare AI Request", "Readable?")
    wf.connect("Readable?", "AI: Read Invoice", out=0)
    wf.connect("Readable?", "Check & Enrich (GST)", out=1)
    wf.connect("AI: Read Invoice", "Check & Enrich (GST)")
    wf.connect("Check & Enrich (GST)", "Invoice Row")
    wf.connect("Check & Enrich (GST)", "Move to Processed?")
    wf.connect("Check & Enrich (GST)", "Line Item Rows")
    wf.connect("Invoice Row", "Save to Invoice Register")
    wf.connect("Move to Processed?", "Move to Processed Folder", out=0)
    wf.connect("Line Item Rows", "Save Line Items")
    return wf
