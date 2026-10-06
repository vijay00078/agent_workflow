// Local stand-ins for every external service the workflows call. They validate each request the way
// the real API would (auth headers, required fields) and record everything for the test assertions.
//   places.googleapis.com   Places API (New) Text Search, with pagination
//   www.googleapis.com      PageSpeed Insights v5 + Gmail API v1 (drafts, messages, labels)
//   sheets.googleapis.com   Google Sheets API v4 (a small stateful spreadsheet engine)
//   oauth2.googleapis.com   OAuth token refresh
//   api.anthropic.com       Claude Messages API
//   *.test                  the fake business websites from tests/fixtures/businesses.js

const http = require('http');
const https = require('https');
const tls = require('tls');
const fs = require('fs');
const fx = require('../fixtures/businesses');

const KEYS = { google: 'test-google-key', anthropic: 'test-anthropic-key', oauth: 'ya29.test-access-token' };
const API_HOSTS = ['places.googleapis.com', 'www.googleapis.com', 'sheets.googleapis.com', 'oauth2.googleapis.com', 'gmail.googleapis.com', 'api.anthropic.com'];

function siteHosts() {
  return fx.BUSINESSES.filter((b) => b.place.website && !b.unresolvable).map((b) => new URL(b.place.website).hostname);
}

// ---------------- Google Sheets engine ----------------

function colToIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function indexToCol(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseRange(a1) {
  let range = decodeURIComponent(a1);
  let sheet = range;
  let cells = '';
  const bang = range.lastIndexOf('!');
  if (bang >= 0) {
    sheet = range.slice(0, bang);
    cells = range.slice(bang + 1);
  }
  sheet = sheet.replace(/^'(.*)'$/, '$1').replace(/''/g, "'");
  const out = { sheet, c1: 0, r1: 0, c2: null, r2: null };
  if (!cells) return out;
  const parts = cells.split(':');
  const parse = (p) => {
    const m = p.match(/^([A-Za-z]*)(\d*)$/);
    if (!m) throw new Error(`bad range ${a1}`);
    return { c: m[1] ? colToIndex(m[1]) : null, r: m[2] ? Number(m[2]) - 1 : null };
  };
  const a = parse(parts[0]);
  const b = parts[1] !== undefined ? parse(parts[1]) : a;
  out.c1 = a.c === null ? 0 : a.c;
  out.r1 = a.r === null ? 0 : a.r;
  out.c2 = b.c;
  out.r2 = b.r;
  return out;
}

class FakeSheets {
  constructor() {
    this.books = new Map();
    this.log = [];
  }
  create(id, tabs) {
    this.books.set(id, { id, title: `Book ${id}`, sheets: Object.entries(tabs).map(([title, rows], i) => ({ title, sheetId: i === 0 ? 0 : 1000 + i, rows: rows.map((r) => [...r]) })) });
  }
  tab(id, title) {
    const book = this.books.get(id);
    if (!book) return null;
    return book.sheets.find((s) => s.title === title) || null;
  }
  rows(id, title) {
    const t = this.tab(id, title);
    return t ? t.rows : null;
  }
  objects(id, title) {
    const rows = this.rows(id, title) || [];
    const [head, ...rest] = rows;
    return rest.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
  }
  trimmed(rows) {
    const out = rows.map((r) => {
      const c = [...r];
      while (c.length && (c[c.length - 1] === '' || c[c.length - 1] === null || c[c.length - 1] === undefined)) c.pop();
      return c;
    });
    while (out.length && !out[out.length - 1].length) out.pop();
    return out;
  }
  read(id, a1) {
    const r = parseRange(a1);
    const t = this.tab(id, r.sheet);
    if (!t) return null;
    const rows = this.trimmed(t.rows);
    const r2 = r.r2 === null ? rows.length - 1 : r.r2;
    const values = [];
    for (let i = r.r1; i <= r2 && i < rows.length; i++) {
      const row = rows[i] || [];
      const c2 = r.c2 === null ? row.length - 1 : r.c2;
      values.push(row.slice(r.c1, c2 + 1));
    }
    return this.trimmed(values);
  }
  write(id, a1, values) {
    const r = parseRange(a1);
    const t = this.tab(id, r.sheet);
    if (!t) return null;
    values.forEach((row, i) => {
      const ri = r.r1 + i;
      while (t.rows.length <= ri) t.rows.push([]);
      row.forEach((v, j) => {
        const ci = r.c1 + j;
        while (t.rows[ri].length <= ci) t.rows[ri].push('');
        if (v !== null && v !== undefined) t.rows[ri][ci] = v;
      });
    });
    return { updatedRange: `${r.sheet}!${indexToCol(r.c1)}${r.r1 + 1}`, updatedRows: values.length, updatedCells: values.reduce((a, row) => a + row.length, 0) };
  }
  append(id, a1, values) {
    const r = parseRange(a1);
    const t = this.tab(id, r.sheet);
    if (!t) return null;
    const last = this.trimmed(t.rows).length;
    return this.write(id, `${r.sheet}!${indexToCol(r.c1)}${last + 1}`, values);
  }
}

// ---------------- MIME (Gmail drafts) ----------------

function decodeQuotedPrintable(s) {
  const bytes = [];
  const text = s.replace(/=\r?\n/g, '');
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '=' && /^[0-9A-F]{2}$/i.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...Buffer.from(text[i], 'utf8'));
  }
  return Buffer.from(bytes).toString('utf8');
}

function decodeHeaderWords(v) {
  return v.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (m, cs, enc, data) =>
    enc.toUpperCase() === 'B' ? Buffer.from(data, 'base64').toString('utf8') : decodeQuotedPrintable(data.replace(/_/g, ' ')),
  );
}

function parseMime(raw) {
  const text = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const split = text.search(/\r?\n\r?\n/);
  const headText = text.slice(0, split).replace(/\r?\n[ \t]+/g, ' ');
  let body = text.slice(split).replace(/^\r?\n\r?\n/, '');
  const headers = {};
  for (const line of headText.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = decodeHeaderWords(line.slice(i + 1).trim());
  }
  const ctype = headers['content-type'] || '';
  const boundary = (ctype.match(/boundary="?([^";]+)"?/) || [])[1];
  let enc = (headers['content-transfer-encoding'] || '').toLowerCase();
  if (boundary) {
    const part = body.split(`--${boundary}`).find((p) => /content-type:\s*text\/plain/i.test(p)) || '';
    const ps = part.search(/\r?\n\r?\n/);
    const ph = part.slice(0, ps);
    enc = ((ph.match(/content-transfer-encoding:\s*([^\r\n]+)/i) || [])[1] || '').toLowerCase();
    body = part.slice(ps).replace(/^\r?\n\r?\n/, '');
  }
  if (enc === 'quoted-printable') body = decodeQuotedPrintable(body);
  else if (enc === 'base64') body = Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  return { headers, body: body.replace(/\r\n/g, '\n').trim() };
}

// ---------------- the server ----------------

class Mocks {
  constructor(certs) {
    this.certs = certs;
    this.sheets = new FakeSheets();
    this.reset();
  }

  reset() {
    this.calls = { places: [], psi: [], claude: [], sites: [], gmail: [], oauth: [], unknown: [] };
    this.drafts = [];
    this.gmailMessages = [];
    this.claudeAttempts = new Map();
    this.counter = 0;
  }

  record(kind, req, extra) {
    this.calls[kind].push(Object.assign({ method: req.method, host: req.headers.host, url: req.url, headers: req.headers }, extra || {}));
  }

  async start() {
    const handler = (req, res) => {
      let chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          this.route(req, res, raw);
        } catch (e) {
          this.send(res, 500, { error: { code: 500, message: `mock crashed: ${e.message}` } });
          this.calls.unknown.push({ host: req.headers.host, url: req.url, crash: e.stack });
        }
      });
    };
    const main = { key: fs.readFileSync(this.certs.key), cert: fs.readFileSync(this.certs.cert) };
    const wrong = tls.createSecureContext({ key: fs.readFileSync(this.certs.wrongKey), cert: fs.readFileSync(this.certs.wrongCert) });
    const bad = new Set(fx.BUSINESSES.filter((b) => b.badCert).map((b) => new URL(b.place.website).hostname));
    this.https = https.createServer(Object.assign({}, main, { SNICallback: (name, cb) => cb(null, bad.has(name) ? wrong : tls.createSecureContext(main)) }), handler);
    this.http = http.createServer(handler);
    await new Promise((r) => this.https.listen(443, '127.0.0.1', r));
    await new Promise((r) => this.http.listen(80, '127.0.0.1', r));
  }

  async stop() {
    for (const s of [this.https, this.http]) if (s) await new Promise((r) => s.close(r));
  }

  send(res, status, body, headers) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, Object.assign({ 'content-type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8' }, headers || {}));
    res.end(text);
  }

  route(req, res, raw) {
    const host = String(req.headers.host || '').split(':')[0];
    const url = new URL(req.url, `https://${host}`);
    if (host === 'places.googleapis.com') return this.places(req, res, raw, url);
    if (host === 'www.googleapis.com' && url.pathname.startsWith('/pagespeedonline/')) return this.pagespeed(req, res, url);
    if ((host === 'www.googleapis.com' || host === 'gmail.googleapis.com') && url.pathname.startsWith('/gmail/')) return this.gmail(req, res, raw, url);
    if (host === 'sheets.googleapis.com') return this.sheetsApi(req, res, raw, url);
    if (host === 'oauth2.googleapis.com' || (host === 'www.googleapis.com' && url.pathname.includes('token'))) {
      this.record('oauth', req, { body: raw });
      return this.send(res, 200, { access_token: KEYS.oauth, expires_in: 3599, token_type: 'Bearer', scope: 'https://www.googleapis.com/auth/spreadsheets' });
    }
    if (host === 'api.anthropic.com') return this.anthropic(req, res, raw, url);
    const b = fx.BUSINESSES.find((x) => x.place.website && new URL(x.place.website).hostname === host);
    if (b) return this.site(req, res, b, url);
    this.calls.unknown.push({ host, url: req.url, method: req.method });
    return this.send(res, 501, { error: { code: 501, message: `no mock for ${host}${url.pathname}` } });
  }

  // --- Places API (New) ---
  places(req, res, raw, url) {
    const body = raw ? JSON.parse(raw) : {};
    this.record('places', req, { body });
    if (req.headers['x-goog-api-key'] !== KEYS.google) {
      return this.send(res, 400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } });
    }
    if (req.method !== 'POST' || url.pathname !== '/v1/places:searchText') return this.send(res, 404, { error: { code: 404, message: 'Not found', status: 'NOT_FOUND' } });
    const mask = String(req.headers['x-goog-fieldmask'] || '');
    for (const f of ['places.id', 'places.displayName', 'places.websiteUri', 'places.rating', 'places.userRatingCount', 'nextPageToken']) {
      if (!mask.split(',').includes(f)) return this.send(res, 400, { error: { code: 400, message: `FieldMask is missing ${f}`, status: 'INVALID_ARGUMENT' } });
    }
    if (!body.textQuery) return this.send(res, 400, { error: { code: 400, message: 'textQuery is required', status: 'INVALID_ARGUMENT' } });
    if (body.pageSize !== undefined && (body.pageSize < 1 || body.pageSize > 20)) return this.send(res, 400, { error: { code: 400, message: 'pageSize must be 1-20', status: 'INVALID_ARGUMENT' } });
    if (/forbidden/i.test(body.textQuery)) {
      return this.send(res, 403, { error: { code: 403, message: 'Places API (New) has not been used in project 12345 before or it is disabled.', status: 'PERMISSION_DENIED' } });
    }
    if (/nothing/i.test(body.textQuery)) return this.send(res, 200, {});
    const [page1, page2] = fx.placesPages();
    if (!body.pageToken) return this.send(res, 200, page1);
    if (body.pageToken === 'PAGE2TOKEN') return this.send(res, 200, page2);
    return this.send(res, 400, { error: { code: 400, message: 'Invalid pageToken', status: 'INVALID_ARGUMENT' } });
  }

  // --- PageSpeed Insights ---
  pagespeed(req, res, url) {
    this.record('psi', req, { target: url.searchParams.get('url'), strategy: url.searchParams.get('strategy'), categories: url.searchParams.getAll('category') });
    if (req.headers['x-goog-api-key'] !== KEYS.google) return this.send(res, 400, { error: { code: 400, message: 'API key not valid.', status: 'INVALID_ARGUMENT' } });
    const target = url.searchParams.get('url') || '';
    let host = '';
    try {
      host = new URL(target).hostname;
    } catch (e) {
      return this.send(res, 400, { error: { code: 400, message: 'Invalid URL', status: 'INVALID_ARGUMENT' } });
    }
    const b = fx.BUSINESSES.find((x) => x.place.website && new URL(x.place.website).hostname === host);
    if (!b) return this.send(res, 400, { error: { code: 400, message: 'Unknown site', status: 'INVALID_ARGUMENT' } });
    if (b.psi && b.psi.error) return this.send(res, 500, { error: { code: 500, message: 'Lighthouse returned error: Something went wrong.', status: 'INTERNAL' } });
    return this.send(res, 200, fx.psiResponse(b));
  }

  // --- business websites ---
  site(req, res, b, url) {
    this.record('sites', req, { key: b.key, ua: req.headers['user-agent'] });
    if (b.status) return this.send(res, b.status, `<html><body>HTTP ${b.status}</body></html>`);
    if (url.pathname !== '/' && url.pathname !== '') return this.send(res, 404, '<html><body>Not found</body></html>');
    return this.send(res, 200, b.html);
  }

  // --- Claude ---
  anthropic(req, res, raw, url) {
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch (e) {
      return this.send(res, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'Body is not valid JSON' } });
    }
    const content = String((body.messages && body.messages[0] && body.messages[0].content) || '');
    const business = ((content.match(/^Business name: (.+)$/m) || content.match(/^Business: (.+)$/m) || [])[1] || '').trim();
    this.record('claude', req, { body, business });
    const err = (status, type, message) => this.send(res, status, { type: 'error', error: { type, message } });
    if (url.pathname !== '/v1/messages' || req.method !== 'POST') return err(404, 'not_found_error', 'Not found');
    if (req.headers['x-api-key'] !== KEYS.anthropic) return err(401, 'authentication_error', 'invalid x-api-key');
    if (req.headers['anthropic-version'] !== '2023-06-01') return err(400, 'invalid_request_error', 'anthropic-version header is required');
    if (typeof body.model !== 'string' || !Number.isInteger(body.max_tokens) || !Array.isArray(body.messages)) return err(400, 'invalid_request_error', 'model, max_tokens and messages are required');
    if (body.fallbacks !== undefined && req.headers['anthropic-beta'] !== 'server-side-fallback-2026-07-01') return err(400, 'invalid_request_error', 'fallbacks requires the server-side-fallback-2026-07-01 beta header');
    if (body.thinking && body.thinking.type === 'disabled') return err(400, 'invalid_request_error', 'thinking cannot be disabled on this model');
    const fmt = body.output_config && body.output_config.format;
    if (fmt && (fmt.type !== 'json_schema' || !fmt.schema || fmt.schema.additionalProperties !== false)) return err(400, 'invalid_request_error', 'invalid output_config.format');
    const b = fx.BUSINESSES.find((x) => x.place.name === business);
    const attempts = (this.claudeAttempts.get(business) || 0) + 1;
    this.claudeAttempts.set(business, attempts);
    const isFollowUp = /follow-up/i.test(String(body.system));
    if ((b && b.aiFails) || /AI Fail/.test(business)) return err(529, 'overloaded_error', 'Overloaded');
    if (b && b.aiTransientFail && attempts === 1) return err(529, 'overloaded_error', 'Overloaded');
    let payload;
    if (isFollowUp) {
      payload = { email_body: `Hi ${business} team,\n\nFollowing up on my note about your website. Would a short video walkthrough help?` };
    } else {
      const shortName = (content.match(/^Short name to use: (.+)$/m) || [])[1] || business;
      const first = content.match(/^1\. ([^:]+): (.+)$/m) || ['', 'Problem', 'details'];
      payload = {
        subject: `${first[1].toLowerCase()} at ${shortName}`,
        email_body: `Hi ${shortName} team,\n\nI noticed this: ${first[2]}\n\nWould a free walkthrough of the fix be useful?`,
        dm_message: `Hi! Quick note: ${first[1].toLowerCase()}. Want a free walkthrough?`,
        call_opener: `Hi, I noticed something about ${shortName}'s website and had a quick idea.`,
      };
    }
    const text = b && b.aiFencedJson ? '```json\n' + JSON.stringify(payload, null, 2) + '\n```' : JSON.stringify(payload);
    return this.send(res, 200, {
      id: `msg_${++this.counter}`,
      type: 'message',
      role: 'assistant',
      model: body.model,
      content: [
        { type: 'thinking', thinking: '', signature: 'mock-signature' },
        { type: 'text', text },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1200, output_tokens: 180 },
    });
  }

  // --- Gmail ---
  seedGmail(messages) {
    this.gmailMessages.push(...messages);
  }

  gmail(req, res, raw, url) {
    this.record('gmail', req, { body: raw ? raw.slice(0, 20000) : '' });
    if (req.headers.authorization !== `Bearer ${KEYS.oauth}`) return this.send(res, 401, { error: { code: 401, message: 'Invalid Credentials', status: 'UNAUTHENTICATED' } });
    const p = url.pathname.replace(/^\/gmail\/v1\/users\/me/, '');
    if (p === '/labels' && req.method === 'GET') {
      return this.send(res, 200, { labels: [{ id: 'INBOX', name: 'INBOX', type: 'system' }, { id: 'SENT', name: 'SENT', type: 'system' }, { id: 'DRAFT', name: 'DRAFT', type: 'system' }, { id: 'UNREAD', name: 'UNREAD', type: 'system' }] });
    }
    if (p === '/drafts' && req.method === 'POST') {
      const body = JSON.parse(raw);
      const mime = parseMime(body.message.raw);
      const to = mime.headers.to || '';
      if (/bright-smile\.test|bad\.test/.test(to)) return this.send(res, 400, { error: { code: 400, message: 'Invalid To header', status: 'INVALID_ARGUMENT' } });
      if (body.message.threadId && !/^t-/.test(body.message.threadId)) return this.send(res, 404, { error: { code: 404, message: 'Requested entity was not found.', status: 'NOT_FOUND' } });
      const n = ++this.counter;
      const draft = { id: `r-${n}`, message: { id: `m-${n}`, threadId: body.message.threadId || `t-${n}`, labelIds: ['DRAFT'] } };
      this.drafts.push({ draft, to, subject: mime.headers.subject || '', body: mime.body, threadId: body.message.threadId || '', headers: mime.headers });
      return this.send(res, 200, draft);
    }
    if (p === '/messages' && req.method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const found = this.gmailMessages.filter((m) => matchesGmailQuery(m, q));
      const out = { resultSizeEstimate: found.length };
      if (found.length) out.messages = found.map((m) => ({ id: m.id, threadId: m.threadId }));
      return this.send(res, 200, out);
    }
    const thread = p.match(/^\/threads\/([^/]+)$/);
    if (thread && req.method === 'GET') {
      const msgs = this.gmailMessages.filter((x) => x.threadId === thread[1]).sort((a, b) => a.internalDate - b.internalDate);
      if (!msgs.length) return this.send(res, 404, { error: { code: 404, message: 'Requested entity was not found.', status: 'NOT_FOUND' } });
      return this.send(res, 200, {
        id: thread[1],
        historyId: '1',
        messages: msgs.map((m) => ({ id: m.id, threadId: m.threadId, labelIds: m.labelIds, payload: { headers: [{ name: 'Message-ID', value: `<${m.id}@mail.test>` }] } })),
      });
    }
    const one = p.match(/^\/messages\/([^/]+)$/);
    if (one && req.method === 'GET') {
      const m = this.gmailMessages.find((x) => x.id === one[1]);
      if (!m) return this.send(res, 404, { error: { code: 404, message: 'Not Found', status: 'NOT_FOUND' } });
      return this.send(res, 200, {
        id: m.id,
        threadId: m.threadId,
        labelIds: m.labelIds,
        snippet: m.snippet || '',
        historyId: '1',
        internalDate: String(m.internalDate),
        sizeEstimate: 1000,
        payload: { partId: '', mimeType: 'text/plain', filename: '', headers: [{ name: 'From', value: m.from }, { name: 'To', value: m.to }, { name: 'Subject', value: m.subject || '' }] },
      });
    }
    this.calls.unknown.push({ host: 'gmail', url: req.url, method: req.method });
    return this.send(res, 501, { error: { code: 501, message: `gmail mock: ${req.method} ${p}` } });
  }

  // --- Sheets ---
  sheetsApi(req, res, raw, url) {
    const body = raw ? JSON.parse(raw) : {};
    this.sheets.log.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body });
    if (req.headers.authorization !== `Bearer ${KEYS.oauth}`) return this.send(res, 401, { error: { code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED' } });
    const m = url.pathname.match(/^\/v4\/spreadsheets\/([^/:]+)(.*)$/);
    if (!m) return this.send(res, 404, { error: { code: 404, message: 'Not found' } });
    const id = m[1];
    const rest = m[2];
    const book = this.sheets.books.get(id);
    if (!book) return this.send(res, 404, { error: { code: 404, message: 'Requested entity was not found.', status: 'NOT_FOUND' } });
    const notFoundTab = (a1) => this.send(res, 400, { error: { code: 400, message: `Unable to parse range: ${decodeURIComponent(a1)}`, status: 'INVALID_ARGUMENT' } });
    if (rest === '' && req.method === 'GET') {
      return this.send(res, 200, {
        spreadsheetId: id,
        properties: { title: book.title, locale: 'en_US', timeZone: 'Etc/GMT' },
        sheets: book.sheets.map((s, i) => ({ properties: { sheetId: s.sheetId, title: s.title, index: i, sheetType: 'GRID', gridProperties: { rowCount: 1000, columnCount: 40 } } })),
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}/edit`,
      });
    }
    if (rest === ':batchUpdate' && req.method === 'POST') return this.send(res, 200, { spreadsheetId: id, replies: (body.requests || []).map(() => ({})) });
    if (rest === '/values:batchUpdate' && req.method === 'POST') {
      let cells = 0;
      for (const d of body.data || []) {
        const r = this.sheets.write(id, d.range, d.values);
        if (!r) return notFoundTab(d.range);
        cells += r.updatedCells;
      }
      return this.send(res, 200, { spreadsheetId: id, totalUpdatedCells: cells, responses: [] });
    }
    const v = rest.match(/^\/values\/(.+?)(:append|:clear)?$/);
    if (v) {
      const a1 = v[1];
      if (!v[2] && req.method === 'GET') {
        const values = this.sheets.read(id, a1);
        if (!values) return notFoundTab(a1);
        const out = { range: decodeURIComponent(a1), majorDimension: 'ROWS' };
        if (values.length) out.values = values;
        return this.send(res, 200, out);
      }
      if (!v[2] && req.method === 'PUT') {
        const r = this.sheets.write(id, a1, body.values || []);
        if (!r) return notFoundTab(a1);
        return this.send(res, 200, Object.assign({ spreadsheetId: id }, r));
      }
      if (v[2] === ':append' && req.method === 'POST') {
        const r = this.sheets.append(id, a1, body.values || []);
        if (!r) return notFoundTab(a1);
        return this.send(res, 200, { spreadsheetId: id, updates: Object.assign({ spreadsheetId: id }, r) });
      }
    }
    this.calls.unknown.push({ host: 'sheets', url: req.url, method: req.method });
    return this.send(res, 501, { error: { code: 501, message: `sheets mock: ${req.method} ${rest}` } });
  }
}

function matchesGmailQuery(m, q) {
  const labels = m.labelIds || [];
  let rest = q;
  const take = (re) => {
    const found = [];
    rest = rest.replace(re, (all, x) => {
      found.push(x);
      return ' ';
    });
    return found;
  };
  const braces = take(/\{([^}]*)\}/g);
  const neg = take(/-in:(\w+)/g);
  const pos = take(/(?:^|\s)in:(\w+)/g);
  const newer = take(/newer_than:(\d+)d/g);
  for (const l of pos) if (!labels.includes(l.toUpperCase())) return false;
  for (const l of neg) if (labels.includes(l.toUpperCase())) return false;
  for (const d of newer) if (Number(m.internalDate) < Date.now() - Number(d) * 86400000) return false;
  for (const group of braces) {
    const terms = group.trim().split(/\s+/);
    const ok = terms.some((t) => {
      const [k, val] = t.split(':');
      if (k === 'to') return String(m.to).toLowerCase().includes(val.toLowerCase());
      if (k === 'from') return String(m.from).toLowerCase().includes(val.toLowerCase());
      return false;
    });
    if (!ok) return false;
  }
  if (rest.trim()) throw new Error(`gmail mock cannot parse query part: ${rest.trim()}`);
  return true;
}

module.exports = { Mocks, KEYS, API_HOSTS, siteHosts, parseRange, parseMime, matchesGmailQuery, FakeSheets };
