# Client Finder Agent — fact sheet (internal, not shipped)

Every product document must agree with this file and with the code in `src/`. When in doubt, the code wins.

## Product
- Name: **Client Finder Agent**. Tiers: **Lite** (free), **Starter** ($49), **Pro** ($99).
- Promise: type a business type + city → the agent finds up to 60 local businesses on Google Maps, checks each one for a problem the buyer can fix, scores them 0-100, writes a short evidence-based pitch with Claude, saves everything to a Google Sheet and creates Gmail **drafts** (never sends anything).
- Built for n8n. Tested end to end on **n8n 1.123.83 and 2.42.3** (Cloud or self-hosted). Workflows use node versions that exist in n8n 1.123+.
- The buyer is a freelancer or small agency (web design, local SEO, reviews/reputation, social media & ads, AI chatbots/automation).

## What each tier contains
| | Lite (free) | Starter ($49) | Pro ($99) |
|---|---|---|---|
| Workflow(s) | `client-finder-lite.json` | `client-finder-web-design.json` | 5 niche workflows + `follow-up-autopilot.json` |
| Docs | QUICKSTART.pdf | START-HERE, SETUP-GUIDE, PROMPTS, CRM template, LICENSE | everything in Starter + PRO-GUIDE, OUTREACH-PLAYBOOK, TEMPLATES |
| Website checks / AI pitches / Sheet / Gmail drafts | no / no / no (CSV download) / no | yes, web-design niche | yes, all 5 niches |
| Follow-ups | – | – | Follow-up Autopilot |

Pro niche workflow files: `client-finder-web-design.json`, `client-finder-seo.json`, `client-finder-reviews.json`, `client-finder-social-media.json`, `client-finder-ai-chatbot.json`. The Pro web-design file is identical to Starter's: someone upgrading keeps their Starter workflow and skips that file (importing both would clash on the same form path).

## Lite workflow (free)
Nodes: Find Leads Form → ⚙️ Settings (searchLanguage `en`, searchCountryCode empty) → Prepare Search → Search OK? → Search Google Maps → Clean Leads → Found Any? → Build CSV Rows → Convert to CSV → Download CSV. Message page node: Show Message.
- Only credential: **Google API Key** = n8n credential type **Header Auth**, Name `X-Goog-Api-Key`, Value = the key. Select it on *Search Google Maps*.
- Google APIs to enable: **Places API (New)** only.
- Form URL path: `/form/client-finder-lite` (Production URL after the workflow is activated/published). Form fields: Business type, City or area, How many businesses? (20/40/60).
- Output: CSV download `leads-<search>.csv`. Columns: Business, Has Website (Yes/NO), Opportunity, Phone, Website, Category, Rating, Reviews, Address, Google Maps, Search. Businesses with no website come first.
- Messages it can show: "Google Maps search failed" (with the reason, e.g. API not enabled, key rejected, billing, key restriction, quota), "No businesses found", "Missing search details".

## Paid "Client Finder" workflow (one per niche)
Node order: Find Clients Form → ⚙️ Settings → Prepare Search → Settings OK? → Search Google Maps → Clean Leads → Read Saved Leads (Google Sheets) → Skip Saved Leads → Any New Leads? → [Has Website? → Fetch Website → Check Website → Site Loaded? → PageSpeed Test → Read PageSpeed] → All Leads (merge) → Find Problems & Score → Worth a Pitch? → Build AI Request → Write Pitch with Claude → Read AI Pitch → Retry Needed? → Wait Before Retry (15 s) → Retry Pitch with Claude → Read Retried Pitch → Pitched + Skipped (merge) → Create Draft? → Create Gmail Draft → Read Draft IDs → Ready to Save (merge) → Build Sheet Rows → Save to Google Sheet → Summary → Show Results. Message page: Show Message.
- Every niche loads each homepage (that is where contact emails come from). Niches without PageSpeed (Reviews, Social Media, AI Chatbots) skip the PageSpeed nodes, so they run faster. The Reviews niche's checks use only Google data (rating, review count vs. competitors).
- Form path: `/form/client-finder-<niche id>` (web-design, seo, reviews, social-media, ai-chatbot). Same 3 form fields as Lite. Runs take about 2-8 minutes (60 businesses with PageSpeed tests take longest); the browser tab shows a waiting page, then a results page.
- Credentials (4): **Google API Key** (Header Auth, `X-Goog-Api-Key`; used by Search Google Maps and PageSpeed Test), **Anthropic API Key** (Header Auth, Name `x-api-key`; used by Write Pitch with Claude and Retry Pitch with Claude), **Google Sheets** (OAuth2; used by Read Saved Leads and Save to Google Sheet), **Gmail** (OAuth2; used by Create Gmail Draft).
- Google APIs to enable: **Places API (New)** and **PageSpeed Insights API** (same API key). For self-hosted OAuth: **Google Sheets API** and **Gmail API**.
- Every run: skips businesses already in the sheet (by Google Place ID), so nobody is pitched twice. A second run on the same search shows "Nothing new this time".
- Results page: "Done: N new leads found" + counts (hot/warm, pitches written, Gmail drafts) + link to the sheet.

### Settings node fields (paid workflows)
| Field | Default | Meaning |
|---|---|---|
| yourName | `Your Name` | **Required.** Signs every email. The workflow refuses to run while it says "Your Name". |
| yourBusinessName | `Your Business` | Signature line 2. |
| yourWebsite | empty | Signature (optional). |
| yourPhone | empty | Signature (optional). |
| yourAddress | empty | Signature (optional). A physical postal address is required in commercial email in the US (CAN-SPAM). |
| yourService | niche default (web design: "website design and redesign") | What you sell; used in the pitch. |
| yourOffer | niche default (web design: "a free 2-minute video showing exactly what I would fix") | The low-friction next step offered in every pitch. |
| googleSheetUrl | `PASTE_YOUR_GOOGLE_SHEET_URL_HERE` | **Required.** Full URL of the CRM sheet (starts with https://docs.google.com/spreadsheets/d/). |
| createGmailDrafts | true | false = pitches only go to the sheet. |
| minScoreToPitch | 20 | Leads scoring below this get no AI pitch (saves AI cost). |
| emailLanguage | English | Language of the pitch (any language Claude writes). |
| emailTone | friendly, direct and human | Tone instruction. |
| maxEmailWords | 110 | 50-200. |
| optOutLine | `P.S. If this isn't useful, just reply "no thanks" and I won't email again.` | Appended to every first email. Leave it on. |
| aiModel | `claude-opus-5-5` | Any Claude model id. Cheaper: `claude-sonnet-5-5`, `claude-haiku-4-5`. |
| aiEffort | low | low/medium/high (ignored by models that don't support effort). |
| searchLanguage | en | Google Maps result language (2-letter code). |
| searchCountryCode | empty | Optional 2-letter country code to bias results (US, GB, IN, AE...). |

### Scoring
- Each niche pack gives points per problem found; score = sum, capped at 100. Priority: **Hot** ≥ 60, **Warm** 30-59, **Low** 1-29, **None** 0.
- Only evidence that was actually verified is used. If a site blocks bots (HTTP 401/403/429/503) its HTML checks are skipped rather than guessed. PageSpeed only runs for sites that loaded.
- Website fetch uses a browser-like user agent, 20 s timeout, follows up to 5 redirects.

### AI pitches
- Model call: Anthropic Messages API, structured JSON output (subject, email_body, dm_message, call_opener), `fallbacks: "default"` (server-side refusal fallback) on models that support it, effort `low` by default.
- The prompt contains only verified facts (name, category, address, rating, reviews, website domain, numbered problems with evidence) plus the buyer's name/business/service/offer. Rules: never invent facts or statistics, no links, no emojis, max words, greeting uses the business's short name, one yes/no question at the end.
- The workflow appends the signature ("Thanks," + name, business, website, phone, address) and the opt-out line.
- If the AI call fails with a temporary error (overloaded/rate limit/timeout) the lead is retried once after 15 seconds; if it still fails (or the error is permanent, e.g. bad key or no credits) a solid template pitch from the niche pack is used and the sheet's "AI Status" says why.
- Rough AI cost: about 1-2 US cents per pitch with claude-opus-5-5 at low effort ($4 / $20 per million input/output tokens); cheaper with Sonnet/Haiku. Only leads above minScoreToPitch are sent to the AI.

### Sheet (CRM template `Client-Finder-CRM.xlsx`, tab **Leads**)
Columns in order: Place ID, Business, Category, Phone, Email, Website, Address, Google Maps, Rating, Reviews, Score, Priority, Problems, Top Problem, Evidence, Email Subject, Email Body, DM Message, Call Opener, Status, Draft ID, Thread ID, Found On, Last Contacted, Follow-ups, Last Draft On, Niche, Search, AI Status, Notes.
Tabs: Leads, Pipeline (live counts), How to use. Import into Google Sheets: Drive → New → File upload → open → File → Save as Google Sheets (or Sheets → File → Import → Replace spreadsheet). Keep the tab name "Leads" and the header row.

Statuses: **New** (no pitch: score too low / no problems) · **Pitch ready** (pitch written, no public email or drafts off: call or DM) · **Draft ready** (Gmail draft waiting) · **Contacted** · **Follow-up drafted** · **Replied** · **Meeting booked** · **Won** · **Lost** · **Do not contact**.

### Messages the paid workflow can show (title → fix)
- "One setup step left" → put your real name in yourName / paste googleSheetUrl.
- "Missing search details" → fill both form fields.
- "Google Maps search failed: …" → the reason says which: key rejected (check credential, header name `X-Goog-Api-Key`), API not enabled (enable Places API (New), wait 2 min), billing (add billing account), key restriction (set Application restrictions to None, restrict by API), quota.
- "No businesses found" → broader area or different business type.
- "Couldn't open your Google Sheet" → wrong URL, missing "Leads" tab, or Sheets credential belongs to another Google account.
- "Nothing new this time" → everything found is already in the sheet; try a nearby area or related business type.
- Row-level notes: "Gmail draft failed: …" (Notes column), "Template used (AI error: …)" (AI Status column).

## Follow-up Autopilot (Pro)
Nodes: Every Morning (Schedule, daily 09:00 in the n8n instance timezone) + Run Now (manual) → ⚙️ Settings → Prepare Follow-ups → Settings OK? → Read Leads → Plan Gmail Searches → Anyone to Check? → Search Gmail → Decide Follow-ups → Any Changes? → Needs Follow-up? → Build Follow-up Request → Write Follow-up with Claude → Read Follow-up → Create Follow-up Draft → Read Follow-up Draft → All Updates → Sheet Updates → Update Leads → Report. Stops: Setup Problem? → Stop With Error (config problems fail the execution) / Nothing To Do (quiet end).
- Settings: googleSheetUrl, followUpDays `3,7`, maxFollowUps 2, yourName, yourBusinessName, yourWebsite, yourPhone, yourAddress, yourService, yourOffer (empty = the niche default of each lead), emailLanguage, emailTone, aiModel, aiEffort.
- Logic per lead with an email address (statuses Replied, Meeting booked, Won, Lost, Do not contact, Not interested, Bounced are never touched):
  - Reads Gmail (last 120 days): messages you **sent** to that address and messages **from** that address.
  - Reply after your first email → Status **Replied** (never followed up again).
  - Pitch never sent (still a draft) → nothing.
  - Sent, no reply, 3+ days since your last email and no unsent follow-up draft waiting → drafts follow-up #1 **in the same Gmail thread** (subject "Re: …"); 7+ days after that → follow-up #2 (a short, polite last note). Then stops (maxFollowUps).
  - A follow-up draft you haven't sent yet blocks new drafts (no duplicates).
  - Draft you sent but not yet due → Status **Contacted** + Last Contacted date.
- Each follow-up uses the angle of the niche that found the lead (sheet column Niche). AI failure → polite template follow-up. Gmail draft failure → note in Notes, counted again next day.
- Updates only the changed columns of the sheet.
- Gmail OAuth scopes are those of n8n's Gmail credential.

## Setup facts (Google / n8n)
- Google Cloud: create a project, attach a billing account (Google requires one for Maps Platform even within the free monthly usage), enable Places API (New) + PageSpeed Insights API, create an API key, restrict it to those two APIs, Application restriction **None** (n8n runs on a server).
- Places API cost: 1 search request returns up to 20 businesses; a 60-business search = 3 requests. Google provides a free monthly usage allowance for Maps Platform; set a budget alert. Don't promise exact free numbers (they change); link to Google's pricing page.
- PageSpeed Insights API: free (default quota is generous: 25,000 queries/day).
- Anthropic: console.anthropic.com → API keys → create key; add credits (prepaid).
- n8n Cloud: Google Sheets/Gmail credentials have a "Sign in with Google" button (managed OAuth).
- Self-hosted n8n: create an OAuth client (Web application) in Google Cloud, add the n8n OAuth redirect URL shown in the credential dialog, enable Google Sheets API + Gmail API, configure the OAuth consent screen (External), add yourself as a test user. **Gotcha:** while the consent screen is in "Testing", Google expires refresh tokens after 7 days → publish the app ("In production"); the unverified-app warning is fine for your own use.
- Activate/publish: in n8n 1.x toggle "Active"; in n8n 2.x click "Publish". Form trigger Production URL = `<your n8n>/form/<path>`.
- Testing in the editor: "Execute workflow" opens the test form (test URL) and shows data on each node.

## Things we must NOT claim
- No guaranteed income, number of clients, reply rates or "passive income". No fake testimonials.
- Never say emails are sent automatically. They are drafts.
- Don't claim the workflow scrapes Google Maps: it uses Google's official Places API.
- Don't claim 100% email coverage: emails come only from what the business publishes on its homepage.
## Checks catalog (id → label)
- no_website → "No website"
- site_down → "Website down"
- ssl_error → "Security certificate error"
- placeholder_site → "Placeholder website"
- slow_mobile → "Slow on mobile"
- no_https → "Not secure (no HTTPS)"
- not_mobile_friendly → "Not mobile-friendly"
- outdated_site → "Outdated website"
- weak_seo → "Weak SEO basics"
- no_schema → "No schema markup"
- low_rating → "Low Google rating"
- few_reviews → "Few Google reviews"
- no_booking → "No online booking"
- no_chat → "No chat or WhatsApp"
- limited_hours → "Limited opening hours"
- no_social → "No social media links"
- no_tracking → "No analytics or ad pixel"

## Default thresholds
```json
{
  "slowMobileScore": 50,
  "weakSeoScore": 80,
  "lowRating": 4,
  "minReviewsForRating": 5,
  "fewReviewsMax": 25,
  "fewReviewsRatio": 0.35,
  "minMarketForComparison": 5,
  "outdatedYears": 3,
  "earlyCloseWeekdays": 3
}
```

## Niche packs
### Web Design (web-design) — workflow file client-finder-web-design.json, form path /form/client-finder-web-design
- tagline: Find local businesses with a missing, broken, slow or outdated website.
- website check: true, PageSpeed: true
- default service: website design and redesign
- default offer: a free 2-minute video showing exactly what I would fix
- example search: dentists / Austin, TX
- weights: No website 45, Website down 45, Security certificate error 40, Placeholder website 40, Slow on mobile 30, Not mobile-friendly 30, Not secure (no HTTPS) 25, Outdated website 20, Weak SEO basics 10
- pitch angle: The sender is a web designer. Make the owner feel the cost of the website problem in plain words (people leave, call a competitor, or stop trusting the business) and position a fast, modern, mobile-friendly website as the fix.
### Local SEO (seo) — workflow file client-finder-seo.json, form path /form/client-finder-seo
- tagline: Find businesses that are losing Google searches to competitors.
- website check: true, PageSpeed: true
- default service: local SEO (getting found on Google Search and Google Maps)
- default offer: a free mini SEO audit with the 3 fixes that would help them most
- example search: plumbers / Denver, CO
- weights: Weak SEO basics 35, Slow on mobile 25, No schema markup 20, Few Google reviews 20, Not mobile-friendly 20, Not secure (no HTTPS) 15, No website 15, Outdated website 10
- pitch angle: The sender does local SEO. Connect the problem to being found: when someone nearby searches for this kind of business, competitors with these basics fixed tend to show up first. Avoid jargon; explain any technical term in a few plain words.
### Google Reviews & Reputation (reviews) — workflow file client-finder-reviews.json, form path /form/client-finder-reviews
- tagline: Find businesses with a low rating or far fewer reviews than their competitors.
- website check: true (for the contact email only), PageSpeed: false
- default service: getting more 5-star Google reviews from happy customers
- default offer: a free one-page plan to get more reviews from customers they already have
- example search: hair salons / Manchester, UK
- weights: Low Google rating 45, Few Google reviews 45, No website 10
- pitch angle: The sender helps businesses collect more Google reviews. Compare the business to its local competitors using only the numbers provided, and frame more reviews as winning the comparison customers make on Google Maps. Never promise a specific rating or number of reviews.
### Social Media & Ads (social-media) — workflow file client-finder-social-media.json, form path /form/client-finder-social-media
- tagline: Find businesses with no social presence on their website and no ad tracking.
- website check: true, PageSpeed: false
- default service: social media management and Instagram/Facebook ads
- default offer: 3 ready-to-post content ideas for their Instagram, free
- example search: gyms / Pune, India
- weights: No social media links 40, No analytics or ad pixel 30, No website 15, Few Google reviews 15, Outdated website 10
- pitch angle: The sender manages social media and ads. Explain that many customers check Instagram or Facebook before visiting, and that without a pixel they cannot re-reach people who already visited the website. Keep it practical, not salesy.
### AI Chatbots & Booking (ai-chatbot) — workflow file client-finder-ai-chatbot.json, form path /form/client-finder-ai-chatbot
- tagline: Find businesses that lose enquiries after hours: no online booking, no chat, short opening hours.
- website check: true, PageSpeed: false
- default service: AI assistants that answer enquiries and book appointments 24/7
- default offer: a free 5-minute demo of an AI assistant trained on their own website
- example search: physiotherapy clinics / Bangalore, India
- weights: No online booking 35, No chat or WhatsApp 30, Limited opening hours 25, No website 10
- pitch angle: The sender builds AI assistants and booking automation. Focus on enquiries that arrive after hours or while staff are busy, and how an assistant can answer and book instantly. Do not claim the AI replaces staff; position it as never missing an enquiry.

## Settings node (paid workflows) defaults
```json
{
  "yourName": "Your Name",
  "yourBusinessName": "Your Business",
  "yourWebsite": "",
  "yourPhone": "",
  "yourAddress": "",
  "yourService": "website design and redesign",
  "yourOffer": "a free 2-minute video showing exactly what I would fix",
  "googleSheetUrl": "PASTE_YOUR_GOOGLE_SHEET_URL_HERE",
  "createGmailDrafts": true,
  "minScoreToPitch": 20,
  "emailLanguage": "English",
  "emailTone": "friendly, direct and human",
  "maxEmailWords": 110,
  "optOutLine": "P.S. If this isn't useful, just reply \"no thanks\" and I won't email again.",
  "aiModel": "claude-opus-5-5",
  "aiEffort": "low",
  "searchLanguage": "en",
  "searchCountryCode": ""
}
```