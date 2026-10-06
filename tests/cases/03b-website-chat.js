// Chat run (run 03a first so the in-memory knowledge base is filled)
module.exports = {
  workflow: '03-ai-website-chatbot.json',
  trigger: 'Chat Trigger',
  pin: { 'Chat Trigger': [{ sessionId: 'session-123', action: 'sendMessage', chatInput: 'How much is the Pro plan?' }] },
  overrides: [{ match: 'How much is the Pro plan?', tool: 'knowledge', args: { input: 'Pro plan price' } }],
  show: ['AI Support Agent'],
  showChars: 900,
  async check({ get, expect, requests }) {
    const out = get('AI Support Agent');
    expect(out.length === 1 && typeof out[0].output === 'string', 'agent answered');
    // mock embeddings are random, so only check that real website content came back from the tool
    expect(out[0].output.includes('Source: http://localhost:9999/site'), 'answer used the knowledge base: ' + out[0].output.slice(0, 200));
    const toolDefs = requests.filter((r) => r.body && r.body.tools).map((r) => r.body.tools.map((t) => t.function.name).join(','));
    console.log('tools offered to the model:', toolDefs[0]);
    expect(!String(toolDefs[0]).toLowerCase().includes('save_lead'), 'disabled lead tool not offered');
  },
};
