// Default config (allowed_chat_id empty): the bot must only reply with the chat ID
module.exports = {
  workflow: '04-telegram-ai-personal-assistant.json',
  trigger: 'Telegram Trigger',
  pin: { 'Telegram Trigger': [{ update_id: 1, message: { message_id: 1, from: { id: 555, first_name: 'Priya' }, chat: { id: 555, type: 'private' }, date: 1759750000, text: 'hello' } }] },
  probes: { 'Send Your Chat ID': { message_id: 1 } },
  show: ['Send Your Chat ID'],
  async check({ get, expect, runData, requests }) {
    const sent = get('Send Your Chat ID');
    expect(sent.length === 1 && sent[0]['_probe.text'].includes('<code>555</code>') && sent[0]['_probe.text'].includes('Hi Priya'), 'setup message with chat id');
    expect(!runData['AI Assistant'], 'agent NOT run before the bot is locked');
    expect(requests.length === 0, 'no AI calls');
  },
};
