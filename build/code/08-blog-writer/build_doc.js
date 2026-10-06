// Cleans the article HTML and packs it (with an SEO brief on top) into a
// Google Drive upload that converts it into a nicely formatted Google Doc.
const cfg = $('Config').first().json;
const row = $('Get Ready Topics').item.json;
const brief = $('AI: SEO Brief').item.json.output || {};
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let article = String($json.text || '').trim();
article = article.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');
article = article.replace(/<!doctype[^>]*>/gi, '').replace(/<\/?(html|head|body)[^>]*>/gi, '').replace(/<title>[\s\S]*?<\/title>/gi, '');
article = article.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '').trim();
const words = article.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

const title = String(brief.title || row.Topic || 'Untitled article').trim();
const slug = String(brief.slug || title).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 80);
const keywords = Array.isArray(brief.secondary_keywords) ? brief.secondary_keywords.join(', ') : '';

const docHtml = `<html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>
<h1>${esc(title)}</h1>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:10pt;background:#f6f5ff">
<tr><td><b>SEO title</b></td><td>${esc(title)}</td></tr>
<tr><td><b>Meta description</b></td><td>${esc(brief.meta_description)}</td></tr>
<tr><td><b>URL slug</b></td><td>/${esc(slug)}</td></tr>
<tr><td><b>Primary keyword</b></td><td>${esc(brief.primary_keyword || row['Primary Keyword'])}</td></tr>
<tr><td><b>Secondary keywords</b></td><td>${esc(keywords)}</td></tr>
<tr><td><b>Search intent</b></td><td>${esc(brief.search_intent)}</td></tr>
<tr><td><b>Words</b></td><td>${words}</td></tr>
</table>
<p><i>✂️ Delete the SEO brief above before publishing.</i></p>
<hr>
${article}
</body></html>`;

// Folder: accept a folder URL or a plain ID
const folderRaw = String(cfg.google_drive_folder_id || '').trim();
const folderId = (folderRaw.match(/folders\/([A-Za-z0-9_-]+)/) || [])[1] || folderRaw;
const metadata = { name: title, mimeType: 'application/vnd.google-apps.document' };
if (folderId) metadata.parents = [folderId];

const boundary = 'n8n-blog-' + Math.random().toString(36).slice(2);
const multipart = [
  `--${boundary}`,
  'Content-Type: application/json; charset=UTF-8',
  '',
  JSON.stringify(metadata),
  `--${boundary}`,
  'Content-Type: text/html; charset=UTF-8',
  '',
  docHtml,
  `--${boundary}--`,
  '',
].join('\r\n');

return {
  json: {
    row_number: row.row_number,
    title,
    slug,
    meta_description: brief.meta_description || '',
    words,
    article_html: article,
    boundary,
    multipart,
  },
};
