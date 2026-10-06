// Turns every downloaded page into clean, readable text for the knowledge base.
const cfg = $('Config').first().json;
const pages = $('Collect Page URLs').all();

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', yen: '¥', cent: '¢', deg: '°', times: '×', middot: '·', bull: '•' };
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return NAMED[entity.toLowerCase()] ?? match;
  });
}

function htmlToText(html, keepLayout) {
  let h = String(html).slice(0, 2000000);
  const title = decodeEntities(((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim());
  const description = decodeEntities(((h.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || h.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i) || [])[1] || '').trim());
  h = h.replace(/<head[\s\S]*?<\/head>/i, ' ');
  h = h.replace(/<!--[\s\S]*?-->/g, ' ');
  h = h.replace(/<(script|style|noscript|svg|iframe|template|canvas|select)[\s\S]*?<\/\1>/gi, ' ');
  // Menus repeat on every page – keep header/footer only for the homepage (contact details live there)
  h = h.replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
  if (!keepLayout) h = h.replace(/<(header|footer)[\s\S]*?<\/\1>/gi, ' ');
  h = h.replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, (m, tag, inner) => `\n\n${'#'.repeat(Number(tag[1]))} ${inner.replace(/<[^>]+>/g, ' ')}\n`);
  h = h.replace(/<li[^>]*>/gi, '\n- ');
  h = h.replace(/<(br|hr)\s*\/?>/gi, '\n');
  h = h.replace(/<\/(p|div|section|article|li|tr|table|ul|ol|blockquote|dd|dt|figure|address)>/gi, '\n');
  h = h.replace(/<(td|th)[^>]*>/gi, ' | ');
  h = h.replace(/<[^>]+>/g, ' ');
  const text = decodeEntities(h)
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title, description, text };
}

const out = [];
$input.all().forEach((item, i) => {
  const page = pages[i] && pages[i].json;
  const html = typeof item.json.data === 'string' ? item.json.data : '';
  if (!page || !html || item.json.error) return;
  const { title, description, text } = htmlToText(html, page.isHomepage);
  if (text.length < 150) return;
  out.push({
    json: {
      url: page.url,
      title: title || page.url,
      content: `# ${title || page.url}\nSource: ${page.url}\n${description ? `Summary: ${description}\n` : ''}\n${text.slice(0, 25000)}`,
    },
  });
});

const extra = String(cfg.extra_knowledge || '').trim();
if (extra.length > 10) {
  out.push({ json: { url: cfg.website_url, title: 'Extra business information', content: `# Extra business information\nSource: provided by the business\n\n${extra}` } });
}

if (!out.length) {
  throw new Error('No readable pages found. Check website_url in the Config node, or list important pages in extra_page_urls.');
}
return out;
