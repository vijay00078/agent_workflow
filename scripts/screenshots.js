#!/usr/bin/env node
// Captures the documentation screenshots (docs/img/*.png) from a real n8n instance running the product
// workflows against the e2e mocks, so every image matches the shipped workflows exactly.
//   N8N_BIN=/path/to/.bin/n8n N8N_NODE=/path/to/node node scripts/screenshots.js
// Needs the same things as the e2e test (openssl, ports 80/443) plus Chromium.

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright-core');
const { makeCerts } = require('../tests/e2e/certs');
const { Mocks, KEYS, API_HOSTS, siteHosts } = require('../tests/e2e/mocks');
const { outputs } = require('./build');
const { LEAD_COLUMNS } = require('../src/lib/sheet');

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'docs', 'img');
const N8N_JS = fs.realpathSync(process.env.N8N_BIN);
const NODE_BIN = process.env.N8N_NODE || process.execPath;
const PORT = 5711;
const BASE = `http://localhost:${PORT}`;
const WORK = path.join(ROOT, '.e2e', 'screenshots');
const SHEET_ID = '1SCREENSHOTsheet000000000000000000000000';
const OWNER = { email: 'owner@clientfinder.test', firstName: 'Asha', lastName: 'Rao', password: 'Screenshots-2026!' };

function chromiumPath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const d of fs.readdirSync(base).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
    const p = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function env(home) {
  const hosts = [...API_HOSTS, ...siteHosts()];
  const certs = makeCerts(path.join(ROOT, '.e2e', 'certs'), hosts);
  const bundle = path.join(ROOT, '.e2e', 'certs', 'bundle.pem');
  const existing = process.env.NODE_EXTRA_CA_CERTS && fs.existsSync(process.env.NODE_EXTRA_CA_CERTS) ? fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS, 'utf8') : '';
  fs.writeFileSync(bundle, existing + '\n' + fs.readFileSync(certs.ca, 'utf8'));
  const noProxy = [process.env.NO_PROXY || '', 'localhost', '127.0.0.1', '.googleapis.com', 'api.anthropic.com', '.test'].join(',');
  return {
    certs,
    vars: Object.assign({}, process.env, {
      PATH: `${path.dirname(NODE_BIN)}:${process.env.PATH}`,
      N8N_USER_FOLDER: home,
      N8N_ENCRYPTION_KEY: 'screenshots-key',
      N8N_PORT: String(PORT),
      N8N_LISTEN_ADDRESS: '127.0.0.1',
      N8N_HOST: 'localhost',
      WEBHOOK_URL: `${BASE}/`,
      N8N_RUNNERS_BROKER_PORT: String(PORT + 100),
      N8N_SECURE_COOKIE: 'false',
      N8N_DIAGNOSTICS_ENABLED: 'false',
      N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
      N8N_TEMPLATES_ENABLED: 'false',
      N8N_PERSONALIZATION_ENABLED: 'false',
      N8N_HIRING_BANNER_ENABLED: 'false',
      N8N_LOG_LEVEL: 'warn',
      GENERIC_TIMEZONE: 'UTC',
      NODE_EXTRA_CA_CERTS: bundle,
      NODE_OPTIONS: `--require ${path.join(ROOT, 'tests', 'e2e', 'dns-preload.js')}`,
      E2E_MOCK_HOSTS: hosts.join(','),
      NO_PROXY: noProxy,
      no_proxy: noProxy,
    }),
  };
}

function cli(vars, args) {
  const r = spawnSync(NODE_BIN, [N8N_JS, ...args], { env: vars, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`n8n ${args.join(' ')}: ${r.stderr.slice(-1500)}`);
}

const CREDS = [
  { id: 'shotGoogleKey01', name: 'Google API Key', type: 'httpHeaderAuth', data: { name: 'X-Goog-Api-Key', value: KEYS.google } },
  { id: 'shotAnthropic01', name: 'Anthropic API Key', type: 'httpHeaderAuth', data: { name: 'x-api-key', value: KEYS.anthropic } },
  { id: 'shotSheets00001', name: 'Google Sheets account', type: 'googleSheetsOAuth2Api', data: { clientId: 'x', clientSecret: 'y', oauthTokenData: { access_token: KEYS.oauth, token_type: 'Bearer', expires_in: 3599 } } },
  { id: 'shotGmail000001', name: 'Gmail account', type: 'gmailOAuth2', data: { clientId: 'x', clientSecret: 'y', oauthTokenData: { access_token: KEYS.oauth, token_type: 'Bearer', expires_in: 3599 } } },
];

function personalize(wf, id) {
  const w = JSON.parse(JSON.stringify(wf));
  w.id = id;
  for (const n of w.nodes) {
    if (n.type === 'n8n-nodes-base.httpRequest' && n.parameters.genericAuthType) n.credentials = { httpHeaderAuth: /Claude/.test(n.name) ? { id: CREDS[1].id, name: CREDS[1].name } : { id: CREDS[0].id, name: CREDS[0].name } };
    if (n.type === 'n8n-nodes-base.googleSheets') n.credentials = { googleSheetsOAuth2Api: { id: CREDS[2].id, name: CREDS[2].name } };
    if (n.type === 'n8n-nodes-base.gmail') n.credentials = { gmailOAuth2: { id: CREDS[3].id, name: CREDS[3].name } };
    if (n.name === '⚙️ Settings') {
      for (const a of n.parameters.assignments.assignments) {
        if (a.name === 'yourName') a.value = 'Asha Rao';
        if (a.name === 'yourBusinessName') a.value = 'Pixel & Pine Studio';
        if (a.name === 'yourWebsite') a.value = 'pixelpine.studio';
        if (a.name === 'googleSheetUrl') a.value = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
      }
    }
  }
  return w;
}

async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await fn()) return true;
    } catch (e) {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('timed out');
}

async function shoot(page, name, opts = {}) {
  const file = path.join(IMG, `${name}.png`);
  if (opts.locator) await opts.locator.screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: Boolean(opts.fullPage) });
  console.log(`wrote docs/img/${name}.png`);
}

async function dismissPopups(page) {
  for (const label of ['Got it', 'Close', 'Skip', 'Dismiss', 'Not now', 'Maybe later']) {
    const b = page.getByRole('button', { name: label });
    if (await b.count().catch(() => 0)) await b.first().click({ timeout: 1000 }).catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
}

// Hides n8n's floating helper panels (e.g. "Production Checklist") so they don't cover the screenshot.
async function hideOverlays(page) {
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const t = (el.textContent || '').trim();
      if (!/^(Production Checklist)/.test(t) || el.children.length > 20) continue;
      let node = el;
      while (node && node.parentElement && node.parentElement !== document.body) {
        const pos = getComputedStyle(node).position;
        if ((pos === 'fixed' || pos === 'absolute') && node.getBoundingClientRect().width < 700) break;
        node = node.parentElement;
      }
      if (node && node !== document.body) node.style.display = 'none';
    }
  });
}

async function openCanvas(page, id) {
  await page.goto(`${BASE}/workflow/${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.vue-flow__node', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await dismissPopups(page);
  await page.locator('.vue-flow__pane, .vue-flow').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('1').catch(() => {}); // zoom to fit
  await page.waitForTimeout(1200);
  await hideOverlays(page);
}

async function htmlCard(browser, name, html, size) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  await shoot(page, name, { locator: page.locator('#card') });
  await page.close();
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function main() {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(IMG, { recursive: true });
  const home = path.join(WORK, 'home');
  const { certs, vars } = env(home);
  const mocks = new Mocks(certs);
  await mocks.start();
  mocks.sheets.create(SHEET_ID, { Leads: [LEAD_COLUMNS] });
  fs.writeFileSync(path.join(WORK, 'creds.json'), JSON.stringify(CREDS));
  cli(vars, ['import:credentials', `--input=${path.join(WORK, 'creds.json')}`]);
  const files = outputs();
  const wfs = { shotLite: 'lite/client-finder-lite.json', shotWeb: 'starter/client-finder-web-design.json', shotFollow: 'pro/workflows/follow-up-autopilot.json' };
  const version = spawnSync(NODE_BIN, [N8N_JS, '--version'], { env: vars, encoding: 'utf8' }).stdout.trim().split('\n').pop();
  for (const [id, rel] of Object.entries(wfs)) {
    const f = path.join(WORK, `${id}.json`);
    fs.writeFileSync(f, JSON.stringify(personalize(JSON.parse(files[rel]), id)));
    cli(vars, ['import:workflow', `--input=${f}`]);
    if (id !== 'shotFollow') cli(vars, Number(version.split('.')[0]) >= 2 ? ['publish:workflow', `--id=${id}`] : ['update:workflow', `--id=${id}`, '--active=true']);
  }
  const server = spawn(NODE_BIN, [N8N_JS, 'start'], { env: vars, stdio: ['ignore', fs.openSync(path.join(WORK, 'n8n.log'), 'a'), fs.openSync(path.join(WORK, 'n8n.log'), 'a')] });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  try {
    await waitFor(async () => (await fetch(`${BASE}/healthz`)).status === 200, 120000);
    await waitFor(async () => (await fetch(`${BASE}/form/client-finder-web-design`)).status === 200, 60000);
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
    const setup = await ctx.request.post(`${BASE}/rest/owner/setup`, { data: OWNER });
    if (!setup.ok()) throw new Error(`owner setup failed: ${setup.status()} ${await setup.text()}`);
    const page = await ctx.newPage();

    // The free Lite form.
    await page.goto(`${BASE}/form/client-finder-lite`, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('e.g. dentists').fill('dentists');
    await page.getByPlaceholder('e.g. Austin, TX').fill('Austin, TX');
    await page.locator('select').first().selectOption('60');
    await shoot(page, 'lite-form', { locator: page.locator('.container').first() });

    // Public form + a real run against the mocks → results page.
    await page.goto(`${BASE}/form/client-finder-web-design`, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('e.g. dentists').fill('dentists');
    await page.getByPlaceholder('e.g. Austin, TX').fill('Austin, TX');
    await page.locator('select').first().selectOption('40');
    await page.waitForTimeout(300);
    await shoot(page, 'form', { locator: page.locator('.container').first() });
    await page.getByRole('button', { name: 'Find clients' }).click();
    await page.waitForSelector('text=Done:', { timeout: 240000 });
    await page.waitForTimeout(800);
    await shoot(page, 'results-page', { locator: page.locator('.container').first() });

    // Editor screenshots (each one is independent: a failure is reported and the rest continue).
    const tryShot = async (name, fn) => {
      try {
        await fn();
      } catch (e) {
        console.log(`could not capture ${name}: ${e.message.split('\n')[0]}`);
      }
    };
    await tryShot('canvas-web-design', async () => {
      await openCanvas(page, 'shotWeb');
      await shoot(page, 'canvas-web-design');
    });
    await tryShot('lite-canvas', async () => {
      await openCanvas(page, 'shotLite');
      await shoot(page, 'lite-canvas');
    });
    await tryShot('followup-canvas', async () => {
      await openCanvas(page, 'shotFollow');
      await shoot(page, 'followup-canvas');
    });
    await tryShot('settings-node', async () => {
      const settingsId = JSON.parse(files['starter/client-finder-web-design.json']).nodes.find((n) => n.name === '⚙️ Settings').id;
      await page.goto(`${BASE}/workflow/shotWeb/${settingsId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      await dismissPopups(page).catch(() => {});
      await page.goto(`${BASE}/workflow/shotWeb/${settingsId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      await hideOverlays(page);
      await page.waitForTimeout(300);
      await shoot(page, 'settings-node');
    });
    await tryShot('credential-header-auth', async () => {
      await page.goto(`${BASE}/home/credentials/${CREDS[0].id}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      const dialogs = page.locator('.el-dialog:visible, [role="dialog"]:visible');
      if (await dialogs.count()) await shoot(page, 'credential-header-auth', { locator: dialogs.first() });
      else await shoot(page, 'credential-header-auth');
    });
    await ctx.close();

    // Example data cards from the run above.
    const rows = mocks.sheets.objects(SHEET_ID, 'Leads').slice(0, 9);
    const cols = ['Business', 'Score', 'Priority', 'Problems', 'Email', 'Status'];
    const pill = (p) => `<span class="pill ${p.toLowerCase()}">${esc(p)}</span>`;
    await htmlCard(
      browser,
      'sheet-example',
      `<html><head><style>
        body{margin:0;font-family:Inter,Arial,sans-serif;background:#F3F4F6}
        #card{display:inline-block;margin:24px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(17,24,39,.08)}
        .bar{background:#1F2937;color:#fff;padding:10px 16px;font-size:13px;display:flex;justify-content:space-between}
        table{border-collapse:collapse;font-size:12.5px}
        th{background:#111827;color:#fff;text-align:left;padding:8px 10px;font-weight:600}
        td{padding:8px 10px;border-bottom:1px solid #F1F5F9;vertical-align:top;max-width:340px}
        td.n{text-align:right;font-variant-numeric:tabular-nums}
        .pill{padding:2px 8px;border-radius:999px;font-weight:600;font-size:11.5px}
        .hot{background:#FEE2E2;color:#B91C1C}.warm{background:#FEF3C7;color:#92400E}.low,.none{background:#F3F4F6;color:#374151}
      </style></head><body><div id="card"><div class="bar"><span>Leads (example data)</span><span>dentists in Austin, TX</span></div><table><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>${rows
        .map((r) => `<tr><td><b>${esc(r.Business)}</b></td><td class="n">${esc(r.Score)}</td><td>${pill(r.Priority || 'None')}</td><td>${esc(r.Problems)}</td><td>${esc(r.Email)}</td><td>${esc(r.Status)}</td></tr>`)
        .join('')}</table></div></body></html>`,
      { width: 1400, height: 800 },
    );
    const example = {
      to: 'info@sunrise-dental.test',
      subject: 'Your website on phones',
      body: "Hi Sunrise Family Dental team,\n\nI ran your website through Google's PageSpeed test on mobile and it scored 23 out of 100. On a phone, the main content takes about 9.8 seconds to appear, and the footer still says © 2019.\n\nWhen a page is that slow, many people searching for a dentist simply tap the next result on Google Maps.\n\nI help Austin practices with website design and redesign. Would it be useful if I sent you a free 2-minute video showing exactly what I would fix?\n\nThanks,\nAsha Rao\nPixel & Pine Studio\npixelpine.studio\n\nP.S. If this isn't useful, just reply \"no thanks\" and I won't email again.",
    };
    await htmlCard(
      browser,
      'draft-example',
      `<html><head><style>
        body{margin:0;font-family:Inter,Arial,sans-serif;background:#F3F4F6}
        #card{width:720px;margin:24px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;box-shadow:0 8px 24px rgba(17,24,39,.08);overflow:hidden}
        .top{padding:12px 18px;background:#EEF2FF;color:#3730A3;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
        .meta{padding:12px 18px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#374151;line-height:1.7}
        .meta b{display:inline-block;width:64px;color:#6B7280;font-weight:500}
        .body{padding:16px 18px 20px;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#111827}
      </style></head><body><div id="card"><div class="top">Draft · example output</div><div class="meta"><div><b>To</b>${esc(example.to)}</div><div><b>Subject</b>${esc(example.subject)}</div></div><div class="body">${esc(example.body)}</div></div></body></html>`,
      { width: 900, height: 900 },
    );
  } finally {
    await browser.close();
    server.kill('SIGTERM');
    await mocks.stop();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
