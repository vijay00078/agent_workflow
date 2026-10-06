module.exports = {
  workflow: '06-ai-lead-qualifier-instant-reply.json',
  trigger: 'Lead Form',
  pin: { 'Lead Form': [{ 'Full name': 'jane smith', Email: 'Jane@Acme-Clinic.com', Company: 'Acme Clinic', Website: 'localhost:9999/site', Phone: '+1 555 0199', 'What can we help you with?': 'We need an AI chatbot that books appointments for our 3 clinics. We get 200 website inquiries a month.', Budget: '$5,000 – $20,000', Timeline: 'ASAP', submittedAt: '2026-10-06T10:00:00Z', formMode: 'production' }] },
  patch: { 'Visit Website': (node) => { node.parameters.url = '={{ $json.website.replace("https://", "http://") }}'; return node; } },
  probes: { 'Save to CRM Sheet': {}, 'Send Instant Reply': { id: 'sent-1' }, 'Alert Me (Email)': { id: 'sent-2' } },
  overrides: [{ match: 'We need an AI chatbot', respond: { score: 86, is_spam: false, summary: 'Clinic group wants an AI booking chatbot for 3 locations.', key_needs: ['AI chatbot', 'appointment booking'], budget_fit: 'good', urgency: 'high', next_step: 'Book discovery call this week', red_flags: '', email_subject: 'Your AI booking assistant for Acme Clinic', email_body: 'Hi Jane,\n\nThanks for reaching out…\n\nAlex Morgan' } }],
  show: ['Normalize Lead', 'Website Snippet', 'Lead Record', 'Send Instant Reply', 'Alert Me (Email)', 'CRM Row'],
  showChars: 500,
  async check({ get, expect, requests }) {
    const lead = get('Normalize Lead')[0];
    expect(lead.name === 'Jane Smith' && lead.first_name === 'Jane' && lead.email === 'jane@acme-clinic.com', 'normalized name/email');
    expect(lead.website === 'https://localhost:9999/site', 'website gets https:// prefix');
    expect(get('Website Snippet')[0].website_summary.includes('Example Co.'), 'website researched');
    const rec = get('Lead Record')[0];
    expect(rec.tier === 'hot' && rec.score === 86 && rec.send_reply === true, 'hot tier + reply');
    const reply = get('Send Instant Reply')[0];
    expect(reply['_probe.sendTo'] === 'jane@acme-clinic.com' && reply['_probe.subject'].includes('Acme'), 'reply to lead');
    const alert = get('Alert Me (Email)')[0];
    expect(alert && alert['_probe.subject'] === '🔥 Hot lead: Jane Smith (86/100)' && alert['_probe.sendTo'] === 'you@example.com', 'hot alert email');
    const row = get('CRM Row')[0];
    expect(row.Tier === 'hot' && row['Auto-reply sent'] === 'yes' && row.Source === 'Lead form', 'crm row');
    const prompt = JSON.stringify(requests.find((r) => r.url.includes('chat')).body);
    expect(prompt.includes('Budget: $5,000') && prompt.includes('Example Co.') && !prompt.includes('undefined'), 'prompt has lead + website info');
  },
};
