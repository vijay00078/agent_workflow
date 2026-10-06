#!/usr/bin/env node
// Renders docs/*.md into branded PDFs (and keeps the Markdown next to them where useful).
//   node scripts/render-docs.js            render every document listed in DOCS
//   node scripts/render-docs.js setup      render only documents whose file name contains "setup"
// Needs Chromium: uses $CHROMIUM_PATH, or the Playwright browser in $PLAYWRIGHT_BROWSERS_PATH.

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const product = require('../config/product.json');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(ROOT, 'products');

// source → [output paths]. Shared docs are copied into each tier that includes them.
const DOCS_MAP = [
  { src: 'lite/QUICKSTART.md', out: ['lite/QUICKSTART.pdf'] },
  { src: 'starter/START-HERE.md', out: ['starter/START-HERE.pdf'] },
  { src: 'pro/START-HERE.md', out: ['pro/START-HERE.pdf'] },
  { src: 'SETUP-GUIDE.md', out: ['starter/SETUP-GUIDE.pdf', 'pro/SETUP-GUIDE.pdf'] },
  { src: 'PROMPTS.md', out: ['starter/PROMPTS.pdf', 'pro/PROMPTS.pdf'] },
  { src: 'pro/PRO-GUIDE.md', out: ['pro/PRO-GUIDE.pdf'] },
  { src: 'pro/OUTREACH-PLAYBOOK.md', out: ['pro/OUTREACH-PLAYBOOK.pdf'] },
  { src: 'pro/TEMPLATES.md', out: ['pro/TEMPLATES.pdf'] },
];

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
      const p = path.join(base, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
  }
  return { meta, body: text.slice(m[0].length) };
}

function substitute(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

function slug(s) {
  return s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function renderMarkdown(md) {
  const toc = [];
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = marked.Parser.parseInline(tokens);
    const id = slug(text);
    if (depth === 2) toc.push({ id, text });
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  renderer.blockquote = ({ tokens }) => {
    const inner = marked.Parser.parse(tokens);
    const kind = /^<p><strong>(Tip|Note|Important|Warning|Cost|Example)[:.]?<\/strong>/i.exec(inner);
    const cls = kind ? kind[1].toLowerCase() : 'note';
    return `<div class="callout callout-${cls}">${inner}</div>\n`;
  };
  marked.setOptions({ gfm: true, breaks: false });
  const html = marked.parse(md, { renderer });
  return { html, toc };
}

const CSS = fs.readFileSync(path.join(__dirname, 'lib', 'doc.css'), 'utf8');

function page({ meta, html, toc }) {
  const tier = meta.tier || '';
  const tocHtml = meta.toc === 'false' || toc.length < 3 ? '' : `<nav class="toc"><h2>Contents</h2><ol>${toc.map((t) => `<li><a href="#${t.id}">${t.text}</a></li>`).join('')}</ol></nav>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${meta.title}</title><style>${CSS}</style></head><body>
<section class="cover">
  <div class="cover-top"><span class="brand">${product.productName}</span>${tier ? `<span class="tier tier-${slug(tier)}">${tier}</span>` : ''}</div>
  <div class="cover-main">
    <div class="kicker">${meta.kicker || ''}</div>
    <h1 class="cover-title">${meta.title}</h1>
    <p class="cover-sub">${meta.subtitle || ''}</p>
  </div>
  <div class="cover-foot">Version ${product.version} · Tested on n8n ${product.testedN8nVersions.join(' and ')}</div>
</section>
${tocHtml}
<main>${html}</main>
</body></html>`;
}

async function main() {
  const filter = process.argv[2] || '';
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const ctx = await browser.newContext();
  try {
    for (const doc of DOCS_MAP.filter((d) => d.src.toLowerCase().includes(filter.toLowerCase()))) {
      const raw = fs.readFileSync(path.join(DOCS, doc.src), 'utf8');
      const vars = Object.assign({}, product, doc.vars || {});
      const { meta, body } = frontMatter(substitute(raw, vars));
      meta.tier = substitute(meta.tier || '', vars);
      const { html, toc } = renderMarkdown(body);
      const htmlFile = path.join(ROOT, '.e2e', 'docs-html', doc.src.replace(/\.md$/, '.html'));
      fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
      fs.writeFileSync(htmlFile, page({ meta, html, toc }).replace(/src="img\//g, `src="file://${DOCS}/img/`));
      const p = await ctx.newPage();
      await p.goto(`file://${htmlFile}`, { waitUntil: 'load' });
      for (const rel of doc.out) {
        const file = path.join(OUT, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await p.pdf({
          path: file,
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate: `<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:8px;color:#9CA3AF;padding:0 0.75in;display:flex;justify-content:space-between"><span>${product.productName} · ${meta.title}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
        });
        console.log(`wrote products/${rel}`);
      }
      await p.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
