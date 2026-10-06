// Follow-up logic (Pro): read Gmail to learn which pitches were really sent and who replied,
// then decide which leads get a follow-up draft today. Never emails anyone who replied, bounced or opted out.

// @node-only-start
const { str, int, parseDate, daysBetween, isoDate } = require('./util');
const { STATUS, FINAL_STATUSES } = require('./sheet');
// @node-only-end

const EMAIL_RE = /[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}/gi;
const BOUNCE_FROM = /mailer-daemon|postmaster@|mail delivery (subsystem|system)/i;
const BOUNCE_SUBJECT = /delivery status notification|undeliverable|undelivered mail|mail delivery failed|delivery failure|returned mail|failure notice|address not found|delivery has failed/i;
const AUTO_REPLY_SUBJECT = /^\s*(automatic reply|auto[- ]?reply|autoreply|out of (the )?office|abwesenheit|réponse automatique|respuesta automática|risposta automatica|afwezig)/i;

function emailsIn(header) {
  return (str(header).match(EMAIL_RE) || []).map((e) => e.toLowerCase());
}

function parseFollowUpDays(value) {
  const days = str(value)
    .split(/[,;\s]+/)
    .map((x) => int(x, 0))
    .filter((x) => x > 0 && x < 120);
  return days.length ? days : [3, 7];
}

function isFinalStatus(status) {
  const s = str(status).toLowerCase();
  return FINAL_STATUSES.some((f) => f.toLowerCase() === s);
}

// Addresses that must never be emailed again because some row with that address has a final status
// (Replied, Do not contact, Bounced...), even if another row (another listing of the same business) does not.
function suppressedEmails(rows) {
  const out = new Set();
  for (const r of rows || []) if (r && isFinalStatus(r.Status)) for (const e of emailsIn(r.Email)) out.add(e);
  return out;
}

// Rows that may need a follow-up: an address, a Place ID, not final, and pitched (by the workflow or by hand).
function candidateRows(rows) {
  const suppressed = suppressedEmails(rows);
  return (rows || []).filter((r) => {
    const email = emailsIn(r && r.Email)[0];
    if (!email || !str(r['Place ID']) || isFinalStatus(r.Status) || suppressed.has(email)) return false;
    const pitched = str(r['Email Subject']) || str(r['Last Contacted']) || [STATUS.CONTACTED, STATUS.FOLLOW_UP_DRAFTED, STATUS.DRAFT_READY, STATUS.PITCH_READY].includes(str(r.Status));
    return Boolean(pitched);
  });
}

// One Gmail search per chunk of addresses, for sent mail and for replies (in:anywhere also finds archived,
// trashed and spam replies: a reply is a reply even if it was deleted).
function buildGmailQueries(rows, options) {
  const opts = options || {};
  const lookbackDays = int(opts.lookbackDays, 120) || 120;
  const chunkSize = int(opts.chunkSize, 25) || 25;
  const emails = [...new Set(candidateRows(rows).map((r) => emailsIn(r.Email)[0]))];
  const queries = [];
  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize);
    queries.push({ kind: 'sent', q: `in:sent newer_than:${lookbackDays}d {${chunk.map((e) => `to:${e}`).join(' ')}}` });
    queries.push({ kind: 'reply', q: `in:anywhere -in:sent -in:drafts newer_than:${lookbackDays}d {${chunk.map((e) => `from:${e}`).join(' ')}}` });
  }
  return queries;
}

function messageTime(m) {
  const ms = int(m && m.internalDate, 0);
  if (ms > 0) return new Date(ms);
  return parseDate(m && (m.date || m.Date));
}

function hasLabel(m, label) {
  const labels = (m && (m.labels || m.labelIds)) || [];
  return labels.some((l) => (typeof l === 'string' ? l : l && (l.id || l.name)) === label);
}

function isSentMessage(m) {
  return hasLabel(m, 'SENT');
}

function track(map, key, t, extra) {
  const r = map[key] || (map[key] = Object.assign({ first: t, last: t }, extra || {}));
  if (t < r.first) r.first = t;
  if (t > r.last) r.last = t;
  return r;
}

// messages = simplified Gmail messages (From, To, Cc, Subject, internalDate, labels, threadId) from the searches.
// threadMessages = every message of the threads the pitches were sent in (any sender: a colleague's reply or a bounce).
function indexGmail(messages, leadEmails, threadMessages) {
  const wanted = new Set((leadEmails || []).map((e) => e.toLowerCase()));
  const sent = {};
  const replies = {};
  const bounces = {};
  for (const m of messages || []) {
    if (!m || m.error) continue;
    const t = messageTime(m);
    if (!t) continue;
    const from = emailsIn(m.From)[0] || '';
    if (wanted.has(from) && !isSentMessage(m) && !hasLabel(m, 'DRAFT')) {
      if (!AUTO_REPLY_SUBJECT.test(str(m.Subject))) track(replies, from, t, { from });
      continue;
    }
    if (isSentMessage(m)) {
      for (const to of [...emailsIn(m.To), ...emailsIn(m.Cc)]) {
        if (!wanted.has(to)) continue;
        const s = track(sent, to, t, { threadId: str(m.threadId), threads: [] });
        if (t >= s.last) s.threadId = str(m.threadId) || s.threadId;
        if (m.threadId && !s.threads.includes(str(m.threadId))) s.threads.push(str(m.threadId));
      }
    }
  }
  // Thread check: any incoming message in a thread we sent to a lead counts, whoever wrote it.
  const threadLead = {};
  for (const [email, s] of Object.entries(sent)) for (const id of s.threads) threadLead[id] = email;
  for (const m of threadMessages || []) {
    if (!m || m.error || !m.threadId) continue;
    const email = threadLead[str(m.threadId)];
    if (!email || isSentMessage(m) || hasLabel(m, 'DRAFT')) continue;
    const t = messageTime(m);
    if (!t || t < sent[email].first) continue;
    const from = emailsIn(m.From)[0] || str(m.From);
    if (BOUNCE_FROM.test(str(m.From)) || BOUNCE_SUBJECT.test(str(m.Subject))) track(bounces, email, t);
    else if (!AUTO_REPLY_SUBJECT.test(str(m.Subject))) track(replies, email, t, { from });
  }
  return { sent, replies, bounces };
}

// The thread IDs to read for the thread check (every thread a pitch or follow-up was sent in).
function threadsToCheck(index) {
  const ids = new Set();
  for (const s of Object.values((index && index.sent) || {})) for (const id of s.threads || []) if (id) ids.add(id);
  return [...ids];
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function appendNote(existing, note) {
  const old = str(existing);
  if (!note) return old;
  if (old.includes(note)) return old;
  return [note, old].filter(Boolean).join(' | ').slice(0, 1000);
}

// Picks one row per address. Rows sharing a Place ID: only the first one counts (n8n's "Update" writes to the first
// matching row, so later copies would never be updated). Rows sharing an address: the one the pitch belongs to.
function rowsToDecide(rows, idx) {
  const seenPlace = new Set();
  const byEmail = new Map();
  for (const row of candidateRows(rows)) {
    const placeId = str(row['Place ID']);
    if (seenPlace.has(placeId)) continue;
    seenPlace.add(placeId);
    const email = emailsIn(row.Email)[0];
    if (!byEmail.has(email)) byEmail.set(email, []);
    byEmail.get(email).push(row);
  }
  const out = [];
  for (const [email, list] of byEmail) {
    const sentThread = idx.sent[email] && idx.sent[email].threadId;
    const pick = list.find((r) => sentThread && str(r['Thread ID']) === sentThread) || list.find((r) => str(r['Email Subject'])) || list[0];
    out.push({ row: pick, email });
  }
  return out;
}

// Returns one action per lead that needs a change: { action, row, update, followUpNumber, email, threadId }.
function decideFollowUps(rows, gmailIndex, settings, now) {
  const s = settings || {};
  const today = now || new Date();
  const gaps = parseFollowUpDays(s.followUpDays);
  const maxFollowUps = Math.max(0, Math.min(5, int(s.maxFollowUps, gaps.length)));
  const idx = Object.assign({ sent: {}, replies: {}, bounces: {} }, gmailIndex || {});
  const actions = [];
  for (const { row, email } of rowsToDecide(rows, idx)) {
    const status = str(row.Status);
    const sentInfo = idx.sent[email];
    const gmailLast = sentInfo ? sentInfo.last : null;
    let sheetContacted = parseDate(row['Last Contacted']);
    if (sheetContacted && sheetContacted > today) sheetContacted = null; // a date in the future is a typo: ignore it
    let lastSent = gmailLast;
    if (sheetContacted && (!lastSent || sheetContacted > lastSent)) lastSent = sheetContacted;
    const firstSent = sentInfo ? sentInfo.first : sheetContacted;
    const base = { 'Place ID': str(row['Place ID']) };
    // Only Gmail's own send date is written back, and only when it is newer than what the sheet says.
    const contactedUpdate = gmailLast && (!sheetContacted || gmailLast > sheetContacted) && isoDate(gmailLast) !== str(row['Last Contacted']) ? { 'Last Contacted': isoDate(gmailLast) } : {};

    const bounce = idx.bounces[email];
    if (bounce && firstSent && bounce.last >= firstSent) {
      actions.push({
        action: 'bounced',
        row,
        email,
        update: Object.assign(base, contactedUpdate, { Status: STATUS.BOUNCED, Notes: appendNote(row.Notes, `${isoDate(bounce.last)}: email bounced (address not reachable)`) }),
      });
      continue;
    }
    const reply = idx.replies[email];
    if (reply && firstSent && reply.last >= firstSent) {
      const other = reply.from && reply.from !== email ? appendNote(row.Notes, `Reply came from ${reply.from}`) : null;
      actions.push({ action: 'replied', row, email, update: Object.assign(base, contactedUpdate, { Status: STATUS.REPLIED }, other !== null ? { Notes: other } : {}) });
      continue;
    }
    if (!lastSent) continue; // the first email was never sent: nothing to follow up yet

    const followUps = Math.max(0, int(row['Follow-ups'], 0));
    const lastDraft = parseDate(row['Last Draft On']);
    const draftWaiting = Boolean(lastDraft && lastDraft > startOfUtcDay(lastSent));
    const needsContactedStatus = [STATUS.DRAFT_READY, STATUS.PITCH_READY, STATUS.FOLLOW_UP_DRAFTED, STATUS.NEW, ''].includes(status) && !draftWaiting;
    const gap = gaps[Math.min(followUps, gaps.length - 1)];
    const due = followUps < maxFollowUps && !draftWaiting && daysBetween(lastSent, today) >= gap;

    if (due) {
      // Reply in the thread of the email that was really sent; a hand-entered date has no Gmail thread to reply in.
      const threadId = (sentInfo && sentInfo.threadId) || '';
      actions.push({
        action: 'follow-up',
        row,
        email,
        threadId,
        followUpNumber: followUps + 1,
        update: Object.assign(base, contactedUpdate, {
          Status: STATUS.FOLLOW_UP_DRAFTED,
          'Follow-ups': followUps + 1,
          'Last Draft On': isoDate(today),
          'Thread ID': threadId || str(row['Thread ID']),
        }),
      });
    } else if ((needsContactedStatus && status !== STATUS.CONTACTED) || (Object.keys(contactedUpdate).length && !draftWaiting)) {
      actions.push({ action: 'contacted', row, email, update: Object.assign(base, contactedUpdate, { Status: STATUS.CONTACTED }) });
    }
  }
  return actions;
}

function followUpSubject(row) {
  const subject = str(row['Email Subject']);
  if (!subject) return `Following up — ${str(row.Business)}`;
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

// @export
module.exports = {
  emailsIn,
  parseFollowUpDays,
  isFinalStatus,
  suppressedEmails,
  candidateRows,
  buildGmailQueries,
  isSentMessage,
  indexGmail,
  threadsToCheck,
  appendNote,
  rowsToDecide,
  decideFollowUps,
  followUpSubject,
};
