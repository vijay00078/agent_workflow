// Decides which sitemap files to read.
// - Sitemap index (WordPress, Shopify, Wix…) → read the useful child sitemaps
// - Normal sitemap → read it
// - Always: the homepage, so its links find pages the sitemap forgot
const cfg = $('Config').first().json;
const site = String(cfg.website_url || '').trim().replace(/\/+$/, '');
if (!/^https?:\/\//i.test(site)) {
  throw new Error('Set website_url in the Config node (it must start with https://)');
}
const sitemapUrl = String(cfg.sitemap_url || '').trim() || `${site}/sitemap.xml`;
const xml = typeof $input.first().json.data === 'string' ? $input.first().json.data : '';
const decode = (s) => s.replace(/&amp;/g, '&').trim();
const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s\]]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decode(m[1]));

let urls;
if (/<sitemapindex[\s>]/i.test(xml)) {
  const skip = /(image|video|author|tag|attachment|media|news)[-_]?sitemap|sitemap[-_](image|video|author|tag)/i;
  const prefer = /(page|post|product|service|blog|article|collection|location|faq|category)/i;
  urls = locs
    .filter((u) => !skip.test(u))
    .sort((a, b) => Number(prefer.test(b)) - Number(prefer.test(a)))
    .slice(0, 10);
  if (!urls.length) urls = locs.slice(0, 5);
} else if (/<urlset[\s>]/i.test(xml)) {
  urls = [sitemapUrl];
} else {
  urls = [];
}
// Always read the homepage too: its menu links find pages missing from the sitemap
urls.unshift(site);
return urls.map((url) => ({ json: { url } }));
