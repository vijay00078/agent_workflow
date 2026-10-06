---
title: Start here
subtitle: What is in your Pro download, and how to get your first leads and follow-ups running.
kicker: Welcome
tier: Pro
---

## Welcome

Thank you for buying {{productName}} Pro. You type a business type and a city, and it finds up to 60 local businesses on Google Maps through Google's official Places API. It checks each one for a problem your service can fix, from websites to reviews, and scores it from 0 to 100. Claude (an AI model) writes a short pitch from the verified facts. Every lead is saved to your Google Sheet, and pitches and follow-ups become Gmail drafts that you read and send yourself.

It runs in **n8n**, an automation tool where small steps (called *nodes*) are joined into a *workflow*.

## What's in your download

| File | What it is | When you need it |
|---|---|---|
| START-HERE.pdf | This page | Now |
| SETUP-GUIDE.pdf | Setup of Google, Anthropic, n8n and your sheet | First |
| workflows/client-finder-web-design.json | Web Design: missing, slow or outdated websites | If you sell this |
| workflows/client-finder-seo.json | Local SEO: weak basics for Google Search and Maps | If you sell this |
| workflows/client-finder-reviews.json | Reviews: low rating or fewer reviews than competitors | If you sell this |
| workflows/client-finder-social-media.json | Social Media & Ads: no social links, no ad tracking | If you sell this |
| workflows/client-finder-ai-chatbot.json | AI Chatbots & Booking: no booking, no chat, short hours | If you sell this |
| workflows/follow-up-autopilot.json | Checks Gmail daily, marks replies, drafts follow-ups | After your first emails |
| Client-Finder-CRM.xlsx | Your lead list template, tab **Leads** (a *CRM*) | During setup |
| PRO-GUIDE.pdf | More niches and the Follow-up Autopilot | After your first search |
| PROMPTS.pdf | Tune your offer and pitch style | After your first search |
| OUTREACH-PLAYBOOK.pdf | How to do outreach well | Before you send more emails |
| TEMPLATES.pdf | Messages to copy and adapt | When you reply or follow up |
| LICENSE.txt | What you may do with the files | Any time |

> **Important:** Upgrading from Starter?
>
> - Keep your existing workflow, credentials and Google Sheet.
> - Skip `workflows/client-finder-web-design.json`. It is the same workflow, and a second copy would clash with yours on the same form address.
> - Import only the new niches you sell and the Follow-up Autopilot.

> **Cost:** Apart from your n8n plan, you pay Google and Anthropic directly for what you use: roughly 1-2 US cents per AI pitch with the default model. Set a budget alert in Google Cloud.

## Your first hour

### 1. Set up one workflow (about 30-45 minutes)

Follow SETUP-GUIDE.pdf with the niche (type of service) you sell most, or web design if you are not sure. In *⚙️ Settings*, put your real name in **yourName** and paste your sheet's address into **googleSheetUrl**. The workflow will not run without both.

### 2. Run your first search (about 5 minutes)

Open the form from the *Find Clients Form* node and choose **20** businesses. A run takes about 2-8 minutes, so keep the browser tab open, and don't submit another search until it is done.

Each run saves every lead to your sheet first. Then it creates the Gmail drafts and writes each draft's ID back to the sheet.

![The results page after a run](img/results-page.png)
*Example results page. Your numbers will differ.*

### 3. Read and send your best 5 drafts (about 15 minutes)

1. In your sheet, pick the 5 leads with the highest **Score** and the status **Draft ready**.
2. In Gmail, open **Drafts** and check each draft against the **Evidence** column.
3. Change anything that does not sound like you, then click **Send**.

### 4. Tune your offer with PROMPTS (about 10 minutes)

Use PROMPTS.pdf to adjust your service, offer, sign-off and tone in *⚙️ Settings*.

### 5. Import the other niches you sell

Follow PRO-GUIDE.pdf. Use the same credentials and sheet in every workflow, so no business is pitched twice, even by another niche. The same goes for a lead whose email address or website was already pitched under another listing (chain locations, duplicate listings). It is saved with the note "Same email as …" or "Same website as …", but not pitched again.

### 6. Turn on the Follow-up Autopilot

Set it up with PRO-GUIDE.pdf. Every morning it checks Gmail, marks leads who replied as **Replied**, and changes sent pitches to **Contacted**. With no answer 3 days after you send your pitch, it drafts a short follow-up in the same thread. Then, 7 days after you send that follow-up, it drafts a last polite note. It never sends anything itself.

It reads every message in the Gmail threads your pitches were sent in. So a reply from a colleague or the owner's personal address counts (**Notes** says who replied), and a delivery failure marks the lead **Bounced**. Out-of-office auto-replies don't count. Every follow-up ends with a short opt-out line (**followUpOptOutLine** in its *⚙️ Settings*; leave it on).

### 7. Read the OUTREACH-PLAYBOOK

Read it before you send more emails. Steps 5-7 can wait for day two.

## The 3 golden rules

1. **Read every draft before you send it.** You are the sender. Make sure each email is true, polite and sounds like you.
2. **Start with 10-20 emails a day from your own inbox.** Sending many emails at once can get you marked as spam. Grow slowly.
3. **Respect every "no thanks".** Every first email and every follow-up ends with an opt-out line. When someone says no, set their **Status** to **Do not contact** (or **Not interested**) and keep their row. The niche workflows never pitch that email address or website again, and the Autopilot never follows it up.

> **Tip:** Add your postal address in **yourAddress** in *⚙️ Settings* (the US CAN-SPAM Act requires one in business email). Anyone with a form's Production URL can run searches on your accounts. Keep it private, and lock it with n8n's Basic Auth (*Find Clients Form* → **Authentication** → **Basic Auth**) or a hard-to-guess form path.

## Need help?

Most workflow messages tell you what to fix. Still stuck? Email {{supportEmail}}. Include your n8n version (Cloud or self-hosted), the workflow and node with the problem, and the exact message. Never send your API keys.

## Your license in one paragraph

You may use {{productName}} for your own business and to find and serve your own clients, including running it for a client. You may not resell, share, give away or publish the workflow files or the guides, in full or in part. LICENSE.txt has the full terms and wins if anything differs from this summary.
