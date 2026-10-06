from lib.n8n import (Workflow, code, set_fields, openai_model, llm_chain, code_node, if_params, condition,
                     GREEN, BLUE, YELLOW, ORANGE, RED)

CFG = "$('Config').first().json"


def build():
    wf = Workflow("BONUS · Workflow Error Alerts with AI Fix Suggestions", "bonus-workflow-error-alerts")

    wf.sticky("""## 🚨 Error Alerts with AI Fix Suggestions
**Never miss a broken automation again.** When ANY of your workflows fails you instantly get an email (or Telegram message) with the error, a plain-English explanation and the 3 most likely fixes — plus a button to open the failed run. 🛠️

### ⚡ Setup (≈3 min)
1. **OpenAI Chat Model** → your OpenAI API key
2. **Email Alert** → connect Gmail · put your email in **Config**
3. **Save** this workflow (no need to activate it)
4. Open each workflow you want to protect → **⋯ menu → Settings → Error workflow** → choose *this* workflow → Save ✅

### 💡 Good to know
- Same error repeating? You get **one alert per hour** (change `quiet_minutes`).
- Prefer Telegram? Enable **Telegram Alert** (select → **D**).
- Test it: open a workflow, break something on purpose (e.g. a wrong URL), run it from its trigger.""", (-760, -300), 680, 760, YELLOW)

    wf.sticky("### 1️⃣ Any workflow fails → collect the details", (-40, 40), 900, 380, RED)
    wf.sticky("### 2️⃣ AI explains it & suggests fixes", (900, 40), 460, 520, BLUE)
    wf.sticky("### 3️⃣ Alert you", (1380, 40), 700, 520, ORANGE)

    wf.add("When Any Workflow Fails", "n8n-nodes-base.errorTrigger", 1, {}, (0, 240))
    wf.add("Config", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("alert_email", "you@example.com", "string"),
        ("telegram_chat_id", "", "string"),
        ("quiet_minutes", 60, "number"),
    ]), (220, 240), notes="✏️ Where to send alerts", notesInFlow=True)
    code_node(wf, "Error Details", (440, 240), code("bonus-error-alerts/error_details.js"), each_item=True)
    wf.add("New Error?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "should-alert", "={{ $json.should_alert }}", "boolean", "true"),
    ]), (660, 240), notes="Skips repeats within the quiet period", notesInFlow=True)

    system = """=You are a senior n8n automation engineer helping a non-technical business owner.
Explain the error in 2 short, plain-English sentences (no jargon). Then list the 3 most likely fixes as numbered steps that say exactly where to click in n8n.
Typical causes to consider: an expired or disconnected credential (Google/Gmail OAuth → reconnect the credential), wrong or missing API key, OpenAI billing or quota (429 / insufficient_quota → add credit), rate limits (wait or add a Wait node), a wrong Google Sheet URL or tab name, missing column headers, a node that received no data, an AI answer in the wrong format (re-run), a website blocking the request, or the n8n instance not reachable over HTTPS for webhooks.
Max 120 words. Plain text, no markdown headings."""
    prompt = """=WORKFLOW: {{ $json.workflow_name }}
FAILED NODE: {{ $json.node }} {{ $json.node_type ? '(' + $json.node_type + ')' : '' }}
ERROR MESSAGE: {{ $json.message }}
DETAILS: {{ $json.description || '-' }}
HTTP CODE: {{ $json.http_code || '-' }}
STACK (first lines): {{ $json.stack || '-' }}"""
    llm_chain(wf, "AI: Explain & Suggest Fixes", (920, 240), prompt, system, per_item_errors=True)
    openai_model(wf, "OpenAI Chat Model", (920, 440), temperature=0.2)

    code_node(wf, "Build Alert", (1160, 240), code("bonus-error-alerts/build_alert.js"), each_item=True)
    wf.add("Email Alert", "n8n-nodes-base.gmail", 2.1, {
        "sendTo": f"={{{{ {CFG}.alert_email }}}}",
        "subject": "={{ $json.subject }}",
        "message": "={{ $json.html }}",
        "options": {"appendAttribution": False},
    }, (1420, 160))
    wf.add("Telegram Alert", "n8n-nodes-base.telegram", 1.2, {
        "chatId": f"={{{{ {CFG}.telegram_chat_id }}}}",
        "text": "={{ $json.telegram }}",
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML", "disable_web_page_preview": True},
    }, (1420, 360), disabled=True)

    wf.chain("When Any Workflow Fails", "Config", "Error Details", "New Error?")
    wf.connect("New Error?", "AI: Explain & Suggest Fixes", out=0)
    wf.chain("AI: Explain & Suggest Fixes", "Build Alert")
    wf.connect("Build Alert", "Email Alert")
    wf.connect("Build Alert", "Telegram Alert")
    wf.ai("OpenAI Chat Model", "AI: Explain & Suggest Fixes", "ai_languageModel")
    return wf
