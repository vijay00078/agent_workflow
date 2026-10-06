// Pulls the article title, image and main text out of the page HTML.
// Falls back to the RSS content when the page blocks bots.
const input = $('Config').item.json;
const url = String(input['Article URL'] || input.link || '').trim();
const html = typeof $json.data === 'string' ? $json.data.slice(0, 3000000) : '';

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decode = (s) => String(s || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
  }
  return NAMED[e.toLowerCase()] ?? m;
});
const meta = (prop) => {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  return decode((html.match(re1) || html.match(re2) || [])[1] || '').trim();
};

function toText(fragment) {
  return decode(
    fragment
      .replace(/<(script|style|noscript|svg|iframe|form|button|figure|aside|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, (m, tag, inner) => `\n\n${'#'.repeat(Number(tag[1]))} ${inner.replace(/<[^>]+>/g, '')}\n`)
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|li|blockquote|ul|ol|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Main content: the biggest <article>, else <main>, else <body>
let main = '';
for (const m of html.matchAll(/<article[\s\S]*?<\/article>/gi)) if (m[0].length > main.length) main = m[0];
if (!main) main = (html.match(/<main[\s\S]*?<\/main>/i) || [])[0] || '';
if (!main) main = (html.match(/<body[\s\S]*<\/body>/i) || [])[0] || html;
let text = toText(main);

const rssContent = toText(String(input.content || input['content:encoded'] || input.contentSnippet || ''));
if (text.length < 400 && rssContent.length > text.length) text = rssContent;

const title = meta('og:title') || decode(((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').trim()) ||
  decode(((main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, '').trim()) || input.title || 'Untitled article';

if (text.length < 200) {
  throw new Error(`Could not read enough text from ${url || 'the article'} (the site may block bots). Try another URL or paste the article into a Google Doc and share that link.`);
}
const words = text.split(/\s+/).length;

return {
  json: {
    url,
    title: title.replace(/\s+[|–-]\s+[^|–-]{2,40}$/, '').trim(),
    description: meta('og:description') || meta('description'),
    image: meta('og:image'),
    text: text.slice(0, 16000),
    word_count: words,
    tone: input.Tone && !/brand voice/i.test(input.Tone) ? input.Tone : input.brand_voice,
    extra_instructions: input['Extra instructions (optional)'] || '',
  },
};
