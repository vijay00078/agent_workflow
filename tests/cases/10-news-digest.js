module.exports = {
  workflow: '10-daily-ai-news-digest.json',
  trigger: 'Every Morning at 7',
  pin: { 'Every Morning at 7': [{ timestamp: '2026-10-06T07:00:00.000Z' }] },
  patch: {
    Config: (node) => {
      for (const a of node.parameters.assignments.assignments) {
        if (a.name === 'rss_feeds') a.value = 'http://localhost:9999/feed/tech\nhttp://localhost:9999/feed/gnews\nhttp://localhost:9999/feed/broken';
        if (a.name === 'news_topics') a.value = '';
      }
      return node;
    },
  },
  probes: { 'Send Email Digest': { id: 'mail' } },
  overrides: [{ match: 'CANDIDATE STORIES', respond: {
    tldr: ['OpenAI ships GPT-6', 'EU tightens AI rules', 'Anthropic courts enterprises'],
    top_stories: [
      { id: 1, headline: 'Anthropic launches enterprise Claude model', summary: 'Anthropic released a new model. It targets companies.', why_it_matters: 'More choice for business automation.', category: 'Launch', emoji: '🚀' },
      { id: 2, headline: 'OpenAI GPT-6 arrives with built-in agents', summary: 'GPT-6 can browse and run tasks. It is available today.', why_it_matters: 'Agents get easier to build.', category: 'Launch', emoji: '🤖' },
      { id: 99, headline: 'Hallucinated story id', summary: 'x', why_it_matters: 'x', category: 'Other', emoji: '❓' },
    ],
    quick_hits: [{ id: 3, headline: 'EU AI Act enforcement rules final' }],
    insight: 'Agents are becoming the default interface.',
  } }],
  show: ['Build Feed List', 'Clean & Rank', 'Build Newsletter'],
  showChars: 700,
  async check({ get, expect }) {
    expect(get('Build Feed List').length === 3, 'three feeds');
    const c = get('Clean & Rank')[0];
    const titles = c.candidates.map((x) => x.title);
    expect(c.count === 4, 'old + duplicate removed: ' + JSON.stringify(titles));
    expect(c.candidates[0].title === 'Anthropic releases new Claude model for enterprises' && c.candidates[0].source === 'Reuters', 'google news title/source split + newest first');
    expect(c.candidates.find((x) => x.link.includes('gpt6')).snippet === 'The new model can browse and run tasks.', 'snippet html stripped');
    const nl = get('Build Newsletter')[0];
    expect(nl.stories === 2, 'hallucinated id dropped');
    expect(nl.html.includes('news.google.com/rss/articles/abc') && nl.html.includes('Why it matters'), 'html contains real links');
    expect(nl.subject.startsWith('☕ Daily AI Briefing — Anthropic launches'), 'subject: ' + nl.subject);
    expect(get('Send Email Digest')[0]['_probe.sendTo'] === 'you@example.com', 'email sent');
  },
};
