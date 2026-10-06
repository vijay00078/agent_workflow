# Launch posts: Client Finder Lite and Client Finder Agent

For the seller only. Do not put this file in any download.

This file has ready-to-adapt posts for Reddit, X (Twitter), Instagram, LinkedIn and Meta ads. Each one gives value first and mentions the paid version softly, or not at all.

---

## Read this first

### Never invent results

Every number in these posts is a placeholder in square brackets, for example `[X] replies from [Y] emails`. Fill it in only with a number you measured yourself. If you have no number yet, delete the sentence. Do not round up, do not guess and do not borrow someone else's results.

- No income claims, no "I got [N] clients with this" unless it is true and you can show it.
- No fake comments, fake reviews or friends posting as happy customers.
- Example data comes from the made-up test businesses in `tests/fixtures/businesses.js` (for example "Sunrise Family Dental" in Austin, TX). Always label it "example data".
- If you show a real search on screen, blur real business names, emails and phone numbers. Those owners did not agree to be in your video.

### Facts every post must respect

- The workflows never send email. They create Gmail drafts that the user reads and sends.
- They use Google's official Places API. They do not scrape Google Maps.
- They find an email only when a business publishes one on its homepage.
- Up to 60 businesses per search. Lite gives a CSV; Starter and Pro check websites, score leads, write pitches with Claude and save to a Google Sheet.
- Prices: Lite free, Starter $49, Pro $99.

### Placeholders

| Placeholder | Replace with |
|---|---|
| `[LITE LINK]` | Your free product link, for example `https://YOUR-STORE.gumroad.com/l/client-finder-lite` |
| `{{storeUrl}}` | Your paid product link (`storeUrl` in `config/product.json`). Not filled in automatically in this file. |
| `[BUSINESS TYPE]`, `[CITY]` | The search you really ran, for example `dentists`, `Austin, TX` |
| `[N]`, `[M]`, `[X]`, `[Y]`, `[Z]` | Numbers you measured yourself |
| `[DEMO VIDEO]` | Your own screen recording |

---

## 1. Reddit

### Before you post

1. **Read each subreddit's rules.** Many ban self-promotion, limit links, require a flair (a label such as "Workflow" or "Free template") or allow promotion only on certain days.
2. Check if links that ask for an email address are allowed. Gumroad asks for one even for a $0 download. If the rules don't allow it, share the workflow JSON another way, for example a GitHub Gist, and link to that instead of `[LITE LINK]`.
3. Post from your own account, with your real history. Do not use extra accounts to upvote or comment.
4. Stay for the comments. Answer questions for the first few hours. This matters more than the post.
5. Mention the paid version at most once: one line at the end, or a comment when someone asks.

### r/n8n post (value first)

**Title options**

- `I built a free n8n workflow that pulls local businesses from Google Maps (official Places API) and puts the ones with no website first`
- `Free workflow + notes: Google Places API (New) pagination in the HTTP Request node, and a CSV that downloads straight from the form`

**Body**

> Hi all. I've been building lead-research workflows for [my own freelance work / web designers], and I cleaned up the simplest one to share for free.
>
> **What it does**
>
> - A form asks for a business type, a city and how many results (20, 40 or 60).
> - It calls Google's Places API (New) Text Search with your own API key. No scraping.
> - It removes closed businesses and duplicates.
> - It flags businesses with no website, including listings whose "website" is only a Facebook page, Instagram profile, Linktree or booking page.
> - It returns a CSV that downloads right in the browser, with the no-website businesses at the top.
>
> **The nodes**
>
> Find Leads Form → ⚙️ Settings → Prepare Search → Search OK? → Search Google Maps (HTTP Request) → Clean Leads → Found Any? → Build CSV Rows → Convert to CSV → Download CSV. If something goes wrong, a Show Message page explains it.
>
> **Things I learned building it (useful even if you don't use the workflow)**
>
> 1. Places API (New) needs an `X-Goog-FieldMask` header. Ask only for the fields you need: the fields also decide which price tier Google bills.
> 2. Text Search gives 20 results per page and at most 3 pages, so 60 is the limit for one search. In the HTTP Request node I use pagination mode "Update a Parameter in Each Request", with a body parameter `pageToken` set to `{{ $response.body.nextPageToken }}`, and stop when there is no `nextPageToken` or after 3 pages. I wait 1.5 s between pages.
> 3. Put the key in a Header Auth credential (name `X-Goog-Api-Key`) instead of the URL. Set the key's "Application restrictions" to None, because n8n calls Google from a server, and restrict the key by API instead. A website or IP restriction is a common reason the call fails.
> 4. Google needs a billing account on the Cloud project for Maps services, even inside the free monthly usage. Without it you get a billing error.
> 5. Many Google listings link to Facebook, Linktree or a booking site as their "website". I treat those as "no website of their own".
> 6. The Form Trigger responds when the workflow finishes, and the last node is a Form node (page type "Form Ending") that returns the CSV as a binary file. So the file downloads right after you submit the form.
> 7. I turn Google's error replies (API not enabled, key rejected, billing missing, key restriction, quota) into a plain message on the form page, so non-technical users know what to fix.
>
> **Setup (about 10 minutes, guide included)**
>
> Create a Google Cloud project, turn on billing and set a budget alert, enable **Places API (New)**, create and restrict an API key, add it in n8n as a Header Auth credential, import the JSON, then activate (n8n 1.x) or publish (n8n 2.x) and open the form's Production URL. It works on n8n 1.123 or newer, including 2.x.
>
> Cost: only Google Places API requests. One request returns up to 20 businesses, so a 60-business search is 3 requests. Google has a free monthly usage allowance; check their pricing page for current numbers.
>
> In my own test, a search for [BUSINESS TYPE] in [CITY] returned [N] businesses, and [M] had no website of their own. Your area will be different.
>
> **Download:** [LITE LINK]
>
> One sticky note in the workflow links to the paid version. Delete it if you like; the workflow works the same without it.
>
> If you try it, I'd like to hear what breaks or what you would add.
>
> (There's also a paid version that checks each website and drafts pitches in Gmail. I'll leave it out of this post; ask in the comments if you want the link.)

**Comment to post only if someone asks about the paid version**

> The paid one goes further: it opens each website, runs Google's PageSpeed test, scores every lead from 0 to 100 with the evidence, writes a short pitch with Claude from those facts and saves everything to a Google Sheet plus Gmail drafts (nothing is sent automatically). Starter is $49 (web design), Pro is $99 (5 niches and a follow-up workflow): {{storeUrl}}. The free one above works fine on its own.

### Shorter variant for r/automation or r/nocode

**Title**

`Free n8n workflow: type a business type and a city, get a CSV of local businesses with no website at the top`

**Body**

> I made a small free automation for finding local businesses that might need a website.
>
> You fill in a form (for example "dentists" and "Austin, TX"). It searches Google Maps through Google's official Places API, removes closed businesses and duplicates, and downloads a CSV with up to 60 businesses. The ones with no website, or only a Facebook or Instagram page, are at the top. Each row has the phone number, rating, reviews, address and Maps link.
>
> It runs in n8n (Cloud or self-hosted). You need a Google Cloud account with billing turned on and an API key; the guide walks you through it in about 10 minutes. The only running cost is Google's Places API, which has a free monthly allowance.
>
> In my test, [BUSINESS TYPE] in [CITY] gave [N] businesses, [M] with no website of their own.
>
> Free download: [LITE LINK]. Feedback welcome.
>
> (A paid version that checks websites and drafts pitches also exists; happy to share if anyone asks.)

---

## 2. X (Twitter) thread

Seven posts. Each one is under 280 characters (X counts every link as 23 characters). Replace placeholders with real numbers or delete the sentence. Attach `[DEMO VIDEO]` as media on post 6.

**1/**

> A lot of cold pitches to local businesses are generic. "I can help with your website" tells the owner nothing.
>
> So I built an n8n agent that finds local businesses, checks each one for a real problem, and drafts a pitch that names the proof.
>
> How it works:

**2/**

> 1. You type a business type and a city into a form, for example "dentists" + "Austin, TX".
>
> It pulls up to 60 businesses from Google's official Places API. No scraping. Closed businesses, duplicates and anyone already in your sheet are skipped.

**3/**

> 2. It opens each homepage and runs Google's PageSpeed test on mobile.
>
> It looks for: no website, site down, broken SSL, "coming soon" pages, slow on mobile, not mobile-friendly, old copyright year.
>
> If a site blocks bots, it skips the check. It never guesses.

**4/**

> 3. Every lead gets a score from 0 to 100, with evidence like:
>
> "Google PageSpeed scores the mobile site 23/100; the main content takes 9.8 s to appear on a phone."
>
> (That's example data from my test set, not a real business.)

**5/**

> 4. Claude writes a short pitch for each lead above your minimum score. It only gets the verified facts, and it's told never to invent numbers.
>
> You also get a DM version and a one-line phone opener.

**6/**

> 5. Everything lands in a Google Sheet. Leads with a public email get a Gmail draft.
>
> Nothing is sent automatically. You read every draft, change what you like, and hit send yourself.
>
> My test: [BUSINESS TYPE] in [CITY], [N] businesses, [M] worth pitching. Full run in the video.

**7/**

> There's a free version that does step 1 and gives you a CSV with no-website businesses first: [LITE LINK]
>
> The full agent (5 niches + follow-up drafts) is here if it's useful: {{storeUrl}}
>
> Happy to answer questions about how any part is built.

**Demo video tips**

- 30-60 seconds: the form, the results page, the sheet, one Gmail draft.
- A real run takes a few minutes. Speed up the waiting part and write "sped up" on screen.
- Use example data, or blur real business names, emails and phone numbers.

> **Check before posting:** post 6 is the longest once you fill it in. If it goes over 280 characters, move the "My test" line into its own post. If you have no measured numbers yet, delete the "My test" sentence and keep the last sentence about the video.

---

## 3. Instagram Reel

### Format

- Vertical 9:16 (1080 x 1920), 25-30 seconds.
- Big on-screen text for every step: many people watch without sound.
- Screen recordings from your own run, or the example data from the test set, labelled "example data".
- Blur real business names, emails and phone numbers.
- The sheet is written in one go when the run finishes, so the rows appear all at once. That is normal. Don't fake a slow fill; scroll down the new rows instead.

### Hook options (0-2 s, text on screen)

Pick one:

1. `Type a city. Get local businesses with a website problem.`
2. `This n8n agent finds the problem before you pitch.`
3. `Stop sending "I can help with your website".`

### Script

| Time | On-screen text | What you show | Voiceover (optional) |
|---|---|---|---|
| 0-2 s | Your hook | Close-up of the form: `dentists`, `Austin, TX` | (none, let the text work) |
| 2-7 s | 1. Business type + city | Type into the form, choose **20**, click **Find clients** | "I type a business type and a city." |
| 7-11 s | 2. It checks every website (sped up) | Waiting page, then the results page: "Done: [N] new leads found" | "It finds businesses on Google Maps, opens each website and runs Google's speed test." |
| 11-19 s | 3. A score and the proof | The Google Sheet: scroll the new rows, then zoom in on Score, Priority, Problems and Evidence, for example "PageSpeed 23/100" | "Every lead gets a score and the proof, like a mobile speed score of 23 out of 100." |
| 19-26 s | 4. A pitch draft for each. You review. You send. | Gmail **Drafts**: open one, highlight the first line that names the problem, edit one word | "Claude writes a short pitch from those facts. It's only a draft. I read it and send it myself." |
| 26-30 s | Comment CLIENT for the free version | End card with the cover image. Small text: "Free version = Google Maps list, no-website businesses first. Full agent: link in bio." | "Comment CLIENT and I'll send you the free version." |

> **Be clear about what is free.** The video shows the paid agent (checks, scores, drafts). The free version only builds the Google Maps list. Say this on the end card and in the caption, so nobody feels tricked.

### Caption

> I built an n8n workflow that finds local businesses, checks each website for a real problem (slow on mobile, no HTTPS, outdated, or no website at all), and drafts a short pitch in Gmail with the proof. Nothing is sent automatically: you review every draft.
>
> Comment CLIENT and I'll DM you the free version. It builds a list of local businesses from Google Maps, with the no-website ones first.
>
> The full agent is in my bio. Data in this video: [example data from my test set / my own search for [BUSINESS TYPE] in [CITY], names blurred].
>
> #n8n #automation #freelancer #webdesign #leadgeneration

### "Comment CLIENT" DM flow (ManyChat-style)

**Trigger:** a comment on this Reel that contains the keyword `CLIENT` (any capital or small letters).

**Public reply to the comment.** Rotate these, so the replies don't look like spam:

- `Sent, check your DMs.`
- `Just sent it to you.`
- `It's in your messages now.`

**DM 1 (sent right away, with a button)**

> Hi [first name], thanks for commenting! Here's the free Client Finder Lite workflow for n8n. Tap the button and Gumroad will send you the file. You can pay $0.
>
> Button: **Get the free workflow** → [LITE LINK]

**DM 2 (sent right after DM 1)**

> Quick tips: setup takes about 10 minutes with the guide inside. You'll need a Google Cloud account with billing turned on; Google's free monthly usage applies, and the guide shows you how to set a budget alert. Reply here if you get stuck.

**DM 3 (only if they reply and ask about the full version)**

> The full Client Finder Agent checks each website, scores every lead with the proof, writes a pitch for each with Claude and saves them as Gmail drafts for you to review. Starter is $49 (web design), Pro is $99 (5 niches and follow-up drafts): {{storeUrl}}

**Rules for the flow**

- Instagram only allows automated messages within 24 hours of the person's comment or last message. Do not send promotional follow-ups after that.
- Never add people to a list or send them offers they did not ask for.
- If someone replies "stop" or "no thanks", stop the flow for them.
- Test the flow from a second account before the Reel goes live.

---

## 4. LinkedIn post

> A pitch like "I can help with your website" could be sent to any business. Owners can tell.
>
> So before I contact a local business, I want one specific, checkable reason. I built an n8n workflow to do that research for me:
>
> 1. It searches Google Maps (Google's official Places API) for a business type in a city.
> 2. It opens every website and runs Google's mobile speed test.
> 3. It scores each business from 0 to 100 and writes down the proof: "PageSpeed mobile score 23/100", "footer still says © 2019", "no website at all".
> 4. Claude drafts a short pitch from those facts only. It lands in Gmail as a draft. Nothing is sent until I read it.
>
> What I've seen so far: [ONLY REAL OBSERVATIONS, for example "[X] replies from [Y] emails over [Z] weeks". Delete this line until you have real numbers.]
>
> Two things I'd tell anyone doing local outreach:
>
> - Lead with the evidence, not with your service.
> - Send a small number of good emails each day from your own inbox, and respect every "no thanks".
>
> I made a free version that builds the Google Maps list, with no-website businesses first. The link is in the first comment.
>
> #n8n #automation #freelancing

**First comment**

> Free version (n8n workflow + setup guide): [LITE LINK]
> The full agent with website checks and Gmail drafts: {{storeUrl}}

> **Note:** The examples in the post ("23/100", "© 2019") come from the made-up test business Sunrise Family Dental. If you prefer, replace them with evidence from your own run, without naming the business.

---

## 5. Ad copy for Instagram and Facebook ads

Three variants. Each follows Meta's advertising rules:

- No income or earnings claims, and no before/after money claims.
- No language that says or suggests you know the viewer's personal attributes (for example their finances, health or situation). Talk about the product, not about the person.
- Time saved and clients found are described in words, never with promised numbers.
- The landing page must match the ad: same product, same price, same "free" or "paid".
- If an ad says "free", mention that Google API costs may apply.
- Screenshots in the creative use example data, labelled as such.

**Never write lines like these:** "Make $5k a month", "Land 10 clients this week", "Guaranteed replies", "Are you a struggling freelancer?", "Tired of being broke?", "Other web designers like you".

### Variant A: the free Lite workflow (lead magnet)

- **Primary text:** Free n8n workflow: type a business type and a city, and get a list of local businesses from Google Maps, with the ones that have no website at the top. It uses Google's official Places API, and a step-by-step setup guide is included. Google API costs may apply after the free monthly allowance.
- **Headline:** Free Google Maps lead list for n8n
- **Description:** CSV download. No coding.
- **Button:** Download
- **Creative:** `marketing/cover-lite.png`, or a 10-second screen recording of the form and the CSV.
- **Landing page:** [LITE LINK]

### Variant B: the paid agent, "proof" angle

- **Primary text:** Spend less time researching leads. Client Finder Agent searches Google Maps, checks each local business's website and shows the proof: slow on mobile, no HTTPS, outdated, or no website at all. Then it drafts a short pitch for each one in Gmail. Every message waits for your review before it is sent.
- **Headline:** Local leads with proof, ready to review
- **Description:** n8n workflow. Starter $49, Pro $99.
- **Button:** Learn more
- **Creative:** `marketing/cover-paid.png` (shows example data and an example draft, both labelled).
- **Landing page:** {{storeUrl}}

### Variant C: the paid agent, "five services" angle

- **Primary text:** Research local businesses without the copy-paste. Fill in one form, then get a Google Sheet of scored leads and a Gmail draft for each one with a public email. Checks for web design, local SEO, Google reviews, social media and AI chatbot services. Nothing is sent automatically.
- **Headline:** Find local businesses to pitch
- **Description:** Built for n8n. Drafts only.
- **Button:** Learn more
- **Creative:** A 15-second cut of the Reel above, with "example data" or blurred names on screen.
- **Landing page:** {{storeUrl}}

> **Note:** Meta reviews every ad, and its rules change. Read Meta's current Advertising Standards before you run ads, and keep this file's wording as a starting point, not a promise of approval.
