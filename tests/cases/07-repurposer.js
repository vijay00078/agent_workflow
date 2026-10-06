module.exports = {
  workflow: '07-blog-to-social-repurposer.json',
  trigger: 'Repurpose Form',
  pin: { 'Repurpose Form': [{ 'Article URL': 'http://localhost:9999/site/blog-post', Tone: 'Bold & punchy', 'Extra instructions (optional)': 'Mention our webinar on Friday', submittedAt: '2026-10-06T10:00:00Z', formMode: 'production' }] },
  probes: { 'Email Me the Pack': { id: 'mail-1' }, 'Save to Content Calendar': {} },
  overrides: [{ match: 'ARTICLE TITLE: 7 Ways to Answer Leads Faster', respond: {
    linkedin_post: 'Most leads go cold in an hour.\n\n→ Auto-reply\n→ Qualify\n→ Route hot leads\n\nHow fast do you reply? #sales',
    x_thread: ['Your leads are going cold. Here is why 🧵', 'Reply within a minute with an auto-reply.', 'Book a call: https://example.com'],
    instagram_caption: 'Stop losing leads 👇', instagram_hashtags: '#sales #leads',
    carousel_slides: ['Answer leads faster', 'Auto-reply', 'Qualify', 'Route hot leads', 'Templates', 'Track speed', 'Book a call'],
    facebook_post: 'How fast do you reply?', newsletter_blurb: 'Subject: Your leads are waiting\n\nTeaser…',
    short_video_script: '[HOOK 0-3s] Your leads hate waiting…', key_quotes: ['Speed wins.', 'Reply in minutes, not hours.', 'Hot leads to your phone.'],
    image_prompt: 'Minimal illustration of a stopwatch and an envelope' } }],
  show: ['Extract Article', 'Calendar Rows', 'Email Me the Pack'],
  showItems: 9,
  showChars: 300,
  async check({ get, expect, requests }) {
    const art = get('Extract Article')[0];
    expect(art.title === '7 Ways to Answer Leads Faster', 'title from og:title: ' + art.title);
    expect(art.text.includes('## 1. Use an instant auto-reply') && art.text.includes("& that's the point"), 'article text with headings + entities');
    expect(!art.text.includes('Sidebar noise') && !art.text.includes('tracking') && !art.text.includes('Home'), 'noise removed');
    expect(art.tone === 'Bold & punchy', 'tone from form');
    const prompt = JSON.stringify(requests.find((r) => r.url.includes('chat')).body);
    expect(prompt.includes('Mention our webinar on Friday') && prompt.includes('TONE / VOICE: Bold & punchy'), 'extra instructions + tone in prompt');
    const rows = get('Calendar Rows');
    expect(rows.length === 9 && rows.every((r) => r.Status === 'Draft' && r['Source URL'].includes('blog-post')), '9 calendar rows');
    expect(rows.find((r) => r.Platform === 'X / Twitter thread').Content.startsWith('1/3 Your leads'), 'thread numbered');
    const mail = get('Email Me the Pack')[0];
    expect(mail['_probe.subject'] === '📦 Content pack ready: 7 Ways to Answer Leads Faster' && mail['_probe.message'].includes('Slide 7: Book a call'), 'email built');
  },
};
