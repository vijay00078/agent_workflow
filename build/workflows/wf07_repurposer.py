from lib.n8n import (Workflow, code, set_fields, openai_model, structured_parser, llm_chain, code_node,
                     http_node, sheet_doc, sheet_tab, GREEN, BLUE, PURPLE, YELLOW, ORANGE, GRAY)

CFG = "$('Config').first().json"


def build():
    wf = Workflow("07 · Blog-to-Social Content Repurposer (1 Article → 9 Posts)", "07-blog-to-social-repurposer")

    wf.sticky("""## ♻️ Blog-to-Social Content Repurposer
**Paste one article URL → get 9 ready-to-post pieces in ~30 seconds:** LinkedIn post · X thread · Instagram caption + hashtags · carousel slides · Facebook post · newsletter blurb · Reels/TikTok script · quote cards · AI image prompt. ✨

Everything is emailed to you **and** saved as drafts in a Content Calendar sheet.

### ⚡ Setup (≈5 min)
1. **OpenAI Chat Model** → your OpenAI API key
2. **Config** → your brand, audience, voice, CTA & email
3. **Email Me the Pack** → connect Gmail
4. **Save to Content Calendar** → connect Google + paste your sheet URL in Config
5. **Activate / Publish** → open the **Repurpose Form** URL and paste an article link 🔗

### 🤖 Autopilot (optional)
Enable **New Blog Post (RSS)** (select → press **D**) and put your blog's RSS feed URL in it — every new post gets repurposed automatically.
Want to auto-publish? Enable **Post to LinkedIn** and connect LinkedIn.

💡 Cost: ≈ $0.01 per article.""", (-760, -320), 680, None, YELLOW)

    wf.section("### 1️⃣ Article in (form or RSS)", ['Repurpose Form', 'New Blog Post (RSS)', 'Config'], GREEN)
    wf.section("### 2️⃣ Read the article + AI writes 9 posts", ['Fetch Article', 'Extract Article', 'AI: Create Content Pack', 'OpenAI Chat Model', 'Content Pack Format'], BLUE)
    wf.section("### 3️⃣ Deliver: email + content calendar", ['Build Email', 'Email Me the Pack', 'Calendar Rows', 'Save to Content Calendar', 'Post to LinkedIn'], ORANGE)

    wf.add("Repurpose Form", "n8n-nodes-base.formTrigger", 2.2, {
        "formTitle": "♻️ Repurpose an article",
        "formDescription": "Paste a blog post / article URL. You'll get 9 ready-to-post pieces by email in about 30 seconds.",
        "formFields": {"values": [
            {"fieldLabel": "Article URL", "placeholder": "https://yourblog.com/your-post", "requiredField": True},
            {"fieldLabel": "Tone", "fieldType": "dropdown", "fieldOptions": {"values": [
                {"option": "Use my brand voice (Config)"}, {"option": "Professional & insightful"}, {"option": "Friendly & casual"},
                {"option": "Bold & punchy"}, {"option": "Witty & playful"}]}},
            {"fieldLabel": "Extra instructions (optional)", "fieldType": "textarea", "placeholder": "e.g. focus on tip #3, mention our webinar on Friday"},
        ]},
        "responseMode": "onReceived",
        "options": {
            "appendAttribution": False,
            "buttonLabel": "Create my content ✨",
            "path": "repurpose",
            "respondWithOptions": {"values": {"respondWith": "text", "formSubmittedText": "✨ Working on it! Your content pack will arrive by email in about 30 seconds."}},
        },
    }, (0, 160), webhook=True)
    wf.add("New Blog Post (RSS)", "n8n-nodes-base.rssFeedReadTrigger", 1, {
        "pollTimes": {"item": [{"mode": "everyHour"}]},
        "feedUrl": "https://your-blog.com/feed/",
    }, (0, 380), disabled=True, notes="Optional autopilot – put your RSS URL here", notesInFlow=True)

    wf.add("Config", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("brand_name", "Morgan Digital", "string"),
        ("audience", "Small-business owners and marketers who want more leads without more work.", "string"),
        ("brand_voice", "Helpful, confident and down-to-earth. Practical tips, no jargon.", "string"),
        ("cta", "Book a free 20-minute strategy call: https://example.com/call", "string"),
        ("hashtags", "#marketing #smallbusiness", "string"),
        ("language", "English", "string"),
        ("your_email", "you@example.com", "string"),
        ("google_sheet_url", "https://docs.google.com/spreadsheets/d/PASTE-YOUR-SHEET-ID/edit", "string"),
        ("sheet_tab", "Content Calendar", "string"),
    ]), (240, 270), notes="✏️ Your brand + where to deliver", notesInFlow=True)

    http_node(wf, "Fetch Article", (460, 270), {
        "url": "={{ $json['Article URL'] || $json.link }}",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "User-Agent", "value": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"},
            {"name": "Accept", "value": "text/html,application/xhtml+xml"},
        ]},
        "options": {"response": {"response": {"responseFormat": "text"}}, "timeout": 20000},
    }, onError="continueRegularOutput")
    code_node(wf, "Extract Article", (700, 270), code("07-repurposer/extract_article.js"), each_item=True)

    system = f"""=You are a world-class social media strategist and ghostwriter for {{{{ {CFG}.brand_name }}}}.
AUDIENCE: {{{{ {CFG}.audience }}}}
TONE / VOICE: {{{{ $json.tone }}}}
CALL TO ACTION (weave in where natural): {{{{ {CFG}.cta }}}}
LANGUAGE: write everything in {{{{ {CFG}.language }}}}.
HASHTAGS TO ALWAYS INCLUDE (where hashtags are used): {{{{ {CFG}.hashtags }}}}

Turn the article into a complete content pack. Rules for every piece:
- Open with a scroll-stopping hook (a bold claim, a surprising point from the article, or a sharp question). Never open with clichés like "In today's fast-paced world".
- One idea per sentence, short paragraphs, lots of white space, concrete takeaways from the article.
- Stay 100% faithful to the article: never invent statistics, quotes, names or facts.
- Sound human. Avoid: "unlock", "delve", "game-changer", "elevate", "in conclusion", "dive in".

PLATFORM SPECS
- linkedin_post: 150–250 words. Hook line of max 12 words, then a blank line. A personal angle + 3–5 takeaways as "→" bullets. End with a question that invites comments, then 3–5 hashtags.
- x_thread: 5–8 tweets, each max 270 characters. Tweet 1 = a hook that makes people open the thread. Last tweet = CTA + the article link. At most 1 hashtag, in the last tweet. Do not number the tweets.
- instagram_caption: 100–180 words. Hook in the first line, value in the middle, clear CTA ("Save this for later", "Link in bio"). Emojis welcome. No hashtags here.
- instagram_hashtags: 15–20 relevant hashtags on one line (mix of broad and niche).
- carousel_slides: exactly 7 slides. Slide 1 = big headline (max 8 words). Slides 2–6 = one tip each (max 30 words). Slide 7 = CTA.
- facebook_post: 80–150 words, conversational, ends with a question and the article link.
- newsletter_blurb: first line "Subject: …", then an 80–120 word teaser that makes readers click the article link.
- short_video_script: 30–45 second script for Reels / TikTok / Shorts with [HOOK 0–3s], [BODY] and [CTA] sections and on-screen text suggestions in brackets.
- key_quotes: 3 short, punchy, quotable lines taken or adapted from the article.
- image_prompt: a detailed prompt for an AI image generator to create a header image (subject, style, composition, colours, mood). No text in the image.

EXTRA INSTRUCTIONS FROM THE USER: {{{{ $json.extra_instructions || 'none' }}}}"""

    prompt = """=ARTICLE TITLE: {{ $json.title }}
ARTICLE LINK: {{ $json.url }}
ARTICLE SUMMARY: {{ $json.description || '-' }}

ARTICLE TEXT:
\"\"\"
{{ $json.text }}
\"\"\""""

    llm_chain(wf, "AI: Create Content Pack", (940, 270), prompt, system, has_parser=True)
    openai_model(wf, "OpenAI Chat Model", (900, 480), temperature=0.8, json_mode=True, timeout=180000)
    structured_parser(wf, "Content Pack Format", (1060, 480), {
        "type": "object",
        "properties": {
            "linkedin_post": {"type": "string"},
            "x_thread": {"type": "array", "items": {"type": "string"}},
            "instagram_caption": {"type": "string"},
            "instagram_hashtags": {"type": "string"},
            "carousel_slides": {"type": "array", "items": {"type": "string"}},
            "facebook_post": {"type": "string"},
            "newsletter_blurb": {"type": "string"},
            "short_video_script": {"type": "string"},
            "key_quotes": {"type": "array", "items": {"type": "string"}},
            "image_prompt": {"type": "string"},
        },
        "required": ["linkedin_post", "x_thread", "instagram_caption", "instagram_hashtags", "carousel_slides",
                     "facebook_post", "newsletter_blurb", "short_video_script", "key_quotes", "image_prompt"],
        "additionalProperties": False,
    })

    code_node(wf, "Build Email", (1660, 80), code("07-repurposer/build_email.js"), each_item=True)
    wf.add("Email Me the Pack", "n8n-nodes-base.gmail", 2.1, {
        "sendTo": f"={{{{ {CFG}.your_email }}}}",
        "subject": "={{ $json.subject }}",
        "message": "={{ $json.html }}",
        "options": {"appendAttribution": False},
    }, (1880, 80))
    code_node(wf, "Calendar Rows", (1660, 300), code("07-repurposer/calendar_rows.js"))
    wf.add("Save to Content Calendar", "n8n-nodes-base.googleSheets", 4.6, {
        "operation": "append",
        "documentId": sheet_doc(f"={{{{ {CFG}.google_sheet_url }}}}"),
        "sheetName": sheet_tab(f"={{{{ {CFG}.sheet_tab }}}}"),
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []},
        "options": {},
    }, (1880, 300), retryOnFail=True, maxTries=3, waitBetweenTries=5000)
    wf.add("Post to LinkedIn", "n8n-nodes-base.linkedIn", 1, {
        "text": "={{ $json.output.linkedin_post }}",
        "additionalFields": {},
    }, (1660, 520), disabled=True, notes="Optional: auto-publish (connect LinkedIn first)", notesInFlow=True)

    wf.connect("Repurpose Form", "Config")
    wf.connect("New Blog Post (RSS)", "Config")
    wf.chain("Config", "Fetch Article", "Extract Article", "AI: Create Content Pack")
    wf.connect("AI: Create Content Pack", "Build Email")
    wf.connect("AI: Create Content Pack", "Calendar Rows")
    wf.connect("AI: Create Content Pack", "Post to LinkedIn")
    wf.connect("Build Email", "Email Me the Pack")
    wf.connect("Calendar Rows", "Save to Content Calendar")
    wf.ai("OpenAI Chat Model", "AI: Create Content Pack", "ai_languageModel")
    wf.ai("Content Pack Format", "AI: Create Content Pack", "ai_outputParser")
    return wf
