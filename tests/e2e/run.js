#!/usr/bin/env node
// End-to-end test: runs the real product workflows inside a real n8n instance against local mocks.
//
//   N8N_BIN=/path/to/node_modules/.bin/n8n [N8N_NODE=/path/to/node] node tests/e2e/run.js
//
// Needs: openssl, permission to listen on 127.0.0.1:443 and :80 (run as root or with CAP_NET_BIND_SERVICE).
// Nothing leaves the machine: the mocked hostnames are resolved to 127.0.0.1 only inside the n8n process.

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { makeCerts } = require('./certs');
const { Mocks, KEYS, API_HOSTS, siteHosts } = require('./mocks');
const { outputs } = require('../../scripts/build');
const { LEAD_COLUMNS } = require('../../src/lib/sheet');
const { recentExecutions } = require('./executions');
const fx = require('../fixtures/businesses');

const ROOT = path.join(__dirname, '..', '..');
const N8N_BIN = process.env.N8N_BIN;
const NODE_BIN = process.env.N8N_NODE || process.execPath;
if (!N8N_BIN) {
  console.error('Set N8N_BIN to an n8n executable (for example node_modules/.bin/n8n of an n8n install).');
  process.exit(2);
}
const N8N_JS = fs.realpathSync(N8N_BIN);
const PORT = Number(process.env.E2E_PORT || 5701);
const BASE = `http://localhost:${PORT}`;
const RUN_ID = process.env.E2E_LABEL || 'run';
const WORK = path.join(ROOT, '.e2e', RUN_ID);
const SHEET = (id) => `https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`;
const SHEETS = {
  web: '1WEBdesignSheet0000000000000000000000000',
  seo: '1SEOsheet000000000000000000000000000000',
  reviews: '1REVIEWSsheet0000000000000000000000000',
  social: '1SOCIALsheet00000000000000000000000000',
  ai: '1AICHATBOTsheet000000000000000000000000',
  followup: '1FOLLOWUPsheet0000000000000000000000000',
  noLeadsTab: '1NOLEADSTABsheet00000000000000000000000',
};

const results = [];
const ONLY = process.env.E2E_ONLY || '';
async function scenario(name, fn) {
  if (ONLY && !name.toLowerCase().includes(ONLY.toLowerCase())) return;
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`  ✔ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t, error: e });
    console.log(`  ✘ ${name}\n${String(e.stack || e).split('\n').slice(0, 12).map((l) => '      ' + l).join('\n')}`);
  }
}

function env(home) {
  const hosts = [...API_HOSTS, ...siteHosts()];
  const noProxy = [process.env.NO_PROXY || process.env.no_proxy || '', 'localhost', '127.0.0.1', '.googleapis.com', 'api.anthropic.com', '.test'].filter(Boolean).join(',');
  const certs = makeCerts(path.join(ROOT, '.e2e', 'certs'), hosts);
  const bundle = path.join(ROOT, '.e2e', 'certs', 'bundle.pem');
  const existing = process.env.NODE_EXTRA_CA_CERTS && fs.existsSync(process.env.NODE_EXTRA_CA_CERTS) ? fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS, 'utf8') : '';
  fs.writeFileSync(bundle, existing + '\n' + fs.readFileSync(certs.ca, 'utf8'));
  return {
    certs,
    vars: Object.assign({}, process.env, {
      PATH: `${path.dirname(NODE_BIN)}:${process.env.PATH}`,
      N8N_USER_FOLDER: home,
      N8N_ENCRYPTION_KEY: 'e2e-encryption-key-not-secret',
      N8N_PORT: String(PORT),
      N8N_LISTEN_ADDRESS: '127.0.0.1',
      N8N_HOST: 'localhost',
      N8N_PROTOCOL: 'http',
      WEBHOOK_URL: `${BASE}/`,
      N8N_RUNNERS_BROKER_PORT: String(PORT + 100),
      N8N_RUNNERS_ENABLED: 'true',
      N8N_SECURE_COOKIE: 'false',
      N8N_DIAGNOSTICS_ENABLED: 'false',
      N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
      N8N_TEMPLATES_ENABLED: 'false',
      N8N_PERSONALIZATION_ENABLED: 'false',
      N8N_LOG_LEVEL: 'warn',
      GENERIC_TIMEZONE: 'UTC',
      TZ: 'UTC',
      NODE_EXTRA_CA_CERTS: bundle,
      NODE_OPTIONS: `--require ${path.join(__dirname, 'dns-preload.js')}`,
      E2E_MOCK_HOSTS: hosts.join(','),
      NO_PROXY: noProxy,
      no_proxy: noProxy,
    }),
  };
}

function cli(vars, args, opts = {}) {
  const r = spawnSync(NODE_BIN, [N8N_JS, ...args], { env: vars, encoding: 'utf8', timeout: opts.timeout || 600000, maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`n8n ${args.join(' ')} failed (${r.status}):\n${(r.stdout || '').slice(-2000)}\n${(r.stderr || '').slice(-3000)}`);
  return r;
}

function n8nVersion(vars) {
  return cli(vars, ['--version']).stdout.trim().split('\n').pop();
}

const CREDENTIALS = [
  { id: 'e2eGoogleKey001', name: 'Google API Key', type: 'httpHeaderAuth', data: { name: 'X-Goog-Api-Key', value: KEYS.google } },
  { id: 'e2eAnthropic001', name: 'Anthropic API Key', type: 'httpHeaderAuth', data: { name: 'x-api-key', value: KEYS.anthropic } },
  {
    id: 'e2eSheets000001',
    name: 'Google Sheets account',
    type: 'googleSheetsOAuth2Api',
    data: { clientId: 'e2e-client', clientSecret: 'e2e-secret', oauthTokenData: { access_token: KEYS.oauth, refresh_token: 'e2e-refresh', token_type: 'Bearer', expires_in: 3599, scope: 'https://www.googleapis.com/auth/spreadsheets' } },
  },
  {
    id: 'e2eGmail0000001',
    name: 'Gmail account',
    type: 'gmailOAuth2',
    data: { clientId: 'e2e-client', clientSecret: 'e2e-secret', oauthTokenData: { access_token: KEYS.oauth, refresh_token: 'e2e-refresh', token_type: 'Bearer', expires_in: 3599, scope: 'https://www.googleapis.com/auth/gmail.compose' } },
  },
];

// What a buyer does after importing: pick credentials on each node and fill in Settings.
function personalize(wf, id, settings) {
  const copy = JSON.parse(JSON.stringify(wf));
  copy.id = id;
  copy.active = false;
  for (const n of copy.nodes) {
    if (n.type === 'n8n-nodes-base.httpRequest' && n.parameters.genericAuthType === 'httpHeaderAuth') {
      const cred = /Claude/.test(n.name) ? CREDENTIALS[1] : CREDENTIALS[0];
      n.credentials = { httpHeaderAuth: { id: cred.id, name: cred.name } };
    }
    if (n.type === 'n8n-nodes-base.googleSheets') n.credentials = { googleSheetsOAuth2Api: { id: CREDENTIALS[2].id, name: CREDENTIALS[2].name } };
    if (n.type === 'n8n-nodes-base.gmail') n.credentials = { gmailOAuth2: { id: CREDENTIALS[3].id, name: CREDENTIALS[3].name } };
    if (n.name === '⚙️ Settings') {
      for (const a of n.parameters.assignments.assignments) if (settings[a.name] !== undefined) a.value = settings[a.name];
    }
    if (settings.__formPath && n.type === 'n8n-nodes-base.formTrigger') {
      n.parameters.options.path = settings.__formPath;
      n.webhookId = `${n.webhookId.slice(0, 24)}${settings.__formPath.length.toString(16).padStart(12, '0')}`;
    }
  }
  return copy;
}

async function waitFor(fn, ms, what) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${what}${last ? `: ${last.message}` : ''}`);
}

function startServer(vars, logFile) {
  const out = fs.openSync(logFile, 'a');
  const child = spawn(NODE_BIN, [N8N_JS, 'start'], { env: vars, stdio: ['ignore', out, out] });
  return child;
}

function stripTags(s) {
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

async function submitForm(formPath, values) {
  const fd = new FormData();
  values.forEach((v, i) => fd.append(`field-${i}`, v));
  const r = await fetch(`${BASE}/form/${formPath}`, { method: 'POST', body: fd });
  const text = await r.text();
  assert.equal(r.status, 200, `form POST ${formPath} → ${r.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  assert.ok(json.formWaitingUrl, `no formWaitingUrl in ${text.slice(0, 200)}`);
  const waiting = new URL(json.formWaitingUrl);
  const statusUrl = new URL(waiting);
  statusUrl.pathname += '/n8n-execution-status';
  const status = await waitFor(
    async () => {
      const s = (await (await fetch(statusUrl)).text()).trim();
      return ['form-waiting', 'success', 'error', 'canceled', 'crashed'].includes(s) ? s : null;
    },
    240000,
    `execution of form ${formPath}`,
  );
  assert.equal(status, 'form-waiting', `execution ended with status "${status}" instead of showing the completion page`);
  const page = await (await fetch(waiting)).text();
  // Like the browser: the completion page POSTs back to finish the execution.
  const done = await fetch(waiting, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(done.status, 200, `completion POST → ${done.status}`);
  const final = await waitFor(
    async () => {
      const s = (await (await fetch(statusUrl)).text()).trim();
      return ['success', 'error', 'canceled', 'crashed'].includes(s) ? s : null;
    },
    60000,
    `form ${formPath} execution to finish`,
  );
  assert.equal(final, 'success', `execution finished with status ${final}`);
  const title = stripTags((page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
  const message = stripTags((page.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');
  // n8n 2.x embeds `const binaries = "[...]"` (Buffer JSON); n8n 1.x embeds `const binary = "{...}"` with the
  // file as a string of byte characters. Both are downloaded by the page's script in the browser.
  let binaries = [];
  const decode = (b) => ({
    fileName: b.fileName,
    type: b.type,
    text: (b.data && b.data.type === 'Buffer' ? Buffer.from(b.data.data) : Buffer.from(String(b.data), 'latin1')).toString('utf8'),
  });
  const many = page.match(/const binaries = "([^"]*)"/);
  const one = page.match(/const binary = "([^"]*)"/);
  if (many) binaries = JSON.parse(decodeURIComponent(many[1])).map(decode);
  else if (one) binaries = [decode(JSON.parse(decodeURIComponent(one[1])))];
  fs.writeFileSync(path.join(WORK, `page-${formPath}-${Date.now()}.html`), page);
  return { title, message, binaries, page };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...rest] = rows.filter((r) => r.length > 1 || r[0]);
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const SETTINGS = {
  yourName: 'Asha Rao',
  yourBusinessName: 'Pixel & Pine Studio',
  yourWebsite: 'pixelpine.test',
};

async function main() {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  const home = path.join(WORK, 'n8n-home');
  const { certs, vars } = env(home);
  const version = n8nVersion(vars);
  const major = Number(version.split('.')[0]);
  console.log(`\nClient Finder e2e on n8n ${version} (node ${spawnSync(NODE_BIN, ['-v'], { encoding: 'utf8' }).stdout.trim()})`);

  const mocks = new Mocks(certs);
  await mocks.start();
  const header = [LEAD_COLUMNS];
  for (const id of Object.values(SHEETS)) mocks.sheets.create(id, { Leads: header, 'How to use': [['Read me']] });
  mocks.sheets.create(SHEETS.noLeadsTab, { Sheet1: [['Name', 'Phone']] }); // a buyer pasted the wrong sheet

  // credentials + workflows
  fs.writeFileSync(path.join(WORK, 'credentials.json'), JSON.stringify(CREDENTIALS, null, 2));
  cli(vars, ['import:credentials', `--input=${path.join(WORK, 'credentials.json')}`]);
  const files = outputs();
  const product = (rel) => JSON.parse(files[rel]);
  const plan = [
    { id: 'cfLite', rel: 'lite/client-finder-lite.json', settings: {} },
    { id: 'cfStarterWeb', rel: 'starter/client-finder-web-design.json', settings: Object.assign({ googleSheetUrl: SHEET(SHEETS.web) }, SETTINGS) },
    { id: 'cfUnsetWeb', rel: 'starter/client-finder-web-design.json', settings: { __formPath: 'client-finder-unset' } },
    { id: 'cfNoLeadsTab', rel: 'starter/client-finder-web-design.json', settings: Object.assign({ googleSheetUrl: SHEET(SHEETS.noLeadsTab), __formPath: 'client-finder-noleads' }, SETTINGS) },
    { id: 'cfSeo', rel: 'pro/workflows/client-finder-seo.json', settings: Object.assign({ googleSheetUrl: SHEET(SHEETS.seo) }, SETTINGS) },
    { id: 'cfReviews', rel: 'pro/workflows/client-finder-reviews.json', settings: Object.assign({ googleSheetUrl: SHEET(SHEETS.reviews) }, SETTINGS) },
    { id: 'cfSocial', rel: 'pro/workflows/client-finder-social-media.json', settings: Object.assign({ googleSheetUrl: SHEET(SHEETS.social) }, SETTINGS) },
    { id: 'cfAiChatbot', rel: 'pro/workflows/client-finder-ai-chatbot.json', settings: Object.assign({ googleSheetUrl: SHEET(SHEETS.ai), createGmailDrafts: false }, SETTINGS) },
    { id: 'cfFollowUp', rel: 'pro/workflows/follow-up-autopilot.json', settings: Object.assign({ googleSheetUrl: SHEET(SHEETS.followup) }, SETTINGS) },
  ];
  for (const p of plan) {
    const file = path.join(WORK, `${p.id}.json`);
    fs.writeFileSync(file, JSON.stringify(personalize(product(p.rel), p.id, p.settings), null, 2));
    cli(vars, ['import:workflow', `--input=${file}`]);
    if (p.id === 'cfFollowUp') continue; // run on demand from the CLI below
    if (major >= 2) cli(vars, ['publish:workflow', `--id=${p.id}`]);
    else cli(vars, ['update:workflow', `--id=${p.id}`, '--active=true']);
  }

  // n8n 2.x occasionally fails to start its JavaScript task runner and shuts down while its HTTP server still
  // answers for a moment; that is the test machine, not the product, so start it once more in that case.
  let server;
  for (let attempt = 1; ; attempt++) {
    server = startServer(vars, path.join(WORK, 'n8n.log'));
    await waitFor(async () => (await fetch(`${BASE}/healthz`)).status === 200, 120000, 'n8n to start');
    await waitFor(async () => (await fetch(`${BASE}/form/client-finder-lite`)).status === 200, 60000, 'forms to register');
    await new Promise((r) => setTimeout(r, 5000));
    if (server.exitCode === null && (await fetch(`${BASE}/form/client-finder-lite`)).status === 200) break;
    if (attempt >= 2) throw new Error('n8n exited right after starting twice; see n8n.log');
    console.log('n8n exited right after starting (see n8n.log); starting it again');
    if (server.exitCode === null) server.kill('SIGTERM');
    await new Promise((r) => (server.exitCode === null ? server.on('exit', r) : r()));
  }
  try {
    console.log('n8n is up; running scenarios:');
    await formScenarios(mocks);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => {
      server.on('exit', r);
      setTimeout(r, 15000);
    });
  }
  await followUpScenarios(mocks, vars);
  await mocks.stop();

  const failed = results.filter((r) => !r.ok);
  try {
    const execs = await recentExecutions(N8N_JS, path.join(home, '.n8n', 'database.sqlite'), 40);
    const bad = execs.filter((e) => e.status !== 'success' && e.status !== 'waiting');
    if (bad.length) {
      console.log('\nExecutions that did not succeed:');
      for (const e of bad) console.log(`  #${e.id} ${e.workflowId} ${e.status} last=${e.lastNode} ${e.error ? `${e.error.node}: ${e.error.message} ${e.error.description || ''}` : ''}`);
    }
  } catch (e) {
    console.log('(could not read the execution log:', e.message, ')');
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed on n8n ${version}`);
  if (mocks.calls.unknown.length) console.log('Unmocked requests:', JSON.stringify(mocks.calls.unknown.slice(0, 10), null, 2));
  fs.writeFileSync(path.join(WORK, 'report.json'), JSON.stringify({ version, results: results.map((r) => ({ name: r.name, ok: r.ok, ms: r.ms, error: r.error ? String(r.error.stack || r.error) : undefined })) }, null, 2));
  process.exit(failed.length || mocks.calls.unknown.length ? 1 : 0);
}

const AUSTIN = ['dentists', 'Austin, TX', '40'];
const rowsOf = (mocks, id) => mocks.sheets.objects(id, 'Leads');
const byName = (rows) => Object.fromEntries(rows.map((r) => [r.Business, r]));

async function formScenarios(mocks) {
  await scenario('Lite: form → CSV download with no-website businesses first', async () => {
    mocks.reset();
    const res = await submitForm('client-finder-lite', AUSTIN);
    assert.equal(res.title, 'Your leads are ready');
    assert.equal(res.binaries.length, 1, 'one CSV file');
    assert.equal(res.binaries[0].fileName, 'leads-dentists-in-austin-tx.csv');
    const rows = parseCsv(res.binaries[0].text);
    assert.equal(rows.length, 13, '13 open, unique businesses');
    assert.equal(rows[0].Business, 'Lakeside Dental Care');
    assert.equal(rows[0]['Has Website'], 'NO');
    assert.ok(rows.slice(1).every((r) => r['Has Website'] === 'Yes'));
    assert.ok(!rows.some((r) => r.Business === 'Northside Dental'), 'closed business removed');
    assert.equal(mocks.calls.places.length, 2, 'two result pages requested');
    assert.equal(mocks.calls.places[0].body.textQuery, 'dentists in Austin, TX');
    assert.equal(mocks.calls.places[0].body.pageSize, 20);
    assert.equal(mocks.calls.places[0].body.pageToken, undefined);
    assert.equal(mocks.calls.places[1].body.pageToken, 'PAGE2TOKEN');
    assert.equal(mocks.calls.psi.length + mocks.calls.claude.length + mocks.calls.sites.length, 0, 'Lite makes no other calls');
  });

  await scenario('Lite: Google API not enabled → friendly message page', async () => {
    mocks.reset();
    const res = await submitForm('client-finder-lite', ['forbidden shops', 'Austin, TX', '20']);
    assert.equal(res.title, 'Google Maps search failed');
    assert.match(res.message, /not enabled in your Google Cloud project/);
  });

  await scenario('Lite: no results → helpful message page', async () => {
    mocks.reset();
    const res = await submitForm('client-finder-lite', ['nothing at all', 'Nowhere', '20']);
    assert.equal(res.title, 'No businesses found');
    assert.match(res.message, /Try a broader area/);
  });

  await scenario('Starter (web design): placeholder Settings → setup message, no API calls', async () => {
    mocks.reset();
    const res = await submitForm('client-finder-unset', AUSTIN);
    assert.equal(res.title, 'One setup step left');
    assert.match(res.message, /yourName/);
    assert.equal(mocks.calls.places.length, 0);
  });

  await scenario('Starter (web design): sheet without a "Leads" tab → friendly message, nothing pitched', async () => {
    mocks.reset();
    const res = await submitForm('client-finder-noleads', AUSTIN);
    assert.equal(res.title, "Couldn't open your Google Sheet");
    assert.match(res.message, /"Leads" tab/);
    assert.equal(mocks.calls.claude.length, 0);
    assert.equal(mocks.drafts.length, 0);
  });

  await scenario('Starter (web design): full run → scored sheet rows, pitches, Gmail draft', async () => {
    mocks.reset();
    const res = await submitForm('client-finder-web-design', AUSTIN);
    assert.equal(res.title, 'Done: 13 new leads found');
    assert.match(res.message, /1 Gmail draft ready/);
    assert.match(res.message, /1 draft could not be created: see the Notes column/);
    const rows = rowsOf(mocks, SHEETS.web);
    assert.deepEqual(mocks.sheets.rows(SHEETS.web, 'Leads')[0], LEAD_COLUMNS, 'header row untouched');
    assert.equal(rows.length, 13);
    for (let i = 1; i < rows.length; i++) assert.ok(Number(rows[i - 1].Score) >= Number(rows[i].Score), 'rows sorted by score');
    const b = byName(rows);
    const sun = b['Sunrise Family Dental, PLLC'];
    assert.equal(sun.Problems, 'Slow on mobile, Outdated website');
    assert.equal(sun.Score, 50);
    assert.equal(sun.Priority, 'Warm');
    assert.equal(sun.Email, 'info@sunrise-dental.test');
    assert.equal(sun.Status, 'Draft ready');
    assert.match(sun['Draft ID'], /^r-\d+$/);
    assert.match(sun['Thread ID'], /^t-\d+$/);
    assert.equal(sun['Email Subject'], 'slow on mobile at Sunrise Family Dental');
    assert.match(sun['AI Status'], /^Written by claude-opus-5-5$/);
    assert.match(sun.Evidence, /^1\. In Google's PageSpeed mobile test \(a simulated phone on a 4G connection\) the homepage scored 23\/100/);
    assert.equal(b['Lakeside Dental Care'].Problems, 'No website');
    assert.equal(b['Lakeside Dental Care'].Status, 'Pitch ready');
    assert.equal(b['Bright Smile Studio'].Problems, 'Not mobile-friendly, Not secure (no HTTPS), Outdated website, Weak SEO basics');
    assert.match(b['Bright Smile Studio']['AI Status'], /^Template used \(AI error: 529/);
    assert.match(b['Bright Smile Studio'].Notes, /^Gmail draft failed: Gmail rejected it \(check the email address\)/);
    assert.equal(b['Bright Smile Studio'].Status, 'Pitch ready');
    assert.equal(b['Bright Smile Studio']['Last Draft On'], '');
    assert.equal(b['Bright Smile Studio']['Draft ID'], '');
    assert.match(b['Cedar Park Smiles']['AI Status'], /after a retry/);
    assert.equal(b['Cedar Park Smiles'].Problems, 'Placeholder website');
    assert.equal(b['Oak Hill Orthodontics'].Problems, 'Website down');
    assert.equal(b['Maple Dental Group'].Problems, 'Website down');
    assert.match(b['Maple Dental Group'].Evidence, /didn't load in two checks a few seconds apart: the domain doesn't resolve/);
    assert.match(b['Oak Hill Orthodontics'].Evidence, /the homepage returns "page not found" \(404\)/);
    assert.equal(mocks.calls.sites.filter((c) => c.key === 'oakhill').length, 2, 'a failing site is checked twice');
    assert.equal(mocks.calls.sites.filter((c) => c.key === 'sunrise').length, 1, 'a working site is loaded once');
    assert.equal(b['Pearl Dental Spa'].Problems, 'Security certificate error');
    assert.match(b['Pearl Dental Spa'].Evidence, /PageSpeed test hit the same error in Chrome/);
    assert.equal(b['Downtown Dentistry'].Score, 0);
    assert.equal(b['Downtown Dentistry'].Status, 'New');
    assert.equal(b['Riverside Dental'].Score, 0, 'bot-protected site is not judged');
    assert.equal(b['Elm Street Dental']['AI Status'], 'Skipped (score below 20)');
    assert.ok(!b['Northside Dental']);
    // Gmail
    assert.equal(mocks.drafts.length, 1);
    const d = mocks.drafts[0];
    assert.equal(d.to, 'info@sunrise-dental.test');
    assert.equal(d.subject, 'slow on mobile at Sunrise Family Dental');
    assert.match(d.body, /^Hi Sunrise Family Dental team,/);
    assert.match(d.body, /Thanks,\nAsha Rao\nPixel & Pine Studio\npixelpine\.test/);
    assert.match(d.body, /no thanks/);
    assert.doesNotMatch(d.body, /n8n/i, 'no automation footer in the draft');
    // Claude: 7 leads pitched; Bright Smile fails twice, Cedar Park fails once then succeeds.
    assert.equal(mocks.calls.claude.length, 9);
    for (const c of mocks.calls.claude) {
      assert.equal(c.body.model, 'claude-opus-5-5');
      assert.equal(c.body.fallbacks, 'default');
      assert.equal(c.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
      assert.equal(c.body.output_config.effort, 'low');
      assert.equal(c.body.output_config.format.type, 'json_schema');
      assert.equal(c.body.max_tokens, 4000);
    }
    // PageSpeed for sites that loaded, and for the certificate error (Chrome confirms it)
    const psiHosts = mocks.calls.psi.map((c) => new URL(c.target).hostname).sort();
    assert.deepEqual(psiHosts, ['bright-smile.test', 'cedarpark-smiles.test', 'downtown-dentistry.test', 'elm-dental.test', 'gentlecare-dental.test', 'hillcrest-dentistry.test', 'pearl-dental.test', 'sunrise-dental.test', 'westlake-dental.test']);
    assert.ok(mocks.calls.places.every((c) => c.body.includePureServiceAreaBusinesses === true), 'service-area businesses included');
    // Sheet first, then drafts: the rows were saved before the first Gmail call.
    const webWrites = mocks.sheets.log.filter((l) => l.path.includes(SHEETS.web) && (l.method === 'PUT' || /:append$|values:batchUpdate$/.test(l.path)));
    const firstDraft = mocks.calls.gmail.find((c) => c.method === 'POST' && /\/drafts$/.test(c.url));
    assert.ok(webWrites.length >= 2 && firstDraft, 'rows saved, drafts created, draft IDs written');
    assert.ok(webWrites[0].seq < firstDraft.seq, 'rows are saved before the first Gmail draft is created');
    assert.ok(webWrites[webWrites.length - 1].seq > firstDraft.seq && /values:batchUpdate$/.test(webWrites[webWrites.length - 1].path), 'draft IDs are written back after the drafts');
    assert.ok(mocks.calls.psi.every((c) => c.strategy === 'mobile' && c.categories.includes('PERFORMANCE') && c.categories.includes('SEO')));
    assert.ok(mocks.calls.sites.every((c) => /Mozilla\/5\.0/.test(c.ua)), 'browser-like user agent');
  });

  await scenario('Starter (web design): second run → "Nothing new", no duplicate pitches', async () => {
    mocks.reset();
    const before = rowsOf(mocks, SHEETS.web).length;
    const res = await submitForm('client-finder-web-design', AUSTIN);
    assert.equal(res.title, 'Nothing new this time');
    assert.equal(rowsOf(mocks, SHEETS.web).length, before);
    assert.equal(mocks.calls.claude.length, 0);
    assert.equal(mocks.drafts.length, 0);
  });

  await scenario('Pro (local SEO): run → SEO problems', async () => {
    mocks.reset();
    const res = await submitForm('client-finder-seo', ['plumbers', 'Denver, CO', '60']);
    assert.equal(res.title, 'Done: 13 new leads found');
    const b = byName(rowsOf(mocks, SHEETS.seo));
    assert.equal(b['Elm Street Dental'].Problems, 'Weak SEO basics, No schema markup, Few Google reviews');
    assert.equal(b['Sunrise Family Dental, PLLC'].Problems, 'Slow on mobile, No schema markup, Outdated website');
    assert.equal(b['Downtown Dentistry'].Score, 0);
    assert.equal(mocks.calls.places[0].body.textQuery, 'plumbers in Denver, CO');
  });

  await scenario('Pro (reviews): run → rating/review problems, emails found, no PageSpeed calls', async () => {
    mocks.reset();
    const res = await submitForm('client-finder-reviews', AUSTIN);
    assert.equal(res.title, 'Done: 13 new leads found');
    const b = byName(rowsOf(mocks, SHEETS.reviews));
    assert.equal(b['Hillcrest Family Dentistry'].Problems, 'Low Google rating');
    assert.match(b['Hillcrest Family Dentistry'].Evidence, /rated 3\.6★ on Google from 48 reviews \(similar businesses nearby average 4\.6★\)/);
    assert.equal(b['Elm Street Dental'].Problems, 'Few Google reviews');
    assert.equal(mocks.calls.psi.length, 0, 'no PageSpeed tests for the reviews niche');
    assert.ok(mocks.calls.sites.length > 0, 'homepages are loaded to find contact emails');
    assert.equal(b['Elm Street Dental'].Email, 'contact@elm-dental.test');
    assert.equal(b['Elm Street Dental'].Status, 'Draft ready', 'reviews pitches become Gmail drafts too');
    assert.equal(b['Hillcrest Family Dentistry'].Status, 'Draft ready');
  });

  await scenario('Pro (social media): run → social/tracking problems, no PageSpeed', async () => {
    mocks.reset();
    const res = await submitForm('client-finder-social-media', ['gyms', 'Pune, India', '40']);
    assert.equal(res.title, 'Done: 13 new leads found');
    const b = byName(rowsOf(mocks, SHEETS.social));
    assert.equal(b['Sunrise Family Dental, PLLC'].Problems, 'No analytics or ad pixel, Outdated website');
    assert.equal(b['Elm Street Dental'].Problems, 'No social media links, No analytics or ad pixel, Few Google reviews');
    assert.equal(b['Gentle Care Dental'].Score, 0);
    assert.equal(mocks.calls.psi.length, 0);
  });

  await scenario('Pro (AI chatbot): drafts off → pitches only, booking/chat/hours problems', async () => {
    mocks.reset();
    const res = await submitForm('client-finder-ai-chatbot', AUSTIN);
    assert.equal(res.title, 'Done: 13 new leads found');
    assert.match(res.message, /Gmail drafts are turned off/);
    const b = byName(rowsOf(mocks, SHEETS.ai));
    assert.equal(b['Westlake Dental Studio'].Problems, 'No online booking, No chat or WhatsApp, Limited opening hours');
    assert.equal(b['Westlake Dental Studio'].Status, 'Pitch ready');
    assert.equal(b['Lakeside Dental Care'].Problems, 'Limited opening hours, No website');
    assert.equal(b['Gentle Care Dental'].Score, 0);
    assert.equal(mocks.drafts.length, 0);
  });
}

function seedFollowUp(mocks) {
  const now = Date.now();
  const daysAgo = (n) => new Date(now - n * 86400000);
  const iso = (n) => daysAgo(n).toISOString().slice(0, 10);
  const row = (o) => LEAD_COLUMNS.map((c) => (o[c] === undefined ? '' : o[c]));
  const base = { 'Email Subject': 'your website on phones', 'Email Body': 'Hi team,\n\nOriginal pitch.', 'Top Problem': 'Slow on mobile', Evidence: '1. Google PageSpeed scores the mobile site 23/100.', Niche: 'Web Design', 'Follow-ups': 0 };
  const rows = [
    Object.assign({}, base, { 'Place ID': 'fu-replied', Business: 'Replied Dental', Email: 'owner1@reply.test', Status: 'Draft ready', 'Last Draft On': iso(10), 'Thread ID': 't-replied' }),
    Object.assign({}, base, { 'Place ID': 'fu-due1', Business: 'Due One Dental', Email: 'owner2@due.test', Status: 'Draft ready', 'Last Draft On': iso(6), 'Thread ID': 't-due1', Niche: 'Local SEO' }),
    Object.assign({}, base, { 'Place ID': 'fu-wait', Business: 'Waiting Dental', Email: 'owner3@wait.test', Status: 'Follow-up drafted', 'Follow-ups': 1, 'Last Draft On': iso(1), 'Last Contacted': iso(6), 'Thread ID': 't-wait' }),
    Object.assign({}, base, { 'Place ID': 'fu-due2', Business: 'Due Two Dental', Email: 'owner4@due2.test', Status: 'Contacted', 'Follow-ups': 1, 'Last Draft On': iso(9), 'Last Contacted': iso(9), 'Thread ID': 't-due2' }),
    Object.assign({}, base, { 'Place ID': 'fu-max', Business: 'Max Dental', Email: 'owner5@max.test', Status: 'Contacted', 'Follow-ups': 2, 'Last Contacted': iso(20), 'Thread ID': 't-max' }),
    Object.assign({}, base, { 'Place ID': 'fu-never', Business: 'Never Sent Dental', Email: 'owner6@never.test', Status: 'Draft ready', 'Last Draft On': iso(2) }),
    Object.assign({}, base, { 'Place ID': 'fu-recent', Business: 'Recent Dental', Email: 'owner7@recent.test', Status: 'Draft ready', 'Last Draft On': iso(3), 'Thread ID': 't-recent' }),
    Object.assign({}, base, { 'Place ID': 'fu-won', Business: 'Won Dental', Email: 'owner8@won.test', Status: 'Won', 'Last Contacted': iso(30) }),
    Object.assign({}, base, { 'Place ID': 'fu-aifail', Business: 'AI Fail Co', Email: 'owner9@aifail.test', Status: 'Draft ready', 'Last Draft On': iso(8), 'Thread ID': 't-aifail' }),
    Object.assign({}, base, { 'Place ID': 'fu-draftfail', Business: 'Draft Fail Co', Email: 'owner10@bad.test', Status: 'Draft ready', 'Last Draft On': iso(8), 'Thread ID': 't-draftfail' }),
    Object.assign({}, base, { 'Place ID': 'fu-colleague', Business: 'Colleague Dental', Email: 'info@colleague.test', Status: 'Draft ready', 'Last Draft On': iso(10), 'Thread ID': 't-colleague' }),
    Object.assign({}, base, { 'Place ID': 'fu-bounce', Business: 'Bounce Dental', Email: 'nobody@bounce.test', Status: 'Draft ready', 'Last Draft On': iso(6), 'Thread ID': 't-bounce' }),
    Object.assign({}, base, { 'Place ID': 'fu-trash', Business: 'Trash Dental', Email: 'owner11@trash.test', Status: 'Draft ready', 'Last Draft On': iso(9), 'Thread ID': 't-trash' }),
    Object.assign({}, base, { 'Place ID': 'fu-optout-old', Business: 'Optout Dental (old listing)', Email: 'owner12@optout.test', Status: 'Do not contact', 'Last Contacted': iso(30) }),
    Object.assign({}, base, { 'Place ID': 'fu-optout-new', Business: 'Optout Dental', Email: 'owner12@optout.test', Status: 'Contacted', 'Last Contacted': iso(9), 'Thread ID': 't-optout' }),
    Object.assign({}, base, { 'Place ID': 'fu-duprow', Business: 'Dup Row Dental', Email: 'owner13@duprow.test', Status: 'Draft ready', 'Last Draft On': iso(8), 'Thread ID': 't-duprow' }),
    Object.assign({}, base, { 'Place ID': 'fu-duprow', Business: 'Dup Row Dental', Email: 'owner13@duprow.test', Status: 'Draft ready', 'Last Draft On': iso(8), 'Thread ID': 't-duprow', Notes: 'second copy of the row' }),
    Object.assign({}, base, { 'Place ID': 'fu-noemail', Business: 'No Email Co', Email: '', Status: 'Pitch ready' }),
  ];
  mocks.sheets.create(SHEETS.followup, { Leads: [LEAD_COLUMNS, ...rows.map(row)] });
  let n = 0;
  const sent = (to, d, threadId) => ({ id: `s${++n}`, threadId, labelIds: ['SENT'], internalDate: daysAgo(d).getTime(), from: 'Asha Rao <asha@pixelpine.test>', to, subject: 'your website on phones' });
  const reply = (from, d, threadId) => ({ id: `i${++n}`, threadId, labelIds: ['INBOX', 'UNREAD'], internalDate: daysAgo(d).getTime(), from, to: 'asha@pixelpine.test', subject: 'Re: your website on phones' });
  mocks.seedGmail([
    sent('owner1@reply.test', 9, 't-replied'),
    reply('Owner One <owner1@reply.test>', 8, 't-replied'),
    sent('Owner Two <owner2@due.test>', 5, 't-due1'),
    sent('owner3@wait.test', 6, 't-wait'),
    sent('owner4@due2.test', 12, 't-due2'),
    sent('owner4@due2.test', 8, 't-due2'),
    sent('owner5@max.test', 20, 't-max'),
    sent('owner7@recent.test', 1, 't-recent'),
    sent('owner9@aifail.test', 7, 't-aifail'),
    sent('owner10@bad.test', 7, 't-draftfail'),
    reply('Someone Else <other@else.test>', 2, 't-x'),
    // the pitch went to info@, the owner answered from a personal address in the same thread
    sent('info@colleague.test', 9, 't-colleague'),
    reply('Dr Lee <dr.lee.colleague@gmail.com>', 5, 't-colleague'),
    // the address bounced: Gmail puts the failure notice in the same thread
    sent('nobody@bounce.test', 5, 't-bounce'),
    { id: `b${++n}`, threadId: 't-bounce', labelIds: ['INBOX'], internalDate: daysAgo(5).getTime() + 60000, from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>', to: 'asha@pixelpine.test', subject: 'Delivery Status Notification (Failure)' },
    // the owner replied in a new thread, then the buyer deleted it: in:anywhere still finds it
    sent('owner11@trash.test', 8, 't-trash'),
    { id: `x${++n}`, threadId: 't-trash-reply', labelIds: ['TRASH'], internalDate: daysAgo(4).getTime(), from: 'owner11@trash.test', to: 'asha@pixelpine.test', subject: 'Not interested, thanks' },
    sent('owner12@optout.test', 9, 't-optout'),
    sent('owner13@duprow.test', 7, 't-duprow'),
  ]);
  return { iso };
}

// Must not block: the mock servers live in this process and have to keep answering while n8n runs.
// Output goes to files, not pipes: n8n exits right after printing, which can truncate piped output.
let cliRuns = 0;
function cliAsync(vars, args) {
  const n = ++cliRuns;
  const outFile = path.join(WORK, `cli-${n}.out`);
  const errFile = path.join(WORK, `cli-${n}.err`);
  const out = fs.openSync(outFile, 'w');
  const err = fs.openSync(errFile, 'w');
  return new Promise((resolve) => {
    const child = spawn(NODE_BIN, [N8N_JS, ...args], { env: vars, stdio: ['ignore', out, err] });
    child.on('close', (status) => {
      fs.closeSync(out);
      fs.closeSync(err);
      resolve({ status, stdout: fs.readFileSync(outFile, 'utf8'), stderr: fs.readFileSync(errFile, 'utf8') });
    });
  });
}

async function executeCli(vars, id) {
  // `n8n execute` prints its result through the logger, so it needs log level info.
  const r = await cliAsync(Object.assign({}, vars, { N8N_LOG_LEVEL: 'info' }), ['execute', `--id=${id}`, '--rawOutput']);
  const text = r.stdout || '';
  const m = /^\{$/m.exec(text);
  const start = m ? m.index : -1;
  if (start < 0) throw new Error(`no execution output (exit ${r.status}):\n${text.slice(-2000)}\n${(r.stderr || '').slice(-2000)}`);
  const end = text.indexOf('\n}', start);
  const data = JSON.parse(text.slice(start, end + 2));
  return { exit: r.status, data, runData: data.data.resultData.runData, error: data.data.resultData.error };
}

async function followUpScenarios(mocks, vars) {
  await scenario('Pro (follow-ups): reads Gmail, marks replies, drafts threaded follow-ups', async () => {
    mocks.reset();
    const { iso } = seedFollowUp(mocks);
    const run = await executeCli(vars, 'cfFollowUp');
    assert.equal(run.error, undefined, run.error && run.error.message);
    const rows = Object.fromEntries(rowsOf(mocks, SHEETS.followup).map((r) => [r['Place ID'], r]));
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(rows['fu-replied'].Status, 'Replied');
    assert.equal(rows['fu-due1'].Status, 'Follow-up drafted');
    assert.equal(Number(rows['fu-due1']['Follow-ups']), 1);
    assert.equal(rows['fu-due1']['Last Draft On'], today);
    assert.equal(rows['fu-due1']['Last Contacted'], iso(5));
    assert.equal(rows['fu-wait'].Status, 'Follow-up drafted', 'waiting draft untouched');
    assert.equal(Number(rows['fu-wait']['Follow-ups']), 1);
    assert.equal(rows['fu-due2'].Status, 'Follow-up drafted');
    assert.equal(Number(rows['fu-due2']['Follow-ups']), 2);
    assert.equal(rows['fu-max'].Status, 'Contacted');
    assert.equal(Number(rows['fu-max']['Follow-ups']), 2);
    assert.equal(rows['fu-never'].Status, 'Draft ready');
    assert.equal(rows['fu-recent'].Status, 'Contacted');
    assert.equal(rows['fu-recent']['Last Contacted'], iso(1));
    assert.equal(rows['fu-won'].Status, 'Won');
    assert.equal(rows['fu-aifail'].Status, 'Follow-up drafted');
    assert.equal(rows['fu-draftfail'].Status, 'Draft ready');
    assert.equal(Number(rows['fu-draftfail']['Follow-ups']), 0);
    assert.match(rows['fu-draftfail'].Notes, /^\d{4}-\d{2}-\d{2} follow-up draft failed: Gmail rejected it/);
    assert.equal(rows['fu-replied']['Email Body'], 'Hi team,\n\nOriginal pitch.', 'other columns are left alone');
    const drafts = Object.fromEntries(mocks.drafts.map((d) => [d.to, d]));
    assert.equal(rows['fu-colleague'].Status, 'Replied', 'a reply from another address in the thread counts');
    assert.match(rows['fu-colleague'].Notes, /Reply came from dr\.lee\.colleague@gmail\.com/);
    assert.equal(rows['fu-bounce'].Status, 'Bounced');
    assert.match(rows['fu-bounce'].Notes, /email bounced/);
    assert.equal(rows['fu-trash'].Status, 'Replied', 'a deleted reply still counts');
    assert.equal(rows['fu-optout-new'].Status, 'Contacted', 'same address as a "Do not contact" row: left alone');
    const dupRows = rowsOf(mocks, SHEETS.followup).filter((r) => r['Place ID'] === 'fu-duprow');
    assert.deepEqual(dupRows.map((r) => r.Status), ['Follow-up drafted', 'Draft ready'], 'only the first copy of a duplicated row is used');
    assert.equal(mocks.drafts.filter((d) => d.to === 'owner13@duprow.test').length, 1, 'one follow-up for a duplicated row');
    assert.equal(mocks.drafts.filter((d) => /optout|bounce|colleague|trash/.test(d.to)).length, 0, 'nobody who replied, bounced or opted out gets a follow-up');
    assert.match(drafts['owner2@due.test'].body, /just reply and I'll stop\.$/, 'follow-ups carry an opt-out line');
    assert.ok(mocks.calls.gmail.some((c) => /\/threads\/t-colleague\?/.test(c.url) && /format=metadata/.test(c.url)), 'pitch threads are read');
    assert.deepEqual(Object.keys(drafts).sort(), ['owner13@duprow.test', 'owner2@due.test', 'owner4@due2.test', 'owner9@aifail.test']);
    assert.equal(drafts['owner2@due.test'].threadId, 't-due1');
    assert.match(drafts['owner2@due.test'].headers['in-reply-to'] || '', /^<s\d+@mail\.test>$/, 'threaded reply headers');
    assert.equal(drafts['owner2@due.test'].subject, 'Re: your website on phones');
    assert.match(drafts['owner2@due.test'].body, /^Hi Due One Dental team,\n\nFollowing up/);
    assert.match(drafts['owner2@due.test'].body, /Thanks,\nAsha Rao/);
    assert.match(drafts['owner9@aifail.test'].body, /Quick follow-up on my note/, 'template when the AI fails');
    assert.match(drafts['owner4@due2.test'].body, /Following up/);
    const due1Claude = mocks.calls.claude.find((c) => c.business === 'Due One Dental');
    assert.match(due1Claude.body.system, /local SEO/i, 'uses the niche of the workflow that found the lead');
    const report = run.runData.Report[0].data.main[0][0].json;
    assert.equal(report.followUpsDrafted, 4);
    assert.equal(report.markedReplied, 3);
    assert.equal(report.markedBounced, 1);
    assert.equal(report.markedContacted, 1);
    assert.equal(report.draftsFailed, 1);
  });

  await scenario('Pro (follow-ups): next run the same day → nothing new, no duplicate drafts', async () => {
    const draftsBefore = mocks.drafts.length;
    const run = await executeCli(vars, 'cfFollowUp');
    assert.equal(run.error, undefined, run.error && run.error.message);
    assert.ok(run.runData['Nothing To Do'] || run.runData.Report, 'run ends cleanly');
    const created = mocks.drafts.length - draftsBefore;
    assert.equal(created, 0, `${created} duplicate drafts`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
