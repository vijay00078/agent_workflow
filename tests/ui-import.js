// Imports every workflow through the n8n editor UI ("Import from file"), checks
// that every node renders with a known type, lists node issues (missing
// credentials are expected, anything else is a problem) and saves screenshots.
//
// usage: node tests/ui-import.js [outDir]
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const BASE = process.env.N8N_URL || 'http://localhost:5678';
const ROOT = path.join(__dirname, '..');
const CLEAN = process.argv.includes('--clean');
const OUT = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(ROOT, 'build', 'screenshots', CLEAN ? 'clean' : 'raw');
const os = require('os');
const client = require('./n8n-client');

// For marketing screenshots: attach placeholder credentials so no warning icons show
function credentialTypeFor(node) {
  const t = node.type;
  if (/\.gmail(Trigger|Tool)?$/.test(t)) return 'gmailOAuth2';
  if (/\.googleSheets(Tool)?$/.test(t)) return 'googleSheetsOAuth2Api';
  if (/\.googleDrive(Trigger)?$/.test(t)) return 'googleDriveOAuth2Api';
  if (t.endsWith('.httpRequest')) {
    if (node.parameters.authentication === 'predefinedCredentialType') return node.parameters.nodeCredentialType;
    if (node.parameters.genericAuthType === 'httpHeaderAuth') return 'httpHeaderAuth';
  }
  return null;
}
const WF_DIR = path.join(ROOT, 'product', 'workflows');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const context = await browser.newContext({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 200)));

  await page.goto(`${BASE}/signin`);
  await page.fill('input[type=email], input[name=emailOrLdapLoginId], input[name=email]', 'owner@example.com');
  await page.fill('input[type=password]', 'StarterPack123!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 30000 });

  const files = fs.readdirSync(WF_DIR).filter((f) => f.endsWith('.json')).sort();
  let credsByType = {};
  if (CLEAN) {
    await client.login();
    for (const c of await client.call('GET', '/rest/credentials')) credsByType[c.type] = credsByType[c.type] || { id: c.id, name: c.name };
  }
  let failures = 0;
  for (const file of files) {
    const wf = JSON.parse(fs.readFileSync(path.join(WF_DIR, file), 'utf8'));
    await page.goto(`${BASE}/workflow/new`);
    await page.waitForSelector('[data-test-id="canvas-wrapper"], .vue-flow', { timeout: 30000 });
    let importPath = path.join(WF_DIR, file);
    if (CLEAN) {
      const copy = JSON.parse(JSON.stringify(wf));
      for (const node of copy.nodes) {
        const type = credentialTypeFor(node);
        if (type && credsByType[type]) node.credentials = { [type]: credsByType[type] };
      }
      importPath = path.join(os.tmpdir(), file);
      fs.writeFileSync(importPath, JSON.stringify(copy));
    }
    await page.setInputFiles('[data-test-id="workflow-import-input"]', importPath);
    await page.waitForFunction((n) => document.querySelectorAll('[data-test-id="canvas-node"]').length >= n, wf.nodes.filter((x) => x.type !== 'n8n-nodes-base.stickyNote').length, { timeout: 30000 });
    await page.waitForTimeout(1500);

    const { state, issues, blocking } = await page.evaluate(() => {
      const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      const docKey = [...pinia._s.keys()].filter((k) => k.startsWith('workflowDocuments/'))
        .find((k) => (pinia._s.get(k).allNodes || []).length > 0);
      const doc = pinia._s.get(docKey);
      const nodeTypes = pinia._s.get('nodeTypes');
      const nodes = doc.allNodes;
      return {
        state: nodes.map((n) => ({
          name: n.name,
          type: n.type,
          known: !!nodeTypes.getNodeType(n.type, n.typeVersion),
          disabled: !!n.disabled,
          issues: n.issues || null,
        })),
        issues: JSON.parse(JSON.stringify(doc.nodeValidationIssues || [])),
        blocking: doc.hasPublishBlockingIssues,
      };
    });

    const unknown = state.filter((n) => !n.known && n.type !== 'n8n-nodes-base.stickyNote');
    const nonCredential = issues.filter((i) => i.type !== 'credentials');
    const credNodes = [...new Set(issues.filter((i) => i.type === 'credentials').map((i) => i.node))];
    console.log(`\n${file}: ${state.length} nodes rendered, publish blocked: ${blocking}`);
    if (unknown.length) { failures++; console.log('  ❌ unknown node types:', unknown.map((n) => `${n.name} (${n.type})`).join(', ')); }
    for (const i of nonCredential) console.log(`  ⚠️ ${i.node} [${i.type}]: ${JSON.stringify(i.value).slice(0, 250)}`);
    console.log(`  ℹ️ needs credentials (${credNodes.length}): ${credNodes.join(', ') || 'none'}`);

    // Fit the canvas, hide toasts and take a screenshot
    const fit = page.locator('[data-test-id="zoom-to-fit"]');
    if (await fit.count()) await fit.first().click();
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelectorAll('.el-notification, [role="alert"], .el-message').forEach((e) => e.remove()));
    await page.mouse.click(5, 500);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, file.replace('.json', '.png')) });
  }
  await browser.close();
  console.log(`\nDone. Screenshots in ${OUT}`);
  process.exitCode = failures ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
