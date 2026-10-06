// Builds the free "Client Finder Lite" workflow: Google Maps search → CSV download, flags businesses
// with no website. No AI, no Google OAuth: the only credential is a Google API key.

const { V, WorkflowBuilder, sticky, code, condition, ifNode, setNode, stableUuid } = require('./common');
const { formEnd, placesSearchNode, JOB } = require('./client-finder');
const product = require('../../config/product.json');

function buildLite() {
  const wf = new WorkflowBuilder('client-finder-lite', 'Client Finder Lite (free)');
  const path = 'client-finder-lite';

  wf.add(
    sticky(
      'Start Here',
      [-520, -140],
      `## 👋 Client Finder Lite (free)\nFinds local businesses on Google Maps and flags the ones with **no website**, which are perfect leads for web designers. You get a CSV with name, phone, rating and Maps link.\n\n**Setup (5 min, see QUICKSTART.pdf):**\n1. Create a Google API key with **Places API (New)** enabled.\n2. In n8n create a **Header Auth** credential: Name \`X-Goog-Api-Key\`, Value = your key. Select it on *Search Google Maps*.\n3. Activate/publish the workflow, open *Find Leads Form* and copy the Production URL.\n\nSubmit the form and your CSV downloads automatically.`,
      { width: 480, height: 470, color: 4 },
    ),
  );
  wf.add(
    sticky(
      'Upgrade Note',
      [1300, -140],
      `## 🚀 Want the full Client Finder?\nThe paid version checks every website (speed, mobile, SSL, booking, chat...), scores each lead, writes a personalized pitch with Claude, saves everything to a Google Sheet CRM and puts ready-to-send drafts in your Gmail.\n\n👉 ${product.storeUrl}`,
      { width: 520, height: 260, color: 6 },
    ),
  );

  wf.add({
    name: 'Find Leads Form',
    type: 'n8n-nodes-base.formTrigger',
    typeVersion: V.formTrigger,
    position: [0, 300],
    webhookId: stableUuid('webhook', path),
    parameters: {
      formTitle: 'Client Finder Lite',
      formDescription: 'Type a business type and a city. You get a CSV of businesses from Google Maps, with the ones that have no website at the top.',
      formFields: {
        values: [
          { fieldLabel: 'Business type', placeholder: 'e.g. dentists', requiredField: true },
          { fieldLabel: 'City or area', placeholder: 'e.g. Austin, TX', requiredField: true },
          {
            fieldLabel: 'How many businesses?',
            fieldType: 'dropdown',
            fieldOptions: { values: [{ option: '20' }, { option: '40' }, { option: '60' }] },
            requiredField: true,
          },
        ],
      },
      responseMode: 'lastNode',
      options: { path, appendAttribution: false, buttonLabel: 'Find leads' },
    },
  });
  wf.add(setNode('⚙️ Settings', [220, 300], { searchLanguage: 'en', searchCountryCode: '' }));
  wf.add(
    code('Prepare Search', [440, 300], {
      purpose: 'Checks the form and builds the Google Maps search.',
      adapter: `return [{ json: stepPrepareJob($input.first().json, null, { requireSheet: false }) }];`,
    }),
  );
  wf.add(ifNode('Search OK?', [660, 300], [condition('notStopped', '={{ $json.stop === true }}', 'false')]));
  wf.add(placesSearchNode([880, 280]));
  wf.add(
    code('Clean Leads', [1100, 280], {
      purpose: 'One item per open business, duplicates removed.',
      adapter: `const job = ${JOB};\nconst pages = $input.all().map((i) => i.json);\nreturn stepCleanLeads(pages, job).map((json) => ({ json }));`,
    }),
  );
  wf.add(ifNode('Found Any?', [1320, 280], [condition('notStopped', '={{ $json.stop === true }}', 'false')]));
  wf.add(
    code('Build CSV Rows', [1540, 280], {
      purpose: 'Businesses without a website first, then by number of reviews.',
      adapter: `const job = ${JOB};\nconst leads = $input.all().map((i) => i.json);\nreturn stepLiteRows(leads, job).map((json) => ({ json }));`,
    }),
  );
  wf.add({
    name: 'Convert to CSV',
    type: 'n8n-nodes-base.convertToFile',
    typeVersion: V.convertToFile,
    position: [1760, 280],
    parameters: { operation: 'csv', binaryPropertyName: 'data', options: { fileName: `={{ 'leads-' + ${JOB}.search.textQuery.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.csv' }}` } },
  });
  wf.add({
    name: 'Download CSV',
    type: 'n8n-nodes-base.form',
    typeVersion: V.form,
    position: [1980, 280],
    webhookId: stableUuid('form-end', wf.key, 'Download CSV'),
    parameters: {
      operation: 'completion',
      respondWith: 'returnBinary',
      completionTitle: 'Your leads are ready',
      completionMessage: `Your CSV download should start automatically. Businesses with no website are at the top.\n\nWant website checks, AI-written pitches and Gmail drafts too? ${product.storeUrl}`,
      inputDataFieldName: 'data',
      options: {},
    },
  });
  wf.add(formEnd(wf.key, 'Show Message', [1320, 560], '={{ $json.title }}', '={{ $json.message }}'));

  wf.chain('Find Leads Form', '⚙️ Settings', 'Prepare Search', 'Search OK?');
  wf.connect('Search OK?', 'Search Google Maps', 0);
  wf.connect('Search OK?', 'Show Message', 1);
  wf.chain('Search Google Maps', 'Clean Leads', 'Found Any?');
  wf.connect('Found Any?', 'Build CSV Rows', 0);
  wf.connect('Found Any?', 'Show Message', 1);
  wf.chain('Build CSV Rows', 'Convert to CSV', 'Download CSV');

  const json = wf.toJSON();
  json.meta.clientFinder = { tier: 'lite', product: product.productName, version: product.version };
  return json;
}

module.exports = { buildLite };
