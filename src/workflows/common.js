// Small helpers for building n8n workflow JSON deterministically.

const crypto = require('crypto');
const { codeNodeSource } = require('../../scripts/lib/bundle');

// Node type versions are chosen to import cleanly on n8n 1.123 and 2.x (both are tested end to end).
const V = {
  formTrigger: 2.2,
  form: 1,
  manualTrigger: 1,
  scheduleTrigger: 1.2,
  set: 3.4,
  code: 2,
  httpRequest: 4.2,
  if: 2.2,
  merge: 3,
  googleSheets: 4.5,
  gmail: 2.1,
  convertToFile: 1.1,
  wait: 1.1,
  stickyNote: 1,
};

function stableUuid(...parts) {
  const h = crypto.createHash('sha1').update(parts.join('|')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

class WorkflowBuilder {
  constructor(key, name) {
    this.key = key;
    this.name = name;
    this.nodes = [];
    this.connections = {};
  }

  add(node) {
    if (this.nodes.some((n) => n.name === node.name)) throw new Error(`Duplicate node name: ${node.name}`);
    const full = Object.assign({ id: stableUuid(this.key, node.name) }, node);
    this.nodes.push(full);
    return full.name;
  }

  connect(from, to, fromOutput = 0, toInput = 0) {
    const c = (this.connections[from] = this.connections[from] || { main: [] });
    while (c.main.length <= fromOutput) c.main.push([]);
    c.main[fromOutput].push({ node: to, type: 'main', index: toInput });
  }

  chain(...names) {
    for (let i = 0; i < names.length - 1; i++) this.connect(names[i], names[i + 1]);
  }

  // Re-flows the canvas into stacked rows (one per stage) so the whole workflow fits on screen.
  // rows = arrays of node names; empty rows are skipped; each row keeps its internal layout.
  layoutRows(rows, gap = 120) {
    let y = 0;
    for (const names of rows) {
      const nodes = names.map((n) => this.nodes.find((x) => x.name === n)).filter(Boolean);
      if (!nodes.length) continue;
      const real = nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote');
      const minX = Math.min(...real.map((n) => n.position[0]));
      const top = Math.min(...nodes.map((n) => (n.type === 'n8n-nodes-base.stickyNote' ? n.position[1] : n.position[1] - 60)));
      const bottom = Math.max(...nodes.map((n) => (n.type === 'n8n-nodes-base.stickyNote' ? n.position[1] + n.parameters.height : n.position[1] + 120)));
      for (const n of nodes) n.position = [n.position[0] - minX, n.position[1] - top + y];
      y += bottom - top + gap;
    }
  }

  toJSON() {
    return {
      name: this.name,
      nodes: this.nodes,
      connections: this.connections,
      pinData: {},
      settings: { executionOrder: 'v1', saveManualExecutions: true, saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all' },
      meta: { templateCredsSetupCompleted: false },
      tags: [],
    };
  }
}

const sticky = (name, position, content, opts = {}) => ({
  name,
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: V.stickyNote,
  position,
  parameters: { content, height: opts.height || 300, width: opts.width || 420, color: opts.color || 7 },
});

const code = (name, position, { title, purpose, adapter, mode }, extra = {}) =>
  Object.assign(
    {
      name,
      type: 'n8n-nodes-base.code',
      typeVersion: V.code,
      position,
      parameters: Object.assign(mode === 'each' ? { mode: 'runOnceForEachItem' } : {}, { jsCode: codeNodeSource({ title: title || name, purpose, adapter }) }),
    },
    extra,
  );

function condition(id, leftValue, operation, type = 'boolean', rightValue = '') {
  const singleValue = ['true', 'false', 'empty', 'notEmpty', 'exists', 'notExists'].includes(operation);
  const operator = { type, operation };
  if (singleValue) operator.singleValue = true;
  return { id, leftValue, rightValue, operator };
}

const ifNode = (name, position, conditions, combinator = 'and') => ({
  name,
  type: 'n8n-nodes-base.if',
  typeVersion: V.if,
  position,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions,
      combinator,
    },
    looseTypeValidation: true,
    options: {},
  },
});

const merge = (name, position, inputs = 2) => ({
  name,
  type: 'n8n-nodes-base.merge',
  typeVersion: V.merge,
  position,
  parameters: inputs === 2 ? {} : { numberInputs: inputs },
});

const assignment = (name, value) => {
  const type = typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string';
  return { id: stableUuid('assign', name), name, value, type };
};

const setNode = (name, position, values, includeOtherFields = true) => ({
  name,
  type: 'n8n-nodes-base.set',
  typeVersion: V.set,
  position,
  parameters: {
    assignments: { assignments: Object.entries(values).map(([k, v]) => assignment(k, v)) },
    includeOtherFields,
    options: {},
  },
});

const sheetLocator = (urlExpression) => ({
  documentId: { __rl: true, mode: 'url', value: urlExpression },
  sheetName: { __rl: true, mode: 'name', value: 'Leads' },
});

module.exports = { V, stableUuid, WorkflowBuilder, sticky, code, condition, ifNode, merge, setNode, assignment, sheetLocator };
