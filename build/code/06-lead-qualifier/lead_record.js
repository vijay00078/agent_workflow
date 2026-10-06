// Combines the lead with the AI verdict, applies your score thresholds and
// prepares everything the next steps need (CRM row, reply email, alert).
const lead = $('Lead Data').item.json;
const cfg = $('Config').first().json;
const ai = $json.output && typeof $json.output === 'object' ? $json.output : null;

const hot = Number(cfg.hot_score) || 70;
const warm = Number(cfg.warm_score) || 40;
const score = ai ? Math.max(0, Math.min(100, Math.round(Number(ai.score) || 0))) : null;
const tier = !ai ? 'review' : ai.is_spam ? 'spam' : score >= hot ? 'hot' : score >= warm ? 'warm' : 'cold';
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email || '');

const fallbackSubject = `Thanks for reaching out to ${cfg.business_name}`;
const fallbackBody =
  `Hi ${lead.first_name},\n\nThanks for reaching out to ${cfg.business_name}! We've received your message and will get back to you within one business day.` +
  (cfg.booking_link ? `\n\nIf you'd like to talk sooner, you can book a time that suits you here: ${cfg.booking_link}` : '') +
  `\n\nBest,\n${cfg.your_name}`;

const subject = ai && ai.email_subject ? ai.email_subject : fallbackSubject;
const body = ai && ai.email_body ? ai.email_body : fallbackBody;
const autoReply = cfg.auto_reply === true || cfg.auto_reply === 'true';
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

return {
  json: {
    ...lead,
    score: score === null ? '' : score,
    tier,
    summary: ai ? ai.summary : 'AI qualification failed – please review manually',
    key_needs: ai && Array.isArray(ai.key_needs) ? ai.key_needs.join(', ') : '',
    urgency: ai ? ai.urgency : '',
    budget_fit: ai ? ai.budget_fit : '',
    next_step: ai ? ai.next_step : 'Review manually',
    red_flags: ai ? ai.red_flags : '',
    email_subject: subject,
    email_body: body,
    send_reply: autoReply && validEmail && tier !== 'spam',
    alert_html:
      `🔥 <b>Hot lead: ${esc(lead.name)}</b> (${score}/100)\n` +
      `${esc(lead.company || '')} ${esc(lead.email)} ${esc(lead.phone || '')}\n\n` +
      `<b>Needs:</b> ${esc(ai ? ai.summary : '')}\n<b>Budget:</b> ${esc(lead.budget || '?')} · <b>Timeline:</b> ${esc(lead.timeline || '?')}\n<b>Next step:</b> ${esc(ai ? ai.next_step : '')}`,
    alert_email_html: `<div style="font-family:Arial,sans-serif;max-width:600px">
<h2 style="margin:0 0 12px">🔥 Hot lead: ${esc(lead.name)} <span style="color:#16a34a">${score}/100</span></h2>
<table style="border-collapse:collapse;width:100%;font-size:14px">
${[['Company', lead.company], ['Email', lead.email], ['Phone', lead.phone], ['Website', lead.website], ['Budget', lead.budget], ['Timeline', lead.timeline], ['Needs', ai ? ai.summary : ''], ['Next step', ai ? ai.next_step : ''], ['Red flags', ai ? ai.red_flags : '']]
  .map(([k, v]) => `<tr><td style="padding:6px 10px;background:#f4f4f5;font-weight:bold;width:110px">${k}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(v || '–')}</td></tr>`)
  .join('\n')}
</table>
<p style="margin-top:14px"><b>Their message:</b><br>${esc(lead.message).replace(/\n/g, '<br>')}</p>
<p style="color:#71717a;font-size:12px">${autoReply && validEmail ? 'An AI-written reply was already sent to them.' : 'No automatic reply was sent.'} Speed wins — call them today! 📞</p>
</div>`,
  },
};
