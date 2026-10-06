# n8n AI Agent Starter Pack

Source for a Gumroad product: **10 ready-to-run n8n AI workflows + a bonus**, with a setup guide, two bonus PDFs, Google Sheets templates, a website chat widget and a self-hosting kit.

| What | Where |
|---|---|
| **The product ZIP** (upload this to Gumroad) | `dist/n8n-AI-Agent-Starter-Pack-v1.0.zip` |
| Gumroad listing copy, launch plan, listing images | `seller-kit/` |
| Workflow files (generated) | `product/workflows/` |
| Sheets templates, chat widget, self-hosting, README/LICENSE for buyers | `product/` |
| Workflow generator (one Python module per workflow) | `build/workflows/`, `build/code/`, `build/lib/n8n.py` |
| Guide + bonus PDFs (markdown sources) | `build/docs/` |
| End-to-end tests (local n8n + mock OpenAI) | `tests/` |

## The workflows

| # | Workflow |
|---|---|
| 01 | AI Inbox Assistant: email triage, Gmail labels, draft replies |
| 02 | WhatsApp AI Auto-Reply Bot: text, voice notes, photos |
| 03 | AI Website Chatbot: trained on your website, lead capture |
| 04 | Telegram AI Personal Assistant: calendar, Gmail, tasks, voice |
| 05 | Google Maps Lead Finder: leads, emails, score, AI opener |
| 06 | AI Lead Qualifier & Instant Reply: 0–100 score, reply in 60 s |
| 07 | Blog-to-Social Repurposer: 1 article → 9 posts |
| 08 | AI SEO Blog Writer: Sheets topics → Google Docs |
| 09 | Invoice & Receipt Extractor: GST-ready Sheets register |
| 10 | Daily AI News Digest: personal AI editor |
| ★ | BONUS Error Alerts: failures explained + AI fix suggestions |

Compatible with n8n 1.100+ and 2.x (n8n Cloud or self-hosted).

## Rebuild everything

```bash
python3 build/build_workflows.py      # workflows -> product/workflows
python3 build/build_templates.py      # Sheets CSVs, checked against the workflows
python3 build/build_docs.py           # guide + bonus PDFs -> dist/docs
python3 build/build_seller_kit.py     # Gumroad images -> seller-kit/images
python3 build/package.py              # all of the above + ZIP + verification
python3 build/check_layout.py         # no overlapping nodes or notes on the canvas
```

Needs Python 3 with Pillow, pandoc, poppler-utils (`pdftotext`, `pdftoppm`, `pdfinfo`) and Node 18+ with Playwright/Chromium. The tests and screenshots also need a local n8n on `localhost:5678`:

```bash
bash tests/restart-mock.sh            # mock OpenAI API on :9999
NODE=node bash tests/run-all.sh       # 15 end-to-end cases
node tests/ui-import.js --crop        # import via the editor UI + canvas screenshots
node tests/chat-demo.js               # hosted chat + embedded widget screenshots
```

The tests run every workflow inside a real n8n with simulated OpenAI, Google, Meta and Telegram responses. Before launch, run a few workflows once with real accounts too.
