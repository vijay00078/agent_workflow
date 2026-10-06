// The Leads sheet: column layout and row builders. The column names must match the header row of
// the "Leads" tab in the Client Finder CRM template (products/*/Client-Finder-CRM.xlsx).

// @node-only-start
const { str, int, isoDate, hostOf } = require('./util');
// @node-only-end

const SHEET_TAB = 'Leads';

const LEAD_COLUMNS = [
  'Place ID',
  'Business',
  'Category',
  'Phone',
  'Email',
  'Website',
  'Address',
  'Google Maps',
  'Rating',
  'Reviews',
  'Score',
  'Priority',
  'Problems',
  'Top Problem',
  'Evidence',
  'Email Subject',
  'Email Body',
  'DM Message',
  'Call Opener',
  'Status',
  'Draft ID',
  'Thread ID',
  'Found On',
  'Last Contacted',
  'Follow-ups',
  'Last Draft On',
  'Niche',
  'Search',
  'AI Status',
  'Notes',
];

const STATUS = {
  NEW: 'New',
  PITCH_READY: 'Pitch ready',
  DRAFT_READY: 'Draft ready',
  CONTACTED: 'Contacted',
  FOLLOW_UP_DRAFTED: 'Follow-up drafted',
  REPLIED: 'Replied',
  MEETING: 'Meeting booked',
  WON: 'Won',
  LOST: 'Lost',
  DO_NOT_CONTACT: 'Do not contact',
};

// Statuses after which the follow-up workflow must never email the business again.
const FINAL_STATUSES = [STATUS.REPLIED, STATUS.MEETING, STATUS.WON, STATUS.LOST, STATUS.DO_NOT_CONTACT, 'Not interested', 'Bounced'];

function evidenceText(problems) {
  return (problems || []).map((p, i) => `${i + 1}. ${p.evidence}`).join('\n');
}

// lead = fully processed lead (problems, score, pitch...). ctx = { niche, search, now, draftsEnabled }.
function toSheetRow(lead, ctx) {
  const c = ctx || {};
  const problems = lead.problems || [];
  const hasPitch = Boolean(lead.pitch && lead.pitch.subject && lead.pitch.body);
  const status = !hasPitch ? STATUS.NEW : lead.email && c.draftsEnabled ? STATUS.DRAFT_READY : STATUS.PITCH_READY;
  return {
    'Place ID': lead.placeId,
    Business: lead.name,
    Category: lead.category || '',
    Phone: lead.phone || '',
    Email: lead.email || '',
    Website: lead.website || '',
    Address: lead.address || '',
    'Google Maps': lead.mapsUrl || '',
    Rating: lead.rating === null || lead.rating === undefined ? '' : lead.rating,
    Reviews: int(lead.reviewCount, 0),
    Score: int(lead.score, 0),
    Priority: lead.priority || '',
    Problems: problems.map((p) => p.label).join(', '),
    'Top Problem': problems[0] ? problems[0].label : '',
    Evidence: evidenceText(problems),
    'Email Subject': hasPitch ? lead.pitch.subject : '',
    'Email Body': hasPitch ? lead.pitch.fullBody || lead.pitch.body : '',
    'DM Message': hasPitch ? lead.pitch.dm || '' : '',
    'Call Opener': hasPitch ? lead.pitch.callOpener || '' : '',
    Status: status,
    'Draft ID': '',
    'Thread ID': '',
    'Found On': isoDate(c.now || new Date()),
    'Last Contacted': '',
    'Follow-ups': 0,
    'Last Draft On': status === STATUS.DRAFT_READY ? isoDate(c.now || new Date()) : '',
    Niche: c.niche || '',
    Search: c.search || '',
    'AI Status': lead.aiStatus || '',
    Notes: lead.websitePlatform ? `Their "website" on Google is a ${lead.websitePlatform}.` : lead.website ? '' : 'No website: call or DM instead.',
  };
}

function existingPlaceIds(rows) {
  const ids = new Set();
  for (const r of rows || []) {
    const id = str(r && r['Place ID']);
    if (id) ids.add(id);
  }
  return ids;
}

function siteLabel(url) {
  return hostOf(url);
}

// @export
module.exports = { SHEET_TAB, LEAD_COLUMNS, STATUS, FINAL_STATUSES, evidenceText, toSheetRow, existingPlaceIds, siteLabel };
