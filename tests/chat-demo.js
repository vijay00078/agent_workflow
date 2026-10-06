// Publishes the website chatbot (WF03) in the local n8n, opens its hosted chat
// page in Chromium, asks a question and saves screenshots (used to verify the
// chat page + theme on n8n 2.x, and as product images). Then embeds the pack's
// website-chat-widget.html on a page served from another origin and chats
// through it (verifies the embed snippet + CORS).
const fs = require('fs');
const path = require('path');
const client = require('./n8n-client');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'screenshots', 'chat');
const WIDGET = path.join(ROOT, 'product', 'website-chat-widget', 'website-chat-widget.html');
const LOCAL_CHAT = '/tmp/n8nchat/package/dist/';

// The chat UI loads @n8n/chat from cdn.jsdelivr.net (blocked in this sandbox):
// serve the identical files from the npm package instead.
async function routeChatCdn(page) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/@n8n\/chat(@[^/]+)?\/dist\/.*/, (route) => {
    const file = route.request().url().replace(/^.*\/dist\//, '').split('?')[0];
    const full = LOCAL_CHAT + file;
    if (!fs.existsSync(full)) return route.fulfill({ status: 404, body: 'missing ' + file });
    const type = file.endsWith('.css') ? 'text/css' : 'application/javascript';
    return route.fulfill({ path: full, contentType: type });
  });
}

// Serves a directory on 127.0.0.1:<port> (a different origin than n8n on localhost:5678)
function serveDir(dir, port) {
  const http = require('http');
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

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
    await routeChatCdn(page);
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

    // --- The pack's website-chat-widget.html, embedded on a page from another origin ---
    const siteDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'widget-'));
    const html = fs.readFileSync(WIDGET, 'utf8').replace("const CHAT_URL = 'PASTE-YOUR-CHAT-URL-HERE'", `const CHAT_URL = '${url}'`);
    if (!html.includes(`const CHAT_URL = '${url}'`)) throw new Error('widget CHAT_URL line not found');
    fs.writeFileSync(path.join(siteDir, 'index.html'), html);
    const server = await serveDir(siteDir, 8765);
    try {
      const site = await browser.newPage({ viewport: { width: 1180, height: 780 }, deviceScaleFactor: 2 });
      const corsErrors = [];
      site.on('console', (m) => { if (m.type() === 'error') corsErrors.push(m.text()); });
      await routeChatCdn(site);
      await site.goto('http://127.0.0.1:8765/');
      await site.waitForSelector('.chat-window-toggle', { timeout: 20000 });
      if (await site.locator('#warn').isVisible()) throw new Error('widget shows the "paste your URL" warning');
      await site.click('.chat-window-toggle');
      await site.waitForSelector('textarea', { timeout: 10000 });
      await site.fill('textarea', 'How much is the Pro plan?');
      await site.keyboard.press('Enter');
      await site.waitForFunction(() => document.body.innerText.includes('14-day free trial'), null, { timeout: 30000 });
      await site.waitForTimeout(800);
      await site.screenshot({ path: path.join(OUT, 'widget-on-website.png') });
      console.log('widget on another origin answered ✅', corsErrors.length ? 'console errors: ' + corsErrors.join(' | ').slice(0, 300) : '');
    } finally {
      server.close();
    }
    await browser.close();
  } finally {
    try { await client.call('POST', `/rest/workflows/${created.id}/deactivate`, {}); } catch (e) { console.log('deactivate:', e.message.slice(0, 120)); }
    await client.deleteWorkflow(created.id);
  }
})().catch((e) => { console.error(e); process.exit(1); });
