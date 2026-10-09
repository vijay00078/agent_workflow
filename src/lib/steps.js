// One function per workflow step. Each n8n Code node is a thin adapter around one of these,
// so the whole pipeline can be unit-tested without n8n (see tests/unit/pipeline.test.js).

// @node-only-start
const { str, int, truthy, plural, hostOf, parseUrl, normalizeUrl, resolveUrl, isoDate, shortBusinessName } = require('./util');
const { buildSearch, normalizePlaces, marketStats, errorSummary, errorText, websitePlatform } = require('./places');
const { classifyFetch, analyzeHtml, RECHECK_STATUSES } = require('./website');
const { parsePageSpeed, pageSpeedUrl } = require('./pagespeed');
const { detectProblems, scoreProblems, priorityFor, rankLeads } = require('./problems');
const { buildPitchRequest, parsePitchResponse, fallbackPitch, finalEmailBody, buildFollowUpRequest, parseFollowUpResponse, fallbackFollowUp } = require('./ai');
const { STATUS, toSheetRow, existingPlaceIds } = require('./sheet');
const { buildGmailQueries, indexGmail, threadsToCheck, decideFollowUps, candidateRows, emailsIn, followUpSubject, isFinalStatus, appendNote } = require('./followup');
// @node-only-end

const SETTING_KEYS = [
  'yourName',
  'yourBusinessName',
  'yourWebsite',
  'yourPhone',
  'yourAddress',
  'yourService',
  'yourOffer',
  'signOff',
  'emailLanguage',
  'emailTone',
  'maxEmailWords',
  'optOutLine',
  'followUpOptOutLine',
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

// Every follow-up carries an opt-out too (CAN-SPAM and good manners). An empty setting turns it off on purpose.
const FOLLOW_UP_OPT_OUT = "If you'd rather I didn't follow up, just reply and I'll stop.";

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

// n8n's Google Sheets node with "continue on error" does not output rows when it fails: it outputs its first input
// item (a lead or the job) with an `error` property next to `json`. Turns the node's items into rows or { error }.
function sheetRowsFrom(items) {
  return (items || []).map((item) => {
    const it = item || {};
    const json = it.json || {};
    if (it.error !== undefined && it.error !== null) return { error: Object.keys(it.error).length ? it.error : { message: 'Google Sheets request failed' } };
    if (json.error !== undefined) return { error: json.error };
    if (json['Place ID'] === undefined && (json.placeId !== undefined || json.settings !== undefined || json.search !== undefined)) {
      return { error: { message: 'Google Sheets request failed' } };
    }
    return json;
  });
}

function sheetHint(msg) {
  if (/not found|404|Unable to parse range|Leads/i.test(msg)) {
    return 'n8n could not find the "Leads" tab. Import the Client Finder CRM template into Google Sheets (it already has the tab and columns) and paste that sheet\'s URL into Settings.';
  }
  return 'Check that googleSheetUrl in Settings is correct, the sheet has a tab named "Leads", and the Google Sheets credential belongs to the Google account that owns the sheet.';
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
    const msg = errorSummary(sheetError.error) || 'Google Sheets request failed';
    return [stop("Couldn't open your Google Sheet", `${msg.slice(0, 200)} — ${sheetHint(`${msg} ${errorText(sheetError.error)}`)}`)];
  }
  const leadList = (leads || []).filter((l) => l && !l.stop);
  const saved = existingPlaceIds(rows);
  const fresh = leadList.filter((l) => !saved.has(l.placeId));
  if (!fresh.length) {
    return [stop('Nothing new this time', `All ${plural(leadList.length, 'business', 'businesses')} found for "${job.search.textQuery}" are already in your sheet. Try a nearby area or a related business type.`)];
  }
  return fresh;
}

// One key per website, so two Google listings of the same business (chain locations, duplicate listings) are
// recognised. Multi-tenant hosts (Google Sites, Wix free sites) also need the first part of the path.
function siteKey(url) {
  const full = normalizeUrl(url); // the sheet may hold "smiledental.com" typed by hand
  const u = parseUrl(full);
  if (!u) return '';
  const host = u.hostname.replace(/^www\./, '');
  if (websitePlatform(full)) return '';
  if (/^sites\.google\.com$|(^|\.)wixsite\.com$/.test(host)) return host + u.pathname.split('/').slice(0, 3).join('/').toLowerCase();
  return host;
}

function firstNameWord(name) {
  const m = shortBusinessName(name)
    .toLowerCase()
    .replace(/^(the|dr\.?)\s+/, '')
    .match(/[a-z0-9\u00c0-\uffff']{2,}/);
  return m ? m[0] : '';
}

// Two listings with the same website key are the same business when it is the same page, one of them is the
// homepage, or their names start the same ("Bright Smiles Austin" / "Bright Smiles Round Rock"). Unrelated
// businesses on a shared host the platform list doesn't know ("Joe's Pizza" / "Mario's Trattoria") are not.
function sameBusinessSite(a, b) {
  const key = siteKey(a.url);
  if (!key || key !== siteKey(b.url)) return false;
  if (key.includes('/')) return true; // Google Sites / Wix free sites: the key already includes the site's own path
  const path = (url) => {
    const u = parseUrl(normalizeUrl(url));
    return u ? u.pathname.replace(/\/+$/, '').toLowerCase() : '';
  };
  const pa = path(a.url);
  const pb = path(b.url);
  if (pa === pb || !pa || !pb) return true;
  const fa = firstNameWord(a.name);
  return Boolean(fa && fa === firstNameWord(b.name));
}

// "Check Website": reads the homepage fetch result for one lead.
function stepCheckWebsite(lead, fetchResponse, now) {
  const site = classifyFetch(fetchResponse);
  let analysis = null;
  if (site.status === 'ok' && site.html) {
    try {
      analysis = analyzeHtml(site.html, lead.website, now);
    } catch (e) {
      site.status = 'unknown'; // never let one odd page stop the whole run
      site.detail = `Could not read the page: ${str(e && e.message).slice(0, 100)}`;
    }
  }
  const out = Object.assign({}, lead, {
    site: { status: site.status, sslKind: site.sslKind || '', statusCode: site.statusCode, reachable: site.reachable, detail: site.detail },
    analysis,
    email: analysis && analysis.emails.length ? analysis.emails[0] : '',
    otherEmails: analysis ? analysis.emails.slice(1, 4) : [],
    unverifiedEmails: analysis ? analysis.otherEmails.slice(0, 3) : [],
    pageSpeedUrl: pageSpeedUrl(lead.website),
    needsRecheck: RECHECK_STATUSES.includes(site.status),
  });
  // The domain forwards to a Facebook page / booking page: it is not a website of their own.
  const canonical = analysis && analysis.canonicalUrl ? resolveUrl(analysis.canonicalUrl, lead.website) : '';
  const platform = canonical ? websitePlatform(canonical) : '';
  if (platform && !lead.websitePlatform) Object.assign(out, { websitePlatform: platform, redirectedTo: canonical, analysis: null, email: '', otherEmails: [], unverifiedEmails: [] });
  return out;
}

// "Recheck Website": a second fetch 15 seconds later; only a failure seen twice is reported.
function stepRecheckWebsite(lead, fetchResponse, now) {
  const out = stepCheckWebsite(lead, fetchResponse, now);
  out.site.rechecked = true;
  out.site.firstStatus = lead.site ? lead.site.status : '';
  out.needsRecheck = false;
  return out;
}

function stepReadPageSpeed(lead, psiResponse) {
  const psi = parsePageSpeed(psiResponse);
  const out = Object.assign({}, lead, { psi });
  // PageSpeed loads the page in Chrome and reports where it ended up: a redirect to a Facebook page is not their site.
  const platform = psi.ok && psi.finalUrl ? websitePlatform(psi.finalUrl) : '';
  if (platform && !lead.websitePlatform) Object.assign(out, { websitePlatform: platform, redirectedTo: psi.finalUrl, email: '', otherEmails: [], unverifiedEmails: [] });
  return out;
}

// Addresses and websites already in the sheet: { emails: Map(email → row), sites: Map(siteKey → row) }.
// Addresses and websites already in the sheet: { emails: Map(email → row), sites: Map(siteKey → rows) }.
function savedContacts(rows) {
  const emails = new Map();
  const sites = new Map();
  for (const r of rows || []) {
    if (!r || r.error) continue;
    for (const e of emailsIn(r.Email)) if (!emails.has(e) || isFinalStatus(r.Status)) emails.set(e, r);
    const key = siteKey(r.Website);
    if (!key) continue;
    if (!sites.has(key)) sites.set(key, []);
    sites.get(key).push(r);
  }
  return { emails, sites };
}

// The saved row (final statuses first) or earlier lead with the same business website, if any.
function siteMatch(map, lead, urlOf, nameOf) {
  const list = map.get(siteKey(lead.website)) || [];
  const same = list.filter((x) => sameBusinessSite({ url: urlOf(x), name: nameOf(x) }, { url: lead.website, name: lead.name }));
  return same.find((x) => isFinalStatus(x.Status)) || same[0] || null;
}

function describeRow(r) {
  const status = str(r.Status);
  return `${str(r.Business) || 'another lead'}${status ? `, status "${status}"` : ''}`;
}

// "Find Problems & Score": runs the niche pack's checks and ranks every lead. savedRows (the sheet) and the
// leads ranked above make sure one address / one website is pitched once, and never after an opt-out.
function stepScoreLeads(leads, job, now, savedRows) {
  const minScore = Math.max(0, int(job.settings.minScoreToPitch, 20));
  const scored = leads
    .filter((l) => l && !l.stop)
    .map((lead) => {
      const problems = detectProblems({ lead, site: lead.site || null, analysis: lead.analysis || null, psi: lead.psi || null, market: lead.market, now: now || new Date() }, job.pack);
      const score = scoreProblems(problems);
      return Object.assign({}, lead, { problems, score, priority: priorityFor(score), wantsPitch: score > 0 && score >= minScore });
    });
  const ranked = rankLeads(scored);
  const saved = savedContacts(savedRows);
  const runEmails = new Map();
  const runSites = new Map();
  for (const lead of ranked) {
    const email = str(lead.email).toLowerCase();
    const key = siteKey(lead.website);
    const savedRow = (email && saved.emails.get(email)) || (key && siteMatch(saved.sites, lead, (r) => r.Website, (r) => r.Business));
    const earlier = (email && runEmails.get(email)) || (key && siteMatch(runSites, lead, (l) => l.website, (l) => l.name));
    if (savedRow) {
      lead.duplicateOf = describeRow(savedRow);
      lead.duplicateNote = isFinalStatus(savedRow.Status)
        ? `Same ${email && saved.emails.get(email) ? 'email' : 'website'} as ${describeRow(savedRow)} in your sheet: not pitched.`
        : `Same ${email && saved.emails.get(email) ? 'email' : 'website'} as ${describeRow(savedRow)} already in your sheet: not pitched again.`;
    } else if (earlier) {
      lead.duplicateOf = earlier.name;
      lead.duplicateNote = `Same ${email && runEmails.get(email) ? 'email' : 'website'} as ${earlier.name} (found in the same search): pitched once, there.`;
    }
    if (lead.duplicateOf) lead.wantsPitch = false;
    else {
      if (email) runEmails.set(email, lead);
      if (key) runSites.set(key, (runSites.get(key) || []).concat([lead]));
    }
  }
  return ranked;
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
  return Boolean(lead && lead.email && !lead.duplicateOf && lead.pitch && lead.pitch.subject && truthy(job.settings.createGmailDrafts));
}

function psiProblemNote(psi) {
  if (!psi || psi.ok || psi.certError) return '';
  const msg = str(psi.error);
  if (/PageSpeed Insights API|pagespeedonline|has not been used|disabled|API_KEY_SERVICE_BLOCKED|are blocked|PERMISSION_DENIED|403/i.test(msg)) {
    return 'PageSpeed test failed: enable "PageSpeed Insights API" for your Google API key (setup guide, Google Cloud step).';
  }
  return `PageSpeed test failed (${msg.slice(0, 80) || 'no result'}): speed checks skipped.`;
}

// Short notes for the sheet: why a check was not made, other addresses, duplicates.
function leadNotes(lead) {
  const notes = [];
  if (lead.duplicateNote) notes.push(lead.duplicateNote);
  if (lead.redirectedTo && lead.websitePlatform) notes.push(`${hostOf(lead.website)} forwards to a ${lead.websitePlatform}.`);
  else if (lead.websitePlatform) notes.push(`Their "website" on Google is a ${lead.websitePlatform}.`);
  else if (!lead.website) notes.push('No website: call or DM instead.');
  const site = lead.site || {};
  if (!lead.websitePlatform && lead.website) {
    if (site.status === 'ssl-error' && !(lead.problems || []).some((p) => p.id === 'ssl_error')) {
      notes.push(lead.psi && lead.psi.ok ? "Our check couldn't verify the site's security certificate, but Chrome loads it fine: not claimed." : "Couldn't verify the site's security certificate: not claimed. Check it in your browser.");
    }
    if (site.status === 'blocked') notes.push(`The site blocked our automated check (HTTP ${site.statusCode}): website checks skipped.`);
    if (lead.analysis && lead.analysis.verifiable === false) notes.push(`Homepage not checked in detail: ${lead.analysis.notVerifiableReason}.`);
    const psiNote = site.status === 'ok' ? psiProblemNote(lead.psi) : '';
    if (psiNote) notes.push(psiNote);
  }
  if (lead.otherEmails && lead.otherEmails.length) notes.push(`Other emails: ${lead.otherEmails.join(', ')}`);
  if (lead.unverifiedEmails && lead.unverifiedEmails.length) notes.push(`Also on the site (maybe not theirs): ${lead.unverifiedEmails.join(', ')}`);
  return notes;
}

// "Build Sheet Rows": one row per lead, best first. savedNow = the sheet re-read just before saving: a lead another
// run saved in the meantime is dropped, so overlapping runs never create duplicate rows or drafts.
function stepSheetRows(leads, job, now, savedNow) {
  const when = now || new Date();
  const saved = existingPlaceIds((savedNow || []).filter((r) => r && !r.error));
  const savedEmails = savedContacts(savedNow).emails;
  const ranked = rankLeads(leads.filter((l) => l && !l.stop && !saved.has(l.placeId)));
  return ranked.map((lead) => {
    const draft = wantsDraft(lead, job) && !savedEmails.has(str(lead.email).toLowerCase());
    const hasPitch = Boolean(lead.pitch && lead.pitch.subject);
    const status = draft ? STATUS.DRAFT_READY : hasPitch ? STATUS.PITCH_READY : STATUS.NEW;
    const row = toSheetRow(lead, { niche: job.nicheTitle, search: job.search.textQuery, now: when, status, notes: leadNotes(lead) });
    if (!lead.pitch) {
      row['AI Status'] = lead.duplicateOf
        ? 'Skipped (already pitched)'
        : lead.score > 0
          ? `Skipped (score below ${int(job.settings.minScoreToPitch, 20)})`
          : 'Skipped (no problems found)';
    }
    return row;
  });
}

// n8n reports Gmail errors as "Bad request - please check your parameters (item 3)": make that readable.
function draftErrorText(err) {
  const msg = (errorSummary(err) || 'no draft id returned').replace(/\s*\(item \d+\)\s*$/, '');
  if (/^Bad request - please check your parameters$/i.test(msg)) return 'Gmail rejected it (check the email address)';
  return msg;
}

// "Read Draft IDs": the sheet update for one drafted row (Draft + Thread ID, or a note when Gmail refused it).
function stepReadDraft(row, draftResponse) {
  const r = draftResponse || {};
  const placeId = str(row && row['Place ID']);
  if (r.error || !r.id) {
    const msg = r.error ? draftErrorText(r.error) : 'no draft id returned';
    return { 'Place ID': placeId, Status: STATUS.PITCH_READY, 'Last Draft On': '', Notes: appendNote(row && row.Notes, `Gmail draft failed: ${msg.slice(0, 200)}`) };
  }
  return { 'Place ID': placeId, 'Draft ID': str(r.id), 'Thread ID': str(r.message && r.message.threadId) };
}

function stepSummary(rows, draftUpdates, job, info) {
  const extra = info || {};
  const total = rows.length;
  const hot = rows.filter((r) => r.Priority === 'Hot').length;
  const warm = rows.filter((r) => r.Priority === 'Warm').length;
  const pitched = rows.filter((r) => r['Email Subject']).length;
  const updates = draftUpdates || [];
  const drafts = updates.filter((u) => u && u['Draft ID']).length;
  const draftsFailed = updates.filter((u) => u && !u['Draft ID'] && /Gmail draft failed/.test(str(u.Notes))).length;
  const noEmail = rows.filter((r) => r['Email Subject'] && !r.Email).length;
  const duplicates = rows.filter((r) => /^Skipped \(already pitched\)/.test(str(r['AI Status']))).length;
  const lines = [
    `Search: ${job.search.textQuery}`,
    `${plural(total, 'new business', 'new businesses')} saved to your sheet (${hot} hot, ${warm} warm).`,
    `${plural(pitched, 'personalized pitch', 'personalized pitches')} written.`,
    truthy(job.settings.createGmailDrafts) ? `${plural(drafts, 'Gmail draft')} ready in Gmail > Drafts. Read each one before you send it.` : 'Gmail drafts are turned off in Settings.',
  ];
  if (draftsFailed) lines.push(`${plural(draftsFailed, 'draft')} could not be created: see the Notes column.`);
  if (noEmail) lines.push(`${noEmail} pitched ${noEmail === 1 ? 'business has' : 'businesses have'} no public email: use the DM message or call opener in the sheet.`);
  if (duplicates) lines.push(`${plural(duplicates, 'business', 'businesses')} share an email or website with a lead you already have, so ${duplicates === 1 ? 'it was' : 'they were'} not pitched again.`);
  if (extra.savedElsewhere) lines.push(`${plural(extra.savedElsewhere, 'business', 'businesses')} had just been saved by another run and ${extra.savedElsewhere === 1 ? 'was' : 'were'} skipped.`);
  if (!str(job.settings.yourAddress)) lines.push('Tip: add your postal address (yourAddress in Settings). US law (CAN-SPAM) requires one in commercial emails.');
  return {
    title: `Done: ${plural(total, 'new lead')} found`,
    message: lines.join('\n'),
    total,
    hot,
    warm,
    pitched,
    drafts,
    draftsFailed,
    sheetUrl: str(job.settings.googleSheetUrl),
  };
}

// --- Lite (free) ---

// A value that starts with = + - @ would run as a formula when the CSV is opened in Excel or Sheets.
function csvSafe(v) {
  return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function stepLiteRows(leads, job) {
  const list = leads.filter((l) => l && !l.stop);
  const ownSite = (l) => Boolean(l.website && !l.websitePlatform);
  const sorted = [...list].sort((a, b) => Number(ownSite(a)) - Number(ownSite(b)) || b.reviewCount - a.reviewCount);
  return sorted.map((l) => {
    const row = {
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
      Source: 'Google Maps',
    };
    for (const k of Object.keys(row)) row[k] = csvSafe(row[k]);
    return row;
  });
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
  if (sheetError) {
    const msg = errorSummary(sheetError.error) || 'Google Sheets request failed';
    return [stop("Couldn't read your Google Sheet", `${msg.slice(0, 200)} — ${sheetHint(`${msg} ${errorText(sheetError.error)}`)}`, true)];
  }
  if (!isSheetUrl(settings && settings.googleSheetUrl)) return [stop('Settings needed', 'Paste your Client Finder Google Sheet URL into googleSheetUrl in the "⚙️ Settings" node.', true)];
  const queries = buildGmailQueries(valid);
  if (!queries.length) return [stop('Nothing to follow up', 'No leads with an email address are waiting for a reply.')];
  return queries;
}

function gmailError(items, what) {
  const failed = (items || []).find((m) => m && m.error);
  if (!failed) return null;
  // Without a complete picture of who replied, drafting a follow-up could email someone who said no.
  return stop(`Gmail ${what} failed`, `${errorSummary(failed.error).slice(0, 200) || 'unknown error'} — nothing was drafted today; the next run tries again.`, true);
}

function validRows(rows) {
  return (rows || []).filter((r) => r && !r.error && Object.keys(r).length);
}

// "Plan Thread Checks": the Gmail threads the pitches were sent in, so replies from any address (a colleague,
// the owner's personal Gmail) and bounces are seen, not only mail from the address we pitched.
function stepPlanThreadChecks(rows, messages) {
  const failed = gmailError(messages, 'search');
  if (failed) return [failed];
  const emails = candidateRows(validRows(rows)).map((r) => emailsIn(r.Email)[0]);
  const index = indexGmail((messages || []).filter((m) => m && m.id), emails);
  const ids = threadsToCheck(index);
  return ids.length ? ids.map((threadId) => ({ threadId })) : [{ threadId: '', noThreads: true }];
}

function stepDecideFollowUps(rows, messages, threadMessages, settings, now) {
  const planned = (threadMessages || []).find((m) => m && m.stop);
  if (planned) return [planned];
  const failed = gmailError(messages, 'search') || gmailError(threadMessages, 'thread check');
  if (failed) return [failed];
  const valid = validRows(rows);
  const emails = candidateRows(valid).map((r) => emailsIn(r.Email)[0]);
  const index = indexGmail(
    (messages || []).filter((m) => m && m.id),
    emails,
    (threadMessages || []).filter((m) => m && m.id),
  );
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
  const optOut = settings.followUpOptOutLine === undefined ? FOLLOW_UP_OPT_OUT : str(settings.followUpOptOutLine);
  const out = Object.assign({}, action, {
    followUp: { subject: followUpSubject(action.row), body: finalEmailBody(body, Object.assign({}, settings, { optOutLine: optOut })) },
    aiStatus: parsed.ok ? 'AI' : `Template (AI error: ${parsed.error})`,
  });
  delete out.aiRequest;
  return out;
}

function stepReadFollowUpDraft(action, draftResponse, now) {
  const r = draftResponse || {};
  const update = Object.assign({}, action.update);
  if (r.error || !r.id) {
    // Draft failed: don't count it, so tomorrow's run tries again. The buyer's own notes are kept.
    const msg = (r.error ? draftErrorText(r.error) : 'no draft id').slice(0, 150);
    const old = str(action.row && action.row.Notes).replace(/^\d{4}-\d{2}-\d{2} follow-up draft failed:[^|]*(\|\s*)?/, '');
    return { 'Place ID': update['Place ID'], Notes: appendNote(old, `${isoDate(now || new Date())} follow-up draft failed: ${msg}`) };
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
  const parts = [
    plural(count(STATUS.FOLLOW_UP_DRAFTED), 'follow-up draft') + ' created',
    `${plural(count(STATUS.REPLIED), 'lead')} marked Replied`,
    `${plural(count(STATUS.BOUNCED), 'lead')} marked Bounced`,
    `${plural(count(STATUS.CONTACTED), 'lead')} marked Contacted`,
  ];
  if (failed) parts.push(`${plural(failed, 'draft')} failed (see the Notes column)`);
  return {
    followUpsDrafted: count(STATUS.FOLLOW_UP_DRAFTED),
    markedReplied: count(STATUS.REPLIED),
    markedBounced: count(STATUS.BOUNCED),
    markedContacted: count(STATUS.CONTACTED),
    draftsFailed: failed,
    summary: parts.join(', ') + '.',
  };
}

// @export
module.exports = {
  SETTING_KEYS,
  FOLLOW_UP_OPT_OUT,
  stop,
  isSheetUrl,
  pickSettings,
  sheetRowsFrom,
  stepPrepareJob,
  stepCleanLeads,
  stepSkipSaved,
  siteKey,
  sameBusinessSite,
  stepCheckWebsite,
  stepRecheckWebsite,
  stepReadPageSpeed,
  savedContacts,
  stepScoreLeads,
  stepBuildPitchRequest,
  stepReadPitch,
  wantsDraft,
  leadNotes,
  stepSheetRows,
  draftErrorText,
  stepReadDraft,
  stepSummary,
  csvSafe,
  stepLiteRows,
  stepPrepareFollowUpJob,
  packForRow,
  stepPlanGmailSearches,
  stepPlanThreadChecks,
  stepDecideFollowUps,
  stepBuildFollowUpRequest,
  stepReadFollowUp,
  stepReadFollowUpDraft,
  stepSheetUpdates,
  stepFollowUpReport,
};
