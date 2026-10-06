// Renders an HTML document to PDF with Chromium.
// Pass 1 finds the page of every chapter (via hidden markers + pdftotext) so the
// table of contents can show page numbers; pass 2 renders the final PDF with
// page numbers, clickable links and bookmarks.
//
// usage: node build/lib/pdf.js input.html output.pdf
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

(async () => {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('usage: node pdf.js input.html output.pdf');
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const missing = [];
  page.on('requestfailed', (r) => missing.push(r.url()));
  await page.goto('file://' + path.resolve(input), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (missing.length) throw new Error('missing resources:\n' + missing.join('\n'));

  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src));
  if (broken.length) throw new Error('images not loaded:\n' + broken.join('\n'));

  // Pass 1: mark every chapter heading, render, and look up the pages of the markers
  await page.evaluate(() => {
    for (const h of document.querySelectorAll('main section.level1 > h1')) {
      const marker = document.createElement('span');
      marker.className = 'pdf-marker';
      marker.textContent = `ZZMARK${h.parentElement.id}ZZ`;
      h.appendChild(marker);
    }
  });
  const options = { format: 'A4', printBackground: true, preferCSSPageSize: true };
  const draft = output + '.draft.pdf';
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await page.pdf({ ...options, path: draft });
  const pages = execFileSync('pdftotext', ['-layout', draft, '-']).toString().split('\f');
  fs.unlinkSync(draft);
  const pageOf = {};
  pages.forEach((text, index) => {
    for (const m of text.matchAll(/ZZMARK([A-Za-z0-9_-]+?)ZZ/g)) if (!(m[1] in pageOf)) pageOf[m[1]] = index + 1;
  });

  // Pass 2: page numbers in the contents, markers removed, final render with bookmarks
  const unresolved = await page.evaluate((pageOf) => {
    document.querySelectorAll('.pdf-marker').forEach((m) => m.remove());
    const missingIds = [];
    for (const a of document.querySelectorAll('nav#TOC a')) {
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      if (pageOf[id]) a.setAttribute('data-page', pageOf[id]);
      else missingIds.push(id);
    }
    return missingIds;
  }, pageOf);
  if (unresolved.length) throw new Error('no page found for: ' + unresolved.join(', '));
  await page.pdf({ ...options, path: output, outline: true, tagged: true });
  await browser.close();
  console.log(`${path.basename(output)}: ${pages.filter((p) => p.trim()).length} pages`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
