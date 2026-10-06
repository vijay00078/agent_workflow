// One item per business. Skips closed businesses, duplicates and (optionally)
// low ratings or businesses without a website, then caps the list.
const form = $('Lead Search Form').first().json;
const cfg = $('Config').first().json;
const max = Number(String(form['How many leads?'] || '20').replace(/\D/g, '')) || 20;
const minRating = Number(cfg.min_rating) || 0;
const onlyWithWebsite = cfg.only_with_website === true || cfg.only_with_website === 'true';

const seen = new Set();
const out = [];
for (const item of $input.all()) {
  for (const place of item.json.places || []) {
    if (!place.id || seen.has(place.id)) continue;
    seen.add(place.id);
    if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') continue;
    if (minRating && (Number(place.rating) || 0) < minRating) continue;
    if (onlyWithWebsite && !place.websiteUri) continue;
    out.push({ json: place });
  }
}
return out.slice(0, max);
