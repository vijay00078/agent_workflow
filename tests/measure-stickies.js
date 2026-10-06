// Measures how tall the text of every sticky note renders in the n8n editor and
// writes build/sticky-heights.json, so the generator can size notes to their text.
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const BASE = process.env.N8N_URL || 'http://localhost:5678';
const ROOT = path.join(__dirname, '..');
const WF_DIR = path.join(ROOT, 'product', 'workflows');
const OUT = path.join(ROOT, 'build', 'sticky-heights.json');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto(`${BASE}/signin`);
  await page.fill('input[type=email], input[name=emailOrLdapLoginId], input[name=email]', 'owner@example.com');
  await page.fill('input[type=password]', 'StarterPack123!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.includes('signin'));

  const result = {};
  for (const file of fs.readdirSync(WF_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const wf = JSON.parse(fs.readFileSync(path.join(WF_DIR, file), 'utf8'));
    await page.goto(`${BASE}/workflow/new`);
    await page.waitForSelector('.vue-flow');
    await page.setInputFiles('[data-test-id="workflow-import-input"]', path.join(WF_DIR, file));
    await page.waitForTimeout(2500);
    const heights = await page.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll('[data-node-type="n8n-nodes-base.stickyNote"]')) {
        const candidates = [...el.querySelectorAll('div')].filter((d) => d.querySelector('h2, h3, p, ul'));
        const md = candidates[candidates.length - 1];
        if (md) out[el.getAttribute('data-node-name')] = md.scrollHeight;
      }
      return out;
    });
    result[wf.name] = heights;
    console.log(file, JSON.stringify(heights));
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
  await browser.close();
  console.log('wrote', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
