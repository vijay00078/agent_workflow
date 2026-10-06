// Regression tests for the findings of the multi-lens code review (logic, n8n, evidence, security).
// Each test reproduces the reported scenario and checks the fixed behaviour.
const test = require('node:test');
const assert = require('node:assert/strict');
const web = require('../../src/lib/website');
const psi = require('../../src/lib/pagespeed');
const problems = require('../../src/lib/problems');
const places = require('../../src/lib/places');
const steps = require('../../src/lib/steps');
const fu = require('../../src/lib/followup');
const util = require('../../src/lib/util');
const packs = require('../../src/niches');
const fx = require('../fixtures/businesses');

const NOW = new Date('2026-10-06T09:00:00Z');
const pack = (id) => packs.find((p) => p.id === id);
const ABOUT = fx.ABOUT;
const html = (body, head = '') => `<!doctype html><html><head><title>Smile Dental | Austin</title><meta name="viewport" content="width=device-width">${head}</head><body><h1>Smile Dental</h1>${body}${ABOUT}</body></html>`;
const baseLead = (over) => Object.assign({ placeId: 'p1', name: 'Smile Dental', website: 'https://smiledental.test/', reviewCount: 50, rating: 4.7, hours: { known: false }, market: { count: 1, medianReviews: null } }, over);

function judge(packId, lead, fetchResp, psiResp) {
  let l = steps.stepCheckWebsite(baseLead(lead), fetchResp, NOW);
  if (l.needsRecheck) l = steps.stepRecheckWebsite(l, fetchResp, NOW);
  if (psiResp !== undefined) l = steps.stepReadPageSpeed(l, psiResp);
  const found = problems.detectProblems({ lead: l, site: l.site, analysis: l.analysis, psi: l.psi || null, market: l.market, now: NOW }, pack(packId));
  return { lead: l, found, ids: found.map((p) => p.id) };
}
const ok200 = (body, head) => ({ statusCode: 200, html: html(body, head) });
const psiOk = (over = {}) => {
  const b = { place: { website: 'https://smiledental.test/' }, psi: Object.assign({ performance: 80, seo: 95, bestPractices: 90, https: 1, lcpMs: 2000, viewport: 1 }, over) };
  return fx.psiResponse(b);
};

// ---------- evidence accuracy ----------

test('no_https: mixed content or an http→https redirect is not "no HTTPS"; an http final URL is', () => {
  assert.deepEqual(judge('web-design', {}, ok200(''), psiOk({ https: 0, finalUrl: 'https://smiledental.test/' })).ids, []);
  const http = judge('web-design', { website: 'http://smiledental.test/' }, ok200(''), psiOk({ https: 0, finalUrl: 'http://smiledental.test/' }));
  assert.deepEqual(http.ids, ['no_https']);
  assert.match(http.found[0].evidence, /loads without HTTPS/);
  // finalUrl missing: no claim (the requested URL is not evidence of where the page ended up).
  const noFinal = psi.parsePageSpeed({ id: 'http://x.test/', lighthouseResult: { audits: { 'is-on-https': { score: 0 } }, categories: {} } });
  assert.equal(noFinal.finalUrl, '');
});

test('unquoted attributes in minified HTML are read; Lighthouse passes beat our HTML reading', () => {
  const page = '<html><head><title>Smile</title><meta name=description content="Family dentist in Austin"><meta name=viewport content=width=device-width><script type=application/ld+json>{}</script></head><body><h1>Smile</h1>' + ABOUT + '</body></html>';
  const a = web.analyzeHtml(page, 'https://smiledental.test/');
  assert.equal(a.hasMetaDescription, true);
  assert.equal(a.hasViewport, true);
  assert.equal(a.hasSchema, true);
  assert.deepEqual(judge('seo', {}, { statusCode: 200, html: page }, psiOk()).ids, []);
  // HTML says no meta description, Lighthouse says it is there: no claim.
  const noMeta = judge('seo', {}, ok200('<p>x</p>'), psiOk({ seo: 95 }));
  assert.ok(!noMeta.ids.includes('weak_seo'));
  // PageSpeed failed and the HTML really has no viewport tag: still claimed from the HTML.
  const noVp = '<html><head><title>T</title></head><body><h1>x</h1>' + ABOUT + '</body></html>';
  assert.ok(judge('web-design', {}, { statusCode: 200, html: noVp }, { error: { message: 'NO_FCP' } }).ids.includes('not_mobile_friendly'));
});

test('Lighthouse 13 "viewport-insight" audit is used when the old "viewport" audit is missing', () => {
  const r = psi.parsePageSpeed({ lighthouseResult: { finalUrl: 'https://a.test/', categories: { performance: { score: 0.9 } }, audits: { 'viewport-insight': { score: 0 } } } });
  assert.equal(r.viewport, 0);
  const pass = psi.parsePageSpeed({ lighthouseResult: { finalUrl: 'https://a.test/', categories: {}, audits: { 'viewport-insight': { score: 1 } } } });
  assert.equal(pass.viewport, 1);
});

test('placeholder: only strong signals; "coming soon" in the body of a real site or "How it works!" is not one', () => {
  const real = web.analyzeHtml(html('<p>New patient online booking coming soon! Call (512) 555-0100.</p><a href="tel:5125550100">Call</a>'), 'https://smiledental.test/');
  assert.equal(real.isPlaceholder, false);
  const how = web.analyzeHtml(html("<h2>Here's how it works!</h2>"), 'https://smiledental.test/');
  assert.equal(how.isPlaceholder, false);
  assert.equal(web.analyzeHtml('<html><head><title>Coming Soon</title></head><body><h1>Coming soon!</h1></body></html>', 'https://a.test/').isPlaceholder, true);
  assert.equal(web.analyzeHtml('<html><body><h1>It works!</h1><p>This is the default web page for this server.</p></body></html>', 'https://a.test/').isPlaceholder, true);
  assert.equal(web.analyzeHtml('<html><body>This domain is for sale. Buy this domain today.</body></html>', 'https://a.test/').isPlaceholder, true);
});

test('copyright: 2-digit and "present" range ends, script-filled years and founding years', () => {
  assert.equal(web.extractCopyrightYear('<p>© 2008-24 Smile Dental</p>'), 2024);
  assert.equal(web.extractCopyrightYear("<p>Copyright © 2016–'26</p>"), 2026);
  assert.equal(web.extractCopyrightYear('<p>© 2015 - Present Smile Dental</p>', NOW), 2026);
  assert.equal(web.extractCopyrightYear('<p>Copyright © 2016-present</p>', NOW), 2026);
  assert.equal(web.extractCopyrightYear('<p>© 2008/2026</p>'), 2026);
  assert.equal(web.extractCopyrightYear('<p>© <span id="yr">2021</span></p><script>yr.textContent=new Date().getFullYear()</script>'), null);
  assert.equal(web.extractCopyrightYear('<p>© <script>document.write(new Date().getFullYear())</script> Smith Dental, est. 1998</p>'), null);
  assert.equal(web.extractCopyrightYear('<p>© Smith Dental, est. 1998</p>'), null);
  assert.equal(web.extractCopyrightYear('<p>© 2015 - 2019 Acme</p>'), 2019);
  assert.equal(web.extractCopyrightYear('<p>© 2019 Smile Dental - All rights reserved</p>'), 2019);
});

test('emails: placeholders, agency credits, multi-part domains, malformed mailto links', () => {
  const site = 'https://brightsmilesdental.test/';
  // (a) form placeholder and example addresses are not the business's address
  assert.deepEqual(web.extractEmails('<input type="email" placeholder="johndoe@gmail.com"><p>e.g. example@gmail.com</p>', site), []);
  // (b) "Website by" credit loses to the business's own gmail; alone it is never picked
  const credit = '<p>Email <a href="mailto:dr.jane.smith@gmail.com">us</a></p><footer>Website by <a href="mailto:hello@pixelcraft.agency">PixelCraft</a> - hello@pixelcraft.agency</footer>';
  const c = web.collectEmails(credit, site);
  assert.deepEqual(c.emails, ['dr.jane.smith@gmail.com']);
  assert.deepEqual(c.others, ['hello@pixelcraft.agency']);
  assert.deepEqual(web.extractEmails('<footer>Website by PixelCraft - hello@pixelcraft.agency</footer>', site), []);
  // "Powered by WordPress | Contact: ..." is not a credit for the address after the separator
  assert.deepEqual(web.extractEmails('<footer>Powered by WordPress | Contact: smiledentalaustin@gmail.com</footer>', site), ['smiledentalaustin@gmail.com']);
  // (c) obfuscated multi-part domains
  assert.deepEqual(web.extractEmails('<p>info [at] smiledental [dot] co [dot] uk</p>', 'https://smiledental.co.uk/'), ['info@smiledental.co.uk']);
  assert.deepEqual(web.extractEmails('<p>hello(at)studio(dot)com(dot)au</p>', 'https://studio.com.au/'), ['hello@studio.com.au']);
  assert.deepEqual(web.extractEmails('<p>Book online at smiledental.test today</p>', site), []); // "online at x.com" is not an address
  // (d) malformed percent-encoding never throws
  for (const bad of ['%EMAIL%', 'info@smiledental.test%', 'caf%E9@x.test', '%%email%%']) {
    assert.doesNotThrow(() => steps.stepCheckWebsite(baseLead(), { statusCode: 200, html: html(`<a href="mailto:${bad}">x</a>`) }, NOW));
  }
  // site-domain addresses first, then free mail, then other domains (only when linked)
  const rank = web.extractEmails('<a href="mailto:office@partner.test">p</a><p>smile@gmail.com</p><p>info@brightsmilesdental.test</p>', site);
  assert.deepEqual(rank, ['info@brightsmilesdental.test', 'smile@gmail.com', 'office@partner.test']);
  // platform support addresses are never a lead's address
  assert.deepEqual(web.extractEmails('<p>support@styleseat.com</p>', 'https://www.styleseat.com/m/x'), []);
});

test('regexes stay linear on huge or hostile pages', () => {
  const cases = ['x'.repeat(1500000), 'a.b-c%d+'.repeat(150000), '<a '.repeat(200000), '<meta '.repeat(100000), '<script'.repeat(80000), '<'.repeat(600000), ' at '.repeat(100000), `data:image/svg+xml;base64,${'A'.repeat(400000)}`];
  for (const page of cases) {
    const t = Date.now();
    web.analyzeHtml(page, 'https://a.test/');
    assert.ok(Date.now() - t < 2000, `analyzeHtml took ${Date.now() - t} ms on ${page.slice(0, 12)}…`);
  }
  // A long page keeps its footer (head + tail are read).
  const long = `<html><head><title>T</title></head><body><h1>x</h1>${ABOUT}${'<p>filler text</p>'.repeat(120000)}<footer><a href="https://instagram.com/smiledental">IG</a><a href="https://wa.me/1555">WA</a></footer></body></html>`;
  const a = web.analyzeHtml(long, 'https://a.test/');
  assert.equal(a.truncated, true);
  assert.equal(a.socials.instagram, true);
  assert.equal(a.hasWhatsApp, true);
});

test('booking and chat detection covers common vendors, wording and languages; tag managers make chat unverifiable', () => {
  for (const b of ['<a href="https://acme.cliniko.com/bookings">Book a consult</a>', '<a href="/contact">Make an appointment</a>', '<a href="/x">Request Appointment</a>', '<a href="https://exploretock.com/x">Reservations</a>', '<a href="/termin">Termin buchen</a>', '<a href="https://www.planity.com/x">Prendre rendez-vous</a>', '<div class="amelia-v2-booking"></div>', '<a href="/book-now/">Go</a>']) {
    assert.equal(web.analyzeHtml(html(b), 'https://a.test/').hasBooking, true, b);
  }
  for (const c of ['<script src="https://widgets.leadconnectorhq.com/loader.js"></script>', '<script src="https://salesiq.zoho.com/widget"></script>', '<a href="https://wa.link/abc">WhatsApp</a>', '<div class="joinchat"></div>']) {
    const a = web.analyzeHtml(html(c), 'https://a.test/');
    assert.ok(a.hasChat || a.hasWhatsApp, c);
  }
  const gtm = judge('ai-chatbot', {}, ok200('<p>x</p>', '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>'));
  assert.ok(!gtm.ids.includes('no_chat'));
  const plain = judge('ai-chatbot', {}, ok200('<p>x</p>'));
  assert.deepEqual(plain.ids.sort(), ['no_booking', 'no_chat']);
  assert.match(plain.found.find((p) => p.id === 'no_booking').evidence, /^We couldn't find an online booking button/);
  assert.doesNotMatch(plain.found.find((p) => p.id === 'no_booking').evidence, /call during opening hours/);
});

test('tracking and social: site builders, other analytics and feed widgets are never called "no tracking" / "no social"', () => {
  assert.ok(!judge('social-media', {}, ok200('<p>x</p>', '<link href="https://cdn.shopify.com/s/x.css" rel="stylesheet"><script id="web-pixels-manager-setup">{"google_tag_ids":["G-ABCDEF123"]}</script>')).ids.includes('no_tracking'));
  assert.ok(!judge('social-media', {}, ok200('<p>x</p>', '<meta name="generator" content="Wix.com Website Builder">')).ids.includes('no_tracking'));
  assert.ok(!judge('social-media', {}, ok200('<p>x</p>', '<script src="//js.hs-scripts.com/123.js"></script>')).ids.includes('no_tracking'));
  assert.ok(!judge('social-media', {}, ok200('<p>x</p>', '<script>var _paq=[];/* matomo */</script>')).ids.includes('no_tracking'));
  const fbPlugin = '<iframe src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fsmiledental&tabs=timeline"></iframe>';
  assert.ok(!judge('social-media', {}, ok200(fbPlugin)).ids.includes('no_social'));
  assert.ok(!judge('social-media', {}, ok200('<script src="https://apps.elfsight.com/p/platform.js"></script><div class="elfsight-app-1"></div>')).ids.includes('no_social'));
  const none = judge('social-media', {}, ok200('<p>x</p>'));
  assert.deepEqual(none.ids.sort(), ['no_social', 'no_tracking']);
  assert.doesNotMatch(none.found.find((p) => p.id === 'no_tracking').evidence, /can't measure visitors/);
});

test('platform pages: more booking/delivery/directory hosts; square.site is their own site; redirects to a platform are caught', () => {
  for (const [u, kind] of [
    ['https://www.styleseat.com/m/v/x', 'booking page'],
    ['https://salon.glossgenius.com/', 'booking page'],
    ['https://www.doctolib.de/zahnarzt/x', 'booking page'],
    ['https://www.toasttab.com/x', 'ordering or delivery page'],
    ['https://wa.link/abc', 'WhatsApp link'],
    ['https://www.thumbtack.com/x', 'directory listing'],
  ]) assert.equal(places.websitePlatform(u), kind, u);
  assert.equal(places.websitePlatform('https://smithsbakery.square.site/'), '');
  assert.equal(places.websitePlatform('https://sites.google.com/view/smithplumbing'), '');
  // The domain forwards to Facebook: n8n gives no final URL, but the page's og:url / canonical says so.
  const fb = judge('web-design', {}, { statusCode: 200, html: '<html><head><meta property="og:url" content="https://www.facebook.com/smiledental"><title>Smile | Facebook</title></head><body>' + ABOUT + '</body></html>' });
  assert.equal(fb.lead.websitePlatform, 'Facebook page');
  assert.deepEqual(fb.ids, ['no_website']);
  assert.match(fb.found[0].evidence, /forwards to a Facebook page/);
  // PageSpeed (Chrome) ended up on a booking page.
  const viaPsi = judge('web-design', {}, ok200('<p>x</p>'), psiOk({ finalUrl: 'https://www.fresha.com/a/smile' }));
  assert.equal(viaPsi.lead.websitePlatform, 'booking page');
  assert.deepEqual(viaPsi.ids, ['no_website']);
});

test('JavaScript shells, bot-challenge pages and meta-refresh pages are never judged on absence checks', () => {
  const shell = '<html><head><title>Smile Dental</title></head><body><div id="root"></div><script src="/assets/index.js"></script></body></html>';
  const sucuri = '<html><head><title>You are being redirected...</title></head><body><script>var sucuri_cloudproxy_js="x"</script>' + ABOUT + '</body></html>';
  const refresh = '<html><head><meta http-equiv="refresh" content="0;url=/home"></head><body>Redirecting</body></html>';
  for (const page of [shell, sucuri, refresh]) {
    const a = web.analyzeHtml(page, 'https://a.test/');
    assert.equal(a.verifiable, false, page.slice(0, 60));
    for (const p of ['seo', 'social-media', 'ai-chatbot']) assert.deepEqual(judge(p, {}, { statusCode: 200, html: page }).ids, [], `${p}: ${page.slice(0, 40)}`);
  }
  const lead = judge('ai-chatbot', {}, { statusCode: 200, html: shell }).lead;
  assert.match(steps.leadNotes(lead).join(' '), /not checked in detail: the page has almost no text/);
});

test('"Website down" needs two failed checks, the right wording, and never comes from temporary or bot-blocking errors', () => {
  // A dead location page is a broken link, not a dead homepage.
  const sub = judge('web-design', { website: 'https://www.brightsmiles.test/locations/austin-tx/' }, { statusCode: 404, html: '' });
  assert.deepEqual(sub.ids, ['site_down']);
  assert.equal(sub.found[0].label, 'Broken website link');
  assert.match(sub.found[0].evidence, /link on their Google listing \(brightsmiles\.test\/locations\/austin-tx\/\) leads to a "page not found" error/);
  const home = judge('web-design', {}, { statusCode: 404, html: '' });
  assert.match(home.found[0].evidence, /didn't load in two checks.*the homepage returns "page not found"/);
  for (const e of ['getaddrinfo EAI_AGAIN smiledental.test', 'Maximum number of redirects exceeded', 'read ECONNRESET', 'Client network socket disconnected before secure TLS connection was established']) {
    assert.deepEqual(judge('web-design', {}, { error: { message: e } }).ids, [], e);
  }
  // First attempt failed, the recheck worked: no claim, and the page is analysed.
  let l = steps.stepCheckWebsite(baseLead(), { statusCode: 502, html: '' }, NOW);
  assert.equal(l.needsRecheck, true);
  l = steps.stepRecheckWebsite(l, ok200('<p>x</p>'), NOW);
  assert.equal(l.site.status, 'ok');
  assert.equal(l.site.firstStatus, 'server-error');
  assert.ok(l.analysis);
  const ids = problems.detectProblems({ lead: l, site: l.site, analysis: l.analysis, psi: null, market: l.market, now: NOW }, pack('web-design')).map((p) => p.id);
  assert.ok(!ids.includes('site_down'), ids.join());
});

test('certificate errors: claimed only when Chrome (PageSpeed) agrees or the fault is certain', () => {
  const nodeOnly = { error: { message: "SSL Issue: consider using the 'Ignore SSL issues' option", name: 'NodeSslError' } };
  const leafOnly = { error: { message: 'unable to verify the first certificate', code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } };
  // Missing intermediate certificate: Chrome loads the page fine → no claim, a note instead, speed checks still run.
  const fine = judge('web-design', {}, leafOnly, psiOk({ performance: 30 }));
  assert.deepEqual(fine.ids, ['slow_mobile']);
  assert.match(steps.leadNotes(Object.assign({}, fine.lead, { problems: fine.found })).join(' '), /Chrome loads it fine: not claimed/);
  // n8n gives no detail and PageSpeed failed for another reason → no claim.
  assert.deepEqual(judge('web-design', {}, nodeOnly, { error: { message: '500 - Lighthouse returned error: NO_FCP' } }).ids, []);
  // Chrome refused it too → claimed, with Chrome's reason.
  const chrome = { lighthouseResult: { runtimeError: { code: 'INSECURE_DOCUMENT_REQUEST', message: 'The URL you have provided does not have a valid security certificate. net::ERR_CERT_DATE_INVALID' }, categories: {}, audits: {} } };
  const bad = judge('web-design', {}, nodeOnly, chrome);
  assert.deepEqual(bad.ids, ['ssl_error']);
  assert.match(bad.found[0].evidence, /an expired security certificate.*PageSpeed test hit the same error in Chrome/);
  const asError = psi.parsePageSpeed({ error: { message: '400 - "{\\"error\\":{\\"message\\":\\"Lighthouse returned error: INSECURE_DOCUMENT_REQUEST. net::ERR_CERT_COMMON_NAME_INVALID\\"}}"' } });
  assert.equal(asError.certError, 'net::ERR_CERT_COMMON_NAME_INVALID');
  // A certainly-expired certificate (when n8n passes the detail on) needs no confirmation.
  assert.deepEqual(judge('web-design', {}, { error: { message: 'certificate has expired', code: 'CERT_HAS_EXPIRED' } }, { error: { message: '500' } }).ids, ['ssl_error']);
});

test('slow_mobile has a margin below the 50 line and says what was measured', () => {
  assert.deepEqual(judge('web-design', {}, ok200(''), psiOk({ performance: 47 })).ids, []);
  const slow = judge('web-design', {}, ok200(''), psiOk({ performance: 31, lcpMs: 6800 }));
  assert.match(slow.found[0].evidence, /^In Google's PageSpeed mobile test \(a simulated phone on a 4G connection\) the homepage scored 31\/100 and the main content took 6\.8 s to appear\.$/);
});

test('service-area businesses are included; the PageSpeed response is trimmed to what we read', () => {
  assert.equal(places.buildSearch({ businessType: 'plumbers', location: 'Denver, CO' }).requestBody.includePureServiceAreaBusinesses, true);
  const url = psi.pageSpeedUrl('https://a.test/');
  assert.match(url, /&fields=/);
  const fields = decodeURIComponent(url.split('&fields=')[1]);
  assert.equal(fields, psi.PAGESPEED_FIELDS);
  assert.doesNotMatch(fields, /fullPageScreenshot|i18n|entities/);
  // Every field named in the mask exists in the PSI v5 response schema.
  for (const f of ['requestedUrl', 'finalUrl', 'finalDisplayedUrl', 'lighthouseVersion', 'runtimeError', 'categories', 'audits']) assert.match(fields, new RegExp(`[(,]${f}[,)]`));
  // A lead without an address (service-area business) is fine.
  const lead = places.normalizePlaces([{ places: [{ id: 'sab', displayName: { text: 'Mile High Plumbing' }, businessStatus: 'OPERATIONAL', userRatingCount: 12 }] }], {}).leads[0];
  assert.equal(lead.address, '');
});

test('Google error hints name the right setup step and tell API restrictions from application restrictions', () => {
  const blockedApi = places.explainGoogleError({ error: { message: 'Requests to this API places.googleapis.com method google.maps.places.v1.Places.SearchText are blocked.', status: 'PERMISSION_DENIED' } }, 'Google Places API');
  assert.match(blockedApi, /API restrictions/);
  assert.match(blockedApi, /Places API \(New\)/);
  const referer = places.explainGoogleError({ error: { message: 'Requests from referer <empty> are blocked.', details: 'API_KEY_HTTP_REFERRER_BLOCKED' } }, 'X');
  assert.match(referer, /Application restrictions/);
  const disabled = places.explainGoogleError({ error: { message: 'Places API (New) has not been used in project 123 before or it is disabled.' } }, 'X');
  assert.match(disabled, /"Google Cloud" step/);
  assert.doesNotMatch(disabled, /step 2/);
});

// ---------- duplicates, opt-outs and the sheet ----------

test('one address or website is pitched once: same email or site in the sheet or in the same search', () => {
  const job = steps.stepPrepareJob(Object.assign({ 'Business type': 'dentists', 'City or area': 'Austin, TX' }, { yourName: 'Asha', googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit' }), pack('web-design'), { requireSheet: true });
  const lead = (id, email, site, score) => ({ placeId: id, name: id, email, website: site, reviewCount: 10, market: {}, problems: [], score, site: { status: 'ok' } });
  // stepScoreLeads re-detects problems, so give each lead a placeholder page (40 points)
  const withProblems = (l) => Object.assign(l, { analysis: { isPlaceholder: true } });
  const scored = steps.stepScoreLeads(
    [withProblems(lead('north', 'info@smiledental.test', 'https://north.smiledental.test/')), withProblems(lead('south', 'info@smiledental.test', 'https://south.smiledental.test/')), withProblems(lead('optout', 'dr@other.test', 'https://other.test/'))],
    job,
    NOW,
    [{ 'Place ID': 'old', Business: 'Other Dental', Email: 'dr@other.test', Status: 'Do not contact', Website: 'https://other.test/' }],
  );
  const by = Object.fromEntries(scored.map((l) => [l.placeId, l]));
  assert.equal(by.north.wantsPitch, true);
  assert.equal(by.south.wantsPitch, false);
  assert.match(by.south.duplicateNote, /Same email as north \(found in the same search\)/);
  assert.equal(by.optout.wantsPitch, false);
  assert.match(by.optout.duplicateNote, /Same email as Other Dental, status "Do not contact" in your sheet: not pitched/);
  // Same website, different email (chain locations sharing one site).
  const chain = steps.stepScoreLeads([withProblems(lead('a', 'a@chain.test', 'https://chain.test/a')), withProblems(lead('b', 'b@chain.test', 'https://www.chain.test/b'))], job, NOW, []);
  assert.deepEqual(chain.map((l) => l.wantsPitch).sort(), [false, true]);
  // Google Sites pages of two different businesses are different websites.
  assert.notEqual(steps.siteKey('https://sites.google.com/view/plumber-a'), steps.siteKey('https://sites.google.com/view/plumber-b'));
});

test('overlapping runs: a business another run saved meanwhile is dropped; its email gets no second draft', () => {
  const job = { settings: { createGmailDrafts: true, minScoreToPitch: 20 }, nicheTitle: 'Web Design', search: { textQuery: 'q' } };
  const pitched = (id, email) => ({ placeId: id, name: id, email, website: '', reviewCount: 1, score: 50, problems: [{ id: 'no_website', label: 'No website', evidence: 'e', points: 45 }], pitch: { subject: 's', body: 'b', fullBody: 'b' } });
  const rows = steps.stepSheetRows([pitched('a', 'a@a.test'), pitched('b', 'b@b.test'), pitched('c', 'shared@c.test')], job, NOW, [{ 'Place ID': 'a' }, { 'Place ID': 'zz', Email: 'shared@c.test' }]);
  assert.deepEqual(rows.map((r) => [r['Place ID'], r.Status]), [['b', 'Draft ready'], ['c', 'Pitch ready']]);
  const summary = steps.stepSummary(rows, [], Object.assign({}, job, { settings: Object.assign({}, job.settings, { googleSheetUrl: 'x' }) }), { savedElsewhere: 1 });
  assert.match(summary.message, /1 business had just been saved by another run and was skipped/);
  assert.match(summary.message, /postal address/); // no yourAddress set
});

test('a failed Gmail draft becomes a sheet update with a note that keeps what was there', () => {
  assert.equal(steps.draftErrorText('Bad request - please check your parameters (item 3)'), 'Gmail rejected it (check the email address)');
  assert.equal(steps.draftErrorText({ message: 'Requested entity was not found. (item 0)' }), 'Requested entity was not found.');
  const upd = steps.stepReadDraft({ 'Place ID': 'p', Notes: 'No website: call or DM instead.' }, { error: { message: 'Invalid To header' } });
  assert.deepEqual(upd, { 'Place ID': 'p', Status: 'Pitch ready', 'Last Draft On': '', Notes: 'Gmail draft failed: Invalid To header | No website: call or DM instead.' });
});

test('n8n Sheets errors under "continue on error" are recognised (the node outputs its input item, not rows)', () => {
  const lead = { placeId: 'ChIJx', name: 'X' };
  assert.ok(steps.sheetRowsFrom([{ json: lead, error: { message: 'Unable to parse range: Leads!A:AD' } }])[0].error);
  assert.ok(steps.sheetRowsFrom([{ json: lead }])[0].error); // the error itself may not survive serialisation
  assert.ok(steps.sheetRowsFrom([{ json: { stop: false, settings: {} } }])[0].error);
  assert.deepEqual(steps.sheetRowsFrom([{ json: { 'Place ID': 'a', Email: '' } }, { json: {} }]), [{ 'Place ID': 'a', Email: '' }, {}]);
  const job = { search: { textQuery: 'q' } };
  const stopItem = steps.stepSkipSaved([lead], steps.sheetRowsFrom([{ json: lead, error: {} }]), job)[0];
  assert.equal(stopItem.title, "Couldn't open your Google Sheet");
  assert.equal(steps.stepPlanGmailSearches(steps.sheetRowsFrom([{ json: { stop: false, settings: {} } }]), { googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit' })[0].fatal, true);
});

test('Lite CSV values that would run as spreadsheet formulas are neutralised', () => {
  const rows = steps.stepLiteRows([{ name: '=HYPERLINK("http://x.test","Click")', website: '', reviewCount: 1, rating: 4, phone: '+1 512-555-0100', address: '@properties Ave', mapsUrl: 'm', category: 'c' }], { search: { textQuery: 'q' } });
  assert.equal(rows[0].Business, `'=HYPERLINK("http://x.test","Click")`);
  assert.equal(rows[0].Address, "'@properties Ave");
  assert.equal(rows[0].Phone, "'+1 512-555-0100");
  assert.equal(rows[0].Rating, 4);
});

// ---------- follow-ups ----------

const fNow = new Date('2026-10-20T09:00:00Z');
const at = (iso) => String(new Date(iso + 'T10:00:00Z').getTime());
const row = (over) => Object.assign({ 'Place ID': 'p', Business: 'Smile', Email: 'info@smiledental.test', Status: 'Draft ready', 'Follow-ups': 0, 'Last Draft On': '2026-10-01', 'Last Contacted': '', 'Thread ID': 't-1', 'Email Subject': 'Your site', Notes: '' }, over);
const sent = (to, iso, threadId = 'T1') => ({ id: 's' + iso + threadId, threadId, internalDate: at(iso), From: 'Asha <asha@pixelpine.test>', To: to, Subject: 'Your site', labels: [{ id: 'SENT', name: 'SENT' }] });
const incoming = (from, iso, threadId = 'T1', subject = 'Re: Your site') => ({ id: 'i' + iso + from, threadId, internalDate: at(iso), From: from, To: 'asha@pixelpine.test', Subject: subject, labels: [{ id: 'INBOX', name: 'INBOX' }] });
const S = { followUpDays: '3,7', maxFollowUps: 2 };
const decide = (rows, messages, threadMessages) => steps.stepDecideFollowUps(rows, messages, threadMessages || [], S, fNow);

test('a reply from another address in the pitch thread counts; the thread is read for it', () => {
  const rows = [row()];
  const messages = [sent('info@smiledental.test', '2026-10-02')];
  const plan = steps.stepPlanThreadChecks(rows, messages);
  assert.deepEqual(plan, [{ threadId: 'T1' }]);
  const a = decide(rows, messages, [messages[0], incoming('Dr Sarah <dr.sarah.smith@gmail.com>', '2026-10-05')]);
  assert.equal(a[0].action, 'replied');
  assert.equal(a[0].update.Status, 'Replied');
  assert.match(a[0].update.Notes, /Reply came from dr\.sarah\.smith@gmail\.com/);
  // Without the thread check it would have been a follow-up (the old bug).
  assert.equal(decide(rows, messages, [])[0].action, 'follow-up');
});

test('a bounce in the thread marks the lead Bounced; an out-of-office auto-reply is not a reply', () => {
  const messages = [sent('info@smiledental.test', '2026-10-02')];
  const bounce = decide([row()], messages, [incoming('Mail Delivery Subsystem <mailer-daemon@googlemail.com>', '2026-10-02', 'T1', 'Delivery Status Notification (Failure)')]);
  assert.equal(bounce[0].action, 'bounced');
  assert.equal(bounce[0].update.Status, 'Bounced');
  assert.match(bounce[0].update.Notes, /email bounced/);
  const ooo = decide([row()], messages, [incoming('info@smiledental.test', '2026-10-03', 'T1', 'Automatic reply: Your site')]);
  assert.equal(ooo[0].action, 'follow-up');
  // A Bounced lead is final: never a candidate again.
  assert.deepEqual(fu.candidateRows([row({ Status: 'Bounced' })]), []);
});

test('Gmail search or thread errors stop the run instead of being read as "no replies"', () => {
  const plan = steps.stepPlanThreadChecks([row()], [{ error: 'The service is currently unavailable. (item 0)' }]);
  assert.equal(plan[0].stop, true);
  assert.equal(plan[0].fatal, true);
  assert.match(plan[0].title, /Gmail search failed/);
  assert.equal(decide([row()], [sent('info@smiledental.test', '2026-10-02')], [{ error: 'Not Found (item 0)' }])[0].fatal, true);
  assert.equal(decide([row()], [], [plan[0]])[0].title, 'Gmail search failed'); // the planned stop passes through
});

test('duplicate rows: one action per Place ID (the first row, which n8n updates) and per address', () => {
  const rows = [row({ 'Place ID': 'ChIJ1' }), row({ 'Place ID': 'ChIJ1', 'Follow-ups': 0, 'Last Draft On': '2026-09-01' }), row({ 'Place ID': 'ChIJ2' })];
  const a = decide(rows, [sent('info@smiledental.test', '2026-10-02')]);
  assert.equal(a.length, 1);
  assert.equal(a[0].row, rows[0]);
  // The next day, with the first row updated, nothing is drafted again (no endless daily follow-ups).
  const after = [Object.assign({}, rows[0], a[0].update), rows[1], rows[2]];
  assert.equal(decide(after, [sent('info@smiledental.test', '2026-10-02')])[0].title, 'Nothing to do today');
});

test('an opt-out on any row with the same address suppresses every row with it', () => {
  const rows = [row({ 'Place ID': 'old', Status: 'Do not contact' }), row({ 'Place ID': 'new', Status: 'Contacted', 'Last Contacted': '2026-10-01' })];
  assert.deepEqual(decide(rows, [sent('info@smiledental.test', '2026-10-01')]), [{ stop: true, fatal: false, title: 'Nothing to do today', message: 'No follow-ups are due and no statuses changed.' }]);
  assert.deepEqual(fu.buildGmailQueries(rows), []);
  // A row never pitched (the duplicate the Client Finder skipped) is not a follow-up candidate.
  assert.deepEqual(fu.candidateRows([row({ Status: 'New', 'Email Subject': '', 'Last Contacted': '' })]), []);
});

test('dates: day-first, dotted, impossible and future dates; the sheet date is never rewritten from itself', () => {
  assert.equal(util.isoDate(util.parseDate('25/09/2026')), '2026-09-25');
  assert.equal(util.isoDate(util.parseDate('06.10.2026')), '2026-10-06');
  assert.equal(util.parseDate('31/02/2026'), null);
  assert.equal(util.parseDate('13/13/2026'), null);
  assert.equal(util.isoDate(util.parseDate(46301)), '2026-10-06'); // a Sheets serial number (Read Leads asks for SERIAL_NUMBER)
  // A typo far in the future is ignored, so the lead still gets its follow-up.
  const typo = decide([row({ Status: 'Contacted', 'Last Contacted': '25/09/2028' })], [sent('info@smiledental.test', '2026-10-02')]);
  assert.equal(typo[0].action, 'follow-up');
  assert.equal(typo[0].update['Last Contacted'], '2026-10-02');
  // A hand-typed date in another format is not "reformatted" by the workflow.
  assert.equal(decide([row({ Status: 'Contacted', 'Last Contacted': '10/18/2026', 'Last Draft On': '' })], [])[0].title, 'Nothing to do today');
  const due = decide([row({ Status: 'Contacted', 'Last Contacted': '10/1/2026', 'Last Draft On': '' })], []);
  assert.equal(due[0].action, 'follow-up');
  assert.equal('Last Contacted' in due[0].update, false);
});

test('follow-up draft failures add a dated note and keep the buyer\'s notes (replacing yesterday\'s failure note)', () => {
  const action = { row: row({ Notes: "2026-10-19 follow-up draft failed: 404 | Owner is Dr. Patel - call Tue" }), update: { 'Place ID': 'p', Status: 'Follow-up drafted' } };
  const u = steps.stepReadFollowUpDraft(action, { error: { message: 'Requested entity was not found.' } }, fNow);
  assert.deepEqual(u, { 'Place ID': 'p', Notes: '2026-10-20 follow-up draft failed: Requested entity was not found. | Owner is Dr. Patel - call Tue' });
  const report = steps.stepFollowUpReport([u, { 'Place ID': 'q', Status: 'Bounced' }, { 'Place ID': 'r', Status: 'Follow-up drafted' }]);
  assert.equal(report.summary, '1 follow-up draft created, 0 leads marked Replied, 1 lead marked Bounced, 0 leads marked Contacted, 1 draft failed (see the Notes column).');
});
