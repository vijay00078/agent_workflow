// Collects the useful facts about the failure and prevents alert storms:
// the same error in the same workflow alerts at most once per quiet period.
const cfg = $('Config').first().json;
const data = $json;
const execution = data.execution || {};
const trigger = data.trigger || {};
const error = execution.error || trigger.error || {};
const workflow = data.workflow || {};

const message = String(error.message || error.description || 'Unknown error');
const node = execution.lastNodeExecuted || (error.node && error.node.name) || 'Trigger';
const key = `${workflow.id}|${node}|${message.slice(0, 120)}`;

const store = $getWorkflowStaticData('global');
store.lastAlerts = store.lastAlerts || {};
const now = Date.now();
const quietMs = (Number(cfg.quiet_minutes) || 60) * 60000;
const shouldAlert = now - (store.lastAlerts[key] || 0) > quietMs;
if (shouldAlert) store.lastAlerts[key] = now;
for (const [k, t] of Object.entries(store.lastAlerts)) if (now - t > 7 * 864e5) delete store.lastAlerts[k];

return {
  json: {
    workflow_name: workflow.name || 'Unknown workflow',
    workflow_id: workflow.id || '',
    node,
    node_type: (error.node && error.node.type) || '',
    message,
    description: String(error.description || '').slice(0, 1000),
    http_code: error.httpCode || '',
    stack: String(error.stack || '').split('\n').slice(0, 5).join('\n'),
    execution_url: execution.url || '',
    execution_id: execution.id || '',
    mode: execution.mode || trigger.mode || '',
    time: $now.toFormat('yyyy-MM-dd HH:mm:ss'),
    should_alert: shouldAlert,
  },
};
