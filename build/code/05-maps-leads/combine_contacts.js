// Adds emails found on the contact page to what we found on the homepage.
const lead = $('Read Website').item.json;
const html = typeof $json.data === 'string' ? $json.data.slice(0, 1000000) : '';
const domain = String(lead.website || '').replace(/^https?:\/\/(www\.)?/i, '').split(/[\/?#:]/)[0].toLowerCase();

const JUNK_EMAIL = /(example\.|domain\.(com|tld)|yourdomain|yoursite|email\.com$|sentry|wixpress|godaddy|squarespace|\.(png|jpe?g|gif|svg|webp|css|js)$|@\dx\.|^(no-?reply|do-?not-?reply)@|u00[0-9a-f]{2})/i;
const found = new Set([lead.email, ...String(lead.other_emails || '').split(/,\s*/)].filter(Boolean));
for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) {
  const key = parseInt(m[1].slice(0, 2), 16);
  let email = '';
  for (let i = 2; i < m[1].length; i += 2) email += String.fromCharCode(parseInt(m[1].slice(i, i + 2), 16) ^ key);
  found.add(email);
}
const decoded = html.replace(/&#0*64;|&#x0*40;/gi, '@');
for (const m of decoded.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(m[1]);
for (const m of decoded.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi)) found.add(m[0]);

const emails = [...found]
  .map((e) => String(e).toLowerCase().trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
  .filter((e) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(e) && !JUNK_EMAIL.test(e));
const unique = [...new Set(emails)].sort((a, b) => Number(b.endsWith('@' + domain)) - Number(a.endsWith('@' + domain)));

return {
  json: {
    ...lead,
    email: unique[0] || '',
    other_emails: unique.slice(1, 4).join(', '),
  },
};
