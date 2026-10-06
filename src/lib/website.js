// Website checks: classify the homepage fetch result and read signals out of the HTML.
// Everything here is evidence that ends up in a pitch, so each check is conservative:
// when we are not sure, we report "unknown" instead of claiming a problem.

// @node-only-start
const { str, int, hostOf, resolveUrl } = require('./util');
// @node-only-end

const MAX_HTML_CHARS = 1500000;

// Classifies the n8n HTTP Request output for the homepage fetch
// (fullResponse + neverError + text format, output field "html").
function classifyFetch(resp) {
  const r = resp || {};
  if (r.error) {
    const msg = str(r.error.message || r.error.description || r.error);
    const code = str(r.error.code || '');
    const text = `${msg} ${code}`;
    let reason = 'error';
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) reason = 'domain-not-found';
    else if (/CERT_|certificate|SSL|TLS|self[- ]signed|unable to verify|ERR_TLS|EPROTO|wrong version number/i.test(text)) reason = 'ssl-error';
    else if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNABORTED|timed out/i.test(text)) reason = 'timeout';
    else if (/ECONNREFUSED|ECONNRESET|socket hang up|EHOSTUNREACH|ENETUNREACH/i.test(text)) reason = 'connection-failed';
    else if (/redirect/i.test(text)) reason = 'redirect-loop';
    return { status: reason, statusCode: null, reachable: false, html: '', detail: msg.slice(0, 200) };
  }
  const statusCode = int(r.statusCode, 0);
  const html = typeof r.html === 'string' ? r.html : typeof r.data === 'string' ? r.data : typeof r.body === 'string' ? r.body : '';
  if (statusCode >= 200 && statusCode < 400) return { status: 'ok', statusCode, reachable: true, html, detail: '' };
  if ([401, 403, 406, 429, 503].includes(statusCode)) {
    // Usually a bot-protection page (Cloudflare etc.). The site may be fine for humans: do not judge it.
    return { status: 'blocked', statusCode, reachable: true, html: '', detail: `HTTP ${statusCode}` };
  }
  if (statusCode === 404 || statusCode === 410) return { status: 'not-found', statusCode, reachable: false, html: '', detail: `HTTP ${statusCode}` };
  if (statusCode >= 500) return { status: 'server-error', statusCode, reachable: false, html: '', detail: `HTTP ${statusCode}` };
  return { status: 'unknown', statusCode, reachable: true, html: '', detail: statusCode ? `HTTP ${statusCode}` : 'empty response' };
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&(amp|commat|period|nbsp|copy|quot|lt|gt);/gi, (m, n) => ({ amp: '&', commat: '@', period: '.', nbsp: ' ', copy: '©', quot: '"', lt: '<', gt: '>' })[n.toLowerCase()]);
}

// Cloudflare "email protection" obfuscates addresses as hex; reverse it.
function decodeCfEmail(hex) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2) return '';
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

const JUNK_EMAIL_DOMAINS = /(^|\.)(example\.(com|org|net)|domain\.com|email\.com|yourdomain\.com|yoursite\.com|company\.com|sentry\.io|sentry-next\.wixpress\.com|wixpress\.com|wix\.com|squarespace\.com|godaddy\.com|schema\.org|w3\.org|google\.com|googleapis\.com|gstatic\.com|cloudflare\.com|jquery\.com|bootstrapcdn\.com|facebook\.com|instagram\.com|twitter\.com|x\.com)$/i;
const ASSET_SUFFIX = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|woff2?|ttf|eot|mp4|webm|pdf)$/i;
const ROLE_PREFIX = /^(info|contact|hello|hi|office|admin|reception|frontdesk|front\.?desk|appointments?|bookings?|enquiries|inquiries|enquiry|inquiry|team|support|sales|mail|care|clinic)$/i;

function isPlausibleEmail(email) {
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i.test(email)) return false;
  const [local, domain] = email.split('@');
  if (local.length > 64 || domain.length > 253 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (JUNK_EMAIL_DOMAINS.test(domain) || ASSET_SUFFIX.test(email)) return false;
  if (/^[0-9a-f]{24,}$/i.test(local)) return false; // tracking / error-reporting ids
  if (/^(user|username|name|email|your\.?email|you|someone|test|noreply|no-reply|donotreply|do-not-reply)$/i.test(local)) return false;
  if (/@\d+x\./i.test(email)) return false; // retina image names like logo@2x.png
  return true;
}

function extractEmails(html, siteUrl) {
  const found = new Map();
  const add = (raw, weight) => {
    const email = decodeEntities(str(raw)).toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/[.,;:]+$/, '');
    if (!isPlausibleEmail(email)) return;
    found.set(email, Math.max(found.get(email) || 0, weight));
  };
  const text = html.slice(0, MAX_HTML_CHARS);
  for (const m of text.matchAll(/href\s*=\s*["']\s*mailto:([^"'?\s>]+)/gi)) add(decodeURIComponent(m[1]), 3);
  for (const m of text.matchAll(/data-cfemail\s*=\s*["']([0-9a-f]+)["']/gi)) add(decodeCfEmail(m[1]), 3);
  const visible = decodeEntities(text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '));
  for (const m of visible.matchAll(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi)) add(m[0], 1);
  for (const m of visible.matchAll(/([a-z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\s+at\s+)\s*([a-z0-9-]+(?:\.[a-z0-9-]+)*)\s*(?:\[dot\]|\(dot\)|\s+dot\s+)\s*([a-z]{2,24})\b/gi)) {
    add(`${m[1]}@${m[2]}.${m[3]}`, 1);
  }
  const siteHost = hostOf(siteUrl);
  const score = (email) => {
    const [local, domain] = email.split('@');
    let s = found.get(email) * 10;
    if (siteHost && (domain === siteHost || siteHost.endsWith('.' + domain) || domain.endsWith('.' + siteHost))) s += 50;
    if (ROLE_PREFIX.test(local)) s += 20;
    if (/^(info|contact|hello|office)$/i.test(local)) s += 5;
    if (/^(careers|jobs|hr|recruit|press|media|privacy|legal|billing|accounts|webmaster|abuse)/i.test(local)) s -= 30;
    return s;
  };
  return [...found.keys()].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
}

const BOOKING_PATTERNS = [
  ['Calendly', /calendly\.com/i], ['Acuity', /acuityscheduling\.com|as\.me\//i], ['Square Appointments', /squareup\.com\/appointments|square\.site\/book|app\.squareup\.com\/appointments/i],
  ['Setmore', /setmore\.com/i], ['SimplyBook', /simplybook\.(me|it)/i], ['Booksy', /booksy\.com/i], ['Fresha', /fresha\.com/i],
  ['Vagaro', /vagaro\.com/i], ['Mindbody', /mindbodyonline\.com|mindbody\.io/i], ['Zocdoc', /zocdoc\.com/i], ['OpenTable', /opentable\.(com|co\.uk|in)/i],
  ['Resy', /resy\.com/i], ['SevenRooms', /sevenrooms\.com/i], ['Jane', /janeapp\.com/i], ['Schedulicity', /schedulicity\.com/i],
  ['Appointy', /appointy\.com/i], ['YouCanBookMe', /youcanbook\.me/i], ['TidyCal', /tidycal\.com/i], ['Cal.com', /\bcal\.com\//i],
  ['HubSpot Meetings', /meetings\.hubspot\.com/i], ['LocalMed', /localmed\.com/i], ['NexHealth', /nexhealth\.com/i], ['Practo', /practo\.com/i],
  ['Doctolib', /doctolib\./i], ['Treatwell', /treatwell\./i], ['GlossGenius', /glossgenius\.com/i], ['Boulevard', /joinblvd\.com|blvd\.co/i],
  ['Housecall Pro', /housecallpro\.com/i], ['Jobber', /getjobber\.com|clienthub\.getjobber/i], ['ServiceTitan', /servicetitan\.com/i],
  ['Wix Bookings', /wix-bookings|bookings-service/i], ['Squarespace Scheduling', /squarespacescheduling\.com/i], ['Booking widget', /booking-widget|bookingwidget|online-booking/i],
];
const BOOKING_TEXT = /\b(book (an |your )?(appointment|online|now|a (table|visit|consultation|session|call))|schedule (an |your )?(appointment|visit|consultation|online)|request an appointment|online booking|reserve (a table|now|online))\b/i;

const CHAT_PATTERNS = [
  ['Tawk.to', /tawk\.to/i], ['Intercom', /intercom(cdn)?\.(io|com)|widget\.intercom/i], ['Drift', /js\.driftt\.com|drift\.com/i], ['Crisp', /crisp\.chat/i],
  ['Tidio', /tidio(chat)?\.(co|com)/i], ['LiveChat', /livechatinc\.com|cdn\.livechat/i], ['Zendesk', /zdassets\.com|zopim/i], ['HubSpot Chat', /js\.(hs-scripts|usemessages)\.com/i],
  ['Freshchat', /wchat\.freshchat|freshworks\.com\/live-chat|fw-cdn\.com/i], ['Olark', /olark\.com/i], ['Chatra', /chatra\.(io|com)/i], ['Smartsupp', /smartsupp\.com/i],
  ['JivoChat', /jivosite\.com|jivochat/i], ['ManyChat', /manychat\.com/i], ['Botpress', /botpress\.(cloud|com)/i], ['Voiceflow', /voiceflow\.com/i],
  ['Chatbase', /chatbase\.co/i], ['Podium', /podium\.com/i], ['Birdeye', /birdeye\.com/i], ['Gorgias', /gorgias\.(chat|com|io)/i], ['Messenger', /m\.me\/|messenger\.com/i],
];
const WHATSAPP_PATTERN = /wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp:\/\/|chat\.whatsapp\.com/i;

const SOCIAL_PATTERNS = {
  instagram: /instagram\.com\/(?!p\/|reel\/|explore\/|accounts\/)[a-z0-9_.]{2,}/i,
  facebook: /facebook\.com\/(?!sharer|share|dialog|plugins|tr\b|tr\?)[a-z0-9_.\-/?=]{2,}/i,
  tiktok: /tiktok\.com\/@[a-z0-9_.]{2,}/i,
  youtube: /youtube\.com\/(@|c\/|channel\/|user\/)[a-z0-9_.-]{2,}/i,
  linkedin: /linkedin\.com\/(company|in)\/[a-z0-9_.-]{2,}/i,
  x: /(twitter|x)\.com\/(?!share|intent|home)[a-z0-9_]{2,}/i,
};

function findFirst(patterns, html) {
  for (const [name, re] of patterns) if (re.test(html)) return name;
  return '';
}

function extractCopyrightYear(html) {
  const text = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '));
  let best = 0;
  const re = /(?:©|\(c\)|copyright)\s*(?:by\s+)?(?:[a-z&.,'\- ]{0,40}?\s)??((?:19|20)\d{2})(?!\d)(?:\s*[-–—]\s*((?:19|20)\d{2})(?!\d))?/gi;
  for (const m of text.matchAll(re)) {
    const y = Number(m[2] || m[1]);
    if (y > best) best = y;
  }
  return best || null;
}

function resolveSameSiteUrl(href, pageUrl) {
  const url = resolveUrl(href, pageUrl);
  if (!url || hostOf(url) !== hostOf(pageUrl)) return '';
  return url;
}

function findContactUrl(html, pageUrl) {
  const candidates = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const href = m[1];
    const label = m[2].replace(/<[^>]+>/g, ' ');
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    const hit = /contact|kontakt|contacto|get-in-touch|reach-us|enquir|inquir/i;
    if (hit.test(href) || hit.test(label)) {
      const url = resolveSameSiteUrl(href, pageUrl);
      if (url && url !== pageUrl) candidates.push(url);
    }
  }
  return candidates[0] || '';
}

function analyzeHtml(rawHtml, pageUrl) {
  const html = str(rawHtml).slice(0, MAX_HTML_CHARS);
  const lower = html.toLowerCase();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : '';
  const metaDesc = html.match(/<meta[^>]+name\s*=\s*["']description["'][^>]*>/i);
  const metaDescContent = metaDesc ? (metaDesc[0].match(/content\s*=\s*["']([^"']*)["']/i) || [])[1] || '' : '';
  const bodyText = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  const booking = findFirst(BOOKING_PATTERNS, html) || (BOOKING_TEXT.test(bodyText) ? 'Booking button' : '');
  const chat = findFirst(CHAT_PATTERNS, html);
  const socials = {};
  for (const [k, re] of Object.entries(SOCIAL_PATTERNS)) socials[k] = re.test(html);
  const isPlaceholder =
    bodyText.length < 2500 &&
    /(this domain (is|may be) for sale|buy this domain|domain is parked|parked (free|domain)|coming soon|under construction|website is under construction|launching soon|site is being built|future home of|account (has been )?suspended|default web page|welcome to nginx|it works!|index of \/)/i.test(bodyText + ' ' + title);
  return {
    title,
    hasTitle: title.length > 0,
    hasMetaDescription: metaDescContent.trim().length > 0,
    hasH1: /<h1[\s>]/i.test(html),
    hasViewport: /<meta[^>]+name\s*=\s*["']viewport["']/i.test(html),
    copyrightYear: extractCopyrightYear(html),
    booking,
    hasBooking: Boolean(booking),
    chat,
    hasChat: Boolean(chat),
    hasWhatsApp: WHATSAPP_PATTERN.test(html),
    socials,
    hasSocial: Boolean(socials.instagram || socials.facebook || socials.tiktok),
    hasAnalytics: /googletagmanager\.com\/(gtag\/js|gtm\.js)|google-analytics\.com\/(analytics|ga)\.js|gtag\(\s*['"]config|\bGTM-[A-Z0-9]{4,}|plausible\.io\/js|static\.cloudflareinsights\.com|clarity\.ms\/tag/i.test(html),
    hasMetaPixel: /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init/i.test(html),
    hasSchema: /<script[^>]+type\s*=\s*["']application\/ld\+json["']/i.test(html) || /itemtype\s*=\s*["']https?:\/\/schema\.org/i.test(lower),
    isPlaceholder,
    emails: extractEmails(html, pageUrl),
    contactUrl: findContactUrl(html, pageUrl),
    textLength: bodyText.length,
  };
}

// @export
module.exports = {
  MAX_HTML_CHARS,
  classifyFetch,
  decodeEntities,
  decodeCfEmail,
  isPlausibleEmail,
  extractEmails,
  extractCopyrightYear,
  findContactUrl,
  analyzeHtml,
};
