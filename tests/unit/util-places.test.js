const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../../src/lib/util');
const places = require('../../src/lib/places');
const fx = require('../fixtures/businesses');

test('normalizeUrl accepts real sites and rejects junk', () => {
  assert.equal(u.normalizeUrl('example.com'), 'http://example.com/');
  assert.equal(u.normalizeUrl('https://www.example.com/path?x=1'), 'https://www.example.com/path?x=1');
  assert.equal(u.normalizeUrl('//cdn.example.com/a'), 'http://cdn.example.com/a');
  assert.equal(u.normalizeUrl('  '), '');
  assert.equal(u.normalizeUrl(null), '');
  assert.equal(u.normalizeUrl('mailto:a@b.com'), '');
  assert.equal(u.normalizeUrl('localhost'), '');
  assert.equal(u.normalizeUrl('ftp://example.com'), '');
  assert.equal(u.normalizeUrl('HTTPS://Example.COM'), 'https://example.com/');
  assert.equal(u.normalizeUrl('http://example.com:8080/a b'), 'http://example.com:8080/a%20b');
  assert.equal(u.normalizeUrl('https://münchen-zahnarzt.de/'), 'https://münchen-zahnarzt.de/');
  assert.equal(u.normalizeUrl('https://example..com'), '');
  assert.equal(u.normalizeUrl('https://user:pw@example.com/x#top'), 'https://example.com/x');
});

test('resolveUrl handles every kind of link', () => {
  const page = 'https://www.clinic.test/about/team.html?x=1';
  assert.equal(u.resolveUrl('/contact', page), 'https://www.clinic.test/contact');
  assert.equal(u.resolveUrl('contact.html', page), 'https://www.clinic.test/about/contact.html');
  assert.equal(u.resolveUrl('../contact/?ref=nav#form', page), 'https://www.clinic.test/contact/?ref=nav');
  assert.equal(u.resolveUrl('//cdn.clinic.test/x', page), 'https://cdn.clinic.test/x');
  assert.equal(u.resolveUrl('https://other.test/c', page), 'https://other.test/c');
  assert.equal(u.resolveUrl('mailto:a@b.test', page), '');
  assert.equal(u.resolveUrl('#top', page), '');
  assert.equal(u.resolveUrl('/x', 'not a url'), '');
});

test('parseDate understands sheet formats', () => {
  assert.equal(u.parseDate('2026-10-06').toISOString(), '2026-10-06T00:00:00.000Z');
  assert.equal(u.parseDate('10/6/2026').toISOString(), '2026-10-06T00:00:00.000Z');
  assert.equal(u.parseDate(46301).toISOString().slice(0, 10), '2026-10-06'); // Google Sheets serial number
  assert.equal(u.parseDate('46301').toISOString().slice(0, 10), '2026-10-06');
  assert.equal(u.parseDate(''), null);
  assert.equal(u.parseDate('not a date'), null);
  assert.equal(u.parseDate(1791292639903).getUTCFullYear(), 2026);
});

test('helpers', () => {
  assert.equal(u.median([3, 1, 2]), 2);
  assert.equal(u.median([4, 1, 3, 2]), 2.5);
  assert.equal(u.median([]), null);
  assert.equal(u.truthy('TRUE'), true);
  assert.equal(u.truthy('no'), false);
  assert.equal(u.truthy(true), true);
  assert.equal(u.int('12.9'), 12);
  assert.equal(u.int('x', 7), 7);
  assert.equal(u.num(true), null);
  assert.equal(u.plural(1, 'review'), '1 review');
  assert.equal(u.plural(3, 'business', 'businesses'), '3 businesses');
  assert.equal(u.truncate('abcdef', 4), 'abc…');
  assert.equal(u.hostOf('https://www.Sunrise-Dental.test/x'), 'sunrise-dental.test');
  assert.equal(u.shortBusinessName('Sunrise Family Dental, PLLC'), 'Sunrise Family Dental');
  assert.equal(u.shortBusinessName('Bright Smile Studio | Cosmetic Dentist Austin'), 'Bright Smile Studio');
  assert.equal(u.shortBusinessName('Dr. Lee - Family Dentistry'), 'Dr. Lee');
  assert.equal(u.shortBusinessName('A1'), 'A1');
});

test('buildSearch validates and clamps', () => {
  const s = places.buildSearch({ 'Business type': ' dentists ', 'City or area': 'Austin, TX', 'How many businesses?': '60', searchLanguage: 'en', searchCountryCode: 'us' });
  assert.equal(s.textQuery, 'dentists in Austin, TX');
  assert.equal(s.maxLeads, 60);
  assert.equal(s.maxPages, 3);
  assert.deepEqual(s.requestBody, { textQuery: 'dentists in Austin, TX', pageSize: 20, includePureServiceAreaBusinesses: true, languageCode: 'en', regionCode: 'US' });
  assert.equal(places.buildSearch({ businessType: 'gyms', location: 'Pune', maxLeads: 500 }).maxLeads, 60);
  assert.equal(places.buildSearch({ businessType: 'gyms', location: 'Pune', maxLeads: 7 }).requestBody.pageSize, 7);
  assert.equal(places.buildSearch({ businessType: 'gyms', location: 'Pune' }).maxLeads, 40);
  assert.equal(places.buildSearch({ businessType: 'gyms', location: 'Pune', searchCountryCode: 'USA', searchLanguage: 'English' }).requestBody.regionCode, undefined);
  assert.throws(() => places.buildSearch({ 'Business type': 'dentists' }), /City or area/);
});

test('normalizePlaces dedupes, skips closed businesses and caps results', () => {
  const pages = fx.placesPages();
  const res = places.normalizePlaces(pages, { maxLeads: 60 });
  assert.equal(res.leads.length, 13);
  assert.equal(res.duplicates, 1);
  assert.equal(res.skippedClosed, 1);
  const sunrise = res.leads.find((l) => l.placeId === 'ChIJsunrise0001');
  assert.equal(sunrise.name, 'Sunrise Family Dental, PLLC');
  assert.equal(sunrise.website, 'https://sunrise-dental.test/?utm_source=gbp');
  assert.equal(sunrise.rating, 4.6);
  assert.equal(sunrise.reviewCount, 212);
  assert.equal(sunrise.category, 'Dentist');
  assert.equal(sunrise.hours.known, true);
  const lakeside = res.leads.find((l) => l.placeId === 'ChIJlakeside0002');
  assert.equal(lakeside.website, '');
  assert.equal(places.normalizePlaces(pages, { maxLeads: 5 }).leads.length, 5);
  assert.deepEqual(places.normalizePlaces([{}], {}).leads, []);
});

test('normalizePlaces turns Google errors into actionable messages', () => {
  const keyError = { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } };
  assert.throws(() => places.normalizePlaces([keyError], {}), /API key was rejected/);
  const disabled = { error: { code: 403, message: 'Places API (New) has not been used in project 123 before or it is disabled.', status: 'PERMISSION_DENIED' } };
  assert.throws(() => places.normalizePlaces([disabled], {}), /not enabled/);
  const n8nStyle = { error: { message: '403 - "{\\"error\\":{\\"code\\":403,\\"message\\":\\"Requests to this API places.googleapis.com method google.maps.places.v1.Places.SearchText are blocked.\\",\\"status\\":\\"PERMISSION_DENIED\\"}}"' } };
  assert.throws(() => places.normalizePlaces([n8nStyle], {}), /restriction/);
  assert.match(places.explainGoogleError({ error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }), /quota/);
  assert.match(places.explainGoogleError({ error: { message: 'billing account required' } }), /billing/);
  assert.equal(places.explainGoogleError({}), '');
  // n8n's paginated HTTP error shape keeps Google's JSON as a string in error.error
  const paged = { error: { statusCode: 403, error: '{"error":{"code":403,"message":"Places API (New) has not been used in project 1 before or it is disabled.","status":"PERMISSION_DENIED"}}', isAxiosError: true, response: { status: 403 } } };
  assert.match(places.explainGoogleError(paged), /not enabled/);
  assert.equal(places.httpStatusOf(paged.error), 403);
  assert.equal(places.errorSummary(paged.error), 'Places API (New) has not been used in project 1 before or it is disabled.');
  assert.equal(places.errorSummary({ message: '500 - "{\\"type\\":\\"error\\",\\"error\\":{\\"type\\":\\"api_error\\",\\"message\\":\\"Boom\\"}}"' }), 'Boom');
  assert.equal(places.httpStatusOf({ message: 'Try spacing your requests', status: 429, code: 'ERR_BAD_REQUEST' }), 429);
});

test('summarizeHours', () => {
  const h = places.summarizeHours(fx.hoursFor('weekday-8-5-closed-weekend'));
  assert.deepEqual(h.closedDays, ['Sunday', 'Saturday']);
  assert.equal(h.earlyCloseWeekdays, 5);
  const open = places.summarizeHours(fx.hoursFor('24h'));
  assert.equal(open.open24h, true);
  const normal = places.summarizeHours(fx.hoursFor('weekday-9-6'));
  assert.deepEqual(normal.closedDays, ['Sunday']);
  assert.equal(normal.earlyCloseWeekdays, 0);
  const late = places.summarizeHours({ periods: [{ open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }] });
  assert.equal(late.latestClose[5], 26);
  assert.equal(places.summarizeHours(undefined).known, false);
  assert.equal(places.summarizeHours({ periods: [] }).known, false);
});

test('marketStats', () => {
  const leads = places.normalizePlaces(fx.placesPages(), { maxLeads: 60 }).leads;
  const m = places.marketStats(leads);
  assert.equal(m.count, 13);
  assert.equal(m.medianReviews, 133);
  assert.equal(m.topReviewsAvg, Math.round((520 + 340 + 260) / 3));
  assert.equal(m.medianRating, 4.6);
  assert.deepEqual(places.marketStats([]), { count: 0, medianReviews: null, medianRating: null, topReviewsAvg: null });
});
