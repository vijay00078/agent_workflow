module.exports = {
  workflow: '08-ai-seo-blog-writer.json',
  trigger: 'Every Morning',
  pin: { 'Every Morning': [{ timestamp: '2026-10-06T08:00:00.000Z' }] },
  patch: {
    Config: (node) => { for (const a of node.parameters.assignments.assignments) { if (a.name === 'articles_per_run') a.value = 2; if (a.name === 'google_drive_folder_id') a.value = 'https://drive.google.com/drive/folders/1AbCdEfGhIjK?usp=sharing'; } return node; },
    'Create Google Doc': (node) => { node.parameters.url = 'http://localhost:9999/upload/drive/v3/files?uploadType=multipart'; node.parameters.authentication = 'none'; delete node.parameters.nodeCredentialType; return node; },
  },
  fixtures: {
    'Get Ready Topics': [
      { row_number: 2, Topic: 'How to answer leads faster', 'Primary Keyword': 'speed to lead', Audience: '', Notes: 'Mention auto-replies', 'Word Count': 1200, Status: 'Ready' },
      { row_number: 5, Topic: 'AI chatbots for dentists', 'Primary Keyword': 'dental chatbot', Audience: 'Dental clinic owners', Notes: '', 'Word Count': '', Status: 'Ready' },
      { row_number: 7, Topic: 'Third topic (should wait)', 'Primary Keyword': 'x', Status: 'Ready' },
    ],
  },
  probes: { 'Mark as Done': {}, 'Mark as Error': {} },
  overrides: [
    { match: 'Write the article.', respond: '```html\n<h1>Should be removed</h1>\n<p>Speed to lead matters.</p><h2>Key takeaways</h2><ul><li>Reply fast</li></ul><h2>FAQ</h2><h3>Why?</h3><p>Because.</p>\n```' },
    { match: 'PRIMARY KEYWORD: speed to lead', respond: { title: 'Speed to Lead: Reply Faster, Win More', slug: 'speed-to-lead', meta_description: 'Learn how speed to lead turns more inquiries into customers.', primary_keyword: 'speed to lead', secondary_keywords: ['lead response time', 'auto reply'], search_intent: 'informational – wants practical steps', outline: [{ h2: 'Why speed matters', key_points: ['a'], h3s: [] }], faq: ['What is speed to lead?'], takeaways: ['Reply in 5 minutes'] } },
    { match: 'PRIMARY KEYWORD: dental chatbot', respond: 'Sorry, I cannot produce JSON today' },
  ],
  show: ['Limit', 'Build Google Doc', 'Create Google Doc', 'Done Row', 'Error Row'],
  showChars: 400,
  async check({ get, expect, requests }) {
    expect(get('Limit').length === 2, 'articles_per_run respected');
    const doc = get('Build Google Doc')[0];
    expect(doc && doc.row_number === 2 && doc.slug === 'speed-to-lead' && !doc.article_html.includes('```') && !doc.article_html.includes('Should be removed'), 'html cleaned, h1 removed');
    expect(doc && doc.multipart.includes('"parents":["1AbCdEfGhIjK"]'), 'folder id extracted from URL');
    const done = get('Done Row');
    expect(done.length === 1 && done[0].row_number === 2 && done[0].Status === 'Done' && done[0]['Doc URL'] === 'https://docs.google.com/document/d/doc123/edit', 'done row');
    const err = get('Error Row');
    expect(err.length === 1 && err[0].row_number === 5 && /^Error/.test(err[0].Status), 'failed topic marked as error: ' + JSON.stringify(err[0]));
    const writer = requests.find((r) => JSON.stringify(r.body).includes('Write the article.'));
    expect(writer && writer.body.model === 'gpt-4.1' && JSON.stringify(writer.body).includes('about 1200 words'), 'writer uses gpt-4.1 + word count from sheet');
  },
};
