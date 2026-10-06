// One Content Calendar row per platform, ready to schedule.
const out = [];
const articles = $('Extract Article').all();
for (const [index, item] of $input.all().entries()) {
  const pack = item.json.output || {};
  const article = (articles[index] || articles[0]).json;
  const created = $now.toFormat('yyyy-MM-dd HH:mm');
  const thread = (pack.x_thread || []).map((t, i, all) => `${i + 1}/${all.length} ${t}`).join('\n\n');
  const slides = (pack.carousel_slides || []).map((s, i) => `Slide ${i + 1}: ${s}`).join('\n');
  const rows = [
    ['LinkedIn post', pack.linkedin_post],
    ['X / Twitter thread', thread],
    ['Instagram caption', [pack.instagram_caption, pack.instagram_hashtags].filter(Boolean).join('\n\n')],
    ['Carousel (Instagram / LinkedIn)', slides],
    ['Facebook post', pack.facebook_post],
    ['Newsletter blurb', pack.newsletter_blurb],
    ['Short video script (Reels / TikTok / Shorts)', pack.short_video_script],
    ['Quote cards', (pack.key_quotes || []).map((q) => `“${q}”`).join('\n')],
    ['Image prompt', pack.image_prompt],
  ];
  for (const [platform, content] of rows) {
    if (!content) continue;
    out.push({
      json: {
        Created: created,
        'Source title': article.title,
        'Source URL': article.url,
        Platform: platform,
        Content: content,
        Status: 'Draft',
        'Scheduled for': '',
      },
    });
  }
}
return out;
