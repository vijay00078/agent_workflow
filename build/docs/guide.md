---
title: "n8n AI Agent Starter Pack"
subtitle: "START HERE · Setup Guide"
tagline: "10 ready-to-run AI automations + bonus, with step-by-step setup"
version: "Version 1.0"
cover_images:
  - "screenshots/canvas/04-telegram-ai-personal-assistant.png"
  - "screenshots/canvas/02-whatsapp-ai-auto-reply-bot.png"
  - "screenshots/canvas/05-google-maps-lead-finder.png"
---

# Welcome 👋 {#welcome}

Thank you for getting the **n8n AI Agent Starter Pack**!

Inside are **10 AI automations and 1 bonus**, ready to run. They are the kind of automations businesses pay for: an inbox that sorts itself, a WhatsApp bot that answers customers at 2 AM, a website chatbot that knows every page of your site, and a lead machine that finds prospects and writes the first email for you.

Every workflow in this pack:

- **imports in seconds**: one file, drag it into n8n
- **explains itself**: a yellow **START HERE** note on the canvas lists the exact setup steps
- **keeps your settings in one place**: the ✏️ **Config** node is usually the only node you edit
- **is tested**: every workflow was imported and run on n8n 2.x, and works with **n8n 1.100 and newer**
- **is yours to use**: in your own business and in projects for your clients (see [License](#license))

## The 10 workflows (+ bonus)

| #  | Workflow | What it does for you | Setup |
|----|----------|----------------------|-------|
| 01 | [AI Inbox Assistant](#wf01) | Labels and summarizes every email, then drafts replies in your voice | 5 min |
| 02 | [WhatsApp AI Auto-Reply Bot](#wf02) | Answers customers 24/7 from text, voice notes and photos | 20 min |
| 03 | [AI Website Chatbot](#wf03) | Learns your website, answers visitors and captures leads | 10 min |
| 04 | [Telegram AI Personal Assistant](#wf04) | Handles your calendar, Gmail and to-dos by text or voice | 10 min |
| 05 | [Google Maps Lead Finder](#wf05) | Finds local businesses with emails, a lead score and an AI-written opener | 10 min |
| 06 | [AI Lead Qualifier & Instant Reply](#wf06) | Scores every lead 0–100, replies in under 60 seconds and alerts you on hot leads | 10 min |
| 07 | [Blog-to-Social Repurposer](#wf07) | Turns 1 article into 9 ready-to-post pieces | 5 min |
| 08 | [AI SEO Blog Writer](#wf08) | Turns topics in a Google Sheet into full articles in Google Docs | 10 min |
| 09 | [Invoice & Receipt Extractor](#wf09) | Reads PDFs and photos into a GST-ready Google Sheet | 10 min |
| 10 | [Daily AI News Digest](#wf10) | Your personal AI editor, delivered every morning | 3 min |
| ★  | [BONUS: Error Alerts](#bonus) | When any workflow fails, alerts you with AI fix suggestions | 3 min |

## What's in the ZIP

```text
n8n-AI-Agent-Starter-Pack/
├── START HERE - Setup Guide.pdf      ← this guide
├── README.txt
├── LICENSE.txt
├── workflows/                        ← import these into n8n
│   ├── 01-ai-inbox-assistant.json
│   ├── …
│   └── BONUS-workflow-error-alerts.json
├── google-sheets-templates/          ← ready-made sheets (CSV)
├── website-chat-widget/              ← chat bubble for your website
├── self-hosting/                     ← docker-compose for your own server
└── bonuses/
    ├── AI Automation Agency Playbook.pdf
    └── AI Prompt Pack.pdf
```

## What you need

- **n8n**: either [n8n Cloud](https://n8n.io) (easiest) or your own server ([Self-host n8n](#selfhost)).
- **An OpenAI API key.** You pay as you go, and most workflows cost a few cents a day ([Accounts & credentials](#accounts)).
- **The accounts a workflow connects to**, such as Google (Gmail, Sheets, Drive, Calendar), Telegram or WhatsApp. Each workflow's chapter lists them.
- **No coding.** You only paste in keys and fill in the Config node.

::: tip
**Where to start?** If you are new to n8n, do the [Quick start](#quickstart) with workflow **10 · Daily AI News Digest**. It takes 3 minutes and shows you every step. Then set up **01 · AI Inbox Assistant**, which saves you time from day one.
:::

# Quick start in 10 minutes ⚡ {#quickstart}

Every workflow in this pack follows these **same 8 steps**. Learn them once and you can set up all of them.

### Step 1: Get n8n

- **n8n Cloud** (easiest): sign up at **n8n.io** and you get your own address, like `https://yourname.app.n8n.cloud`. HTTPS, webhooks and "Sign in with Google" just work.
- **Your own server** (about $5/month): see [Self-host n8n](#selfhost). The `self-hosting` folder has everything ready.
- **Your own computer** (testing only): `npx n8n` or Docker Desktop. WhatsApp, Telegram, the website chat and forms need a public **HTTPS** address, so use n8n Cloud or a server for those.

### Step 2: Get your OpenAI API key

Go to **platform.openai.com**, add $5–10 of credit and create an API key. [OpenAI API key](#openai) has the details.

### Step 3: Import a workflow

1. In n8n, click **Create workflow** (or **+ → Workflow**).
2. Open the **⋯** menu in the top bar of the editor and choose **Import from File…**
3. Choose `workflows/10-daily-ai-news-digest.json` from this pack.

::: tip
**Shortcut:** open a workflow file in any text editor, copy everything (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>A</kbd>, <kbd>C</kbd>) and paste it onto an empty canvas (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>V</kbd>).
:::

### Step 4: Read the yellow START HERE note

It sits at the top left of the canvas and lists exactly what this workflow needs.

### Step 5: Connect your accounts

Nodes that need an account show a small ⚠️. Double-click the node, open **Credential to connect with → Create new credential** and follow the prompts. You create each credential once and reuse it everywhere: one OpenAI credential serves all 11 workflows.

### Step 6: Fill in the Config node ✏️

Double-click the **Config** node and replace the example values with yours: your email, your business info and your Google Sheet link. Each chapter explains every field.

### Step 7: Test it

Click **Execute workflow** at the bottom of the canvas. A node turns green when it works. Click any node to see exactly what went in and what came out. It's the fastest way to understand and debug a workflow.

### Step 8: Go live

Click **Publish** (n8n 2.x), or switch the **Active** toggle on (n8n 1.x). From now on the workflow runs on its own: on schedule, on every new email or on every message.

🎉 **That's it.** The other workflows work the same way, with different accounts and Config fields.

# How the workflows are built 🧭 {#basics}

Two minutes here will save you hours later.

![Every workflow has a yellow START HERE note, numbered colored sections and one ✏️ Config node.](screenshots/canvas/10-daily-ai-news-digest.png){.canvas}

**🟨 START HERE note.** The setup steps and tips for that workflow.

**1️⃣ 2️⃣ 3️⃣ Colored sections.** Each section explains what its part of the workflow does. Read them left to right.

**✏️ Config node.** All your settings in one place: names, emails, links, tone of voice and limits. You rarely need to touch anything else.

**Greyed-out nodes are optional.** Features such as Telegram alerts or auto-posting to LinkedIn are switched off. Select the node and press <kbd>D</kbd> to switch it on, and press <kbd>D</kbd> again to switch it off.

**Small grey notes under nodes.** These are hints, such as *"✏️ Your email, topics & interests"*.

**Test URL vs. Production URL.** Forms, webhooks and the website chat each have two addresses:

- the **Test URL** works only while you test in the editor;
- the **Production URL** works once the workflow is **published/active**. Share this one.

**Executions.** Every run is saved in the **Executions** tab. If something fails, open the run. The red node shows exactly what went wrong and why.

**Time zone.** Schedules ("every morning at 7") use your n8n time zone. To set it, open the workflow's **⋯ menu → Settings → Timezone**. On your own server, set `GENERIC_TIMEZONE`.

**The AI model.** All workflows use OpenAI **gpt-4.1-mini** by default, which is fast, cheap and reliable. Open an **OpenAI Chat Model** node to pick another model, or switch to Claude, Gemini or a local model ([Swap the AI](#swap)).

**You stay in control.** Emails to other people are either saved as **drafts** (01), **confirmed by you first** (04) or controlled by a **switch in Config** (06 `auto_reply`).

::: note
**Updating a workflow later?** Import the new version as a **new** workflow, copy your Config values across, then unpublish/deactivate the old one. Your credentials stay connected because they're stored in n8n, not in the files.
:::

# Accounts & credentials (one-time setup) 🔑 {#accounts}

You only do this once. Afterwards, every workflow reuses the same credentials.

## OpenAI API key {#openai}

1. Go to **platform.openai.com** and sign up or log in.
2. Open **Settings → Billing**, add a payment method and buy some credit. **$5–10 lasts a long time** with these workflows.
3. Open **API keys → Create new secret key** and copy the key (it starts with `sk-`).
4. In n8n, open any OpenAI node, choose **Credential → Create new**, paste the key and click **Save**.

::: warning
A **ChatGPT Plus** subscription does **not** include API credit. They're billed separately. If you see error **429 / "insufficient_quota"**, your API credit is empty.
:::

::: tip
Set a monthly budget under **Settings → Limits** on platform.openai.com so a surprise bill is impossible.
:::

## Google: Gmail, Sheets, Drive, Calendar, Tasks {#google}

**On n8n Cloud:** open the node, choose **Create new credential**, click **Sign in with Google** and allow access. That's all.

**On your own server (self-hosted):** you create a small Google "OAuth app" once (about 10 minutes) and reuse it for every Google credential:

1. Go to **console.cloud.google.com** and create a project (for example, "n8n").
2. Open **APIs & Services → Library** and **enable** the APIs you'll use: *Gmail API, Google Sheets API, Google Drive API, Google Calendar API, Google Tasks API*.
3. Open the **OAuth consent screen** (*Google Auth Platform*). Fill in the app name and your email, set **Audience → External** and add your Google address as a **Test user**.
4. Open **Clients** (or **Credentials**), choose **Create OAuth client ID** and set the type to **Web application**. Under **Authorized redirect URIs**, paste the **OAuth Redirect URL** that n8n shows in the credential window. It looks like `https://your-n8n-domain/rest/oauth2-credential/callback`.
5. Copy the **Client ID** and **Client Secret** into the n8n credential and click **Sign in with Google**.
6. If you see *"Google hasn't verified this app"*, that's expected: it's your own app. Click **Advanced → Go to … (unsafe)** and continue.

::: warning
**Avoid the 7-day logout.** While your OAuth app is in **Testing** mode, Google ends the login after **7 days** and your workflows fail with *"invalid_grant"* or *"Token has been expired or revoked"*. **Fix:** on the OAuth consent screen, go to **Audience → Publish app** ("In production"). You don't need Google's verification for your own use. Then reconnect the credential once.
:::

## Telegram bot {#telegram}

1. In Telegram, open **@BotFather**, send `/newbot` and choose a name and a username that ends in "bot".
2. Copy the **token**. It looks like `123456789:AAH…`.
3. In n8n, open any Telegram node, choose **Credential → Create new** and paste the token as the **Access Token**.
4. **Your chat ID:** workflow 04 tells you (it replies with it), or message **@userinfobot**.

::: note
**One bot = one webhook.** Telegram delivers a bot's messages to **one** address only. When you test in the editor, n8n points the bot at the *test* address. **After testing, re-publish the workflow** (or switch it off and on) so the bot points back at the production address. Use a separate bot for every workflow that **receives** Telegram messages. Nodes that only **send** messages (alerts in 01, 06, 10 and the bonus) can share any bot.
:::

## WhatsApp (Meta Cloud API) {#whatsapp}

Workflow 02 uses the official **WhatsApp Business Cloud API** from Meta. Setup takes about 20 minutes, once. Meta changes its screens often, so if a button has moved, look for the same words.

**A. Create the app and get a test number**

1. Go to **developers.facebook.com → My Apps → Create app**. Choose the use case **"Connect with customers through WhatsApp"** (older screens: app type **Business**) and connect or create a **Business portfolio**.
2. In the app dashboard, open **WhatsApp → API Setup**. Meta gives you a free **test phone number**.
3. Under **To**, add **your own WhatsApp number** and verify it. While you use the test number, the bot can only reply to numbers you add here (up to 5).
4. Write down the **WhatsApp Business Account ID** shown on the same page.

**B. Create a permanent access token.** The token on the API Setup page expires after 24 hours.

1. Go to **business.facebook.com → Settings → Users → System users → Add**. Name it "n8n" and give it the **Admin** role.
2. Click **Assign assets** and give the system user **Full control** of your **app** and of your **WhatsApp account**.
3. Click **Generate new token**, choose your app, set the expiry to **Never** and tick the permissions `whatsapp_business_messaging` and `whatsapp_business_management`. Copy the token.

**C. Connect n8n**

1. In your Meta app, open **App settings → Basic** and copy the **App ID** and **App Secret**.
2. In the **WhatsApp Trigger** node, create a *WhatsApp OAuth API* credential with **Client ID = App ID** and **Client Secret = App Secret**.
3. In **Send WhatsApp Reply**, create a *WhatsApp API* credential with **Access Token = your permanent token** and **Business Account ID = your WhatsApp Business Account ID**. Select the same credential in **Reply: Unsupported Type**, **Get Voice File**, **Get Image File**, **Download Voice**, **Download Image** and **Typing Indicator**.
4. **Publish** the workflow. n8n registers the webhook with Meta automatically. Message the test number from your phone. 🎉

**D. Go live with your real number** (when you're happy)

- In **WhatsApp Manager**, add your business phone number and verify it by SMS or call. The number must not be in use in the normal WhatsApp app.
- Add a **payment method** in WhatsApp Manager and set your display name.
- Switch your app to **Live** mode. This requires a privacy policy URL.

::: note
- Meta allows **one webhook per app**, so use one Meta app per WhatsApp bot (one per client).
- Like Telegram, testing in the editor redirects the webhook. **Re-publish after testing.**
- Pricing: replies to customers inside the **24-hour customer service window** are currently free on the Cloud API. Business-initiated template messages are paid. Check Meta's current pricing page.
:::

## Google Maps API key (Places API) {#mapskey}

Workflow 05 searches Google Maps through the official **Places API (New)**.

1. At **console.cloud.google.com**, select or create a project and open **Billing** to link a billing account. Google requires one even for free usage.
2. Open **APIs & Services → Library**, search for **Places API (New)** and click **Enable**. Make sure it's the *(New)* one.
3. Open **APIs & Services → Credentials → Create credentials → API key** and copy the key.
4. Recommended: click **Edit API key**, then **API restrictions → Restrict key → Places API (New)**.
5. In n8n, open **Search Google Maps** and create a **Header Auth** credential with **Name** `X-Goog-Api-Key` and **Value** set to your key.

::: money
**What does it cost?** Each search page (up to 20 businesses) is one Places request. Because the workflow asks for phone, website and rating, Google bills it as **Text Search Enterprise**. At the time of writing, Google includes **1,000 free requests per month** for that tier, which is about **20,000 businesses**. Check the current prices at *developers.google.com/maps/billing-and-pricing*. To be safe, set a **budget alert** (Billing → Budgets & alerts).
:::

## Optional: LinkedIn and WordPress

- **LinkedIn** (auto-post in 07): on n8n Cloud, sign in with LinkedIn. Self-hosted, create an app at *developer.linkedin.com* with the products **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**.
- **WordPress** (drafts in 08): in WordPress, open **Users → Profile → Application Passwords** and create a password. Then, in n8n, create a *WordPress* credential with your username, that password and your site URL.

# 01 · AI Inbox Assistant {#wf01 .wf}

::: lead
Every new email is read by AI, labeled in Gmail and summarized. When someone is waiting for an answer, a **reply in your voice is saved as a draft** in the same thread. You open Gmail, check the draft and press send.
:::

::: wfmeta
**Setup** 5 min · **Needs** Gmail, OpenAI · **Cost** ≈ $0.001 per email · **Runs** every minute
:::

![](screenshots/canvas/01-ai-inbox-assistant.png){.canvas}

## What it does

1. **Checks Gmail every minute** for new emails. Promotions and Social tabs are skipped to save AI costs.
2. **Cleans the email** by removing quoted history and signatures, so the AI reads only the new message.
3. **The AI triages it**: a category, a priority (high/medium/low), a one-line summary, whether a reply is needed, and the reply itself.
4. **Labels it in Gmail**: `AI/Urgent`, `AI/Client`, `AI/Lead`, `AI/Finance`, `AI/Meeting`, `AI/Personal`, `AI/Newsletter`, `AI/Notification`, `AI/Spam` or `AI/Other`. Missing labels are created automatically.
5. **Saves a draft reply** in the same thread when a reply is needed. It's never sent automatically.
6. *Optional:* pings your phone on Telegram when an email is urgent.

## Setup

1. **New Email** trigger: connect your Gmail account ([Google credentials](#google)).
2. **OpenAI Chat Model**: select your OpenAI credential.
3. **Config**: fill in your name, a line about you, your writing style and your signature.
4. Open **Get Gmail Labels**, **Create Label**, **Add Label** and **Create Draft Reply**, and select the same Gmail credential in each.
5. Click **Execute workflow**. It processes your latest email, so check Gmail for the label and the draft. Then **Publish**.

## Config fields

| Field | What to put there |
|---|---|
| `your_name` | Your name. The AI writes as you. |
| `about_you` | 1–2 sentences about you and your business. This helps the AI spot leads, clients and what matters to you. |
| `writing_style` | How your replies should sound, e.g. *"Friendly, concise, no jargon"*. |
| `signature` | Added at the end of every draft. |
| `reply_language` | Default: *"Reply in the same language the sender used."* |
| `create_draft_replies` | `false` only labels and summarizes, with no drafts. |
| `label_prefix` | Labels are created as `AI/…`. Change "AI" to anything you like. |
| `telegram_chat_id` | Only for the optional urgent alert. |

## Customize

- **Your own categories:** edit the list in the **AI Triage & Reply** prompt and in **Triage Format**, for example "Supplier" or "Recruiting".
- **Auto-archive newsletters:** after the label step, add a Gmail node that removes the `INBOX` label from `AI/Newsletter` emails.
- **Outlook instead of Gmail:** replace the Gmail nodes with the Microsoft Outlook nodes. The rest stays the same.

## Troubleshooting

- **No draft?** Check `create_draft_replies`, and remember that newsletters and notifications don't get replies.
- **"Insufficient permission"** means you didn't tick every permission when connecting Gmail. Reconnect the credential and allow everything.
- **An email processed twice?** That's normal when you click *Execute workflow* manually. The published workflow only processes new emails.

::: money
**Sell it:** busy founders, executives, real-estate agents, lawyers and agencies. Everyone with an overflowing inbox. See the *Agency Playbook* bonus for pricing.
:::

# 02 · WhatsApp AI Auto-Reply Bot {#wf02 .wf}

::: lead
Answers your customers on WhatsApp **24/7, instantly and in their language**, using **your** business info. It understands **text, voice notes and photos**, remembers each conversation and hands over to a human when needed.
:::

::: wfmeta
**Setup** 20 min (one time) · **Needs** Meta developer account, OpenAI · **Cost** ≈ $0.001–0.003 per reply · **Runs** on every message
:::

![](screenshots/canvas/02-whatsapp-ai-auto-reply-bot.png){.canvas}

## What it does

1. A customer messages your WhatsApp Business number.
2. The bot **marks the message as read** (blue ticks) and **shows "typing…"** while it thinks.
3. **Voice notes are transcribed**. **Photos are described by AI**, including any text in them (prices, product names, error messages).
4. An **AI agent writes the answer** using only your business info. It remembers the last 20 messages with each customer and can calculate prices and quantities.
5. The reply goes out on WhatsApp, formatted for WhatsApp with *bold* text and clean links.
6. Stickers, locations and other unsupported types get a friendly *"please send text, a voice note or a photo"* reply.

## Setup

1. Set up the Meta app, test number and permanent token: [WhatsApp (Meta Cloud API)](#whatsapp).
2. **WhatsApp Trigger**: *WhatsApp OAuth API* credential (App ID + App Secret).
3. **Send WhatsApp Reply**, **Reply: Unsupported Type**, **Get Voice File**, **Get Image File**, **Download Voice**, **Download Image** and **Typing Indicator**: *WhatsApp API* credential (permanent token + Business Account ID).
4. **OpenAI** nodes (chat model, Transcribe Voice, Describe Image): your OpenAI credential.
5. **Config**: paste your business info. This is the most important step (see below).
6. **Publish**, then send a WhatsApp message to your number. 🎉

## Config fields

| Field | What to put there |
|---|---|
| `business_name` | Your business name. |
| `business_info` | **Everything the bot may tell customers:** services and prices, opening hours, address, booking link, delivery, payment and refund policies, FAQ. The bot **never invents** prices or facts. If something isn't here, it offers the human handoff. |
| `bot_personality` | Tone of voice, e.g. *"Warm, short messages, uses the customer's first name"*. |
| `language_rule` | Default: always reply in the customer's language. |
| `human_handoff` | What to tell customers who need a person, e.g. a phone number and hours. |
| `timezone` | e.g. `Europe/London` or `Asia/Kolkata`, so "are you open now?" is answered correctly. Leave it empty to use n8n's time zone. |

::: tip
Write `business_info` like a briefing for a new employee. Put one fact per line and include the 10 questions customers ask most. The **AI Prompt Pack** bonus has ready-made `business_info` templates for salons, clinics, restaurants, real estate, gyms and online shops.
:::

## Troubleshooting

- **Nothing happens at all:** check that the workflow is **published** and that n8n has an **HTTPS** address. If you tested in the editor, **re-publish**. In your Meta app under **WhatsApp → Configuration**, the callback URL should point to your n8n.
- **Error 131030 "Recipient phone number not in allowed list":** while you use the test number, add the recipient under **API Setup → To**.
- **Error 190 / "Session has expired":** you used the 24-hour token. Create the permanent **System User** token.
- **Voice notes fail:** the **Transcribe Voice** node needs your OpenAI credential.
- **Groups:** the WhatsApp Cloud API doesn't support group chats.

::: money
**Sell it:** salons, clinics, dentists, restaurants, real-estate agents, driving schools and online shops. Any business that answers the same WhatsApp questions all day. This one usually sells as setup fee + monthly care.
:::

# 03 · AI Website Chatbot {#wf03 .wf}

::: lead
Paste your website URL and the bot **reads your pages** and answers visitors **24/7** with accurate, on-brand answers, including **links to the right page**. It can guide visitors to your goal (for example, booking a call) and **save leads** to a Google Sheet.
:::

::: wfmeta
**Setup** 10 min · **Needs** OpenAI (+ Google Sheets for leads) · **Cost** training ≈ $0.01, ≈ $0.001–0.002 per answer · **Runs** on every chat message
:::

![](screenshots/canvas/03-ai-website-chatbot.png){.canvas}

## What it does

**Part A: learn your website.** It reads your `sitemap.xml` (and any extra pages you list), downloads up to `max_pages` pages, extracts the clean text and stores it in a searchable knowledge base. Training runs when you click **▶️ Train the bot now**, **every night at 3 AM** and **every time n8n starts or the workflow is published**, so the bot stays up to date without a database.

**Part B: answer visitors.** Every chat message goes to an **AI Support Agent**. The agent searches the knowledge base, answers in a friendly way with links, follows your `bot_goal`, remembers the conversation and, if you switch it on, saves interested visitors as leads.

![The chat window your visitors see (colors are easy to change).](screenshots/chat/chat-answer.png){.shot-small}

## Setup

1. **OpenAI** nodes (2 chat models and 2 embeddings): your OpenAI credential.
2. **Config**: your `website_url`, business name, contact info and goal.
3. Click **Execute workflow** and choose **▶️ Train the bot now**. It reads your site in about a minute.
4. Open the **Chat Trigger**, copy the **Chat URL** and ask the bot something! 💬
5. **Publish**, then put the chat bubble on your website (below).

## Put the chat bubble on your website

1. Open `website-chat-widget/website-chat-widget.html` from the pack in any text editor.
2. Paste your **Production Chat URL** where it says `PASTE-YOUR-CHAT-URL-HERE`.
3. Double-click the file to try it in your browser. A demo page opens with the chat bubble.
4. Copy the part between **COPY FROM HERE** and **COPY TO HERE**, and paste it just before `</body>` on your site. It works with **WordPress** (Theme File Editor or the *WPCode* plugin), **Webflow** (Custom code → Footer), **Shopify** (`theme.liquid`), **Wix**, **Framer**, **Squarespace** and **Carrd**. The file has step-by-step notes for each.
5. Change the colors in the `:root { … }` block to match your brand.

## Config fields

| Field | What to put there |
|---|---|
| `website_url` | Your website, e.g. `https://www.yourbusiness.com`. |
| `business_name`, `bot_name` | Shown in the bot's answers, e.g. *"I'm Ava from …"*. |
| `bot_goal` | What the bot should steer visitors to, e.g. *"book a free consultation at …/contact"*. |
| `contact_info` | How people reach a human. |
| `extra_knowledge` | FAQs, policies, opening hours or anything that's **not on your website**. It's the fastest way to improve answers. |
| `max_pages` | How many pages to read (default 40). |
| `sitemap_url` | Only if your sitemap isn't at `/sitemap.xml`. |
| `extra_page_urls` | Pages missing from the sitemap, one per line. |
| `leads_sheet_url` | Google Sheet for leads (import `Chatbot Leads.csv`), used by **Save Lead**. |

**Capture leads:** select **Save Lead (Google Sheets)**, press <kbd>D</kbd> to switch it on, connect Google and put your sheet URL in Config. When a visitor wants to be contacted, the bot saves their name, email, phone, interest and a summary of the conversation.

## Troubleshooting

- **"I don't know" answers:** open the execution of *Train the bot now* and check how many pages were read. If none were, your site has no sitemap: set `sitemap_url` or list your pages in `extra_page_urls`.
- **Sites built with JavaScript or protected by bot blockers** (some Wix, Framer or Cloudflare setups) can return little text. Put the key facts into `extra_knowledge`.
- **The bot knows nothing right after a restart:** it re-trains automatically when n8n starts. Give it a minute.
- **The chat bubble doesn't show on your site:** the workflow must be **published**, and you must use the **Production** Chat URL. Check the browser console (F12) for errors.

::: note
The knowledge base lives in n8n's memory. That's perfect for websites up to a few hundred pages. For very large sites, replace the two "Simple Vector Store" nodes with a hosted vector store (Pinecone, Qdrant, Supabase).
:::

::: money
**Sell it:** every business with a website, especially clinics, law firms, SaaS, e-commerce, hotels and schools. Retrain it monthly as part of a care plan.
:::

# 04 · Telegram AI Personal Assistant {#wf04 .wf}

::: lead
Your own **"Jarvis" in Telegram**. Text it or send a voice note, and it **checks your calendar, books meetings, searches and sends emails, manages your to-dos** and answers anything. It can even answer with a voice note.
:::

::: wfmeta
**Setup** 10 min · **Needs** Telegram, Google (Calendar, Gmail, Tasks), OpenAI · **Cost** ≈ $0.002–0.01 per request · **Runs** on every message
:::

![](screenshots/canvas/04-telegram-ai-personal-assistant.png){.canvas}

## What it can do

> *"What's on my calendar tomorrow?"* · *"Book a call with Sam on Friday at 3pm"* · *"Any unread emails from Stripe?"* · *"Reply to Anna that I'll send the proposal on Monday"* · *"Remind me to renew the domain"* · *"What's 18% VAT on 2,450?"* · 📷 *a photo of a business card or an event poster* · 🎙️ *a voice note while driving*

1. **Locked to you:** messages from anyone else are ignored. The very first message replies with your chat ID.
2. **Voice notes are transcribed** and **photos are read** (receipts, notes, screenshots, posters).
3. **The AI Assistant** remembers the conversation and uses its tools: **Calendar** (get and create events), **Gmail** (search and send), **Tasks** (add, list, complete) and a **Calculator**.
4. **It always asks before sending an email.**
5. It answers in Telegram, and **with a voice note** when you spoke to it (switch this off with `voice_replies`).

## Setup

1. In Telegram, create a bot with **@BotFather** ([Telegram bot](#telegram)).
2. **Telegram Trigger**: create the Telegram credential and reuse it on every Telegram node.
3. **OpenAI** nodes: your OpenAI credential.
4. Google tools (Calendar ×2, Gmail ×2, Tasks ×3): connect your Google account.
5. **Publish**, then message your bot. It replies with **your chat ID**.
6. Paste that number into **Config → `allowed_chat_id`** and save. 🔒 Now it only obeys you.

## Config fields

| Field | What to put there |
|---|---|
| `allowed_chat_id` | Your Telegram chat ID (step 5). |
| `your_name`, `assistant_name` | How it addresses you, and its name. |
| `your_timezone` | **Important for scheduling**, e.g. `America/New_York`, `Europe/Berlin`, `Asia/Kolkata`. |
| `assistant_style` | Tone, e.g. *"Friendly, efficient and a little witty"*. |
| `voice_replies` | `true` replies to voice notes with a voice note. |
| `tts_voice` | `alloy`, `ash`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage` or `shimmer`. |

## Troubleshooting

- **The bot doesn't answer:** is the workflow **published**? Did you test in the editor? Then **re-publish** (one webhook per bot). Is `allowed_chat_id` correct?
- **Meetings at the wrong time:** set `your_timezone`.
- **It didn't send the email:** it asks for confirmation first, so reply *"yes, send it"*.
- **You don't use Gmail or Tasks?** Select those tool nodes and press <kbd>D</kbd> to switch them off.

::: money
**Sell it:** a premium "AI executive assistant" for founders, consultants, coaches and sales people, set up on their own accounts.
:::

# 05 · Google Maps Lead Finder + AI Openers {#wf05 .wf}

::: lead
Type *"dentists in Austin"* and get **up to 60 local businesses** in your Google Sheet, each with phone, website, **email**, socials, a **lead score** and a **personalized cold-email opener**.
:::

::: wfmeta
**Setup** 10 min · **Needs** Google Maps API key, Google Sheets, OpenAI · **Cost** ≈ $0.0005 per lead (+ Places API, free tier) · **Runs** from a form
:::

![](screenshots/canvas/05-google-maps-lead-finder.png){.canvas}

## What it does

1. **A simple form:** business type, city or area, how many leads (20, 40 or 60), and optionally your offer.
2. **Searches Google Maps** through the official Places API, up to 3 pages of 20 results. Closed businesses are skipped.
3. **Visits every website** to find **email addresses** (including hidden and Cloudflare-protected ones), **Instagram, Facebook and LinkedIn**, the contact page, and **sales signals** such as no online booking, an outdated site or a low rating.
4. **AI scores each lead 1–10** for *your* offer, explains the score and writes a **subject line + personal opener** that references something real about the business. It also suggests the best channel (email, phone, Instagram…).
5. **Saves everything to Google Sheets.** Searching again **updates** existing rows (matched by *Place ID*), so there are no duplicates.

## Setup

1. Create your **Google Maps API key** ([Google Maps API key](#mapskey)).
2. **Search Google Maps**: create a *Header Auth* credential with Name `X-Goog-Api-Key` and your key as the Value.
3. **OpenAI Chat Model**: your OpenAI credential.
4. Create a Google Sheet. In Google Sheets, use **File → Import → Upload** with `google-sheets-templates/Leads.csv` and choose **Insert new sheet(s)**. Paste the sheet's URL into **Config**.
5. **Save to Google Sheets**: connect Google.
6. **Publish**, open **Lead Search Form → Production URL** and search. 🔎

## Config fields

| Field | What to put there |
|---|---|
| `google_sheet_url`, `sheet_tab` | Your sheet, and the tab name (default `Leads`). |
| `your_offer` | What you sell, in one or two sentences. The score and opener are based on this. |
| `your_name`, `your_company` | Used in the opener. |
| `opener_style` | e.g. *"Casual, specific and helpful. No hype."* |
| `language`, `language_code` | Language of the openers and of Google's results (e.g. `English` / `en`). |
| `min_rating` | Skip businesses below this Google rating (0 = keep all). |
| `only_with_website` | `true` keeps only businesses that have a website. |

::: warning
**Contact leads responsibly.** Follow the anti-spam and privacy laws for you and your recipients (e.g. CAN-SPAM, GDPR/PECR, CASL). Send personal, relevant messages in small volumes, and always offer an easy opt-out.
:::

::: money
**Sell it:** run it for agencies, recruiters, B2B service companies and freelancers ("200 qualified local leads with personalized openers"). Or use it yourself to find clients for the other 9 workflows.
:::

# 06 · AI Lead Qualifier & Instant Reply {#wf06 .wf}

::: lead
Every new lead is **scored 0–100 by AI** and gets a **personal reply in under 60 seconds** (with your booking link). The lead lands in your **CRM sheet**, and **hot leads ping you instantly**. Leads contacted within minutes convert far better than leads contacted hours later.
:::

::: wfmeta
**Setup** 10 min · **Needs** Gmail, Google Sheets, OpenAI · **Cost** ≈ $0.002 per lead · **Runs** on every form submission
:::

![](screenshots/canvas/06-ai-lead-qualifier-instant-reply.png){.canvas}

## What it does

1. **Two ways in:** the ready-made **Lead Form** hosted by n8n, or **your own website form** through the webhook.
2. **Understands any form:** field names from Webflow, WordPress, Elementor, Typeform, Tally, Framer and others are recognized automatically.
3. **Reads the lead's website** (if given) for extra context.
4. **The AI qualifies the lead:** a score of 0–100 (sorted into **Hot, Warm or Cold** by your thresholds), a summary, red flags and the next step. **Spam and sales pitches are detected** and never get a reply.
5. **Writes and sends a personal reply** from your Gmail with your booking link, unless you set `auto_reply` to false.
6. **Logs everything in your CRM sheet** and **alerts you by email** (and optionally Telegram) for hot leads.

## Setup

1. **OpenAI Chat Model**: your OpenAI credential.
2. **Config**: what you sell, your ideal customer, your booking link (Calendly or Cal.com) and your email.
3. **Send Instant Reply** and **Alert Me (Email)**: connect Gmail.
4. Import `google-sheets-templates/Leads CRM.csv` into a Google Sheet. **Save to CRM Sheet**: connect Google and paste the sheet URL in Config.
5. **Publish**, then share the **Lead Form** Production URL, or connect your website form (below).

## Connect your website form

Send your form to the **Production URL** of the **Website Form (Webhook)** node (it ends in `/webhook/new-lead`). The webhook accepts JSON or normal form posts. Fields like *name, first name, email, phone, company, website, message, budget* and *timeline* are recognized automatically, even with labels like "Your email" or "Project details".

- **Webflow:** Site settings → Apps & Integrations → Webhooks → *Form submission*
- **WordPress:** Elementor Pro Forms → *Actions after submit → Webhook*; WPForms or Gravity Forms webhook add-on; Contact Form 7 with a "CF7 to Webhook" plugin
- **Typeform, Tally, Jotform, Framer:** Integrations/Connect → *Webhooks* → paste the URL

Test it from a terminal:

```bash
curl -X POST https://YOUR-N8N-DOMAIN/webhook/new-lead \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Smith","email":"jane@acme.com","company":"Acme",
       "website":"acme.com","message":"We need a chatbot for our 3 clinics",
       "budget":"$5,000 – $20,000","timeline":"ASAP"}'
```

## Config fields

| Field | What to put there |
|---|---|
| `business_name`, `what_you_sell` | What you offer, including typical prices. This helps the AI score budget fit. |
| `ideal_customer` | Who's a perfect fit. Leads that match score higher. |
| `booking_link` | Calendly, Cal.com or a contact page. It's included in every reply. |
| `your_name`, `your_title`, `your_email` | The reply is signed as you. Alerts go to `your_email`. |
| `reply_style` | Tone of the reply. |
| `auto_reply` | `false` only scores and logs (no emails to leads). |
| `hot_score`, `warm_score` | Score thresholds (default 70 / 40). |
| `google_sheet_url`, `sheet_tab` | Your CRM sheet (tab `Leads CRM`). |
| `telegram_chat_id` | Optional hot-lead alert on Telegram. |

::: money
**Sell it:** agencies, consultants, real estate, home services, B2B SaaS and clinics. Anyone paying for ads to get leads. "Every lead answered in 60 seconds, 24/7" is an easy pitch.
:::

# 07 · Blog-to-Social Content Repurposer {#wf07 .wf}

::: lead
Paste **one article URL** and get **9 ready-to-post pieces in about 30 seconds**: LinkedIn post, X thread, Instagram caption + hashtags, carousel slides, Facebook post, newsletter blurb, Reels/TikTok script, quote cards and an AI image prompt.
:::

::: wfmeta
**Setup** 5 min · **Needs** Gmail, Google Sheets, OpenAI · **Cost** ≈ $0.01 per article · **Runs** from a form (or automatically from RSS)
:::

![](screenshots/canvas/07-blog-to-social-repurposer.png){.canvas}

## What it does

1. **Repurpose Form:** paste an article URL, pick a tone and add optional extra instructions.
2. **Fetches the article** and extracts the clean text.
3. **The AI writes the 9-piece content pack** in your brand voice, for your audience, with your call to action and hashtags.
4. **Emails you the pack** as a nicely formatted, copy-ready email.
5. **Saves 9 rows to your Content Calendar sheet** (one per platform, Status = *Draft*), ready to schedule.

## Setup

1. **OpenAI Chat Model**: your OpenAI credential.
2. **Config**: your brand, audience, voice, CTA and email.
3. **Email Me the Pack**: connect Gmail.
4. Import `Content Calendar.csv` into a Google Sheet. **Save to Content Calendar**: connect Google and paste the sheet URL in Config.
5. **Publish**, open the **Repurpose Form** URL and paste an article link. 🔗

**Autopilot:** switch on **New Blog Post (RSS)** (select it, press <kbd>D</kbd>) and set your blog's RSS feed URL in it. Every new post is then repurposed automatically. To auto-publish, switch on **Post to LinkedIn** and connect LinkedIn.

## Config fields

| Field | What to put there |
|---|---|
| `brand_name`, `audience`, `brand_voice` | Who you are, who you write for and how you sound. |
| `cta` | The call to action added to posts. |
| `hashtags` | Hashtags you always want included. |
| `language` | Output language. |
| `your_email` | Where the pack is emailed. |
| `google_sheet_url`, `sheet_tab` | Your content calendar (tab `Content Calendar`). |

::: money
**Sell it:** coaches, consultants, agencies and B2B companies that blog but don't post on social. Offer it as "content repurposing as a service" with a monthly retainer.
:::

# 08 · AI SEO Blog Writer {#wf08 .wf}

::: lead
Add topics to a Google Sheet. **Every morning** the AI builds an **SEO brief** and writes a **full, formatted article straight into Google Docs**, then updates your sheet with the title, meta description, slug, word count and Doc link.
:::

::: wfmeta
**Setup** 10 min · **Needs** Google Sheets + Drive, OpenAI · **Cost** ≈ $0.02–0.04 per article · **Runs** every morning at 8
:::

![](screenshots/canvas/08-ai-seo-blog-writer.png){.canvas}

## What it does

1. **Every morning at 8** it reads the rows in your sheet with **Status = Ready** and takes `articles_per_run` of them.
2. **SEO brief** (gpt-4.1-mini): search intent, title, meta description, slug, outline (H2/H3), FAQs and related keywords.
3. **Article** (gpt-4.1): written from the brief in your voice, with an intro, sections, FAQs, your CTA and your internal links.
4. **Creates a Google Doc** with proper headings, lists and links, optionally in a Drive folder you choose.
5. **Updates the row:** Status *Done*, Title, Doc URL, Meta Description, Slug, Words and Written On. If something fails, Status shows **Error: reason**. Set it back to *Ready* to retry.

## Setup

1. In Google Sheets, use **File → Import → Upload** with `Blog Topics.csv`. It has the right columns and 3 example topics (two are set to *Ready*).
2. Put your own topics in it with **Status = Ready**.
3. **Config**: paste the sheet URL and set your brand, audience and voice (optionally a Drive folder link for the docs).
4. Connect **Google Sheets** (3 nodes) and **Google Drive** (*Create Google Doc*).
5. **OpenAI** models: your OpenAI credential.
6. Click **Execute workflow** to write one article now, then **Publish** for daily autopilot. ☀️

**Sheet columns:** `Topic` · `Primary Keyword` · `Audience` · `Notes` · `Word Count` · `Status`. The workflow fills in `Title` · `Doc URL` · `Meta Description` · `Slug` · `Words` · `Written On`.

## Config fields

| Field | What to put there |
|---|---|
| `google_sheet_url`, `sheet_tab` | Your topics sheet (tab `Blog Topics`). |
| `articles_per_run` | Articles per day (default 1). |
| `brand_name`, `default_audience`, `brand_voice` | Who you are, who reads it and how it should sound. |
| `language` | Article language. |
| `default_word_count` | Used when the row's *Word Count* is empty (default 1500). |
| `cta` | Call to action at the end of every article. |
| `internal_links` | Pages to link to, one per line: `Anchor text | https://…` |
| `google_drive_folder_id` | Optional. A Drive folder link or ID for the docs. |

**WordPress user?** Switch on **WordPress Draft** (<kbd>D</kbd>) and create the [WordPress credential](#accounts). Every article then also becomes a draft post.

::: tip
AI drafts are a great start, but the best-ranking articles add **your own experience**: examples, numbers, photos, opinions. Spend 10 minutes per article adding that before you publish.
:::

::: money
**Sell it:** "4 SEO articles a month" packages for local businesses, SaaS and e-commerce. You review and publish, and the AI does 90% of the writing.
:::

# 09 · Invoice & Receipt Extractor (GST-ready) {#wf09 .wf}

::: lead
Drop invoices into a **Google Drive folder**, or snap receipts with your phone through the **upload form**, and AI types everything into a clean **Google Sheet register**. It reads **PDFs (even scanned ones), JPG, PNG and WEBP**, with **built-in Indian GST checks**. It also works for VAT and sales-tax invoices worldwide.
:::

::: wfmeta
**Setup** 10 min · **Needs** Google Drive + Sheets, OpenAI · **Cost** ≈ $0.002–0.01 per document · **Runs** on every new file or upload
:::

![](screenshots/canvas/09-invoice-receipt-extractor-gst.png){.canvas}

## What it does

1. **Two ways in:** a **Google Drive folder** (checked every minute) or a **mobile-friendly upload form** (several files at once).
2. **The AI reads the document** into a strict format: vendor, buyer, GSTIN/VAT number, invoice number, dates, place of supply, taxable value, **CGST / SGST / IGST**, cess, other taxes, total, currency, **line items with HSN/SAC**, expense category and payment method.
3. **Runs accounting checks** (below) and writes one row per invoice to your **Invoice Register**, with a link to the file.
4. *Optional:* moves processed files to a "Processed" folder and writes every line item to a separate **Line Items** tab.

## Built-in GST checks 🇮🇳

- **GSTIN format and checksum.** This catches typos and misread characters.
- **State codes:** for example, `27` becomes *Maharashtra*. The vendor state and place of supply are shown in full.
- **Intra-state vs inter-state.** CGST+SGST vs IGST is checked against the place of supply.
- **Totals that don't add up** (taxable value + taxes vs. invoice total), and CGST ≠ SGST.
- **Duplicates.** The same vendor and invoice number processed before is flagged (while the workflow is published).
- **Purchase or sales.** Set `your_gstin`, and invoices you issued are marked as *Sales*.
- A **Checks** column shows ✅ or a list of warnings, plus an AI **Confidence** %.

## Setup

1. **AI: Read Invoice**: select your **OpenAI** credential.
2. **New File in Drive Folder**: connect Google Drive and **pick your Invoices folder**. Only using the form? Select the Drive trigger and press <kbd>D</kbd> to switch it off.
3. Import `Invoices.csv` (and `Line Items.csv`, if you want item-level detail) into a Google Sheet. Paste its URL in **Config**, together with your GSTIN.
4. **Save to Invoice Register**: connect Google Sheets.
5. **Publish**, then drop a PDF into the folder or open the **Upload Form** URL on your phone. 📱

## Config fields

| Field | What to put there |
|---|---|
| `google_sheet_url`, `sheet_tab` | Your register (tab `Invoices`). |
| `your_gstin` | Your own GSTIN, used for purchase/sales detection. Leave it empty if you're not in India. |
| `home_currency` | e.g. `INR`, `USD`, `EUR`. Used when the invoice doesn't state a currency. |
| `openai_model` | `gpt-4.1-mini` (default). Use `gpt-4.1` for very poor scans. |
| `processed_folder_id` | Optional. A Drive folder link or ID to move processed files into. |
| `line_items_tab` | Tab for line items (switch on **Line Item Rows** and **Save Line Items** with <kbd>D</kbd>). |

::: warning
AI extraction is very good, but not perfect. Review the rows (especially those with warnings in **Checks**) before you file returns. This workflow is a bookkeeping assistant, not tax advice.
:::

::: money
**Sell it:** accountants and CA firms (per client), small businesses, freelancers and expense-heavy teams. It saves hours of manual typing every month.
:::

# 10 · Daily AI News Digest {#wf10 .wf}

::: lead
**Every morning an AI editor** scans dozens of sources, throws out the noise and sends you a beautiful **2-minute briefing**: a TL;DR, the 7 stories that matter **to you**, why each one matters, quick hits and an insight of the day. It works for **any industry**.
:::

::: wfmeta
**Setup** 3 min · **Needs** Gmail, OpenAI · **Cost** ≈ $0.003 per digest (~$0.10/month) · **Runs** every morning at 7
:::

![](screenshots/canvas/10-daily-ai-news-digest.png){.canvas}

## What it does

1. **Every morning at 7** it builds a source list from your **RSS feeds** plus a **Google News search for each topic**.
2. **Reads all feeds.** A broken feed is skipped and the digest keeps going.
3. **Removes duplicates and old stories** (`lookback_hours`) and ranks the rest.
4. **The AI editor picks the top stories for your reader profile** and writes a headline, a 2-sentence summary and *why it matters* for each. It also writes a TL;DR, quick hits and an insight. It only uses facts from the sources.
5. **Sends a beautiful HTML email** (and optionally a Telegram message).

## Setup

1. **OpenAI Chat Model**: your OpenAI credential.
2. **Send Email Digest**: connect Gmail.
3. **Config**: your email, topics and **reader profile** (who you are and what you care about).
4. Click **Execute workflow**, check your inbox ✨ and **Publish**.

## Config fields

| Field | What to put there |
|---|---|
| `email_to`, `digest_name` | Who gets it, and what it's called. |
| `reader_profile` | **The secret sauce.** Who you are and what you care about. The AI editor picks stories for this person. |
| `news_topics` | One Google News search per line. Google search syntax works (`OR`, quotes). |
| `rss_feeds` | One feed URL per line. Remove or add any. |
| `stories_count`, `lookback_hours` | How many top stories, and how far back to look. |
| `language`, `news_language`, `news_region` | Output language, and the Google News language/region (e.g. `en` / `US`, `en` / `IN`, `de` / `DE`). |
| `accent_color` | Email accent color. |
| `telegram_chat_id` | For the optional Telegram version. |

::: tip
**Make it about any niche.** Real estate: `mortgage rates`, `housing market Austin`. E-commerce: `Shopify`, `Amazon sellers`. Healthcare, crypto, marketing, legal: just change `news_topics` and `reader_profile`. A daily digest about a client's industry is also a great **free gift** to warm up prospects.
:::

::: money
**Sell it:** branded daily or weekly briefings for associations, newsletters, investor updates and internal team briefings.
:::

# ★ BONUS · Workflow Error Alerts with AI Fix Suggestions {#bonus .wf}

::: lead
**Never miss a broken automation again.** When **any** of your workflows fails, you instantly get an email (or Telegram message) with the error, a **plain-English explanation** and **the 3 most likely fixes**, plus a button that opens the failed run.
:::

::: wfmeta
**Setup** 3 min · **Needs** Gmail, OpenAI · **Cost** ≈ $0.001 per alert · **Runs** whenever a workflow fails
:::

![](screenshots/canvas/BONUS-workflow-error-alerts.png){.canvas}

## Setup

1. **OpenAI Chat Model**: your OpenAI credential.
2. **Email Alert**: connect Gmail and put your email in **Config**.
3. **Save** the workflow. It doesn't need to be published.
4. Open **each workflow you want to protect** and go to **⋯ menu → Settings → Error workflow**. Choose *BONUS · Workflow Error Alerts…* and save. ✅

**Good to know:** if the same error repeats, you get **one alert per hour** (`quiet_minutes`). For Telegram, switch on **Telegram Alert**. To test it, break something on purpose (e.g. a wrong URL) in a published workflow and trigger it.

::: money
**Agencies:** set this up for every client. You'll often fix problems before the client notices, and that's what keeps monthly retainers alive.
:::

# Google Sheets templates 📊 {#sheets}

The `google-sheets-templates` folder has a ready-made sheet for every workflow that writes to Google Sheets. The columns are already in the right order, and some include example rows.

| Template | Used by | Tab name in Config |
|---|---|---|
| `Leads.csv` | 05 · Google Maps Lead Finder | `Leads` |
| `Leads CRM.csv` | 06 · AI Lead Qualifier | `Leads CRM` |
| `Content Calendar.csv` | 07 · Blog-to-Social Repurposer | `Content Calendar` |
| `Blog Topics.csv` | 08 · AI SEO Blog Writer (with 3 example topics) | `Blog Topics` |
| `Invoices.csv`, `Line Items.csv` | 09 · Invoice Extractor | `Invoices`, `Line Items` |
| `Chatbot Leads.csv` | 03 · AI Website Chatbot | `Chatbot Leads` (fixed) |

**How to import:**

1. Create a new Google Sheet (**sheets.new**).
2. Go to **File → Import → Upload** and choose the CSV.
3. Set the import location to **Insert new sheet(s)** and click **Import data**. The new tab gets the CSV's name.
4. Delete the empty *Sheet1*. Copy the sheet's URL from the address bar into the workflow's **Config**.

::: tip
The **tab name must match** `sheet_tab` in Config (e.g. `Leads`). If you rename a tab, change Config too. If you start with an empty sheet, the workflows create the columns themselves the first time they run.
:::

# Costs at a glance 💸 {#costs}

Typical AI costs with the default models (OpenAI pay-as-you-go, approximate):

| Workflow | Typical AI cost |
|---|---|
| 01 · AI Inbox Assistant | ≈ $0.001 per email |
| 02 · WhatsApp Bot | ≈ $0.001–0.003 per reply (voice notes ≈ +$0.006/min) |
| 03 · Website Chatbot | training ≈ $0.01 · ≈ $0.001–0.002 per answer |
| 04 · Telegram Assistant | ≈ $0.002–0.01 per request |
| 05 · Google Maps Lead Finder | ≈ $0.0005 per lead (+ Places API, see [Google Maps API key](#mapskey)) |
| 06 · Lead Qualifier | ≈ $0.002 per lead |
| 07 · Repurposer | ≈ $0.01 per article |
| 08 · SEO Blog Writer | ≈ $0.02–0.04 per article |
| 09 · Invoice Extractor | ≈ $0.002–0.01 per document |
| 10 · News Digest | ≈ $0.003 per digest |
| BONUS · Error Alerts | ≈ $0.001 per alert |

**Example:** a small business running the inbox assistant (50 emails/day), the WhatsApp bot (30 chats/day) and the daily digest spends roughly **$3–6 per month** on AI.

You also need **n8n** itself: an n8n Cloud plan, or about **$5/month** for your own server ([Self-host n8n](#selfhost)). On n8n Cloud, every workflow run counts as one *execution* towards your plan.

# Make it yours: customizing ✨ {#customize}

**Change what the AI says or does.** Every AI node has a **prompt** (the instructions) and often a **system message**. Open the node and edit the text. Keep the parts that describe the output format (the JSON fields), because the next nodes depend on them. The **AI Prompt Pack** bonus has copy-paste variations.

**Change when it runs.** Open the trigger (e.g. *Every Morning at 7*) and pick a new time or interval.

**Add a step.** Click the **+** on any connection to insert a node, such as Slack, Notion, Airtable, HubSpot, Microsoft Teams, Discord or a CRM. n8n has 500+ integrations.

**Duplicate for a client.** Open the workflow's **⋯ menu → Duplicate**, rename it, give it the client's credentials and edit its Config. You can also give each client their own n8n instance.

**Use expressions.** Fields that start with `=` contain *expressions* like `{{ $json.email }}`. They pull data from earlier nodes. Click a field and drag any value from the left panel into it.

# Swap the AI: Claude, Gemini, Groq, local models 🔄 {#swap}

The workflows use OpenAI by default, but the **chat model is plug-and-play**:

1. Click the AI node (e.g. *AI Agent*, *AI Triage & Reply*) and find the model attached underneath (*OpenAI Chat Model*).
2. Delete it, click the **+** under **Model** and pick another provider: **Anthropic (Claude)**, **Google Gemini**, **Groq**, **Mistral**, **DeepSeek**, **OpenRouter**, **Ollama** (local)…
3. Create that provider's credential and pick a model. Done.

**Tip: the zero-change trick.** Many providers offer an *OpenAI-compatible* API. Edit your **OpenAI credential**, set its **Base URL** (e.g. `https://openrouter.ai/api/v1`, `https://api.groq.com/openai/v1`, or `http://localhost:11434/v1` for Ollama) and type the provider's model name in the model field. No nodes need to change.

**What stays on OpenAI** (or needs a similar replacement):

- **Voice transcription** (02, 04), **image reading** (02, 04) and **text-to-speech** (04) use OpenAI's audio and vision endpoints.
- **Embeddings** in 03: if you switch, replace **both** embeddings nodes and re-train.
- **AI: Read Invoice** in 09 calls OpenAI directly for its strict JSON output and PDF reading.

::: tip
Smaller, cheaper models are great for 01, 06, 07 and 10. For long-form writing (08) and tricky documents (09), bigger models give noticeably better results.
:::

# Self-host n8n on your own server 🖥️ {#selfhost}

Running n8n yourself costs about **$5/month** for a small server, with unlimited workflows and executions. The `self-hosting` folder contains a production-ready setup: **n8n + automatic HTTPS** (Caddy and Let's Encrypt).

**You need:** a small Linux server (Ubuntu 24.04, 2 GB RAM, e.g. Hetzner, DigitalOcean or Vultr) and a domain or subdomain, e.g. `n8n.yourdomain.com`.

1. **Point your domain at the server.** In your DNS settings, add an **A record** for `n8n.yourdomain.com` with your server's IP address.
2. **Install Docker** on the server:

    ```bash
    curl -fsSL https://get.docker.com | sh
    ```

3. **Copy the `self-hosting` folder** to the server (e.g. with `scp -r self-hosting root@SERVER-IP:~/n8n`), then:

    ```bash
    cd ~/n8n
    cp env.example .env
    nano .env          # set DOMAIN, ACME_EMAIL, TIMEZONE, N8N_ENCRYPTION_KEY
    ```

    Create the encryption key with `openssl rand -hex 32`. **Keep it safe:** your saved credentials can't be decrypted without it.

4. **Start it:**

    ```bash
    docker compose up -d
    ```

5. Open `https://n8n.yourdomain.com` and create your owner account. 🎉

**Update n8n:** `docker compose pull && docker compose up -d`

**Back up:** your data lives in the Docker volume `n8n_data`. Back up the server (most hosts offer automatic snapshots) and keep your `.env` file somewhere safe.

::: note
On your own server, Google credentials need your own OAuth app ([Google](#google)), and WhatsApp/Telegram need the HTTPS address this setup gives you. Firewall: allow ports **80** and **443**.
:::

# Troubleshooting & FAQ 🛟 {#faq}

## Common problems

**Red ⚠️ triangles after importing.** These are normal: credentials aren't included in the files, for your security. Connect your own accounts ([Accounts & credentials](#accounts)).

**"Problem in node …" or a red node.** Open **Executions**, click the failed run and then the red node. The error message usually says exactly what's wrong. Install the **BONUS error-alert workflow** to get plain-English explanations automatically.

**OpenAI error 401** means the API key is wrong. Create a new key and update the credential. **429 / insufficient_quota** means you need to add credit at platform.openai.com. **429 rate limit** means you hit your account's speed limit. Wait a minute, or lower how many items run at once.

**Google error "invalid_grant" / "Token has been expired or revoked".** Reconnect the credential. If you're self-hosted, **publish your OAuth app** ([Google](#google)) so it doesn't happen again after 7 days.

**A form, webhook or chat URL gives "404 / not registered".** Use the **Production URL** and make sure the workflow is **published/active**. The Test URL only works while you're testing in the editor.

**Telegram or WhatsApp stopped reacting after you tested.** **Re-publish** the workflow. Testing temporarily moves the bot's webhook to the test URL.

**Schedules run at the wrong time.** Set the time zone in the workflow settings (**⋯ → Settings → Timezone**).

**"Sheet … not found" / columns don't match.** The tab name must match `sheet_tab` in Config, and the first row must hold the column headers. Use the templates.

**The workflow imported, but some nodes show "?" / unknown.** Your n8n is too old. Update to **n8n 1.100 or newer** (or n8n 2.x).

## FAQ

**Do I need to know how to code?** No. You connect accounts and fill in the Config node. If you want to go further, every Code node is commented.

**Which n8n version do I need?** n8n **1.100 or newer**, including all **2.x** versions. Every workflow was tested on n8n 2.x.

**Does it work on n8n Cloud and on self-hosted n8n?** Yes, both.

**Can I use Claude, Gemini or a local model instead of OpenAI?** Yes, see [Swap the AI](#swap).

**Can I set these up for my clients and charge for it?** Yes. That's what the license allows ([License](#license)) and what the **Agency Playbook** bonus is about.

**Is my data safe?** Your workflows run in **your** n8n. Data only goes to the services you connect (Google, Meta, Telegram) and to the AI provider. OpenAI states that API data is not used to train its models by default.

**Will you update the pack?** Yes. Updates are free: download the latest version from your Gumroad library.

# License, support & disclaimer {#license}

## License: what you can do

✅ Use the workflows in **your own business**, without limits.
✅ Set them up for **clients** and charge for your work (setup, customization, maintenance).
✅ Modify, translate and combine them with your own workflows.

❌ Don't **resell or give away the pack or the workflow files** themselves, as they are or lightly changed (e.g. as a template pack, on a marketplace, in a course download or a free giveaway).
❌ Don't share your download link.

The full text is in `LICENSE.txt`.

## Support

Questions or problems? Reply to your **Gumroad receipt email** or contact the seller through Gumroad. Include the workflow name, your n8n version (Cloud or self-hosted) and a screenshot of the error.

## Disclaimer

The workflows are provided "as is". AI can make mistakes, so review important outputs such as emails to clients, invoices and articles. You're responsible for using the workflows in line with the law and with the terms of the services you connect (privacy and anti-spam laws, Meta/WhatsApp, Google and OpenAI policies). Prices of third-party services mentioned in this guide are approximate and can change.

::: success
**Thank you, and happy automating!** 🚀 If the pack helps you, a short review on Gumroad means the world and helps other people find it.
:::
