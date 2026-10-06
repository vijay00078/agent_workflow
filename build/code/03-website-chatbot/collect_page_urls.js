// Collects the pages to learn from: sitemap entries + links found on the
// homepage + any extra URLs from Config. Keeps only pages on your domain and
// puts the most useful ones (pricing, FAQ, contact…) first.
// @include shared/url.js

const cfg = $('Config').first().json;
const site = String(cfg.website_url || '').trim().replace(/\/+$/, '');
const siteUrl = resolveUrl(site);
if (!siteUrl) throw new Error('website_url in the Config node must start with https://');
const maxPages = Math.max(1, Math.min(Number(cfg.max_pages) || 40, 300));
const TRACKING = /^(utm_[a-z]+|fbclid|gclid|ref|mc_cid|mc_eid)$/i;

const pages = new Map(); // url -> priority bonus
function add(raw, bonus = 0) {
  const url = resolveUrl(raw, site + '/');
  if (!url || url.domain !== siteUrl.domain) return;
  if (/\.(jpe?g|png|gif|webp|svg|ico|pdf|zip|rar|mp4|mp3|wav|css|js|json|xml|txt|woff2?|ttf|eot)$/i.test(url.pathname)) return;
  if (/(\/wp-admin|\/wp-json|\/wp-login|\/cart|\/checkout|\/my-account|\/account|\/login|\/signin|\/register|\/feed\/?$|\/tag\/|\/author\/|\/cdn-cgi\/|\/search)/i.test(url.pathname)) return;
  const params = url.search.replace(/^\?/, '').split('&').filter(Boolean).filter((p) => !TRACKING.test(p.split('=')[0]));
  if (params.length) return; // skip filtered / paginated variants
  const clean = (url.origin + url.pathname).replace(/\/$/, '');
  pages.set(clean, Math.max(pages.get(clean) || 0, bonus));
}

add(site, 1000);
for (const extra of String(cfg.extra_page_urls || '').split(/[\s,]+/)) if (extra) add(extra, 500);

for (const item of $input.all()) {
  const body = typeof item.json.data === 'string' ? item.json.data : '';
  for (const m of body.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s\]]+)/gi)) add(m[1]);
  for (const m of body.matchAll(/<a\s[^>]*?href\s*=\s*["']([^"'#][^"']*)["']/gi)) add(m[1]);
}

const IMPORTANT = /(about|contact|pricing|price|plans|faq|help|support|service|product|shipping|delivery|return|refund|warranty|policy|terms|book|appointment|location|hours|team|menu|course)/i;
function score(url) {
  const path = (resolveUrl(url) || { pathname: '/' }).pathname.toLowerCase();
  let s = pages.get(url) || 0;
  if (path === '/' || path === '') s += 100;
  if (IMPORTANT.test(path)) s += 50;
  s -= path.split('/').filter(Boolean).length * 5;
  return s;
}

const selected = [...pages.keys()].sort((a, b) => score(b) - score(a)).slice(0, maxPages);
return selected.map((url, index) => ({ json: { url, isHomepage: index === 0 } }));
