// Merges all feeds: keeps fresh stories only, removes duplicates (same link or
// near-identical headline) and keeps the newest candidates for the AI editor.
const cfg = $('Config').first().json;
const hours = Number(cfg.lookback_hours) || 26;
const cutoff = Date.now() - hours * 3600 * 1000;
const maxCandidates = 80;

const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const normTitle = (t) => t.toLowerCase().replace(/\s+[-–|]\s+[^-–|]+$/, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const seenLinks = new Set();
const seenTitles = [];
const stories = [];
for (const item of $input.all()) {
  const j = item.json;
  if (j.error || !j.title || !j.link) continue;
  const time = Date.parse(j.isoDate || j.pubDate || '') || 0;
  if (time && time < cutoff) continue;
  const link = String(j.link).trim();
  if (seenLinks.has(link)) continue;
  let title = stripHtml(j.title);
  let source = '';
  const isGoogleNews = /news\.google\.com/.test(link);
  const suffix = title.match(/\s+[-–|]\s+([^-–|]{2,60})$/);
  if (isGoogleNews && suffix) {
    source = suffix[1].trim();
    title = title.slice(0, suffix.index).trim();
  } else {
    source = (link.match(/^https?:\/\/(?:www\.)?([^\/:?#]+)/i) || [])[1] || '';
  }
  const nt = normTitle(title);
  const words = new Set(nt.split(' ').filter((w) => w.length > 3));
  const isDuplicate = seenTitles.some((other) => {
    if (other.nt === nt) return true;
    const overlap = [...words].filter((w) => other.words.has(w)).length;
    return words.size > 3 && overlap / Math.min(words.size, other.words.size || 1) > 0.8;
  });
  if (isDuplicate) continue;
  seenLinks.add(link);
  seenTitles.push({ nt, words });
  stories.push({
    title,
    link,
    source,
    published: time ? new Date(time).toISOString() : '',
    snippet: stripHtml(j.contentSnippet || j.content || j.summary || '').slice(0, 280),
    time,
  });
}

stories.sort((a, b) => b.time - a.time);
const candidates = stories.slice(0, maxCandidates).map((s, i) => ({ id: i + 1, ...s }));
if (!candidates.length) {
  return [{ json: { candidates: [], count: 0, feeds_checked: $input.all().length } }];
}
return [{ json: { candidates, count: candidates.length, feeds_checked: $input.all().length } }];
