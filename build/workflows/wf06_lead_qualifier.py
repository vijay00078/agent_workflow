from lib.n8n import (Workflow, code, set_fields, openai_model, structured_parser, llm_chain, code_node,
                     if_params, condition, http_node, sheet_doc, sheet_tab, GREEN, BLUE, PURPLE, YELLOW, ORANGE, GRAY, RED)

CFG = "$('Config').first().json"


def build():
    wf = Workflow("06 · AI Lead Qualifier & Instant Reply (Speed-to-Lead)", "06-ai-lead-qualifier")

    wf.sticky("""## ⚡ AI Lead Qualifier & Instant Reply
**Every new lead is scored 0–100 by AI, gets a personal reply in under 60 seconds (with your booking link), lands in your CRM sheet — and hot leads ping you instantly.** 🔥

Leads contacted within 5 minutes are far more likely to convert than leads contacted hours later. This makes you the fastest responder in your market — 24/7.

### ⚡ Setup (≈10 min)
1. **OpenAI Chat Model** → your OpenAI API key
2. **Config** → what you sell, ideal customer, booking link (Calendly/Cal.com), your email
3. **Send Instant Reply** + **Alert Me (Email)** → connect Gmail
4. **Save to CRM Sheet** → connect Google + paste your sheet URL in Config
5. **Activate / Publish**, then either:
   - share the **Lead Form** URL (Production URL), or
   - send your website form to the **Website Form (Webhook)** URL (POST JSON — see PDF guide)

### 💡 Good to know
- Spam & sales pitches are detected and never get a reply.
- Set `auto_reply` to false in Config to only score & log.
- Cost: ≈ $0.002 per lead.""", (-760, -320), 680, 960, YELLOW)

    wf.sticky("### 1️⃣ New lead from your form or website", (-40, 0), 920, 560, GREEN)
    wf.sticky("### 2️⃣ Quick research + AI qualification", (920, 0), 1100, 560, BLUE)
    wf.sticky("### 3️⃣ Log · reply · alert", (2060, -120), 700, 900, ORANGE)

    wf.add("Lead Form", "n8n-nodes-base.formTrigger", 2.2, {
        "formTitle": "Let's talk about your project 👋",
        "formDescription": "Tell us a bit about what you need — you'll get a reply in your inbox within a minute.",
        "formFields": {"values": [
            {"fieldLabel": "Full name", "placeholder": "Jane Smith", "requiredField": True},
            {"fieldLabel": "Email", "fieldType": "email", "placeholder": "jane@company.com", "requiredField": True},
            {"fieldLabel": "Company", "placeholder": "Company name"},
            {"fieldLabel": "Website", "placeholder": "company.com"},
            {"fieldLabel": "Phone", "placeholder": "+1 555 0100"},
            {"fieldLabel": "What can we help you with?", "fieldType": "textarea", "placeholder": "A few sentences about your project or question", "requiredField": True},
            {"fieldLabel": "Budget", "fieldType": "dropdown", "fieldOptions": {"values": [
                {"option": "Under $1,000"}, {"option": "$1,000 – $5,000"}, {"option": "$5,000 – $20,000"}, {"option": "$20,000+"}, {"option": "Not sure yet"}]}},
            {"fieldLabel": "Timeline", "fieldType": "dropdown", "fieldOptions": {"values": [
                {"option": "ASAP"}, {"option": "Within 1 month"}, {"option": "1–3 months"}, {"option": "Just researching"}]}},
        ]},
        "responseMode": "onReceived",
        "options": {
            "appendAttribution": False,
            "buttonLabel": "Send 🚀",
            "path": "lead-form",
            "respondWithOptions": {"values": {"respondWith": "text", "formSubmittedText": "🎉 Thank you! Check your inbox — you'll hear from us within a minute."}},
        },
    }, (0, 160), webhook=True)
    wf.add("Website Form (Webhook)", "n8n-nodes-base.webhook", 2, {
        "httpMethod": "POST",
        "path": "new-lead",
        "options": {},
    }, (0, 380), webhook=True, notes="POST your website form here", notesInFlow=True)

    code_node(wf, "Normalize Lead", (240, 270), code("06-lead-qualifier/normalize_lead.js"), each_item=True)

    wf.add("Config", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("business_name", "Morgan Digital", "string"),
        ("what_you_sell", "Done-for-you AI automation for small businesses: AI chatbots, lead follow-up and booking systems. Projects typically $2,000–$10,000; monthly care plans from $300/month.", "string"),
        ("ideal_customer", "Service businesses with 5–200 employees (clinics, agencies, real estate, trades, coaches) that get leads online and want to respond faster.", "string"),
        ("booking_link", "https://calendly.com/your-name/intro-call", "string"),
        ("your_name", "Alex Morgan", "string"),
        ("your_title", "Founder", "string"),
        ("your_email", "you@example.com", "string"),
        ("reply_style", "Warm, confident and concise. Sounds like a real person, not a robot. No buzzwords.", "string"),
        ("auto_reply", True, "boolean"),
        ("hot_score", 70, "number"),
        ("warm_score", 40, "number"),
        ("google_sheet_url", "https://docs.google.com/spreadsheets/d/PASTE-YOUR-SHEET-ID/edit", "string"),
        ("sheet_tab", "Leads CRM", "string"),
        ("telegram_chat_id", "", "string"),
    ]), (460, 270), notes="✏️ Your offer, booking link & sheet", notesInFlow=True)

    wf.add("Has Website?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "has-site", "={{ $json.website }}", "string", "notEmpty"),
    ]), (680, 270))
    http_node(wf, "Visit Website", (940, 140), {
        "url": "={{ $json.website }}",
        "sendHeaders": True,
        "headerParameters": {"parameters": [{"name": "User-Agent", "value": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}]},
        "options": {"response": {"response": {"responseFormat": "text"}}, "timeout": 10000},
    }, onError="continueRegularOutput")
    code_node(wf, "Website Snippet", (1160, 140), code("06-lead-qualifier/website_snippet.js"), each_item=True)
    wf.add("Lead Data", "n8n-nodes-base.noOp", 1, {}, (1380, 270))

    system = f"""=You are the head of sales at {{{{ {CFG}.business_name }}}}. You qualify inbound leads and write the very first reply.

WHAT WE SELL: {{{{ {CFG}.what_you_sell }}}}
IDEAL CUSTOMER: {{{{ {CFG}.ideal_customer }}}}
BOOKING LINK: {{{{ {CFG}.booking_link }}}}
SENDER: {{{{ {CFG}.your_name }}}}, {{{{ {CFG}.your_title }}}} at {{{{ {CFG}.business_name }}}}
STYLE: {{{{ {CFG}.reply_style }}}}

1) SCORE the lead from 0 to 100:
   - Need fit (0–35): does what they ask for match what we sell?
   - Ideal-customer fit (0–25): company type, size and industry vs. our ideal customer.
   - Budget (0–20): stated budget vs. our prices (not given = 8).
   - Urgency (0–20): timeline (ASAP = 20, within 1 month = 15, 1–3 months = 8, just researching = 3, not given = 6).
2) is_spam = true for spam, SEO/link-building/marketing/dev-agency pitches, vendors selling TO us, job applications, crypto, gibberish or test submissions.
3) Write the reply email from {{{{ {CFG}.your_name }}}} to the lead:
   - Personal and specific: mention what they asked for (and their company if known).
   - Score 70+: enthusiastic; propose a short call and include the booking link.
   - Score 40–69: helpful; answer briefly and offer the booking link as an easy next step.
   - Below 40: polite and genuinely helpful; suggest a fitting next step (e.g. reply with more details); no hard sell.
   - 80–150 words, plain text (no markdown), short paragraphs. Greet them by first name and sign off with {{{{ {CFG}.your_name }}}}.
   - Write in the language of their message.
   - Never promise prices, discounts or deadlines that are not in WHAT WE SELL.
   - If is_spam is true, return empty strings for email_subject and email_body."""

    prompt = """=NEW LEAD
Name: {{ $json.name }}
Email: {{ $json.email || 'not given' }}
Company: {{ $json.company || 'not given' }}
Website: {{ $json.website || 'not given' }}
Phone: {{ $json.phone || 'not given' }}
Budget: {{ $json.budget || 'not given' }}
Timeline: {{ $json.timeline || 'not given' }}
Source: {{ $json.source }}

Message:
\"\"\"
{{ $json.message || '(empty)' }}
\"\"\"

Website excerpt: {{ $json.website_summary || 'n/a' }}"""

    llm_chain(wf, "AI: Qualify & Write Reply", (1600, 270), prompt, system, has_parser=True, per_item_errors=True)
    openai_model(wf, "OpenAI Chat Model", (1560, 480), temperature=0.5, json_mode=True)
    structured_parser(wf, "Qualification Format", (1720, 480), {
        "type": "object",
        "properties": {
            "score": {"type": "integer", "minimum": 0, "maximum": 100},
            "is_spam": {"type": "boolean"},
            "summary": {"type": "string", "description": "One sentence: what they need"},
            "key_needs": {"type": "array", "items": {"type": "string"}},
            "budget_fit": {"type": "string", "description": "good / unclear / too low – with a few words why"},
            "urgency": {"type": "string", "enum": ["high", "medium", "low"]},
            "next_step": {"type": "string", "description": "Recommended next action for the sales team"},
            "red_flags": {"type": "string", "description": "Concerns, or empty string"},
            "email_subject": {"type": "string"},
            "email_body": {"type": "string"},
        },
        "required": ["score", "is_spam", "summary", "key_needs", "budget_fit", "urgency", "next_step", "red_flags", "email_subject", "email_body"],
        "additionalProperties": False,
    })
    code_node(wf, "Lead Record", (1880, 270), code("06-lead-qualifier/lead_record.js"), each_item=True)

    # CRM
    crm = [
        ("Received", "={{ $json.received_at }}"), ("Name", "={{ $json.name }}"), ("Email", "={{ $json.email }}"),
        ("Phone", "={{ $json.phone }}"), ("Company", "={{ $json.company }}"), ("Website", "={{ $json.website }}"),
        ("Budget", "={{ $json.budget }}"), ("Timeline", "={{ $json.timeline }}"), ("Message", "={{ $json.message }}"),
        ("Score", "={{ $json.score }}"), ("Tier", "={{ $json.tier }}"), ("Summary", "={{ $json.summary }}"),
        ("Next step", "={{ $json.next_step }}"), ("Red flags", "={{ $json.red_flags }}"),
        ("Auto-reply sent", "={{ $json.send_reply ? 'yes' : 'no' }}"), ("Source", "={{ $json.source }}"),
    ]
    wf.add("CRM Row", "n8n-nodes-base.set", 3.4, set_fields(wf, [(n, v, "string") for n, v in crm], include_other=False), (2120, 60))
    wf.add("Save to CRM Sheet", "n8n-nodes-base.googleSheets", 4.6, {
        "operation": "append",
        "documentId": sheet_doc(f"={{{{ {CFG}.google_sheet_url }}}}"),
        "sheetName": sheet_tab(f"={{{{ {CFG}.sheet_tab }}}}"),
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []},
        "options": {},
    }, (2340, 60), retryOnFail=True, maxTries=3, waitBetweenTries=5000)

    # Reply
    wf.add("Send Reply?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "send-reply", "={{ $json.send_reply }}", "boolean", "true"),
    ]), (2120, 300))
    wf.add("Send Instant Reply", "n8n-nodes-base.gmail", 2.1, {
        "sendTo": "={{ $json.email }}",
        "subject": "={{ $json.email_subject }}",
        "emailType": "text",
        "message": "={{ $json.email_body }}",
        "options": {"appendAttribution": False, "senderName": f"={{{{ {CFG}.your_name }}}}"},
    }, (2340, 280))

    # Alerts
    wf.add("Hot Lead?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "is-hot", "={{ $json.tier }}", "string", "equals", "hot"),
    ]), (2120, 540))
    wf.add("Alert Me (Email)", "n8n-nodes-base.gmail", 2.1, {
        "sendTo": f"={{{{ {CFG}.your_email }}}}",
        "subject": "=🔥 Hot lead: {{ $json.name }} ({{ $json.score }}/100)",
        "message": "={{ $json.alert_email_html }}",
        "options": {"appendAttribution": False},
    }, (2340, 500))
    wf.add("Alert Me (Telegram)", "n8n-nodes-base.telegram", 1.2, {
        "chatId": f"={{{{ {CFG}.telegram_chat_id }}}}",
        "text": "={{ $json.alert_html }}",
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"},
    }, (2340, 700), disabled=True)

    wf.connect("Lead Form", "Normalize Lead")
    wf.connect("Website Form (Webhook)", "Normalize Lead")
    wf.chain("Normalize Lead", "Config", "Has Website?")
    wf.connect("Has Website?", "Visit Website", out=0)
    wf.connect("Has Website?", "Lead Data", out=1)
    wf.chain("Visit Website", "Website Snippet", "Lead Data")
    wf.chain("Lead Data", "AI: Qualify & Write Reply", "Lead Record")
    wf.connect("Lead Record", "CRM Row")
    wf.connect("Lead Record", "Send Reply?")
    wf.connect("Lead Record", "Hot Lead?")
    wf.connect("CRM Row", "Save to CRM Sheet")
    wf.connect("Send Reply?", "Send Instant Reply", out=0)
    wf.connect("Hot Lead?", "Alert Me (Email)", out=0)
    wf.connect("Hot Lead?", "Alert Me (Telegram)", out=0)
    wf.ai("OpenAI Chat Model", "AI: Qualify & Write Reply", "ai_languageModel")
    wf.ai("Qualification Format", "AI: Qualify & Write Reply", "ai_outputParser")
    return wf
