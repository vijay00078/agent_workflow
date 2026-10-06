// Grabs a short description of the lead's company from its website,
// so the AI can qualify better and personalise the reply.
const lead = $('Config').item.json;
const html = typeof $json.data === 'string' ? $json.data.slice(0, 800000) : '';
const title = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
const description = ((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || [])[1] || '').trim();
const text = html
  .replace(/<head[\s\S]*?<\/head>/i, ' ')
  .replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

return {
  json: {
    ...lead,
    website_summary: html ? [title, description, text.slice(0, 1200)].filter(Boolean).join(' | ') : 'Website could not be loaded',
  },
};
