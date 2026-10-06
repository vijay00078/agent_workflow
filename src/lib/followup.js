// Follow-up logic (Pro): read Gmail to learn which pitches were really sent and who replied,
// then decide which leads get a follow-up draft today. Never emails anyone who replied.

// @node-only-start
const { str, int, parseDate, daysBetween, isoDate } = require('./util');
const { STATUS, FINAL_STATUSES } = require('./sheet');
// @node-only-end

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;

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

function candidateRows(rows) {
  return (rows || []).filter((r) => {
    const email = emailsIn(r && r.Email)[0];
    const status = str(r && r.Status);
    return email && str(r['Place ID']) && !FINAL_STATUSES.some((s) => s.toLowerCase() === status.toLowerCase());
  });
}

// One Gmail search per chunk of addresses, for sent mail and for replies.
function buildGmailQueries(rows, options) {
  const opts = options || {};
  const lookbackDays = int(opts.lookbackDays, 120) || 120;
  const chunkSize = int(opts.chunkSize, 25) || 25;
  const emails = [...new Set(candidateRows(rows).map((r) => emailsIn(r.Email)[0]))];
  const queries = [];
  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize);
    queries.push({ kind: 'sent', q: `in:sent newer_than:${lookbackDays}d {${chunk.map((e) => `to:${e}`).join(' ')}}` });
    queries.push({ kind: 'reply', q: `-in:sent -in:drafts newer_than:${lookbackDays}d {${chunk.map((e) => `from:${e}`).join(' ')}}` });
  }
  return queries;
}

function messageTime(m) {
  const ms = int(m && m.internalDate, 0);
  if (ms > 0) return new Date(ms);
  return parseDate(m && (m.date || m.Date));
}

function isSentMessage(m) {
  const labels = (m && (m.labels || m.labelIds)) || [];
  return labels.some((l) => (typeof l === 'string' ? l : l && (l.id || l.name)) === 'SENT');
}

// messages = simplified Gmail messages (From, To, Cc, internalDate, labels, threadId).
function indexGmail(messages, leadEmails) {
  const wanted = new Set((leadEmails || []).map((e) => e.toLowerCase()));
  const sent = {};
  const replies = {};
  for (const m of messages || []) {
    if (!m || m.error) continue;
    const t = messageTime(m);
    if (!t) continue;
    const from = emailsIn(m.From)[0] || '';
    if (wanted.has(from) && !isSentMessage(m)) {
      const r = replies[from] || (replies[from] = { first: t, last: t });
      if (t < r.first) r.first = t;
      if (t > r.last) r.last = t;
      continue;
    }
    if (isSentMessage(m) || !wanted.has(from)) {
      for (const to of [...emailsIn(m.To), ...emailsIn(m.Cc)]) {
        if (!wanted.has(to)) continue;
        const s = sent[to] || (sent[to] = { first: t, last: t, threadId: str(m.threadId) });
        if (t < s.first) s.first = t;
        if (t > s.last) {
          s.last = t;
          s.threadId = str(m.threadId) || s.threadId;
        }
      }
    }
  }
  return { sent, replies };
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Returns one action per lead that needs a change: { action, row, update, followUpNumber, email, threadId }.
function decideFollowUps(rows, gmailIndex, settings, now) {
  const s = settings || {};
  const today = now || new Date();
  const gaps = parseFollowUpDays(s.followUpDays);
  const maxFollowUps = Math.max(0, Math.min(5, int(s.maxFollowUps, gaps.length)));
  const idx = gmailIndex || { sent: {}, replies: {} };
  const actions = [];
  for (const row of candidateRows(rows)) {
    const email = emailsIn(row.Email)[0];
    const status = str(row.Status);
    const sentInfo = idx.sent[email];
    const sheetContacted = parseDate(row['Last Contacted']);
    let lastSent = sentInfo ? sentInfo.last : null;
    if (sheetContacted && (!lastSent || sheetContacted > lastSent)) lastSent = sheetContacted;
    const firstSent = sentInfo ? sentInfo.first : sheetContacted;
    const reply = idx.replies[email];
    const base = { 'Place ID': str(row['Place ID']) };
    const contactedIso = lastSent ? isoDate(lastSent) : '';

    if (reply && firstSent && reply.last >= firstSent) {
      actions.push({ action: 'replied', row, email, update: Object.assign(base, { Status: STATUS.REPLIED, 'Last Contacted': contactedIso }) });
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
      // Prefer the thread of the email that was really sent (it surely exists); fall back to the sheet's draft thread.
      const threadId = (sentInfo && sentInfo.threadId) || str(row['Thread ID']) || '';
      actions.push({
        action: 'follow-up',
        row,
        email,
        threadId,
        followUpNumber: followUps + 1,
        update: Object.assign(base, {
          Status: STATUS.FOLLOW_UP_DRAFTED,
          'Follow-ups': followUps + 1,
          'Last Draft On': isoDate(today),
          'Last Contacted': contactedIso,
          'Thread ID': threadId,
        }),
      });
    } else if (needsContactedStatus || (contactedIso && str(row['Last Contacted']) !== contactedIso && !draftWaiting)) {
      actions.push({ action: 'contacted', row, email, update: Object.assign(base, { Status: STATUS.CONTACTED, 'Last Contacted': contactedIso }) });
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
  candidateRows,
  buildGmailQueries,
  isSentMessage,
  indexGmail,
  decideFollowUps,
  followUpSubject,
};
