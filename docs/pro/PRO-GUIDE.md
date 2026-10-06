---
title: Pro guide
subtitle: Run all five niches, switch on the Follow-up Autopilot and build your own niche pack.
kicker: Pro guide
tier: Pro
---

## What Pro adds

Read this guide after you set up your first workflow with SETUP-GUIDE.pdf. Pro adds three things:

1. **Four more niche workflows.** A *niche* is the type of service you sell, such as local SEO or AI chatbots. Each niche workflow looks for different problems and gives Claude a different angle for the pitch.
2. **The Follow-up Autopilot.** A workflow that runs every morning. It checks Gmail for the pitches you sent and the replies you got, and drafts short follow-ups in the same email thread.
3. **Your own niche packs.** A *niche pack* is a small block of settings inside each workflow. It decides what the workflow checks and how many points each problem is worth.

You also get OUTREACH-PLAYBOOK.pdf and TEMPLATES.pdf. The basics stay the same: {{productName}} uses Google's official Places API, not scraping. It finds an email only when a business publishes one on its homepage. It never sends anything: pitches and follow-ups become Gmail drafts that you read and send yourself.

> **Important:** Upgrading from Starter? Keep your web-design workflow, credentials and sheet. Skip the Pro copy of `client-finder-web-design.json`. It is the same workflow, and two copies would clash on one form address.

## The five niche workflows

| Workflow file | Who it is for | What it checks (points) | Example search | Default offer |
|---|---|---|---|---|
| `client-finder-web-design.json` | Web designers and web agencies | No website 45, Website down 45, Security certificate error 40, Placeholder website 40, Slow on mobile 30, Not mobile-friendly 30, Not secure (no HTTPS) 25, Outdated website 20, Weak SEO basics 10 | dentists, Austin, TX | a free 2-minute video showing exactly what I would fix |
| `client-finder-seo.json` | Local SEO freelancers and agencies | Weak SEO basics 35, Slow on mobile 25, No schema markup 20, Few Google reviews 20, Not mobile-friendly 20, Not secure (no HTTPS) 15, No website 15, Outdated website 10 | plumbers, Denver, CO | a free mini SEO audit with the 3 fixes that would help them most |
| `client-finder-reviews.json` | Review and reputation services | Low Google rating 45, Few Google reviews 45, No website 10 | hair salons, Manchester, UK | a free one-page plan to get more reviews from customers they already have |
| `client-finder-social-media.json` | Social media managers and ads agencies | No social media links 40, No analytics or ad pixel 30, No website 15, Few Google reviews 15, Outdated website 10 | gyms, Pune, India | 3 ready-to-post content ideas for their Instagram, free |
| `client-finder-ai-chatbot.json` | AI automation agencies (chatbots, AI receptionists, booking) | No online booking 35, No chat or WhatsApp 30, Limited opening hours 25, No website 10 | physiotherapy clinics, Bangalore, India | a free 5-minute demo of an AI assistant trained on their own website |

In every niche, the points of all problems found are added up, to a maximum of 100. **Hot** is 60 or more, **Warm** 30-59, **Low** 1-29.

### What each workflow opens, and how fast it is

| Workflow (Niche column) | Default service | Opens the homepage | PageSpeed test |
|---|---|---|---|
| Web Design | website design and redesign | Yes | Yes |
| Local SEO | local SEO (getting found on Google Search and Google Maps) | Yes | Yes |
| Social Media & Ads | social media management and Instagram/Facebook ads | Yes | No |
| AI Chatbots & Booking | AI assistants that answer enquiries and book appointments 24/7 | Yes | No |
| Google Reviews & Reputation | getting more 5-star Google reviews from happy customers | Yes (only to find an email) | No |

Every niche opens each homepage, because that is where contact emails come from. A PageSpeed test can take up to a minute per site, so Web Design and Local SEO are the slowest. Reviews, Social Media & Ads and AI Chatbots & Booking skip PageSpeed and finish faster. The Reviews checks themselves use only Google Maps data.

> **Example:** One made-up test business, Sunrise Family Dental in Austin, TX, scores 50 in Web Design, 55 in Local SEO, 40 in Social Media & Ads and 65 in AI Chatbots & Booking. In Reviews it scores 0: 4.6 stars from 212 reviews is a strong profile.

## Setting up the other niches

You reuse the four credentials from your first workflow.

### 1. Import the file

1. In n8n, go to **Workflows** and click **Create Workflow** (or **Create** > **Workflow**, or **+**).
2. Open the workflow menu, the **...** button (next to the workflow name in n8n 2.x, at the top right in n8n 1.x), and choose **Import from File...**.
3. Choose a file from the `workflows` folder, for example `client-finder-seo.json`.
4. Click **Save**.

Import each file only once. It appears as, for example, "Client Finder: Local SEO".

### 2. Select the same four credentials

Open each node and choose the credential you created before.

| Credential | Nodes |
|---|---|
| Google API Key | *Search Google Maps*, plus *PageSpeed Test* in Web Design and Local SEO |
| Anthropic API Key | *Write Pitch with Claude*, *Retry Pitch with Claude* |
| Google Sheets account | *Read Saved Leads*, *Save to Google Sheet* |
| Gmail account | *Create Gmail Draft* |

> **Tip:** Check every node, even if n8n filled in a credential by itself.

### 3. Fill in its ⚙️ Settings

Each workflow has its own *⚙️ Settings*. A change in one does not change the others.

1. Copy your values from your first workflow: **yourName**, your signature fields, **searchCountryCode**, **emailLanguage** and so on.
2. Paste the **googleSheetUrl** (see "One sheet or several?" below).
3. **yourService** and **yourOffer** hold the niche defaults. Put them in your own words, and offer only what you can deliver.
4. Close the node and click **Save**.

### 4. Test, then activate or publish

1. Click **Execute workflow** and run a test search with **20** businesses.
2. Check the new rows and the **Niche** column in your sheet.
3. Switch it on: **Active** in n8n 1.x, **Publish** in n8n 2.x.

### 5. Bookmark its form

Open *Find Clients Form*, switch to **Production URL** and bookmark it.

| Workflow | Form address ends in |
|---|---|
| Web Design | `/form/client-finder-web-design` |
| Local SEO | `/form/client-finder-seo` |
| Google Reviews & Reputation | `/form/client-finder-reviews` |
| Social Media & Ads | `/form/client-finder-social-media` |
| AI Chatbots & Booking | `/form/client-finder-ai-chatbot` |

![The public Client Finder form](img/form.png)
*A Client Finder form. Every niche has its own form and address.*

### One sheet or several?

Every workflow skips businesses that are already in its sheet, matched by Google's **Place ID**. A business is never added twice. So:

| | One shared sheet | One sheet per niche |
|---|---|---|
| A business found by two niches | Saved once, by the niche that finds it first. The others skip it. | Saved in both sheets. It can get two different pitches from you. |
| Follow-up Autopilot | One copy covers every niche | It reads one sheet, so you need one copy per sheet |
| Overview | All leads and one **Pipeline** tab | Spread over several sheets |

**Our recommendation: use one shared sheet.** Two different cold emails from you to the same business look careless. Filter by the **Niche** column when you want one niche.

Separate sheets? Import the Autopilot once per sheet, each copy with its own **googleSheetUrl**. It has no form, so copies do not clash.

## Follow-up Autopilot

### What it does

The Autopilot runs every morning at 9:00 in your n8n instance's time zone, and whenever you start it by hand. It looks at every lead in your **Leads** sheet that has an email address. It never changes the final statuses **Replied**, **Meeting booked**, **Won**, **Lost** and **Do not contact**.

For each lead it searches your Gmail for the last 120 days: emails you **sent** to that address, and emails **from** that address. Then:

- **They replied after your first email:** Status becomes **Replied**. No more follow-ups, ever.
- **Your pitch is still a draft:** nothing happens until you send it.
- **You sent it, but it is too early:** Status becomes **Contacted**, and **Last Contacted** gets the date.
- **You sent it, no reply, 3 or more days since your last email:** it drafts follow-up #1 in the same Gmail thread, with "Re: " before your pitch's subject.
- **7 or more days after you sent follow-up #1:** it drafts follow-up #2, a short and polite last note. Then it stops (**maxFollowUps** is 2).
- **A follow-up draft is waiting and you have not sent it:** nothing. It never creates a second draft while one is waiting.

Each follow-up uses the angle of the niche that found the lead (the **Niche** column) and builds on your original email. Claude is asked for 2-4 sentences in #1 and 2-3 in #2. Your signature is added, but no "P.S." opt-out line: your first email in the thread has one.

It writes only the columns that change.

![The Follow-up Autopilot workflow in the n8n editor](img/followup-canvas.png)
*The Follow-up Autopilot. Top: triggers, settings and your sheet. Bottom: Gmail search, follow-up drafts and the sheet update.*

### A worked timeline

This example uses the defaults (`3,7` and `2`) and made-up test data.

| When | What happens | Status after |
|---|---|---|
| Day 0, Monday | Client Finder creates a pitch draft for Sunrise Family Dental | Draft ready |
| Day 1, Tuesday, 8:30 | You read the draft and send it | Draft ready |
| Day 1, Tuesday, 9:00 | The Autopilot finds it in Gmail Sent | Contacted |
| Days 2-3 | Too early. Nothing changes. | Contacted |
| Day 4, Friday, 9:00 | 3 full days have passed. Follow-up #1 is drafted in the same thread. | Follow-up drafted (Follow-ups: 1) |
| Day 4, Friday, 11:00 | You read follow-up #1 and send it | Follow-up drafted |
| Day 5, Saturday, 9:00 | The Autopilot sees it in Sent | Contacted |
| Day 11, Friday, 9:00 | Only 6 days and 22 hours since 11:00 last Friday. Nothing yet. | Contacted |
| Day 12, Saturday, 9:00 | 7 full days. Follow-up #2 is drafted. | Follow-up drafted (Follow-ups: 2) |
| After you send #2 | Next morning: Contacted. No more follow-ups. | Contacted |
| A reply, at any point | The next run marks it | Replied |

The wait counts full 24-hour days from the moment you sent your last email, and the draft appears at the next 9:00 run. Send at 3 pm on day 1, and follow-up #1 appears at 9:00 on day 5. The Autopilot uses the later date of your email in Gmail Sent and **Last Contacted** in your sheet.

> **Tip:** It runs at weekends too. You can send Saturday's drafts on Monday; the next wait starts when you send.

After the last follow-up, the lead stays **Contacted** until you set it to **Lost**.

### Set it up

1. **Import** `follow-up-autopilot.json` the same way as the niche workflows. It appears as "Client Finder: Follow-up Autopilot".
2. **Select three credentials.** No Google API key is needed.

| Credential | Nodes |
|---|---|
| Google Sheets account | *Read Leads*, *Update Leads* |
| Gmail account | *Search Gmail*, *Create Follow-up Draft* |
| Anthropic API Key | *Write Follow-up with Claude* |

3. **Fill in *⚙️ Settings*** (table below), close the node and click **Save**.
4. **Test it.** Click **Execute workflow** (**Test workflow** in some versions). If the button says "from Every Morning" or "from Run Now", either is fine. A test is a real run: it updates your sheet and can create drafts.
5. **Read the result** in the *Report* node. If there was nothing to do, the run ends at *Nothing To Do* instead.
6. **Switch it on:** **Active** in n8n 1.x, or **Publish** in n8n 2.x (again after every change). The 9:00 schedule runs only then.

> **Important:** Use the Gmail account you send your pitches from. The Autopilot reads that inbox's Sent folder and replies. It cannot see emails sent from another inbox.

| Field | Default | What it does |
|---|---|---|
| **googleSheetUrl** | `PASTE_YOUR_GOOGLE_SHEET_URL_HERE` | **Required.** The same sheet your Client Finder workflows use. |
| **followUpDays** | `3,7` | Days to wait before each follow-up, after your last sent email. Whole numbers (1-119), separated by commas. |
| **maxFollowUps** | `2` | Most follow-ups per lead (0-5). The last **followUpDays** number repeats if needed. `0` = only mark **Replied** and **Contacted**. |
| **yourName** | `Your Name` | **Required.** Signs every follow-up. |
| **yourBusinessName**, **yourWebsite**, **yourPhone**, **yourAddress** | `Your Business`, then empty | Signature. Use the same values as in Client Finder. |
| **yourService**, **yourOffer** | empty | Empty = each lead's niche default. Filled in = used for every lead. |
| **emailLanguage** | `English` | Language of the follow-ups |
| **emailTone** | `friendly, direct and human` | A short tone instruction |
| **aiModel** | `claude-opus-5-5` | Cheaper: `claude-sonnet-5-5` or `claude-haiku-4-5` |
| **aiEffort** | `low` | `low`, `medium` or `high` |

> **Tip:** Changed **yourOffer** in a Client Finder workflow? Follow-ups still use the niche default offer, unless you fill in **yourOffer** here.

To change the time, open *Every Morning* and change **Trigger at Hour**. For another time zone, open the workflow menu (**...**), choose **Settings** and change **Timezone**.

> **Cost:** Each follow-up is one Claude request, similar in cost to a pitch. Gmail searches are free.

### Statuses it sets

| Status | When | Also updates |
|---|---|---|
| **Contacted** | You sent an email and the next follow-up is not due yet | Last Contacted |
| **Follow-up drafted** | A follow-up draft is waiting in Gmail Drafts | Follow-ups, Last Draft On, Thread ID |
| **Replied** | They answered after your first email | Last Contacted |

### How to stop following someone up

Pick a final status from the **Status** dropdown: **Do not contact** (they said no), **Lost** (you are done), **Won** or **Meeting booked**. The Autopilot never touches that row again. It never deletes drafts either: if a follow-up draft is already waiting in Gmail, delete it yourself.

> **Warning:** A reply counts only when it comes from the address in the **Email** column. If the owner answers from another address, set **Replied** yourself. Look at the Gmail thread before you send any follow-up.

> **Tip:** Deleted a waiting follow-up draft by mistake? The Autopilot still thinks it is waiting. To get a new one, clear the lead's **Last Draft On** cell and lower **Follow-ups** by 1.

### When something fails

- **Claude fails** (no credits, wrong key, or busy): a short template follow-up is drafted instead, with no retry, for example "Quick follow-up on my note about slow on mobile. Happy to send [your offer] if it would help." The sheet does not say which one you got, so read every draft.
- **Gmail cannot create the draft:** **Notes** shows "Follow-up draft failed: ..." (replacing the old note). **Status** and **Follow-ups** stay the same, so tomorrow's run tries again. Fix the Gmail credential, then delete the note.
- **A setup problem** (no sheet address, "Your Name" unchanged, or the sheet cannot be read): the run stops at *Stop With Error* and shows in red in **Executions**, for example "Settings needed: ...".
- **Nothing to do:** the run ends quietly at *Nothing To Do*. That is normal.

### What the Report node shows

Open **Executions**, click a run, then click *Report*. It shows four numbers (**followUpsDrafted**, **markedReplied**, **markedContacted**, **draftsFailed**) and one line:

> **Example:** `3 follow-up drafts created, 1 leads marked Replied, 1 marked Contacted, 1 drafts failed (see Notes column).` This comes from our test data.

## Make your own niche pack

Each Client Finder workflow has a block called `NICHE_PACK` in its *Prepare Search* node. It sets the checks, their points and Claude's angle. Change it in a copy, and you have a new niche.

### 1. Pick the right workflow to copy

A check works only if the workflow collects its facts (**Uses**, below):

- **Google Maps and homepage checks:** copy any workflow. Those without PageSpeed are faster.
- **PageSpeed checks** (Slow on mobile, Not secure): copy Web Design or Local SEO.

Changing `needsWebsiteCheck` or `needsPageSpeed` does not add or remove nodes. Leave them, `tagline` and `exampleSearch` as they are.

### 2. Duplicate it and change the form path

1. Open the workflow, open the workflow menu (**...**), choose **Duplicate** and name the copy.
2. In the copy, open *Find Clients Form*. Under **Options**, change **Form Path**, for example to `client-finder-wedding-photographers`. You can also change **Form Title** and **Form Description**.
3. Click **Save**.

### 3. Edit NICHE_PACK

1. Double-click *Prepare Search*. It holds a lot of code; you change only the end.
2. Scroll to the bottom. Find the block that starts with `const NICHE_PACK = {`. It ends just above the last line, which starts with `return`.
3. Change these values, close the node and click **Save**.

| Field | What it does |
|---|---|
| `title` | The name in the **Niche** column (the Autopilot reads it too) |
| `id` | A short name without spaces |
| `weights` | The checks that run and their points. Delete a line or set it to 0 to switch a check off. |
| `thresholds` | Your own limits, for example `{ "lowRating": 4.3 }`. `{}` = the defaults. |
| `pitchAngle` | Plain-English guidance for Claude: who you are and why the problem matters |
| `defaultService`, `defaultOffer` | Used only when **yourService** or **yourOffer** in *⚙️ Settings* is empty. The Autopilot uses them too once you add your pack to it (see "Teach the Autopilot your niche") |
| `fallback` | The template pitch's subject and "why it matters" sentence, used when Claude fails |

### 4. Update ⚙️ Settings, test and publish

*⚙️ Settings* wins over `defaultService` and `defaultOffer`, so change **yourService** and **yourOffer** in the copy's *⚙️ Settings* too. Run a test with **20** businesses, check the **Problems** and **Evidence** columns, then activate or publish.

### All available checks

**Uses**: **Maps** = the Google Maps listing. **Home** = the homepage. **PSI** = the PageSpeed test; **(+ PSI)** = also uses it when the workflow has it. **Search** = the other businesses in the same search.

| Check id | Label | Counts when | Uses |
|---|---|---|---|
| `no_website` | No website | Google lists no website, or only a social, directory or booking page (such as a Facebook page) | Maps |
| `site_down` | Website down | The site did not load (expired domain, error page, 404, no answer in 20 seconds) | Home |
| `ssl_error` | Security certificate error | The certificate is broken or expired | Home |
| `placeholder_site` | Placeholder website | Only a "coming soon", parked or default page | Home |
| `slow_mobile` | Slow on mobile | Mobile speed score below **slowMobileScore** | PSI |
| `no_https` | Not secure (no HTTPS) | The site does not use HTTPS | PSI |
| `not_mobile_friendly` | Not mobile-friendly | No mobile viewport (the code that fits a page to a phone) | Home (+ PSI) |
| `outdated_site` | Outdated website | Footer year **outdatedYears** or more years old | Home |
| `weak_seo` | Weak SEO basics | No page title, meta description or main heading, or SEO score below **weakSeoScore** | Home (+ PSI) |
| `no_schema` | No schema markup | No structured data (schema.org) to help Google show hours, reviews and services | Home |
| `low_rating` | Low Google rating | Rating below **lowRating**, with at least **minReviewsForRating** reviews | Maps |
| `few_reviews` | Few Google reviews | Fewer than **fewReviewsMax** reviews and far below the local median | Maps, Search |
| `no_booking` | No online booking | No booking tool or "book online" button | Home |
| `no_chat` | No chat or WhatsApp | No live chat, chatbot or WhatsApp button | Home |
| `limited_hours` | Limited opening hours | Closes before 6 pm on **earlyCloseWeekdays** or more weekdays, or closed all weekend | Maps |
| `no_social` | No social media links | No link to Instagram, Facebook or TikTok | Home |
| `no_tracking` | No analytics or ad pixel | No visitor analytics (such as Google Analytics) and no Meta Pixel | Home |

Homepage checks run only when the homepage loaded and is a real site. A blocked site is skipped, never guessed.

### Thresholds

| Threshold | Default | Meaning |
|---|---|---|
| **slowMobileScore** | 50 | Mobile speed score (0-100) below this = Slow on mobile |
| **weakSeoScore** | 80 | SEO score below this = Weak SEO basics |
| **lowRating** | 4 | Stars below this = Low Google rating... |
| **minReviewsForRating** | 5 | ...but only with at least this many reviews |
| **fewReviewsMax** | 25 | Few Google reviews needs fewer reviews than this... |
| **fewReviewsRatio** | 0.35 | ...and fewer than 35% of the median of the same search |
| **minMarketForComparison** | 5 | Few Google reviews needs at least this many businesses in the search |
| **outdatedYears** | 3 | Footer year this many years old or more = Outdated website |
| **earlyCloseWeekdays** | 3 | Closing before 6 pm on at least this many weekdays = Limited opening hours |

### Worked example: wedding photographers

You build portfolio sites and Instagram setups for wedding photographers. You want photographers with no real website, or no social links. These checks need the homepage, not PageSpeed, so copy **Social Media & Ads** and change these lines:

```
  "id": "wedding-photographers",
  "title": "Wedding Photographers",
  "defaultService": "portfolio websites and Instagram setup for wedding photographers",
  "defaultOffer": "a free sketch of a one-page portfolio site for them",
  "weights": {
    "no_website": 50,
    "placeholder_site": 45,
    "no_social": 40,
    "outdated_site": 20
  },
  "thresholds": { "outdatedYears": 2 },
  "pitchAngle": "The sender builds portfolio websites and Instagram setups for wedding photographers. Couples look at a portfolio before they ask for a quote, so explain that without one they cannot see the work. Keep it warm and short. Never promise bookings.",
```

No website scores 50 (Warm). No social links plus a two-year-old footer scores 60 (Hot). Put the same service and offer into *⚙️ Settings*, adapt `fallback`, and search for `wedding photographers` in your city.

### Teach the Autopilot your niche (optional)

The Autopilot does not know a new **Niche** title, so it uses the Web Design angle and offer. To fix that:

1. In your copy's *Prepare Search*, copy your pack: from the `{` after `const NICHE_PACK =` to the matching `}` before the final `;`.
2. In the Autopilot, open *Prepare Follow-ups* and scroll to the bottom. Find the list that starts with `const NICHE_PACKS = [` and ends with `];`.
3. Click just after the last `}` before `];`. Type a comma, then paste your pack.
4. Save, then publish again.

### Keep it working

> **Warning:** Always duplicate first and edit only the copy. If the copy breaks, the original still works.

> **Warning:** Change the **Form Path** in the copy. Two active workflows cannot share one form address.

> **Important:** Keep valid JavaScript (the node's code language): every quote mark, comma and brace. Put text in "double quotes"; inside text, use apostrophes, never double quotes. Type check ids exactly: a misspelled id is skipped with no error. If *Prepare Search* turns red with "SyntaxError", undo with **Ctrl+Z** (**Cmd+Z** on a Mac) or duplicate the original again.

## Tips for running all five

1. **One niche per week.** Learn what works before you start the next.
2. **Same city, different business types.** For example: dentists for Web Design, plumbers for Local SEO, hair salons for Reviews, gyms for Social Media & Ads, physiotherapy clinics for AI Chatbots & Booking.
3. **Best fit first.** With a shared sheet, the first niche keeps a business, so run the best-fitting niche first.
4. **Keep your total sending low.** The 10-20 emails a day from START-HERE.pdf are for all niches together, follow-ups included.
5. **Control costs.** Set **minScoreToPitch** to `30` to pitch only Warm and Hot leads. Keep your Google budget alert on.
6. **Check Executions weekly** for red runs, and read the Autopilot's *Report*.
7. **Read every draft.** You are the sender, in every niche.

Stuck? Email {{supportEmail}} with your n8n version, the workflow, the node and the exact message. Never send your API keys.
