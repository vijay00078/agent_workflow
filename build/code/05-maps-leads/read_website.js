// Reads the business homepage: emails (incl. Cloudflare-protected ones), social
// profiles, the contact page link and "signals" the AI can use to personalise
// the opener (no online booking, outdated site, no analytics…).
// @include shared/url.js

const lead = $('Prepare Lead').item.json;
const html = typeof $json.data === 'string' ? $json.data.slice(0, 1500000) : '';
const site = resolveUrl(lead.website);
const siteDomain = site ? site.domain : '';

// ---------- emails
const JUNK_EMAIL = /(example\.|domain\.(com|tld)|yourdomain|yoursite|email\.com$|sentry|wixpress|godaddy|squarespace|@sentry|\.(png|jpe?g|gif|svg|webp|css|js)$|@\dx\.|^(no-?reply|do-?not-?reply)@|u00[0-9a-f]{2})/i;
function findEmails(source) {
  const found = new Set();
  for (const m of source.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) {
    const hex = m[1];
    const key = parseInt(hex.slice(0, 2), 16);
    let email = '';
    for (let i = 2; i < hex.length; i += 2) email += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    found.add(email);
  }
  const decoded = source.replace(/&#0*64;|&#x0*40;/gi, '@').replace(/&#0*46;|&#x0*2e;/gi, '.');
  for (const m of decoded.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    try { found.add(decodeURIComponent(m[1])); } catch (e) { found.add(m[1]); }
  }
  for (const m of decoded.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi)) found.add(m[0]);
  return [...found]
    .map((e) => e.toLowerCase().trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter((e) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(e) && !JUNK_EMAIL.test(e));
}

// ---------- social profiles
const SOCIAL = {
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore|accounts|share)[A-Za-z0-9_.]{2,}\/?/i,
  facebook: /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?!sharer|share|dialog|plugins|tr[?/]|groups\/?$)[A-Za-z0-9_.\-]{2,}(?:\/[A-Za-z0-9_.\-]+)?\/?/i,
  linkedin: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_\-%]+\/?/i,
};
const socials = {};
for (const [key, re] of Object.entries(SOCIAL)) {
  const m = html.match(re);
  socials[key] = m ? m[0].replace(/["'<>].*$/, '') : '';
}

// ---------- contact page
let contactUrl = '';
for (const m of html.matchAll(/<a\s[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
  const href = m[1];
  const label = m[2].replace(/<[^>]+>/g, ' ');
  if (/contact|kontakt|contacto|contato|get-in-touch|reach-us/i.test(href + ' ' + label)) {
    const url = resolveUrl(href, lead.website);
    if (url && url.domain === siteDomain) { contactUrl = url.href; break; }
  }
}
if (!contactUrl && site) contactUrl = site.origin + '/contact';

// ---------- text + signals for personalisation
const title = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
const description = ((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || [])[1] || '').trim();
const visible = html
  .replace(/<head[\s\S]*?<\/head>/i, ' ')
  .replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

const signals = [];
const year = new Date().getFullYear();
if (!html) signals.push('Website could not be loaded (down, slow or blocking bots)');
else {
  if (!/name=["']viewport["']/i.test(html)) signals.push('No mobile viewport tag – site may not be mobile-friendly');
  const copyright = html.match(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/i);
  if (copyright && Number(copyright[1]) < year - 2) signals.push(`Copyright year ${copyright[1]} – website looks outdated`);
  if (!/calendly|acuityscheduling|booksy|fresha|setmore|simplybook|vagaro|zocdoc|opentable|resy|squareup\.com\/appointments|book now|book online|schedule (an )?appointment/i.test(html)) signals.push('No online booking found');
  if (!/intercom|tawk\.to|drift\.com|crisp\.chat|livechatinc|tidio|zendesk|hubspot.*chat|wa\.me\/|api\.whatsapp\.com/i.test(html)) signals.push('No live chat / WhatsApp button');
  if (!/gtag\(|googletagmanager|google-analytics|plausible|matomo/i.test(html)) signals.push('No website analytics detected');
  if (!/fbq\(|connect\.facebook\.net/i.test(html)) signals.push('No Meta (Facebook) pixel – probably not running retargeting ads');
  if (/wp-content/i.test(html)) signals.push('Built with WordPress');
  if (/cdn\.shopify\.com/i.test(html)) signals.push('Built with Shopify');
  if (/wixstatic|wix\.com/i.test(html)) signals.push('Built with Wix');
}
if (!lead.rating) signals.push('No Google rating yet');
else if (Number(lead.rating) < 4) signals.push(`Google rating only ${lead.rating}★ – reputation could be improved`);
if (Number(lead.reviews) < 20) signals.push(`Only ${lead.reviews || 0} Google reviews`);

const emails = findEmails(html);
emails.sort((a, b) => Number(b.endsWith('@' + siteDomain)) - Number(a.endsWith('@' + siteDomain)));

return {
  json: {
    ...lead,
    email: emails[0] || '',
    other_emails: emails.slice(1, 4).join(', '),
    instagram: socials.instagram,
    facebook: socials.facebook,
    linkedin: socials.linkedin,
    website_title: title,
    website_summary: [description, visible.slice(0, 1500)].filter(Boolean).join(' | '),
    website_signals: signals.join('; '),
    contact_url: contactUrl,
  },
};
