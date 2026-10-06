// Converts the AI answer (markdown) into Telegram-safe HTML so formatting
// never breaks the message, and prepares a plain-text version for voice replies.
const trigger = $('Telegram Trigger').item.json.message || {};
const raw = String($json.output || '').trim() || "Sorry, I couldn't come up with an answer. Please try again.";
const md = raw.length > 3800 ? raw.slice(0, 3800) + '…' : raw;

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const blocks = [];
let html = md.replace(/```[\w+-]*\n?([\s\S]*?)```/g, (m, codeText) => {
  blocks.push('<pre>' + escapeHtml(codeText.trim()) + '</pre>');
  return `\u0000${blocks.length - 1}\u0000`;
});
html = escapeHtml(html)
  .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, text, url) => `<a href="${url.replace(/"/g, '&quot;')}">${text}</a>`)
  .replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')
  .replace(/^(\s*)[-*•]\s+/gm, '$1• ')
  .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
  .replace(/__([^_\n]+)__/g, '<b>$1</b>')
  .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<i>$2</i>')
  .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
  .replace(/\u0000(\d+)\u0000/g, (m, i) => blocks[Number(i)]);

const plain = md
  .replace(/```[\w+-]*\n?([\s\S]*?)```/g, '$1')
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
  .replace(/\*\*([^*\n]+)\*\*/g, '$1')
  .replace(/__([^_\n]+)__/g, '$1')
  .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1$2')
  .replace(/`([^`\n]+)`/g, '$1')
  .replace(/~~([^~\n]+)~~/g, '$1')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/^\s*[-*•]\s+/gm, '')
  .trim();

return {
  json: {
    chat_id: trigger.chat ? trigger.chat.id : null,
    html,
    plain: plain.slice(0, 4000),
    input_type: trigger.voice ? 'voice' : trigger.photo ? 'photo' : 'text',
  },
};
