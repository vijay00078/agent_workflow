#!/usr/bin/env node
// Renders Gumroad cover (1280x720) and thumbnail (600x600) images into marketing/ from HTML,
// using the real screenshots in docs/img. Run after scripts/screenshots.js.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'docs', 'img');
const OUT = path.join(ROOT, 'marketing');

function chromiumPath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const d of fs.readdirSync(base).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
    const p = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// Embedded as data URIs: a page created with setContent() may not load file:// images.
const img = (name) => `data:image/png;base64,${fs.readFileSync(path.join(IMG, name)).toString('base64')}`;
const BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,Arial,sans-serif;color:#fff;overflow:hidden}
  .bg{position:absolute;inset:0;background:linear-gradient(140deg,#1E1B4B 0%,#312E81 50%,#4F46E5 100%)}
  .glow{position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(129,140,248,.45),transparent 70%);right:-200px;top:-260px}
  .tag{display:inline-block;font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3)}
  .tag.free{background:#10B981;border-color:#10B981}
  .tag.pro{background:#F59E0B;border-color:#F59E0B;color:#1F2937}
  h1{font-weight:800;letter-spacing:-.025em;line-height:1.04}
  .shot{border-radius:14px;box-shadow:0 30px 60px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.25);background:#fff;overflow:hidden}
  .shot img{display:block;width:100%}
  ul{list-style:none}
  li{display:flex;gap:10px;align-items:flex-start;font-size:20px;line-height:1.35;margin:9px 0;color:#E0E7FF}
  li b{color:#fff}
  .dot{flex:0 0 22px;height:22px;border-radius:50%;background:#34D399;color:#064E3B;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:2px}
`;

const PAGES = {
  'cover-paid.png': {
    size: { width: 1280, height: 720 },
    html: `<div class="bg"></div><div class="glow"></div>
      <div style="position:absolute;left:64px;top:64px;width:560px">
        <span class="tag">n8n workflow · Starter &amp; Pro</span>
        <h1 style="font-size:60px;margin:26px 0 18px">Find clients who need what you sell.</h1>
        <p style="font-size:22px;line-height:1.45;color:#C7D2FE;margin-bottom:22px">Google Maps search → website checks → scored leads → a personalized pitch for each, saved to your Google Sheet and Gmail drafts.</p>
        <ul>
          <li><span class="dot">✓</span><span><b>Proof, not guesses:</b> PageSpeed score, SSL, mobile, booking, reviews</span></li>
          <li><span class="dot">✓</span><span><b>Pitches written by Claude</b> from verified facts only</span></li>
          <li><span class="dot">✓</span><span><b>You stay in control:</b> drafts only, nothing sent automatically</span></li>
        </ul>
      </div>
      <div class="shot" style="position:absolute;right:56px;top:96px;width:560px;transform:rotate(1.5deg)"><img src="${img('sheet-example.png')}"></div>
      <div class="shot" style="position:absolute;right:150px;top:360px;width:420px;transform:rotate(-2deg)"><img src="${img('draft-example.png')}"></div>`,
  },
  'thumb-paid.png': {
    size: { width: 600, height: 600 },
    html: `<div class="bg"></div><div class="glow" style="width:500px;height:500px;right:-160px;top:-160px"></div>
      <div style="position:absolute;left:44px;top:48px;right:44px">
        <span class="tag" style="font-size:12px">n8n workflow</span>
        <h1 style="font-size:54px;margin:22px 0 16px">Client<br>Finder<br>Agent</h1>
        <p style="font-size:21px;line-height:1.4;color:#C7D2FE">Local leads with proof of a problem you can fix, and a pitch for each.</p>
      </div>
      <div class="shot" style="position:absolute;left:44px;right:44px;bottom:-40px;height:190px"><img src="${img('sheet-example.png')}"></div>`,
  },
  'cover-lite.png': {
    size: { width: 1280, height: 720 },
    html: `<div class="bg" style="background:linear-gradient(140deg,#052E2B 0%,#065F46 55%,#10B981 100%)"></div><div class="glow" style="background:radial-gradient(circle,rgba(110,231,183,.4),transparent 70%)"></div>
      <div style="position:absolute;left:64px;top:72px;width:600px">
        <span class="tag free">Free n8n workflow</span>
        <h1 style="font-size:62px;margin:26px 0 18px">Client Finder Lite</h1>
        <p style="font-size:24px;line-height:1.45;color:#D1FAE5;margin-bottom:24px">Type a business type and a city. Get a CSV of local businesses from Google Maps, with the ones that have <b style="color:#fff">no website</b> at the top.</p>
        <ul>
          <li><span class="dot">✓</span><span>Official Google Places API, up to 60 businesses per search</span></li>
          <li><span class="dot">✓</span><span>Phone, rating, reviews and Maps link for each</span></li>
          <li><span class="dot">✓</span><span>Set up in about 10 minutes</span></li>
        </ul>
      </div>
      <div class="shot" style="position:absolute;right:64px;top:110px;width:440px;transform:rotate(1.5deg)"><img src="${img('lite-form.png')}"></div>`,
  },
  'thumb-lite.png': {
    size: { width: 600, height: 600 },
    html: `<div class="bg" style="background:linear-gradient(140deg,#052E2B 0%,#065F46 55%,#10B981 100%)"></div>
      <div style="position:absolute;left:44px;top:56px;right:44px">
        <span class="tag free" style="font-size:12px">Free</span>
        <h1 style="font-size:56px;margin:22px 0 16px">Client<br>Finder<br>Lite</h1>
        <p style="font-size:22px;line-height:1.4;color:#D1FAE5">Local businesses with no website, in a CSV. Free n8n workflow.</p>
      </div>`,
  },
};

async function main() {
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  try {
    for (const [file, { size, html }] of Object.entries(PAGES)) {
      const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
      await page.setContent(`<html><head><style>${BASE_CSS}</style></head><body style="width:${size.width}px;height:${size.height}px;position:relative">${html}</body></html>`, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, file) });
      await page.close();
      console.log(`wrote marketing/${file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
