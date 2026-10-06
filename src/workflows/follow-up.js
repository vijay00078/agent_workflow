// Builds the Pro "Follow-up Autopilot" workflow: every morning it checks Gmail for which pitches were sent
// and who replied, marks replies in the sheet, and drafts polite follow-ups in the same thread.

const { V, WorkflowBuilder, sticky, code, condition, ifNode, merge, setNode, sheetLocator, stableUuid } = require('./common');
const { httpNode } = require('./client-finder');
const { LEAD_COLUMNS } = require('../lib/sheet');
const { DEFAULT_MODEL } = require('../lib/ai');
const product = require('../../config/product.json');

const FJOB = "$('Prepare Follow-ups').first().json";

function buildFollowUp(packs) {
  const wf = new WorkflowBuilder('client-finder-follow-up', 'Client Finder: Follow-up Autopilot');
  const stopCheck = (name, pos) => ifNode(name, pos, [condition('notStopped', '={{ $json.stop === true }}', 'false')]);

  wf.add(
    sticky(
      'Start Here',
      [-560, -160],
      `## 🔁 Follow-up Autopilot (Pro)\nRuns every morning at 9:00 (your n8n timezone). For every lead in your sheet that has an email address it:\n- checks **Gmail Sent** to see if you actually sent the pitch,\n- checks your **inbox for replies** → marks the lead **Replied** and never emails them again,\n- drafts a short follow-up **in the same thread** after 3 days, and a last polite one after 7 more days.\n\nDrafts only: you review and send. Change the timing in **⚙️ Settings** (followUpDays, maxFollowUps).\n\n**Setup:** reuse the same Google Sheets, Gmail and Anthropic credentials as Client Finder, paste your sheet URL in Settings, then activate/publish.`,
      { width: 500, height: 520, color: 4 },
    ),
  );

  wf.add({
    name: 'Every Morning',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: V.scheduleTrigger,
    position: [0, 220],
    parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 9, triggerAtMinute: 0 }] } },
  });
  wf.add({ name: 'Run Now', type: 'n8n-nodes-base.manualTrigger', typeVersion: V.manualTrigger, position: [0, 420], parameters: {} });
  wf.add(
    setNode('⚙️ Settings', [220, 320], {
      googleSheetUrl: 'PASTE_YOUR_GOOGLE_SHEET_URL_HERE',
      followUpDays: '3,7',
      maxFollowUps: 2,
      yourName: 'Your Name',
      yourBusinessName: 'Your Business',
      yourWebsite: '',
      yourPhone: '',
      yourAddress: '',
      yourService: '',
      yourOffer: '',
      emailLanguage: 'English',
      emailTone: 'friendly, direct and human',
      aiModel: DEFAULT_MODEL,
      aiEffort: 'low',
    }),
  );
  wf.add(
    code('Prepare Follow-ups', [440, 320], {
      purpose: 'Checks Settings. NICHE_PACKS gives each lead the same angle as the workflow that found it (sheet column "Niche").',
      adapter: `const NICHE_PACKS = ${JSON.stringify(packs, null, 2)};\nreturn [{ json: stepPrepareFollowUpJob($input.first().json, NICHE_PACKS) }];`,
    }),
  );
  wf.add(stopCheck('Settings OK?', [660, 320]));
  wf.add({
    name: 'Read Leads',
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: V.googleSheets,
    position: [880, 300],
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: Object.assign({ authentication: 'oAuth2', resource: 'sheet', operation: 'read' }, sheetLocator(`={{ ${FJOB}.settings.googleSheetUrl }}`), { filtersUI: {}, options: {} }),
  });
  wf.add(
    code('Plan Gmail Searches', [1100, 300], {
      purpose: 'Builds Gmail searches for the addresses you pitched: what you sent, and what they replied.',
      adapter: `const job = ${FJOB};\nconst rows = $input.all().map((i) => i.json);\nreturn stepPlanGmailSearches(rows, job.settings).map((json) => ({ json }));`,
    }),
  );
  wf.add(stopCheck('Anyone to Check?', [1320, 300]));
  wf.add({
    name: 'Search Gmail',
    type: 'n8n-nodes-base.gmail',
    typeVersion: V.gmail,
    position: [1540, 280],
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: { resource: 'message', operation: 'getAll', returnAll: true, simple: true, filters: { q: '={{ $json.q }}', readStatus: 'both' } },
  });
  wf.add(
    code('Decide Follow-ups', [1760, 280], {
      purpose: 'Replied → mark Replied. Sent and quiet for long enough → draft a follow-up. Draft not sent yet → wait.',
      adapter: `const job = ${FJOB};\nconst rows = $('Read Leads').all().map((i) => i.json);\nconst messages = $input.all().map((i) => i.json);\nreturn stepDecideFollowUps(rows, messages, job.settings, new Date()).map((json) => ({ json }));`,
    }),
  );
  wf.add(stopCheck('Any Changes?', [1980, 280]));
  wf.add(ifNode('Needs Follow-up?', [2200, 280], [condition('isFollowUp', '={{ $json.action }}', 'equals', 'string', 'follow-up')]));
  wf.add(
    code('Build Follow-up Request', [2420, 200], {
      purpose: 'Asks Claude for a short follow-up based on the original pitch.',
      adapter: `const job = ${FJOB};\nconst items = $input.all();\nreturn items.map((item, i) => ({ json: stepBuildFollowUpRequest(item.json, job), pairedItem: { item: i } }));`,
    }),
  );
  wf.add(
    httpNode(
      'Write Follow-up with Claude',
      [2640, 200],
      {
        method: 'POST',
        url: 'https://api.anthropic.com/v1/messages',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendHeaders: true,
        specifyHeaders: 'json',
        jsonHeaders: '={{ JSON.stringify($json.aiRequest.headers) }}',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.aiRequest.body) }}',
        options: { batching: { batch: { batchSize: 5, batchInterval: 1500 } }, timeout: 180000 },
      },
      { onError: 'continueRegularOutput' },
    ),
  );
  wf.add(
    code('Read Follow-up', [2860, 200], {
      purpose: "Reads Claude's follow-up (or uses a polite template if the AI call failed).",
      adapter: `const job = ${FJOB};\nconst items = $input.all();\nreturn items.map((item, i) => ({\n  json: stepReadFollowUp($('Build Follow-up Request').itemMatching(i).json, item.json, job),\n  pairedItem: { item: i },\n}));`,
    }),
  );
  wf.add({
    name: 'Create Follow-up Draft',
    type: 'n8n-nodes-base.gmail',
    typeVersion: V.gmail,
    position: [3080, 200],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'draft',
      operation: 'create',
      subject: '={{ $json.followUp.subject }}',
      emailType: 'text',
      message: '={{ $json.followUp.body }}',
      options: { sendTo: '={{ $json.email }}', threadId: '={{ $json.threadId }}' },
    },
  });
  wf.add(
    code('Read Follow-up Draft', [3300, 200], {
      purpose: 'Prepares the sheet update for each drafted follow-up.',
      adapter: `const items = $input.all();\nreturn items.map((item, i) => ({\n  json: stepReadFollowUpDraft($('Read Follow-up').itemMatching(i).json, item.json),\n  pairedItem: { item: i },\n}));`,
    }),
  );
  wf.add(merge('All Updates', [3520, 300], 2));
  wf.add(
    code('Sheet Updates', [3740, 300], {
      purpose: 'Only the changed columns are written; everything else in your sheet is left alone.',
      adapter: `const items = $input.all().map((i) => i.json);\nreturn stepSheetUpdates(items).map((json) => ({ json }));`,
    }),
  );
  wf.add({
    name: 'Update Leads',
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: V.googleSheets,
    position: [3960, 300],
    parameters: Object.assign({ authentication: 'oAuth2', resource: 'sheet', operation: 'update' }, sheetLocator(`={{ ${FJOB}.settings.googleSheetUrl }}`), {
      columns: {
        mappingMode: 'autoMapInputData',
        value: {},
        matchingColumns: ['Place ID'],
        schema: LEAD_COLUMNS.map((c) => ({ id: c, displayName: c, required: false, defaultMatch: c === 'Place ID', display: true, type: 'string', canBeUsedToMatch: true })),
      },
      options: { cellFormat: 'RAW' },
    }),
  });
  wf.add(
    code('Report', [4180, 300], {
      purpose: 'One-line summary of this run (visible in the execution log).',
      adapter: `const updates = $('Sheet Updates').all().map((i) => i.json);\nreturn [{ json: stepFollowUpReport(updates) }];`,
    }),
  );

  // Stops: configuration problems fail the execution (so n8n can alert you); "nothing to do" ends quietly.
  wf.add(ifNode('Setup Problem?', [880, 620], [condition('fatal', '={{ $json.fatal === true }}', 'true')]));
  wf.add({ name: 'Stop With Error', type: 'n8n-nodes-base.stopAndError', typeVersion: 1, position: [1100, 560], parameters: { errorMessage: '={{ $json.title }}: {{ $json.message }}' } });
  wf.add({ name: 'Nothing To Do', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [1100, 720], parameters: {} });

  wf.connect('Every Morning', '⚙️ Settings');
  wf.connect('Run Now', '⚙️ Settings');
  wf.chain('⚙️ Settings', 'Prepare Follow-ups', 'Settings OK?');
  wf.connect('Settings OK?', 'Read Leads', 0);
  wf.connect('Settings OK?', 'Setup Problem?', 1);
  wf.chain('Read Leads', 'Plan Gmail Searches', 'Anyone to Check?');
  wf.connect('Anyone to Check?', 'Search Gmail', 0);
  wf.connect('Anyone to Check?', 'Setup Problem?', 1);
  wf.chain('Search Gmail', 'Decide Follow-ups', 'Any Changes?');
  wf.connect('Any Changes?', 'Needs Follow-up?', 0);
  wf.connect('Any Changes?', 'Setup Problem?', 1);
  wf.connect('Needs Follow-up?', 'Build Follow-up Request', 0);
  wf.chain('Build Follow-up Request', 'Write Follow-up with Claude', 'Read Follow-up', 'Create Follow-up Draft', 'Read Follow-up Draft');
  wf.connect('Read Follow-up Draft', 'All Updates', 0, 0);
  wf.connect('Needs Follow-up?', 'All Updates', 1, 1);
  wf.chain('All Updates', 'Sheet Updates', 'Update Leads', 'Report');
  wf.connect('Setup Problem?', 'Stop With Error', 0);
  wf.connect('Setup Problem?', 'Nothing To Do', 1);

  wf.layoutRows([
    ['Start Here', 'Every Morning', 'Run Now', '⚙️ Settings', 'Prepare Follow-ups', 'Settings OK?', 'Read Leads', 'Plan Gmail Searches', 'Anyone to Check?', 'Setup Problem?', 'Stop With Error', 'Nothing To Do'],
    ['Search Gmail', 'Decide Follow-ups', 'Any Changes?', 'Needs Follow-up?', 'Build Follow-up Request', 'Write Follow-up with Claude', 'Read Follow-up', 'Create Follow-up Draft', 'Read Follow-up Draft', 'All Updates', 'Sheet Updates', 'Update Leads', 'Report'],
  ]);
  const json = wf.toJSON();
  json.meta.clientFinder = { tier: 'pro', role: 'follow-up', product: product.productName, version: product.version };
  return json;
}

module.exports = { buildFollowUp, stableUuid };
