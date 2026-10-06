// Pulls the useful parts out of WhatsApp's webhook payload:
// who wrote, what type of message it is and the text / media id.
const value = $json;
const msg = (value.messages || [])[0] || {};
const contact = (value.contacts || [])[0] || {};

const text =
  (msg.text && msg.text.body) ||
  (msg.button && msg.button.text) ||
  (msg.interactive && ((msg.interactive.button_reply && msg.interactive.button_reply.title) ||
    (msg.interactive.list_reply && msg.interactive.list_reply.title))) ||
  '';
const media = msg.audio || msg.voice || msg.image || msg.video || msg.document || msg.sticker || {};

return {
  json: {
    phone_number_id: (value.metadata && value.metadata.phone_number_id) || '',
    from: msg.from || contact.wa_id || '',
    name: (contact.profile && contact.profile.name) || '',
    message_id: msg.id || '',
    type: msg.type || 'unknown',
    text: String(text).trim(),
    media_id: media.id || '',
    caption: media.caption || '',
  },
};
