const test = require('node:test');
const assert = require('node:assert/strict');
const web = require('../../src/lib/website');
const psi = require('../../src/lib/pagespeed');
const problems = require('../../src/lib/problems');
const places = require('../../src/lib/places');
const steps = require('../../src/lib/steps');
const packs = require('../../src/niches');
const fx = require('../fixtures/businesses');

const NOW = new Date('2026-10-06T09:00:00Z');
const pack = (id) => packs.find((p) => p.id === id);

test('classifyFetch maps every outcome', () => {
  assert.equal(web.classifyFetch({ statusCode: 200, html: '<html></html>' }).status, 'ok');
  assert.equal(web.classifyFetch({ statusCode: 301, html: '' }).status, 'ok');
  assert.equal(web.classifyFetch({ statusCode: 404, html: 'nope' }).status, 'not-found');
  assert.equal(web.classifyFetch({ statusCode: 410 }).reachable, false);
  assert.equal(web.classifyFetch({ statusCode: 403 }).status, 'blocked');
  assert.equal(web.classifyFetch({ statusCode: 503 }).status, 'blocked');
  assert.equal(web.classifyFetch({ statusCode: 500 }).status, 'server-error');
  assert.equal(web.classifyFetch({ error: { message: 'getaddrinfo ENOTFOUND x.test' } }).status, 'domain-not-found');
  assert.equal(web.classifyFetch({ error: { message: 'certificate has expired', code: 'CERT_HAS_EXPIRED' } }).status, 'ssl-error');
  assert.equal(web.classifyFetch({ error: { message: "Hostname/IP does not match certificate's altnames" } }).status, 'ssl-error');
  assert.equal(web.classifyFetch({ error: { message: 'timeout of 20000ms exceeded' } }).status, 'timeout');
  assert.equal(web.classifyFetch({ error: { message: 'connect ECONNREFUSED 1.2.3.4:443' } }).status, 'connection-failed');
  assert.equal(web.classifyFetch({ error: { message: 'Maximum number of redirects exceeded' } }).status, 'redirect-loop');
  assert.equal(web.classifyFetch({}).status, 'unknown');
});

test('email extraction: mailto, Cloudflare, entities, obfuscation, junk filtering, ranking', () => {
  const html = `
    <a href="mailto:Info@Example-Clinic.test?subject=hi">Email</a>
    <span data-cfemail="${fx.cfEncode('frontdesk@example-clinic.test', 0x11)}"></span>
    <p>careers@example-clinic.test</p>
    <p>bookings&#64;example-clinic&#46;test</p>
    <p>owner [at] example-clinic [dot] test</p>
    <img src="logo@2x.png"> <script>var x="abc@sentry.io"</script>
    <p>user@domain.com</p><p>7f3a9b2c4d5e6f708192a3b4c5d6e7f8@sentry-next.wixpress.com</p>
    <p>drsmith.dental@gmail.com</p>`;
  const emails = web.extractEmails(html, 'https://www.example-clinic.test/');
  assert.equal(emails[0], 'info@example-clinic.test');
  assert.ok(emails.includes('frontdesk@example-clinic.test'));
  assert.ok(emails.includes('bookings@example-clinic.test'));
  assert.ok(emails.includes('owner@example-clinic.test'));
  assert.ok(emails.includes('drsmith.dental@gmail.com'));
  assert.ok(!emails.some((e) => /sentry|domain\.com|2x\.png|wixpress/.test(e)));
  assert.ok(emails.indexOf('careers@example-clinic.test') > emails.indexOf('owner@example-clinic.test'));
  assert.equal(web.decodeCfEmail('zz'), '');
  assert.equal(web.isPlausibleEmail('noreply@shop.test'), false);
});

test('copyright year and contact page detection', () => {
  assert.equal(web.extractCopyrightYear('<footer>&copy; 2015 - 2019 Acme</footer>'), 2019);
  assert.equal(web.extractCopyrightYear('<p>Copyright 2021 Acme Dental. Founded 1998.</p>'), 2021);
  assert.equal(web.extractCopyrightYear('<p>© Acme Dental 2018</p>'), 2018);
  assert.equal(web.extractCopyrightYear('<p>© <script>document.write(new Date().getFullYear())</script> Acme</p>'), null);
  assert.equal(web.extractCopyrightYear('<p>Call 2012345678</p>'), null);
  assert.equal(web.findContactUrl('<a href="/contact-us">Contact</a>', 'https://a.test/'), 'https://a.test/contact-us');
  assert.equal(web.findContactUrl('<a href="https://other.test/contact">x</a>', 'https://a.test/'), '');
  assert.equal(web.findContactUrl('<a href="/about"><span>Get in touch</span></a>', 'https://a.test/home'), '');
  assert.equal(web.findContactUrl('<a href="/about#x">Reach us</a>', 'https://a.test/'), '');
  assert.equal(web.findContactUrl('<a href="/kontakt">Kontakt</a>', 'https://a.test/'), 'https://a.test/kontakt');
});

test('analyzeHtml reads the fixture sites correctly', () => {
  const a = (key) => web.analyzeHtml(fx.byKey(key).html, fx.byKey(key).place.website);
  const sunrise = a('sunrise');
  assert.equal(sunrise.copyrightYear, 2019);
  assert.equal(sunrise.hasViewport, true);
  assert.equal(sunrise.hasBooking, false);
  assert.equal(sunrise.hasChat, false);
  assert.equal(sunrise.socials.facebook, true);
  assert.equal(sunrise.hasSocial, true);
  assert.equal(sunrise.hasAnalytics, false);
  assert.deepEqual(sunrise.emails, ['info@sunrise-dental.test']);
  assert.equal(sunrise.contactUrl, 'https://sunrise-dental.test/contact-us');
  const bright = a('brightsmile');
  assert.equal(bright.hasViewport, false);
  assert.deepEqual(bright.emails, ['smile@bright-smile.test']);
  assert.equal(bright.hasMetaDescription, false);
  const downtown = a('downtown');
  assert.equal(downtown.booking, 'Zocdoc');
  assert.equal(downtown.chat, 'Tawk.to');
  assert.equal(downtown.hasAnalytics, true);
  assert.equal(downtown.hasMetaPixel, true);
  assert.equal(downtown.hasSchema, true);
  const cedar = a('cedar');
  assert.equal(cedar.isPlaceholder, true);
  const elm = a('elm');
  assert.equal(elm.hasTitle, false);
  assert.equal(elm.hasH1, false);
  assert.equal(elm.socials.facebook, false); // a share button is not a business page
  assert.deepEqual(elm.emails, ['contact@elm-dental.test']);
  const gentle = a('gentle');
  assert.equal(gentle.booking, 'Fresha');
  assert.equal(gentle.hasWhatsApp, true);
  assert.equal(gentle.socials.tiktok, true);
  const westlake = a('westlake');
  assert.equal(westlake.hasBooking, false);
  assert.deepEqual(westlake.emails, ['office@westlake-dental.test']);
});

test('parsePageSpeed handles success, runtime errors and API errors', () => {
  const ok = psi.parsePageSpeed(fx.psiResponse(fx.byKey('sunrise')));
  assert.equal(ok.ok, true);
  assert.equal(ok.performance, 23);
  assert.equal(ok.seo, 91);
  assert.equal(ok.lcp, '9.8 s');
  assert.equal(ok.isOnHttps, 1);
  assert.equal(ok.fieldSpeed, 'SLOW');
  const bright = psi.parsePageSpeed(fx.psiResponse(fx.byKey('brightsmile')));
  assert.equal(bright.isOnHttps, 0);
  assert.equal(bright.finalUrl, 'http://bright-smile.test/');
  const rt = psi.parsePageSpeed(fx.psiResponse(fx.byKey('oakhill')));
  assert.equal(rt.ok, false);
  assert.equal(rt.runtimeError, 'ERRORED_DOCUMENT_REQUEST');
  assert.equal(psi.parsePageSpeed({ error: { message: '500 - Internal error' } }).ok, false);
  assert.equal(psi.parsePageSpeed({}).ok, false);
  assert.match(psi.pageSpeedUrl('https://a.test/?x=1'), /url=https%3A%2F%2Fa\.test%2F%3Fx%3D1&strategy=mobile&category=PERFORMANCE/);
});

// Simulates exactly what the workflow does for each fixture business, without n8n.
function fetchResultFor(b) {
  if (!b.place.website) return null;
  if (b.unresolvable) return { error: { message: `getaddrinfo ENOTFOUND ${new URL(b.place.website).hostname}` } };
  if (b.badCert) return { error: { message: "Hostname/IP does not match certificate's altnames: Host: pearl-dental.test" } };
  if (b.status) return { statusCode: b.status, html: 'blocked', headers: {} };
  return { statusCode: 200, html: b.html, headers: { 'content-type': 'text/html' } };
}

function processedLeads(packId) {
  const p = pack(packId);
  const leads = places.normalizePlaces(fx.placesPages(), { maxLeads: 60 }).leads;
  const market = places.marketStats(leads);
  return leads.map((lead) => {
    const b = fx.BUSINESSES.find((x) => x.place.id === lead.placeId);
    let l = Object.assign({}, lead, { market });
    if (p.needsWebsiteCheck && l.website) {
      l = steps.stepCheckWebsite(l, fetchResultFor(b));
      if (p.needsPageSpeed && l.site.status === 'ok') {
        const resp = b.psi && b.psi.error ? { error: { message: 'The service is currently unavailable.' } } : fx.psiResponse(b);
        l = steps.stepReadPageSpeed(l, resp);
      }
    }
    return { lead: l, b };
  });
}

for (const [packId, expectKey] of [
  ['web-design', 'webDesign'],
  ['reviews', 'reviews'],
  ['ai-chatbot', 'aiChatbot'],
]) {
  test(`${packId} pack finds exactly the designed problems`, () => {
    for (const { lead, b } of processedLeads(packId)) {
      const found = problems.detectProblems({ lead, site: lead.site, analysis: lead.analysis, psi: lead.psi, market: lead.market, now: NOW }, pack(packId)).map((x) => x.id);
      const expected = b.expect[expectKey];
      if (expected === undefined) continue;
      assert.deepEqual([...found].sort(), [...expected].sort(), `${b.key}: found ${found.join(', ')}`);
    }
  });
}

test('evidence strings quote the real numbers', () => {
  const leads = processedLeads('web-design');
  const sunrise = leads.find((x) => x.b.key === 'sunrise').lead;
  const found = problems.detectProblems({ lead: sunrise, site: sunrise.site, analysis: sunrise.analysis, psi: sunrise.psi, market: sunrise.market, now: NOW }, pack('web-design'));
  const slow = found.find((p) => p.id === 'slow_mobile');
  assert.match(slow.evidence, /23\/100/);
  assert.match(slow.evidence, /9\.8 s/);
  assert.match(slow.evidence, /Real-visitor data/);
  const outdated = found.find((p) => p.id === 'outdated_site');
  assert.match(outdated.evidence, /© 2019/);
  assert.match(outdated.evidence, /7 years/);
  assert.equal(found[0].id, 'slow_mobile'); // highest weight first
  const oak = leads.find((x) => x.b.key === 'oakhill').lead;
  const down = problems.detectProblems({ lead: oak, site: oak.site, analysis: oak.analysis, psi: oak.psi, market: oak.market, now: NOW }, pack('web-design'));
  assert.match(down[0].evidence, /page not found/);
});

test('blocked sites are never judged on HTML checks', () => {
  const riverside = processedLeads('social-media').find((x) => x.b.key === 'riverside').lead;
  const found = problems.detectProblems({ lead: riverside, site: riverside.site, analysis: riverside.analysis, psi: riverside.psi, market: riverside.market, now: NOW }, pack('social-media'));
  assert.deepEqual(found, []);
});

test('scoring and ranking', () => {
  assert.equal(problems.scoreProblems([{ points: 45 }, { points: 30 }, { points: 40 }]), 100);
  assert.equal(problems.priorityFor(60), 'Hot');
  assert.equal(problems.priorityFor(30), 'Warm');
  assert.equal(problems.priorityFor(5), 'Low');
  assert.equal(problems.priorityFor(0), 'None');
  const ranked = problems.rankLeads([
    { name: 'b', score: 50, reviewCount: 10 },
    { name: 'a', score: 50, reviewCount: 10 },
    { name: 'c', score: 50, reviewCount: 99 },
    { name: 'd', score: 90, reviewCount: 1 },
  ]);
  assert.deepEqual(ranked.map((l) => l.name), ['d', 'c', 'a', 'b']);
});

test('every niche pack only uses known checks and has complete copy', () => {
  for (const p of packs) {
    for (const id of Object.keys(p.weights)) assert.ok(problems.PROBLEMS[id], `${p.id}: unknown check ${id}`);
    for (const key of ['id', 'title', 'tagline', 'defaultService', 'defaultOffer', 'pitchAngle']) assert.ok(p[key], `${p.id}.${key}`);
    assert.ok(p.fallback.subject && p.fallback.impact);
    assert.ok(p.exampleSearch.businessType && p.exampleSearch.location);
    if (!p.needsWebsiteCheck) assert.equal(p.needsPageSpeed, false);
  }
  assert.equal(new Set(packs.map((p) => p.id)).size, packs.length);
});

test('social and booking-platform links count as "no website of their own" and are never judged', () => {
  assert.equal(places.websitePlatform('https://www.facebook.com/goldengatedental'), 'Facebook page');
  assert.equal(places.websitePlatform('https://instagram.com/smile.studio'), 'Instagram profile');
  assert.equal(places.websitePlatform('https://linktr.ee/salon'), 'link-in-bio page');
  assert.equal(places.websitePlatform('https://www.fresha.com/a/salon-x'), 'booking page');
  assert.equal(places.websitePlatform('https://www.practo.com/bangalore/clinic/x'), 'booking page');
  assert.equal(places.websitePlatform('https://sunrise-dental.test/'), '');
  assert.equal(places.websitePlatform('https://notfacebook.com/'), '');
  const page = { places: [Object.assign(fx.toPlace(fx.byKey('lakeside')), { id: 'fbOnly', websiteUri: 'https://www.facebook.com/goldengatedental' })] };
  const lead = places.normalizePlaces([page], {}).leads[0];
  assert.equal(lead.websitePlatform, 'Facebook page');
  const market = { count: 1, medianReviews: null, medianRating: null };
  // Even if HTML had been fetched, platform pages are never judged.
  const fake = { lead, site: { status: 'ok', reachable: true }, analysis: web.analyzeHtml('<html><body>nothing</body></html>', lead.website), psi: { ok: true, performance: 10, isOnHttps: 0 }, market, now: NOW };
  const found = problems.detectProblems(fake, pack('web-design'));
  assert.deepEqual(found.map((x) => x.id), ['no_website']);
  assert.match(found[0].evidence, /links to a Facebook page \(facebook\.com\) instead of a website of their own/);
  const rows = steps.stepLiteRows([lead], { search: { textQuery: 'q' } });
  assert.equal(rows[0]['Has Website'], 'NO (Facebook page only)');
  assert.match(rows[0].Opportunity, /Only a Facebook page/);
  const ai = require('../../src/lib/ai');
  assert.match(ai.leadFactsText(Object.assign({}, lead, { problems: found })), /Website: none of their own \(Google lists their Facebook page: facebook\.com\)/);
});
