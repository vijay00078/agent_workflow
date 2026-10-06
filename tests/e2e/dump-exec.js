// Debug helper: node tests/e2e/dump-exec.js <n8n bin> <database.sqlite> <executionId> [nodeName...]
const path = require('path');
const [n8nBin, dbFile, execId, ...nodes] = process.argv.slice(2);
const nm = path.resolve(path.dirname(require('fs').realpathSync(n8nBin)), '..', '..');
const sqlite3 = require(path.join(nm, 'sqlite3'));
const flatted = require(path.join(nm, 'flatted'));
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);
db.all('SELECT e.id, e.workflowId, e.status, d.data FROM execution_entity e JOIN execution_data d ON d.executionId = e.id WHERE e.id = ?', [execId], (err, rows) => {
  if (err) throw err;
  const data = flatted.parse(rows[0].data);
  const rd = data.resultData.runData;
  for (const [name, runs] of Object.entries(rd)) {
    if (nodes.length && !nodes.includes(name)) continue;
    runs.forEach((r, i) => {
      const outs = (r.data && r.data.main) || [];
      console.log(`## ${name} run${i} ${r.executionStatus || ''} ${r.error ? 'ERR ' + r.error.message : ''}`);
      outs.forEach((o, oi) => {
        console.log(`  out${oi}: ${o ? o.length : 0}`);
        (o || []).slice(0, 3).forEach((it) => console.log('    ', JSON.stringify(it.json).slice(0, 700)));
      });
    });
  }
  db.close();
});
