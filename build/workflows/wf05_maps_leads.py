from lib.n8n import (Workflow, code, set_fields, openai_model, structured_parser, llm_chain, code_node,
                     if_params, condition, http_node, sheet_doc, sheet_tab, GREEN, BLUE, PURPLE, YELLOW, ORANGE, GRAY)

CFG = "$('Config').first().json"
FORM = "$('Lead Search Form').first().json"
LEAD = "$('Lead Data').item.json"
FIELD_MASK = ("places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,"
              "places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,"
              "places.googleMapsUri,places.primaryTypeDisplayName,places.businessStatus,nextPageToken")
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


def build():
    wf = Workflow("05 · Google Maps Lead Finder + AI Personalized Openers", "05-google-maps-lead-finder")

    wf.sticky("""## 🎯 Google Maps Lead Finder + AI Openers
**Type "dentists in Austin" → get up to 60 local businesses in your Google Sheet with phone, website, email, socials, a lead score and a personalised cold-email opener for each.** 🚀

### ⚡ Setup (≈10 min)
1. **Google Cloud** → enable *Places API (New)* → create an **API key** (PDF guide → *Google Maps API key*)
2. **Search Google Maps** → credential *Header Auth*: Name `X-Goog-Api-Key`, Value = your key
3. **OpenAI Chat Model** → your OpenAI API key
4. Make a Google Sheet (or import `Leads.csv` from the pack) → paste its URL in **Config**
5. **Save to Google Sheets** → connect Google
6. **Activate / Publish** → open the form URL (Lead Search Form → *Production URL*) 🔎

### 💡 Good to know
- Re-running a search **updates** existing rows (matched by Place ID) — no duplicates.
- Each lead gets **signals** (no online booking, outdated site, low rating…) → hyper-personal openers.
- Google gives a monthly free allowance for Places API — see the PDF for current pricing.
- AI cost ≈ $0.0005 per lead.
- ⚖️ Follow anti-spam & privacy laws (CAN-SPAM, GDPR) when contacting leads.""", (-760, -320), 680, 1000, YELLOW)

    wf.sticky("### 1️⃣ Search Google Maps\nUp to 3 pages × 20 results, closed businesses skipped.", (-40, 120), 1140, 400, GREEN)
    wf.sticky("### 2️⃣ Visit each website\nEmails (also hidden ones), Instagram/Facebook/LinkedIn, contact page & sales signals.", (1140, -60), 1180, 560, PURPLE)
    wf.sticky("### 3️⃣ AI scores the lead & writes the opener → Google Sheet", (2360, 120), 900, 560, BLUE)

    wf.add("Lead Search Form", "n8n-nodes-base.formTrigger", 2.2, {
        "formTitle": "🔎 Find local business leads",
        "formDescription": "Type a business type and a location. We'll search Google Maps, visit every website and write a personalised opener for each lead. Results appear in your Google Sheet within 1–3 minutes.",
        "formFields": {"values": [
            {"fieldLabel": "Business type", "placeholder": "e.g. dentists, roofers, yoga studios", "requiredField": True},
            {"fieldLabel": "City or area", "placeholder": "e.g. Austin, TX", "requiredField": True},
            {"fieldLabel": "How many leads?", "fieldType": "dropdown",
             "fieldOptions": {"values": [{"option": "20"}, {"option": "40"}, {"option": "60"}]}, "requiredField": True},
            {"fieldLabel": "Your offer (optional)", "fieldType": "textarea",
             "placeholder": "What do you sell? Leave empty to use the default from the Config node."},
        ]},
        "responseMode": "onReceived",
        "options": {
            "appendAttribution": False,
            "buttonLabel": "Find leads 🚀",
            "path": "find-leads",
            "respondWithOptions": {"values": {"respondWith": "text", "formSubmittedText": "✅ Searching Google Maps now… Your leads (with AI-written openers) will appear in your Google Sheet in 1–3 minutes."}},
        },
    }, (0, 300), webhook=True)

    wf.add("Config", "n8n-nodes-base.set", 3.4, set_fields(wf, [
        ("google_sheet_url", "https://docs.google.com/spreadsheets/d/PASTE-YOUR-SHEET-ID/edit", "string"),
        ("sheet_tab", "Leads", "string"),
        ("your_offer", "We build AI chatbots and online booking systems that turn website visitors into booked appointments — set up in 7 days.", "string"),
        ("your_name", "Alex", "string"),
        ("your_company", "Morgan Digital", "string"),
        ("opener_style", "Casual, specific and helpful. Sounds like a real person, not a template. No hype.", "string"),
        ("language", "English", "string"),
        ("language_code", "en", "string"),
        ("min_rating", 0, "number"),
        ("only_with_website", False, "boolean"),
    ]), (220, 300), notes="✏️ Sheet URL + what you sell", notesInFlow=True)

    http_node(wf, "Search Google Maps", (440, 300), {
        "method": "POST",
        "url": "https://places.googleapis.com/v1/places:searchText",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": True,
        "headerParameters": {"parameters": [{"name": "X-Goog-FieldMask", "value": FIELD_MASK}]},
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": f"={{{{ {{ textQuery: {FORM}['Business type'] + ' in ' + {FORM}['City or area'], pageSize: 20, languageCode: {CFG}.language_code || 'en' }} }}}}",
        "options": {
            "pagination": {"pagination": {
                "paginationMode": "updateAParameterInEachRequest",
                "parameters": {"parameters": [{"type": "body", "name": "pageToken", "value": "={{ $response.body.nextPageToken }}"}]},
                "paginationCompleteWhen": "other",
                "completeExpression": "={{ !$response.body.nextPageToken }}",
                "limitPagesFetched": True,
                "maxRequests": f"={{{{ Math.max(1, Math.ceil(Number({FORM}['How many leads?'] || 20) / 20)) }}}}",
                "requestInterval": 1500,
            }},
        },
    }, retryOnFail=True, maxTries=2)

    code_node(wf, "Split Places", (660, 300), code("05-maps-leads/split_places.js"))
    code_node(wf, "Prepare Lead", (880, 300), code("05-maps-leads/prepare_lead.js"), each_item=True)
    wf.add("Has Website?", "n8n-nodes-base.if", 2.2, if_params([
        condition(wf, "has-website", "={{ $json.website }}", "string", "notEmpty"),
    ]), (1100, 300))

    http_node(wf, "Visit Website", (1320, 160), {
        "url": "={{ $json.website }}",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "User-Agent", "value": BROWSER_UA},
            {"name": "Accept", "value": "text/html,application/xhtml+xml"},
        ]},
        "options": {
            "batching": {"batch": {"batchSize": 10, "batchInterval": 500}},
            "response": {"response": {"responseFormat": "text"}},
            "timeout": 12000,
        },
    }, onError="continueRegularOutput")
    code_node(wf, "Read Website", (1540, 160), code("05-maps-leads/read_website.js"), each_item=True)
    http_node(wf, "Visit Contact Page", (1760, 160), {
        "url": "={{ $json.contact_url }}",
        "sendHeaders": True,
        "headerParameters": {"parameters": [{"name": "User-Agent", "value": BROWSER_UA}]},
        "options": {
            "batching": {"batch": {"batchSize": 10, "batchInterval": 500}},
            "response": {"response": {"responseFormat": "text"}},
            "timeout": 12000,
        },
    }, onError="continueRegularOutput")
    code_node(wf, "Combine Contacts", (1980, 160), code("05-maps-leads/combine_contacts.js"), each_item=True)
    wf.add("Lead Data", "n8n-nodes-base.noOp", 1, {}, (2200, 300))

    system = f"""=You are an expert sales development rep and copywriter. You research local businesses and write short, genuinely personalised cold-email openers that get replies.

WHAT WE SELL: {{{{ {FORM}['Your offer (optional)'] || {CFG}.your_offer }}}}
SENDER: {{{{ {CFG}.your_name }}}} from {{{{ {CFG}.your_company }}}}
TONE: {{{{ {CFG}.opener_style }}}}
LANGUAGE: write everything in {{{{ {CFG}.language }}}}.

For the business below return:
1. lead_score (1–10): how likely they need AND can afford our offer. Weigh: fit of their category with our offer, rating & number of reviews (busy business = budget), website quality and the SIGNALS (missing online booking/chat/analytics, not mobile-friendly, outdated), and whether we can contact them.
2. score_reason: one short sentence.
3. personalization_hook: ONE specific, true observation about THIS business taken from the data (a service they offer, their rating, something on their website, a missing feature). Never invent facts.
4. email_subject: max 6 words, curiosity without clickbait, no emojis, no ALL CAPS.
5. opener: 2–3 sentences, max 60 words. Start with the hook, connect it to one concrete benefit of our offer, end with a low-pressure question. No "I hope this email finds you well", no generic flattery, no exclamation marks, no placeholders like [Name].
6. best_channel: the best way to reach them given the available contacts."""

    prompt = """=BUSINESS: {{ $json.name }}
CATEGORY: {{ $json.category || 'unknown' }}
ADDRESS: {{ $json.address }}
GOOGLE RATING: {{ $json.rating || 'no rating' }} ({{ $json.reviews || 0 }} reviews)
WEBSITE: {{ $json.website || 'none' }}
WEBSITE TITLE: {{ $json.website_title || '-' }}
WEBSITE TEXT (excerpt): {{ String($json.website_summary || '-').slice(0, 1200) }}
SIGNALS: {{ $json.website_signals || '-' }}
AVAILABLE CONTACTS: email={{ $json.email ? 'yes' : 'no' }}, phone={{ $json.phone ? 'yes' : 'no' }}, instagram={{ $json.instagram ? 'yes' : 'no' }}, facebook={{ $json.facebook ? 'yes' : 'no' }}, linkedin={{ $json.linkedin ? 'yes' : 'no' }}"""

    llm_chain(wf, "AI: Score & Write Opener", (2440, 300), prompt, system, has_parser=True, per_item_errors=True)
    openai_model(wf, "OpenAI Chat Model", (2400, 520), temperature=0.7, json_mode=True)
    structured_parser(wf, "Lead Format", (2560, 520), {
        "type": "object",
        "properties": {
            "lead_score": {"type": "integer", "minimum": 1, "maximum": 10},
            "score_reason": {"type": "string"},
            "personalization_hook": {"type": "string"},
            "email_subject": {"type": "string"},
            "opener": {"type": "string"},
            "best_channel": {"type": "string", "enum": ["email", "phone", "instagram", "facebook", "linkedin", "contact form"]},
        },
        "required": ["lead_score", "score_reason", "personalization_hook", "email_subject", "opener", "best_channel"],
        "additionalProperties": False,
    })

    columns = [
        ("Place ID", f"={{{{ {LEAD}.place_id }}}}"),
        ("Business Name", f"={{{{ {LEAD}.name }}}}"),
        ("Category", f"={{{{ {LEAD}.category }}}}"),
        ("Rating", f"={{{{ {LEAD}.rating }}}}"),
        ("Reviews", f"={{{{ {LEAD}.reviews }}}}"),
        ("Phone", f"={{{{ {LEAD}.phone }}}}"),
        ("Email", f"={{{{ {LEAD}.email }}}}"),
        ("Other Emails", f"={{{{ {LEAD}.other_emails }}}}"),
        ("Website", f"={{{{ {LEAD}.website }}}}"),
        ("Address", f"={{{{ {LEAD}.address }}}}"),
        ("Google Maps", f"={{{{ {LEAD}.maps_url }}}}"),
        ("Instagram", f"={{{{ {LEAD}.instagram }}}}"),
        ("Facebook", f"={{{{ {LEAD}.facebook }}}}"),
        ("LinkedIn", f"={{{{ {LEAD}.linkedin }}}}"),
        ("Lead Score", "={{ $json.output?.lead_score ?? '' }}"),
        ("Why this score", "={{ $json.output?.score_reason ?? 'AI step failed for this lead – run the search again to retry' }}"),
        ("Signals", f"={{{{ {LEAD}.website_signals }}}}"),
        ("Personalization hook", "={{ $json.output?.personalization_hook ?? '' }}"),
        ("Email subject", "={{ $json.output?.email_subject ?? '' }}"),
        ("AI Opener", "={{ $json.output?.opener ?? '' }}"),
        ("Best channel", "={{ $json.output?.best_channel ?? '' }}"),
        ("Search", f"={{{{ {LEAD}.search }}}}"),
        ("Found on", "={{ $now.toFormat('yyyy-MM-dd') }}"),
    ]
    wf.add("Format Row", "n8n-nodes-base.set", 3.4, set_fields(wf, [(n, v, "string") for n, v in columns], include_other=False), (2760, 300))

    wf.add("Save to Google Sheets", "n8n-nodes-base.googleSheets", 4.6, {
        "operation": "appendOrUpdate",
        "documentId": sheet_doc(f"={{{{ {CFG}.google_sheet_url }}}}"),
        "sheetName": sheet_tab(f"={{{{ {CFG}.sheet_tab }}}}"),
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": ["Place ID"], "schema": []},
        "options": {},
    }, (2980, 300), retryOnFail=True, maxTries=3, waitBetweenTries=5000)

    wf.chain("Lead Search Form", "Config", "Search Google Maps", "Split Places", "Prepare Lead", "Has Website?")
    wf.connect("Has Website?", "Visit Website", out=0)
    wf.connect("Has Website?", "Lead Data", out=1)
    wf.chain("Visit Website", "Read Website", "Visit Contact Page", "Combine Contacts", "Lead Data")
    wf.chain("Lead Data", "AI: Score & Write Opener", "Format Row", "Save to Google Sheets")
    wf.ai("OpenAI Chat Model", "AI: Score & Write Opener", "ai_languageModel")
    wf.ai("Lead Format", "AI: Score & Write Opener", "ai_outputParser")
    return wf
