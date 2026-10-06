// Static checks on every generated workflow file, plus a sandboxed run of every Code node.
// Node-definition checks use a real n8n install: set N8N_MODULES to its node_modules folder
// (e.g. N8N_MODULES=/path/to/n8n/node_modules npm run test:structure).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { outputs } = require('../../scripts/build');
const steps = require('../../src/lib/steps');
const packs = require('../../src/niches');
const fx = require('../fixtures/businesses');

const files = outputs();
const workflows = Object.entries(files).map(([rel, text]) => ({ rel, wf: JSON.parse(text) }));
const N8N = process.env.N8N_MODULES || '';

const NODE_FILES = {
  'n8n-nodes-base.formTrigger': 'Form/FormTrigger.node.js',
  'n8n-nodes-base.form': 'Form/Form.node.js',
  'n8n-nodes-base.manualTrigger': 'ManualTrigger/ManualTrigger.node.js',
  'n8n-nodes-base.scheduleTrigger': 'Schedule/ScheduleTrigger.node.js',
  'n8n-nodes-base.set': 'Set/Set.node.js',
  'n8n-nodes-base.code': 'Code/Code.node.js',
  'n8n-nodes-base.httpRequest': 'HttpRequest/HttpRequest.node.js',
  'n8n-nodes-base.if': 'If/If.node.js',
  'n8n-nodes-base.merge': 'Merge/Merge.node.js',
  'n8n-nodes-base.googleSheets': 'Google/Sheet/GoogleSheets.node.js',
  'n8n-nodes-base.gmail': 'Google/Gmail/Gmail.node.js',
  'n8n-nodes-base.convertToFile': 'Files/ConvertToFile/ConvertToFile.node.js',
  'n8n-nodes-base.stickyNote': 'StickyNote/StickyNote.node.js',
  'n8n-nodes-base.stopAndError': 'StopAndError/StopAndError.node.js',
  'n8n-nodes-base.noOp': 'NoOp/NoOp.node.js',
  'n8n-nodes-base.wait': 'Wait/Wait.node.js',
};

const TRIGGERS = ['n8n-nodes-base.formTrigger', 'n8n-nodes-base.manualTrigger', 'n8n-nodes-base.scheduleTrigger'];

test('generated files are in sync with src (npm run build)', () => {
  for (const [rel, text] of Object.entries(files)) {
    const onDisk = path.join(__dirname, '..', '..', 'products', rel);
    assert.ok(fs.existsSync(onDisk), `${rel} missing: run npm run build`);
    assert.equal(fs.readFileSync(onDisk, 'utf8'), text, `${rel} is stale: run npm run build`);
  }
});

for (const { rel, wf } of workflows) {
  test(`${rel}: graph is valid`, () => {
    const names = new Set(wf.nodes.map((n) => n.name));
    assert.equal(names.size, wf.nodes.length, 'node names are unique');
    assert.equal(new Set(wf.nodes.map((n) => n.id)).size, wf.nodes.length, 'node ids are unique');
    for (const [from, conn] of Object.entries(wf.connections)) {
      assert.ok(names.has(from), `connection from unknown node ${from}`);
      for (const out of conn.main) for (const c of out) assert.ok(names.has(c.node), `${from} → unknown node ${c.node}`);
    }
    // Every executable node is reachable from a trigger.
    const reach = new Set();
    const queue = wf.nodes.filter((n) => TRIGGERS.includes(n.type)).map((n) => n.name);
    assert.ok(queue.length >= 1, 'has a trigger');
    while (queue.length) {
      const n = queue.shift();
      if (reach.has(n)) continue;
      reach.add(n);
      for (const out of (wf.connections[n] || { main: [] }).main) for (const c of out) queue.push(c.node);
    }
    for (const n of wf.nodes) if (n.type !== 'n8n-nodes-base.stickyNote') assert.ok(reach.has(n.name), `${n.name} is not connected`);
    // Merge nodes get exactly as many inputs as they declare.
    for (const m of wf.nodes.filter((n) => n.type === 'n8n-nodes-base.merge')) {
      const inputs = new Set();
      for (const conn of Object.values(wf.connections)) for (const out of conn.main) for (const c of out) if (c.node === m.name) inputs.add(c.index);
      assert.equal(inputs.size, m.parameters.numberInputs || 2, `${m.name} inputs`);
    }
    assert.equal(wf.settings.executionOrder, 'v1');
  });

  test(`${rel}: ships no credentials or secrets`, () => {
    const text = JSON.stringify(wf);
    for (const n of wf.nodes) assert.equal(n.credentials, undefined, `${n.name} must not reference a credential`);
    assert.doesNotMatch(text, /sk-ant-[a-z0-9]/i);
    assert.doesNotMatch(text, /AIza[0-9A-Za-z_-]{20,}/);
    assert.doesNotMatch(text, /ya29\.[0-9A-Za-z_-]+/);
    assert.doesNotMatch(text, /"id"\s*:\s*"[0-9]+"/, 'no instance-specific ids');
    assert.equal(wf.id, undefined);
  });
}

test('every webhook path and webhook id is unique across the bundle', () => {
  const paths = new Map();
  const ids = new Map();
  for (const { rel, wf } of workflows) {
    if (rel.startsWith('starter/')) continue; // the Starter file is the same workflow as Pro's web-design file
    for (const n of wf.nodes) {
      if (n.webhookId) {
        assert.ok(!ids.has(n.webhookId), `${rel}:${n.name} reuses webhookId of ${ids.get(n.webhookId)}`);
        ids.set(n.webhookId, `${rel}:${n.name}`);
      }
      const p = n.parameters && n.parameters.options && n.parameters.options.path;
      if (p) {
        assert.ok(!paths.has(p), `${rel}: form path ${p} also used by ${paths.get(p)}`);
        paths.set(p, rel);
      }
    }
  }
  assert.equal(paths.size, 6); // Lite + 5 niche workflows (the follow-up workflow has no form)
});

test('node types and parameters match the installed n8n node definitions', { skip: !N8N && 'set N8N_MODULES to run' }, () => {
  const { NodeHelpers } = require(path.join(N8N, 'n8n-workflow'));
  const base = path.join(N8N, 'n8n-nodes-base', 'dist', 'nodes');
  const load = (type, version) => {
    const mod = require(path.join(base, NODE_FILES[type]));
    let inst = null;
    for (const v of Object.values(mod)) {
      if (typeof v !== 'function') continue;
      try {
        const candidate = new v();
        if (candidate && candidate.description) {
          inst = candidate;
          break;
        }
      } catch (e) {
        // not a node class
      }
    }
    assert.ok(inst, `could not load ${type}`);
    if (inst.nodeVersions) {
      assert.ok(inst.nodeVersions[version], `${type} has no version ${version} (has ${Object.keys(inst.nodeVersions)})`);
      return inst.nodeVersions[version];
    }
    const versions = [].concat(inst.description.version);
    assert.ok(versions.includes(version), `${type} v${version} not in ${versions}`);
    return inst;
  };
  const missingKeys = (ours, resolved, prefix) => {
    const missing = [];
    if (!ours || typeof ours !== 'object' || Array.isArray(ours)) return missing;
    for (const [k, v] of Object.entries(ours)) {
      if (k === '__rl' || k === 'mode' || k === 'value' || k === 'cachedResultName') continue;
      if (!resolved || !(k in resolved)) missing.push(prefix + k);
      else if (v && typeof v === 'object' && !Array.isArray(v) && resolved[k] && typeof resolved[k] === 'object') missing.push(...missingKeys(v, resolved[k], `${prefix}${k}.`));
    }
    return missing;
  };
  for (const { rel, wf } of workflows) {
    for (const node of wf.nodes) {
      assert.ok(NODE_FILES[node.type], `${rel}: unexpected node type ${node.type}`);
      const impl = load(node.type, node.typeVersion);
      const resolved = NodeHelpers.getNodeParameters(impl.description.properties, node.parameters, true, false, node, impl.description);
      const missing = missingKeys(node.parameters, resolved, '');
      // jsonOutput etc. are not used; assignments/conditions are type-specific collections n8n keeps as-is.
      assert.deepEqual(missing, [], `${rel}:${node.name} has parameters n8n ignores: ${missing.join(', ')}`);
    }
  }
});

// ---- Code nodes in a sandbox that mimics the n8n Code node API ----

// n8n runs Code nodes in an isolated sandbox: only standard JavaScript built-ins exist (no URL, Buffer,
// require, timers). A fresh vm context reproduces that, so a Node-only API fails here exactly like in n8n.
const vm = require('vm');

function runCode(jsCode, input, nodeData) {
  const items = input.map((json, i) => ({ json, pairedItem: { item: i } }));
  const $input = { all: () => items, first: () => items[0], item: items[0] };
  const $ = (name) => {
    const data = nodeData[name];
    if (!data) throw new Error(`Code node referenced $('${name}') which the test did not provide`);
    return { first: () => ({ json: data[0] }), all: () => data.map((json) => ({ json })), itemMatching: (i) => ({ json: data[i] }) };
  };
  const context = vm.createContext({ $input, $, console });
  const result = vm.runInContext(`(async () => {\n${jsCode}\n})()`, context, { timeout: 10000 });
  // Values created inside the context have the context's prototypes; normalise them for assert.
  return Promise.resolve(result).then((v) => JSON.parse(JSON.stringify(v)));
}

const FORM = { 'Business type': 'dentists', 'City or area': 'Austin, TX', 'How many businesses?': '40' };
const SHEET = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit';

test('the sandbox really lacks Node-only globals', async () => {
  const out = await runCode('return [{ json: { url: typeof URL, buffer: typeof Buffer, req: typeof require } }];', [], {});
  assert.deepEqual(out[0].json, { url: 'undefined', buffer: 'undefined', req: 'undefined' });
});

test('every Code node runs in a sandbox and returns n8n items', async () => {
  const web = packs.find((p) => p.id === 'web-design');
  const settings = Object.assign(require('../../src/workflows/client-finder').defaultSettings(web), { yourName: 'Asha', googleSheetUrl: SHEET });
  const job = steps.stepPrepareJob(Object.assign({}, FORM, settings), web, { requireSheet: true });
  const leads = steps.stepCleanLeads(fx.placesPages(), job);
  const sun = leads.find((l) => l.placeId === 'ChIJsunrise0001');
  const checked = steps.stepCheckWebsite(sun, { statusCode: 200, html: fx.byKey('sunrise').html });
  const withPsi = steps.stepReadPageSpeed(checked, fx.psiResponse(fx.byKey('sunrise')));
  const scored = steps.stepScoreLeads([withPsi], job, new Date(), []);
  const oak = leads.find((l) => l.placeId === 'ChIJoakhill0005');
  const oakFirst = steps.stepCheckWebsite(oak, { statusCode: 404, html: '' });
  const req = steps.stepBuildPitchRequest(scored[0], job);
  const claude = { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"subject":"s","email_body":"b","dm_message":"d","call_opener":"c"}' }] };
  const pitched = steps.stepReadPitch(req, claude, job);
  const rows = steps.stepSheetRows([pitched], job, new Date(), []);
  const cases = {
    'Prepare Search': { input: [Object.assign({}, FORM, settings)], check: (out) => assert.equal(out[0].json.stop, false) },
    'Clean Leads': { input: fx.placesPages(), nodes: { 'Prepare Search': [job] }, check: (out) => assert.equal(out.length, 13) },
    'Skip Saved Leads': { input: [{}], nodes: { 'Prepare Search': [job], 'Clean Leads': leads }, check: (out) => assert.equal(out.length, 13) },
    'Check Website': { input: [{ statusCode: 200, html: fx.byKey('sunrise').html }], nodes: { 'Has Website?': [sun] }, check: (out) => assert.equal(out[0].json.email, 'info@sunrise-dental.test') },
    'Recheck Website': { input: [{ statusCode: 404, html: '' }], nodes: { 'Wait Before Recheck': [oakFirst] }, check: (out) => assert.deepEqual([out[0].json.site.status, out[0].json.site.rechecked, out[0].json.needsRecheck], ['not-found', true, false]) },
    'Read PageSpeed': { input: [fx.psiResponse(fx.byKey('sunrise'))], nodes: { 'Run PageSpeed?': [checked] }, check: (out) => assert.equal(out[0].json.psi.performance, 23) },
    'Find Problems & Score': { input: [withPsi], nodes: { 'Prepare Search': [job], 'Read Saved Leads': [{}] }, check: (out) => assert.ok(out[0].json.score > 0) },
    'Build AI Request': { input: [scored[0]], nodes: { 'Prepare Search': [job] }, check: (out) => assert.ok(out[0].json.aiRequest.body.messages) },
    'Read AI Pitch': { input: [claude], nodes: { 'Prepare Search': [job], 'Build AI Request': [req] }, check: (out) => assert.equal(out[0].json.pitch.subject, 's') },
    'Read Retried Pitch': { input: [{ error: { message: '529 - overloaded', status: 529 } }], nodes: { 'Prepare Search': [job], 'Wait Before Retry': [req] }, check: (out) => assert.match(out[0].json.aiStatus, /Template used/) },
    'Read Draft IDs': { input: [{ id: 'r1', message: { threadId: 't1' } }], nodes: { 'Create Draft?': [rows[0]] }, check: (out) => assert.deepEqual(out[0].json, { 'Place ID': 'ChIJsunrise0001', 'Draft ID': 'r1', 'Thread ID': 't1' }) },
    'Build Sheet Rows': { input: [{}], nodes: { 'Prepare Search': [job], 'Pitched + Skipped': [pitched] }, check: (out) => assert.equal(out[0].json['Place ID'], 'ChIJsunrise0001') },
    // 'Read Draft IDs' is deliberately missing: the Summary must cope with a run that created no drafts.
    Summary: { input: rows, nodes: { 'Prepare Search': [job], 'Build Sheet Rows': rows, 'Pitched + Skipped': [pitched] }, check: (out) => assert.match(out[0].json.title, /1 new lead/) },
    'Build CSV Rows': { input: leads, nodes: { 'Prepare Search': [job] }, check: (out) => assert.equal(out.length, 13) },
  };
  const fjob = steps.stepPrepareFollowUpJob(Object.assign({}, settings, { followUpDays: '3,7', maxFollowUps: 2 }), packs);
  const fRows = [{ 'Place ID': 'a', Business: 'A', Email: 'a@a.test', Status: 'Contacted', 'Last Contacted': '2026-01-01', 'Follow-ups': 0, 'Email Subject': 'Hi', Niche: 'Web Design' }];
  const actions = steps.stepDecideFollowUps(fRows, [], [], fjob.settings, new Date('2026-10-06'));
  const fReq = steps.stepBuildFollowUpRequest(actions[0], fjob);
  const fRead = steps.stepReadFollowUp(fReq, claude, fjob);
  Object.assign(cases, {
    'Prepare Follow-ups': { input: [Object.assign({}, settings)], check: (out) => assert.equal(out[0].json.stop, false) },
    'Plan Gmail Searches': { input: fRows, nodes: { 'Prepare Follow-ups': [fjob] }, check: (out) => assert.equal(out.length, 2) },
    'Plan Thread Checks': { input: [{}], nodes: { 'Read Leads': fRows }, check: (out) => assert.deepEqual(out[0].json, { threadId: '', noThreads: true }) },
    'Decide Follow-ups': { input: [{ threadId: '', noThreads: true }], nodes: { 'Prepare Follow-ups': [fjob], 'Read Leads': fRows, 'Search Gmail': [{}] }, check: (out) => assert.equal(out[0].json.action, 'follow-up') },
    'Build Follow-up Request': { input: [actions[0]], nodes: { 'Prepare Follow-ups': [fjob] }, check: (out) => assert.ok(out[0].json.aiRequest) },
    'Read Follow-up': { input: [{ model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"email_body":"Nudge"}' }] }], nodes: { 'Prepare Follow-ups': [fjob], 'Build Follow-up Request': [fReq] }, check: (out) => assert.match(out[0].json.followUp.body, /^Nudge/) },
    'Read Follow-up Draft': { input: [{ id: 'r', message: { threadId: 't' } }], nodes: { 'Read Follow-up': [fRead] }, check: (out) => assert.equal(out[0].json['Follow-ups'], 1) },
    'Sheet Updates': { input: [actions[0].update], check: (out) => assert.equal(out.length, 1) },
    Report: { input: [{}], nodes: { 'Sheet Updates': [actions[0].update] }, check: (out) => assert.equal(out[0].json.followUpsDrafted, 1) },
  });
  let ran = 0;
  for (const { rel, wf } of workflows) {
    for (const node of wf.nodes.filter((n) => n.type === 'n8n-nodes-base.code')) {
      const c = cases[node.name];
      assert.ok(c, `no sandbox case for Code node "${node.name}" in ${rel}`);
      let nodes = c.nodes || {};
      if (node.name === 'Prepare Search' && rel.includes('lite')) nodes = {};
      const input = node.name === 'Prepare Search' && rel.includes('lite') ? [FORM] : c.input;
      const out = await runCode(node.parameters.jsCode, input, nodes);
      assert.ok(Array.isArray(out), `${rel}:${node.name} returns an array`);
      for (const item of out) assert.ok(item && typeof item.json === 'object', `${rel}:${node.name} returns {json} items`);
      if (!(rel.includes('lite') && node.name === 'Prepare Search')) c.check(out);
      ran++;
    }
  }
  assert.ok(ran >= 60, `ran ${ran} code nodes`);
});
