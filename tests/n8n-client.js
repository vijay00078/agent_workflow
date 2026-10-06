// Small REST client for a local n8n instance used by the test runner.
const crypto = require('crypto');
const path = require('path');
const { parse: parseFlatted } = require('/opt/n8n-test/node_modules/flatted');

const BASE = process.env.N8N_URL || 'http://localhost:5678';
const OWNER = { email: 'owner@example.com', firstName: 'Test', lastName: 'Owner', password: 'StarterPack123!' };
const browserId = crypto.randomUUID();
let cookie = '';

async function call(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', 'browser-id': browserId, ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`${method} ${url} -> ${res.status}: ${typeof data === 'string' ? data.slice(0, 500) : JSON.stringify(data).slice(0, 800)}`);
    err.status = res.status;
    throw err;
  }
  return data && data.data !== undefined ? data.data : data;
}

async function login() {
  try {
    await call('POST', '/rest/owner/setup', OWNER);
  } catch (e) {
    if (e.status !== 400) throw e; // already set up
  }
  await call('POST', '/rest/login', { emailOrLdapLoginId: OWNER.email, password: OWNER.password });
}

async function credential(name, type, data) {
  const existing = await call('GET', '/rest/credentials');
  const found = (existing || []).find((c) => c.name === name && c.type === type);
  if (found) return found;
  return call('POST', '/rest/credentials', { name, type, data });
}

async function createWorkflow(wf) {
  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings, pinData: wf.pinData || {}, active: false };
  return call('POST', '/rest/workflows', body);
}

async function deleteWorkflow(id) {
  try { await call('POST', `/rest/workflows/${id}/archive`); } catch {}
  try { await call('DELETE', `/rest/workflows/${id}`); } catch {}
}

async function runManually(id, triggerName) {
  return call('POST', `/rest/workflows/${id}/run`, { triggerToStartFrom: { name: triggerName } });
}

async function waitForExecution(executionId, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ex = await call('GET', `/rest/executions/${executionId}`);
    if (ex && ex.finished !== undefined && ex.status && !['running', 'new', 'waiting'].includes(ex.status)) {
      const data = typeof ex.data === 'string' ? parseFlatted(ex.data) : ex.data;
      return { ...ex, data };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('execution timeout ' + executionId);
}

module.exports = { call, login, credential, createWorkflow, deleteWorkflow, runManually, waitForExecution };
