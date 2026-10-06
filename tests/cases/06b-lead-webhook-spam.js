module.exports = {
  workflow: '06-ai-lead-qualifier-instant-reply.json',
  trigger: 'Website Form (Webhook)',
  pin: { 'Website Form (Webhook)': [{ headers: {}, params: {}, query: {}, body: { data: { fields: { first_name: 'Bob', last_name: 'Seo', email_address: 'bob@seo-king.biz', Message: 'We can get you to #1 on Google! Cheap backlinks.' } } } }] },
  probes: { 'Save to CRM Sheet': {}, 'Send Instant Reply': { id: 'x' }, 'Alert Me (Email)': { id: 'y' } },
  overrides: [{ match: 'Cheap backlinks', respond: { score: 3, is_spam: true, summary: 'SEO link-building pitch.', key_needs: [], budget_fit: 'n/a', urgency: 'low', next_step: 'Ignore', red_flags: 'Spam pitch', email_subject: '', email_body: '' } }],
  show: ['Normalize Lead', 'Lead Record'],
  async check({ get, expect }) {
    const lead = get('Normalize Lead')[0];
    expect(lead.name === 'Bob Seo' && lead.email === 'bob@seo-king.biz' && lead.message.includes('backlinks') && lead.source === 'Website form (webhook)', 'nested webhook payload normalized');
    expect(get('Lead Record')[0].tier === 'spam', 'spam tier');
    expect(get('Send Instant Reply').length === 0, 'no reply to spam');
    expect(get('Alert Me (Email)').length === 0, 'no alert for spam');
    expect(get('CRM Row')[0].Tier === 'spam', 'spam still logged');
  },
};
