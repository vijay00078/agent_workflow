from lib.n8n import (Workflow, code, set_fields, openai_model, structured_parser, llm_chain, code_node,
                     if_params, condition, GREEN, BLUE, PURPLE, YELLOW, ORANGE, GRAY)

CFG = "$('Config').first().json"

DEFAULT_FEEDS = "\n".join([
    "https://techcrunch.com/category/artificial-intelligence/feed/",
    "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    "https://venturebeat.com/category/ai/feed/",
    "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    "https://openai.com/news/rss.xml",
    "https://blog.google/technology/ai/rss/",
    "https://hnrss.org/newest?q=AI&points=100",
])


def build():
    wf = Workflow("10 · Daily AI News Digest → Email / Telegram (Your Personal AI Editor)", "10-daily-ai-news-digest")

    wf.sticky("""## ☕ Daily AI News Digest
**Every morning an AI editor scans dozens of sources, throws out the noise and sends you a beautiful 2-minute briefing:** TL;DR, the 7 stories that matter *to you*, why each one matters, quick hits and an insight of the day. 📬

Works for **any industry** — just change the topics (Google News search) and feeds.

### ⚡ Setup (≈3 min)
1. **OpenAI Chat Model** → your OpenAI API key
2. **Send Email Digest** → connect Gmail
3. **Config** → your email, topics and *reader profile* (who you are & what you care about)
4. Click **Execute workflow** → check your inbox ✨ → **Activate / Publish**

### 💡 Tips
- Prefer Telegram? Enable **Send to Telegram** (select → **D**) and add your chat ID.
- Change the time in **Every Morning at 7**.
- A feed stopped working? Remove it — the digest keeps going with the others.
- Cost: ≈ $0.003 per digest (~$0.10/month).""", (-760, -320), 680, 860, YELLOW)

    wf.sticky("### 1️⃣ Collect today's news\nRSS feeds + Google News for every topic", (-40, 40), 920, 380, GREEN)
    wf.sticky("### 2️⃣ AI editor picks what matters to YOU", (900, 40), 680, 520, BLUE)
    wf.sticky("### 3️⃣ Beautiful briefing → inbox / Telegram", (1600, 40), 700, 520, ORANGE)

    wf.add("Every Morning at 7", "n8n-nodes-base.scheduleTrigger", 1.2, {
        "rule": {"interval": [{"field": "days", "triggerAtHour": 7}]},
    }, (0, 240))
    wf.add("Config", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("email_to", "you@example.com", "string"),
        ("digest_name", "Daily AI Briefing", "string"),
        ("reader_profile", "Founder of a small AI automation agency. Wants practical AI news: new models and tools, real business use-cases, automation, regulation. Not interested in hype or stock prices.", "string"),
        ("news_topics", "artificial intelligence\nAI agents\nOpenAI OR Anthropic OR Google Gemini", "string"),
        ("rss_feeds", DEFAULT_FEEDS, "string"),
        ("stories_count", 7, "number"),
        ("lookback_hours", 26, "number"),
        ("language", "English", "string"),
        ("news_language", "en", "string"),
        ("news_region", "US", "string"),
        ("accent_color", "#6d28d9", "string"),
        ("telegram_chat_id", "", "string"),
    ], include_other=False), (220, 240), notes="✏️ Your email, topics & interests", notesInFlow=True)

    code_node(wf, "Build Feed List", (440, 240), code("10-news-digest/build_feed_list.js"))
    wf.add("Read Feeds", "n8n-nodes-base.rssFeedRead", 1.2, {
        "url": "={{ $json.url }}",
        "options": {},
    }, (660, 240), onError="continueRegularOutput")
    code_node(wf, "Clean & Rank", (880, 240), code("10-news-digest/clean_and_rank.js"))
    wf.add("Any News?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "has-news", "={{ $json.count }}", "number", "gt", 0),
    ]), (1100, 240))

    system = f"""=You are the editor-in-chief of a premium daily briefing called "{{{{ {CFG}.digest_name }}}}".
READER: {{{{ {CFG}.reader_profile }}}}

From the candidate stories, pick the {{{{ {CFG}.stories_count }}}} most important and genuinely newsworthy ones FOR THIS READER. Prefer major launches, research breakthroughs, big business moves, regulation and practical tools the reader can use. Skip duplicates, listicles, opinion fluff, stock tips and minor updates.

For each pick return:
- id: the candidate id (number)
- headline: a clear, specific headline (max 12 words), no clickbait
- summary: 2 factual sentences based ONLY on the title and snippet — never invent details, numbers or quotes
- why_it_matters: 1 sentence on why this reader should care
- category: Launch, Research, Business, Policy, Tools, Security or Other
- emoji: one fitting emoji

Also return:
- tldr: 3 bullet points (max 20 words each) that summarise the day
- quick_hits: up to 5 more notable stories (id + headline of max 10 words)
- insight: one sharp, original takeaway or trend you notice across today's news (max 40 words)

Write everything in {{{{ {CFG}.language }}}}."""
    prompt = """=TODAY: {{ $now.toFormat('cccc d LLLL yyyy') }}

CANDIDATE STORIES (id | source | published | title | snippet):
{{ $json.candidates.map(c => c.id + ' | ' + c.source + ' | ' + String(c.published).slice(0, 16) + ' | ' + c.title + ' | ' + c.snippet).join('\\n') }}"""

    llm_chain(wf, "AI Editor: Pick & Summarize", (1340, 220), prompt, system, has_parser=True)
    openai_model(wf, "OpenAI Chat Model", (1300, 440), temperature=0.4, json_mode=True)
    structured_parser(wf, "Digest Format", (1460, 440), {
        "type": "object",
        "properties": {
            "tldr": {"type": "array", "items": {"type": "string"}},
            "top_stories": {"type": "array", "items": {"type": "object", "properties": {
                "id": {"type": "integer"}, "headline": {"type": "string"}, "summary": {"type": "string"},
                "why_it_matters": {"type": "string"}, "category": {"type": "string"}, "emoji": {"type": "string"},
            }, "required": ["id", "headline", "summary", "why_it_matters", "category", "emoji"]}},
            "quick_hits": {"type": "array", "items": {"type": "object", "properties": {
                "id": {"type": "integer"}, "headline": {"type": "string"},
            }, "required": ["id", "headline"]}},
            "insight": {"type": "string"},
        },
        "required": ["tldr", "top_stories", "quick_hits", "insight"],
    })

    code_node(wf, "Build Newsletter", (1660, 220), code("10-news-digest/build_newsletter.js"), each_item=True)
    wf.add("Send Email Digest", "n8n-nodes-base.gmail", 2.1, {
        "sendTo": f"={{{{ {CFG}.email_to }}}}",
        "subject": "={{ $json.subject }}",
        "message": "={{ $json.html }}",
        "options": {"appendAttribution": False},
    }, (1900, 140))
    wf.add("Send to Telegram", "n8n-nodes-base.telegram", 1.2, {
        "chatId": f"={{{{ {CFG}.telegram_chat_id }}}}",
        "text": "={{ $json.telegram }}",
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML", "disable_web_page_preview": True},
    }, (1900, 340), disabled=True)

    wf.chain("Every Morning at 7", "Config", "Build Feed List", "Read Feeds", "Clean & Rank", "Any News?")
    wf.connect("Any News?", "AI Editor: Pick & Summarize", out=0)
    wf.connect("AI Editor: Pick & Summarize", "Build Newsletter")
    wf.connect("Build Newsletter", "Send Email Digest")
    wf.connect("Build Newsletter", "Send to Telegram")
    wf.ai("OpenAI Chat Model", "AI Editor: Pick & Summarize", "ai_languageModel")
    wf.ai("Digest Format", "AI Editor: Pick & Summarize", "ai_outputParser")
    return wf
