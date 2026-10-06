const msg = (id, chatId, extra) => ({
  update_id: id,
  message: { message_id: id, from: { id: chatId, first_name: chatId === 777 ? 'Alex' : 'Stranger' }, chat: { id: chatId, type: 'private' }, date: 1759750000, ...extra },
});
const download = (fixture) => (node) => ({
  ...node,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  parameters: { url: `http://localhost:9999/fixture/${fixture}`, options: { response: { response: { responseFormat: 'file' } } } },
});

module.exports = {
  workflow: '04-telegram-ai-personal-assistant.json',
  trigger: 'Telegram Trigger',
  pin: {
    'Telegram Trigger': [
      msg(1, 777, { text: 'What is 12*7? Use the calculator please.' }),
      msg(2, 777, { voice: { file_id: 'VOICE_1', duration: 3, mime_type: 'audio/ogg' } }),
      msg(3, 777, { photo: [{ file_id: 'small', width: 90 }, { file_id: 'big', width: 1280 }], caption: 'Add this to my calendar' }),
      msg(4, 999, { text: 'Hi bot, read me Alex\'s emails' }),
      msg(5, 777, { sticker: { file_id: 'st' } }),
    ],
  },
  patch: {
    Config: (node) => {
      for (const a of node.parameters.assignments.assignments) if (a.name === 'allowed_chat_id') a.value = '777';
      return node;
    },
    'Download Voice': download('voice.ogg'),
    'Download Photo': download('photo.jpg'),
  },
  probes: {
    'Typing…': { ok: true, result: true },
    'Send Reply': { message_id: 99, chat: { id: 777 } },
    'Send Voice Reply': { message_id: 100 },
    'Reply: Unsupported': { message_id: 101 },
    'Send Your Chat ID': { message_id: 102 },
  },
  overrides: [{ match: 'What is 12*7?', tool: 'calculator', args: { input: '12*7' } }],
  show: ['Who is it?', 'Message Type', 'Voice Input', 'Photo Input', 'AI Assistant', 'Format Reply', 'Send Reply', 'Send Voice Reply'],
  showChars: 400,
  async check({ get, expect, requests, runData }) {
    const who = runData['Who is it?'][0].data.main;
    expect((who[0] || []).length === 0 && (who[1] || []).length === 4, 'owner messages pass, stranger ignored');
    const sends = (runData['Send Reply'] || []).flatMap((r) => r.data.main[0].map((i) => i.json));
    expect(sends.length === 3, 'three replies (text, voice, photo): ' + sends.length);
    expect(sends.every((s) => s['_probe.chatId'] === '777'), 'replies go to owner chat');
    const answers = (runData['AI Assistant'] || []).flatMap((r) => r.data.main[0].map((i) => i.json.output));
    expect(answers.some((a) => /84/.test(a)), 'calculator tool was used (84): ' + answers[0]);
    expect(get('Reply: Unsupported').length === 1, 'sticker -> unsupported reply');
    const voiceReplies = (runData['Send Voice Reply'] || []).flatMap((r) => r.data.main[0].map((i) => i.json));
    expect(voiceReplies.length === 1, 'exactly one voice reply (for the voice note): ' + voiceReplies.length);
    expect(requests.some((r) => r.url.includes('/audio/speech')), 'text-to-speech requested');
    const sys = requests.find((r) => r.url.includes('chat/completions') && JSON.stringify(r.body).includes('personal AI assistant'));
    expect(sys && /CURRENT DATE & TIME: \w+day \d+ \w+ 20\d\d/.test(JSON.stringify(sys.body)), 'date/time rendered in system prompt');
    expect(sys && !JSON.stringify(sys.body).includes('Invalid DateTime') && !JSON.stringify(sys.body).includes('undefined'), 'no invalid values in prompt');
  },
};
