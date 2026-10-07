# Gumroad listing copy: Client Finder Lite and Client Finder Agent

For the seller only. Do not put this file in any download.

This file has everything you need for two Gumroad products:

- **Part A:** the free product, *Client Finder Lite*.
- **Part B:** the paid product, *Client Finder Agent*, with two versions on one page: **Starter ($49)** and **Pro ($99)**.

---

## Before you paste anything

### 1. Replace the placeholders by hand

This file is not processed by `scripts/render-docs.js`, so nothing here is filled in automatically. Replace each placeholder before you paste.

| Placeholder | Replace with | Where the value is |
|---|---|---|
| `{{storeUrl}}` | The link to the paid product, for example `https://YOUR-STORE.gumroad.com/l/client-finder` | `config/product.json` → `storeUrl` |
| `{{supportEmail}}` | Your support email address | `config/product.json` → `supportEmail` |
| `{{sellerName}}` | Your name or business name | `config/product.json` → `sellerName` |
| `{{version}}` | The current version (1.0.0 today) | `config/product.json` → `version` |
| `[LITE LINK]` | The link to the free product, for example `https://YOUR-STORE.gumroad.com/l/client-finder-lite` | Gumroad, after you create Part A |
| `[ADD LATER: ...]` | Real results or real quotes only | Your own records |

### 2. The paid product's link must match `storeUrl`

The free Lite workflow links to the paid product in two places: a sticky note in the workflow and the page that appears after each search. Both use `storeUrl` from `config/product.json`.

- If you use the slug `client-finder` (suggested below), set `storeUrl` to `https://YOUR-STORE.gumroad.com/l/client-finder` with your real store name.
- If you choose another slug, change `storeUrl` to match.
- Then rebuild everything before you upload: `npm run build`, `python3 scripts/make-crm.py products/shared/Client-Finder-CRM.xlsx`, `npm run docs`, `npm run package`.

### 3. Paste formatted text, not raw Markdown

Gumroad's description box is a rich-text editor. It does not understand Markdown symbols such as `**` or `##`.

1. Open this file in a Markdown preview (VS Code, GitHub, Obsidian or similar).
2. Copy from the preview, so headings, bold text and lists paste as formatting.
3. Gumroad's editor may not keep tables. Under every table in the descriptions you will find a list version. Use that one if the table breaks.

### 4. The honesty rules for every word you publish

- No income claims. No promised number of leads, clients, replies or meetings.
- No fake reviews, fake testimonials, fake download counts or fake "as seen on" logos.
- The workflows never send email. They create Gmail drafts that the buyer reads and sends.
- The workflows use Google's official Places API with the buyer's own key, not a scraper. Never present that as proof that every use of the data is allowed. Use this wording, or something close: "It uses Google's official Places API with your own key, not a scraper. Google's Maps Platform Terms (section 3.2.3) restrict storing Places content such as business names and addresses outside Google's services (Place IDs may be kept), so read the terms, treat your sheet as a working list and delete leads you don't pursue."
- Emails are found only when a business publishes one on its homepage. Never claim full email coverage.
- Never claim the checks are always right. They are conservative and skip anything they can't verify, but the buyer reads every draft before sending.
- Example data in this file comes from the test businesses in `tests/fixtures/businesses.js` (for example "Sunrise Family Dental" in Austin, TX). These businesses are made up. Always label them as example data.
- When you have real results, add them only in the places marked `[ADD LATER: ...]`, with numbers you measured yourself and quotes you have written permission to use.
- Do not write that the product is "compliant with Google's terms", and never answer a terms question with "it does not scrape Google Maps". Google Maps Platform terms limit how Places data may be stored and used. Read them yourself and word any claim carefully.
- Do not suggest that Google, n8n, Anthropic or Meta made, approved or endorse the product. Naming them to say what the product uses is fine.
- Do not call the outreach "legal everywhere" or "compliant". The opt-out line and address field help, but the buyer is responsible for the rules where they send.

---

## Part A: Client Finder Lite (free)

### Product name

`Client Finder Lite: free n8n workflow for local leads`

Shorter option if you prefer: `Client Finder Lite (free n8n workflow)`

### URL slug

`client-finder-lite`

The full link becomes `https://YOUR-STORE.gumroad.com/l/client-finder-lite`. Use it wherever this file says `[LITE LINK]`.

### Price setting

1. Set the price to **$0**.
2. Turn on **pay what you want**, so the page shows "$0+".
3. Suggested price: leave it empty, or set a small amount such as $5. People can still type 0.
4. Upload `dist/Client-Finder-Lite-v1.0.0.zip` (the file name changes with the version).

> **Note:** Gumroad asks for an email address, even for a $0 download. These people appear in your Gumroad customer list. Before you email them about updates or offers, check Gumroad's rules and the email laws that apply to you and to them.

### Summary (Gumroad "Summary" field)

> A free n8n workflow. Type a business type and a city, and get a CSV of up to 60 local businesses from Google Maps, with the ones that have no website at the top.

### Description

Copy everything between the two lines below.

---

**Find local businesses with no website, in one form.**

Looking for local businesses that might need a website? Searching Google Maps by hand and copying names into a spreadsheet is slow work. Client Finder Lite does that part for you. It is free.

**What it does**

You type a business type (for example `dentists`) and a city (for example `Austin, TX`) into a simple web form. The workflow searches Google Maps through Google's official Places API and downloads a CSV file (a simple spreadsheet file) with up to 60 businesses.

- Businesses with **no website** come first.
- A listing that only links to a Facebook page, an Instagram profile, or a booking, delivery or directory page counts as "no website of their own". The CSV shows it, for example "NO (Facebook page only)".
- Every row has the phone number, website, category, Google rating, number of reviews, address and Google Maps link. A phone number such as "+1 512…" gets an apostrophe in front, so spreadsheet apps don't treat it as a formula.
- Closed businesses and duplicates are removed.
- It never contacts anyone. You decide what to do with the list.

It uses Google's official Places API with your own key, not a scraper. Google's Maps Platform Terms (section 3.2.3) restrict storing Places content such as business names and addresses outside Google's services (Place IDs may be kept), so read the terms, treat your CSV as a working list and delete leads you don't pursue.

**What you get**

- `client-finder-lite.json`: the workflow file you import into n8n.
- `QUICKSTART.pdf`: a step-by-step setup guide with screenshots. Setup takes about 10 minutes.
- `LICENSE.txt`: what you may do with the files.

**What you need**

- **n8n**, the automation tool the workflow runs in. n8n Cloud (the free trial works) or self-hosted n8n version 1.123 or newer, including n8n 2.x.
- **A Google account** and a Google Cloud project with billing turned on. Google asks for a billing account (usually a payment card) before it turns on Maps services, even inside its free monthly usage. The guide explains why.
- **A Google API key** with **Places API (New)** turned on. The guide shows you how.
- No AI account, no Gmail connection and no coding.

**What it costs to run**

Lite only uses the Google Places API. Google gives a free monthly usage allowance for Maps services. After that, Google charges per request. One request returns up to 20 businesses, so a 60-business search is 3 requests. Prices change, so check Google's pricing page and set a budget alert. The guide shows you how to set one.

**How it works: 3 steps**

1. **Create a Google API key** with Places API (New) turned on.
2. **Import the workflow into n8n** and add your key as a Header Auth credential (the name is `X-Goog-Api-Key`).
3. **Turn the workflow on and open its form.** In n8n 1.x, switch it to **Active**; in n8n 2.x, click **Publish**. Type a business type and a city, click **Find leads**, and your CSV downloads.

**Want more than a list?**

Lite tells you who has no website. The paid version, **Client Finder Agent**, goes further. It opens each business's website and checks it: speed on mobile, security certificate, mobile-friendly or not, outdated or not, and more. It scores every lead from 0 to 100 and shows the proof. Then Claude (an AI model) writes a short pitch based only on the facts the workflow verified. Everything is saved to a Google Sheet. For businesses with a public email, pitches become Gmail drafts that you read and send yourself.

- **Starter, $49:** the Web Design workflow.
- **Pro, $99:** five niches (web design, local SEO, Google reviews, social media and ads, AI chatbots and booking) plus a Follow-up Autopilot.

See the paid version: {{storeUrl}}

Client Finder Lite is an independent product. It is not made by, or affiliated with, Google or n8n.

---

### Tags

Gumroad may limit how many tags you can add. Add them in this order:

1. `n8n`
2. `lead generation`
3. `google maps`
4. `free workflow`
5. `web design`
6. `freelancer tools`
7. `automation`
8. `local business leads`

### Cover and thumbnail

The images are already made. They are in `marketing/`:

| File | Use | Size |
|---|---|---|
| `cover-lite.png` | Cover (the big image at the top of the page) | 2560 x 1440 px |
| `thumb-lite.png` | Thumbnail (the square image in Gumroad's lists and on your profile) | 1200 x 1200 px |

Gumroad asks for a cover of at least 1280 x 720 px (16:9) and a square thumbnail of at least 600 x 600 px. The files are exactly twice those sizes, so they stay sharp on high-resolution screens.

- The cover shows the real Lite form with an example search (`dentists`, `Austin, TX`).
- Add a short screen recording as a second cover item, if you can: `[ADD LATER: 30-60 second video: fill in the form, the CSV downloads, open it in Google Sheets]`. Use example data or blur real business names and phone numbers.
- Never add numbers to the images that you have not measured, such as "500 downloads".
- To remake the images after a design change, run `node scripts/screenshots.js`, then `node scripts/make-covers.js`.

### Call-to-action button

- Choose **"I want this!"**.
- If your Gumroad editor lets you type your own text, use **"Get the free workflow"**.
- If Gumroad only offers a fixed list of labels, pick the closest one.

### Receipt / thank-you message

Paste this into Gumroad's custom receipt message for the product. If you do not see that field, put the same text at the top of the product's content page.

> Thank you for downloading Client Finder Lite.
>
> Here is how to get your first list in about 10 minutes:
>
> 1. Download the zip file and unzip it.
> 2. Open QUICKSTART.pdf and follow it from the top. The Google Cloud steps take the longest.
> 3. Turn on **Places API (New)**. The older "Places API" without "(New)" will not work.
> 4. In n8n, create a Header Auth credential with the name `X-Goog-Api-Key` and your key as the value.
> 5. Turn the workflow on, open the form and try a small search first (20 businesses).
>
> Keep the form's address private: anyone who has it can run searches on your Google account. To lock it, open *Find Leads Form* → **Authentication** → **Basic Auth**, or change the form path to something hard to guess.
>
> Stuck? Most error pages tell you what to fix. If you still need help, email {{supportEmail}} with your n8n version and the exact message. Never send your API key.
>
> When you want website checks, scored leads and pitches written for you as Gmail drafts, the full Client Finder Agent is here: {{storeUrl}}
>
> {{sellerName}}

---

## Part B: Client Finder Agent (paid, Starter $49 and Pro $99)

### Product name

`Client Finder Agent: find local clients with proof and a pitch (n8n)`

Shorter option: `Client Finder Agent for n8n`

### URL slug

`client-finder`

The full link becomes `https://YOUR-STORE.gumroad.com/l/client-finder`. This must match `storeUrl` in `config/product.json` (see "Before you paste anything").

### Price and versions

Set up two versions on the same product.

| Version | Price | File to upload for this version |
|---|---|---|
| Starter | $49 | `dist/Client-Finder-Starter-v1.0.0.zip` |
| Pro | $99 | `dist/Client-Finder-Pro-v1.0.0.zip` |

1. Set the product price to **$49**.
2. Add a version called **Starter** and a version called **Pro**.
3. Depending on your Gumroad editor, a version price is either the full price (Starter $49, Pro $99) or an extra amount on top of the product price (Starter +$0, Pro +$50). Use the preview to check that buyers see **$49** and **$99**.
4. Give each version its own file. Gumroad lets you set different content for each version. Check in the preview that Starter buyers get only the Starter zip.
5. Make one test purchase of each version (for example with a 100% discount code) and check the download.

### Version descriptions (Gumroad's version selector)

**Starter ($49)**

> The Web Design workflow. Finds local businesses with a missing, broken, slow or outdated website, scores them, writes a pitch with Claude for each lead above your minimum score, and saves Gmail drafts (for businesses with a public email) for you to review. Includes the setup guide, pitch guide and Google Sheet CRM template.

**Pro ($99)**

> Everything in Starter, plus 4 more niches (Local SEO, Google Reviews, Social Media & Ads, AI Chatbots & Booking) and the Follow-up Autopilot, which checks Gmail every morning, marks replies and bounced emails, and drafts follow-ups in the same thread. Includes the Pro guide, outreach playbook and message templates.

### Upgrades from Starter to Pro (your decision)

Gumroad does not upgrade a one-time purchase to another version by itself. Choose your policy before launch. One fair option:

- Create a discount code worth what they already paid, for example `[UPGRADE CODE]` for $49 off the Pro version, so they pay only the $50 difference.
- Give it to Starter buyers who email you their receipt. If your Gumroad editor lets you limit a code to one product version or to one use, do that, so the code can't make Starter free or be shared.
- Starter buyers keep their workflow, credentials and sheet. The Pro web-design file is identical to Starter's, so they skip it.

Write your choice into the FAQ answer "Starter or Pro?" below, or remove that sentence.

### Summary (Gumroad "Summary" field)

> n8n workflows that find local businesses on Google Maps, check each one for a problem you can fix, and write an evidence-based pitch as a Gmail draft for you to review. Starter $49, Pro $99.

### Description

Copy everything between the two lines below.

---

**Find local businesses with a problem you can fix. See the proof. Get a pitch for the best ones.**

You type a business type and a city. Client Finder Agent finds up to 60 local businesses through Google's official Places API. It checks each one for a problem your service can fix, and it shows you the evidence, for example: "In Google's PageSpeed mobile test (a simulated phone on a 4G connection) the homepage scored 23/100 and the main content took 9.8 s to appear." Then Claude, an AI model, writes a short pitch based on those verified facts.

Every lead is saved to your Google Sheet. Pitches for businesses with a public email become Gmail drafts. Nothing is sent until you read it and click **Send**.

It runs in **n8n**, an automation tool where small steps (called *nodes*) are joined into a *workflow*. You do not need to code. You import a file, add four connections (two API keys, Google Sheets and Gmail) and fill in your details. The guide walks you through every click.

**What one lead looks like**

This is example data from our test set. Sunrise Family Dental is a made-up business, not a real result.

- **Business:** Sunrise Family Dental, PLLC, Austin, TX
- **Score:** 50 out of 100 (Warm)
- **Problems found:** Slow on mobile, Outdated website
- **Evidence:** "In Google's PageSpeed mobile test (a simulated phone on a 4G connection) the homepage scored 23/100 and the main content took 9.8 s to appear. Chrome's data from real visitors also rates the site slow." And: "The footer of their homepage still shows © 2019, which suggests the site hasn't been updated in about 7 years."
- **Email:** found on the homepage, so a Gmail draft was created. Status: **Draft ready**.

In the example draft, Claude opens with the slow mobile site, says in one sentence what that can cost the business, offers your next step (by default "a free 2-minute video showing exactly what I would fix") and ends with one yes/no question. Your signature and an opt-out line are added automatically.

**How it works: 4 steps**

1. **Find businesses.** Fill in a short form: business type, city or area, and how many businesses (20, 40 or 60). The agent searches Google Maps through the official Places API, including service-area businesses without a storefront (plumbers, cleaners, mobile trades). It removes duplicates, closed businesses and every business that is already in your sheet. A business that shares an email address or website with a lead already in your sheet, or with a better lead in the same search (a chain location or a duplicate listing), is saved but not pitched again, so nobody is pitched twice.
2. **Check their website.** It opens each homepage. In the Web Design and Local SEO workflows it also runs Google's PageSpeed test on mobile. It looks for the contact email, booking and chat tools, social media links and more. In Web Design, a site is flagged as down only when it fails to load twice, 15 seconds apart. If a site blocks automated visits, or its page is built entirely by JavaScript, the checks that need its code are skipped, never guessed, and the sheet says so in Notes.
3. **Score and write pitches.** It applies the checks for your niche and scores every lead from 0 to 100: **Hot** is 60 or more, **Warm** 30-59, **Low** 1-29. For each lead at or above your minimum score, Claude writes a short email, a DM version and a phone-call opener. Claude gets only the verified facts and is told never to invent numbers or claims. If the AI is busy, the agent waits 15 seconds and tries once more. If it still fails, a ready-made template pitch is used, and the sheet says why.
4. **Save and draft.** Every lead is saved first to your Google Sheet, which works as a simple CRM (a list of contacts and where each one stands). Then leads with a public email get a Gmail draft. You read, edit and send. A run takes about 2-8 minutes, and a results page shows what was found. Start one search at a time.

**What it checks, per niche**

Starter includes the Web Design workflow. Pro includes all five. Each problem is worth points, and the points add up to the lead's score (maximum 100).

- **Web Design:** no website, website down (or a broken website link), security certificate error, placeholder ("coming soon") website, slow on mobile, not mobile-friendly, not secure (no HTTPS), outdated website, weak SEO basics. Example search: dentists in Austin, TX.
- **Local SEO:** weak SEO basics, slow on mobile, no schema markup (the hidden labels that help Google show hours and reviews), few Google reviews compared with nearby competitors, not mobile-friendly, no HTTPS, no website, outdated website. Example search: plumbers in Denver, CO.
- **Google Reviews & Reputation:** low Google rating, far fewer reviews than competitors in the same search, no website. These checks use only Google Maps data. Example search: hair salons in Manchester, UK.
- **Social Media & Ads:** no social media links on the website, no analytics or ad pixel (the code that lets a business show ads to people who already visited its website), no website, few Google reviews, outdated website. Example search: gyms in Pune, India.
- **AI Chatbots & Booking:** no online booking, no chat or WhatsApp button, limited opening hours, no website. Example search: physiotherapy clinics in Bangalore, India.

Each niche also gives Claude its own angle and a default offer you can change. For example, the Local SEO default offer is "a free mini SEO audit with the 3 fixes that would help you most".

**What's included**

| | Starter, $49 | Pro, $99 |
|---|---|---|
| Niche workflows | 1: Web Design | 5: Web Design, Local SEO, Google Reviews & Reputation, Social Media & Ads, AI Chatbots & Booking |
| Google Maps search, up to 60 businesses per search | Yes | Yes |
| Website checks with proof | Yes | Yes, different checks per niche |
| Score from 0 to 100 (Hot, Warm, Low) | Yes | Yes |
| Pitch written by Claude: email, DM and call opener | Yes | Yes |
| Gmail drafts (never sent automatically) | Yes | Yes |
| Google Sheet CRM template | Yes | Yes |
| Nobody pitched twice (same Place ID, email or website) | Yes | Yes |
| Follow-up Autopilot | No | Yes |
| Guides | Start here, setup guide, pitch and prompt guide | Everything in Starter, plus the Pro guide (with how to build your own niche), outreach playbook and message templates |

The same comparison as a list:

- **Starter ($49):** the Web Design workflow; Google Maps search (up to 60 businesses per search); website checks with proof; a score from 0 to 100; pitches by Claude (email, DM and call opener); Gmail drafts; the Google Sheet CRM template; START-HERE, SETUP-GUIDE and PROMPTS guides.
- **Pro ($99):** everything in Starter, plus 4 more niche workflows (Local SEO, Google Reviews & Reputation, Social Media & Ads, AI Chatbots & Booking); the Follow-up Autopilot; the PRO-GUIDE (including how to build your own niche pack), OUTREACH-PLAYBOOK and TEMPLATES guides.

**About the Follow-up Autopilot (Pro)**

It runs every morning at 9:00 (in your n8n time zone). For every lead with an email address, it reads your Gmail: the pitch you sent, replies from that address, and every message in the Gmail thread your pitch was sent in.

- If anyone replied after your first email, it sets the status to **Replied** and never follows up with them again. A reply from a colleague or the owner's personal address in the same thread counts too (Notes says who replied). Out-of-office auto-replies don't count.
- If the email bounced (a delivery failure in the thread), it sets the status to **Bounced**.
- If you sent the pitch and got no reply after 3 days, it drafts follow-up #1 in the same Gmail thread.
- If you sent that follow-up and still have no reply 7 days later, it drafts a short, polite last note. Then it stops.
- Every follow-up ends with a short opt-out line, which you can change in the settings.
- It never touches leads marked Replied, Meeting booked, Won, Lost, Do not contact, Not interested or Bounced, and it never emails that address from another row.
- If Gmail can't be read that morning, it stops with an error and drafts nothing. It tries again the next day.

Like everything else, follow-ups are drafts. You read them and send them yourself.

**Who it is for**

- Freelancers and small agencies who sell web design, local SEO, reviews and reputation, social media and ads, or AI chatbots and booking to local businesses.
- People who want to send fewer, better messages, each one based on a real, checkable problem.
- People who want to read and approve every email before it goes out.
- n8n beginners who are happy to follow a step-by-step guide for about 30-45 minutes.

**Who it is not for**

- Anyone who wants to send mass emails automatically. It only creates drafts.
- Anyone looking for a guaranteed number of clients or replies. It finds and researches leads; the selling is still up to you.
- Anyone whose clients are not on Google Maps, such as large companies or online-only businesses.
- Anyone who needs the owner's personal email address. It only finds emails that a business publishes on its own homepage.
- Anyone who does not want to create a Google Cloud account with billing and an Anthropic account with prepaid credits.

**What you need**

- **n8n 1.123 or newer**, on n8n Cloud or self-hosted. It works on n8n 1.123+ and 2.x.
- **A Google Cloud project** with billing turned on, and an API key with **Places API (New)** and **PageSpeed Insights API** turned on.
- **An Anthropic API key** (for Claude) with prepaid credits. A Claude.ai chat subscription does not include API credits.
- **Gmail or Google Workspace**, for the drafts and the Google Sheet.
- On self-hosted n8n you also create a Google OAuth client for Sheets and Gmail. The setup guide covers this, including a Google setting that would otherwise make the connection stop working after 7 days.

**Honest running costs**

You pay each service directly for what you use. There are no extra fees from us.

- **n8n:** your n8n plan. Self-hosted n8n is free software; you pay for the server. Each search is one workflow run.
- **Google Places API:** Google gives a free monthly usage allowance for Maps services, then charges per request. A 60-business search is 3 requests. Prices change, so check https://mapsplatform.google.com/pricing/ and set a budget alert.
- **Google PageSpeed Insights API:** free. The default limit is 25,000 tests per day.
- **Claude (Anthropic):** roughly 1-2 US cents per pitch with the default model. Cheaper models cost less. Only leads at or above your minimum score are sent to Claude.
- **Google Sheets and Gmail:** included with your Google account.

> **Example:** If 10 leads in a search get a pitch, Claude costs roughly 10-20 US cents, plus up to 3 Places API requests.

**Works on n8n 1.123 and 2.x**

Every workflow uses only node versions that exist in n8n 1.123 and newer. Before release, every workflow was imported exactly as shipped into n8n 1.123.83 and n8n 2.42.3 and run end to end in automated tests. In those tests, test versions of the Google, Gmail and Claude services stood in for the real ones.

**What it does not do**

- It does not send email. You send every message yourself.
- It does not replace reading Google's terms. It uses Google's official Places API with your own key, not a scraper. Google's Maps Platform Terms (section 3.2.3) restrict storing Places content such as business names and addresses outside Google's services (Place IDs may be kept), so read the terms, treat your sheet as a working list and delete leads you don't pursue.
- It does not find an email for every business. Leads without a public email that score high enough get a DM message and a phone opener instead.
- It does not guess. If a check cannot be verified, the problem is not claimed. The checks are conservative, not perfect, so read every draft before you send it.
- It does not promise results. How many good leads you find depends on your niche, your area and your offer.

**Results**

[ADD LATER: real results only. For example: "In my own test, a search for [BUSINESS TYPE] in [CITY] found [N] businesses; [M] had a problem worth pitching." Use numbers you measured. Delete this paragraph until you have them.]

[ADD LATER: real buyer quotes only, with their written permission and their real name or business. If you gave them anything in return, such as a free copy, say so next to the quote. Delete this paragraph until you have them.]

**Questions**

**Does it send emails automatically?**
No. It creates Gmail drafts. You open each one, check it against the evidence in your sheet, change anything you like and click Send. The Follow-up Autopilot in Pro also only creates drafts.

**Where does the data come from, and can I keep it?**
It uses Google's official Places API with your own key, not a scraper. You can see how many requests you made in your own Google Cloud console. Using the official API does not mean every use of the data is allowed: Google's Maps Platform Terms (section 3.2.3) restrict storing Places content such as business names and addresses outside Google's services (Place IDs may be kept), so read the terms, treat your sheet as a working list and delete leads you don't pursue. This is not legal advice.

**How many leads do I get?**
Up to 60 businesses per search. That is the most Google's Places API gives for one search (3 pages of 20). You can run as many searches as you like, one at a time: a nearby area, another part of the city or a related business type. Every new run skips businesses that are already in your sheet, and never pitches an email address or website that is already in your sheet. How many leads have a problem worth pitching depends on the area and the niche, so we cannot promise a number.

**Will it find an email for every business?**
No. It finds an email only when the business publishes one on its homepage. It never uses a web designer's "Website by…" address or a booking platform's support address. Leads without a public email that score high enough still get a pitch, a short DM message and a phone-call opener in the sheet, with the status **Pitch ready**.

**Do I need to know n8n or how to code?**
No coding. You import a file, connect four accounts (Google API key, Anthropic API key, Google Sheets, Gmail) and type your details into one settings box. The setup guide shows every click. Plan about 30-45 minutes the first time, a bit longer on self-hosted n8n.

**What will it cost me to run?**
Apart from your n8n plan, you pay Google and Anthropic directly. With the default AI model, one pitch costs roughly 1-2 US cents. Google gives a free monthly usage allowance for Maps searches, then charges per request; set a budget alert. PageSpeed tests are free. See "Honest running costs" above.

**Does it work outside the US, and in other languages?**
Yes. It works wherever Google Maps lists businesses. You can set the country and language of the search, and Claude can write the pitch in any language it writes, for example English, Spanish or Hindi. A few parts are not translated for you: the sign-off before your name ("Thanks," by default) and the opt-out line are settings you type in your own language, and the backup template pitch is in English. Check each draft. The rules for business email are different in every country; check the ones that apply to you.

**Is cold email allowed?**
That depends on where you and the business are. This is not legal advice. The workflow gives you tools that help: every first email ends with an opt-out line (and in Pro, every follow-up too), there is a field for your postal address (required in commercial email in the US, and the results page reminds you while it is empty), you can mark a lead **Do not contact** or **Not interested**, and nobody in your sheet is pitched twice, by Place ID, email address or website. These tools do not make every email legal everywhere. In some places, for example Canada, Australia, Germany, or UK sole traders, you may need consent first or must meet extra conditions. Pro includes an outreach playbook with a plain-English overview of the main rules. You review and send every message, so you are responsible for what you send.

**Starter or Pro? Can I upgrade later?**
Choose Starter if you only sell web design. Choose Pro if you sell another service from the list, more than one service, or you want follow-ups drafted for you. If you upgrade later, you keep your Starter workflow, accounts and sheet. [YOUR UPGRADE POLICY, for example: "Email {{supportEmail}} with your Starter receipt and we will send you a code, so you pay only the difference."]

**What is your refund policy?**
[YOUR REFUND POLICY. Suggested: "If the workflow does not work on your n8n after you follow the setup guide, email {{supportEmail}} within 14 days of purchase. We will try to fix it with you, and if we can't, we will refund you in full."]

**Support and license**

Email {{supportEmail}} with your n8n version, whether you use n8n Cloud or self-hosted, and the exact error message. Never send your API keys.

You may use the workflows for your own business and to find and serve your own clients, including setting them up for a client. You may not resell, share or publish the files. One license is for one person; for a team, email {{supportEmail}}. The full license is in the download.

Client Finder Agent is an independent product. It is not made by, or affiliated with, Google, n8n or Anthropic.

---

### Additional details (Gumroad attribute fields)

Gumroad lets you add short name and value pairs under the description. Suggested pairs:

| Name | Value |
|---|---|
| Format | n8n workflow files (.json), PDF guides, Excel CRM template (.xlsx) |
| Works with | n8n 1.123 or newer, Cloud or self-hosted, including n8n 2.x |
| Tested on | n8n 1.123.83 and n8n 2.42.3 |
| Version | {{version}} |
| Setup time | About 30-45 minutes the first time |
| Data source | Google Places API (New), official |
| AI | Claude, with your own Anthropic API key |
| Sending | Gmail drafts only; you review and send |
| Running costs | Paid directly to Google and Anthropic; see description |
| Niches | Starter: Web Design. Pro: 5 niches and Follow-up Autopilot |
| Support | Email {{supportEmail}} |
| License | Your own business and your clients; no resale or sharing |
| Updates | [YOUR UPDATE POLICY, for example "Free updates for version 1.x"] |

### Refund policy (suggested; you decide)

Gumroad lets you choose a refund period and add your own "fine print". Suggested setting: **14 days**, with this fine print:

> If Client Finder Agent does not work on your n8n after you follow the setup guide, email {{supportEmail}} within 14 days of purchase with your n8n version and the error message. We will try to fix it with you. If we can't, we will refund you in full.
>
> Running costs from Google, Anthropic and n8n are paid to those services directly and are not part of a refund. The workflows do not promise any number of leads, replies or clients, so results alone are not a reason for a refund.

> **Note:** Gumroad's own policies, and consumer law in some countries, can give buyers rights beyond your policy. Check what applies to you before you publish.

### Tags

Gumroad may limit how many tags you can add. Add them in this order:

1. `n8n`
2. `lead generation`
3. `cold email`
4. `ai agent`
5. `google maps`
6. `web design clients`
7. `local seo`
8. `freelancer tools`
9. `agency tools`
10. `claude`

### Call-to-action button text

- Choose **"I want this!"** or **"Buy this"**.
- If your Gumroad editor lets you type your own text, use **"Get Client Finder Agent"**.
- If Gumroad only offers a fixed list of labels, pick the closest one.

### Cover, thumbnail and extra images

The images are in `marketing/`:

| File | Use | Size |
|---|---|---|
| `cover-paid.png` | Cover (first image) | 2560 x 1440 px (twice Gumroad's 1280 x 720 minimum) |
| `thumb-paid.png` | Thumbnail | 1200 x 1200 px (twice Gumroad's 600 x 600 minimum) |

The cover and thumbnail show the example sheet and an example Gmail draft. Both are clearly labelled "example data" or "example output". Keep those labels.

Suggested order for the extra cover items:

1. `cover-paid.png`
2. `[ADD LATER: a 60-90 second demo video: form, results page, sheet, one Gmail draft. Mark sped-up parts as "sped up". Use example data or blur real names, emails and phone numbers.]`
3. `docs/img/form.png` (the form)
4. `docs/img/sheet-example.png` (example rows in the Leads sheet)
5. `docs/img/draft-example.png` (an example pitch email)
6. `docs/img/results-page.png` (the results page after a run)

`docs/img` images are not 16:9. Check how they look in Gumroad's preview before you keep them.

### Receipt message (next steps)

Paste this into Gumroad's custom receipt message for the product. If you do not see that field, put the same text at the top of the product's content page. The same message works for both versions.

> Thank you for buying Client Finder Agent.
>
> Your next steps:
>
> 1. Download your zip file and unzip it.
> 2. Open **START-HERE.pdf**. It tells you what is in your download and plans your first hour.
> 3. Follow **SETUP-GUIDE.pdf** from start to finish. It takes about 30-45 minutes the first time. You will set up Google Cloud, your Anthropic API key, your Google Sheet and four credentials in n8n.
> 4. In the *⚙️ Settings* node, put your real name in **yourName** and your sheet's address in **googleSheetUrl**. The workflow will not run until both are filled in. If you email US businesses, add your postal address in **yourAddress**.
> 5. Run your first search with **20** businesses. Keep the browser tab open; a run takes a few minutes. Don't start another search until it has finished.
> 6. Read every Gmail draft before you send it. The checks are careful, but you are the final check. Start with a small number of emails a day from your own inbox.
>
> Keep the form's address private: anyone who has it can run searches on your Google and Anthropic accounts and add leads and drafts to your sheet and Gmail. To lock it, open *Find Clients Form* → **Authentication** → **Basic Auth**, or change the form path to something hard to guess.
>
> **Pro buyers:** set up one niche first. Then use PRO-GUIDE.pdf to add the other niches and the Follow-up Autopilot.
>
> **Upgrading from Starter to Pro?** Keep your Starter workflow, credentials and sheet. Skip the Pro copy of `client-finder-web-design.json`: it is the same workflow, and two copies would clash on the same form address.
>
> Need help? Email {{supportEmail}} with your n8n version, whether you use n8n Cloud or self-hosted, and the exact error message. Never send your API keys.
>
> Thank you for your trust,
> {{sellerName}}

---

## Final checklist before you publish

1. `config/product.json` has your real `storeUrl`, `supportEmail` and `sellerName`, and you rebuilt the zips afterwards.
2. You did at least one real run of Lite, Starter and each Pro workflow with your own Google, Anthropic and Gmail accounts, so you can answer buyer questions from experience. (The automated tests use simulated Google, Gmail and Claude services.)
3. The paid product's slug matches `storeUrl`.
4. Every `{{...}}` and `[...]` placeholder in what you pasted is replaced or deleted.
5. The Lite product has the Lite zip. Starter has the Starter zip. Pro has the Pro zip.
6. A test purchase of each product (and each version) downloads the right file.
7. The refund policy in Gumroad matches the FAQ answer.
8. Nothing on either page promises income, clients, replies or a number of leads, and there are no reviews or numbers you did not collect yourself.
9. Nothing suggests that Google, n8n, Anthropic or Meta endorse the product, and nothing calls the outreach "legal" or "compliant".
10. No "it does not scrape Google Maps" or "official API, so it's allowed" answers anywhere. Use the Places API wording from the honesty rules, and never say the checks are always right.
