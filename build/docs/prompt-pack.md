---
title: "AI Prompt Pack"
subtitle: "Copy-paste presets for every workflow"
tagline: "Industry-ready Config values, prompt add-ons and tone presets that make the AI sound like you"
version: "Bonus · Version 1.0"
cover_images:
  - "screenshots/canvas/02-whatsapp-ai-auto-reply-bot.png"
  - "screenshots/canvas/07-blog-to-social-repurposer.png"
---

# How to use this pack {#how}

Every workflow has a ✏️ **Config** node. Most of what the AI says comes from a few of its text fields: your business info, your tone and your goal. This pack gives you **ready-made text for those fields**, for many industries.

1. Find your workflow and your industry below.
2. Copy the text and replace everything in **[brackets]**.
3. Paste it into the field named in the heading (e.g. `business_info`) in the Config node.
4. Test with real questions and adjust.

::: tip
**The golden rule:** the AI is only as good as the information you give it. Specific facts (prices, hours, policies, examples) beat clever wording every time. If customers ask it, it belongs in the text.
:::

## Universal add-ons

Add these lines to any Config text field or system prompt when you need them.

**Stay factual**

```text
Only use the information above. If the answer isn't there, say you're not sure
and offer to connect the customer with a person. Never invent prices, dates,
availability, discounts or policies.
```

**Short, phone-friendly answers**

```text
Keep answers under 60 words unless the customer asks for detail. Use short
paragraphs or a short list. One question at a time.
```

**Collect contact details**

```text
When someone shows interest (price questions, availability, "how do I start"),
ask for their name and the best phone number or email so the team can follow up.
```

**Sensitive topics (health, legal, money)**

```text
Never give medical, legal or financial advice. For anything about a personal
situation, recommend booking a consultation with a qualified professional.
```

**Language**

```text
Reply in the language the customer writes in. If they mix languages
(e.g. Hinglish), reply in the same mix.
```

# 01 · Inbox assistant presets {#inbox}

## `writing_style`

- **Friendly professional:** *Friendly, concise and professional. Short paragraphs. No fluff, no corporate jargon.*
- **Formal:** *Polite and formal. Complete sentences. No contractions, no emojis.*
- **Direct founder:** *Very short and direct, 2–4 sentences. Clear next step. Warm but no small talk.*
- **Indian business English:** *Courteous and clear business English as used in India. Respectful greetings, concise points, a clear next step.*

## `about_you` examples

- *Founder of [Company], a [type of business] serving [customers] in [region]. Key clients: [names]. I care most about emails from clients, leads and my team.*
- *Real-estate agent in [city]. Leads come from [portals]. Urgent means: offers, viewings within 48h, contracts.*

## Custom categories

Edit the category list in **AI Triage & Reply** and **Triage Format** to match your work, for example:

```text
Urgent, Client, Lead, Supplier, Finance, Recruiting, Meeting, Newsletter, Notification, Spam, Other
```

# 02 · WhatsApp bot: `business_info` presets {#whatsapp}

Paste into `business_info`. Put the most-asked questions first.

## Salon / spa

```text
WHAT WE DO: [Hair, beauty and spa salon] in [area, city].
SERVICES & PRICES:
• Women's haircut [₹/$ price] · Men's haircut [price] · Kids' haircut [price]
• Hair colour from [price] · Highlights from [price] · Keratin from [price]
• Facial [price] · Manicure [price] · Pedicure [price] · Waxing from [price]
• Bridal packages from [price] (free consultation)
OPENING HOURS: [Tue–Sun 10:00–20:00, closed Monday]
ADDRESS: [full address] · Google Maps: [link] · Parking: [details]
BOOKING: [booking link] or reply with the service, date and time you'd like.
POLICIES: Please arrive 5 minutes early. Cancel at least [24] hours ahead.
Payment: [cash, cards, UPI].
FAQ:
• Walk-ins? [Yes, when a stylist is free. Booking is recommended on weekends.]
• Products used? [brands]
```

## Dental / medical clinic

```text
WHAT WE DO: [Family dental clinic] in [area, city]. Dr [name] ([qualifications]).
TREATMENTS & PRICES (starting prices; the exact cost is given after a check-up):
• Consultation [price] · Cleaning & polishing [price] · Fillings from [price]
• Root canal from [price] · Crowns from [price] · Braces/aligners from [price]
• Teeth whitening [price] · Kids' dentistry [details]
HOURS: [Mon–Sat 9:00–13:00 and 17:00–21:00]
ADDRESS: [address] · Maps: [link]
APPOINTMENTS: [booking link / phone]. Emergencies: call [phone] right away.
INSURANCE / PAYMENT: [accepted insurers, EMI options, UPI/cards]
RULE: Never diagnose. For pain, swelling or bleeding, ask the patient to call
[phone] or book the earliest appointment.
```

## Restaurant / café

```text
WHAT WE ARE: [Name], a [cuisine] restaurant in [area]. [Veg/non-veg, Jain options, vegan options]
MENU HIGHLIGHTS: [dish – price], [dish – price], [dish – price]. Full menu: [link]
HOURS: [Mon–Sun 12:00–23:00, kitchen closes 22:30]
RESERVATIONS: [link / phone]. Groups over [8]: call us.
DELIVERY: [Swiggy/Zomato/Uber Eats links] · Takeaway: call [phone]
PARTIES & EVENTS: [private room for up to 30, set menus from price per person]
ALLERGIES: We can adapt many dishes; tell us your allergy when you order.
```

## Real-estate agency

```text
WHO WE ARE: [Agency], helping people buy, sell and rent homes in [areas] since [year].
SERVICES: buying, selling (valuation free), renting, property management, home loans help.
CURRENT LISTINGS: [link]. Popular areas: [area 1], [area 2], [area 3].
PROCESS: 1) Tell us your budget, area and must-haves 2) We shortlist within 24h
3) Viewings [days/times] 4) We handle paperwork and negotiation.
FEES: [buyer/seller commission or "ask us"]
CONTACT: [agent name, phone], office hours [hours].
RULE: Ask every buyer for budget, preferred area, timeline and whether they have a
home-loan approval, then offer a call with an agent.
```

## Gym / fitness studio

```text
WHO WE ARE: [Name] gym in [area]. [Strength, cardio, classes, personal training]
MEMBERSHIP: Monthly [price] · Quarterly [price] · Yearly [price] · Day pass [price]
CLASSES: [Yoga Mon/Wed 7am, HIIT Tue/Thu 7pm, Zumba Sat 9am]; timetable: [link]
PERSONAL TRAINING: from [price] per session; free body assessment for new members.
HOURS: [Mon–Sat 5:30–22:30, Sun 7:00–12:00]
TRIAL: [Free 1-day trial; bring ID]
```

## Online store

```text
WE SELL: [products] at [store link].
SHIPPING: [free above price]; delivery in [2–5] working days; tracking by [email/SMS].
RETURNS: [7/30]-day returns for unused items; how: [link/steps].
PAYMENT: [cards, UPI, COD, PayPal]
SIZE GUIDE: [link] · Stock questions: share the product link or name.
ORDER HELP: For order status, ask for the order number and the email used.
DISCOUNTS: [current offer] (never invent other discount codes).
```

## Coaching / tuition institute

```text
WHO WE ARE: [Institute] in [area]. Courses: [list with grade/exam].
BATCHES & FEES: [course – timing – fee], [course – timing – fee]
DEMO CLASS: free; book at [link] or reply with the student's name and grade.
RESULTS: [results you can prove]
ADDRESS & HOURS: [details]
```

## `bot_personality` presets

- **Warm & friendly:** *Warm, friendly and professional. Short messages. Uses the customer's first name. Max 1–2 emojis per message.*
- **Premium:** *Polite, calm and elegant. No emojis. Complete sentences. Makes the customer feel looked after.*
- **Young & casual:** *Casual and upbeat, like a helpful friend. Short messages, a few emojis, never pushy.*
- **Clinic:** *Reassuring, clear and professional. Simple words. Never alarming. No emojis.*

# 03 · Website chatbot presets {#chatbot}

## `bot_goal`

- **Book a call:** *Help visitors find the right service and book a free 20-minute call at [link]. After answering 1–2 questions, offer the call.*
- **Get a quote:** *Understand what the visitor needs (size, location, deadline) and invite them to request a quote at [link], or ask for their name and email.*
- **E-commerce:** *Help visitors pick the right product, answer shipping and returns questions and link directly to product pages.*
- **Clinic:** *Answer questions about treatments, prices and timings, and help visitors book at [link]. Never diagnose.*
- **SaaS:** *Explain features and plans, suggest the best plan for the visitor's use case and link to the free trial at [link].*

## `extra_knowledge` starter

```text
Opening hours: [hours]. Response time for emails: [within 24 hours].
Service area: [cities/areas]. We do NOT offer: [things people often ask about].
Pricing: [summary or "custom quotes; typical projects cost X–Y"].
Payment: [methods]. Guarantee/refund: [policy].
Most common questions:
Q: [question] – A: [answer]
Q: [question] – A: [answer]
```

# 05 · Lead finder presets {#leadfinder}

## `your_offer`

- **Web design:** *We redesign slow, outdated websites into fast, mobile-friendly sites that turn visitors into bookings. Launch in 14 days.*
- **AI automation:** *We set up AI assistants that answer WhatsApp and website enquiries 24/7 and follow up with every lead in under a minute.*
- **Local SEO:** *We get local businesses into Google's top-3 map results with review campaigns and Google Business Profile optimisation.*
- **Social media:** *We run your Instagram and Facebook: 12 posts and 8 reels a month, made from your photos.*
- **Bookkeeping:** *Monthly bookkeeping and GST filing for small businesses, with a fixed fee and a dedicated accountant.*

## `opener_style`

- **Helpful observer (default):** *Casual, specific and helpful. Sounds like a real person, not a template. No hype.*
- **Compliment-first:** *Start with a genuine, specific compliment from the data (rating, reviews, years in business), then one short observation about an opportunity.*
- **Question-led:** *Open with a short, specific question about something in their data that suggests a gap (e.g. no online booking). No pitch in the first line.*

# 06 · Lead qualifier presets {#qualifier}

## `what_you_sell` + `ideal_customer`

**Agency**

```text
what_you_sell: Done-for-you [service] for [type of business]. Projects typically
[price range]; monthly plans from [price].
ideal_customer: [Industry] businesses with [size/revenue] in [region] that already
get leads online and want to [outcome].
```

**Home services**

```text
what_you_sell: [Roof repairs/HVAC/plumbing] for homes in [areas]. Typical jobs
[price range]. Free on-site quotes within 48 hours.
ideal_customer: Homeowners in [areas] with a clear job, a timeline within 4 weeks
and a realistic budget.
```

**Coach / consultant**

```text
what_you_sell: 1:1 coaching for [who] who want [outcome]. 3-month programme [price].
ideal_customer: [Role] at [type of company], motivated, with budget and a clear goal.
```

## `reply_style`

- *Warm, confident and concise. Sounds like a real person, not a robot. No buzzwords.*
- *Premium and calm. Thank them, confirm what they need in one sentence, invite them to book.*
- *Energetic and fast. Short sentences, enthusiasm, clear call to action.*

# 07 · Repurposer presets {#repurposer}

## `brand_voice`

- **Expert educator:** *Clear, practical and generous. Teaches one idea at a time with concrete examples.*
- **Bold founder:** *Opinionated, punchy and honest. Short sentences. Takes a clear position.*
- **Friendly local business:** *Warm, community-focused and down-to-earth. Talks like a neighbour.*
- **Corporate B2B:** *Professional, insight-driven and credible. Uses data when available. No slang.*

## "Extra instructions" ideas (form field)

- *Make the LinkedIn post a contrarian take on the article's main point.*
- *Use a personal story hook: "Last week a client asked me…"*
- *Focus all posts on tip #3 and mention our webinar on Friday at 6pm.*
- *Write for beginners. Avoid all jargon.*
- *Add a question at the end of every post to drive comments.*

# 08 · SEO writer presets {#seo}

## Find 50 topics in 2 minutes

Paste this into ChatGPT or Claude, then copy the result into your *Blog Topics* sheet:

```text
You are an SEO strategist. My business: [what you do] for [audience] in [location].
List 50 blog topics my ideal customers search for, as a table with these columns:
Topic | Primary Keyword | Audience | Notes | Word Count
Mix: 20 "how to" guides, 10 comparisons ("X vs Y"), 10 cost/price questions,
5 checklists, 5 local topics. Word Count between 1,200 and 2,000.
```

## `internal_links` format

```text
Pricing | https://yoursite.com/pricing
Free consultation | https://yoursite.com/contact
Case studies | https://yoursite.com/case-studies
```

## `brand_voice`

- *Clear, practical and friendly. Short sentences, real examples, no fluff.*
- *Authoritative and data-driven. Cite numbers, explain trade-offs and give a recommendation.*
- *Conversational expert. Writes like explaining to a smart friend over coffee.*

# 10 · News digest presets {#digest}

Paste into `reader_profile` and `news_topics` (one search per line).

| Industry | `reader_profile` | `news_topics` |
|---|---|---|
| Real estate | Real-estate agent in [city]. Wants market moves, mortgage rates, regulation and proptech tools. | `housing market [city]`, `mortgage rates`, `real estate regulation [country]` |
| E-commerce | Founder of an online store. Wants marketplace changes, ads costs, shipping and new tools. | `Shopify`, `Amazon sellers`, `ecommerce trends` |
| Marketing | Agency owner. Wants platform updates (Google, Meta, LinkedIn), AI marketing tools and case studies. | `Google Ads update`, `Meta ads`, `AI marketing tools` |
| Healthcare | Clinic owner. Wants regulation, technology and practice-management news. Not clinical research. | `healthcare regulation [country]`, `clinic management`, `health tech` |
| Finance & tax (India) | Chartered accountant. Wants GST, income-tax and compliance updates with deadlines. | `GST council`, `CBDT circular`, `income tax deadline India` |
| Crypto | Investor. Wants regulation, major launches and security incidents. No price predictions. | `crypto regulation`, `Bitcoin ETF`, `Ethereum upgrade` |
| Legal tech | Lawyer at a small firm. Wants AI tools for lawyers, regulation and court technology. | `legal tech`, `AI for lawyers`, `law firm software` |

# Prompt-writing cheat sheet 🧠 {#cheatsheet}

When you edit any AI node's prompt or system message:

1. **Role:** *"You are a [role] for [business]."*
2. **Goal:** what a great result looks like, in one sentence.
3. **Facts:** the information it may use (and only that).
4. **Rules:** tone, length, language and what it must never do.
5. **Format:** keep the existing output fields exactly as they are, because the next nodes depend on them.
6. **Examples:** one good example answer improves quality more than ten adjectives.

::: warning
**Don't rename output fields.** Nodes like *Triage Format* or *Lead Format* define the exact fields (e.g. `category`, `lead_score`) that the following nodes read. Change the wording of the instructions freely, but keep the field names.
:::

::: success
**Test like a customer.** After any change, try 5 real questions: an easy one, a tricky one, one in another language, one off-topic and one rude one. Adjust, then publish. ✨
:::
