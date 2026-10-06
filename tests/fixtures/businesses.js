// Fake local businesses used by unit tests and by the end-to-end mock servers.
// Each one is designed to trigger (or deliberately not trigger) specific checks.
// Domains use the reserved .test TLD; the e2e harness maps them to the local mock server.

const YEAR = 2026;

// Cloudflare email-protection encoding (the inverse of website.decodeCfEmail).
function cfEncode(email, key) {
  let out = key.toString(16).padStart(2, '0');
  for (const ch of email) out += (ch.charCodeAt(0) ^ key).toString(16).padStart(2, '0');
  return out;
}

// A short "about" paragraph like real homepages have: the checks skip pages with almost no text (JavaScript shells).
const ABOUT = '<section><p>We are a friendly, family-run local practice. Our experienced team offers check-ups, cleanings, whitening, fillings and emergency care for patients of all ages, with modern equipment and clear prices. New patients are always welcome, and we accept most insurance plans. Free parking is available behind the building.</p></section>';

function page({ title = '', description = '', h1 = '', viewport = true, body = '', head = '', footerYear = YEAR, about = ABOUT }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${title ? `<title>${title}</title>` : ''}
${description ? `<meta name="description" content="${description}">` : ''}
${viewport ? '<meta name="viewport" content="width=device-width, initial-scale=1">' : ''}
${head}
</head>
<body>
${h1 ? `<h1>${h1}</h1>` : ''}
${body}
${about}
<footer><p>${footerYear ? `&copy; ${footerYear} ${title.split('|')[0].trim()}. All rights reserved.` : ''}</p></footer>
</body>
</html>`;
}

const ANALYTICS = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-ABC123XYZ');</script>`;
const PIXEL = `<script>!function(f,b,e,v,n,t,s){}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','123456789');</script>`;
const SCHEMA = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Dentist","name":"Downtown Dentistry"}</script>`;

// psi: performance/seo/bestPractices are 0-100; https: 1/0; lcpMs; viewport 1/0; field: FAST/AVERAGE/SLOW
const BUSINESSES = [
  {
    key: 'sunrise',
    place: {
      id: 'ChIJsunrise0001',
      name: 'Sunrise Family Dental, PLLC',
      category: 'Dentist',
      address: '1200 S Congress Ave, Austin, TX 78704, USA',
      phone: '(512) 555-0101',
      website: 'https://sunrise-dental.test/?utm_source=gbp',
      rating: 4.6,
      reviews: 212,
      hours: 'weekday-9-6',
    },
    html: page({
      title: 'Sunrise Family Dental | Austin Dentist',
      description: 'Family dentistry in South Austin.',
      h1: 'Gentle dental care for the whole family',
      footerYear: 2019,
      body: `<p>Call us at (512) 555-0101 or email <a href="mailto:info@sunrise-dental.test">info@sunrise-dental.test</a>.</p>
<p>Follow us on <a href="https://www.facebook.com/sunrisefamilydental">Facebook</a>.</p>
<a href="/contact-us">Contact</a> <img src="/img/logo@2x.png">`,
    }),
    psi: { performance: 23, seo: 91, bestPractices: 78, https: 1, lcpMs: 9812, viewport: 1, field: 'SLOW' },
    aiFencedJson: true, // Claude wraps its JSON in a markdown fence
    expect: {
      webDesign: ['slow_mobile', 'outdated_site'],
      email: 'info@sunrise-dental.test',
    },
  },
  {
    key: 'lakeside',
    place: {
      id: 'ChIJlakeside0002',
      name: 'Lakeside Dental Care',
      category: 'Dentist',
      address: '400 Lakeshore Blvd, Austin, TX 78741, USA',
      phone: '(512) 555-0102',
      website: '',
      rating: 4.8,
      reviews: 340,
      hours: 'weekday-8-5-closed-weekend',
    },
    expect: { webDesign: ['no_website'], email: '' },
  },
  {
    key: 'brightsmile',
    place: {
      id: 'ChIJbright0003',
      name: 'Bright Smile Studio',
      category: 'Cosmetic dentist',
      address: '88 E 6th St, Austin, TX 78701, USA',
      phone: '(512) 555-0103',
      website: 'http://bright-smile.test',
      rating: 4.4,
      reviews: 96,
      hours: 'weekday-9-6',
    },
    html: page({
      title: 'Bright Smile Studio',
      h1: 'Bright Smile Studio',
      viewport: false,
      footerYear: 2017,
      body: `<p>Email: <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="${cfEncode('smile@bright-smile.test', 0x2f)}">[email&#160;protected]</a></p>`,
    }),
    psi: { performance: 58, seo: 72, bestPractices: 52, https: 0, lcpMs: 4100, viewport: 0, finalUrl: 'http://bright-smile.test/' },
    aiFails: true, // Claude returns errors for this lead → template pitch
    draftFails: true, // Gmail rejects this draft → row saved with a note
    expect: { webDesign: ['no_https', 'not_mobile_friendly', 'outdated_site', 'weak_seo'], email: 'smile@bright-smile.test' },
  },
  {
    key: 'downtown',
    place: {
      id: 'ChIJdowntown0004',
      name: 'Downtown Dentistry',
      category: 'Dentist',
      address: '500 Congress Ave, Austin, TX 78701, USA',
      phone: '(512) 555-0104',
      website: 'https://downtown-dentistry.test/',
      rating: 4.9,
      reviews: 520,
      hours: '24h',
    },
    html: page({
      title: 'Downtown Dentistry | Modern Dental Care in Austin',
      description: 'Same-week appointments, Saturday hours.',
      h1: 'Modern dentistry downtown',
      head: ANALYTICS + PIXEL + SCHEMA,
      body: `<a href="https://www.zocdoc.com/practice/downtown-dentistry">Book online</a>
<script src="https://embed.tawk.to/abc/default"></script>
<a href="https://instagram.com/downtowndentistry">Instagram</a> <a href="https://facebook.com/downtowndentistry">Facebook</a>
<a href="mailto:hello@downtown-dentistry.test">hello@downtown-dentistry.test</a>`,
    }),
    psi: { performance: 92, seo: 100, bestPractices: 96, https: 1, lcpMs: 1700, viewport: 1, field: 'FAST' },
    expect: { webDesign: [], email: 'hello@downtown-dentistry.test' },
  },
  {
    key: 'oakhill',
    place: {
      id: 'ChIJoakhill0005',
      name: 'Oak Hill Orthodontics',
      category: 'Orthodontist',
      address: '7000 US-290, Austin, TX 78735, USA',
      phone: '(512) 555-0105',
      website: 'https://oakhill-ortho.test/',
      rating: 4.7,
      reviews: 150,
      hours: 'weekday-9-6',
    },
    status: 404,
    psi: { runtimeError: 'ERRORED_DOCUMENT_REQUEST' },
    expect: { webDesign: ['site_down'], email: '' },
  },
  {
    key: 'maple',
    place: {
      id: 'ChIJmaple0006',
      name: 'Maple Dental Group',
      category: 'Dentist',
      address: '9500 Research Blvd, Austin, TX 78759, USA',
      phone: '(512) 555-0106',
      website: 'https://maple-dental-expired.test/',
      rating: 4.5,
      reviews: 77,
      hours: 'weekday-9-6',
    },
    unresolvable: true,
    psi: { runtimeError: 'FAILED_DOCUMENT_REQUEST' },
    expect: { webDesign: ['site_down'], email: '' },
  },
  {
    key: 'pearl',
    place: {
      id: 'ChIJpearl0007',
      name: 'Pearl Dental Spa',
      category: 'Dentist',
      address: '3800 N Lamar Blvd, Austin, TX 78756, USA',
      phone: '(512) 555-0107',
      website: 'https://pearl-dental.test/',
      rating: 4.3,
      reviews: 64,
      hours: 'weekday-9-6',
    },
    badCert: true,
    // Chrome (PageSpeed) refuses the certificate too, which is what makes the claim safe.
    psi: { runtimeError: 'INSECURE_DOCUMENT_REQUEST', runtimeMessage: 'The URL you have provided does not have a valid security certificate. net::ERR_CERT_AUTHORITY_INVALID' },
    expect: { webDesign: ['ssl_error'], email: '' },
  },
  {
    key: 'cedar',
    place: {
      id: 'ChIJcedar0008',
      name: 'Cedar Park Smiles',
      category: 'Dentist',
      address: '1400 Cypress Creek Rd, Cedar Park, TX 78613, USA',
      phone: '(512) 555-0108',
      website: 'https://cedarpark-smiles.test/',
      rating: 4.2,
      reviews: 41,
      hours: 'weekday-9-6',
    },
    html: '<html><head><title>Coming Soon</title></head><body><h1>Coming soon!</h1><p>Our new website is under construction.</p></body></html>',
    aiTransientFail: true, // Claude is overloaded on the first attempt only → the retry branch succeeds
    psi: { performance: 99, seo: 60, bestPractices: 90, https: 1, lcpMs: 800, viewport: 0 },
    expect: { webDesign: ['placeholder_site'], email: '' },
  },
  {
    key: 'riverside',
    place: {
      id: 'ChIJriverside0009',
      name: 'Riverside Dental',
      category: 'Dentist',
      address: '2200 S Pleasant Valley Rd, Austin, TX 78741, USA',
      phone: '(512) 555-0109',
      website: 'https://riverside-dental.test/',
      rating: 4.6,
      reviews: 180,
      hours: 'weekday-9-6',
    },
    status: 403,
    psi: { performance: 61, seo: 92, bestPractices: 80, https: 1, lcpMs: 3500, viewport: 1 },
    expect: { webDesign: [], email: '' },
  },
  {
    key: 'hillcrest',
    place: {
      id: 'ChIJhillcrest0010',
      name: 'Hillcrest Family Dentistry',
      category: 'Dentist',
      address: '5500 Burnet Rd, Austin, TX 78756, USA',
      phone: '(512) 555-0110',
      website: 'https://hillcrest-dentistry.test/',
      rating: 3.6,
      reviews: 48,
      hours: 'weekday-9-6',
    },
    html: page({
      title: 'Hillcrest Family Dentistry',
      description: 'Dentist on Burnet Road.',
      h1: 'Hillcrest Family Dentistry',
      head: ANALYTICS,
      body: `<a href="https://instagram.com/hillcrestdental">IG</a><p>Write to us: frontdesk&#64;hillcrest-dentistry&#46;test</p>`,
    }),
    psi: { performance: 77, seo: 90, bestPractices: 85, https: 1, lcpMs: 2600, viewport: 1 },
    expect: { webDesign: [], reviews: ['low_rating'], email: 'frontdesk@hillcrest-dentistry.test' },
  },
  {
    key: 'elm',
    place: {
      id: 'ChIJelm0011',
      name: 'Elm Street Dental',
      category: 'Dentist',
      address: '1500 Elm St, Austin, TX 78702, USA',
      phone: '(512) 555-0111',
      website: 'https://elm-dental.test/',
      rating: 5.0,
      reviews: 8,
      hours: 'weekday-9-6',
    },
    html: page({
      title: '',
      h1: '',
      body: `<div>Elm Street Dental</div><a href="mailto:contact@elm-dental.test?subject=Hi">Email us</a> <a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>`,
    }),
    psi: { performance: 64, seo: 62, bestPractices: 88, https: 1, lcpMs: 3900, viewport: 1 },
    expect: { webDesign: ['weak_seo'], reviews: ['few_reviews'], email: 'contact@elm-dental.test' },
  },
  {
    key: 'northside',
    place: {
      id: 'ChIJnorthside0012',
      name: 'Northside Dental',
      category: 'Dentist',
      address: '12000 N Lamar Blvd, Austin, TX 78753, USA',
      phone: '(512) 555-0112',
      website: 'https://northside-dental.test/',
      rating: 4.1,
      reviews: 30,
      hours: 'weekday-9-6',
      businessStatus: 'CLOSED_PERMANENTLY',
    },
    expect: { skipped: true },
  },
  {
    key: 'westlake',
    place: {
      id: 'ChIJwestlake0013',
      name: 'Westlake Dental Studio',
      category: 'Dentist',
      address: '3600 Bee Caves Rd, Austin, TX 78746, USA',
      phone: '(512) 555-0113',
      website: 'https://westlake-dental.test/',
      rating: 4.7,
      reviews: 133,
      hours: 'weekday-8-5-closed-weekend',
    },
    html: page({
      title: 'Westlake Dental Studio | Dentist in Westlake',
      description: 'Cosmetic and family dentistry.',
      h1: 'Westlake Dental Studio',
      head: SCHEMA.replace('Downtown Dentistry', 'Westlake Dental Studio'),
      body: `<p>Call (512) 555-0113 to schedule.</p><a href="https://www.instagram.com/westlakedental/">Instagram</a><p>office@westlake-dental.test</p>`,
    }),
    psi: { performance: 71, seo: 100, bestPractices: 92, https: 1, lcpMs: 2900, viewport: 1 },
    expect: { webDesign: [], aiChatbot: ['no_booking', 'no_chat', 'limited_hours'], email: 'office@westlake-dental.test' },
  },
  {
    key: 'gentle',
    place: {
      id: 'ChIJgentle0014',
      name: 'Gentle Care Dental',
      category: 'Dentist',
      address: '2900 W Anderson Ln, Austin, TX 78757, USA',
      phone: '(512) 555-0114',
      website: 'https://gentlecare-dental.test/',
      rating: 4.8,
      reviews: 260,
      hours: 'weekday-9-6',
    },
    html: page({
      title: 'Gentle Care Dental',
      description: 'Anxiety-free dentistry.',
      h1: 'Gentle Care Dental',
      head: ANALYTICS + PIXEL,
      body: `<a href="https://www.fresha.com/a/gentle-care">Book now</a> <a href="https://wa.me/15125550114">WhatsApp us</a>
<a href="https://www.tiktok.com/@gentlecaredental">TikTok</a> <a href="mailto:care@gentlecare-dental.test">care@gentlecare-dental.test</a>`,
    }),
    psi: { error: 500 },
    expect: { webDesign: [], aiChatbot: [], email: 'care@gentlecare-dental.test' },
  },
];

// A duplicate of the first business that Google returns again on page 2.
const DUPLICATE_PLACE_ID = 'ChIJsunrise0001';

function hoursFor(kind) {
  if (kind === '24h') return { periods: [{ open: { day: 0, hour: 0, minute: 0 } }], weekdayDescriptions: ['Monday: Open 24 hours'] };
  const periods = [];
  const add = (day, open, close) => periods.push({ open: { day, hour: open, minute: 0 }, close: { day, hour: close, minute: 0 } });
  if (kind === 'weekday-8-5-closed-weekend') {
    for (let d = 1; d <= 5; d++) add(d, 8, 17);
  } else {
    for (let d = 1; d <= 5; d++) add(d, 9, 18);
    add(6, 9, 13);
  }
  return { periods, weekdayDescriptions: [] };
}

function toPlace(b) {
  const p = b.place;
  const out = {
    id: p.id,
    displayName: { text: p.name, languageCode: 'en' },
    formattedAddress: p.address,
    nationalPhoneNumber: p.phone,
    internationalPhoneNumber: '+1 ' + p.phone.replace(/[()]/g, '').replace(' ', '-'),
    googleMapsUri: `https://maps.google.com/?cid=${p.id}`,
    rating: p.rating,
    userRatingCount: p.reviews,
    businessStatus: p.businessStatus || 'OPERATIONAL',
    primaryTypeDisplayName: { text: p.category, languageCode: 'en' },
    regularOpeningHours: hoursFor(p.hours),
  };
  if (p.website) out.websiteUri = p.website;
  return out;
}

// Google returns at most 20 per page; we split our 14 into two pages and repeat one result.
function placesPages() {
  const places = BUSINESSES.map(toPlace);
  const page1 = { places: places.slice(0, 8), nextPageToken: 'PAGE2TOKEN' };
  const page2 = { places: [...places.slice(8), places.find((p) => p.id === DUPLICATE_PLACE_ID)] };
  return [page1, page2];
}

function psiResponse(b) {
  const url = b.place.website;
  const p = b.psi || {};
  if (p.runtimeError) {
    return { id: url, lighthouseResult: { requestedUrl: url, finalUrl: url, runtimeError: { code: p.runtimeError, message: p.runtimeMessage || 'Lighthouse was unable to reliably load the page you requested.' }, categories: {}, audits: {} } };
  }
  const audits = {
    'largest-contentful-paint': { id: 'largest-contentful-paint', score: p.performance / 100, numericValue: p.lcpMs, displayValue: `${(p.lcpMs / 1000).toFixed(1)} s` },
    'first-contentful-paint': { id: 'first-contentful-paint', score: 0.5, numericValue: Math.round(p.lcpMs * 0.6), displayValue: `${((p.lcpMs * 0.6) / 1000).toFixed(1)} s` },
    'is-on-https': { id: 'is-on-https', score: p.https },
    viewport: { id: 'viewport', score: p.viewport },
    'meta-description': { id: 'meta-description', score: p.seo >= 90 ? 1 : 0 },
    'document-title': { id: 'document-title', score: 1 },
  };
  const finalUrl = p.finalUrl || url.split('?')[0];
  return {
    id: url,
    loadingExperience: p.field ? { overall_category: p.field } : {},
    lighthouseResult: {
      requestedUrl: url,
      finalUrl,
      finalDisplayedUrl: finalUrl,
      lighthouseVersion: '12.8.0',
      categories: {
        performance: { id: 'performance', score: p.performance / 100 },
        seo: { id: 'seo', score: p.seo / 100 },
        'best-practices': { id: 'best-practices', score: p.bestPractices / 100 },
      },
      audits,
    },
  };
}

function byKey(key) {
  return BUSINESSES.find((b) => b.key === key);
}

module.exports = { cfEncode, ABOUT, YEAR, BUSINESSES, DUPLICATE_PLACE_ID, toPlace, placesPages, psiResponse, hoursFor, byKey, page };
