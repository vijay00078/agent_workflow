#!/usr/bin/env node
// Generates every n8n workflow file in products/ from src/.
//   node scripts/build.js          write the files
//   node scripts/build.js --check  fail if any generated file is missing or out of date

const fs = require('fs');
const path = require('path');
const packs = require('../src/niches');
const { buildClientFinder } = require('../src/workflows/client-finder');
const { buildLite } = require('../src/workflows/lite');
const { buildFollowUp } = require('../src/workflows/follow-up');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'products');

function outputs() {
  const files = {};
  const put = (rel, obj) => {
    files[rel] = JSON.stringify(obj, null, 2) + '\n';
  };
  put('lite/client-finder-lite.json', buildLite());
  const webDesign = packs.find((p) => p.id === 'web-design');
  put(`starter/client-finder-${webDesign.id}.json`, buildClientFinder(webDesign));
  for (const pack of packs) put(`pro/workflows/client-finder-${pack.id}.json`, buildClientFinder(pack));
  put('pro/workflows/follow-up-autopilot.json', buildFollowUp(packs));
  return files;
}

function main() {
  const check = process.argv.includes('--check');
  const files = outputs();
  const stale = [];
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(OUT, rel);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (current === content) continue;
    if (check) stale.push(rel);
    else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      console.log(`wrote products/${rel}`);
    }
  }
  if (check) {
    if (stale.length) {
      console.error(`Out of date (run "npm run build"): ${stale.join(', ')}`);
      process.exit(1);
    }
    console.log(`build check ok: ${Object.keys(files).length} workflow files are up to date`);
  }
}

if (require.main === module) main();
module.exports = { outputs };
