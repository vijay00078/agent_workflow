from lib.n8n import (Workflow, code, set_fields, openai_model, structured_parser, llm_chain, code_node,
                     http_node, sheet_doc, sheet_tab, if_params, condition, GREEN, BLUE, PURPLE, YELLOW, ORANGE, GRAY, RED)

CFG = "$('Config').first().json"
ROW = "$('Get Ready Topics').item.json"


def build():
    wf = Workflow("08 · AI SEO Blog Writer — Google Sheets → Google Docs", "08-ai-seo-blog-writer")

    wf.sticky("""## ✍️ AI SEO Blog Writer
**Add topics to a Google Sheet → every morning the AI researches the angle, builds an SEO brief and writes a full, formatted article straight into Google Docs.** Then it updates the sheet with the title, meta description, slug, word count and Doc link. 📈

### ⚡ Setup (≈10 min)
1. Import `Blog Topics.csv` into a Google Sheet (File → Import) — or create these columns: **Topic · Primary Keyword · Audience · Notes · Word Count · Status**
2. Put a few topics in it with **Status = Ready**
3. **Config** → paste the sheet URL, your brand, audience & voice (optional: a Drive folder link for the docs)
4. Connect **Google Sheets** (3 nodes) + **Google Drive** (*Create Google Doc*)
5. **OpenAI** models → your OpenAI API key
6. Click **Execute workflow** to write one now → then **Activate / Publish** for daily autopilot ☀️

### 💡 Good to know
- Writes `articles_per_run` articles per day (default 1).
- Brief: gpt-4.1-mini · Article: gpt-4.1 (≈ $0.02–0.04 per article).
- Failed rows get Status = **Error** with the reason — set back to *Ready* to retry.
- WordPress user? Enable **WordPress Draft** to also create a draft post.""", (-760, -340), 680, None, YELLOW)

    wf.section("### 1️⃣ Pick today's topics (Status = Ready)", ['Every Morning', 'Config', 'Get Ready Topics', 'Limit'], GREEN)
    wf.section("### 2️⃣ SEO brief → full article", ['AI: SEO Brief', 'Brief Model (gpt-4.1-mini)', 'Brief Format', 'Brief OK?', 'AI: Write Article', 'Writer Model (gpt-4.1)', 'Article OK?'], BLUE)
    wf.section("### 3️⃣ Formatted Google Doc + sheet updated", ['Build Google Doc', 'Create Google Doc', 'Done Row', 'Mark as Done', 'WordPress Draft'], ORANGE)
    wf.section("### ⚠️ If something fails\nThe row is marked **Error** with the reason.", ['Error Row', 'Mark as Error'], RED)

    wf.add("Every Morning", "n8n-nodes-base.scheduleTrigger", 1.2, {
        "rule": {"interval": [{"field": "days", "triggerAtHour": 8}]},
    }, (0, 240))
    wf.add("Config", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("google_sheet_url", "https://docs.google.com/spreadsheets/d/PASTE-YOUR-SHEET-ID/edit", "string"),
        ("sheet_tab", "Blog Topics", "string"),
        ("articles_per_run", 1, "number"),
        ("brand_name", "Morgan Digital", "string"),
        ("default_audience", "Small-business owners who are not marketing experts", "string"),
        ("brand_voice", "Clear, practical and friendly. Short sentences, real examples, no fluff.", "string"),
        ("language", "English", "string"),
        ("default_word_count", 1500, "number"),
        ("cta", "Want help putting this into practice? Book a free call: https://example.com/call", "string"),
        ("internal_links", "Pricing | https://example.com/pricing\nFree consultation | https://example.com/call", "string"),
        ("google_drive_folder_id", "", "string"),
    ], include_other=False), (220, 240), notes="✏️ Sheet URL + brand voice", notesInFlow=True)

    wf.add("Get Ready Topics", "n8n-nodes-base.googleSheets", 4.6, {
        "documentId": sheet_doc(f"={{{{ {CFG}.google_sheet_url }}}}"),
        "sheetName": sheet_tab(f"={{{{ {CFG}.sheet_tab }}}}"),
        "filtersUI": {"values": [{"lookupColumn": "Status", "lookupValue": "Ready"}]},
        "options": {},
    }, (440, 240), retryOnFail=True, maxTries=3, waitBetweenTries=5000)
    wf.add("Limit", "n8n-nodes-base.limit", 1, {
        "maxItems": f"={{{{ {CFG}.articles_per_run || 1 }}}}",
    }, (660, 240))

    brief_system = f"""=You are a senior SEO strategist. Create a winning content brief for a blog article.
Brand: {{{{ {CFG}.brand_name }}}}. Language: {{{{ {CFG}.language }}}}.
- title: compelling, max 60 characters, contains the primary keyword naturally.
- slug: short, lowercase, hyphenated, contains the primary keyword.
- meta_description: 140–155 characters, includes the keyword, promises a clear benefit.
- secondary_keywords: 5–8 related terms people also search for.
- search_intent: informational, commercial, transactional or navigational — plus one sentence on what the searcher really wants.
- outline: 5–8 H2 sections in a logical order, each with 2–4 key points and optional H3s. Cover the topic better than the current top results.
- faq: 4–5 real questions people ask about this topic.
- takeaways: 3–5 one-line key takeaways."""
    brief_prompt = f"""=TOPIC: {{{{ $json.Topic }}}}
PRIMARY KEYWORD: {{{{ $json['Primary Keyword'] || $json.Topic }}}}
AUDIENCE: {{{{ $json.Audience || {CFG}.default_audience }}}}
NOTES: {{{{ $json.Notes || 'none' }}}}"""

    llm_chain(wf, "AI: SEO Brief", (900, 240), brief_prompt, brief_system, has_parser=True, per_item_errors=True)
    openai_model(wf, "Brief Model (gpt-4.1-mini)", (860, 460), temperature=0.5, json_mode=True)
    structured_parser(wf, "Brief Format", (1000, 460), {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "slug": {"type": "string"},
            "meta_description": {"type": "string"},
            "primary_keyword": {"type": "string"},
            "secondary_keywords": {"type": "array", "items": {"type": "string"}},
            "search_intent": {"type": "string"},
            "outline": {"type": "array", "items": {"type": "object", "properties": {
                "h2": {"type": "string"},
                "key_points": {"type": "array", "items": {"type": "string"}},
                "h3s": {"type": "array", "items": {"type": "string"}},
            }, "required": ["h2", "key_points", "h3s"]}},
            "faq": {"type": "array", "items": {"type": "string"}},
            "takeaways": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["title", "slug", "meta_description", "primary_keyword", "secondary_keywords", "search_intent", "outline", "faq", "takeaways"],
    })

    writer_system = f"""=You are an expert writer for {{{{ {CFG}.brand_name }}}}. You write in-depth, genuinely useful blog articles that rank on Google and read like they were written by a human expert.

VOICE: {{{{ {CFG}.brand_voice }}}}
LANGUAGE: {{{{ {CFG}.language }}}}

OUTPUT FORMAT — VERY IMPORTANT
- Return ONLY the article body as clean HTML. No markdown, no ``` code fences, no <html>, <head>, <body> or <h1> tags.
- Allowed tags: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a href="…">, <blockquote>, <table>, <tr>, <th>, <td>.

STRUCTURE
1. Intro (2–3 short paragraphs): hook with the reader's problem, promise what they will learn. Use the primary keyword in the first 100 words.
2. "Key takeaways" box: an <h2> followed by a <ul> with the takeaways.
3. The H2/H3 sections from the outline. Short paragraphs (max 3 sentences), concrete examples, step-by-step instructions where useful, at least one list and — when it helps — one comparison table.
4. "FAQ" <h2> with each question as an <h3> and a concise answer.
5. Conclusion <h2> with a clear call to action: {{{{ {CFG}.cta }}}}

RULES
- Target length: about {{{{ $('Get Ready Topics').item.json['Word Count'] || {CFG}.default_word_count }}}} words.
- Use the primary keyword naturally 3–6 times and the secondary keywords where they fit. Never keyword-stuff.
- Add 2–3 internal links from this list where relevant (anchor text | URL):
{{{{ {CFG}.internal_links }}}}
- Do NOT invent statistics, studies, quotes or prices. If a number would help, describe it qualitatively instead.
- Avoid filler and clichés ("in today's digital age", "unlock", "delve", "game-changer")."""
    writer_prompt = f"""=Write the article.

TOPIC: {{{{ {ROW}.Topic }}}}
AUDIENCE: {{{{ {ROW}.Audience || {CFG}.default_audience }}}}
EXTRA NOTES: {{{{ {ROW}.Notes || 'none' }}}}

SEO BRIEF (JSON):
{{{{ JSON.stringify($json.output, null, 2) }}}}"""

    llm_chain(wf, "AI: Write Article", (1340, 240), writer_prompt, writer_system, per_item_errors=True)
    openai_model(wf, "Writer Model (gpt-4.1)", (1340, 460), model="gpt-4.1", temperature=0.7, timeout=300000)
    wf.add("Brief OK?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "brief-ok", "={{ $json.error }}", "string", "empty"),
    ]), (1120, 240))
    wf.add("Article OK?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "article-ok", "={{ $json.error }}", "string", "empty"),
        condition(wf, "article-text", "={{ $json.text }}", "string", "notEmpty"),
    ]), (1560, 240))

    code_node(wf, "Build Google Doc", (1780, 200), code("08-blog-writer/build_doc.js"), each_item=True)
    http_node(wf, "Create Google Doc", (2000, 200), {
        "method": "POST",
        "url": "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "googleDriveOAuth2Api",
        "sendBody": True,
        "contentType": "raw",
        "rawContentType": "={{ 'multipart/related; boundary=' + $json.boundary }}",
        "body": "={{ $json.multipart }}",
        "options": {"timeout": 60000},
    }, onError="continueErrorOutput", retryOnFail=True, maxTries=2, waitBetweenTries=5000)

    wf.add("Done Row", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("row_number", "={{ $('Build Google Doc').item.json.row_number }}", "number"),
        ("Status", "Done", "string"),
        ("Title", "={{ $('Build Google Doc').item.json.title }}", "string"),
        ("Doc URL", "={{ $json.webViewLink || ('https://docs.google.com/document/d/' + $json.id + '/edit') }}", "string"),
        ("Meta Description", "={{ $('Build Google Doc').item.json.meta_description }}", "string"),
        ("Slug", "={{ $('Build Google Doc').item.json.slug }}", "string"),
        ("Words", "={{ $('Build Google Doc').item.json.words }}", "number"),
        ("Written On", "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}", "string"),
    ], include_other=False), (2100, 200))
    wf.add("Mark as Done", "n8n-nodes-base.googleSheets", 4.6, {
        "operation": "update",
        "documentId": sheet_doc(f"={{{{ {CFG}.google_sheet_url }}}}"),
        "sheetName": sheet_tab(f"={{{{ {CFG}.sheet_tab }}}}"),
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": ["row_number"], "schema": []},
        "options": {},
    }, (2440, 200), retryOnFail=True, maxTries=3, waitBetweenTries=5000)

    wf.add("Error Row", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("row_number", f"={{{{ {ROW}.row_number }}}}", "number"),
        ("Status", "=Error: {{ String($json.error?.message || $json.error || 'unknown error – see n8n executions').slice(0, 150) }}", "string"),
        ("Written On", "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}", "string"),
    ], include_other=False), (2000, 600))
    wf.add("Mark as Error", "n8n-nodes-base.googleSheets", 4.6, {
        "operation": "update",
        "documentId": sheet_doc(f"={{{{ {CFG}.google_sheet_url }}}}"),
        "sheetName": sheet_tab(f"={{{{ {CFG}.sheet_tab }}}}"),
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": ["row_number"], "schema": []},
        "options": {},
    }, (2220, 600))

    wf.add("WordPress Draft", "n8n-nodes-base.wordpress", 1, {
        "title": "={{ $json.title }}",
        "additionalFields": {"content": "={{ $json.article_html }}", "slug": "={{ $json.slug }}", "status": "draft"},
    }, (2000, 400), disabled=True, notes="Optional: also create a WordPress draft", notesInFlow=True)

    wf.chain("Every Morning", "Config", "Get Ready Topics", "Limit", "AI: SEO Brief", "Brief OK?")
    wf.connect("Brief OK?", "AI: Write Article", out=0)
    wf.connect("Brief OK?", "Error Row", out=1)
    wf.connect("AI: Write Article", "Article OK?")
    wf.connect("Article OK?", "Build Google Doc", out=0)
    wf.connect("Article OK?", "Error Row", out=1)
    wf.connect("Build Google Doc", "Create Google Doc")
    wf.connect("Build Google Doc", "WordPress Draft")
    wf.connect("Create Google Doc", "Done Row", out=0)
    wf.connect("Create Google Doc", "Error Row", out=1)
    wf.chain("Done Row", "Mark as Done")
    wf.chain("Error Row", "Mark as Error")
    wf.ai("Brief Model (gpt-4.1-mini)", "AI: SEO Brief", "ai_languageModel")
    wf.ai("Brief Format", "AI: SEO Brief", "ai_outputParser")
    wf.ai("Writer Model (gpt-4.1)", "AI: Write Article", "ai_languageModel")

    wf.place({
        "Every Morning": (0, 240), "Config": (220, 240), "Get Ready Topics": (440, 240), "Limit": (660, 240),
        "AI: SEO Brief": (900, 240), "Brief Model (gpt-4.1-mini)": (860, 460), "Brief Format": (1000, 460),
        "Brief OK?": (1200, 240), "AI: Write Article": (1420, 240), "Writer Model (gpt-4.1)": (1440, 460),
        "Article OK?": (1720, 240),
        "Build Google Doc": (1960, 140), "Create Google Doc": (2180, 140), "Done Row": (2400, 140), "Mark as Done": (2620, 140),
        "WordPress Draft": (2180, 340),
        "Error Row": (2180, 700), "Mark as Error": (2400, 700),
    })
    return wf
