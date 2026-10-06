from lib.n8n import (Workflow, code, set_fields, openai_model, agent, code_node, if_params, condition,
                     switch_rule, rl, GREEN, BLUE, PURPLE, YELLOW, ORANGE, GRAY, RED)

CFG = "$('Config').first().json"
TG = "$('Telegram Trigger').item.json.message"


def build():
    wf = Workflow("04 · Telegram AI Personal Assistant (Voice, Calendar, Gmail & Tasks)", "04-telegram-ai-personal-assistant")

    wf.sticky("""## 🧠 Telegram AI Personal Assistant
**Your own "Jarvis" in Telegram. Text it or send a voice note — it checks your calendar, books meetings, searches & sends emails, manages your to-dos and answers anything.**

*"What's on my calendar tomorrow?"* · *"Book a call with Sam Friday 3pm"* · *"Any unread emails from Stripe?"* · *"Remind me to renew the domain"* 🎙️

### ⚡ Setup (≈10 min)
1. In Telegram, message **@BotFather** → `/newbot` → copy the token
2. **Telegram Trigger** → new *Telegram* credential → paste the token (reuse it on every Telegram node)
3. **OpenAI** nodes → your OpenAI API key
4. Google tools (Calendar ×2, Gmail ×2, Tasks ×3) → connect your Google account
5. **Activate / Publish** → message your bot → it replies with **your chat ID**
6. Paste that number into **Config → allowed_chat_id** → save. 🔒 Now it only obeys you.

### 💡 Good to know
- It **always asks before sending an email**.
- Voice note in → voice note out (turn off with `voice_replies` in Config).
- Don't use Gmail/Tasks? Select those tool nodes → press **D** to disable.
- Cost: ≈ $0.002–0.01 per request.""", (-760, -300), 680, None, YELLOW)

    wf.section("### 1️⃣ Message in → 🔒 only you\nUnknown chats are ignored. First message ever? You get your chat ID.", ['Telegram Trigger', 'Config', 'Who is it?', 'Send Your Chat ID', 'Typing…'], GREEN)
    wf.section("### 2️⃣ Voice, photo or text\n🎙️ transcribed · 📷 read by AI · 💬 as is", ['Message Type', 'Download Voice', 'Transcribe Voice', 'Voice Input', 'Download Photo', 'Read Photo', 'Photo Input', 'Text Input', 'Reply: Unsupported'], PURPLE)
    wf.section("### 3️⃣ The brain + its tools 🧰\nCalendar · Gmail · Tasks · Calculator · memory of your chat", ['AI Assistant', 'OpenAI Chat Model', 'Chat Memory', 'Calendar – Get Events', 'Calendar – Create Event', 'Gmail – Search Emails', 'Gmail – Send Email', 'Tasks – Add Task', 'Tasks – List Tasks', 'Tasks – Complete Task', 'Calculator'], BLUE)
    wf.section("### 4️⃣ Reply (text + optional voice)", ['Format Reply', 'Send Reply', 'Voice Reply?', 'Text to Speech', 'Send Voice Reply'], ORANGE)

    # ------------------------------------------------------------ input
    wf.add("Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, {
        "updates": ["message"],
        "additionalFields": {},
    }, (0, 300), webhook=True)

    wf.add("Config", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("allowed_chat_id", "", "string"),
        ("your_name", "Alex", "string"),
        ("assistant_name", "Jarvis", "string"),
        ("your_timezone", "", "string"),
        ("assistant_style", "Friendly, efficient and a little witty. Short answers that fit on a phone screen.", "string"),
        ("voice_replies", True, "boolean"),
        ("tts_voice", "nova", "string"),
    ]), (220, 300), notes="✏️ Paste your chat ID + timezone (e.g. Asia/Kolkata)", notesInFlow=True)

    wf.add("Who is it?", "n8n-nodes-base.switch", 3.2, {
        "rules": {"values": [
            switch_rule(wf, "setup", "Not locked yet", [condition(wf, "no-owner", f"={{{{ String({CFG}.allowed_chat_id || '').trim() }}}}", "string", "empty")]),
            switch_rule(wf, "owner", "You", [condition(wf, "is-owner", "={{ String($json.message.chat.id) }}", "string", "equals", f"={{{{ String({CFG}.allowed_chat_id).trim() }}}}")]),
        ]},
        "looseTypeValidation": True,
        "options": {},
    }, (440, 300), notes="Strangers are silently ignored", notesInFlow=True)

    wf.add("Send Your Chat ID", "n8n-nodes-base.telegram", 1.2, {
        "chatId": "={{ $json.message.chat.id }}",
        "text": f"=👋 Hi {{{{ $json.message.from.first_name || 'there' }}}}! I'm {{{{ {CFG}.assistant_name }}}}, your new AI assistant.\n\n🔐 Your chat ID is: <code>{{{{ $json.message.chat.id }}}}</code>\n\nPaste it into the <b>Config</b> node → <b>allowed_chat_id</b> and save the workflow. After that I'll only listen to you — and I'm ready to manage your calendar, emails and to-dos. 🚀",
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"},
    }, (700, 120))

    wf.add("Typing…", "n8n-nodes-base.telegram", 1.2, {
        "operation": "sendChatAction",
        "chatId": "={{ $json.message.chat.id }}",
        "action": "typing",
    }, (700, 320), onError="continueRegularOutput")

    wf.add("Message Type", "n8n-nodes-base.switch", 3.2, {
        "rules": {"values": [
            switch_rule(wf, "voice", "Voice note", [condition(wf, "is-voice", "={{ !!($json.message.voice || $json.message.audio) }}", "boolean", "true")]),
            switch_rule(wf, "photo", "Photo", [condition(wf, "is-photo", "={{ !!$json.message.photo }}", "boolean", "true")]),
            switch_rule(wf, "text", "Text", [condition(wf, "is-text", "={{ $json.message.text }}", "string", "notEmpty")]),
        ]},
        "looseTypeValidation": True,
        "options": {"fallbackOutput": "extra", "renameFallbackOutput": "Other"},
    }, (900, 520))

    # Voice
    wf.add("Download Voice", "n8n-nodes-base.telegram", 1.2, {
        "resource": "file",
        "fileId": "={{ ($json.message.voice || $json.message.audio).file_id }}",
    }, (1160, 300))
    wf.add("Transcribe Voice", "@n8n/n8n-nodes-langchain.openAi", 1.8, {
        "resource": "audio",
        "operation": "transcribe",
        "options": {},
    }, (1380, 300), retryOnFail=True, maxTries=2)
    wf.add("Voice Input", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("text", "={{ $json.text }}", "string"),
        ("chat_id", f"={{{{ {TG}.chat.id }}}}", "string"),
        ("input_type", "voice note (transcribed)", "string"),
    ], include_other=False), (1600, 300))

    # Photo
    wf.add("Download Photo", "n8n-nodes-base.telegram", 1.2, {
        "resource": "file",
        "fileId": "={{ $json.message.photo[$json.message.photo.length - 1].file_id }}",
    }, (1160, 520))
    wf.add("Read Photo", "@n8n/n8n-nodes-langchain.openAi", 1.8, {
        "resource": "image",
        "operation": "analyze",
        "modelId": rl("gpt-4.1-mini", "list", "GPT-4.1-MINI"),
        "text": f"=Describe this image for a personal assistant in 2-5 sentences. If it contains text (a receipt, note, screenshot, document, business card, event poster), transcribe the important text exactly (names, dates, times, amounts, addresses). User's caption: {{{{ {TG}.caption || 'none' }}}}",
        "inputType": "base64",
        "options": {"detail": "auto", "maxTokens": 600},
    }, (1380, 520), retryOnFail=True, maxTries=2)
    wf.add("Photo Input", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("text", f"=[I sent you a photo] {{{{ {TG}.caption ? 'My caption: \"' + {TG}.caption + '\". ' : '' }}}}What the photo shows: {{{{ $json.content || $json.text || JSON.stringify($json) }}}}", "string"),
        ("chat_id", f"={{{{ {TG}.chat.id }}}}", "string"),
        ("input_type", "photo (described by an image AI)", "string"),
    ], include_other=False), (1600, 520))

    # Text
    wf.add("Text Input", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("text", "={{ $json.message.text }}", "string"),
        ("chat_id", "={{ $json.message.chat.id }}", "string"),
        ("input_type", "text", "string"),
    ], include_other=False), (1600, 740))

    wf.add("Reply: Unsupported", "n8n-nodes-base.telegram", 1.2, {
        "chatId": "={{ $json.message.chat.id }}",
        "text": "I can handle text, voice notes 🎙️ and photos 📷 — try one of those!",
        "additionalFields": {"appendAttribution": False},
    }, (1160, 960))

    # ------------------------------------------------------------ brain
    now = f"({CFG}.your_timezone ? $now.setZone({CFG}.your_timezone) : $now)"
    system = f"""=You are {{{{ {CFG}.assistant_name }}}}, the personal AI assistant of {{{{ {CFG}.your_name }}}}, chatting on Telegram.
Style: {{{{ {CFG}.assistant_style }}}}

CURRENT DATE & TIME: {{{{ {now}.toFormat("cccc d LLLL yyyy, HH:mm") }}}} (timezone {{{{ {now}.zoneName }}}}, UTC offset {{{{ {now}.toFormat('ZZ') }}}}).
Always interpret relative dates ("tomorrow", "next Friday at 3") from this date/time and timezone. Tool inputs need full ISO 8601 date-times WITH the UTC offset, e.g. {{{{ {now}.startOf('day').plus({{ hours: 15 }}).toISO({{ suppressMilliseconds: true }}) }}}}.

YOUR TOOLS
• Calendar – Get Events: check the schedule (e.g. "today" = 00:00 to 23:59 today). Summarise events as a short list with times.
• Calendar – Create Event: default duration 30 minutes; confirm title, date and time back after creating.
• Gmail – Search Emails: use Gmail search syntax (from:, to:, subject:, is:unread, newer_than:7d, has:attachment). Summarise results as sender – subject – one-line gist.
• Gmail – Send Email: ALWAYS show the complete draft first (to, subject, body) and ask "Shall I send it?". Only send after the user clearly confirms in a later message.
• Tasks – Add / List / Complete: manage the to-do list. To complete a task, list tasks first to find its ID.
• Calculator: for any arithmetic.
For general questions, ideas, writing or advice, just answer from your own knowledge.

RULES
- Messages may be transcribed voice notes: ignore small transcription mistakes.
- Before deleting, sending or changing anything important, confirm with the user.
- If a tool fails, say briefly what went wrong (e.g. "I couldn't reach your calendar — check the Google credential in n8n").
- Keep answers short and skimmable on a phone: **bold** for key info, "-" bullet lists, no tables."""

    agent(wf, "AI Assistant", (2180, 520), "={{ $json.text }}", system, max_iterations=10)
    openai_model(wf, "OpenAI Chat Model", (2100, 760), temperature=0.4)
    wf.add("Chat Memory", "@n8n/n8n-nodes-langchain.memoryBufferWindow", 1.3, {
        "sessionIdType": "customKey",
        "sessionKey": "={{ 'telegram-' + $json.chat_id }}",
        "contextWindowLength": 20,
    }, (2240, 760))

    tool_y = 760
    wf.add("Calendar – Get Events", "n8n-nodes-base.googleCalendarTool", 1.3, {
        "descriptionType": "manual",
        "toolDescription": "Get the user's Google Calendar events between two date-times.",
        "operation": "getAll",
        "calendar": rl("primary", "list", "Primary calendar"),
        "limit": 25,
        "timeMin": "={{ $fromAI('start_time', 'Start of the period, ISO 8601 date-time with UTC offset', 'string') }}",
        "timeMax": "={{ $fromAI('end_time', 'End of the period, ISO 8601 date-time with UTC offset', 'string') }}",
        "options": {"orderBy": "startTime", "recurringEventHandling": "expand", "fields": "items(id,summary,start,end,location,description,hangoutLink,htmlLink)"},
    }, (2380, tool_y))
    wf.add("Calendar – Create Event", "n8n-nodes-base.googleCalendarTool", 1.3, {
        "descriptionType": "manual",
        "toolDescription": "Create an event in the user's Google Calendar.",
        "calendar": rl("primary", "list", "Primary calendar"),
        "start": "={{ $fromAI('start_time', 'Event start, ISO 8601 date-time with UTC offset', 'string') }}",
        "end": "={{ $fromAI('end_time', 'Event end, ISO 8601 date-time with UTC offset', 'string') }}",
        "additionalFields": {
            "summary": "={{ $fromAI('title', 'Short event title', 'string') }}",
            "description": "={{ $fromAI('notes', 'Optional notes for the event, empty string if none', 'string') }}",
            "location": "={{ $fromAI('location', 'Optional location or meeting link, empty string if none', 'string') }}",
        },
    }, (2500, tool_y + 160))
    wf.add("Gmail – Search Emails", "n8n-nodes-base.gmailTool", 2.1, {
        "descriptionType": "manual",
        "toolDescription": "Search the user's Gmail. Returns sender, subject and a snippet for each email.",
        "operation": "getAll",
        "limit": 10,
        "filters": {"q": "={{ $fromAI('search_query', 'Gmail search query, e.g. from:stripe newer_than:7d is:unread', 'string') }}"},
    }, (2620, tool_y))
    wf.add("Gmail – Send Email", "n8n-nodes-base.gmailTool", 2.1, {
        "descriptionType": "manual",
        "toolDescription": "Send an email from the user's Gmail. Only use after the user explicitly confirmed the draft.",
        "sendTo": "={{ $fromAI('to', 'Recipient email address(es), comma-separated', 'string') }}",
        "subject": "={{ $fromAI('subject', 'Email subject', 'string') }}",
        "emailType": "text",
        "message": "={{ $fromAI('body', 'Email body as plain text', 'string') }}",
        "options": {"appendAttribution": False},
    }, (2740, tool_y + 160))
    wf.add("Tasks – Add Task", "n8n-nodes-base.googleTasksTool", 1, {
        "descriptionType": "manual",
        "toolDescription": "Add a to-do to the user's Google Tasks list.",
        "task": "@default",
        "title": "={{ $fromAI('title', 'The task', 'string') }}",
        "additionalFields": {
            "dueDate": "={{ $fromAI('due', 'Optional due date-time in ISO 8601, empty string if none', 'string') }}",
            "notes": "={{ $fromAI('notes', 'Optional details, empty string if none', 'string') }}",
        },
    }, (2860, tool_y))
    wf.add("Tasks – List Tasks", "n8n-nodes-base.googleTasksTool", 1, {
        "descriptionType": "manual",
        "toolDescription": "List the user's open to-dos (with their IDs).",
        "operation": "getAll",
        "task": "@default",
        "limit": 50,
        "additionalFields": {"showCompleted": False},
    }, (2980, tool_y + 160))
    wf.add("Tasks – Complete Task", "n8n-nodes-base.googleTasksTool", 1, {
        "descriptionType": "manual",
        "toolDescription": "Mark a to-do as done. Needs the task ID from Tasks – List Tasks.",
        "operation": "update",
        "task": "@default",
        "taskId": "={{ $fromAI('task_id', 'ID of the task to complete', 'string') }}",
        "updateFields": {"status": "completed"},
    }, (3100, tool_y))
    wf.add("Calculator", "@n8n/n8n-nodes-langchain.toolCalculator", 1, {}, (3220, tool_y + 160))

    # ------------------------------------------------------------ reply
    code_node(wf, "Format Reply", (2520, 300), code("04-telegram/format_reply.js"), each_item=True)
    wf.add("Send Reply", "n8n-nodes-base.telegram", 1.2, {
        "chatId": "={{ $json.chat_id }}",
        "text": "={{ $json.html }}",
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"},
    }, (3400, 300))
    wf.add("Voice Reply?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "was-voice", "={{ $('Format Reply').item.json.input_type }}", "string", "equals", "voice"),
        condition(wf, "voice-on", f"={{{{ {CFG}.voice_replies }}}}", "boolean", "true"),
    ]), (3620, 300))
    wf.add("Text to Speech", "@n8n/n8n-nodes-langchain.openAi", 1.8, {
        "resource": "audio",
        "input": "={{ $('Format Reply').item.json.plain }}",
        "voice": f"={{{{ {CFG}.tts_voice || 'nova' }}}}",
        "options": {"response_format": "mp3"},
    }, (3840, 220), onError="continueRegularOutput")
    wf.add("Send Voice Reply", "n8n-nodes-base.telegram", 1.2, {
        "operation": "sendAudio",
        "chatId": "={{ $('Format Reply').item.json.chat_id }}",
        "binaryData": True,
        "additionalFields": {"title": f"={{{{ {CFG}.assistant_name }}}} 🎙️", "fileName": "reply.mp3"},
    }, (4060, 220), onError="continueRegularOutput")

    # ------------------------------------------------------------ wiring
    wf.chain("Telegram Trigger", "Config", "Who is it?")
    wf.connect("Who is it?", "Send Your Chat ID", out=0)
    wf.connect("Who is it?", "Typing…", out=1)
    wf.connect("Who is it?", "Message Type", out=1)
    wf.connect("Message Type", "Download Voice", out=0)
    wf.connect("Message Type", "Download Photo", out=1)
    wf.connect("Message Type", "Text Input", out=2)
    wf.connect("Message Type", "Reply: Unsupported", out=3)
    wf.chain("Download Voice", "Transcribe Voice", "Voice Input")
    wf.chain("Download Photo", "Read Photo", "Photo Input")
    for src in ("Voice Input", "Photo Input", "Text Input"):
        wf.connect(src, "AI Assistant")
    wf.chain("AI Assistant", "Format Reply", "Send Reply", "Voice Reply?")
    wf.connect("Voice Reply?", "Text to Speech", out=0)
    wf.connect("Text to Speech", "Send Voice Reply")

    wf.ai("OpenAI Chat Model", "AI Assistant", "ai_languageModel")
    wf.ai("Chat Memory", "AI Assistant", "ai_memory")
    for tool in ("Calendar – Get Events", "Calendar – Create Event", "Gmail – Search Emails", "Gmail – Send Email",
                 "Tasks – Add Task", "Tasks – List Tasks", "Tasks – Complete Task", "Calculator"):
        wf.ai(tool, "AI Assistant", "ai_tool")

    wf.place({
        "AI Assistant": (2330, 520), "OpenAI Chat Model": (2080, 760), "Chat Memory": (2220, 760),
        "Calendar – Get Events": (2380, 760), "Calendar – Create Event": (2540, 760),
        "Gmail – Search Emails": (2700, 760), "Gmail – Send Email": (2860, 760),
        "Tasks – Add Task": (2380, 950), "Tasks – List Tasks": (2540, 950),
        "Tasks – Complete Task": (2700, 950), "Calculator": (2860, 950),
        "Format Reply": (3060, 520), "Send Reply": (3280, 520), "Voice Reply?": (3500, 520),
        "Text to Speech": (3720, 420), "Send Voice Reply": (3940, 420),
    })
    return wf
