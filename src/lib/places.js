// Google Places API (New) helpers: build the Text Search request and turn raw pages into clean leads.

// @node-only-start
const { str, num, int, clamp, round, median, normalizeUrl, hostOf } = require('./util');
// @node-only-end

const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.primaryTypeDisplayName',
  'places.regularOpeningHours',
  'nextPageToken',
].join(',');

const FORM_FIELDS = {
  businessType: 'Business type',
  location: 'City or area',
  maxLeads: 'How many businesses?',
};

const MAX_LEADS_LIMIT = 60; // Google returns at most 60 results (3 pages of 20) per search.

function firstValue(...values) {
  for (const v of values) {
    const s = str(v);
    if (s) return s;
  }
  return '';
}

// input = form submission (labels as keys) merged with the Settings node values.
function buildSearch(input) {
  const businessType = firstValue(input[FORM_FIELDS.businessType], input.businessType);
  const location = firstValue(input[FORM_FIELDS.location], input.location);
  if (!businessType || !location) {
    throw new Error('Please fill in both "Business type" and "City or area" (for example: "dentists" and "Austin, TX").');
  }
  const requested = int(firstValue(input[FORM_FIELDS.maxLeads], input.maxLeads), 0);
  const maxLeads = clamp(requested > 0 ? requested : 40, 1, MAX_LEADS_LIMIT);
  const textQuery = `${businessType} in ${location}`;
  // Service-area businesses (plumbers, cleaners, mobile trades) have no storefront address; Google leaves them out unless asked.
  const body = { textQuery, pageSize: Math.min(20, maxLeads), includePureServiceAreaBusinesses: true };
  const languageCode = str(input.searchLanguage).toLowerCase();
  if (/^[a-z]{2}(-[a-z]{2})?$/.test(languageCode)) body.languageCode = languageCode;
  const regionCode = str(input.searchCountryCode).toUpperCase();
  if (/^[A-Z]{2}$/.test(regionCode)) body.regionCode = regionCode;
  return {
    businessType,
    location,
    textQuery,
    maxLeads,
    maxPages: Math.ceil(maxLeads / 20),
    requestBody: body,
  };
}

// HTTP status from a Google error body ({code: 403}) or an n8n error item ({status: 403, statusCode: 403, httpCode: '403'}).
function httpStatusOf(err) {
  const e = err || {};
  for (const v of [e.httpCode, e.statusCode, e.status, e.code, e.response && e.response.status]) {
    const n = int(v, 0);
    if (n >= 100 && n < 600 && /^\d+$/.test(String(v).trim())) return n;
  }
  const m = str(e.message).match(/^(\d{3})\b/);
  return m ? Number(m[1]) : 0;
}

// Collects every string inside an error payload. n8n stores API errors in different shapes
// ({message: '403 - "{...}"'}, {error: '{"error":{...}}', statusCode}, {description}), so checks run on all of it.
function errorText(err) {
  const parts = [];
  const walk = (v, depth) => {
    if (v === null || v === undefined || depth > 4) return;
    if (typeof v === 'string') {
      parts.push(v.replace(/\\"/g, '"'));
      return;
    }
    if (typeof v !== 'object') return;
    for (const k of ['message', 'description', 'error', 'status', 'statusText', 'body', 'details']) if (k in v) walk(v[k], depth + 1);
  };
  walk(err, 0);
  return parts.join(' | ');
}

// The most useful single message inside an error payload (the API's own message when present).
function errorSummary(err) {
  const text = errorText(err);
  const m = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) return m[1];
  const e = err || {};
  return str(typeof e === 'string' ? e : e.message || e.description || text).slice(0, 300);
}

// Turns a Google / n8n error payload into a message a non-developer can act on.
function explainGoogleError(page, apiName) {
  const err = page && page.error;
  if (!err) return '';
  const message = errorSummary(err);
  const code = httpStatusOf(err);
  const text = `${errorText(err)} ${code}`;
  const api = apiName || 'Google';
  if (/API key not valid|API_KEY_INVALID|invalid api key/i.test(text)) {
    return `${api}: your Google API key was rejected. Open the "Google API Key" credential in n8n and paste the key again (Header Name must be X-Goog-Api-Key).`;
  }
  if (/has not been used|is disabled|SERVICE_DISABLED|not been enabled|API not enabled/i.test(text)) {
    return `${api}: this API is not enabled in your Google Cloud project yet. Follow the "Google Cloud" step of the setup guide to enable it, wait 2 minutes, then run again.`;
  }
  if (/billing/i.test(text)) {
    return `${api}: Google requires a billing account on your Cloud project (the free monthly allowance still applies). See the "Google Cloud" step of the setup guide.`;
  }
  if (/API_KEY_SERVICE_BLOCKED|Requests to this API .{0,200} are blocked|API_KEY_API_BLOCKED/i.test(text)) {
    return `${api}: your API key is restricted to other APIs. In Google Cloud > Credentials, open the key and under "API restrictions" tick both "Places API (New)" and "PageSpeed Insights API", then save.`;
  }
  if (/referer|referrer|API_KEY_HTTP_REFERRER_BLOCKED|IP address|API_KEY_IP_ADDRESS_BLOCKED|API_KEY_ANDROID_APP_BLOCKED|API_KEY_IOS_APP_BLOCKED|blocked/i.test(text)) {
    return `${api}: your API key has an application restriction (websites, IP addresses or apps) that blocks n8n. In Google Cloud > Credentials, set "Application restrictions" to None and restrict the key by API instead.`;
  }
  if (code === 429 || /quota|RESOURCE_EXHAUSTED|rate/i.test(text)) {
    return `${api}: Google says you hit a quota or rate limit. Wait a few minutes or raise the quota in Google Cloud.`;
  }
  if (code === 401 || code === 403 || /PERMISSION_DENIED|unauthori[sz]ed|forbidden/i.test(text)) {
    return `${api}: permission denied (${message || 'no details'}). Check that the API key is correct and the API is enabled.`;
  }
  return `${api} returned an error: ${message || JSON.stringify(err).slice(0, 300)}`;
}

// Google listings often link to a social profile, a booking or delivery page or a directory listing instead of a
// real website. Those businesses have no website of their own: we must not judge facebook.com's HTML as theirs.
// (Hosted site builders such as square.site, wixsite.com or sites.google.com ARE their own website.)
const PLATFORM_HOSTS = [
  ['Facebook page', /(^|\.)(facebook\.com|fb\.com|fb\.me|m\.me)$/],
  ['Instagram profile', /(^|\.)(instagram\.com|instagr\.am)$/],
  ['TikTok profile', /(^|\.)tiktok\.com$/],
  ['X/Twitter profile', /(^|\.)(twitter\.com|x\.com)$/],
  ['YouTube channel', /(^|\.)(youtube\.com|youtu\.be)$/],
  ['LinkedIn page', /(^|\.)linkedin\.com$/],
  ['link-in-bio page', /(^|\.)(linktr\.ee|linkin\.bio|beacons\.ai|lnk\.bio|taplink\.cc|bio\.link|msha\.ke|solo\.to|campsite\.bio|allmylinks\.com|linkpop\.com)$/],
  ['WhatsApp link', /(^|\.)(wa\.me|wa\.link|whatsapp\.com)$/],
  ['Google Maps link', /(^|\.)(g\.page|goo\.gl|maps\.app\.goo\.gl|business\.site)$/],
  ['Yelp page', /(^|\.)yelp\.[a-z.]{2,6}$/],
  ['Tripadvisor page', /(^|\.)tripadvisor\.[a-z.]{2,6}$/],
  [
    'directory listing',
    /(^|\.)(justdial\.com|sulekha\.com|indiamart\.com|yell\.com|yellowpages\.[a-z.]{2,6}|checkatrade\.com|trustatrade\.com|bark\.com|thumbtack\.com|houzz\.[a-z.]{2,6}|angi\.com|homeadvisor\.com|nextdoor\.com|healthgrades\.com|jameda\.de|lybrate\.com|urbancompany\.com|booking\.com|airbnb\.[a-z.]{2,6}|bbb\.org|manta\.com|mapquest\.com)$/,
  ],
  [
    'booking page',
    /(^|\.)(calendly\.com|booksy\.com|fresha\.com|vagaro\.com|setmore\.com|squareup\.com|zocdoc\.com|practo\.com|opentable\.[a-z.]{2,6}|resy\.com|treatwell\.[a-z.]{2,6}|mindbodyonline\.com|schedulicity\.com|acuityscheduling\.com|styleseat\.com|glossgenius\.com|joinblvd\.com|phorest\.com|gettimely\.com|zenoti\.com|planity\.com|doctolib\.[a-z.]{2,6}|exploretock\.com|sevenrooms\.com|thefork\.[a-z.]{2,6}|quandoo\.[a-z.]{2,6}|simplybook\.(me|it)|janeapp\.com|cliniko\.com|setmore\.com|booker\.com|mindbody\.io)$/,
  ],
  ['ordering or delivery page', /(^|\.)(clover\.com|toasttab\.com|order\.online|doordash\.com|ubereats\.com|grubhub\.com|chownow\.com|zomato\.com|swiggy\.com|deliveroo\.[a-z.]{2,6}|just-eat\.[a-z.]{2,6}|menufy\.com|slicelife\.com)$/],
];

function websitePlatform(url) {
  const host = hostOf(url);
  if (!host) return '';
  for (const [name, re] of PLATFORM_HOSTS) if (re.test(host)) return name;
  return '';
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Summarises Google's regularOpeningHours into the facts the "limited hours" check needs.
function summarizeHours(hours) {
  if (!hours || !Array.isArray(hours.periods) || !hours.periods.length) return { known: false };
  const periods = hours.periods.filter((p) => p && p.open && Number.isInteger(p.open.day));
  if (!periods.length) return { known: false };
  const first = periods[0];
  if (periods.length === 1 && !first.close && int(first.open.hour, 0) === 0 && int(first.open.minute, 0) === 0) {
    return { known: true, open24h: true, closedDays: [], earlyCloseWeekdays: 0, latestClose: {} };
  }
  const latestClose = {};
  for (const p of periods) {
    const day = p.open.day;
    let closeHour = 24;
    if (p.close && Number.isInteger(p.close.day)) {
      closeHour = int(p.close.hour, 0) + int(p.close.minute, 0) / 60;
      if (p.close.day !== day) closeHour += 24; // closes after midnight
    }
    latestClose[day] = Math.max(latestClose[day] || 0, closeHour);
  }
  const closedDays = [];
  for (let d = 0; d < 7; d++) if (latestClose[d] === undefined) closedDays.push(DAY_NAMES[d]);
  let earlyCloseWeekdays = 0;
  for (let d = 1; d <= 5; d++) if (latestClose[d] !== undefined && latestClose[d] < 18) earlyCloseWeekdays++;
  return {
    known: true,
    open24h: false,
    closedDays,
    earlyCloseWeekdays,
    latestClose,
    weekdayText: Array.isArray(hours.weekdayDescriptions) ? hours.weekdayDescriptions.map(str) : [],
  };
}

// pages = every response body returned by the paginated Text Search request.
function normalizePlaces(pages, options) {
  const opts = options || {};
  const maxLeads = clamp(int(opts.maxLeads, 40) || 40, 1, MAX_LEADS_LIMIT);
  const list = Array.isArray(pages) ? pages : [];
  const errors = list.filter((p) => p && p.error).map((p) => explainGoogleError(p, 'Google Places API'));
  const leads = [];
  const seen = new Set();
  let skippedClosed = 0;
  let duplicates = 0;
  for (const page of list) {
    if (!page || !Array.isArray(page.places)) continue;
    for (const p of page.places) {
      if (leads.length >= maxLeads) break;
      const placeId = str(p && p.id);
      if (!placeId) continue;
      if (seen.has(placeId)) {
        duplicates++;
        continue;
      }
      seen.add(placeId);
      const status = str(p.businessStatus);
      if (status && status !== 'OPERATIONAL') {
        skippedClosed++;
        continue;
      }
      leads.push({
        placeId,
        name: str(p.displayName && p.displayName.text) || '(name not listed)',
        category: str(p.primaryTypeDisplayName && p.primaryTypeDisplayName.text),
        address: str(p.formattedAddress),
        phone: str(p.nationalPhoneNumber || p.internationalPhoneNumber),
        internationalPhone: str(p.internationalPhoneNumber),
        website: normalizeUrl(p.websiteUri),
        websitePlatform: websitePlatform(normalizeUrl(p.websiteUri)),
        mapsUrl: str(p.googleMapsUri),
        rating: num(p.rating),
        reviewCount: int(p.userRatingCount, 0),
        hours: summarizeHours(p.regularOpeningHours),
      });
    }
  }
  if (!leads.length && errors.length) throw new Error(errors[0]);
  return { leads, skippedClosed, duplicates, errors };
}

function marketStats(leads) {
  const rated = leads.filter((l) => l.rating !== null && l.reviewCount >= 5);
  const reviewCounts = leads.map((l) => l.reviewCount).filter((n) => Number.isFinite(n));
  const top = [...reviewCounts].sort((a, b) => b - a).slice(0, 3);
  const med = median(reviewCounts);
  const medRating = median(rated.map((l) => l.rating));
  return {
    count: leads.length,
    medianReviews: med === null ? null : Math.round(med),
    medianRating: medRating === null ? null : round(medRating, 1),
    topReviewsAvg: top.length ? Math.round(top.reduce((a, b) => a + b, 0) / top.length) : null,
  };
}

// @export
module.exports = {
  PLACES_FIELD_MASK,
  FORM_FIELDS,
  MAX_LEADS_LIMIT,
  DAY_NAMES,
  buildSearch,
  httpStatusOf,
  errorText,
  errorSummary,
  explainGoogleError,
  PLATFORM_HOSTS,
  websitePlatform,
  summarizeHours,
  normalizePlaces,
  marketStats,
};
