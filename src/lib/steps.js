// One function per workflow step. Each n8n Code node is a thin adapter around one of these,
// so the whole pipeline can be unit-tested without n8n (see tests/unit/pipeline.test.js).

// @node-only-start
const { str, int, truthy, plural } = require('./util');
const { buildSearch, normalizePlaces, marketStats, errorSummary } = require('./places');
const { classifyFetch, analyzeHtml } = require('./website');
const { parsePageSpeed, pageSpeedUrl } = require('./pagespeed');
const { detectProblems, scoreProblems, priorityFor, rankLeads } = require('./problems');
const { buildPitchRequest, parsePitchResponse, fallbackPitch, finalEmailBody, buildFollowUpRequest, parseFollowUpResponse, fallbackFollowUp } = require('./ai');
const { toSheetRow, existingPlaceIds } = require('./sheet');
const { buildGmailQueries, indexGmail, decideFollowUps, candidateRows, emailsIn, followUpSubject } = require('./followup');
// @node-only-end

const SETTING_KEYS = [
  'yourName',
  'yourBusinessName',
  'yourWebsite',
  'yourPhone',
  'yourAddress',
  'yourService',
  'yourOffer',
  'emailLanguage',
  'emailTone',
  'maxEmailWords',
  'optOutLine',
  'googleSheetUrl',
  'createGmailDrafts',
  'minScoreToPitch',
  'aiModel',
  'aiEffort',
  'searchLanguage',
  'searchCountryCode',
  'followUpDays',
  'maxFollowUps',
];

function stop(title, message, fatal) {
  return { stop: true, fatal: Boolean(fatal), title, message };
}

function isSheetUrl(url) {
  return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]{20,}/.test(str(url));
}

function pickSettings(input, pack) {
  const s = {};
  for (const k of SETTING_KEYS) if (input[k] !== undefined) s[k] = input[k];
  if (pack) {
    if (!str(s.yourService)) s.yourService = pack.defaultService;
    if (!str(s.yourOffer)) s.yourOffer = pack.defaultOffer;
  }
  return s;
}

// "Prepare Search": validates the form + Settings and builds the job every later step reads.
function stepPrepareJob(input, pack, options) {
  const opts = options || {};
  const now = opts.now || new Date();
  const settings = pickSettings(input || {}, pack);
  if (opts.requireSheet && (!str(settings.yourName) || /^your name$/i.test(str(settings.yourName)))) {
    return stop('One setup step left', 'Open the "⚙️ Settings" node in n8n and replace "Your Name" (yourName) with your real name, plus your business, service and offer. They are used to sign every pitch.');
  }
  if (opts.requireSheet && !isSheetUrl(settings.googleSheetUrl)) {
    return stop(
      'One setup step left',
      'Open the "⚙️ Settings" node in n8n and paste the full URL of your Client Finder Google Sheet into googleSheetUrl (it starts with https://docs.google.com/spreadsheets/d/). Then submit this form again.',
    );
  }
  let search;
  try {
    search = buildSearch(Object.assign({}, input, settings));
  } catch (e) {
    return stop('Missing search details', e.message);
  }
  return {
    stop: false,
    startedAt: now.toISOString(),
    search,
    settings,
    pack: pack || null,
    nicheTitle: pack ? pack.title : 'Lite',
  };
}

// "Clean Leads": flattens the paginated Places responses into one item per business.
function stepCleanLeads(pages, job) {
  let result;
  try {
    result = normalizePlaces(pages, { maxLeads: job.search.maxLeads });
  } catch (e) {
    return [stop('Google Maps search failed', e.message)];
  }
  if (!result.leads.length) {
    return [stop('No businesses found', `Google Maps returned no open businesses for "${job.search.textQuery}". Try a broader area (a city instead of a neighbourhood) or a different business type.`)];
  }
  const market = marketStats(result.leads);
  return result.leads.map((lead) => Object.assign({}, lead, { market }));
}

// "Skip Saved Leads": drops businesses already in the sheet so nobody gets pitched twice.
function stepSkipSaved(leads, savedRows, job) {
  const stopped = (leads || []).find((l) => l && l.stop);
  if (stopped) return [stopped]; // an earlier step already explained what went wrong
  const rows = (savedRows || []).filter((r) => r && Object.keys(r).length);
  const sheetError = rows.find((r) => r.error);
  if (sheetError) {
    const msg = errorSummary(sheetError.error);
    let hint = 'Check that googleSheetUrl in Settings is correct, the sheet has a tab named "Leads", and the Google Sheets credential belongs to the Google account that owns the sheet.';
    if (/not found|404|Unable to parse range|Leads/i.test(msg)) hint = 'n8n could not find the "Leads" tab. Import the Client Finder CRM template into Google Sheets (it already has the tab and columns) and paste that sheet\'s URL into Settings.';
    return [stop("Couldn't open your Google Sheet", `${msg.slice(0, 200)} — ${hint}`)];
  }
  const leadList = (leads || []).filter((l) => l && !l.stop);
  const saved = existingPlaceIds(rows);
  const fresh = leadList.filter((l) => !saved.has(l.placeId));
  if (!fresh.length) {
    return [stop('Nothing new this time', `All ${plural(leadList.length, 'business', 'businesses')} found for "${job.search.textQuery}" are already in your sheet. Try a nearby area or a related business type.`)];
  }
  return fresh;
}

// "Check Website": reads the homepage fetch result for one lead.
function stepCheckWebsite(lead, fetchResponse) {
  const site = classifyFetch(fetchResponse);
  const analysis = site.status === 'ok' && site.html ? analyzeHtml(site.html, lead.website) : null;
  const email = analysis && analysis.emails.length ? analysis.emails[0] : '';
  const out = Object.assign({}, lead, {
    site: { status: site.status, statusCode: site.statusCode, reachable: site.reachable, detail: site.detail },
    analysis,
    email,
    otherEmails: analysis ? analysis.emails.slice(1, 4) : [],
    pageSpeedUrl: pageSpeedUrl(lead.website),
  });
  return out;
}

function stepReadPageSpeed(lead, psiResponse) {
  return Object.assign({}, lead, { psi: parsePageSpeed(psiResponse) });
}

// "Find Problems & Score": runs the niche pack's checks and ranks every lead.
function stepScoreLeads(leads, job, now) {
  const minScore = Math.max(0, int(job.settings.minScoreToPitch, 20));
  const scored = leads
    .filter((l) => l && !l.stop)
    .map((lead) => {
      const problems = detectProblems({ lead, site: lead.site || null, analysis: lead.analysis || null, psi: lead.psi || null, market: lead.market, now: now || new Date() }, job.pack);
      const score = scoreProblems(problems);
      return Object.assign({}, lead, { problems, score, priority: priorityFor(score), wantsPitch: score > 0 && score >= minScore });
    });
  return rankLeads(scored);
}

function stepBuildPitchRequest(lead, job) {
  const req = buildPitchRequest(lead, job.settings, job.pack);
  return Object.assign({}, lead, { aiRequest: req });
}

// allowRetry: on the first attempt a temporary error (overloaded, rate limit, timeout) sends the lead to the
// retry branch instead of falling back to the template.
function stepReadPitch(lead, response, job, options) {
  const parsed = parsePitchResponse(response);
  if (!parsed.ok && parsed.retryable && options && options.allowRetry) {
    return Object.assign({}, lead, { needsRetry: true, firstAiError: parsed.error });
  }
  const pitch = parsed.ok ? parsed.pitch : fallbackPitch(lead, job.settings, job.pack);
  pitch.fullBody = finalEmailBody(pitch.body, job.settings);
  const out = Object.assign({}, lead, {
    pitch,
    aiStatus: parsed.ok ? `Written by ${parsed.model || job.settings.aiModel || 'Claude'}${lead.firstAiError ? ' (after a retry)' : ''}` : `Template used (AI error: ${parsed.error})`,
    needsRetry: false,
  });
  delete out.aiRequest;
  delete out.firstAiError;
  return out;
}

function wantsDraft(lead, job) {
  return Boolean(lead && lead.email && lead.pitch && lead.pitch.subject && truthy(job.settings.createGmailDrafts));
}

// "Read Draft IDs": stores the Gmail draft + thread id so follow-ups land in the same thread.
function stepReadDraft(lead, draftResponse) {
  const r = draftResponse || {};
  if (r.error || !r.id) {
    const msg = r.error ? errorSummary(r.error) : 'no draft id returned';
    return Object.assign({}, lead, { draftError: msg.slice(0, 200) });
  }
  return Object.assign({}, lead, { draftId: str(r.id), threadId: str(r.message && r.message.threadId) });
}

function stepSheetRows(leads, job, now) {
  const ranked = rankLeads(leads.filter((l) => l && !l.stop));
  return ranked.map((lead) => {
    const drafted = Boolean(lead.draftId);
    const row = toSheetRow(lead, { niche: job.nicheTitle, search: job.search.textQuery, now: now || new Date(), draftsEnabled: drafted });
    if (!lead.pitch) row['AI Status'] = lead.score > 0 ? `Skipped (score below ${int(job.settings.minScoreToPitch, 20)})` : 'Skipped (no problems found)';
    if (drafted) {
      row['Draft ID'] = lead.draftId;
      row['Thread ID'] = lead.threadId || '';
    } else if (lead.draftError) {
      row.Notes = `Gmail draft failed: ${lead.draftError}`;
    }
    if (lead.otherEmails && lead.otherEmails.length) row.Notes = [row.Notes, `Other emails: ${lead.otherEmails.join(', ')}`].filter(Boolean).join(' | ');
    return row;
  });
}

function stepSummary(rows, job) {
  const total = rows.length;
  const hot = rows.filter((r) => r.Priority === 'Hot').length;
  const warm = rows.filter((r) => r.Priority === 'Warm').length;
  const pitched = rows.filter((r) => r['Email Subject']).length;
  const drafts = rows.filter((r) => r['Draft ID']).length;
  const noEmail = rows.filter((r) => r['Email Subject'] && !r.Email).length;
  const lines = [
    `Search: ${job.search.textQuery}`,
    `${plural(total, 'new business', 'new businesses')} saved to your sheet (${hot} hot, ${warm} warm).`,
    `${plural(pitched, 'personalized pitch', 'personalized pitches')} written.`,
    truthy(job.settings.createGmailDrafts) ? `${plural(drafts, 'Gmail draft')} ready in Gmail > Drafts. Read each one before you send it.` : 'Gmail drafts are turned off in Settings.',
  ];
  if (noEmail) lines.push(`${noEmail} pitched ${noEmail === 1 ? 'business has' : 'businesses have'} no public email: use the DM message or call opener in the sheet.`);
  return {
    title: `Done: ${plural(total, 'new lead')} found`,
    message: lines.join('\n'),
    total,
    hot,
    warm,
    pitched,
    drafts,
    sheetUrl: str(job.settings.googleSheetUrl),
  };
}

// --- Lite (free) ---

function stepLiteRows(leads, job) {
  const list = leads.filter((l) => l && !l.stop);
  const ownSite = (l) => Boolean(l.website && !l.websitePlatform);
  const sorted = [...list].sort((a, b) => Number(ownSite(a)) - Number(ownSite(b)) || b.reviewCount - a.reviewCount);
  return sorted.map((l) => ({
    Business: l.name,
    'Has Website': ownSite(l) ? 'Yes' : l.websitePlatform ? `NO (${l.websitePlatform} only)` : 'NO',
    Opportunity: ownSite(l) ? '' : l.websitePlatform ? `Only a ${l.websitePlatform}: pitch a website` : 'No website: pitch a website',
    Phone: l.phone,
    Website: l.website,
    Category: l.category,
    Rating: l.rating === null ? '' : l.rating,
    Reviews: l.reviewCount,
    Address: l.address,
    'Google Maps': l.mapsUrl,
    Search: job.search.textQuery,
  }));
}

// --- Follow-ups (Pro) ---

function stepPrepareFollowUpJob(input, packs) {
  const settings = pickSettings(input || {}, null);
  if (!isSheetUrl(settings.googleSheetUrl)) {
    return stop('Settings needed', 'Open the "⚙️ Settings" node and paste your Client Finder Google Sheet URL into googleSheetUrl.', true);
  }
  if (!str(settings.yourName) || /^your name$/i.test(str(settings.yourName))) {
    return stop('Settings needed', 'Open the "⚙️ Settings" node and replace "Your Name" (yourName) with your real name. It signs every follow-up.', true);
  }
  return { stop: false, settings, packs: packs || [] };
}

// Picks the niche pack a lead was found with (the sheet's "Niche" column), so follow-ups keep the same angle.
function packForRow(row, packs) {
  const niche = str(row && row.Niche).toLowerCase();
  const list = packs || [];
  return list.find((p) => p.title.toLowerCase() === niche || p.id === niche) || list[0];
}

function stepPlanGmailSearches(rows, settings) {
  const valid = (rows || []).filter((r) => r && Object.keys(r).length);
  const sheetError = valid.find((r) => r.error);
  if (sheetError) return [stop("Couldn't read your Google Sheet", errorSummary(sheetError.error), true)];
  if (!isSheetUrl(settings && settings.googleSheetUrl)) return [stop('Settings needed', 'Paste your Client Finder Google Sheet URL into googleSheetUrl in the "⚙️ Settings" node.', true)];
  const queries = buildGmailQueries(valid);
  if (!queries.length) return [stop('Nothing to follow up', 'No leads with an email address are waiting for a reply.')];
  return queries;
}

function stepDecideFollowUps(rows, messages, settings, now) {
  const valid = (rows || []).filter((r) => r && !r.error && Object.keys(r).length);
  const emails = candidateRows(valid).map((r) => emailsIn(r.Email)[0]);
  const index = indexGmail((messages || []).filter((m) => m && !m.error && m.id), emails);
  const actions = decideFollowUps(valid, index, settings, now || new Date());
  if (!actions.length) return [stop('Nothing to do today', 'No follow-ups are due and no statuses changed.')];
  return actions.map((a) => ({
    action: a.action,
    email: a.email,
    threadId: a.threadId || '',
    followUpNumber: a.followUpNumber || 0,
    row: a.row,
    update: a.update,
  }));
}

function stepBuildFollowUpRequest(action, job) {
  const pack = packForRow(action.row, job.packs);
  const settings = pickSettings(job.settings, pack);
  return Object.assign({}, action, { aiRequest: buildFollowUpRequest(action.row, settings, pack, action.followUpNumber) });
}

function stepReadFollowUp(action, response, job) {
  const pack = packForRow(action.row, job.packs);
  const settings = pickSettings(job.settings, pack);
  const parsed = parseFollowUpResponse(response);
  const body = parsed.ok ? parsed.body : fallbackFollowUp(action.row, settings, pack, action.followUpNumber);
  const out = Object.assign({}, action, {
    followUp: { subject: followUpSubject(action.row), body: finalEmailBody(body, Object.assign({}, settings, { optOutLine: '' })) },
    aiStatus: parsed.ok ? 'AI' : `Template (AI error: ${parsed.error})`,
  });
  delete out.aiRequest;
  return out;
}

function stepReadFollowUpDraft(action, draftResponse) {
  const r = draftResponse || {};
  const update = Object.assign({}, action.update);
  if (r.error || !r.id) {
    // Draft failed: don't count it, so tomorrow's run tries again.
    return { 'Place ID': update['Place ID'], Notes: `Follow-up draft failed: ${(r.error ? errorSummary(r.error) : 'no draft id').slice(0, 150)}` };
  }
  if (r.message && r.message.threadId) update['Thread ID'] = str(r.message.threadId);
  return update;
}

function stepSheetUpdates(items) {
  return items
    .filter((x) => x && !x.stop)
    .map((x) => (x.update ? x.update : x))
    .filter((u) => u && str(u['Place ID']));
}

function stepFollowUpReport(updates) {
  const list = (updates || []).filter((u) => u && u['Place ID']);
  const count = (status) => list.filter((u) => u.Status === status).length;
  const failed = list.filter((u) => !u.Status && u.Notes).length;
  return {
    followUpsDrafted: count('Follow-up drafted'),
    markedReplied: count('Replied'),
    markedContacted: count('Contacted'),
    draftsFailed: failed,
    summary: `${count('Follow-up drafted')} follow-up drafts created, ${count('Replied')} leads marked Replied, ${count('Contacted')} marked Contacted${failed ? `, ${failed} drafts failed (see Notes column)` : ''}.`,
  };
}

// @export
module.exports = {
  SETTING_KEYS,
  stop,
  isSheetUrl,
  pickSettings,
  stepPrepareJob,
  stepCleanLeads,
  stepSkipSaved,
  stepCheckWebsite,
  stepReadPageSpeed,
  stepScoreLeads,
  stepBuildPitchRequest,
  stepReadPitch,
  wantsDraft,
  stepReadDraft,
  stepSheetRows,
  stepSummary,
  stepLiteRows,
  stepPrepareFollowUpJob,
  packForRow,
  stepPlanGmailSearches,
  stepDecideFollowUps,
  stepBuildFollowUpRequest,
  stepReadFollowUp,
  stepReadFollowUpDraft,
  stepSheetUpdates,
  stepFollowUpReport,
};
