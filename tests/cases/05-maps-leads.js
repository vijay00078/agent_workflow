module.exports = {
  workflow: '05-google-maps-lead-finder.json',
  trigger: 'Lead Search Form',
  timeout: 300000,
  pin: {
    'Lead Search Form': [{ 'Business type': 'dentists', 'City or area': 'Austin, TX', 'How many leads?': '40', 'Your offer (optional)': '', submittedAt: '2026-10-06T10:00:00.000Z', formMode: 'test' }],
  },
  credentials: { httpHeaderAuth: { name: 'Google Places key (mock)', data: { name: 'X-Goog-Api-Key', value: 'test-key' } } },
  credentialNodes: { 'Search Google Maps': 'httpHeaderAuth' },
  patch: {
    'Search Google Maps': (node) => { node.parameters.url = 'http://localhost:9999/places/v1/places:searchText'; node.parameters.options.pagination.pagination.requestInterval = 100; return node; },
  },
  probes: { 'Save to Google Sheets': {} },
  overrides: [{ match: 'BUSINESS: Smile Dental 0', respond: { lead_score: 9, score_reason: 'Busy practice without chat.', personalization_hook: 'You offer Invisalign but have no live chat.', email_subject: 'quick question about invisalign', opener: 'Saw that Smile Dental 0 offers Invisalign…', best_channel: 'email' } }],
  show: ['Split Places', 'Read Website', 'Combine Contacts', 'Format Row'],
  showItems: 4,
  showChars: 700,
  async check({ get, expect, requests, runData }) {
    const places = requests.filter((r) => r.url.includes('places:searchText'));
    expect(places.length === 2, 'two pages requested for 40 leads: ' + places.length);
    expect(places[1] && places[1].body.pageToken === 'page2' && places[1].body.textQuery === 'dentists in Austin, TX', 'second page uses pageToken + same query');
    expect(!places[0].body.pageToken, 'first page has no pageToken');
    const split = get('Split Places');
    expect(split.length === 39, '40 results minus 1 closed business: ' + split.length);
    const contacts = (runData['Combine Contacts'] || []).flatMap((r) => r.data.main[0].map((i) => i.json));
    const byName = Object.fromEntries(contacts.map((c) => [c.name, c]));
    expect(byName['Smile Dental 0'] && byName['Smile Dental 0'].email === 'info@biz0.com' && byName['Smile Dental 0'].instagram.includes('instagram.com/smiledental0'), 'mailto + instagram found');
    expect(byName['Smile Dental 1'] && byName['Smile Dental 1'].email === 'hello@biz1.com' && byName['Smile Dental 1'].facebook === 'https://www.facebook.com/smiledental1', 'cloudflare email decoded + facebook (not sharer)');
    expect(byName['Smile Dental 2'] && byName['Smile Dental 2'].email === 'office@biz2.com' && /outdated/.test(byName['Smile Dental 2'].website_signals), 'email from contact page + outdated signal');
    expect(byName['Smile Dental 2'] && !/png/.test(byName['Smile Dental 2'].other_emails), 'logo@2x.png not treated as email');
    const rows = (runData['Format Row'] || []).flatMap((r) => r.data.main[0].map((i) => i.json));
    expect(rows.length === 39, 'one sheet row per lead: ' + rows.length);
    const noSite = rows.find((r) => !r.Website);
    expect(noSite && noSite['Place ID'], 'lead without website still saved');
    const row0 = rows.find((r) => r['Business Name'] === 'Smile Dental 0');
    expect(row0 && row0['AI Opener'].startsWith('Saw that') && row0['Lead Score'] === '9', 'AI fields mapped into the row');
    const sheet = (runData['Save to Google Sheets'] || []).flatMap((r) => r.data.main[0].map((i) => i.json));
    expect(sheet.length === 39 && sheet[0]['_probe.documentId'].includes('docs.google.com'), 'sheet node got all rows + url');
  },
};
