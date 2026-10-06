// Your sources: the RSS feeds from Config + a Google News search for every topic.
const cfg = $('Config').first().json;
const feeds = String(cfg.rss_feeds || '')
  .split(/\n|,(?=\s*https?:)/)
  .map((s) => s.trim())
  .filter((s) => /^https?:\/\//i.test(s));

const region = String(cfg.news_region || 'US').toUpperCase();
const lang = String(cfg.news_language || 'en').toLowerCase();
const topics = String(cfg.news_topics || '')
  .split(/\n|,/)
  .map((s) => s.trim())
  .filter(Boolean);
for (const topic of topics) {
  const q = encodeURIComponent(`${topic} when:1d`);
  feeds.push(`https://news.google.com/rss/search?q=${q}&hl=${lang}-${region}&gl=${region}&ceid=${region}:${lang}`);
}
if (!feeds.length) throw new Error('Add at least one RSS feed or news topic in the Config node.');
return [...new Set(feeds)].map((url) => ({ json: { url } }));
