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
- Output: CSV download `leads-<search>.csv`. Columns: Business, Has Website (Yes/NO/"NO (Facebook page only)"...), Opportunity, Phone, Website, Category, Rating, Reviews, Address, Google Maps, Search, Source ("Google Maps"). Businesses with no website of their own come first. A value that starts with = + - or @ (for example a phone number "+1 512...") gets a leading apostrophe so spreadsheet apps don't run it as a formula.
- Setup takes about 10 minutes.
- Messages it can show: "Google Maps search failed" (with the reason, e.g. API not enabled, key rejected, billing, key restriction, quota), "No businesses found", "Missing search details".

## Paid "Client Finder" workflow (one per niche)
Node order: Find Clients Form → ⚙️ Settings → Prepare Search → Settings OK? → Search Google Maps → Clean Leads → Read Saved Leads (Google Sheets) → Skip Saved Leads → Any New Leads? → [Has Website? → Fetch Website → Check Website → (web design only: Recheck Needed? → Wait Before Recheck (15 s) → Fetch Website Again → Recheck Website → Checked) → (PageSpeed niches: Run PageSpeed? → PageSpeed Test → Read PageSpeed)] → All Leads (merge) → Find Problems & Score → Worth a Pitch? → Build AI Request → Write Pitch with Claude → Read AI Pitch → Retry Needed? → Wait Before Retry (15 s) → Retry Pitch with Claude → Read Retried Pitch → Pitched + Skipped (merge) → Recheck Sheet (Google Sheets) → Build Sheet Rows → Anything to Save? (no → Show Nothing New) → Save to Google Sheet → Create Draft? → Create Gmail Draft → Read Draft IDs → Save Draft IDs (Google Sheets) → Saved (merge) → Summary → Show Results. Message page: Show Message.
- Every niche loads each homepage (that is where contact emails come from). Niches without PageSpeed (Reviews, Social Media, AI Chatbots) skip the PageSpeed nodes, so they run faster. The Reviews niche's checks use only Google data (rating, review count vs. competitors).
- The sheet is written **before** any Gmail draft is created: rows are saved first (status "Draft ready" for leads that will get a draft), then the drafts are created and their Draft ID / Thread ID are written back. If Gmail refuses a draft, that row goes back to "Pitch ready" with a note. Just before saving, the sheet is read again, so a business another run saved in the meantime is skipped (no duplicate rows or drafts).
- Form path: `/form/client-finder-<niche id>` (web-design, seo, reviews, social-media, ai-chatbot). Same 3 form fields as Lite. Runs take about 2-8 minutes (60 businesses with PageSpeed tests take longest); the browser tab shows a waiting page, then a results page. The form says not to submit another search while one is running.
- Credentials (4): **Google API Key** (Header Auth, `X-Goog-Api-Key`; used by Search Google Maps and PageSpeed Test), **Anthropic API Key** (Header Auth, Name `x-api-key`; used by Write Pitch with Claude and Retry Pitch with Claude), **Google Sheets** (OAuth2; used by Read Saved Leads, Recheck Sheet, Save to Google Sheet and Save Draft IDs), **Gmail** (OAuth2; used by Create Gmail Draft).
- Google APIs to enable: **Places API (New)** and **PageSpeed Insights API** (same API key). For self-hosted OAuth: **Google Sheets API** and **Gmail API**.
- The Google Maps search includes service-area businesses (plumbers, cleaners, mobile trades without a storefront).
- Nobody is pitched twice: a run skips businesses already in the sheet (by Google Place ID), and a lead whose **email address or website** is already in the sheet, or appears on a higher-ranked lead in the same search (chain locations, duplicate listings), is saved but not pitched again (a saved row only counts when it was pitched or contacted or has a hands-off status — a row saved as "New" without a pitch doesn't block; two listings on one website count as the same business when it's the same page, one is the homepage, or their names start with the same word; a website typed by hand without https:// is recognised) ("Same email as …" in Notes, AI Status "Skipped (already pitched)"). An address or website whose row has a final status (Do not contact, Not interested, Bounced, Replied, Won, Lost, Meeting booked) is never pitched. A second run on the same search shows "Nothing new this time".
- Results page: "Done: N new leads found" + counts (hot/warm, pitches written, Gmail drafts) + lines for failed drafts, leads without a public email, duplicates not pitched again, and a tip to add yourAddress when it is empty + link to the sheet.
- One-time setup takes about 30-45 minutes the first time (Google Cloud, Anthropic, n8n credentials, sheet).

### Settings node fields (paid workflows)
| Field | Default | Meaning |
|---|---|---|
| yourName | `Your Name` | **Required.** Signs every email. The workflow refuses to run while it says "Your Name". |
| yourBusinessName | `Your Business` | Signature line 2. |
| yourWebsite | empty | Signature (optional). |
| yourPhone | empty | Signature (optional). |
| yourAddress | empty | Signature (optional, but the results page reminds you while it is empty). A physical postal address is required in commercial email in the US (CAN-SPAM). |
| yourService | niche default (web design: "website design and redesign") | What you sell; used in the pitch. |
| yourOffer | niche default (web design: "a free 2-minute video showing exactly what I would fix") | The low-friction next step offered in every pitch. Write it as you'd say it to the owner ("…for your Instagram"). |
| signOff | `Thanks,` | The line before your name in the signature (e.g. "Best regards,"). |
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
- Only evidence that was actually verified is used; when a check can't be sure, it makes no claim (and often leaves a note in the Notes column). Specifically:
  - Bot protection (HTTP 401/403/406/429/503), bot-check pages (a small page with a real challenge; Cloudflare's script on normal pages doesn't count), pages built entirely by JavaScript (almost no text plus scripts or an app mount point; a short page without scripts is read normally) and meta-refresh pages: no HTML-based claims ("Homepage not checked in detail" / "blocked our automated check" note).
  - "Website down" (web design) needs two failed loads 15 seconds apart (a custom pack that adds this check to a workflow without the second-check nodes never claims it), and is only claimed for: domain doesn't resolve, connection refused, 20 s timeout, 404/410, 5xx. Temporary DNS errors, connection resets and redirect loops are never claimed. A dead link that isn't the homepage (e.g. /locations/austin/) is reported as "Broken website link" with the exact link.
  - Security certificate errors are only claimed when Google PageSpeed (real Chrome) also refuses the certificate, or the fault is one every browser rejects (expired, wrong domain, self-signed). Otherwise: no claim, note "Our check couldn't verify the site's security certificate…".
  - "Not secure (no HTTPS)" only when the page finally loads on http:// (not for a single insecure image or an http→https redirect).
  - "Slow on mobile" below 45/100 (a margin under Google's 50 line, because lab scores vary a few points between runs); the evidence says it was Google's simulated phone test.
  - Lighthouse's own results win over our HTML reading (meta description, page title, mobile viewport).
  - "No chat" is not claimed when a tag manager (which can add a chat widget in the browser) is present; "No analytics or ad pixel" is not claimed on Wix, Squarespace, Shopify, GoDaddy, Weebly/Square Online, Duda, Jimdo, Strikingly or Hostinger sites (they have built-in visitor stats) or with a tag manager; "No social media links" is not claimed when a social feed widget is present.
  - Placeholder pages ("coming soon", parked, default server page) are only flagged on strong signals (the title or main heading is just "Coming soon"/"Under construction", parked/default-page wording, or a nearly empty page), and are judged on nothing else.
  - Online booking is recognised from booking tools (Calendly, Fresha, Zocdoc...), a button or link labelled like "Book now" / "Request an appointment", or a link to a clearly online booking page. Wording in a sentence ("call us to book an appointment") does not count, so phone-only businesses are still flagged.
  - A Google listing that points to a Facebook/Instagram/booking/delivery/directory page (incl. Clover, Mindbody, BBB, Manta, MapQuest), or a domain that forwards to one (seen in the page's canonical/og:url or PageSpeed's final URL), counts as "No website" — that page is never judged as theirs.
  - A certificate error is never claimed when PageSpeed (Chrome) loaded the page normally.
- Contact emails: the business's own domain (or the domain the page says it lives on, its canonical URL) first, then free-mail addresses (gmail, outlook…), then other domains only when the page links to them with mailto:. Cloudflare-protected addresses are decoded. Addresses in a "Website by…"/"Designed by…" credit, form placeholders, and platform support addresses are never used; other addresses seen on the page go to Notes as "Also on the site (maybe not theirs)".
- Website fetch uses a browser-like user agent, 20 s timeout, follows up to 10 redirects. Pages are read up to 600,000 characters (the first 400k and the last 200k, so the footer is kept).

### AI pitches
- Model call: Anthropic Messages API, structured JSON output (subject, email_body, dm_message, call_opener), `fallbacks: "default"` (server-side refusal fallback) on models that support it, effort `low` by default.
- The prompt contains only verified facts (name, category, address, rating, reviews, website domain, numbered problems with evidence) plus the buyer's name/business/service/offer. Rules: never invent facts or statistics, no links, no emojis, max words, greeting uses the business's short name, one yes/no question at the end.
- The workflow appends the signature (signOff, default "Thanks,", + name, business, website, phone, address) and the opt-out line.
- Requests are sent 3 at a time every 4 seconds (retries 2 every 5 seconds) with max_tokens 4,000 at low effort (more at higher effort), which suits new Anthropic accounts with low rate limits.
- If the AI call fails with a temporary error (overloaded/rate limit/timeout) the lead is retried once after 15 seconds; if it still fails (or the error is permanent, e.g. bad key or no credits) a solid template pitch from the niche pack is used and the sheet's "AI Status" says why. The template quotes the top problem's evidence ("…and one thing stood out: …") addressed to the business ("your homepage").
- Rough AI cost: about 1-2 US cents per pitch with claude-opus-5-5 at low effort ($4 / $20 per million input/output tokens); cheaper with Sonnet/Haiku. Only leads above minScoreToPitch are sent to the AI.

### Sheet (CRM template `Client-Finder-CRM.xlsx`, tab **Leads**)
Columns in order: Place ID, Business, Category, Phone, Email, Website, Address, Google Maps, Rating, Reviews, Score, Priority, Problems, Top Problem, Evidence, Email Subject, Email Body, DM Message, Call Opener, Status, Draft ID, Thread ID, Found On, Last Contacted, Follow-ups, Last Draft On, Niche, Search, AI Status, Notes.
Tabs: Leads, Pipeline (live counts), How to use. Import into Google Sheets: Drive → New → File upload → open → File → Save as Google Sheets (or Sheets → File → Import → Replace spreadsheet). Keep the tab name "Leads" and the header row.

Statuses: **New** (no pitch: score too low / no problems / already pitched under another listing) · **Pitch ready** (pitch written, no public email, drafts off or the draft failed: call or DM) · **Draft ready** (Gmail draft waiting) · **Contacted** · **Follow-up drafted** · **Replied** · **Meeting booked** · **Won** · **Lost** · **Do not contact** · **Not interested** · **Bounced** (set by the Autopilot when the email bounced). The last seven (Replied, Meeting booked, Won, Lost, Do not contact, Not interested, Bounced) are final: that address is never emailed again by either workflow, and the Client Finder never pitches that address or website again.

### Messages the paid workflow can show (title → fix)
- "One setup step left" → put your real name in yourName / paste googleSheetUrl.
- "Missing search details" → fill both form fields.
- "Google Maps search failed: …" → the reason says which: key rejected (check credential, header name `X-Goog-Api-Key`), API not enabled (enable Places API (New), wait 2 min; points to the "Google Cloud" step of the setup guide), billing (add billing account), API restriction (tick Places API (New) and PageSpeed Insights API under "API restrictions"), application restriction (set Application restrictions to None, restrict by API), quota.
- "No businesses found" → broader area or different business type.
- "Couldn't open your Google Sheet" → wrong URL, missing "Leads" tab, or Sheets credential belongs to another Google account.
- "Nothing new this time" → everything found is already in the sheet (or another run saved it a moment ago); try a nearby area or related business type.
- If the very last step (writing Draft IDs back) fails after its retries, n8n shows an error page, but the rows and drafts already exist: don't re-run the same search.
- Row-level notes (Notes column): "Gmail draft failed: …", "PageSpeed test failed: enable "PageSpeed Insights API" for your Google API key…", "Our check couldn't verify the site's security certificate…", "The site blocked our automated check…", "Homepage not checked in detail: …", "Same email/website as …", "Other emails: …", "Also on the site (maybe not theirs): …". AI Status column: "Written by …", "Template used (AI error: …)", "Skipped (…)".

## Follow-up Autopilot (Pro)
Nodes: Every Morning (Schedule, daily 09:00 in the n8n instance timezone) + Run Now (manual) → ⚙️ Settings → Prepare Follow-ups → Settings OK? → Read Leads → Plan Gmail Searches → Anyone to Check? → Search Gmail → Plan Thread Checks → Any Threads? → Read Gmail Threads → Gmail Results (merge) → Decide Follow-ups → Any Changes? → Needs Follow-up? → Build Follow-up Request → Write Follow-up with Claude → Read Follow-up → Create Follow-up Draft → Read Follow-up Draft → All Updates → Sheet Updates → Update Leads → Report. Stops: Setup Problem? → Stop With Error (config problems fail the execution) / Nothing To Do (quiet end).
- Settings: googleSheetUrl, followUpDays `3,7`, maxFollowUps 2, yourName, yourBusinessName, yourWebsite, yourPhone, yourAddress, yourService, yourOffer (empty = the niche default of each lead), signOff `Thanks,`, followUpOptOutLine `If you'd rather I didn't follow up, just reply and I'll stop.` (added to every follow-up; empty turns it off), emailLanguage, emailTone, aiModel, aiEffort.
- Logic per pitched lead with an email address. Only rows whose Status is empty, New, Pitch ready, Draft ready, Contacted or Follow-up drafted are acted on; any other status — the final ones (Replied, Meeting booked, Won, Lost, Do not contact, Not interested, Bounced) or one typed by hand ("Unsubscribed", "Call back"…) — means hands off, and an address with such a status on **any** row is never emailed from another row:
  - Reads Gmail (last 120 days): messages you **sent** to that address, messages **from** that address (including archived, deleted or spam), and **every message in the Gmail threads your pitches were sent in** — so a reply from a colleague or the owner's personal address counts, and so does a bounce.
  - Reply after your first email, from any address in the thread → Status **Replied** (never followed up again; Notes say who replied when it was another address). Out-of-office auto-replies don't count.
  - Delivery failure in the thread (mailer-daemon / "Delivery Status Notification") → Status **Bounced**. "Delivery delayed" notices don't count, and a later successful re-send to the same address clears an older failure.
  - A reply or bounce while a follow-up draft is still unsent → the status changes as above and Notes get "<date>: a follow-up draft is still in Gmail Drafts: delete it, don't send it"; the Report counts these. (The follow-up's draft id is kept in the Draft ID column.)
  - If a Gmail search or thread read fails, the run stops with an error (Stop With Error) and drafts nothing that day; the next run tries again.
  - Pitch never sent (still a draft) → nothing.
  - Sent, no reply, 3+ days since your last email and no unsent follow-up draft waiting → drafts follow-up #1 **in the same Gmail thread** (subject "Re: " + the subject of the email you really sent); 7+ days after that → follow-up #2 (with maxFollowUps 2, a short, polite last note). Then stops (maxFollowUps). With maxFollowUps 3-5, the follow-ups in between each add one new angle and only the last one closes the loop.
  - A follow-up draft you haven't sent yet blocks new drafts (no duplicates).
  - Draft you sent but not yet due → Status **Contacted** + Last Contacted date.
  - Last Contacted is only written from Gmail's own send date, and only when it is newer than the sheet's. A date you type by hand is read as a date in your sheet's locale (so 05/10/2026 means what your sheet shows); text dates like 25/09/2026 are read day-first when the first number is over 12, dotted dates (06.10.2026) day-first; impossible dates and dates in the future are ignored. A lead with only a hand-typed date (no Gmail send) gets its follow-up as a new email (its pitch subject without "Re:").
  - One action per address and per Place ID: if a Place ID is on several rows, only the first of those rows is ever used, whatever its status (that's the row n8n's update writes to). So a copy can't overwrite a "Do not contact" row and duplicates never cause daily repeat drafts. A pitch sent To + Cc two lead addresses is treated as sent to both.
- Each follow-up uses the angle of the niche that found the lead (sheet column Niche). AI failure → polite template follow-up. Gmail draft failure → a dated note at the front of Notes (your own notes are kept; yesterday's failure note is replaced), counted again next day.
- Updates only the changed columns of the sheet (Update Leads retries up to 4 times).
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
- Don't call it a scraper, and don't present "it uses the official API" as a legal guarantee. Say: it uses Google's official Places API with the buyer's own key, not a scraper. Google's Maps Platform Terms (section 3.2.3) restrict storing Places content such as business names and addresses outside Google's services (Place IDs may be kept); buyers should read the terms, treat the sheet as a working list, and delete leads they don't pursue.
- Don't claim 100% email coverage: emails come only from what the business publishes on its homepage.
- Don't claim the checks are always right: they are conservative and skip anything they can't verify, but the buyer reads every draft before sending.
- Don't say every problem type is checked on every site: absence checks (no booking, no chat, no tracking, no social) are skipped on pages we can't read reliably.

## Security and good practice
- The form is public at its Production URL. Recommend: keep the URL private, and lock it with n8n's built-in option (Find Clients Form → Authentication → Basic Auth, with a username/password credential) and/or change the form path to something unguessable.
- Every first email has the opt-out line, every follow-up has followUpOptOutLine; add yourAddress for US recipients (CAN-SPAM).
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
- site_down on a non-homepage link → "Broken website link"

## Default thresholds
```json
{
  "slowMobileScore": 45,
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
- website check: true, PageSpeed: true, second check of failing sites: true
- default service: website design and redesign
- default offer: a free 2-minute video showing exactly what I would fix
- example search: dentists / Austin, TX
- weights: No website 45, Website down 45, Security certificate error 40, Placeholder website 40, Slow on mobile 30, Not mobile-friendly 30, Not secure (no HTTPS) 25, Outdated website 20, Weak SEO basics 10
- pitch angle: The sender is a web designer. Make the owner feel the cost of the website problem in plain words (people leave, call a competitor, or stop trusting the business) and position a fast, modern, mobile-friendly website as the fix.
### Local SEO (seo) — workflow file client-finder-seo.json, form path /form/client-finder-seo
- tagline: Find businesses that are losing Google searches to competitors.
- website check: true, PageSpeed: true, second check of failing sites: false
- default service: local SEO (getting found on Google Search and Google Maps)
- default offer: a free mini SEO audit with the 3 fixes that would help you most
- example search: plumbers / Denver, CO
- weights: Weak SEO basics 35, Slow on mobile 25, No schema markup 20, Few Google reviews 20, Not mobile-friendly 20, Not secure (no HTTPS) 15, No website 15, Outdated website 10
- pitch angle: The sender does local SEO. Connect the problem to being found: when someone nearby searches for this kind of business, competitors with these basics fixed tend to show up first. Avoid jargon; explain any technical term in a few plain words.
### Google Reviews & Reputation (reviews) — workflow file client-finder-reviews.json, form path /form/client-finder-reviews
- tagline: Find businesses with a low rating or far fewer reviews than their competitors.
- website check: true (for the contact email only), PageSpeed: false, second check of failing sites: false
- default service: getting more 5-star Google reviews from happy customers
- default offer: a free one-page plan to get more reviews from customers you already have
- example search: hair salons / Manchester, UK
- weights: Low Google rating 45, Few Google reviews 45, No website 10
- pitch angle: The sender helps businesses collect more Google reviews. Compare the business to its local competitors using only the numbers provided, and frame more reviews as winning the comparison customers make on Google Maps. Never promise a specific rating or number of reviews.
### Social Media & Ads (social-media) — workflow file client-finder-social-media.json, form path /form/client-finder-social-media
- tagline: Find businesses with no social presence on their website and no ad tracking.
- website check: true, PageSpeed: false, second check of failing sites: false
- default service: social media management and Instagram/Facebook ads
- default offer: 3 ready-to-post content ideas for your Instagram, free
- example search: gyms / Pune, India
- weights: No social media links 40, No analytics or ad pixel 30, No website 15, Few Google reviews 15, Outdated website 10
- pitch angle: The sender manages social media and ads. Explain that many customers check Instagram or Facebook before visiting, and that without a pixel they cannot re-reach people who already visited the website. Keep it practical, not salesy.
### AI Chatbots & Booking (ai-chatbot) — workflow file client-finder-ai-chatbot.json, form path /form/client-finder-ai-chatbot
- tagline: Find businesses that lose enquiries after hours: no online booking, no chat, short opening hours.
- website check: true, PageSpeed: false, second check of failing sites: false
- default service: AI assistants that answer enquiries and book appointments 24/7
- default offer: a free 5-minute demo of an AI assistant trained on your own website
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
  "signOff": "Thanks,",
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

