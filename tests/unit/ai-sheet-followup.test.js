const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../../src/lib/ai');
const sheet = require('../../src/lib/sheet');
const fu = require('../../src/lib/followup');
const packs = require('../../src/niches');

const webPack = packs.find((p) => p.id === 'web-design');
const settings = {
  yourName: 'Asha Rao',
  yourBusinessName: 'Pixel & Pine Studio',
  yourWebsite: 'pixelpine.test',
  yourService: 'website design',
  yourOffer: 'a free 2-minute video audit',
  emailLanguage: 'English',
  emailTone: 'friendly',
  maxEmailWords: 110,
  optOutLine: 'P.S. Not relevant? Reply "no thanks".',
  aiModel: 'claude-opus-5-5',
  aiEffort: 'low',
};
const lead = {
  placeId: 'p1',
  name: 'Sunrise Family Dental, PLLC',
  category: 'Dentist',
  address: '1200 S Congress Ave, Austin, TX',
  rating: 4.6,
  reviewCount: 212,
  website: 'https://sunrise-dental.test/',
  email: 'info@sunrise-dental.test',
  phone: '(512) 555-0101',
  mapsUrl: 'https://maps.google.com/?cid=1',
  score: 50,
  priority: 'Warm',
  problems: [
    { id: 'slow_mobile', label: 'Slow on mobile', evidence: 'Google PageSpeed scores the mobile site 23/100; the main content takes 9.8 s to appear on a phone.', points: 30 },
    { id: 'outdated_site', label: 'Outdated website', evidence: 'The website footer still says © 2019.', points: 20 },
  ],
};

function claudeResponse(json, extra = {}) {
  return Object.assign(
    {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [
        { type: 'thinking', thinking: '', signature: 'x' },
        { type: 'text', text: typeof json === 'string' ? json : JSON.stringify(json) },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 900, output_tokens: 200 },
    },
    extra,
  );
}

test('pitch request for the default model uses structured outputs, effort and refusal fallbacks', () => {
  const { body, headers } = ai.buildPitchRequest(lead, settings, webPack);
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.max_tokens, 4000); // small at low effort: max_tokens counts against new accounts' output-tokens-per-minute limit
  assert.equal(body.fallbacks, 'default');
  assert.equal(headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(headers['anthropic-version'], '2023-06-01');
  assert.equal(body.output_config.effort, 'low');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.deepEqual(body.output_config.format.schema.required, ['subject', 'email_body', 'dm_message', 'call_opener']);
  assert.equal(body.output_config.format.schema.additionalProperties, false);
  assert.equal(body.thinking, undefined);
  assert.equal(body.messages.length, 1);
  assert.match(body.messages[0].content, /23\/100/);
  assert.match(body.messages[0].content, /Short name to use: Sunrise Family Dental/);
  assert.match(body.messages[0].content, /Offer: a free 2-minute video audit/);
  assert.match(body.system, /Never invent numbers/);
  assert.match(body.system, /at most 110 words/);
  assert.match(body.system, new RegExp(webPack.pitchAngle.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(JSON.stringify(body), /x-api-key|sk-ant/);
});

test('request shape adapts to the model', () => {
  const haiku = ai.buildPitchRequest(lead, Object.assign({}, settings, { aiModel: 'claude-haiku-4-5' }), webPack);
  assert.equal(haiku.body.output_config.effort, undefined);
  assert.equal(haiku.body.output_config.format.type, 'json_schema');
  assert.equal(haiku.body.fallbacks, undefined);
  assert.equal(haiku.headers['anthropic-beta'], undefined);
  const unknown = ai.buildPitchRequest(lead, Object.assign({}, settings, { aiModel: 'claude-some-future-model' }), webPack);
  assert.equal(unknown.body.output_config, undefined);
  assert.match(unknown.body.messages[0].content, /Reply with only a JSON object/);
  const sonnet = ai.buildPitchRequest(lead, Object.assign({}, settings, { aiModel: 'claude-sonnet-5-5', aiEffort: 'MEDIUM' }), webPack);
  assert.equal(sonnet.body.output_config.effort, 'medium');
  assert.equal(sonnet.body.fallbacks, 'default');
  const badEffort = ai.buildPitchRequest(lead, Object.assign({}, settings, { aiEffort: 'turbo' }), webPack);
  assert.equal(badEffort.body.output_config.effort, 'low');
  const defaults = ai.buildPitchRequest(lead, {}, webPack);
  assert.equal(defaults.body.model, ai.DEFAULT_MODEL);
  assert.equal(sonnet.body.max_tokens, 8000); // more room for thinking at higher effort
  assert.equal(ai.buildPitchRequest(lead, Object.assign({}, settings, { aiEffort: 'max' }), webPack).body.max_tokens, 32000);
  assert.equal(ai.buildFollowUpRequest({ Business: 'B' }, settings, webPack, 1).body.max_tokens, 2000);
});

test('parsePitchResponse: structured JSON, fenced JSON, prose around JSON', () => {
  const good = { subject: 'Your site on phones', email_body: 'Hi Sunrise Family Dental team,\n\nBody.', dm_message: 'DM', call_opener: 'Hi!' };
  const a = ai.parsePitchResponse(claudeResponse(good));
  assert.equal(a.ok, true);
  assert.equal(a.pitch.subject, 'Your site on phones');
  assert.equal(a.model, 'claude-opus-5-5');
  const b = ai.parsePitchResponse(claudeResponse('```json\n' + JSON.stringify(good) + '\n```'));
  assert.equal(b.ok, true);
  const c = ai.parsePitchResponse(claudeResponse('Here you go: ' + JSON.stringify(good) + ' Thanks!'));
  assert.equal(c.ok, true);
  const d = ai.parsePitchResponse(claudeResponse(Object.assign({}, good, { subject: 'Subject: Hello [Your Name]' })));
  assert.equal(d.pitch.subject, 'Hello');
});

test('parsePitchResponse: every failure mode becomes a clear error', () => {
  assert.match(ai.parsePitchResponse({ error: { message: '401 - invalid x-api-key' } }).error, /Anthropic API Key/);
  assert.match(ai.parsePitchResponse({ error: { message: 'Your credit balance is too low' } }).error, /credits/);
  assert.match(ai.parsePitchResponse({ error: { message: '429 rate_limit_error' } }).error, /batch size/);
  const n8n429 = ai.parsePitchResponse({ error: { message: "Try spacing your requests out using the batching settings under 'Options'", name: 'AxiosError', code: 'ERR_BAD_REQUEST', status: 429 } });
  assert.match(n8n429.error, /^429 /);
  assert.equal(n8n429.retryable, true);
  const n8n529 = ai.parsePitchResponse({ error: { message: '529 - "{\\"type\\":\\"error\\",\\"error\\":{\\"type\\":\\"overloaded_error\\",\\"message\\":\\"Overloaded\\"}}"', status: 529 } });
  assert.equal(n8n529.retryable, true);
  assert.match(n8n529.error, /Overloaded/);
  const n8n401 = ai.parsePitchResponse({ error: { message: '401 - "{\\"type\\":\\"error\\",\\"error\\":{\\"type\\":\\"authentication_error\\",\\"message\\":\\"invalid x-api-key\\"}}"', status: 401 } });
  assert.equal(n8n401.retryable, false);
  assert.match(n8n401.error, /Anthropic API Key/);
  assert.match(ai.parsePitchResponse({ error: { message: '404 model: claude-x not found' } }).error, /model name/);
  assert.match(ai.parsePitchResponse({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }).error, /Overloaded/);
  assert.match(ai.parsePitchResponse(claudeResponse('', { stop_reason: 'refusal', content: [] })).error, /declined/);
  assert.match(ai.parsePitchResponse(claudeResponse('{"subject": "cut', { stop_reason: 'max_tokens' })).error, /cut off/);
  assert.match(ai.parsePitchResponse(claudeResponse('no json here')).error, /not valid JSON/);
  assert.match(ai.parsePitchResponse(claudeResponse({ subject: '', email_body: 'x', dm_message: '', call_opener: '' })).error, /missing/);
});

test('fallback pitch and final email body', () => {
  const p = ai.fallbackPitch(lead, settings, webPack);
  assert.equal(p.subject, 'quick question about Sunrise Family Dental');
  assert.match(p.body, /^Hi Sunrise Family Dental team,/);
  assert.match(p.body, /one thing stood out: Google PageSpeed scores the mobile site 23\/100/); // "Google" keeps its capital
  assert.match(p.callOpener, /\(slow on mobile\)/);
  assert.match(p.body, /a free 2-minute video audit/);
  assert.ok(p.dm.length <= 300);
  const full = ai.finalEmailBody('Body text.', settings);
  assert.equal(full, 'Body text.\n\nThanks,\nAsha Rao\nPixel & Pine Studio\npixelpine.test\n\nP.S. Not relevant? Reply "no thanks".');
  assert.equal(ai.finalEmailBody('Body', {}), 'Body\n\nThanks');
  assert.equal(ai.finalEmailBody('Body', Object.assign({}, settings, { signOff: 'Best regards,', optOutLine: '' })), 'Body\n\nBest regards,\nAsha Rao\nPixel & Pine Studio\npixelpine.test');
  assert.match(ai.finalEmailBody('Body', Object.assign({}, settings, { yourAddress: '12 Main St, Austin, TX 78701' })), /pixelpine\.test\n12 Main St, Austin, TX 78701\n\nP\.S\./);
  const none = ai.fallbackPitch(Object.assign({}, lead, { problems: [] }), {}, webPack);
  assert.match(none.body, /a few quick wins/);
});

test('follow-up request and parsing', () => {
  const row = { Business: 'Sunrise Family Dental', 'Top Problem': 'Slow on mobile', Evidence: '1. PageSpeed 23/100\n2. other', 'Email Subject': 'Your site on phones', 'Email Body': 'Hi...' };
  const r1 = ai.buildFollowUpRequest(row, settings, webPack, 1);
  assert.match(r1.body.system, /first follow-up/);
  assert.equal(r1.body.output_config.format.schema.required[0], 'email_body');
  assert.match(r1.body.messages[0].content, /Evidence: 1\. PageSpeed 23\/100$/m);
  const r2 = ai.buildFollowUpRequest(row, settings, webPack, 2);
  assert.match(r2.body.system, /final/);
  assert.equal(ai.parseFollowUpResponse(claudeResponse({ email_body: 'Short note.' })).body, 'Short note.');
  assert.equal(ai.parseFollowUpResponse({ error: { message: 'boom' } }).ok, false);
  assert.match(ai.fallbackFollowUp(row, settings, webPack, 1), /Quick follow-up/);
  assert.match(ai.fallbackFollowUp(row, settings, webPack, 2), /last note/);
});

test('toSheetRow produces exactly the sheet columns', () => {
  const pitched = Object.assign({}, lead, { pitch: { subject: 'S', body: 'B', fullBody: 'B\n\nThanks', dm: 'D', callOpener: 'C' }, aiStatus: 'Written by claude-opus-5-5' });
  const row = sheet.toSheetRow(pitched, { niche: 'Web Design', search: 'dentists in Austin, TX', now: new Date('2026-10-06T10:00:00Z'), draftsEnabled: true });
  assert.deepEqual(Object.keys(row), sheet.LEAD_COLUMNS);
  assert.equal(row.Status, 'Draft ready');
  assert.equal(row['Email Body'], 'B\n\nThanks');
  assert.equal(row.Problems, 'Slow on mobile, Outdated website');
  assert.equal(row['Top Problem'], 'Slow on mobile');
  assert.equal(row.Evidence.split('\n').length, 2);
  assert.equal(row['Found On'], '2026-10-06');
  assert.equal(row['Last Draft On'], '2026-10-06');
  assert.equal(sheet.toSheetRow(pitched, { draftsEnabled: false }).Status, 'Pitch ready');
  const noPitch = sheet.toSheetRow(Object.assign({}, lead, { website: '' }), {});
  assert.equal(noPitch.Status, 'New');
  assert.equal(noPitch['Email Subject'], '');
  assert.match(noPitch.Notes, /No website/);
  assert.deepEqual([...sheet.existingPlaceIds([{ 'Place ID': 'a' }, { 'Place ID': '' }, {}, null])], ['a']);
});

// ---- follow-ups ----

const NOW = new Date('2026-10-20T09:00:00Z');
const day = (iso) => new Date(iso + 'T10:00:00Z');
const baseRow = (over) => Object.assign({ 'Place ID': 'p', Business: 'Biz', Email: 'owner@biz.test', Status: 'Draft ready', 'Follow-ups': 0, 'Last Draft On': '2026-10-01', 'Last Contacted': '', 'Thread ID': 't-1', 'Email Subject': 'Your site' }, over);
const sentMsg = (to, iso, threadId = 't-1') => ({ id: 'm' + Math.random(), threadId, internalDate: String(day(iso).getTime()), From: 'Asha <asha@pixelpine.test>', To: to, labels: [{ id: 'SENT', name: 'SENT' }] });
const replyMsg = (from, iso) => ({ id: 'r' + Math.random(), threadId: 't-1', internalDate: String(day(iso).getTime()), From: `Owner <${from}>`, To: 'asha@pixelpine.test', labels: [{ id: 'INBOX', name: 'INBOX' }] });

function decide(rows, messages, s = { followUpDays: '3,7', maxFollowUps: 2 }) {
  const emails = fu.candidateRows(rows).map((r) => fu.emailsIn(r.Email)[0]);
  return fu.decideFollowUps(rows, fu.indexGmail(messages, emails), s, NOW);
}

test('Gmail queries cover every pitched address and skip finished leads', () => {
  const rows = [baseRow({ Email: 'A@x.test' }), baseRow({ 'Place ID': 'q', Email: 'b@y.test' }), baseRow({ 'Place ID': 'r', Email: 'c@z.test', Status: 'Replied' }), baseRow({ 'Place ID': 's', Email: '' })];
  const qs = fu.buildGmailQueries(rows);
  assert.deepEqual(qs, [
    { kind: 'sent', q: 'in:sent newer_than:120d {to:a@x.test to:b@y.test}' },
    { kind: 'reply', q: 'in:anywhere -in:sent -in:drafts newer_than:120d {from:a@x.test from:b@y.test}' },
  ]);
  const many = Array.from({ length: 30 }, (_, i) => baseRow({ 'Place ID': 'p' + i, Email: `o${i}@b.test` }));
  assert.equal(fu.buildGmailQueries(many).length, 4);
  assert.deepEqual(fu.parseFollowUpDays('2, 5;9'), [2, 5, 9]);
  assert.deepEqual(fu.parseFollowUpDays(''), [3, 7]);
});

test('reply detected → Replied, never followed up', () => {
  const a = decide([baseRow()], [sentMsg('owner@biz.test', '2026-10-02'), replyMsg('owner@biz.test', '2026-10-03')]);
  assert.equal(a.length, 1);
  assert.equal(a[0].action, 'replied');
  assert.equal(a[0].update.Status, 'Replied');
  assert.equal(a[0].update['Last Contacted'], '2026-10-02');
});

test('draft never sent → no action', () => {
  assert.deepEqual(decide([baseRow()], []), []);
});

test('sent 18 days ago, no reply → first follow-up in the same thread', () => {
  const a = decide([baseRow()], [sentMsg('owner@biz.test', '2026-10-02', 't-9')]);
  assert.equal(a[0].action, 'follow-up');
  assert.equal(a[0].followUpNumber, 1);
  assert.equal(a[0].threadId, 't-9'); // the thread of the email actually sent wins
  assert.equal(a[0].update['Follow-ups'], 1);
  assert.equal(a[0].update.Status, 'Follow-up drafted');
  assert.equal(a[0].update['Last Draft On'], '2026-10-20');
  const sheetOnly = decide([baseRow({ Status: 'Contacted', 'Last Contacted': '2026-10-02' })], []);
  assert.equal(sheetOnly[0].threadId, ''); // a hand-entered date has no Gmail thread to reply in: a new thread
  assert.equal(sheetOnly[0].update['Thread ID'], 't-1'); // the sheet's own value is left as it was
});

test('sent 2 days ago → not due yet, but status becomes Contacted', () => {
  const a = decide([baseRow({ 'Last Draft On': '2026-10-17' })], [sentMsg('owner@biz.test', '2026-10-18')]);
  assert.equal(a[0].action, 'contacted');
  assert.equal(a[0].update.Status, 'Contacted');
  assert.equal(a[0].update['Last Contacted'], '2026-10-18');
});

test('follow-up drafted but not sent yet → wait (no duplicate drafts)', () => {
  const rows = [baseRow({ Status: 'Follow-up drafted', 'Follow-ups': 1, 'Last Draft On': '2026-10-10', 'Last Contacted': '2026-10-02' })];
  assert.deepEqual(decide(rows, [sentMsg('owner@biz.test', '2026-10-02')]), []);
});

test('second follow-up after the gap, then stop at the maximum', () => {
  const rows = [baseRow({ Status: 'Contacted', 'Follow-ups': 1, 'Last Draft On': '2026-10-05', 'Last Contacted': '2026-10-05' })];
  const a = decide(rows, [sentMsg('owner@biz.test', '2026-10-02'), sentMsg('owner@biz.test', '2026-10-05')]);
  assert.equal(a[0].action, 'follow-up');
  assert.equal(a[0].followUpNumber, 2);
  const done = [baseRow({ Status: 'Contacted', 'Follow-ups': 2, 'Last Draft On': '2026-10-09', 'Last Contacted': '2026-10-09' })];
  assert.deepEqual(decide(done, [sentMsg('owner@biz.test', '2026-10-09')]), []);
  // maxFollowUps reached and the status/date are already right → nothing to change.
  assert.deepEqual(decide(rows, [sentMsg('owner@biz.test', '2026-10-05')], { followUpDays: '3', maxFollowUps: 1 }), []);
});

test('replies that came before our first email do not count', () => {
  const a = decide([baseRow()], [replyMsg('owner@biz.test', '2026-09-01'), sentMsg('owner@biz.test', '2026-10-02')]);
  assert.equal(a[0].action, 'follow-up');
});

test('manually logged "Last Contacted" works without Gmail data', () => {
  const a = decide([baseRow({ Status: 'Contacted', 'Last Contacted': '10/1/2026', 'Last Draft On': '' })], []);
  assert.equal(a[0].action, 'follow-up');
});

test('followUpSubject threads with Re:', () => {
  assert.equal(fu.followUpSubject({ 'Email Subject': 'Your site' }), 'Re: Your site');
  assert.equal(fu.followUpSubject({ 'Email Subject': 'RE: Your site' }), 'RE: Your site');
  assert.match(fu.followUpSubject({ Business: 'Biz' }), /Biz/);
  assert.equal(fu.isSentMessage({ labels: [{ id: 'SENT' }] }), true);
  assert.equal(fu.isSentMessage({ labelIds: ['INBOX'] }), false);
});
