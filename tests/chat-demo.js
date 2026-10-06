// Publishes the website chatbot (WF03) in the local n8n, opens its hosted chat
// page in Chromium, asks a question and saves screenshots (used to verify the
// chat page + theme on n8n 2.x, and as product images).
const fs = require('fs');
const path = require('path');
const client = require('./n8n-client');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'screenshots', 'chat');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'mock-openai', 'overrides.json'), JSON.stringify([
    { match: 'How much is the Pro plan', respond: 'The **Pro plan** is **$149/month** 💜\n\nIt includes:\n- Monthly bookkeeping\n- Payroll for up to 10 employees\n- Quarterly tax estimates\n\nAll plans come with a **14-day free trial**. Would you like me to book a free 20-minute consultation for you?' },
  ]));
  await client.login();
  const openai = await client.credential('OpenAI (mock)', 'openAiApi', { apiKey: 'sk-mock', url: 'http://localhost:9999/v1' });
  const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'product', 'workflows', '03-ai-website-chatbot.json'), 'utf8'));
  for (const node of wf.nodes) {
    if (/lmChatOpenAi|embeddingsOpenAi/.test(node.type)) node.credentials = { openAiApi: { id: openai.id, name: openai.name } };
    if (node.name === 'Config') for (const a of node.parameters.assignments.assignments) {
      if (a.name === 'website_url') a.value = 'http://localhost:9999/site';
      if (a.name === 'business_name') a.value = 'Example Co.';
    }
  }
  const trigger = wf.nodes.find((n) => n.type === '@n8n/n8n-nodes-langchain.chatTrigger');
  trigger.parameters.initialMessages = "Hi there! 👋\nI'm Ava, the AI assistant for Example Co. Ask me anything about our plans, pricing or services.";
  const created = await client.createWorkflow({ ...wf, name: '[DEMO] ' + wf.name });
  try {
    await client.call('POST', `/rest/workflows/${created.id}/activate`, { versionId: created.versionId });
    console.log('published', created.id);
    await new Promise((r) => setTimeout(r, 4000)); // let the startup/publish training run finish

    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    const page = await browser.newPage({ viewport: { width: 520, height: 820 }, deviceScaleFactor: 2 });
    // The hosted chat page loads @n8n/chat from cdn.jsdelivr.net (blocked in this sandbox):
    // serve the identical files from the npm package instead.
    const LOCAL = '/tmp/n8nchat/package/dist/';
    await page.route(/cdn\.jsdelivr\.net\/npm\/@n8n\/chat(@[^/]+)?\/dist\/.*/, (route) => {
      const file = route.request().url().replace(/^.*\/dist\//, '').split('?')[0];
      const full = LOCAL + file;
      if (!fs.existsSync(full)) return route.fulfill({ status: 404, body: 'missing ' + file });
      const type = file.endsWith('.css') ? 'text/css' : 'application/javascript';
      return route.fulfill({ path: full, contentType: type });
    });
    const url = `http://localhost:5678/webhook/${trigger.webhookId}/chat`;
    await page.goto(url);
    await page.waitForSelector('textarea', { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'chat-welcome.png') });
    await page.fill('textarea', 'How much is the Pro plan?');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.body.innerText.includes('14-day free trial'), null, { timeout: 30000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'chat-answer.png') });
    const colors = await page.evaluate(() => {
      const user = [...document.querySelectorAll('.chat-message-from-user, [class*="from-user"]')][0];
      return user ? getComputedStyle(user).backgroundColor : 'n/a';
    });
    console.log('user bubble colour:', colors);
    await browser.close();
  } finally {
    try { await client.call('POST', `/rest/workflows/${created.id}/deactivate`, {}); } catch (e) { console.log('deactivate:', e.message.slice(0, 120)); }
    await client.deleteWorkflow(created.id);
  }
})().catch((e) => { console.error(e); process.exit(1); });
