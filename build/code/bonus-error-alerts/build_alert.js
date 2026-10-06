// Formats the alert for email and Telegram (works even if the AI step failed).
const e = $('Error Details').item.json;
const explanation = String($json.text || '').trim() ||
  'The AI explanation is not available right now. Open the execution to see the full error.';
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<div style="font-family:Arial,sans-serif;max-width:640px">
<div style="background:#dc2626;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
  <div style="font-size:20px;font-weight:bold">⚠️ Workflow failed: ${esc(e.workflow_name)}</div>
  <div style="opacity:.85;margin-top:4px">${esc(e.time)} · node “${esc(e.node)}”</div>
</div>
<div style="border:1px solid #fecaca;border-top:none;padding:18px 22px;border-radius:0 0 12px 12px">
  <p style="margin:0 0 6px;font-weight:bold">Error</p>
  <pre style="white-space:pre-wrap;background:#fef2f2;padding:10px;border-radius:8px;font-size:13px;margin:0">${esc(e.message)}${e.description ? '\n\n' + esc(e.description) : ''}</pre>
  <p style="margin:16px 0 6px;font-weight:bold">🤖 What happened & how to fix it</p>
  <div style="white-space:pre-wrap;line-height:1.55;font-size:14px">${esc(explanation)}</div>
  ${e.execution_url ? `<p style="margin-top:18px"><a href="${esc(e.execution_url)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open the failed execution →</a></p>` : ''}
  <p style="color:#888;font-size:12px;margin-top:16px">Same error again within the quiet period? You won't get duplicate alerts.</p>
</div></div>`;

const telegram = [
  `⚠️ <b>Workflow failed:</b> ${esc(e.workflow_name)}`,
  `<b>Node:</b> ${esc(e.node)} · ${esc(e.time)}`,
  `<b>Error:</b> <code>${esc(e.message.slice(0, 500))}</code>`,
  '',
  esc(explanation.slice(0, 2500)),
  e.execution_url ? `\n<a href="${esc(e.execution_url)}">Open execution</a>` : '',
].join('\n');

return { json: { subject: `⚠️ n8n workflow failed: ${e.workflow_name}`, html, telegram } };
