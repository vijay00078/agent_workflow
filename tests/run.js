// End-to-end test runner: loads a workflow from product/workflows, swaps external
// services for probes / pinned data / local fixtures, runs it in a real n8n
// instance (manual mode) and prints what every node produced.
//
// usage: node tests/run.js tests/cases/01-inbox.js [--verbose]
const fs = require('fs');
const path = require('path');
const client = require('./n8n-client');

const ROOT = path.join(__dirname, '..');
const OVERRIDES_FILE = path.join(__dirname, 'mock-openai', 'overrides.json');

function flatten(obj, prefix = '', out = []) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    if (obj.__rl) {
      out.push([prefix, obj.value]);
      return out;
    }
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else {
    out.push([prefix, obj]);
  }
  return out;
}

function typed(value) {
  if (Array.isArray(value)) return 'array';
  if (value && typeof value === 'object') return 'object';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

// Replace a node that talks to an external service with a Set node of the same name.
// It evaluates every expression of the original parameters (so broken expressions fail
// the test) and outputs a realistic fake API response.
function probe(node, response) {
  const assignments = [];
  for (const [k, v] of flatten(node.parameters)) {
    if (typeof v === 'string' && v.startsWith('=')) {
      assignments.push({ id: `p-${assignments.length}`, name: `_probe.${k.replace(/[.\[\]]+/g, '_')}`, value: v, type: 'string' });
    }
  }
  for (const [k, v] of Object.entries(response || {})) {
    const t = typed(v);
    assignments.push({ id: `r-${assignments.length}`, name: k, value: t === 'object' || t === 'array' ? JSON.stringify(v) : v, type: t });
  }
  const { credentials, ...rest } = node;
  return {
    ...rest,
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    parameters: { assignments: { assignments }, options: { ignoreConversionErrors: true, dotNotation: false } },
  };
}

// Replace a node with a Code node returning fixed items (used for "get many" style calls)
function fixtureNode(node, items) {
  const { credentials, ...rest } = node;
  return {
    ...rest,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    parameters: { jsCode: `return ${JSON.stringify(items)}.map(json => ({ json }));` },
  };
}

async function main() {
  const casePath = path.resolve(process.argv[2]);
  const verbose = process.argv.includes('--verbose');
  const tc = require(casePath);
  const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'product', 'workflows', tc.workflow), 'utf8'));

  await client.login();
  const openai = await client.credential('OpenAI (mock)', 'openAiApi', { apiKey: 'sk-mock', url: 'http://localhost:9999/v1' });
  const extraCreds = {};
  for (const [type, spec] of Object.entries(tc.credentials || {})) {
    extraCreds[type] = await client.credential(spec.name, type, spec.data);
  }

  wf.nodes = wf.nodes.map((node) => {
    if (tc.enable && tc.enable.includes(node.name)) node = { ...node, disabled: false };
    if (tc.probes && tc.probes[node.name] !== undefined) return probe(node, tc.probes[node.name]);
    if (tc.fixtures && tc.fixtures[node.name] !== undefined) return fixtureNode(node, tc.fixtures[node.name]);
    if (tc.patch && tc.patch[node.name]) node = tc.patch[node.name](JSON.parse(JSON.stringify(node)));
    const usesOpenAi = node.type.startsWith('@n8n/n8n-nodes-langchain.lmChatOpenAi') ||
      node.type === '@n8n/n8n-nodes-langchain.embeddingsOpenAi' ||
      node.type === '@n8n/n8n-nodes-langchain.openAi' ||
      (node.type === 'n8n-nodes-base.httpRequest' && node.parameters.nodeCredentialType === 'openAiApi');
    if (usesOpenAi) node = { ...node, credentials: { openAiApi: { id: openai.id, name: openai.name } } };
    for (const [type, cred] of Object.entries(extraCreds)) {
      if ((tc.credentialNodes || {})[node.name] === type) node = { ...node, credentials: { ...(node.credentials || {}), [type]: { id: cred.id, name: cred.name } } };
    }
    return node;
  });
  wf.pinData = {};
  for (const [name, items] of Object.entries(tc.pin || {})) wf.pinData[name] = items.map((json) => (json.json ? json : { json }));
  wf.name = `[TEST] ${wf.name}`;

  fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(tc.overrides || [], null, 2));
  const mockLog = path.join(__dirname, 'mock-openai', 'requests.jsonl');
  if (fs.existsSync(mockLog)) fs.writeFileSync(mockLog, '');

  const created = await client.createWorkflow(wf);
  let execution;
  try {
    const run = await client.runManually(created.id, tc.trigger);
    if (!run || !run.executionId) throw new Error('run did not start: ' + JSON.stringify(run));
    execution = await client.waitForExecution(run.executionId, tc.timeout || 180000);
  } finally {
    if (!process.argv.includes('--keep')) await client.deleteWorkflow(created.id);
  }

  const runData = execution.data.resultData.runData || {};
  const order = Object.keys(runData);
  console.log(`\n### ${tc.workflow} — status: ${execution.status}`);
  for (const name of order) {
    for (const [runIndex, task] of runData[name].entries()) {
      const outputs = (task.data && (task.data.main || task.data.ai_languageModel || task.data.ai_tool)) || [];
      const counts = outputs.map((o) => (o ? o.length : 0));
      const err = task.error ? ` ERROR: ${task.error.message} ${task.error.description || ''}` : '';
      console.log(`- ${name}${runData[name].length > 1 ? ` (run ${runIndex})` : ''}: outputs=${JSON.stringify(counts)}${err}`);
      if (verbose || (tc.show || []).includes(name)) {
        outputs.forEach((o, oi) => (o || []).slice(0, tc.showItems || 2).forEach((item) => console.log(`    [out ${oi}] ${JSON.stringify(item.json).slice(0, tc.showChars || 600)}`)));
      }
    }
  }
  const lastError = execution.data.resultData.error;
  if (lastError) console.log(`\nWORKFLOW ERROR: ${lastError.message}\n${lastError.description || ''}\n${(lastError.stack || '').split('\n').slice(0, 4).join('\n')}`);

  let failures = [];
  if (tc.check) {
    const get = (node, out = 0, run = 0) => ((runData[node] || [])[run]?.data?.main?.[out] || []).map((i) => i.json);
    const getAll = (node, out = 0) => (runData[node] || []).flatMap((r) => (r.data?.main?.[out] || []).map((i) => i.json));
    const requests = fs.existsSync(mockLog) ? fs.readFileSync(mockLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    const expect = (cond, msg) => { if (!cond) failures.push(msg); };
    await tc.check({ get, getAll, runData, requests, expect, execution });
  }
  if (execution.status !== 'success' && !tc.allowError) failures.push(`execution status ${execution.status}`);
  if (failures.length) {
    console.log('\nFAILED CHECKS:\n - ' + failures.join('\n - '));
    process.exitCode = 1;
  } else {
    console.log('\nALL CHECKS PASSED');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
