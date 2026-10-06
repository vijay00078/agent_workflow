#!/usr/bin/env node
// Assembles the three Gumroad downloads in dist/:
//   Client-Finder-Lite.zip, Client-Finder-Starter.zip, Client-Finder-Pro.zip
// Run after `npm run build`, `python3 scripts/make-crm.py` and `npm run docs`.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const product = require('../config/product.json');

const ROOT = path.join(__dirname, '..');
const P = path.join(ROOT, 'products');
const DIST = path.join(ROOT, 'dist');

const BUNDLES = {
  'Client-Finder-Lite': ['lite/client-finder-lite.json', 'lite/QUICKSTART.pdf', ['LICENSE.txt', 'lite/LICENSE.txt']],
  'Client-Finder-Starter': [
    'starter/START-HERE.pdf',
    'starter/client-finder-web-design.json',
    'starter/SETUP-GUIDE.pdf',
    'starter/PROMPTS.pdf',
    ['shared/Client-Finder-CRM.xlsx', 'starter/Client-Finder-CRM.xlsx'],
    ['LICENSE.txt', 'starter/LICENSE.txt'],
  ],
  'Client-Finder-Pro': [
    'pro/START-HERE.pdf',
    'pro/workflows/client-finder-web-design.json',
    'pro/workflows/client-finder-seo.json',
    'pro/workflows/client-finder-reviews.json',
    'pro/workflows/client-finder-social-media.json',
    'pro/workflows/client-finder-ai-chatbot.json',
    'pro/workflows/follow-up-autopilot.json',
    'pro/SETUP-GUIDE.pdf',
    'pro/PRO-GUIDE.pdf',
    'pro/PROMPTS.pdf',
    'pro/OUTREACH-PLAYBOOK.pdf',
    'pro/TEMPLATES.pdf',
    ['shared/Client-Finder-CRM.xlsx', 'pro/Client-Finder-CRM.xlsx'],
    ['LICENSE.txt', 'pro/LICENSE.txt'],
  ],
};

function licenseText() {
  const raw = fs.readFileSync(path.join(ROOT, 'docs', 'LICENSE.txt'), 'utf8');
  return raw.replace(/\{\{(\w+)\}\}/g, (m, k) => (product[k] !== undefined ? String(product[k]) : m));
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  for (const [name, files] of Object.entries(BUNDLES)) {
    const stage = path.join(DIST, '.stage', name);
    fs.mkdirSync(stage, { recursive: true });
    for (const entry of files) {
      const [src, rel] = Array.isArray(entry) ? entry : [entry, entry];
      const inZip = rel.split('/').slice(1).join('/'); // drop the tier folder
      const dest = path.join(stage, inZip);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (src === 'LICENSE.txt') fs.writeFileSync(dest, licenseText());
      else {
        const from = path.join(P, src);
        if (!fs.existsSync(from)) throw new Error(`missing ${from}: run npm run build, scripts/make-crm.py and npm run docs first`);
        fs.copyFileSync(from, dest);
      }
    }
    const zip = path.join(DIST, `${name}-v${product.version}.zip`);
    execFileSync('zip', ['-r', '-X', '-q', zip, '.'], { cwd: stage });
    const size = (fs.statSync(zip).size / 1024).toFixed(0);
    console.log(`wrote dist/${path.basename(zip)} (${files.length} files, ${size} KB)`);
  }
  fs.rmSync(path.join(DIST, '.stage'), { recursive: true, force: true });
}

main();
