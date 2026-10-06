// Screenshots HTML pages at an exact size (used for the Gumroad listing images).
// usage: node build/lib/shot.js width height scale input.html output.png [input2.html output2.png ...]
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

(async () => {
  const [width, height, scale, ...pairs] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: +width, height: +height }, deviceScaleFactor: +scale });
  for (let i = 0; i < pairs.length; i += 2) {
    const failed = [];
    page.removeAllListeners('requestfailed');
    page.on('requestfailed', (r) => failed.push(r.url()));
    await page.goto('file://' + path.resolve(pairs[i]), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const broken = await page.evaluate(() => [...document.images].filter((img) => !img.naturalWidth).map((img) => img.src));
    if (failed.length || broken.length) throw new Error(`${pairs[i]}: missing ${[...failed, ...broken].join(', ')}`);
    const overflow = await page.evaluate(() => [document.documentElement.scrollWidth > innerWidth, document.documentElement.scrollHeight > innerHeight]);
    if (overflow[0] || overflow[1]) console.log(`  ⚠️ ${path.basename(pairs[i])} overflows the ${width}×${height} frame`);
    await page.screenshot({ path: pairs[i + 1] });
    console.log('wrote', path.relative(process.cwd(), pairs[i + 1]));
  }
  await browser.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
