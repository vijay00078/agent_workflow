const email = (id, fromName, fromAddr, subject, text, extraHeaders = {}) => ({
  id,
  threadId: 't-' + id,
  labelIds: ['INBOX', 'UNREAD'],
  sizeEstimate: 4200,
  headers: { from: `From: ${fromName} <${fromAddr}>`, subject: `Subject: ${subject}`, ...extraHeaders },
  html: `<div>${text.replace(/\n/g, '<br>')}</div>`,
  text,
  textAsHtml: `<p>${text}</p>`,
  subject,
  date: '2026-10-06T09:12:00.000Z',
  to: { value: [{ address: 'alex@morgan.digital', name: 'Alex Morgan' }], text: 'Alex Morgan <alex@morgan.digital>' },
  from: { value: [{ address: fromAddr, name: fromName }], text: `${fromName} <${fromAddr}>` },
  messageId: `<${id}@mail.gmail.com>`,
});

module.exports = {
  workflow: '01-ai-inbox-assistant.json',
  trigger: 'New Email',
  pin: {
    'New Email': [
      email('m1', 'Sarah Lee', 'sarah@acme-store.com', 'Black Friday budget',
        'Hi Alex,\n\nCan we increase the Black Friday ad budget by 20%? Also, when will the November report be ready?\n\nThanks,\nSarah\n\nOn Mon, Oct 5, 2026 at 9:00 AM Alex Morgan <alex@morgan.digital> wrote:\n> Hi Sarah, the campaign is live.\n> Best, Alex'),
      email('m2', 'Weekly Digest', 'newsletter@news.example.com', 'Your weekly marketing digest',
        'Top 10 growth hacks this week...', { 'list-unsubscribe': 'List-Unsubscribe: <mailto:unsub@news.example.com>' }),
    ],
  },
  fixtures: {
    'Get Gmail Labels': [
      { id: 'INBOX', name: 'INBOX', type: 'system' },
      { id: 'Label_7', name: 'AI/Client', type: 'user' },
    ],
  },
  probes: {
    'Create Label': { id: 'Label_99', name: 'AI/Newsletter', type: 'user' },
    'Add Label': { id: 'm1', threadId: 't-m1', labelIds: ['INBOX', 'Label_7'] },
    'Create Draft Reply': { id: 'r-1', message: { id: 'd1', threadId: 't-m1' } },
  },
  overrides: [
    {
      match: 'Black Friday ad budget',
      respond: { category: 'Client', priority: 'high', summary: 'Sarah wants +20% Black Friday budget and asks for the November report date.', needs_reply: true, reply: 'Hi Sarah,\n\nHappy to increase it — I will update the budget today. The November report will be ready on [DATE].\n\nBest regards,\nAlex' },
    },
    {
      match: 'weekly marketing digest',
      respond: { category: 'Newsletter', priority: 'low', summary: 'Weekly marketing newsletter.', needs_reply: false, reply: '' },
    },
  ],
  show: ['Clean Email', 'AI Triage & Reply', 'Prepare Actions', 'Add Label', 'Create Draft Reply', 'Create Label'],
  async check({ get, expect, requests }) {
    const cleaned = get('Clean Email');
    expect(cleaned.length === 2, 'two emails cleaned');
    expect(!cleaned[0].body.includes('the campaign is live'), 'quoted history removed');
    expect(cleaned[1].automated === true, 'newsletter flagged as automated');
    const actions = get('Prepare Actions');
    expect(actions[0].labelId === 'Label_7' && actions[0].needs_reply === true, 'client email: label found + needs reply');
    expect(actions[1].labelId === '' && actions[1].needs_reply === false, 'newsletter: label missing + no reply');
    expect(get('Create Label').length === 1, 'one label created');
    expect(get('Add Label').length >= 1, 'labels added');
    const draft = get('Create Draft Reply');
    expect(draft.length === 1, 'exactly one draft');
    expect(draft[0] && draft[0]['_probe.subject'] === 'Re: Black Friday budget', 'draft subject is Re: …');
    const prompts = requests.filter((r) => r.url.includes('chat/completions'));
    expect(prompts.length === 2, 'two AI calls');
    const sys = JSON.stringify(prompts[0].body.messages);
    expect(sys.includes('Alex Morgan') && !sys.includes('undefined'), 'system prompt rendered with config');
  },
};
