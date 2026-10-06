// Combines every email with the AI decision and looks up the matching
// Gmail label (e.g. "AI/Client"). Missing labels are created in the next step.
const cfg = $('Config').first().json;
const prefix = String(cfg.label_prefix || 'AI').trim().replace(/\/+$/, '') || 'AI';
const labels = $input
  .all()
  .map((item) => item.json)
  .filter((label) => label && label.id && label.name);
const emails = $('Clean Email').all();
const decisions = $('AI Triage & Reply').all();

// The categories come from the "Triage Format" list, so adding your own category
// there (and describing it in the AI prompt) is enough to get a new label.
const NEVER_REPLY = ['Newsletter', 'Notification', 'Spam'];
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

return emails.map((email, i) => {
  const ai = (decisions[i] && decisions[i].json && decisions[i].json.output) || {};
  const category = String(ai.category || '').replace(/\//g, '-').trim().slice(0, 40) || 'Other';
  const priority = ['high', 'medium', 'low'].includes(ai.priority) ? ai.priority : 'medium';
  const labelName = `${prefix}/${category}`;
  const label = labels.find((l) => String(l.name).toLowerCase() === labelName.toLowerCase());
  const reply = String(ai.reply || '').trim();
  const summary = String(ai.summary || '').trim();
  const e = email.json;

  return {
    json: {
      ...e,
      category,
      priority,
      summary,
      needs_reply: ai.needs_reply === true && reply.length > 0 && !NEVER_REPLY.includes(category),
      reply,
      labelName,
      labelId: label ? label.id : '',
      urgent: category === 'Urgent' || priority === 'high',
      alert_html:
        `🚨 <b>${category === 'Urgent' ? 'Urgent email' : 'High-priority email'}</b>\n` +
        `<b>From:</b> ${esc(e.fromName)} (${esc(e.fromEmail)})\n` +
        `<b>Subject:</b> ${esc(e.subject)}\n\n${esc(summary)}`,
    },
    pairedItem: { item: 0 },
  };
});
