# Client Finder Agent

n8n workflows that find local businesses on Google Maps, check each one for a problem you can fix
(missing or slow website, broken SSL, no online booking, weak reviews...), score them, write a short
evidence-based pitch with Claude, save everything to a Google Sheet CRM and create Gmail **drafts**.
Sold on Gumroad in three tiers:

| Tier | Price | Download |
|---|---|---|
| **Lite** | free (lead magnet) | `dist/Client-Finder-Lite-v1.0.0.zip` |
| **Starter** | $49 | `dist/Client-Finder-Starter-v1.0.0.zip` |
| **Pro** | $99 | `dist/Client-Finder-Pro-v1.0.0.zip` |

Gumroad listing copy, launch posts and cover images are in `marketing/`.

## Before you upload: set your details

Edit `config/product.json` (your name, store link, support email), then rebuild everything:

```bash
npm install
npm run build              # workflow JSON → products/
python3 scripts/make-crm.py products/shared/Client-Finder-CRM.xlsx
npm run docs               # Markdown guides → PDFs in products/
npm run package            # zips → dist/
```

`storeUrl` appears in the Lite workflow's notes and its results page, and in the guides. `supportEmail` and `sellerName` appear in the guides and the license.

## What's where

```
config/product.json        name, version, store link, support email
src/lib/                   all workflow logic (plain JS, embedded into n8n Code nodes at build time)
src/niches/                the 5 niche packs (which checks count, points, pitch angle, default offer)
src/workflows/             builders that generate the n8n workflow JSON
docs/                      guide sources (Markdown) + screenshots; docs/FACTS.md is the source of truth
products/                  generated files that go into the zips (workflows, PDFs, CRM template)
dist/                      the three Gumroad zips
marketing/                 Gumroad listing copy, launch posts, cover and thumbnail images
scripts/                   build, docs, CRM template, screenshots, covers, packaging
tests/                     unit, structure and end-to-end tests
```

## Tests

```bash
npm test                   # 74 unit tests + build check + 21 structure tests (no n8n needed)
N8N_MODULES=/path/to/n8n/node_modules npm run test:structure   # + checks every node/parameter against a real n8n
N8N_BIN=/path/to/n8n/node_modules/.bin/n8n npm run test:e2e    # runs every workflow inside a real n8n
```

The end-to-end test starts a real n8n, imports every product workflow exactly as shipped, adds
credentials and submits the real forms. Google Maps, PageSpeed, Google Sheets, Gmail, Claude and 14 fake
business websites are replaced by local mock servers that validate each request like the real APIs.
Nothing leaves the machine. It needs `openssl` and permission to listen on ports 80/443.
13 scenarios cover the Lite CSV download, error pages (Google API off, no results, unset Settings,
a sheet without a "Leads" tab), the full Starter run (scoring, the second check of failing sites,
PageSpeed confirming a certificate error, pitches, the AI retry, the sheet saved before the Gmail
drafts, a refused draft), re-runs without duplicates, all 5 Pro niches and the Follow-up Autopilot
(sent/reply detection incl. replies from another address in the thread and deleted replies, bounces,
opt-outs on another row, duplicated rows, threaded drafts with an opt-out line, no duplicate
follow-ups). They pass on **n8n 1.123.83** (Node 22) and **n8n 2.42.3** (Node 24).

`tests/unit/review-fixes.test.js` holds a regression test for every finding of the code review
(false claims, wrong recipients, follow-up edge cases, slow regexes on hostile pages...).

Screenshots in `docs/img` come from `scripts/screenshots.js`, which runs the same setup and captures
the real n8n editor and form pages.
