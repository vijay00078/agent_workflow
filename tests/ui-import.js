// Imports every workflow through the n8n editor UI ("Import from file"), checks
// that every node renders with a known type, lists node issues (missing
// credentials are expected, anything else is a problem) and saves screenshots.
//
// usage: node tests/ui-import.js [outDir] [--clean] [--crop]
//   --clean  attach placeholder credentials so no warning icons show (marketing shots)
//   --crop   (implies --clean) zoom so the text is readable, hide the editor UI and
//            save only the workflow itself -> build/screenshots/canvas (guide + listing images)
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const BASE = process.env.N8N_URL || 'http://localhost:5678';
const ROOT = path.join(__dirname, '..');
const CROP = process.argv.includes('--crop');
const CLEAN = CROP || process.argv.includes('--clean');
const OUT = process.argv.slice(2).find((a) => !a.startsWith('--'))
  || path.join(ROOT, 'build', 'screenshots', CROP ? 'canvas' : CLEAN ? 'clean' : 'raw');
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

// Floating editor UI on top of the canvas (tabs, zoom buttons, execute button, node panel, toasts)
const HIDE_UI_CSS = `
  .tab-bar-container, [data-test-id="canvas-controls"], [class*="_executionButtons_"],
  [class*="_nodeButtonsWrapper_"], [data-test-id="resize-handle"], .el-notification { display: none !important; }`;

// Screen-space bounding box of everything drawn for the nodes (incl. labels below them) + current zoom
function measureCanvas(page) {
  return page.evaluate(() => {
    const w = document.querySelector('[data-test-id="canvas-wrapper"]').getBoundingClientRect();
    const pane = document.querySelector('.vue-flow__transformationpane');
    const zoom = parseFloat(((pane && pane.style.transform) || '').match(/scale\(([\d.]+)\)/)?.[1] || '1');
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const el of document.querySelectorAll('.vue-flow__node, .vue-flow__node *, .vue-flow__edge-path')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
      box.x0 = Math.min(box.x0, r.left); box.y0 = Math.min(box.y0, r.top);
      box.x1 = Math.max(box.x1, r.right); box.y1 = Math.max(box.y1, r.bottom);
    }
    return { wrap: { x: w.left, y: w.top, w: w.width, h: w.height }, zoom, box };
  });
}

async function zoomToFit(page) {
  await page.locator('[data-test-id="zoom-to-fit"]').first().click();
  await page.waitForTimeout(800);
}

// Resizes the window so "zoom to fit" lands on a readable zoom, then screenshots just the workflow
async function croppedScreenshot(page, file) {
  const original = page.viewportSize();
  const m1 = await measureCanvas(page);
  const widthAt1 = (m1.box.x1 - m1.box.x0) / m1.zoom;
  const heightAt1 = (m1.box.y1 - m1.box.y0) / m1.zoom;
  const zoom = Math.min(0.9, Math.max(0.45, 1500 / widthAt1));
  const chromeW = original.width - m1.wrap.w;
  const chromeH = original.height - m1.wrap.h;
  await page.setViewportSize({
    width: Math.ceil(widthAt1 * zoom * 1.3 + chromeW + 40),
    height: Math.ceil(heightAt1 * zoom * 1.3 + chromeH + 40),
  });
  await page.waitForTimeout(500);
  await zoomToFit(page);
  await page.addStyleTag({ content: HIDE_UI_CSS });
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  const m2 = await measureCanvas(page);
  const pad = 28;
  const x = Math.max(m2.wrap.x, Math.floor(m2.box.x0 - pad));
  const y = Math.max(m2.wrap.y, Math.floor(m2.box.y0 - pad));
  const clip = {
    x, y,
    width: Math.min(m2.wrap.x + m2.wrap.w, Math.ceil(m2.box.x1 + pad)) - x,
    height: Math.min(m2.wrap.y + m2.wrap.h, Math.ceil(m2.box.y1 + pad)) - y,
  };
  await page.screenshot({ path: path.join(OUT, file.replace('.json', '.png')), clip });
  console.log(`  📸 cropped at zoom ${m2.zoom.toFixed(2)} → ${Math.round(clip.width)}×${Math.round(clip.height)} css px`);
  await page.setViewportSize(original);
}

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
    await zoomToFit(page);
    await page.evaluate(() => document.querySelectorAll('.el-notification, [role="alert"], .el-message').forEach((e) => e.remove()));
    await page.mouse.click(5, 500);
    await page.waitForTimeout(300);
    if (CROP) await croppedScreenshot(page, file);
    else await page.screenshot({ path: path.join(OUT, file.replace('.json', '.png')) });
  }
  await browser.close();
  console.log(`\nDone. Screenshots in ${OUT}`);
  process.exitCode = failures ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
