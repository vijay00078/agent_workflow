// Reads n8n's SQLite execution log (used to explain failures in the e2e report).
const path = require('path');

function loadModules(n8nJs) {
  // n8nJs = .../node_modules/n8n/bin/n8n → its node_modules folder has sqlite3 and flatted.
  const nm = path.resolve(path.dirname(n8nJs), '..', '..');
  return { sqlite3: require(path.join(nm, 'sqlite3')), flatted: require(path.join(nm, 'flatted')) };
}

function query(db, sql, params) {
  return new Promise((resolve, reject) => db.all(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows))));
}

async function recentExecutions(n8nJs, dbFile, limit = 20) {
  const { sqlite3, flatted } = loadModules(n8nJs);
  const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);
  try {
    const rows = await query(db, `SELECT e.id, e.workflowId, e.status, d.data FROM execution_entity e LEFT JOIN execution_data d ON d.executionId = e.id ORDER BY e.id DESC LIMIT ?`, [limit]);
    return rows.map((r) => {
      let error = null;
      let lastNode = null;
      try {
        const data = flatted.parse(r.data);
        const rd = data.resultData || {};
        lastNode = rd.lastNodeExecuted || null;
        if (rd.error) error = { message: rd.error.message, node: rd.error.node && rd.error.node.name, description: rd.error.description };
        if (!error && rd.runData) {
          for (const [name, runs] of Object.entries(rd.runData)) for (const run of runs) if (run.error) error = { message: run.error.message, node: name, description: run.error.description };
        }
      } catch (e) {
        error = { message: `could not parse execution data: ${e.message}` };
      }
      return { id: r.id, workflowId: r.workflowId, status: r.status, lastNode, error };
    });
  } finally {
    db.close();
  }
}

module.exports = { recentExecutions };
