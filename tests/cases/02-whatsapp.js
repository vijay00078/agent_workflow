const base = (msg, name = 'Maria Lopez') => ({
  messaging_product: 'whatsapp',
  metadata: { display_phone_number: '15550100', phone_number_id: '1234567890' },
  contacts: [{ profile: { name }, wa_id: msg.from }],
  messages: [msg],
  field: 'messages',
});

module.exports = {
  workflow: '02-whatsapp-ai-auto-reply-bot.json',
  trigger: 'WhatsApp Trigger',
  pin: {
    'WhatsApp Trigger': [
      base({ from: '15551230001', id: 'wamid.text1', timestamp: '1759750000', type: 'text', text: { body: 'Hi! How much is a keratin treatment and are you open on Monday?' } }),
      base({ from: '15551230002', id: 'wamid.voice1', timestamp: '1759750001', type: 'audio', audio: { id: 'media-voice-1', mime_type: 'audio/ogg; codecs=opus', voice: true } }, 'Tom'),
      base({ from: '15551230003', id: 'wamid.img1', timestamp: '1759750002', type: 'image', image: { id: 'media-img-1', mime_type: 'image/jpeg', caption: 'Can you do this style?' } }, 'Aisha'),
      base({ from: '15551230004', id: 'wamid.sticker1', timestamp: '1759750003', type: 'sticker', sticker: { id: 'media-st-1' } }, 'Ben'),
      { messaging_product: 'whatsapp', metadata: { phone_number_id: '1234567890' }, statuses: [{ id: 'x', status: 'delivered' }], field: 'messages' },
    ],
  },
  credentials: { whatsAppApi: { name: 'WhatsApp (mock)', data: { accessToken: 'mock-token', businessAccountId: '999' } } },
  credentialNodes: { 'Download Voice': 'whatsAppApi', 'Download Image': 'whatsAppApi' },
  probes: {
    'Typing Indicator': { success: true },
    'Get Voice File': { url: 'http://localhost:9999/fixture/voice.ogg', mime_type: 'audio/ogg', id: 'media-voice-1', messaging_product: 'whatsapp' },
    'Get Image File': { url: 'http://localhost:9999/fixture/photo.jpg', mime_type: 'image/jpeg', id: 'media-img-1', messaging_product: 'whatsapp' },
    'Send WhatsApp Reply': { messaging_product: 'whatsapp', messages: [{ id: 'wamid.reply' }] },
    'Reply: Unsupported Type': { messaging_product: 'whatsapp', messages: [{ id: 'wamid.reply2' }] },
  },
  overrides: [
    { match: 'keratin treatment', respond: 'Hi Maria! 😊 A keratin treatment starts at *$180*. We are closed on Mondays — open Tue–Sun 10:00–20:00.' },
  ],
  show: ['Extract Message', 'Route by Type', 'Voice Message', 'Image Message', 'AI Agent', 'Send WhatsApp Reply', 'Reply: Unsupported Type', 'Describe Image', 'Transcribe Voice'],
  async check({ get, expect, requests, runData }) {
    expect(get('Is a Message?').length === 4, 'status update filtered out');
    const sends = (runData['Send WhatsApp Reply'] || []).flatMap((r) => r.data.main[0].map((i) => i.json));
    expect(sends.length === 3, `three AI replies sent (got ${sends.length})`);
    const recipients = sends.map((s) => s['_probe.recipientPhoneNumber']).sort();
    expect(JSON.stringify(recipients) === JSON.stringify(['15551230001', '15551230002', '15551230003']), 'replies go to the right customers: ' + recipients);
    expect(sends.every((s) => s['_probe.phoneNumberId'] === '1234567890'), 'phone number id resolved');
    expect(sends.some((s) => s['_probe.textBody'].includes('*Hello!*') && s['_probe.textBody'].includes('link: https://example.com') && !s['_probe.textBody'].includes('**')), 'markdown converted to WhatsApp format');
    expect(get('Reply: Unsupported Type').length === 1, 'sticker gets the unsupported reply');
    expect(requests.some((r) => r.url.includes('audio/transcriptions')), 'voice note transcribed');
    const agentPrompts = requests.filter((r) => r.url.includes('chat/completions') && JSON.stringify(r.body).includes('WhatsApp assistant'));
    expect(agentPrompts.length === 3, 'agent called 3 times');
    expect(agentPrompts.some((r) => JSON.stringify(r.body).includes('Mock transcript')), 'transcript passed to agent');
    expect(agentPrompts.some((r) => JSON.stringify(r.body).includes('[The customer sent a photo]')), 'photo description passed to agent');
    expect(agentPrompts.every((r) => !JSON.stringify(r.body).includes('undefined')), 'no undefined in prompts');
  },
};
