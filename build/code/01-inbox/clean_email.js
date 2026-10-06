// Prepares each email for the AI: who sent it, what they actually wrote
// (quoted history removed) and signals that it was sent by a machine.
const email = $json;
const sender = (email.from && email.from.value && email.from.value[0]) || {};
const headers = email.headers || {};
const header = (name) => String(headers[name] || '').replace(/^[^:]+:\s*/, '').trim();

function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

let body = String(email.text || '').trim() || htmlToText(email.html || email.textAsHtml);
body = body.replace(/\r/g, '');

// Cut off quoted replies / forwarded history so the AI only reads the new message
const historyMarkers = [
  /\nOn [^\n]{3,250}wrote:\s*\n/i,
  /\n-{2,}\s*Original Message\s*-{2,}/i,
  /\nFrom:\s[^\n]+\n(?:Sent|Date):\s/i,
  /\n_{10,}\s*\n/,
  /\nLe [^\n]{3,250}a écrit\s?:/i,
  /\nAm [^\n]{3,250}schrieb[^\n]*:/i,
  /\nEl [^\n]{3,250}escribió:/i,
];
for (const marker of historyMarkers) {
  const at = body.search(marker);
  if (at > 40) body = body.slice(0, at);
}
body = body
  .split('\n')
  .filter((line) => !/^\s*>/.test(line))
  .join('\n')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
if (body.length > 6000) body = body.slice(0, 6000) + '\n[...email truncated]';

const fromEmail = String(sender.address || '').toLowerCase();
const autoSubmitted = header('auto-submitted');
const automated = Boolean(
  header('list-unsubscribe') ||
    /^(bulk|list|junk)$/i.test(header('precedence')) ||
    (autoSubmitted && !/^no$/i.test(autoSubmitted)) ||
    /(^|[._-])(no-?reply|do-?not-?reply|notifications?|mailer-daemon|bounces?|alerts?)@/i.test(fromEmail)
);

return {
  json: {
    messageId: email.id,
    threadId: email.threadId,
    fromName: sender.name || fromEmail.split('@')[0] || 'there',
    fromEmail,
    subject: String(email.subject || '(no subject)').trim(),
    receivedAt: email.date || new Date().toISOString(),
    body: body || '(empty email)',
    automated,
  },
};
