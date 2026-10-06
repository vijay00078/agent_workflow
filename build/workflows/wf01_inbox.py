from lib.n8n import (Workflow, code, set_fields, openai_model, structured_parser, llm_chain,
                     code_node, if_params, condition, GREEN, BLUE, PURPLE, YELLOW, ORANGE, GRAY)

CFG = "$('Config').first().json"


def build():
    wf = Workflow("01 · AI Inbox Assistant — Email Triage & Draft Replies", "01-ai-inbox-assistant")

    # ------------------------------------------------------------ stickies
    wf.sticky("""## 📬 AI Inbox Assistant
**Every new email is read by AI, labeled in Gmail, summarized — and when someone is waiting for an answer, a reply in YOUR voice is saved as a draft in the same thread.**

You open Gmail → the draft is already there → tweak & send. ✉️

### ⚡ Setup (≈5 min)
1. **New Email** trigger → connect your **Gmail** account
2. **OpenAI Chat Model** → add your **OpenAI API key**
3. **Config** → your name, signature & writing style
4. Open **Get Gmail Labels**, **Create Label**, **Add Label** and **Create Draft Reply** → select the same Gmail account
5. Click **Execute workflow** (tests on your latest email) → check Gmail → **Activate / Publish** ✅

### 🏷️ Labels it creates (automatically)
AI/Urgent · AI/Client · AI/Lead · AI/Finance · AI/Meeting · AI/Personal · AI/Newsletter · AI/Notification · AI/Spam · AI/Other

### 💡 Good to know
- Drafts are **never sent automatically** — you stay in control.
- Promotions & Social tabs are skipped to save AI costs (edit the trigger's *Search* filter to change this).
- Cost: ≈ $0.001 per email with gpt-4.1-mini.
- 📱 Want phone alerts for urgent emails? Enable the **Urgent Alert (Telegram)** node.""", (-620, -260), 560, 900, YELLOW)

    wf.sticky("### 1️⃣ New email arrives\nChecks Gmail every minute, then strips quoted history & signatures so the AI reads only the new message.", (-40, 40), 700, 380, GREEN)
    wf.sticky("### 2️⃣ AI triage + reply draft\nCategory, priority, 1-line summary and — if needed — a reply written in your style.", (680, 40), 300, 560, BLUE)
    wf.sticky("### 3️⃣ Label it in Gmail\nUses `AI/<Category>` labels. Missing labels are created on the fly.", (1000, -200), 1180, 360, PURPLE)
    wf.sticky("### 4️⃣ Save a draft reply\nOnly when a real person is waiting for an answer. Drafts land in the same thread.", (1440, 180), 560, 260, ORANGE)
    wf.sticky("### 5️⃣ Optional: urgent alerts 📱\nSelect the Telegram node → press **D** to enable → add your bot + `telegram_chat_id` in Config.", (1440, 460), 560, 280, GRAY)

    # ------------------------------------------------------------ nodes
    wf.add("New Email", "n8n-nodes-base.gmailTrigger", 1.2, {
        "pollTimes": {"item": [{"mode": "everyMinute"}]},
        "simple": False,
        "filters": {
            "labelIds": ["INBOX"],
            "readStatus": "both",
            "q": "-category:promotions -category:social",
        },
        "options": {},
    }, (0, 200))

    wf.add("Config", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("your_name", "Alex Morgan", "string"),
        ("about_you", "Founder of Morgan Digital, a small agency that runs paid ads and email marketing for e-commerce brands.", "string"),
        ("writing_style", "Friendly, concise and professional. Short paragraphs. No fluff, no corporate jargon.", "string"),
        ("signature", "Best regards,\nAlex", "string"),
        ("reply_language", "Reply in the same language the sender used.", "string"),
        ("create_draft_replies", True, "boolean"),
        ("label_prefix", "AI", "string"),
        ("telegram_chat_id", "", "string"),
    ]), (220, 200), notes="✏️ Edit these settings — everything else works out of the box.", notesInFlow=True)

    code_node(wf, "Clean Email", (440, 200), code("01-inbox/clean_email.js"), each_item=True)

    system = f"""=You are the executive assistant of {{{{ {CFG}.your_name }}}}.
About them: {{{{ {CFG}.about_you }}}}

Your job: triage every incoming email and, when a reply is needed, draft one in their voice.

CATEGORY (pick exactly one):
- Urgent: time-sensitive problems or requests needing action within 24 hours (outages, escalations, failed payments, legal or security issues, hard deadlines)
- Client: existing customers or clients asking questions, giving feedback or requesting work
- Lead: new business inquiries, quote requests, partnership or sales opportunities from potential customers
- Finance: invoices, receipts, payments, billing, banking, taxes
- Meeting: meeting requests, scheduling or rescheduling, calendar coordination
- Personal: friends, family and personal matters
- Newsletter: newsletters, marketing emails, promotions, digests, content subscriptions
- Notification: automated notifications and alerts from apps, systems and services
- Spam: unsolicited cold pitches, SEO or link-building offers, scams, phishing
- Other: anything that fits nowhere else

PRIORITY: high = needs attention today, medium = this week, low = no action needed / FYI.

REPLY RULES
- needs_reply is true only if a real person is waiting for an answer from {{{{ {CFG}.your_name }}}}.
- Never draft replies to Newsletter, Notification or Spam emails.
- Writing style: {{{{ {CFG}.writing_style }}}}
- Language: {{{{ {CFG}.reply_language }}}}
- 40 to 150 words. Answer the actual question or propose one clear next step.
- Never invent facts, prices, dates or commitments. If something is unknown, use a placeholder in square brackets such as [DATE] or [PRICE] so it is easy to spot before sending.
- No subject line. Start with a greeting using the sender's first name. End with exactly this signature:
{{{{ {CFG}.signature }}}}

If needs_reply is false, return an empty string for reply."""

    prompt = """=Triage this email.

FROM: {{ $json.fromName }} <{{ $json.fromEmail }}>
SUBJECT: {{ $json.subject }}
RECEIVED: {{ $json.receivedAt }}
SENT BY AN AUTOMATED SYSTEM: {{ $json.automated ? 'probably yes (bulk / no-reply headers found)' : 'no signals found' }}

EMAIL:
\"\"\"
{{ $json.body }}
\"\"\""""

    llm_chain(wf, "AI Triage & Reply", (700, 200), prompt, system, has_parser=True, per_item_errors=True)
    openai_model(wf, "OpenAI Chat Model", (680, 420), temperature=0.4, json_mode=True)
    structured_parser(wf, "Triage Format", (840, 420), {
        "type": "object",
        "properties": {
            "category": {"type": "string", "enum": ["Urgent", "Client", "Lead", "Finance", "Meeting", "Personal", "Newsletter", "Notification", "Spam", "Other"]},
            "priority": {"type": "string", "enum": ["high", "medium", "low"]},
            "summary": {"type": "string", "description": "One short sentence: who wants what"},
            "needs_reply": {"type": "boolean"},
            "reply": {"type": "string", "description": "Full reply text with greeting and signature, or an empty string"},
        },
        "required": ["category", "priority", "summary", "needs_reply", "reply"],
        "additionalProperties": False,
    })

    wf.add("Get Gmail Labels", "n8n-nodes-base.gmail", 2.1, {
        "resource": "label",
        "returnAll": True,
    }, (1040, 200), executeOnce=True, alwaysOutputData=True)

    code_node(wf, "Prepare Actions", (1240, 200), code("01-inbox/prepare_actions.js"))

    # Labels
    wf.add("Label Exists?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "label-exists", "={{ $json.labelId }}", "string", "notEmpty"),
    ]), (1480, -20))
    wf.add("Create Label", "n8n-nodes-base.gmail", 2.1, {
        "resource": "label",
        "operation": "create",
        "name": "={{ $json.labelName }}",
        "options": {},
    }, (1720, 60), onError="continueRegularOutput")
    wf.add("Add Label", "n8n-nodes-base.gmail", 2.1, {
        "operation": "addLabels",
        "messageId": "={{ $('Prepare Actions').item.json.messageId }}",
        "labelIds": "={{ [ $json.labelId || $json.id ] }}",
    }, (1960, -20), onError="continueRegularOutput")

    # Draft
    wf.add("Needs Reply?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "needs-reply", "={{ $json.needs_reply }}", "boolean", "true"),
        condition(wf, "drafts-on", f"={{{{ {CFG}.create_draft_replies }}}}", "boolean", "true"),
    ]), (1480, 300))
    wf.add("Create Draft Reply", "n8n-nodes-base.gmail", 2.1, {
        "resource": "draft",
        "subject": "={{ /^re:/i.test($json.subject) ? $json.subject : 'Re: ' + $json.subject }}",
        "emailType": "text",
        "message": "={{ $json.reply }}",
        "options": {
            "threadId": "={{ $json.threadId }}",
            "sendTo": "={{ $json.fromEmail }}",
        },
    }, (1760, 280))

    # Urgent alert
    wf.add("Urgent?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "urgent", "={{ $json.urgent }}", "boolean", "true"),
    ]), (1480, 580))
    wf.add("Urgent Alert (Telegram)", "n8n-nodes-base.telegram", 1.2, {
        "chatId": f"={{{{ {CFG}.telegram_chat_id }}}}",
        "text": "={{ $json.alert_html }}",
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"},
    }, (1760, 580), disabled=True)

    # ------------------------------------------------------------ wiring
    wf.chain("New Email", "Config", "Clean Email", "AI Triage & Reply", "Get Gmail Labels", "Prepare Actions")
    wf.ai("OpenAI Chat Model", "AI Triage & Reply", "ai_languageModel")
    wf.ai("Triage Format", "AI Triage & Reply", "ai_outputParser")
    wf.connect("Prepare Actions", "Label Exists?")
    wf.connect("Prepare Actions", "Needs Reply?")
    wf.connect("Prepare Actions", "Urgent?")
    wf.connect("Label Exists?", "Add Label", out=0)
    wf.connect("Label Exists?", "Create Label", out=1)
    wf.connect("Create Label", "Add Label")
    wf.connect("Needs Reply?", "Create Draft Reply", out=0)
    wf.connect("Urgent?", "Urgent Alert (Telegram)", out=0)
    return wf
