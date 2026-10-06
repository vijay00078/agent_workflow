// Runs the whole Client Finder pipeline (every step the workflow runs) on the fixture businesses,
// with simulated API responses. The real-n8n version of this test is tests/e2e/run.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const steps = require('../../src/lib/steps');
const { defaultSettings } = require('../../src/workflows/client-finder');
const packs = require('../../src/niches');
const fx = require('../fixtures/businesses');

const NOW = new Date('2026-10-06T09:00:00Z');
const webPack = packs.find((p) => p.id === 'web-design');

function form(over) {
  return Object.assign({ 'Business type': 'dentists', 'City or area': 'Austin, TX', 'How many businesses?': '40', submittedAt: NOW.toISOString(), formMode: 'production' }, over);
}

function settings(over) {
  return Object.assign(defaultSettings(webPack), {
    yourName: 'Asha Rao',
    yourBusinessName: 'Pixel & Pine Studio',
    googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=0',
  }, over);
}

function fakeClaude(lead) {
  return {
    model: 'claude-opus-5-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ subject: `${lead.problems[0].label} at ${lead.name}`, email_body: `Hi team,\n\n${lead.problems[0].evidence}`, dm_message: 'dm', call_opener: 'call' }) }],
  };
}

function runPipeline({ input, savedRows = [], aiFailsFor = [], draftFailsFor = [] }) {
  const job = steps.stepPrepareJob(input, webPack, { requireSheet: true, now: NOW });
  if (job.stop) return { job };
  let leads = steps.stepCleanLeads(fx.placesPages(), job);
  leads = steps.stepSkipSaved(leads, savedRows, job);
  if (leads[0] && leads[0].stop) return { job, stopItem: leads[0] };
  const checked = leads.map((lead) => {
    if (!lead.website) return lead;
    const b = fx.BUSINESSES.find((x) => x.place.id === lead.placeId);
    let resp;
    if (b.unresolvable) resp = { error: { message: 'getaddrinfo ENOTFOUND maple-dental-expired.test' } };
    else if (b.badCert) resp = { error: { message: "Hostname/IP does not match certificate's altnames" } };
    else if (b.status) resp = { statusCode: b.status, html: '' };
    else resp = { statusCode: 200, html: b.html };
    let l = steps.stepCheckWebsite(lead, resp);
    if (l.site.status === 'ok') l = steps.stepReadPageSpeed(l, b.psi && b.psi.error ? { error: { message: '500' } } : fx.psiResponse(b));
    return l;
  });
  const scored = steps.stepScoreLeads(checked, job, NOW);
  const withPitches = scored.map((lead) => {
    if (!lead.wantsPitch) return lead;
    const req = steps.stepBuildPitchRequest(lead, job);
    const resp = aiFailsFor.includes(lead.placeId) ? { error: { message: '500 - overloaded' } } : fakeClaude(req);
    return steps.stepReadPitch(req, resp, job);
  });
  const drafted = withPitches.map((lead) => {
    if (!steps.wantsDraft(lead, job)) return lead;
    const resp = draftFailsFor.includes(lead.placeId) ? { error: { message: 'Gmail quota' } } : { id: `r-${lead.placeId}`, message: { id: 'm', threadId: `t-${lead.placeId}` } };
    return steps.stepReadDraft(lead, resp);
  });
  const rows = steps.stepSheetRows(drafted, job, NOW);
  return { job, rows, summary: steps.stepSummary(rows, job) };
}

test('happy path: 13 businesses, correct ranking, pitches, drafts and summary', () => {
  const bright = 'ChIJbright0003';
  const { rows, summary } = runPipeline({ input: Object.assign(form(), settings()), aiFailsFor: [bright], draftFailsFor: [bright] });
  assert.equal(rows.length, 13);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].Score >= rows[i].Score, 'sorted by score');
  const byId = Object.fromEntries(rows.map((r) => [r['Place ID'], r]));
  const lakeside = byId.ChIJlakeside0002;
  assert.equal(lakeside.Problems, 'No website');
  assert.equal(lakeside.Status, 'Pitch ready'); // pitched but no email → call or DM
  assert.ok(lakeside['DM Message']);
  const sunrise = byId.ChIJsunrise0001;
  assert.equal(sunrise.Status, 'Draft ready');
  assert.equal(sunrise['Draft ID'], 'r-ChIJsunrise0001');
  assert.equal(sunrise['Thread ID'], 't-ChIJsunrise0001');
  assert.equal(sunrise.Email, 'info@sunrise-dental.test');
  assert.match(sunrise['Email Body'], /Thanks,\nAsha Rao\nPixel & Pine Studio/);
  assert.match(sunrise['Email Body'], /no thanks/);
  assert.match(sunrise['AI Status'], /Written by claude-opus-5-5/);
  const brightRow = byId[bright];
  assert.match(brightRow['AI Status'], /Template used/);
  assert.equal(brightRow['Email Subject'], 'quick question about Bright Smile Studio');
  assert.match(brightRow.Notes, /Gmail draft failed: Gmail quota/);
  assert.equal(brightRow.Status, 'Pitch ready');
  const elmRow = byId.ChIJelm0011;
  assert.equal(elmRow['AI Status'], 'Skipped (score below 20)');
  const downtown = byId.ChIJdowntown0004;
  assert.equal(downtown.Score, 0);
  assert.equal(downtown['Email Subject'], '');
  assert.equal(downtown['AI Status'], 'Skipped (no problems found)');
  assert.equal(downtown.Status, 'New');
  assert.equal(summary.total, 13);
  assert.equal(summary.drafts, 1); // only Sunrise has an email AND a pitch (Bright Smile's draft fails)
  assert.equal(summary.pitched, 7);
  assert.match(summary.message, /1 Gmail draft ready/);
  assert.match(summary.title, /13 new leads/);
});

test('stop: placeholder name, missing sheet URL, missing form fields', () => {
  const s1 = steps.stepPrepareJob(Object.assign(form(), settings({ yourName: 'Your Name' })), webPack, { requireSheet: true });
  assert.equal(s1.stop, true);
  assert.match(s1.message, /yourName/);
  const s2 = steps.stepPrepareJob(Object.assign(form(), settings({ googleSheetUrl: 'PASTE_YOUR_GOOGLE_SHEET_URL_HERE' })), webPack, { requireSheet: true });
  assert.match(s2.message, /googleSheetUrl/);
  const s3 = steps.stepPrepareJob(Object.assign(form({ 'City or area': '' }), settings()), webPack, { requireSheet: true });
  assert.equal(s3.title, 'Missing search details');
  const lite = steps.stepPrepareJob(form(), null, { requireSheet: false });
  assert.equal(lite.stop, false);
  assert.equal(lite.nicheTitle, 'Lite');
});

test('stop: everything already saved, sheet error, Google error passes through', () => {
  const job = steps.stepPrepareJob(Object.assign(form(), settings()), webPack, { requireSheet: true });
  const leads = steps.stepCleanLeads(fx.placesPages(), job);
  const saved = leads.map((l) => ({ 'Place ID': l.placeId, row_number: 2 }));
  const all = steps.stepSkipSaved(leads, saved, job);
  assert.equal(all[0].title, 'Nothing new this time');
  const partial = steps.stepSkipSaved(leads, saved.slice(0, 3), job);
  assert.equal(partial.length, leads.length - 3);
  const err = steps.stepSkipSaved(leads, [{ error: { message: 'Requested entity was not found.' } }], job);
  assert.match(err[0].title, /Google Sheet/);
  const googleStop = steps.stepCleanLeads([{ error: { code: 400, message: 'API key not valid.' } }], job);
  assert.equal(googleStop[0].stop, true);
  assert.equal(steps.stepSkipSaved(googleStop, [{ error: { message: 'x' } }], job)[0].title, 'Google Maps search failed');
  const none = steps.stepCleanLeads([{}], job);
  assert.equal(none[0].title, 'No businesses found');
  assert.deepEqual(steps.stepSkipSaved(leads, [{}], job).length, leads.length); // empty sheet
});

test('min score setting controls who gets an AI pitch', () => {
  const { rows } = runPipeline({ input: Object.assign(form(), settings({ minScoreToPitch: 45 })) });
  for (const r of rows) {
    if (r.Score >= 45) assert.ok(r['Email Subject'], `${r.Business} should be pitched`);
    else assert.equal(r['Email Subject'], '', `${r.Business} should not be pitched`);
  }
});

test('drafts can be turned off', () => {
  const { rows, summary } = runPipeline({ input: Object.assign(form(), settings({ createGmailDrafts: false })) });
  assert.ok(rows.every((r) => !r['Draft ID']));
  assert.ok(rows.filter((r) => r['Email Subject']).every((r) => r.Status === 'Pitch ready'));
  assert.match(summary.message, /turned off/);
});

test('Lite rows: no-website businesses first', () => {
  const job = steps.stepPrepareJob(form(), null, { requireSheet: false });
  const rows = steps.stepLiteRows(steps.stepCleanLeads(fx.placesPages(), job), job);
  assert.equal(rows.length, 13);
  assert.equal(rows[0].Business, 'Lakeside Dental Care');
  assert.equal(rows[0]['Has Website'], 'NO');
  assert.equal(rows[0].Opportunity, 'No website: pitch a website');
  assert.equal(rows[1]['Has Website'], 'Yes');
  assert.deepEqual(Object.keys(rows[0]), ['Business', 'Has Website', 'Opportunity', 'Phone', 'Website', 'Category', 'Rating', 'Reviews', 'Address', 'Google Maps', 'Search']);
});

test('follow-up pipeline: plan → decide → request → read → updates → report', () => {
  const s = Object.assign(settings(), { followUpDays: '3,7', maxFollowUps: 2 });
  const job = steps.stepPrepareFollowUpJob(s, packs);
  assert.equal(job.stop, false);
  const rows = [
    { row_number: 2, 'Place ID': 'a', Business: 'A Dental', Email: 'a@a.test', Status: 'Draft ready', 'Follow-ups': 0, 'Last Draft On': '2026-09-20', 'Thread ID': 't-a', 'Email Subject': 'Your site', 'Email Body': 'Hi', 'Top Problem': 'Slow on mobile', Evidence: '1. x', Niche: 'Local SEO' },
    { row_number: 3, 'Place ID': 'b', Business: 'B Dental', Email: 'b@b.test', Status: 'Draft ready', 'Follow-ups': 0, 'Last Draft On': '2026-09-20', 'Thread ID': 't-b', 'Email Subject': 'Hello', Niche: 'Web Design' },
    { row_number: 4, 'Place ID': 'c', Business: 'C Dental', Email: '', Status: 'Pitch ready' },
  ];
  const queries = steps.stepPlanGmailSearches(rows, job.settings);
  assert.equal(queries.length, 2);
  const ms = (iso) => String(new Date(iso).getTime());
  const messages = [
    { id: '1', threadId: 't-a', internalDate: ms('2026-09-21T10:00:00Z'), From: 'me@x.test', To: 'a@a.test', labels: [{ id: 'SENT', name: 'SENT' }] },
    { id: '2', threadId: 't-b', internalDate: ms('2026-09-21T10:00:00Z'), From: 'me@x.test', To: 'B Dental <b@b.test>', labels: [{ id: 'SENT', name: 'SENT' }] },
    { id: '3', threadId: 't-b', internalDate: ms('2026-09-22T10:00:00Z'), From: 'Bob <b@b.test>', To: 'me@x.test', labels: [{ id: 'INBOX', name: 'INBOX' }] },
  ];
  const actions = steps.stepDecideFollowUps(rows, messages, job.settings, new Date('2026-10-06T09:00:00Z'));
  assert.deepEqual(actions.map((a) => [a.update['Place ID'], a.action]), [['a', 'follow-up'], ['b', 'replied']]);
  const req = steps.stepBuildFollowUpRequest(actions[0], job);
  assert.match(req.aiRequest.body.system, /local SEO/i); // the lead's own niche angle
  const read = steps.stepReadFollowUp(req, { model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"email_body":"Quick nudge."}' }] }, job);
  assert.equal(read.followUp.subject, 'Re: Your site');
  assert.match(read.followUp.body, /^Quick nudge\.\n\nThanks,\nAsha Rao/);
  const upd = steps.stepReadFollowUpDraft(read, { id: 'r-2', message: { threadId: 't-a' } });
  assert.equal(upd['Follow-ups'], 1);
  const failed = steps.stepReadFollowUpDraft(read, { error: { message: 'Bad thread' } });
  assert.deepEqual(Object.keys(failed), ['Place ID', 'Notes']);
  const updates = steps.stepSheetUpdates([upd, actions[1], { stop: true }]);
  assert.equal(updates.length, 2);
  const report = steps.stepFollowUpReport(updates.concat([failed]));
  assert.equal(report.followUpsDrafted, 1);
  assert.equal(report.markedReplied, 1);
  assert.equal(report.draftsFailed, 1);
  const nothing = steps.stepDecideFollowUps(rows.slice(2), [], job.settings, new Date());
  assert.equal(nothing[0].stop, true);
  assert.equal(nothing[0].fatal, false);
  assert.equal(steps.stepPrepareFollowUpJob(Object.assign({}, s, { googleSheetUrl: 'x' }), packs).fatal, true);
  assert.equal(steps.stepPlanGmailSearches([{ error: { message: 'no access' } }], job.settings)[0].fatal, true);
});
