---
title: Client Finder Lite
subtitle: Set up the free workflow and get your first list of local businesses in about 10 minutes.
kicker: Quick-start guide
tier: Free
---

## What Client Finder Lite does

Client Finder Lite is the free version of {{productName}}. You type a business type and a city into a simple web form. The workflow searches Google Maps and gives you a CSV file (a simple spreadsheet file) of up to 60 local businesses.

Businesses with **no website** come first, so Lite is a good fit for web designers: the businesses at the top may need their first website. Each row has the phone, website (if any), rating, reviews, address and a Maps link. Closed businesses and duplicates are removed.

Lite uses the Places API, Google's official service for Google Maps data. It does not scrape Google Maps, and it never contacts anyone for you.

## What you need

| You need | Notes |
|---|---|
| An n8n account | n8n is a tool that runs automations, called workflows. Use an n8n Cloud free trial, or self-hosted n8n version 1.123 or newer. |
| A Google account | Any Gmail or Google Workspace account works. |
| A payment card | Google asks for one before it turns on Maps services. Step 1 explains why. |
| About 10 minutes | Most of it is spent in Google Cloud. |

## Step 1: Get a Google API key

An API key is like a password that lets a program (here, n8n) use a Google service.

### 1.1 Create a project

1. Go to `console.cloud.google.com` and sign in.
2. Click the project picker at the top, then **New Project**.
3. Name it `Client Finder` and click **Create**. Make sure it is selected at the top.

### 1.2 Attach billing and set a budget alert

Google requires a billing account for Maps services, even inside the free monthly usage. Without one, searches fail.

1. Open the menu (three lines, top left) and click **Billing**.
2. Click **Link a billing account** (or **Create billing account**) and add your card.
3. Open **Budgets & alerts** and click **Create budget**.
4. Choose a small amount, for example 5 in your currency. Keep the default alerts and click **Finish**.

> **Important:** A budget alert only sends you an email. It does not stop spending.

### 1.3 Enable Places API (New)

1. Open the menu and go to **APIs & Services** > **Library**.
2. Search for `Places API (New)`, open it and click **Enable**.

> **Warning:** Google also lists an older "Places API" without "(New)". Lite needs **Places API (New)**.

### 1.4 Create and restrict the API key

1. Go to **APIs & Services** > **Credentials**.
2. Click **Create credentials** > **API key**. Copy the key.
3. Click the key's name to open its settings.
4. Under **Application restrictions**, choose **None**. n8n runs on a server, so website or app restrictions would block it.
5. Under **API restrictions**, choose **Restrict key**, tick **Places API (New)** and click **OK**.
6. Click **Save**. Changes can take a few minutes to work.

If Google shows these options while you create the key, choose the same settings there.

> **Warning:** Treat the key like a password. If it leaks, delete it on the **Credentials** page and create a new one.

## Step 2: Import the workflow into n8n

1. In n8n, go to your **Workflows** list.
2. Click **Create Workflow** (in some versions **Create** > **Workflow**, or **+**). An empty canvas opens: the area where the workflow's boxes, called nodes, sit.
3. Click the **...** menu at the top right and choose **Import from File...**.
4. Select `client-finder-lite.json` from your download. If you see a **Save** button, click it.

Another way: open the JSON file in a text editor, copy everything, click the empty canvas and paste (Ctrl+V or Cmd+V).

![The Lite workflow in the n8n editor](img/lite-canvas.png)
*The Lite workflow after import. The "Start Here" note repeats the setup steps.*

## Step 3: Connect your Google API key

A credential is a key or login that n8n stores safely for your workflows.

1. Double-click the *Search Google Maps* node.
2. Leave **Authentication** (**Generic Credential Type**) and **Generic Auth Type** (**Header Auth**) as they are.
3. Open the **Credential for Header Auth** list and choose **Create new credential**.
4. In **Name**, type `X-Goog-Api-Key` exactly. A header is a hidden label sent with each request; Google looks for your key under this name.
5. In **Value**, paste your API key, with no spaces before or after it.
6. Click the title at the top of the dialog and rename the credential to `Google API Key`.
7. Click **Save** and close the dialog. *Search Google Maps* now shows **Google API Key**.

![The Header Auth credential dialog](img/credential-header-auth.png)
*Name is X-Goog-Api-Key, Value is your key.*

## Step 4: Turn it on and run your first search

### 4.1 Activate or publish

The form's public address only works when the workflow is switched on.

- **n8n 1.x:** click the **Inactive** toggle at the top right so it shows **Active**.
- **n8n 2.x:** click **Publish** at the top right.

If n8n refuses, look for a node with a red warning icon. Usually *Search Google Maps* has no credential yet.

### 4.2 Copy the form address

1. Double-click *Find Leads Form*.
2. At the top, switch from **Test URL** to **Production URL**.
3. Click the address to copy it. It ends in `/form/client-finder-lite`.
4. Open it in a new browser tab and bookmark it.

> **Warning:** Anyone with the Production URL can run searches on your Google account. Keep it private.

### 4.3 Fill in the form

![The Client Finder Lite form](img/lite-form.png)
*The form you fill in for every search.*

1. **Business type**: for example `dentists` or `hair salons`.
2. **City or area**: for example `Austin, TX`, `Manchester, UK` or `Pune, India`.
3. **How many businesses?**: choose **20**, **40** or **60**.
4. Click **Find leads**.

After a few seconds, the page says **Your leads are ready** and the CSV downloads, for example `leads-dentists-in-austin-tx.csv`. For more than 60 businesses, also search nearby areas or related business types.

> **Tip:** Results in the wrong country or language? In *⚙️ Settings*, set `searchCountryCode` (for example `US`, `GB`, `IN`) or `searchLanguage` (for example `en`). On n8n 2.x, publish again afterwards.

## Step 5: Use your CSV

### Open the file

- **Google Sheets:** open a blank sheet, then **File** > **Import** > **Upload**, choose the file and click **Import data**.
- **Excel:** double-click the file. If accented names look wrong, use **Data** > **From Text/CSV** and choose **UTF-8**.

### The columns

| Column | What it shows |
|---|---|
| Business | The name on Google Maps |
| Has Website | **NO** if Google lists no website, **Yes** if it does |
| Opportunity | "No website: pitch a website" for businesses marked NO |
| Phone, Website | As listed on Google Maps (Website is empty if none) |
| Category | The main category, for example "Dentist" |
| Rating, Reviews | Google star rating (1 to 5) and number of reviews |
| Address, Google Maps | Full address and a link to the Maps listing |
| Search | The search you ran, for example "dentists in Austin, TX" |

Businesses marked NO come first. Within each group, businesses with more reviews come first.

> **Example:** These rows are example data from our test set (made-up businesses in Austin, TX), not real results.

| Business | Has Website | Phone | Rating | Reviews |
|---|---|---|---|---|
| Lakeside Dental Care | NO | (512) 555-0102 | 4.8 | 340 |
| Sunrise Family Dental, PLLC | Yes | (512) 555-0101 | 4.6 | 212 |

### Start with the businesses marked NO

A business with good reviews but no website is a good place to start: it has happy customers, but nothing for new ones to look at.

1. "NO" means Google Maps lists no website. A few may still have one, so search the name first.
2. Open the Maps link and note one real detail to mention.
3. Add a **Status** column to track who you contacted and when.

### A first message you can send

Lite does not find email addresses. Call, or send a direct message (DM) on Facebook, Instagram or WhatsApp. If their Google or Facebook page shows an email address, send the same text by email.

> **Example:** Hi [name], I found [Business] on Google Maps and saw your [340] reviews. Great work. I couldn't find a website for you, though, and many people like to see one before they call. I build simple, mobile-friendly websites for local businesses. Would a free one-page idea of what yours could look like be useful? If not, no problem. [Your name], [your phone]

On the phone, keep it short: "Hi, I'm [name], a web designer in [city]. I saw your reviews on Google Maps, but I couldn't find your website. Do you have one I missed?" Then listen.

> **Important:** Be honest and polite, and stop if someone says no. Follow the rules for cold calls and messages in your country.

## Troubleshooting

When something goes wrong, the form shows a message page instead of a download.

### "Google Maps search failed"

The message also gives a reason:

| The reason mentions | What to do |
|---|---|
| your Google API key was rejected | Open the Google API Key credential, paste the key again, and check that **Name** is exactly `X-Goog-Api-Key`. |
| this API is not enabled | Enable **Places API (New)** in the key's project (Step 1.3). Wait 2 minutes and try again. |
| billing account | Link a billing account to the project (Step 1.2). |
| an application restriction | Set **Application restrictions** to **None**, and check that **Places API (New)** is ticked under **API restrictions** (Step 1.4). |
| quota or rate limit | Wait a few minutes and try again. |
| permission denied | Check the key and that Places API (New) is enabled in the key's project. |

Some messages say "step 2 of the setup guide". In this quick start, that is Step 1.

### "No businesses found"

Google Maps found no open businesses for your search. Try a bigger area (a city instead of a neighbourhood), check the spelling, or use a more common business type.

### "Missing search details"

**Business type** or **City or area** was empty or only had spaces. Fill in both and submit again.

### The form address shows a 404 or "not found" error

The workflow is not switched on: activate or publish it (Step 4.1), and use the **Production URL**. If you imported Lite twice, delete the extra copy: both use the same address, so only one can be active.

Still stuck? Email {{supportEmail}} with the exact message and your n8n version. Never send your API key.

## What it costs

- **Lite is free.** It uses no AI and no paid add-ons.
- **Google Places API:** one request returns up to 20 businesses. A 20-business search is 1 request, 40 is up to 2, and 60 is up to 3.
- Google's free monthly usage for Maps services usually covers light use. Prices change, so check the current Places API (New) Text Search prices at https://mapsplatform.google.com/pricing/.
- **n8n:** n8n Cloud is paid after the trial. Self-hosted n8n is free software on your own server. Each search is one workflow run (an "execution").

> **Cost:** For a hard limit, lower the daily request quota of Places API (New) in Google Cloud.

## Want the full Client Finder?

The paid versions also research each business and draft your first message. You review and send every email yourself.

**Starter ($49 USD)** is the web-design Client Finder. It:

- Checks every website (down, slow on mobile, not mobile-friendly, no HTTPS, outdated and more).
- Scores each business from 0 to 100 (Hot, Warm or Low).
- Writes a short pitch with Claude (an AI model), using only problems it actually found.
- Saves everything to a Google Sheet CRM (a simple customer list) and never adds the same business twice.
- Creates Gmail drafts when a business publishes an email address on its homepage. Nothing is sent until you send it.

**Pro ($99 USD)** adds:

- 5 niche workflows: web design, local SEO, Google reviews, social media and ads, and AI chatbots and booking.
- Follow-up Autopilot: every morning it checks Gmail, marks replies in your sheet and drafts polite follow-ups in the same thread.
- An outreach playbook and message templates.

> **Cost:** The paid versions also need an Anthropic API key with prepaid credits, roughly 1 to 2 US cents per pitch with the default settings.

Get Starter or Pro here: {{storeUrl}}
