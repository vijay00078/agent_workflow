// Builds a clean HTML email with every post in its own copy-ready box.
const pack = $json.output || {};
const article = $('Extract Article').item.json;
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const box = (emoji, title, content) => content ? `
  <tr><td style="padding:18px 0 6px;font:bold 16px Arial,sans-serif;color:#111">${emoji} ${title}</td></tr>
  <tr><td style="background:#f8f7ff;border:1px solid #e9e5ff;border-radius:10px;padding:14px 16px;font:14px/1.55 Arial,sans-serif;color:#222;white-space:pre-wrap">${esc(content)}</td></tr>` : '';

const thread = (pack.x_thread || []).map((t, i, all) => `${i + 1}/${all.length} ${t}`).join('\n\n');
const slides = (pack.carousel_slides || []).map((s, i) => `Slide ${i + 1}: ${s}`).join('\n');

const html = `<!doctype html><html><body style="margin:0;background:#f4f4f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:14px;padding:24px">
  <tr><td style="font:bold 22px Arial,sans-serif;color:#111">📦 Your content pack is ready</td></tr>
  <tr><td style="padding-top:6px;font:14px Arial,sans-serif;color:#555">From: <a href="${esc(article.url)}" style="color:#6d28d9">${esc(article.title)}</a> · ${article.word_count} words → 9 ready-to-post pieces</td></tr>
  ${box('💼', 'LinkedIn post', pack.linkedin_post)}
  ${box('🐦', 'X / Twitter thread', thread)}
  ${box('📸', 'Instagram caption', [pack.instagram_caption, pack.instagram_hashtags].filter(Boolean).join('\n\n'))}
  ${box('🖼️', 'Carousel slides', slides)}
  ${box('👍', 'Facebook post', pack.facebook_post)}
  ${box('✉️', 'Newsletter blurb', pack.newsletter_blurb)}
  ${box('🎬', 'Short video script', pack.short_video_script)}
  ${box('💬', 'Quote cards', (pack.key_quotes || []).map((q) => `“${q}”`).join('\n'))}
  ${box('🎨', 'Image prompt (Midjourney / DALL·E / Ideogram)', pack.image_prompt)}
  <tr><td style="padding-top:20px;font:12px Arial,sans-serif;color:#888">Everything is also saved as drafts in your Content Calendar sheet.</td></tr>
</table></td></tr></table></body></html>`;

return { json: { subject: `📦 Content pack ready: ${article.title}`.slice(0, 150), html } };
