// Website checks: classify the homepage fetch result and read signals out of the HTML.
// Everything here is evidence that ends up in a pitch, so each check is conservative:
// when we are not sure, we report "unknown" instead of claiming a problem.
// Every regex is bounded ({0,N} instead of * or +) so a huge or hostile page can't stall the run.

// @node-only-start
const { str, int, hostOf, resolveUrl } = require('./util');
// @node-only-end

const MAX_HTML_CHARS = 600000;
const HTML_HEAD_CHARS = 400000; // a longer page is read as its first 400k + last 200k characters (keeps the footer)

// The part of the page we analyse. Inline data: URIs (images, fonts) are dropped first: they are huge and never evidence.
function clipHtml(raw) {
  const s = str(raw).replace(/data:[a-z0-9.+/-]{1,80};base64,[a-z0-9+/=\s]{200,}/gi, 'data:');
  if (s.length <= MAX_HTML_CHARS) return { html: s, truncated: false };
  return { html: s.slice(0, HTML_HEAD_CHARS) + '\n' + s.slice(s.length - (MAX_HTML_CHARS - HTML_HEAD_CHARS)), truncated: true };
}

// Fetch outcomes that a browser would most likely also see, so they may be claimed (after a second check).
const DOWN_STATUSES = ['domain-not-found', 'connection-refused', 'timeout', 'not-found', 'server-error'];
// Fetch outcomes worth a second attempt before we believe them.
const RECHECK_STATUSES = DOWN_STATUSES.concat(['dns-error', 'connection-failed', 'redirect-loop', 'error', 'unknown']);

// Certificate faults every browser rejects. Anything else (missing intermediate certificate, unknown issuer) can be
// a Node-only problem: Chrome often loads those sites fine, so they are only claimed when PageSpeed (Chrome) agrees.
function sslKindOf(text) {
  if (/CERT_HAS_EXPIRED|certificate has expired|ERR_CERT_DATE_INVALID/i.test(text)) return 'expired';
  if (/CERT_NOT_YET_VALID|certificate is not yet valid/i.test(text)) return 'not-yet-valid';
  if (/ERR_TLS_CERT_ALTNAME_INVALID|altnames|does not match certificate|ERR_CERT_COMMON_NAME_INVALID/i.test(text)) return 'wrong-host';
  if (/DEPTH_ZERO_SELF_SIGNED_CERT|self[- ]signed certificate(?! in)/i.test(text)) return 'self-signed';
  return 'unverified';
}

// Classifies the n8n HTTP Request output for the homepage fetch
// (fullResponse + neverError + text format, output field "html").
function classifyFetch(resp) {
  const r = resp || {};
  if (r.error) {
    const e = r.error;
    const msg = str(typeof e === 'string' ? e : e.message || e.description);
    const cause = e && typeof e === 'object' && e.cause && typeof e.cause === 'object' ? e.cause : {};
    const text = [msg, str(e.code), str(e.description), str(cause.code), str(cause.message), str(e.name)].join(' ');
    let status = 'error';
    let sslKind = '';
    if (/EAI_AGAIN|ESERVFAIL|ETIMEOUT.{0,20}getaddrinfo/i.test(text)) status = 'dns-error'; // temporary resolver failure
    else if (/ENOTFOUND|getaddrinfo/i.test(text)) status = 'domain-not-found';
    else if (/socket disconnected before secure TLS|ECONNRESET|socket hang up|EPIPE/i.test(text)) status = 'connection-failed'; // often a firewall dropping bots
    else if (/ECONNREFUSED/i.test(text)) status = 'connection-refused';
    else if (/CERT|certificate|SSL|TLS|self[- ]signed|unable to verify|EPROTO|wrong version number/i.test(text)) {
      status = 'ssl-error';
      sslKind = sslKindOf(text);
    } else if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNABORTED|timed out/i.test(text)) status = 'timeout';
    else if (/EHOSTUNREACH|ENETUNREACH/i.test(text)) status = 'connection-failed';
    else if (/redirect/i.test(text)) status = 'redirect-loop';
    return { status, sslKind, statusCode: null, reachable: false, html: '', detail: msg.slice(0, 200) };
  }
  const statusCode = int(r.statusCode, 0);
  const html = typeof r.html === 'string' ? r.html : typeof r.data === 'string' ? r.data : typeof r.body === 'string' ? r.body : '';
  if (statusCode >= 200 && statusCode < 400) return { status: 'ok', sslKind: '', statusCode, reachable: true, html, detail: '' };
  if ([401, 403, 406, 429, 503].includes(statusCode)) {
    // Usually a bot-protection page (Cloudflare etc.). The site may be fine for humans: do not judge it.
    return { status: 'blocked', sslKind: '', statusCode, reachable: true, html: '', detail: `HTTP ${statusCode}` };
  }
  if (statusCode === 404 || statusCode === 410) return { status: 'not-found', sslKind: '', statusCode, reachable: false, html: '', detail: `HTTP ${statusCode}` };
  if (statusCode >= 500) return { status: 'server-error', sslKind: '', statusCode, reachable: false, html: '', detail: `HTTP ${statusCode}` };
  return { status: 'unknown', sslKind: '', statusCode, reachable: true, html: '', detail: statusCode ? `HTTP ${statusCode}` : 'empty response' };
}

function decodeEntities(s) {
  return str(s)
    .replace(/&#(\d{1,7});/g, (m, d) => String.fromCharCode(Number(d) % 65536))
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, h) => String.fromCharCode(parseInt(h, 16) % 65536))
    .replace(/&(amp|commat|period|nbsp|copy|quot|lt|gt|apos|ndash|mdash|rsquo);/gi, (m, n) => ({ amp: '&', commat: '@', period: '.', nbsp: ' ', copy: '©', quot: '"', lt: '<', gt: '>', apos: "'", ndash: '–', mdash: '—', rsquo: '’' })[n.toLowerCase()]);
}

// Linear-time helpers (no regex backtracking): drop <script>/<style>/<noscript> blocks, then all tags.
function removeBlocks(s, tag) {
  const lower = s.toLowerCase();
  const open = '<' + tag;
  const close = '</' + tag;
  const out = [];
  let i = 0;
  for (;;) {
    const a = lower.indexOf(open, i);
    if (a < 0) {
      out.push(s.slice(i));
      break;
    }
    const next = lower.charAt(a + open.length);
    if (next && !/[\s>/]/.test(next)) {
      out.push(s.slice(i, a + open.length));
      i = a + open.length;
      continue;
    }
    out.push(s.slice(i, a), ' ');
    const b = lower.indexOf(close, a + open.length);
    if (b < 0) break;
    const end = lower.indexOf('>', b);
    if (end < 0) break;
    i = end + 1;
  }
  return out.join('');
}

function removeTags(s) {
  const out = [];
  let i = 0;
  for (;;) {
    const a = s.indexOf('<', i);
    if (a < 0) {
      out.push(s.slice(i));
      break;
    }
    if (!/[a-zA-Z/!?]/.test(s.charAt(a + 1))) {
      out.push(s.slice(i, a + 1));
      i = a + 1;
      continue;
    }
    out.push(s.slice(i, a), ' ');
    const b = s.indexOf('>', a);
    if (b < 0) break; // unterminated tag: drop the rest
    i = b + 1;
  }
  return out.join('');
}

function stripTags(html) {
  return removeTags(removeBlocks(removeBlocks(removeBlocks(str(html), 'script'), 'style'), 'noscript'));
}

// Cloudflare "email protection" obfuscates addresses as hex; reverse it.
function decodeCfEmail(hex) {
  if (!/^[0-9a-f]{4,400}$/i.test(hex) || hex.length % 2) return '';
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

const JUNK_EMAIL_DOMAINS = /(^|\.)(example\.(com|org|net)|domain\.com|email\.com|yourdomain\.com|yoursite\.com|yourcompany\.com|company\.com|mysite\.com|sentry\.io|sentry-next\.wixpress\.com|wixpress\.com|wix\.com|squarespace\.com|godaddy\.com|schema\.org|w3\.org|google\.com|googleapis\.com|gstatic\.com|cloudflare\.com|jquery\.com|bootstrapcdn\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|styleseat\.com|glossgenius\.com|vagaro\.com|booksy\.com|fresha\.com|mindbodyonline\.com|squareup\.com|square\.site|calendly\.com|setmore\.com|zocdoc\.com|practo\.com|doctolib\.[a-z.]{2,6}|opentable\.[a-z.]{2,6}|toasttab\.com|doordash\.com|ubereats\.com|yelp\.[a-z.]{2,6}|tripadvisor\.[a-z.]{2,6}|weebly\.com|webflow\.(com|io)|shopify\.com|hubspot\.com|mailchimp\.com|elementor\.com|wordpress\.(com|org)|wpengine\.com|automattic\.com)$/i;
const ASSET_SUFFIX = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|woff2?|ttf|eot|mp4|webm|pdf)$/i;
const ROLE_PREFIX = /^(info|contact|hello|hi|office|admin|reception|frontdesk|front\.?desk|appointments?|bookings?|enquiries|inquiries|enquiry|inquiry|team|support|sales|mail|care|clinic)$/i;
const FREE_MAIL = /^(gmail\.com|googlemail\.com|yahoo\.[a-z.]{2,6}|ymail\.com|rocketmail\.com|outlook\.[a-z.]{2,6}|hotmail\.[a-z.]{2,6}|live\.[a-z.]{2,6}|msn\.com|icloud\.com|me\.com|mac\.com|aol\.com|proton\.me|protonmail\.com|pm\.me|gmx\.[a-z.]{2,6}|web\.de|mail\.ru|yandex\.[a-z.]{2,6}|zoho\.com|zohomail\.[a-z.]{2,6}|rediffmail\.com|qq\.com|163\.com|126\.com|comcast\.net|verizon\.net|att\.net|sbcglobal\.net|bellsouth\.net|cox\.net|charter\.net|btinternet\.com|sky\.com|virginmedia\.com|talktalk\.net|bigpond\.com|optusnet\.com\.au|shaw\.ca|rogers\.com|sympatico\.ca|orange\.fr|free\.fr|laposte\.net|libero\.it|t-online\.de)$/i;
// Text right before an address that means it belongs to someone else (the agency that built the site, a host...).
const CREDIT_CONTEXT = /(website|site|web ?design|web ?development|designed|developed|built|powered|hosted|maintained|created|made|marketing|seo|managed)\s{0,3}by\b[^@|•·;,]{0,40}$/i;

function isPlausibleEmail(email) {
  if (!/^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/i.test(email)) return false;
  const [local, domain] = email.split('@');
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..') || domain.includes('..') || domain.startsWith('.') || domain.startsWith('-')) return false;
  if (JUNK_EMAIL_DOMAINS.test(domain) || ASSET_SUFFIX.test(email)) return false;
  if (/^[0-9a-f]{24,}$/i.test(local)) return false; // tracking / error-reporting ids
  if (/^(user|username|name|email|e-?mail|your\.?email|your\.?name|you|someone|test|example|johndoe|john\.?doe|jane\.?doe|janedoe|firstname\.?lastname|noreply|no-reply|donotreply|do-not-reply)$/i.test(local)) return false;
  if (/@\d{1,2}x\./i.test(email)) return false; // retina image names like logo@2x.png
  return true;
}

function sameSite(domain, siteHost) {
  return Boolean(siteHost && (domain === siteHost || siteHost.endsWith('.' + domain) || domain.endsWith('.' + siteHost)));
}

function safeDecodeUri(v) {
  try {
    return decodeURIComponent(v);
  } catch (e) {
    return v;
  }
}

const AT = '(\\[at\\]|\\(at\\)|\\{at\\}|[ \\t]at[ \\t])';
const DOT = '(?:\\[dot\\]|\\(dot\\)|\\{dot\\}|[ \\t]dot[ \\t]|\\.)';
const OBFUSCATED_RE = new RegExp(`(?<![a-z0-9._%+-])([a-z0-9._%+-]{1,64})[ \\t]{0,3}${AT}[ \\t]{0,3}([a-z0-9-]{1,63}(?:[ \\t]{0,3}${DOT}[ \\t]{0,3}[a-z0-9-]{1,63}){1,5})(?![a-z0-9-])`, 'gi');
const PLAIN_EMAIL_RE = /(?<![a-z0-9._%+-])[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63}){0,5}\.[a-z]{2,24}(?![a-z0-9-])/gi;

// Returns { emails, others }: emails = addresses we trust to belong to the business, best first
// (their own domain, then free-mail, then other domains only when the page links to them with mailto:);
// others = addresses seen on the page that we could not attribute to the business.
function collectEmails(html, siteUrl) {
  const found = new Map();
  const add = (raw, weight, context) => {
    const email = decodeEntities(str(raw)).toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/[.,;:]+$/, '');
    if (!isPlausibleEmail(email)) return;
    const credit = CREDIT_CONTEXT.test(str(context).slice(-120));
    const prev = found.get(email);
    if (!prev) found.set(email, { weight, credit });
    else {
      prev.weight = Math.max(prev.weight, weight);
      prev.credit = prev.credit && credit;
    }
  };
  const text = str(html);
  const before = (index) => decodeEntities(stripTags(text.slice(Math.max(0, index - 400), index))).replace(/\s+/g, ' ');
  for (const m of text.matchAll(/href\s{0,3}=\s{0,3}["']?\s{0,3}mailto:([^"'?\s>]{1,320})/gi)) add(safeDecodeUri(m[1]), 3, before(m.index));
  for (const m of text.matchAll(/data-cfemail\s{0,3}=\s{0,3}["']([0-9a-f]{4,400})["']/gi)) add(decodeCfEmail(m[1]), 3, before(m.index));
  // Visible text only: attribute values (placeholders, form defaults) are not the business's address.
  const visible = decodeEntities(stripTags(text)).replace(/\s+/g, ' ');
  for (const m of visible.matchAll(PLAIN_EMAIL_RE)) add(m[0], 1, visible.slice(Math.max(0, m.index - 120), m.index));
  for (const m of visible.matchAll(OBFUSCATED_RE)) {
    const bracketedAt = !/^[ \t]at[ \t]$/i.test(m[2]);
    const obfuscatedDot = /\[dot\]|\(dot\)|\{dot\}|[ \t]dot[ \t]/i.test(m[3]);
    if (!bracketedAt && !obfuscatedDot) continue; // "available at smile.com" is not an address
    const domain = m[3].replace(new RegExp(`[ \\t]{0,3}${DOT}[ \\t]{0,3}`, 'gi'), '.');
    if (!/\.[a-z]{2,24}$/i.test(domain)) continue;
    add(`${m[1]}@${domain}`, 1, visible.slice(Math.max(0, m.index - 120), m.index));
  }
  const siteHost = hostOf(siteUrl);
  const tierOf = (email, info) => {
    const domain = email.split('@')[1];
    if (sameSite(domain, siteHost)) return 3;
    if (info.credit) return 0;
    if (FREE_MAIL.test(domain)) return 2;
    return info.weight >= 3 ? 1 : 0; // another domain: only when the page links to it
  };
  const score = (email) => {
    const info = found.get(email);
    const local = email.split('@')[0];
    let s = tierOf(email, info) * 1000 + info.weight * 10;
    if (ROLE_PREFIX.test(local)) s += 20;
    if (/^(info|contact|hello|office)$/i.test(local)) s += 5;
    if (/^(careers|jobs|hr|recruit|press|media|privacy|legal|billing|accounts|webmaster|abuse|dpo|gdpr|unsubscribe)/i.test(local)) s -= 300;
    return s;
  };
  const ranked = [...found.keys()].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
  return {
    emails: ranked.filter((e) => tierOf(e, found.get(e)) > 0),
    others: ranked.filter((e) => tierOf(e, found.get(e)) === 0),
  };
}

function extractEmails(html, siteUrl) {
  return collectEmails(html, siteUrl).emails;
}

const BOOKING_PATTERNS = [
  ['Calendly', /calendly\.com/i], ['Acuity', /acuityscheduling\.com|\bas\.me\//i], ['Square Appointments', /squareup\.com\/appointments|book\.squareup\.com|square\.site\/book/i],
  ['Setmore', /setmore\.com/i], ['SimplyBook', /simplybook\.(me|it|asia|cc)/i], ['Booksy', /booksy\.com/i], ['Fresha', /fresha\.com/i],
  ['Vagaro', /vagaro\.com/i], ['Mindbody', /mindbodyonline\.com|mindbody\.io|healcode\.com/i], ['Zocdoc', /zocdoc\.com/i], ['OpenTable', /opentable\.(com|co\.uk|in|de|ca|com\.au|jp)/i],
  ['Resy', /resy\.com/i], ['SevenRooms', /sevenrooms\.com/i], ['Tock', /exploretock\.com/i], ['TheFork', /thefork\.|lafourchette\./i], ['Quandoo', /quandoo\./i],
  ['Jane', /janeapp\.com/i], ['Schedulicity', /schedulicity\.com/i], ['Appointy', /appointy\.com/i], ['YouCanBookMe', /youcanbook\.me/i], ['TidyCal', /tidycal\.com/i],
  ['Cal.com', /\bcal\.com\//i], ['HubSpot Meetings', /meetings\.hubspot\.com|meetings-[a-z0-9]{1,10}\.hubspot\.com/i], ['Microsoft Bookings', /outlook\.office(365)?\.com\/(owa\/calendar|book)|bookings\.cloud\.microsoft/i],
  ['Google appointment schedule', /calendar\.app\.google|calendar\.google\.com\/calendar\/appointments/i], ['Zoho Bookings', /zohobookings\.|bookings\.zoho\./i],
  ['LocalMed', /localmed\.com/i], ['NexHealth', /nexhealth\.com/i], ['Tebra / PatientPop', /patientpop\.com|tebra\.com|kareo\.com/i], ['Dentally', /dentally\.(co|com)/i],
  ['Practo', /practo\.com/i], ['Doctolib', /doctolib\./i], ['Jameda', /jameda\.de/i], ['Cliniko', /cliniko\.com/i], ['Nookal', /nookal\.com/i], ['Halaxy', /halaxy\.com/i],
  ['HotDoc', /hotdoc\.com\.au/i], ['HealthEngine', /healthengine\.com\.au/i], ['SimplePractice', /simplepractice\.com/i],
  ['Treatwell', /treatwell\./i], ['GlossGenius', /glossgenius\.com/i], ['Boulevard', /joinblvd\.com|blvd\.co/i], ['Phorest', /phorest\.com/i], ['Timely', /gettimely\.com/i],
  ['Zenoti', /zenoti\.com/i], ['Salonized', /salonized\.com/i], ['Shore', /shore\.com\/(book|de|en)/i], ['Planity', /planity\.com/i], ['StyleSeat', /styleseat\.com/i],
  ['Glofox', /glofox\.com/i], ['Mariana Tek', /marianatek\.com/i], ['WellnessLiving', /wellnessliving\.com/i], ['ClassPass', /classpass\.com/i],
  ['Housecall Pro', /housecallpro\.com/i], ['Jobber', /getjobber\.com|clienthub\.getjobber/i], ['ServiceTitan', /servicetitan\.com/i], ['ServiceM8', /servicem8\.com/i], ['Workiz', /workiz\.com/i],
  ['FareHarbor', /fareharbor\.com/i], ['Checkfront', /checkfront\.com/i], ['Peek', /peek\.com\/(s|purchase)/i], ['Bookeo', /bookeo\.com/i], ['Picktime', /picktime\.com/i],
  ['Amelia', /ameliabooking|amelia-(booking|v2)/i], ['Bookly', /bookly-(form|js)|\bbookly\b/i], ['LatePoint', /latepoint/i], ['Booknetic', /booknetic/i], ['BirchPress', /birchpress/i],
  ['Wix Bookings', /wix-bookings|bookings-service|\/book-online\b/i], ['Squarespace Scheduling', /squarespacescheduling\.com/i],
  ['Booking widget', /booking-widget|bookingwidget|online-booking|booking-form|appointment-form|book-appointment/i],
];
const BOOKING_TEXT = new RegExp(
  [
    '\\bbook (?:an |a |your |a free )?(?:appointment|online|now|today|table|a table|visit|consult(?:ation)?|session|call|class|lesson|treatment|service|massage|room|stay|tour|demo|exam|cleaning|check-?up)',
    '\\bmake (?:an |a )?(?:appointment|booking|reservation)',
    '\\brequest (?:an |a )?(?:appointment|consultation|booking|quote online)',
    '\\bschedule (?:an |a |your )?(?:appointment|visit|consult(?:ation)?|service|online|now|today|a call|exam|cleaning)',
    '\\bonline (?:booking|scheduling|appointments?|reservations?)',
    '\\breserve (?:a table|now|online|your spot|a spot)',
    '\\breservations?\\b',
    '\\bappointments? online',
    '\\bbook with us',
    '\\btermin (?:buchen|vereinbaren|online)',
    '\\b(?:jetzt|online) buchen',
    '\\breservar\\b',
    '\\bpedir cita',
    '\\bcita previa',
    '\\bagendar\\b',
    '\\bprendre rendez-vous',
    '\\bréserver\\b',
    '\\bprenota(?:re|zione|zioni)?\\b',
    '\\bafspraak maken',
    '\\bboka tid',
  ].join('|'),
  'i',
);
const BOOKING_HREF = /href\s{0,3}=\s{0,3}["']?[^"'\s>]{0,200}\/(?:book|booking|bookings|book-now|book-online|appointments?|request-appointment|schedule|scheduling|reserv(?:e|ation|ations)|termin|cita|rendez-vous)(?:[/?#"'\s>]|-[a-z0-9-]{1,30})/i;

const CHAT_PATTERNS = [
  ['Tawk.to', /tawk\.to/i], ['Intercom', /intercom(cdn)?\.(io|com)|widget\.intercom/i], ['Drift', /js\.driftt\.com|drift\.com\/(include|widget)/i], ['Crisp', /crisp\.chat/i],
  ['Tidio', /tidio(chat)?\.(co|com)/i], ['LiveChat', /livechatinc\.com|cdn\.livechat|livechat\.com/i], ['Zendesk', /zdassets\.com|zopim/i], ['HubSpot Chat', /js\.(hs-scripts|usemessages)\.com|js-[a-z0-9]{1,6}\.hs-scripts\.com/i],
  ['Freshchat', /wchat\.freshchat|freshworks\.com\/live-chat|fw-cdn\.com/i], ['Olark', /olark\.com/i], ['Chatra', /chatra\.(io|com)/i], ['Smartsupp', /smartsupp\.com/i],
  ['JivoChat', /jivosite\.com|jivochat/i], ['ManyChat', /manychat\.com/i], ['Botpress', /botpress\.(cloud|com)/i], ['Voiceflow', /voiceflow\.com/i],
  ['Chatbase', /chatbase\.co/i], ['Podium', /podium\.com/i], ['Birdeye', /birdeye\.com/i], ['Gorgias', /gorgias\.(chat|com|io)/i], ['Messenger', /\bm\.me\/|messenger\.com|xfbml\.customerchat/i],
  ['LeadConnector', /leadconnectorhq\.com|msgsndr\.com|link\.msgsndr/i], ['Zoho SalesIQ', /salesiq\.zoho|zohopublic\./i], ['GetButton', /getbutton\.io/i], ['Joinchat', /joinchat/i],
  ['Click to Chat', /ht-ctc|ht_ctc/i], ['WATI', /wati\.io/i], ['Interakt', /interakt\.(ai|shop)/i], ['AiSensy', /aisensy\.com/i], ['Gupshup', /gupshup\.io/i], ['Userlike', /userlike\.com/i],
  ['LiveAgent', /ladesk\.com|liveagent/i], ['Chaport', /chaport\.com/i], ['Kommunicate', /kommunicate\.io/i], ['Landbot', /landbot\.io/i], ['Re:amaze', /reamaze\.com/i],
  ['HelpCrunch', /helpcrunch\.com/i], ['Pure Chat', /purechat\.com/i], ['Comm100', /comm100\./i], ['SnapEngage', /snapengage\.com/i], ['Trengo', /trengo\.(eu|com)/i],
  ['Callbell', /callbell\.eu/i], ['respond.io', /respond\.io/i], ['Weave', /getweave\.com/i], ['Smith.ai', /smith\.ai/i], ['Ruby', /ruby\.com\/(chat|widget)/i],
  ['Yellow.ai', /yellow\.ai/i], ['Haptik', /haptik\.ai/i], ['Ada', /ada\.support/i], ['Botsonic', /botsonic/i], ['Shopify Inbox', /shopify-chat|inbox\.shopify\.com/i],
  ['Wix Chat', /wix-chat|chat-widget\.wix|engage\.wixapps/i], ['Chat widget', /chat-widget|chatwidget|live-chat-widget|webchat/i],
];
const WHATSAPP_PATTERN = /wa\.me\/|wa\.link\/|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp:\/\/|chat\.whatsapp\.com|whatsapp\.com\/send/i;
// A tag manager can inject a chat widget that only appears when the page runs in a browser.
const TAG_MANAGER = /googletagmanager\.com\/gtm\.js|\bGTM-[A-Z0-9]{4,10}\b|tagmanager\.google\.com|tags\.tiqcdn\.com|cdn\.segment\.com\/analytics\.js/i;

const SOCIAL_PATTERNS = {
  instagram: /instagram\.com\/(?!p\/|reel\/|explore\/|accounts\/)[a-z0-9_.]{2,30}/i,
  facebook: /facebook\.com\/(?!sharer|share|dialog|plugins|tr\b|tr\?)[a-z0-9_.\-/?=]{2,100}|facebook\.com\/plugins\/page\.php\?[^"'\s>]{0,40}href=https?(%3A|:)/i,
  tiktok: /tiktok\.com\/@[a-z0-9_.]{2,30}/i,
  youtube: /youtube\.com\/(@|c\/|channel\/|user\/)[a-z0-9_.-]{2,60}/i,
  linkedin: /linkedin\.com\/(company|in)\/[a-z0-9_.-]{2,100}/i,
  x: /(twitter|x)\.com\/(?!share|intent|home)[a-z0-9_]{2,30}/i,
};
// Social feed widgets load the account link in the browser, so the HTML may not show it.
const SOCIAL_WIDGETS = /elfsight|juicer\.io|curator\.io|taggbox|snapwidget|lightwidget|behold\.so|sbi_(feed|item)|instagram-feed|smashballoon|tagembed|embedsocial/i;

const ANALYTICS_PATTERN = new RegExp(
  [
    'googletagmanager\\.com\\/(?:gtag\\/js|gtm\\.js)',
    'google-analytics\\.com\\/(?:analytics|ga)\\.js',
    'gtag\\(\\s{0,3}[\'"]config',
    '\\bGTM-[A-Z0-9]{4,10}\\b',
    '[\'"]G-[A-Z0-9]{6,12}[\'"]',
    '\\bUA-\\d{4,10}-\\d{1,4}\\b',
    'google_tag_ids',
    'plausible\\.io\\/js',
    'static\\.cloudflareinsights\\.com',
    'clarity\\.ms\\/tag',
    'matomo|piwik',
    'js\\.hs-(?:scripts|analytics)\\.(?:com|net)',
    'static\\.hotjar\\.com',
    'usefathom\\.com',
    'umami\\.(?:is|js)',
    'simpleanalytics',
    'statcounter\\.com',
    'static\\.getclicky\\.com',
    'cdn\\.segment\\.com',
    'mc\\.yandex\\.ru\\/metrika',
  ].join('|'),
  'i',
);
const PIXEL_PATTERN = /connect\.facebook\.net\/[^"'\s]{0,40}fbevents\.js|fbq\(\s{0,3}['"]init|"pixel_type"\s{0,3}:\s{0,3}"facebook_pixel"|facebook_pixel_id|analytics\.tiktok\.com|snap\.licdn\.com|bat\.bing\.com|googleadservices\.com|['"]AW-\d{6,12}['"]/i;
// Hosted site builders with built-in visitor statistics: "no analytics" is not something we can claim there.
const BUILDER_PATTERNS = [
  ['Wix', /static\.parastorage\.com|wixstatic\.com|content=["']?Wix\.com/i], ['Squarespace', /static1\.squarespace\.com|squarespace-cdn\.com|SQUARESPACE_CONTEXT/i],
  ['Shopify', /cdn\.shopify\.com|Shopify\.theme|web-pixels-manager/i], ['GoDaddy', /img1\.wsimg\.com|godaddy website builder/i], ['Weebly / Square Online', /editmysite\.com|weebly\.com/i],
  ['Duda', /multiscreensite\.com|dudaone|irp\.cdn-website\.com/i], ['Jimdo', /jimdo(cdn|free)?\.com/i], ['Strikingly', /strikingly\.com|strikinglycdn/i], ['Hostinger', /zyrosite\.com|zyro\.com/i],
];

function findFirst(patterns, html) {
  for (const [name, re] of patterns) if (re.test(html)) return name;
  return '';
}

const PRESENT_WORDS = /^(present|today|now|current|heute|actualidad|aujourd['’]hui|oggi)$/i;

// The newest year in the footer's copyright line, or null when it is unknown or set by a script.
function extractCopyrightYear(html, now) {
  const raw = str(html);
  if (/getFullYear\s{0,3}\(|getUTCFullYear\s{0,3}\(|getYear\s{0,3}\(/.test(raw)) return null; // the year is filled in by JavaScript
  const text = decodeEntities(stripTags(raw)).replace(/\s+/g, ' ');
  const thisYear = (now || new Date()).getUTCFullYear();
  let best = 0;
  const re = /(?:©|\(c\)|copyright)\s{0,3}(?:by\s{1,3})?([a-z&.,'’\- ]{0,40}?\s)??((?:19|20)\d{2})(?!\d)(?:\s{0,3}[-–—/]\s{0,3}(?:['’]?((?:19|20)\d{2}|\d{2})(?!\d)|([a-z'’]{3,12})\b))?/gi;
  for (const m of text.matchAll(re)) {
    const gap = str(m[1]);
    if (/\b(est|estd|since|founded|established|serving|seit|desde|depuis|dal)\b/i.test(gap)) continue; // "est. 1998" is a founding year
    const start = Number(m[2]);
    let y = start;
    if (m[3]) {
      if (m[3].length === 4) y = Math.max(start, Number(m[3]));
      else {
        let full = Math.floor(start / 100) * 100 + Number(m[3]);
        if (full < start) full += 100;
        y = full;
      }
    } else if (m[4]) {
      if (PRESENT_WORDS.test(m[4])) y = thisYear;
    }
    if (y > thisYear + 1) continue;
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
  for (const m of str(html).matchAll(/<a\b[^>]{0,2000}?href\s{0,3}=\s{0,3}["']([^"'#][^"']{0,500})["'][^>]{0,2000}>([\s\S]{0,200}?)<\/a>/gi)) {
    const href = m[1];
    const label = m[2].replace(/<[^>]{0,2000}>/g, ' ');
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    const hit = /contact|kontakt|contacto|get-in-touch|reach-us|enquir|inquir/i;
    if (hit.test(href) || hit.test(label)) {
      const url = resolveSameSiteUrl(href, pageUrl);
      if (url && url !== pageUrl) candidates.push(url);
    }
  }
  return candidates[0] || '';
}

// Attributes of one tag, with or without quotes: <meta name=description content="...">.
function tagAttributes(tag) {
  const out = {};
  for (const m of str(tag).matchAll(/([a-z][a-z0-9:_-]{0,40})\s{0,3}=\s{0,3}(?:"([^"]{0,5000})"|'([^']{0,5000})'|([^\s"'=<>`]{1,2000}))/gi)) {
    const k = m[1].toLowerCase();
    if (!(k in out)) out[k] = decodeEntities(m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4]);
  }
  return out;
}

function tagsOf(html, name) {
  return [...str(html).matchAll(new RegExp(`<${name}\\b[^>]{0,3000}>`, 'gi'))].map((m) => tagAttributes(m[0]));
}

// Pages whose HTML is not what a visitor sees: absence checks (no booking, no chat...) must not run on them.
function unverifiableReason(html, bodyText) {
  if (/sucuri_cloudproxy|sgcaptcha|cf-browser-verification|cf_chl_|challenge-platform|checking your browser|just a moment\.\.\.|attention required!|ddos protection by|enable javascript and cookies to continue|please wait while we verify/i.test(html)) {
    return 'a bot-protection page was returned instead of the site';
  }
  if (/<meta\b[^>]{0,300}http-equiv\s{0,3}=\s{0,3}["']?refresh/i.test(html) && bodyText.length < 1000) return 'the homepage redirects with a script or meta refresh';
  if (bodyText.length < 250) return 'the page has almost no text without JavaScript (it is built in the browser)';
  return '';
}

function analyzeHtml(rawHtml, pageUrl, now) {
  const { html, truncated } = clipHtml(rawHtml);
  const titleMatch = html.match(/<title\b[^>]{0,500}>([\s\S]{0,2000}?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : '';
  const h1Match = html.match(/<h1\b[^>]{0,2000}>([\s\S]{0,2000}?)<\/h1>/i);
  const h1Text = h1Match ? decodeEntities(h1Match[1].replace(/<[^>]{0,2000}>/g, ' ')).replace(/\s+/g, ' ').trim() : '';
  const metas = tagsOf(html, 'meta');
  const metaNamed = (n) => metas.find((m) => str(m.name).toLowerCase() === n || str(m.property).toLowerCase() === n);
  const metaDesc = metaNamed('description');
  const viewport = metaNamed('viewport');
  const generator = str((metaNamed('generator') || {}).content);
  const links = tagsOf(html, 'link');
  const canonicalTag = links.find((l) => /(^|\s)canonical(\s|$)/i.test(str(l.rel)));
  const ogUrl = metaNamed('og:url');
  const bodyText = decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim();
  const challenge = /sucuri_cloudproxy|sgcaptcha|cf-browser-verification|cf_chl_|challenge-platform|checking your browser|just a moment\.\.\./i.test(html);
  const strongPlaceholder =
    /(this domain (is|may be) for sale|buy this domain|domain is parked|parked (free|domain|by)|this domain has been registered|account (has been )?suspended|default web page|welcome to nginx|index of \/|future home of)/i.test(bodyText + ' ' + title) ||
    /^\s*it works!/i.test(bodyText) ||
    /^it works!?$/i.test(title);
  const weakPhrase = /(coming soon|under construction|launching soon|site is being built|website is being built)/i;
  const hasContactLinks = /href\s{0,3}=\s{0,3}["']?\s{0,3}(tel|mailto):/i.test(html);
  const isPlaceholder =
    !challenge &&
    bodyText.length < 2500 &&
    (strongPlaceholder || weakPhrase.test(title) || weakPhrase.test(h1Text) || (bodyText.length < 600 && weakPhrase.test(bodyText) && !hasContactLinks));
  const notVerifiable = isPlaceholder ? '' : unverifiableReason(html, bodyText);
  const booking = findFirst(BOOKING_PATTERNS, html) || (BOOKING_TEXT.test(bodyText) || BOOKING_TEXT.test(removeTags(html)) ? 'Booking button' : '') || (BOOKING_HREF.test(html) ? 'Booking page link' : '');
  const chat = findFirst(CHAT_PATTERNS, html);
  const socials = {};
  for (const [k, re] of Object.entries(SOCIAL_PATTERNS)) socials[k] = re.test(html);
  const { emails, others } = collectEmails(html, pageUrl);
  const builder = findFirst(BUILDER_PATTERNS, html) || (/^(wix|squarespace|shopify|weebly|duda|jimdo|strikingly|godaddy)/i.test(generator) ? generator.split(/[\s.]/)[0] : '');
  return {
    title,
    hasTitle: title.length > 0,
    hasMetaDescription: Boolean(metaDesc && str(metaDesc.content).length > 0),
    hasH1: /<h1[\s>]/i.test(html),
    hasViewport: Boolean(viewport),
    copyrightYear: extractCopyrightYear(html, now),
    booking,
    hasBooking: Boolean(booking),
    chat,
    hasChat: Boolean(chat),
    hasWhatsApp: WHATSAPP_PATTERN.test(html),
    hasTagManager: TAG_MANAGER.test(html),
    socials,
    hasSocial: Boolean(socials.instagram || socials.facebook || socials.tiktok),
    hasSocialWidget: SOCIAL_WIDGETS.test(html),
    hasAnalytics: ANALYTICS_PATTERN.test(html),
    hasMetaPixel: PIXEL_PATTERN.test(html),
    builder,
    hasSchema: /<script\b[^>]{0,500}\btype\s{0,3}=\s{0,3}["']?application\/ld\+json/i.test(html) || /itemtype\s{0,3}=\s{0,3}["']?https?:\/\/schema\.org/i.test(html),
    isPlaceholder,
    verifiable: !notVerifiable,
    notVerifiableReason: notVerifiable,
    truncated,
    emails,
    otherEmails: others,
    contactUrl: findContactUrl(html, pageUrl),
    canonicalUrl: str((canonicalTag && canonicalTag.href) || (ogUrl && ogUrl.content)),
    textLength: bodyText.length,
  };
}

// @export
module.exports = {
  MAX_HTML_CHARS,
  DOWN_STATUSES,
  RECHECK_STATUSES,
  clipHtml,
  classifyFetch,
  decodeEntities,
  decodeCfEmail,
  isPlausibleEmail,
  collectEmails,
  extractEmails,
  extractCopyrightYear,
  findContactUrl,
  tagAttributes,
  analyzeHtml,
};
