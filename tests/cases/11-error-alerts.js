const err = (msg) => ({ execution: { id: '231', url: 'https://n8n.example.com/workflow/1/executions/231', error: { message: msg, description: 'Request failed with status code 401', node: { name: 'Save to Google Sheets', type: 'n8n-nodes-base.googleSheets' }, httpCode: '401', stack: 'NodeApiError: ...\n at x' }, lastNodeExecuted: 'Save to Google Sheets', mode: 'trigger' }, workflow: { id: 'wf1', name: '05 · Google Maps Lead Finder' } });
module.exports = {
  workflow: 'BONUS-workflow-error-alerts.json',
  trigger: 'When Any Workflow Fails',
  pin: { 'When Any Workflow Fails': [err('Authorization failed - please check your credentials'), err('Authorization failed - please check your credentials')] },
  probes: { 'Email Alert': { id: 'mail' } },
  overrides: [{ match: 'FAILED NODE: Save to Google Sheets', respond: 'Your Google connection expired.\n1. Open Credentials → Google Sheets → Reconnect.\n2. …' }],
  show: ['Error Details', 'Email Alert'],
  async check({ get, expect }) {
    const d = get('Error Details');
    expect(d[0].should_alert === true && d[1].should_alert === false, 'second identical error suppressed');
    expect(d[0].node === 'Save to Google Sheets' && d[0].node_type === 'n8n-nodes-base.googleSheets', 'node details');
    const mail = get('Email Alert');
    expect(mail.length === 1 && mail[0]['_probe.subject'] === '⚠️ n8n workflow failed: 05 · Google Maps Lead Finder', 'one alert email');
    expect(mail[0]['_probe.message'].includes('Reconnect') && mail[0]['_probe.message'].includes('executions/231'), 'ai fix + execution link');
  },
};
