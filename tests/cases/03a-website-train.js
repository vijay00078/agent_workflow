// Training run: sitemap index -> child sitemap -> pages -> knowledge base
module.exports = {
  workflow: '03-ai-website-chatbot.json',
  trigger: '▶️ Train the bot now',
  patch: {
    Config: (node) => {
      for (const a of node.parameters.assignments.assignments) {
        if (a.name === 'website_url') a.value = 'http://localhost:9999/site';
        if (a.name === 'business_name') a.value = 'Example Co.';
      }
      return node;
    },
  },
  show: ['Sitemaps to Read', 'Collect Page URLs', 'Extract Page Text', 'Save to Knowledge Base'],
  showItems: 8,
  showChars: 300,
  async check({ get, expect, requests }) {
    const sitemaps = get('Sitemaps to Read').map((x) => x.url);
    expect(sitemaps.length === 2 && sitemaps.some((u) => u.endsWith('page-sitemap.xml')) && !sitemaps.some((u) => u.includes('image')), 'image sitemap skipped, page sitemap + homepage read: ' + sitemaps);
    const urls = get('Collect Page URLs').map((x) => x.url);
    expect(urls[0] === 'http://localhost:9999/site', 'homepage first: ' + urls[0]);
    expect(urls.some((u) => u.endsWith('/pricing')) && urls.some((u) => u.endsWith('/faq')) && urls.some((u) => u.endsWith('/contact')), 'pages from sitemap + homepage links: ' + urls);
    expect(!urls.some((u) => u.includes('utm_') || u.includes('twitter') || u.endsWith('.png') || u.includes('should-not')), 'junk urls removed: ' + urls);
    const pages = get('Extract Page Text');
    expect(pages.some((p) => p.content.includes('$149/month')), 'pricing text extracted');
    expect(pages.every((p) => !p.content.includes('not content') && !p.content.includes('color:red')), 'scripts/styles removed');
    expect(pages.some((p) => p.content.includes('100 Market Street')), 'homepage footer contact info kept');
    expect(pages.some((p) => p.title === 'Extra business information'), 'extra knowledge added');
    const kb = get('Save to Knowledge Base');
    expect(kb.length >= pages.length, 'chunks inserted: ' + kb.length);
    expect(requests.some((r) => r.url.includes('/embeddings')), 'embeddings requested');
  },
};
