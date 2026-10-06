// Shared helpers. Plain functions only: this file is embedded into n8n Code nodes by scripts/build.js.
// n8n runs Code nodes in a sandbox with only standard JavaScript built-ins, so nothing here (or in any
// src/lib file) may use require(), URL, Buffer, timers or other Node/browser APIs.

function str(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

function num(v, fallback = null) {
  if (v === '' || v === null || v === undefined || typeof v === 'boolean') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function int(v, fallback = 0) {
  const n = num(v, null);
  return n === null ? fallback : Math.trunc(n);
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function round(n, digits = 0) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function median(values) {
  const a = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function truthy(v) {
  if (typeof v === 'boolean') return v;
  return ['true', 'yes', 'y', '1', 'on'].includes(str(v).toLowerCase());
}

const URL_RE = /^(https?):\/\/(?:[^/?#@]*@)?([^/?#:\s]+)(?::(\d{1,5}))?([^?#]*)(\?[^#]*)?(#.*)?$/i;

// Minimal URL parser (n8n's Code sandbox has no URL class). Returns null for anything that is not http(s).
function parseUrl(value) {
  const m = str(value).match(URL_RE);
  if (!m) return null;
  const hostname = m[2].toLowerCase().replace(/\.$/, '');
  if (!hostname.includes('.') || hostname.startsWith('.') || hostname.includes('..')) return null;
  return {
    protocol: m[1].toLowerCase() + ':',
    hostname,
    port: m[3] || '',
    pathname: m[4] ? (m[4].startsWith('/') ? m[4] : '/' + m[4]) : '/',
    search: m[5] && m[5] !== '?' ? m[5] : '',
    hash: m[6] || '',
  };
}

function formatUrl(u) {
  return `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname.replace(/ /g, '%20')}${u.search.replace(/ /g, '%20')}`;
}

// Returns a canonical absolute http(s) URL, or '' when the value is not a usable web address.
function normalizeUrl(value) {
  let s = str(value);
  if (!s) return '';
  if (/^\/\//.test(s)) s = 'http:' + s;
  if (!/^https?:\/\//i.test(s)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
    s = 'http://' + s;
  }
  const u = parseUrl(s);
  return u ? formatUrl(u) : '';
}

function hostOf(url) {
  const u = parseUrl(url);
  return u ? u.hostname.replace(/^www\./, '') : '';
}

// Resolves a link found on pageUrl (absolute, protocol-relative, root-relative or relative).
function resolveUrl(href, pageUrl) {
  const h = str(href);
  const base = parseUrl(pageUrl);
  if (!h || !base) return '';
  if (/^https?:\/\//i.test(h)) return normalizeUrl(h.split('#')[0]);
  if (h.startsWith('//')) return normalizeUrl(base.protocol + h.split('#')[0]);
  if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('#')) return '';
  const clean = h.split('#')[0];
  let pathPart = clean;
  let query = '';
  const q = clean.indexOf('?');
  if (q >= 0) {
    pathPart = clean.slice(0, q);
    query = clean.slice(q);
  }
  let path;
  if (pathPart.startsWith('/')) path = pathPart;
  else {
    const dir = base.pathname.replace(/[^/]*$/, '');
    path = dir + pathPart;
  }
  const parts = [];
  for (const seg of path.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  path = parts.join('/');
  if (!path.startsWith('/')) path = '/' + path;
  return formatUrl({ protocol: base.protocol, hostname: base.hostname, port: base.port, pathname: path || '/', search: query === '?' ? '' : query });
}

function isoDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function utcDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Date.UTC silently rolls 25/09 into the 9th month of the next year: reject impossible dates instead.
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
}

// Parses dates written by people or by Google Sheets ("2026-10-06", "10/6/2026", "25/09/2026", "06.10.2026",
// a Sheets serial day number, "2026-10-06T09:00:00Z"). Slashed dates are month-first unless the first number is
// over 12 or options.dayFirst is set; dotted dates (06.10.2026) are day-first. Impossible dates return null.
function parseDate(value, options) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Google Sheets serial day number (days since 1899-12-30) or epoch milliseconds.
    if (value > 20000 && value < 80000) return new Date(Math.round((value - 25569) * 86400000));
    if (value > 1e11) return new Date(value);
    return null;
  }
  const s = str(value);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const parts = s.match(/^(\d{1,2})([/.])(\d{1,2})\2(\d{4})$/);
  if (parts) {
    const a = Number(parts[1]);
    const b = Number(parts[3]);
    const y = Number(parts[4]);
    const dayFirst = a > 12 || (b <= 12 && (parts[2] === '.' || Boolean(options && options.dayFirst)));
    return dayFirst ? utcDate(y, b, a) : utcDate(y, a, b);
  }
  if (/^\d+(\.\d+)?$/.test(s)) return parseDate(Number(s));
  if (/^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(s)) return null; // other numeric forms are too ambiguous to guess
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function oneLine(s) {
  return str(s).replace(/\s+/g, ' ');
}

function truncate(s, max) {
  const t = str(s);
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function plural(n, word, pluralWord) {
  return `${n} ${n === 1 ? word : pluralWord || word + 's'}`;
}

// Turns "Sunrise Family Dental & Orthodontics, LLC" into "Sunrise Family Dental" for friendlier copy.
function shortBusinessName(name) {
  let s = str(name)
    .replace(/\s*[,|–—-]\s*(llc|inc|ltd|pllc|pc|co|corp|pvt\.? ltd|private limited)\.?$/i, '')
    .replace(/\s*\((.*?)\)\s*$/, '');
  const cut = s.split(/\s+[|–—]\s+|\s+-\s+/)[0];
  s = cut && cut.length >= 3 ? cut : s;
  return s.trim() || str(name);
}

// @export
module.exports = {
  str,
  num,
  int,
  clamp,
  round,
  median,
  truthy,
  parseUrl,
  formatUrl,
  normalizeUrl,
  hostOf,
  resolveUrl,
  isoDate,
  parseDate,
  daysBetween,
  oneLine,
  truncate,
  plural,
  shortBusinessName,
};
