// Builds a beautiful, mobile-friendly HTML email + a Telegram version.
const cfg = $('Config').first().json;
const candidates = $('Clean & Rank').first().json.candidates || [];
const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));
const ai = $json.output || {};
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const today = $now.toFormat('cccc, d LLLL yyyy');
const accent = cfg.accent_color || '#6d28d9';

const stories = (ai.top_stories || []).map((s) => ({ ...s, ...(byId[s.id] ? { link: byId[s.id].link, source: byId[s.id].source } : {}) })).filter((s) => s.link);
const quick = (ai.quick_hits || []).map((q) => ({ ...q, link: byId[q.id] && byId[q.id].link, source: byId[q.id] && byId[q.id].source })).filter((q) => q.link);

const storyHtml = stories.map((s, i) => `
<tr><td style="padding:18px 0;border-bottom:1px solid #eee">
  <div style="font:12px Arial,sans-serif;color:#888;text-transform:uppercase;letter-spacing:.5px">${esc(s.emoji || '📰')} ${esc(s.category || '')} · ${esc(s.source || '')}</div>
  <div style="font:bold 18px/1.35 Arial,sans-serif;margin:6px 0"><a href="${esc(s.link)}" style="color:#111;text-decoration:none">${i + 1}. ${esc(s.headline)}</a></div>
  <div style="font:15px/1.55 Arial,sans-serif;color:#333">${esc(s.summary)}</div>
  <div style="font:14px/1.5 Arial,sans-serif;color:${accent};margin-top:8px"><b>Why it matters:</b> ${esc(s.why_it_matters)}</div>
</td></tr>`).join('');

const quickHtml = quick.length ? `
<tr><td style="padding:22px 0 6px;font:bold 16px Arial,sans-serif">⚡ Quick hits</td></tr>
<tr><td><ul style="margin:0;padding-left:18px;font:14px/1.6 Arial,sans-serif;color:#333">
${quick.map((q) => `<li><a href="${esc(q.link)}" style="color:#333">${esc(q.headline)}</a> <span style="color:#999">– ${esc(q.source || '')}</span></li>`).join('\n')}
</ul></td></tr>` : '';

const tldr = (ai.tldr || []).map((t) => `<li style="margin-bottom:4px">${esc(t)}</li>`).join('');

const html = `<!doctype html><html><body style="margin:0;background:#f4f4f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${accent};padding:26px 28px;color:#fff">
  <div style="font:bold 24px Arial,sans-serif">${esc(cfg.digest_name || 'Daily AI Briefing')} ☕</div>
  <div style="font:14px Arial,sans-serif;opacity:.85;margin-top:4px">${esc(today)} · ${stories.length} stories picked for you · 2-minute read</div>
</td></tr>
<tr><td style="padding:22px 28px 0">
  <div style="background:#f8f7ff;border-radius:12px;padding:16px 18px">
    <div style="font:bold 15px Arial,sans-serif;margin-bottom:6px">🧠 TL;DR</div>
    <ul style="margin:0;padding-left:18px;font:14px/1.55 Arial,sans-serif;color:#333">${tldr}</ul>
  </div>
</td></tr>
<tr><td style="padding:4px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${storyHtml}${quickHtml}</table>
</td></tr>
${ai.insight ? `<tr><td style="padding:18px 28px"><div style="border-left:4px solid ${accent};padding:10px 14px;font:italic 15px/1.55 Georgia,serif;color:#333">💡 ${esc(ai.insight)}</div></td></tr>` : ''}
<tr><td style="padding:16px 28px 26px;font:12px Arial,sans-serif;color:#999">Curated by your AI news editor from ${$('Clean & Rank').first().json.count} fresh articles. Change topics & sources in the Config node of your n8n workflow.</td></tr>
</table></td></tr></table></body></html>`;

const tg = [
  `<b>☕ ${esc(cfg.digest_name || 'Daily AI Briefing')}</b> — ${esc(today)}`,
  '',
  '<b>TL;DR</b>',
  ...(ai.tldr || []).map((t) => `• ${esc(t)}`),
  '',
  ...stories.map((s, i) => `${esc(s.emoji || '📰')} <b>${i + 1}. <a href="${esc(s.link)}">${esc(s.headline)}</a></b>\n${esc(s.summary)}\n<i>Why it matters:</i> ${esc(s.why_it_matters)}\n`),
].join('\n').slice(0, 4000);

return {
  json: {
    subject: `☕ ${cfg.digest_name || 'Daily AI Briefing'} — ${stories[0] ? stories[0].headline : today}`.slice(0, 150),
    html,
    telegram: tg,
    stories: stories.length,
  },
};
