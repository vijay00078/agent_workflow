// Builds the paid "Client Finder" workflow for one niche pack (Starter ships web-design; Pro ships all five).

const { PLACES_FIELD_MASK } = require('../lib/places');
const { LEAD_COLUMNS } = require('../lib/sheet');
const { DEFAULT_MODEL } = require('../lib/ai');
const { V, WorkflowBuilder, sticky, code, condition, ifNode, merge, setNode, sheetLocator } = require('./common');
const product = require('../../config/product.json');

const JOB = "$('Prepare Search').first().json";

function defaultSettings(pack) {
  return {
    yourName: 'Your Name',
    yourBusinessName: 'Your Business',
    yourWebsite: '',
    yourPhone: '',
    yourAddress: '',
    yourService: pack.defaultService,
    yourOffer: pack.defaultOffer,
    signOff: 'Thanks,',
    googleSheetUrl: 'PASTE_YOUR_GOOGLE_SHEET_URL_HERE',
    createGmailDrafts: true,
    minScoreToPitch: 20,
    emailLanguage: 'English',
    emailTone: 'friendly, direct and human',
    maxEmailWords: 110,
    optOutLine: 'P.S. If this isn\'t useful, just reply "no thanks" and I won\'t email again.',
    aiModel: DEFAULT_MODEL,
    aiEffort: 'low',
    searchLanguage: 'en',
    searchCountryCode: '',
  };
}

function formTrigger(name, position, pack, path) {
  return {
    name,
    type: 'n8n-nodes-base.formTrigger',
    typeVersion: V.formTrigger,
    position,
    webhookId: require('./common').stableUuid('webhook', path),
    parameters: {
      formTitle: `Client Finder: ${pack.title}`,
      formDescription: `${pack.tagline}\nType a business type and a city. The agent finds up to 60 businesses on Google Maps, checks each one, writes a personalized pitch for the best leads and saves everything to your Google Sheet. It takes about 2-8 minutes; keep this tab open and don't submit another search until this one is done.`,
      formFields: {
        values: [
          { fieldLabel: 'Business type', placeholder: `e.g. ${pack.exampleSearch.businessType}`, requiredField: true },
          { fieldLabel: 'City or area', placeholder: `e.g. ${pack.exampleSearch.location}`, requiredField: true },
          {
            fieldLabel: 'How many businesses?',
            fieldType: 'dropdown',
            fieldOptions: { values: [{ option: '20' }, { option: '40' }, { option: '60' }] },
            requiredField: true,
          },
        ],
      },
      responseMode: 'lastNode',
      options: { path, appendAttribution: false, buttonLabel: 'Find clients' },
    },
  };
}

function httpNode(name, position, parameters, extra = {}) {
  return Object.assign({ name, type: 'n8n-nodes-base.httpRequest', typeVersion: V.httpRequest, position, parameters }, extra);
}

function formEnd(workflowKey, name, position, title, message) {
  return {
    name,
    type: 'n8n-nodes-base.form',
    typeVersion: V.form,
    position,
    webhookId: require('./common').stableUuid('form-end', workflowKey, name),
    parameters: { operation: 'completion', respondWith: 'text', completionTitle: title, completionMessage: message, options: {} },
  };
}

function placesSearchNode(position) {
  return httpNode(
    'Search Google Maps',
    position,
    {
      method: 'POST',
      url: 'https://places.googleapis.com/v1/places:searchText',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'X-Goog-FieldMask', value: PLACES_FIELD_MASK }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.search.requestBody) }}',
      options: {
        pagination: {
          pagination: {
            paginationMode: 'updateAParameterInEachRequest',
            parameters: { parameters: [{ type: 'body', name: 'pageToken', value: '={{ $response.body.nextPageToken }}' }] },
            paginationCompleteWhen: 'other',
            completeExpression: `={{ !$response.body.nextPageToken || $pageCount >= ${JOB}.search.maxPages }}`,
            limitPagesFetched: true,
            maxRequests: 3,
            requestInterval: 1500,
          },
        },
        timeout: 30000,
      },
    },
    { onError: 'continueRegularOutput' },
  );
}

function buildClientFinder(pack) {
  const path = `client-finder-${pack.id}`;
  const wf = new WorkflowBuilder(`client-finder-${pack.id}`, `Client Finder: ${pack.title}`);
  const stopCheck = (name, pos) => ifNode(name, pos, [condition('notStopped', '={{ $json.stop === true }}', 'false')]);
  const allLeadsX = pack.needsPageSpeed ? 4400 : pack.weights.site_down ? 3740 : 2640;

  // --- notes ---
  wf.add(
    sticky(
      'Start Here',
      [-520, -120],
      `## 👋 Client Finder: ${pack.title}\n${pack.tagline}\n\n**One-time setup (about 30-45 min the first time, full guide in SETUP-GUIDE.pdf):**\n1. **Google API Key** credential: Header Auth, Name \`X-Goog-Api-Key\`. Used by *Search Google Maps*${pack.needsPageSpeed ? ' and *PageSpeed Test*' : ''}.\n2. **Anthropic API Key** credential: Header Auth, Name \`x-api-key\`. Used by *Write Pitch with Claude*.\n3. **Google Sheets** + **Gmail** credentials (Google OAuth). Select them on every Google Sheets node (4) and the Gmail node.\n4. Open **⚙️ Settings**: your name, offer, and your Google Sheet URL.\n\n**Run it:** open *Find Clients Form* → copy the Production URL → open it in your browser (activate/publish the workflow first). Or click *Execute workflow* to test.\n\nResults: every lead lands in your **Leads** sheet; pitches for leads with an email are saved as **Gmail drafts**. Nothing is ever sent automatically.`,
      { width: 480, height: 560, color: 4 },
    ),
  );
  wf.add(sticky('Step 1 Note', [820, 120], '### 1 · Find businesses\nGoogle Maps search (up to 60 results), then removes duplicates, closed businesses and anything already in your sheet.', { width: 960, height: 340, color: 7 }));
  if (pack.needsWebsiteCheck) {
    wf.add(sticky('Step 2 Note', [1920, 0], `### 2 · Check their website\nLoads each homepage${pack.weights.site_down ? ' (a site that fails is checked again 15 s later)' : ''}${pack.needsPageSpeed ? ', runs Google PageSpeed on mobile (in Chrome, which also confirms certificate errors),' : ''} and reads contact email, booking/chat tools, social links and more. Anything we can't verify is skipped, never guessed.`, { width: allLeadsX + 320 - 1920, height: 480, color: 7 }));
  }
  wf.add(sticky('Step 3 Note', [3260, -100], '### 3 · Score & write pitches\nApplies the niche checks, scores every lead 0-100 and asks Claude for a short, evidence-based pitch for each lead above your minimum score. Temporary AI errors get one retry after 15 s; if it still fails, a template pitch is used.', { width: 2380, height: 560, color: 7 }));
  wf.add(sticky('Step 4 Note', [5660, 60], '### 4 · Save & draft\nRe-reads your sheet (so two runs never save the same business twice), saves every lead, then creates a Gmail draft for each lead with an email address (you review and send) and stores the draft IDs.', { width: 2420, height: 400, color: 7 }));

  // --- trigger + settings ---
  wf.add(formTrigger('Find Clients Form', [0, 300], pack, path));
  wf.add(setNode('⚙️ Settings', [220, 300], defaultSettings(pack)));
  wf.add(
    code('Prepare Search', [440, 300], {
      title: 'Prepare Search',
      purpose: `Checks your Settings and the form, and builds the Google Maps search.\nNICHE_PACK below decides which problems count and how many points each is worth (edit with care).`,
      adapter: `const NICHE_PACK = ${JSON.stringify(pack, null, 2)};\nreturn [{ json: stepPrepareJob($input.first().json, NICHE_PACK, { requireSheet: true }) }];`,
    }),
  );
  wf.add(stopCheck('Settings OK?', [660, 300]));
  wf.add(formEnd(wf.key, 'Show Message', [1760, 520], '={{ $json.title }}', '={{ $json.message }}'));

  // --- 1. find ---
  wf.add(placesSearchNode([880, 280]));
  wf.add(
    code('Clean Leads', [1100, 280], {
      purpose: 'Turns the Google Maps pages into one item per open business (no duplicates).',
      adapter: `const job = ${JOB};\nconst pages = $input.all().map((i) => i.json);\nreturn stepCleanLeads(pages, job).map((json) => ({ json }));`,
    }),
  );
  wf.add({
    name: 'Read Saved Leads',
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: V.googleSheets,
    position: [1320, 280],
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: Object.assign({ authentication: 'oAuth2', resource: 'sheet', operation: 'read' }, sheetLocator(`={{ ${JOB}.settings.googleSheetUrl }}`), { filtersUI: {}, options: {} }),
  });
  wf.add(
    code('Skip Saved Leads', [1540, 280], {
      purpose: 'Removes businesses that are already in your sheet, so nobody gets pitched twice.',
      adapter: `const job = ${JOB};\nconst leads = $('Clean Leads').all().map((i) => i.json);\nconst saved = sheetRowsFrom($input.all());\nreturn stepSkipSaved(leads, saved, job).map((json) => ({ json }));`,
    }),
  );
  wf.add(stopCheck('Any New Leads?', [1760, 280]));

  wf.connect('Find Clients Form', '⚙️ Settings');
  wf.chain('⚙️ Settings', 'Prepare Search', 'Settings OK?');
  wf.connect('Settings OK?', 'Search Google Maps', 0);
  wf.connect('Settings OK?', 'Show Message', 1);
  wf.chain('Search Google Maps', 'Clean Leads', 'Read Saved Leads', 'Skip Saved Leads', 'Any New Leads?');
  wf.connect('Any New Leads?', 'Show Message', 1);

  // --- 2. website checks ---
  let scoreInput;
  if (pack.needsWebsiteCheck) {
    const fetchParams = {
      url: '={{ $json.website }}',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' },
          { name: 'Accept', value: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
        ],
      },
      options: {
        batching: { batch: { batchSize: 10, batchInterval: 300 } },
        redirect: { redirect: { followRedirects: true, maxRedirects: 10 } },
        response: { response: { fullResponse: true, neverError: true, responseFormat: 'text', outputPropertyName: 'html' } },
        timeout: 20000,
      },
    };
    // A Facebook/Instagram/booking-platform link is not the business's own website: don't fetch or judge it.
    wf.add(ifNode('Has Website?', [1980, 280], [condition('hasSite', '={{ !!$json.website && !$json.websitePlatform }}', 'true')]));
    wf.add(httpNode('Fetch Website', [2200, 200], fetchParams, { onError: 'continueRegularOutput' }));
    wf.add(
      code('Check Website', [2420, 200], {
        purpose: 'Reads each homepage: did it load, contact email, booking/chat tools, social links, copyright year...',
        adapter: `const items = $input.all();\nreturn items.map((item, i) => ({\n  json: stepCheckWebsite($('Has Website?').itemMatching(i).json, item.json, new Date()),\n  pairedItem: { item: i },\n}));`,
      }),
    );
    wf.connect('Any New Leads?', 'Has Website?', 0);
    wf.connect('Has Website?', 'Fetch Website', 0);
    wf.chain('Fetch Website', 'Check Website');
    let checked = 'Check Website';
    if (pack.weights.site_down) {
      // "Website down" is only claimed when a second attempt 15 seconds later fails too.
      wf.add(ifNode('Recheck Needed?', [2640, 200], [condition('recheck', '={{ $json.needsRecheck === true }}', 'true')]));
      wf.add({
        name: 'Wait Before Recheck',
        type: 'n8n-nodes-base.wait',
        typeVersion: V.wait,
        position: [2860, 60],
        webhookId: require('./common').stableUuid('wait-recheck', wf.key),
        parameters: { amount: 15, unit: 'seconds' },
      });
      wf.add(httpNode('Fetch Website Again', [3080, 60], fetchParams, { onError: 'continueRegularOutput' }));
      wf.add(
        code('Recheck Website', [3300, 60], {
          purpose: 'Second look at sites that failed the first time. Only a failure seen twice is reported.',
          adapter: `const items = $input.all();\nreturn items.map((item, i) => ({\n  json: stepRecheckWebsite($('Wait Before Recheck').itemMatching(i).json, item.json, new Date()),\n  pairedItem: { item: i },\n}));`,
        }),
      );
      wf.add(merge('Checked', [3520, 200], 2));
      wf.chain('Check Website', 'Recheck Needed?');
      wf.connect('Recheck Needed?', 'Wait Before Recheck', 0);
      wf.chain('Wait Before Recheck', 'Fetch Website Again', 'Recheck Website');
      wf.connect('Recheck Website', 'Checked', 0, 0);
      wf.connect('Recheck Needed?', 'Checked', 1, 1);
      checked = 'Checked';
    }
    if (pack.needsPageSpeed) {
      wf.add(merge('All Leads', [allLeadsX, 300], 3));
      // Sites with a certificate error go to PageSpeed too: Chrome confirms (or not) what our check saw.
      wf.add(ifNode('Run PageSpeed?', [3740, 200], [condition('psi', "={{ ['ok', 'ssl-error'].includes($json.site.status) && !$json.websitePlatform }}", 'true')]));
      wf.add(
        httpNode(
          'PageSpeed Test',
          [3960, 120],
          {
            url: '={{ $json.pageSpeedUrl }}',
            authentication: 'genericCredentialType',
            genericAuthType: 'httpHeaderAuth',
            options: { batching: { batch: { batchSize: 10, batchInterval: 1000 } }, timeout: 120000 },
          },
          { onError: 'continueRegularOutput' },
        ),
      );
      wf.add(
        code('Read PageSpeed', [4180, 120], {
          purpose: "Reads Google's mobile PageSpeed (Lighthouse) result for each site.",
          adapter: `const items = $input.all();\nreturn items.map((item, i) => ({\n  json: stepReadPageSpeed($('Run PageSpeed?').itemMatching(i).json, item.json),\n  pairedItem: { item: i },\n}));`,
        }),
      );
      wf.chain(checked, 'Run PageSpeed?');
      wf.connect('Run PageSpeed?', 'PageSpeed Test', 0);
      wf.chain('PageSpeed Test', 'Read PageSpeed');
      wf.connect('Read PageSpeed', 'All Leads', 0, 0);
      wf.connect('Run PageSpeed?', 'All Leads', 1, 1);
      wf.connect('Has Website?', 'All Leads', 1, 2);
    } else {
      wf.add(merge('All Leads', [allLeadsX, 300], 2));
      wf.connect(checked, 'All Leads', 0, 0);
      wf.connect('Has Website?', 'All Leads', 1, 1);
    }
    scoreInput = 'All Leads';
  } else {
    scoreInput = 'Any New Leads?';
  }

  // --- 3. score + pitch ---
  wf.add(
    code('Find Problems & Score', [3520, 300], {
      purpose: 'Runs the niche checks, scores each lead 0-100 and ranks them (Hot / Warm / Low). One email address or website is pitched once.',
      adapter: `const job = ${JOB};\nconst leads = $input.all().map((i) => i.json);\nconst saved = sheetRowsFrom($('Read Saved Leads').all());\nreturn stepScoreLeads(leads, job, new Date(), saved).map((json) => ({ json }));`,
    }),
  );
  if (scoreInput === 'Any New Leads?') wf.connect('Any New Leads?', 'Find Problems & Score', 0);
  else wf.connect(scoreInput, 'Find Problems & Score');
  wf.add(ifNode('Worth a Pitch?', [3740, 300], [condition('wants', '={{ $json.wantsPitch === true }}', 'true')]));
  wf.add(
    code('Build AI Request', [3960, 220], {
      purpose: 'Builds the Claude request: verified facts about the lead + your offer + writing rules.',
      adapter: `const job = ${JOB};\nconst items = $input.all();\nreturn items.map((item, i) => ({ json: stepBuildPitchRequest(item.json, job), pairedItem: { item: i } }));`,
    }),
  );
  wf.add(
    httpNode(
      'Write Pitch with Claude',
      [4180, 220],
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
        options: { batching: { batch: { batchSize: 3, batchInterval: 4000 } }, timeout: 180000 },
      },
      { onError: 'continueRegularOutput' },
    ),
  );
  wf.add(
    code('Read AI Pitch', [4400, 220], {
      purpose: "Reads Claude's pitch. Temporary errors (overloaded, rate limit) get one retry; anything else uses a template pitch.",
      adapter: `const job = ${JOB};\nconst items = $input.all();\nreturn items.map((item, i) => ({\n  json: stepReadPitch($('Build AI Request').itemMatching(i).json, item.json, job, { allowRetry: true }),\n  pairedItem: { item: i },\n}));`,
    }),
  );
  wf.add(ifNode('Retry Needed?', [4620, 220], [condition('retry', '={{ $json.needsRetry === true }}', 'true')]));
  wf.add({
    name: 'Wait Before Retry',
    type: 'n8n-nodes-base.wait',
    typeVersion: V.wait,
    position: [4840, 60],
    webhookId: require('./common').stableUuid('wait', wf.key),
    parameters: { amount: 15, unit: 'seconds' },
  });
  wf.add(
    httpNode(
      'Retry Pitch with Claude',
      [5060, 60],
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
        options: { batching: { batch: { batchSize: 2, batchInterval: 5000 } }, timeout: 180000 },
      },
      { onError: 'continueRegularOutput' },
    ),
  );
  wf.add(
    code('Read Retried Pitch', [5280, 60], {
      purpose: 'Second and last attempt: Claude\'s pitch, or the template pitch if it failed again.',
      adapter: `const job = ${JOB};\nconst items = $input.all();\nreturn items.map((item, i) => ({\n  json: stepReadPitch($('Wait Before Retry').itemMatching(i).json, item.json, job),\n  pairedItem: { item: i },\n}));`,
    }),
  );
  wf.add(merge('Pitched + Skipped', [5500, 300], 3));
  wf.chain('Find Problems & Score', 'Worth a Pitch?');
  wf.connect('Worth a Pitch?', 'Build AI Request', 0);
  wf.chain('Build AI Request', 'Write Pitch with Claude', 'Read AI Pitch', 'Retry Needed?');
  wf.connect('Retry Needed?', 'Wait Before Retry', 0);
  wf.chain('Wait Before Retry', 'Retry Pitch with Claude', 'Read Retried Pitch');
  wf.connect('Retry Needed?', 'Pitched + Skipped', 1, 0);
  wf.connect('Read Retried Pitch', 'Pitched + Skipped', 0, 1);
  wf.connect('Worth a Pitch?', 'Pitched + Skipped', 1, 2);

  // --- 4. sheet first, then drafts (a failure can never leave Gmail drafts without rows) ---
  const sheetWrite = (name, position, operation, extraColumns) => ({
    name,
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: V.googleSheets,
    position,
    retryOnFail: true,
    maxTries: 4,
    waitBetweenTries: 5000,
    parameters: Object.assign({ authentication: 'oAuth2', resource: 'sheet', operation }, sheetLocator(`={{ ${JOB}.settings.googleSheetUrl }}`), {
      columns: Object.assign(
        {
          mappingMode: 'autoMapInputData',
          value: {},
          matchingColumns: [],
          schema: LEAD_COLUMNS.map((c) => ({ id: c, displayName: c, required: false, defaultMatch: c === 'Place ID' && operation === 'update', display: true, type: 'string', canBeUsedToMatch: true })),
        },
        extraColumns || {},
      ),
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' },
    }),
  });
  wf.add({
    name: 'Recheck Sheet',
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: V.googleSheets,
    position: [5720, 300],
    executeOnce: true,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: Object.assign({ authentication: 'oAuth2', resource: 'sheet', operation: 'read' }, sheetLocator(`={{ ${JOB}.settings.googleSheetUrl }}`), { filtersUI: {}, options: {} }),
  });
  wf.add(
    code('Build Sheet Rows', [5940, 300], {
      purpose: 'One row per lead, best leads first, matching the columns of the Leads sheet. Skips businesses another run saved in the meantime.',
      adapter: `const job = ${JOB};\nconst leads = $('Pitched + Skipped').all().map((i) => i.json);\nconst savedNow = sheetRowsFrom($input.all()).filter((r) => !r.error);\nconst rows = stepSheetRows(leads, job, new Date(), savedNow);\nif (!rows.length) return [{ json: stop('Nothing new this time', 'Another run saved these businesses to your sheet a moment ago, so they were skipped.') }];\nreturn rows.map((json) => ({ json }));`,
    }),
  );
  wf.add(stopCheck('Anything to Save?', [6160, 300]));
  wf.add(sheetWrite('Save to Google Sheet', [6380, 300], 'append'));
  wf.add(
    ifNode('Create Draft?', [6600, 300], [
      condition('ready', '={{ $json.Status }}', 'equals', 'string', 'Draft ready'),
      condition('hasEmail', '={{ $json.Email }}', 'notEmpty', 'string'),
    ]),
  );
  wf.add({
    name: 'Create Gmail Draft',
    type: 'n8n-nodes-base.gmail',
    typeVersion: V.gmail,
    position: [6820, 220],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'draft',
      operation: 'create',
      subject: "={{ $json['Email Subject'] }}",
      emailType: 'text',
      message: "={{ $json['Email Body'] }}",
      options: { sendTo: '={{ $json.Email }}' },
    },
  });
  wf.add(
    code('Read Draft IDs', [7040, 220], {
      purpose: 'Keeps the Gmail draft and thread IDs so follow-ups land in the same email thread.',
      adapter: `const items = $input.all();\nreturn items.map((item, i) => ({\n  json: stepReadDraft($('Create Draft?').itemMatching(i).json, item.json),\n  pairedItem: { item: i },\n}));`,
    }),
  );
  wf.add(sheetWrite('Save Draft IDs', [7260, 220], 'update', { matchingColumns: ['Place ID'] }));
  wf.add(merge('Saved', [7480, 300], 2));
  wf.add(
    code('Summary', [7700, 300], {
      purpose: 'Counts what was found for the results page.',
      adapter: `const job = ${JOB};\nconst rows = $('Build Sheet Rows').all().map((i) => i.json);\nlet drafts = [];\ntry {\n  drafts = $('Read Draft IDs').all().map((i) => i.json);\n} catch (e) {\n  drafts = []; // no lead needed a draft\n}\nconst leads = $('Pitched + Skipped').all().filter((i) => !i.json.stop).length;\nreturn [{ json: stepSummary(rows, drafts, job, { savedElsewhere: Math.max(0, leads - rows.length) }) }];`,
    }),
  );
  wf.add(formEnd(wf.key, 'Show Results', [7920, 300], '={{ $json.title }}', '={{ $json.message }}\n\n<a href="{{ $json.sheetUrl }}" target="_blank">Open your Google Sheet</a>'));

  wf.chain('Pitched + Skipped', 'Recheck Sheet', 'Build Sheet Rows', 'Anything to Save?');
  wf.connect('Anything to Save?', 'Save to Google Sheet', 0);
  wf.connect('Anything to Save?', 'Show Message', 1);
  wf.chain('Save to Google Sheet', 'Create Draft?');
  wf.connect('Create Draft?', 'Create Gmail Draft', 0);
  wf.chain('Create Gmail Draft', 'Read Draft IDs', 'Save Draft IDs');
  wf.connect('Save Draft IDs', 'Saved', 0, 0);
  wf.connect('Create Draft?', 'Saved', 1, 1);
  wf.chain('Saved', 'Summary', 'Show Results');

  wf.layoutRows([
    ['Start Here', 'Step 1 Note', 'Find Clients Form', '⚙️ Settings', 'Prepare Search', 'Settings OK?', 'Search Google Maps', 'Clean Leads', 'Read Saved Leads', 'Skip Saved Leads', 'Any New Leads?', 'Show Message'],
    ['Step 2 Note', 'Has Website?', 'Fetch Website', 'Check Website', 'Recheck Needed?', 'Wait Before Recheck', 'Fetch Website Again', 'Recheck Website', 'Checked', 'Run PageSpeed?', 'PageSpeed Test', 'Read PageSpeed', 'All Leads'],
    ['Step 3 Note', 'Find Problems & Score', 'Worth a Pitch?', 'Build AI Request', 'Write Pitch with Claude', 'Read AI Pitch', 'Retry Needed?', 'Wait Before Retry', 'Retry Pitch with Claude', 'Read Retried Pitch', 'Pitched + Skipped'],
    ['Step 4 Note', 'Recheck Sheet', 'Build Sheet Rows', 'Anything to Save?', 'Save to Google Sheet', 'Create Draft?', 'Create Gmail Draft', 'Read Draft IDs', 'Save Draft IDs', 'Saved', 'Summary', 'Show Results'],
  ]);
  const json = wf.toJSON();
  json.meta.clientFinder = { tier: 'paid', niche: pack.id, product: product.productName, version: product.version };
  return json;
}

module.exports = { buildClientFinder, defaultSettings, formTrigger, formEnd, placesSearchNode, httpNode, JOB };
