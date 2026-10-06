---
title: Start here
subtitle: What is in your download, and how to find your first leads in about an hour.
kicker: Welcome
tier: Starter
---

## Welcome

Thank you for buying {{productName}} Starter. You type a business type and a city, and it finds up to 60 local businesses on Google Maps through Google's official Places API. It checks each one for a website problem you can fix, such as no website or a slow mobile site, and gives it a score from 0 to 100. Claude (an AI model) then writes a short pitch using only the facts it found, every lead is saved to your Google Sheet, and pitches for businesses with a public email become Gmail drafts that you read and send yourself.

Starter is built for web designers. It runs in **n8n**, an automation tool where small steps (called *nodes*) are joined into a *workflow*.

## What's in your download

| File | What it is | When you need it |
|---|---|---|
| START-HERE.pdf | This page | Now |
| SETUP-GUIDE.pdf | Step-by-step setup of Google, Anthropic, n8n and your sheet | First |
| client-finder-web-design.json | The workflow file you import into n8n | During setup |
| Client-Finder-CRM.xlsx | Your lead list template, tab **Leads** (a *CRM* is a list of contacts and where each one stands) | During setup |
| PROMPTS.pdf | How to tune your offer and the style of your pitches | After your first search |
| LICENSE.txt | What you may and may not do with the files | Any time |

> **Important:** You need an n8n account (n8n Cloud or self-hosted, version 1.123 or newer), a Google account with billing turned on in Google Cloud, and an Anthropic account with prepaid credits. SETUP-GUIDE.pdf shows you how to set up each one.

> **Cost:** Apart from your n8n plan, you pay Google and Anthropic directly for what you use. With the default AI model, one pitch costs roughly 1-2 US cents. Google gives a free monthly allowance for Maps searches, but set a budget alert anyway.

## Your first hour

### 1. Set up everything (about 30-45 minutes)

Follow SETUP-GUIDE.pdf from start to finish. In the *⚙️ Settings* node, put your real name in **yourName** and paste your sheet's address into **googleSheetUrl**. The workflow will not run until both are filled in.

### 2. Run your first search (about 5 minutes)

Open the form from the *Find Clients Form* node. Try `dentists` in your own city, and choose **20** businesses. A run takes about 2-6 minutes, so keep the browser tab open.

![The results page after a run](img/results-page.png)
*Example results page. Your numbers will differ.*

### 3. Read and send your best 5 drafts (about 15 minutes)

1. In your sheet, pick the 5 leads with the highest **Score** and the status **Draft ready**.
2. In Gmail, open **Drafts**. Check each draft against the **Evidence** column in your sheet.
3. Change anything that does not sound like you, then click **Send**.
4. In the sheet, change their **Status** to **Contacted**.

Leads with the status **Pitch ready** usually have no public email. Use the **DM Message** or **Call Opener** columns to reach them by phone or social media.

### 4. Tune your offer with PROMPTS (about 10 minutes)

Use PROMPTS.pdf to adjust your service, offer and tone in *⚙️ Settings*, so your next pitches sound more like you.

## The 3 golden rules

1. **Read every draft before you send it.** You are the sender. Make sure each email is true, polite and sounds like you.
2. **Start with 10-20 emails a day from your own inbox.** Sending many emails at once can get you marked as spam. Grow slowly.
3. **Respect every "no thanks".** Every first email ends with an opt-out line. When someone says no, set their **Status** to **Do not contact** and never email them again. Keep their row: future searches skip businesses that are already in your sheet.

> **Tip:** Some laws, such as the US CAN-SPAM Act, require a postal address in business email. Add yours in **yourAddress** in *⚙️ Settings*.

## Need help?

Most workflow messages tell you what to fix. Still stuck? Email {{supportEmail}}. Include your n8n version, whether you use n8n Cloud or self-hosted, the node with the problem and the exact message. Never send your API keys.

Want more niches? Pro adds Local SEO, Google Reviews, Social Media & Ads and AI Chatbots & Booking, plus the Follow-up Autopilot: {{storeUrl}}

## Your license in one paragraph

You may use {{productName}} for your own business and to find and serve your own clients, including running it for a client. You may not resell, share, give away or publish the workflow files or the guides, in full or in part. LICENSE.txt has the full terms and wins if anything differs from this summary.
