// Minimal OpenAI-compatible mock used to test the workflows end-to-end without real API keys.
// - /v1/chat/completions : returns JSON matching the structured-output schema found in the prompt,
//                          or a canned/override answer. Supports stream=true (SSE).
// - /v1/embeddings       : deterministic pseudo-random vectors
// - /v1/audio/*          : fake transcription / speech
// Every request is appended to requests.jsonl for inspection.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 9999);
const LOG = process.env.MOCK_LOG || path.join(__dirname, 'requests.jsonl');
const OVERRIDES = process.env.MOCK_OVERRIDES || path.join(__dirname, 'overrides.json');

function loadOverrides() {
  try { return JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')); } catch { return []; }
}

function sampleFromSchema(schema, key = '') {
  if (!schema || typeof schema !== 'object') return 'sample';
  if (schema.enum) return schema.enum[0];
  let type = schema.type;
  if (Array.isArray(type)) type = type.find((t) => t !== 'null') || 'string';
  switch (type) {
    case 'object': {
      const out = {};
      for (const [k, v] of Object.entries(schema.properties || {})) out[k] = sampleFromSchema(v, k);
      return out;
    }
    case 'array':
      return [sampleFromSchema(schema.items || { type: 'string' }, key), sampleFromSchema(schema.items || { type: 'string' }, key)];
    case 'number':
    case 'integer': {
      let v = /score/i.test(key) ? 82 : 7;
      if (schema.maximum !== undefined) v = Math.min(v, schema.maximum);
      if (schema.minimum !== undefined) v = Math.max(v, schema.minimum);
      return v;
    }
    case 'boolean':
      return true;
    default:
      return `Sample ${key || 'text'} from mock`;
  }
}

function findSchema(text) {
  // LangChain StructuredOutputParser embeds the JSON schema after "```json" in its format instructions
  const m = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function messageText(messages) {
  return (messages || [])
    .map((m) => (typeof m.content === 'string' ? m.content : (m.content || []).map((c) => c.text || (c.type === 'image_url' ? '[image]' : c.type === 'file' ? '[file]' : '')).join(' ')))
    .join('\n\n');
}

function toolCallAnswer(body) {
  // Simulate an agent calling a tool: overrides entry {match, tool: 'substring of tool name', args: {...}}
  const msgs = body.messages || [];
  const last = msgs[msgs.length - 1] || {};
  if (!body.tools || !body.tools.length) return null;
  if (last.role === 'tool') {
    const toolOutput = typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
    return { content: 'Based on our website: ' + toolOutput.slice(0, 400) };
  }
  const text = messageText(msgs);
  for (const o of loadOverrides()) {
    if (o.tool && text.includes(o.match)) {
      const tool = body.tools.find((t) => t.function && t.function.name.toLowerCase().includes(o.tool.toLowerCase()));
      if (!tool) return { content: 'MOCK: tool not found among ' + body.tools.map((t) => t.function.name).join(',') };
      return { tool_calls: [{ id: 'call_' + crypto.randomBytes(4).toString('hex'), type: 'function', function: { name: tool.function.name, arguments: JSON.stringify(o.args || {}) } }] };
    }
  }
  return null;
}

function chatAnswer(body) {
  const text = messageText(body.messages);
  const promptSchema = findSchema(text);
  for (const o of loadOverrides()) {
    if (text.includes(o.match)) {
      if (typeof o.respond === 'string') return o.respond;
      // n8n's Structured Output Parser wraps the schema in {"output": ...}
      const wrap = promptSchema && promptSchema.properties && promptSchema.properties.output && !('output' in o.respond);
      return JSON.stringify(wrap ? { output: o.respond } : o.respond);
    }
  }
  // OpenAI structured outputs (response_format json_schema) – used by the invoice extractor
  if (body.response_format && body.response_format.type === 'json_schema') {
    return JSON.stringify(sampleFromSchema(body.response_format.json_schema.schema));
  }
  const schema = findSchema(text);
  if (schema) return JSON.stringify(sampleFromSchema(schema));
  if (body.response_format && body.response_format.type === 'json_object') return JSON.stringify({ result: 'ok' });
  return 'Mock answer: **Hello!** Here is a helpful reply with a [link](https://example.com) and `code`.';
}


// ---------- fake Google Places API + fake business websites (lead finder tests)
function makePlace(i) {
  return {
    id: 'place-' + i,
    displayName: { text: `Smile Dental ${i}`, languageCode: 'en' },
    formattedAddress: `${100 + i} Main St, Austin, TX 78701, USA`,
    internationalPhoneNumber: `+1 512-555-${String(1000 + i)}`,
    websiteUri: i % 7 === 3 ? undefined : `http://localhost:9999/biz/${i}`,
    rating: Math.round((3.4 + (i % 16) / 10) * 10) / 10,
    userRatingCount: i * 3,
    googleMapsUri: 'https://maps.google.com/?cid=' + (1000 + i),
    primaryTypeDisplayName: { text: 'Dentist', languageCode: 'en' },
    businessStatus: i === 5 ? 'CLOSED_PERMANENTLY' : 'OPERATIONAL',
  };
}
function cfEncode(email, key = 0x42) {
  let hex = key.toString(16).padStart(2, '0');
  for (const ch of email) hex += (ch.charCodeAt(0) ^ key).toString(16).padStart(2, '0');
  return hex;
}
function bizPage(n, sub) {
  if (sub) return `<html><body><h1>Contact</h1><p>Write to <a href="mailto:office@biz${n}.com">office@biz${n}.com</a></p></body></html>`;
  const head = `<head><title>Smile Dental ${n} | Family Dentist Austin</title><meta name="description" content="Gentle family dentistry in Austin since 2008."></head>`;
  switch (n % 4) {
    case 0: return `<html>${head.replace('</head>', '<meta name="viewport" content="width=device-width"><script>gtag("x")</script></head>')}<body><a href="mailto:info@biz${n}.com">Email us</a> <a href="https://www.instagram.com/smiledental${n}/">IG</a> <a href="https://calendly.com/x">Book now</a> <p>We offer whitening, implants and Invisalign.</p></body></html>`;
    case 1: return `<html>${head}<body><a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="${cfEncode('hello@biz' + n + '.com')}">[email protected]</a> <a href="https://www.facebook.com/smiledental${n}">FB</a> <a href="https://www.facebook.com/sharer.php?u=x">share</a> <a href="/biz/${n}/contact-us">Contact Us</a></body></html>`;
    default: return `<html>${head}<body><p>Welcome! Logo file: logo@2x.png</p><a href="/biz/${n}/contact">Contact</a> <a href="https://www.linkedin.com/company/smile-dental-${n}/">LinkedIn</a><footer>&copy; 2019 Smile Dental</footer></body></html>`;
  }
}

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body = {};
    const ct = String(req.headers['content-type'] || '');
    if (ct.includes('application/json')) { try { body = JSON.parse(raw || '{}'); } catch { body = {}; } }
    fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), method: req.method, url: req.url, auth: req.headers.authorization, body: ct.includes('json') ? body : `[${ct} ${raw.length} bytes]` }) + '\n');

    const url = req.url.replace(/\?.*$/, '');
    if (url.startsWith('/feed/')) {
      const now = Date.now();
      const item = (t, link, hoursAgo, desc) => `<item><title><![CDATA[${t}]]></title><link>${link}</link><pubDate>${new Date(now - hoursAgo * 3600e3).toUTCString()}</pubDate><description><![CDATA[${desc}]]></description></item>`;
      let items = '';
      if (url === '/feed/tech') {
        items = item('OpenAI launches GPT-6 with built-in agents', 'https://tech.example.com/gpt6', 2, '<p>The new model can <b>browse</b> and run tasks.</p>') +
          item('EU finalises AI Act enforcement rules', 'https://tech.example.com/eu-ai-act', 5, 'Regulators publish guidance.') +
          item('Old news from last week', 'https://tech.example.com/old', 200, 'Should be filtered out.') +
          item('OpenAI launches GPT-6 with built-in agents!', 'https://tech.example.com/gpt6-copy', 3, 'Duplicate headline.');
      } else if (url === '/feed/gnews') {
        items = item('Anthropic releases new Claude model for enterprises - Reuters', 'https://news.google.com/rss/articles/abc', 1, 'Reuters report') +
          item('n8n raises funding to expand AI workflow automation - TechCrunch', 'https://news.google.com/rss/articles/def', 8, 'Funding round');
      } else { res.writeHead(404); return res.end('no feed'); }
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      return res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>Mock</title>${items}</channel></rss>`);
    }
    if (url.endsWith('/upload/drive/v3/files')) {
      const m = String(req.headers['content-type'] || '').match(/boundary=([^;]+)/);
      if (!m) { res.writeHead(400); return res.end('no boundary'); }
      const parts = raw.split('--' + m[1]).filter((p) => p.trim() && p.trim() !== '--');
      if (parts.length !== 2) { res.writeHead(400); return res.end('expected 2 parts, got ' + parts.length); }
      const meta = JSON.parse(parts[0].split(/\r\n\r\n/)[1]);
      const htmlPart = parts[1];
      if (meta.mimeType !== 'application/vnd.google-apps.document' || !/Content-Type: text\/html/i.test(htmlPart)) { res.writeHead(400); return res.end('bad parts'); }
      fs.writeFileSync(path.join(__dirname, 'last-doc.html'), htmlPart.split(/\r\n\r\n/).slice(1).join('\r\n\r\n'));
      return json(res, { id: 'doc123', name: meta.name, webViewLink: 'https://docs.google.com/document/d/doc123/edit', parents: meta.parents || [] });
    }
    if (url.endsWith('/places:searchText')) {
      if (req.headers['x-goog-api-key'] !== 'test-key') { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'API key missing' } })); }
      if (!String(req.headers['x-goog-fieldmask'] || '').includes('nextPageToken')) { res.writeHead(400); return res.end('field mask missing'); }
      const page = body.pageToken ? Number(String(body.pageToken).replace('page', '')) : 1;
      const total = 45;
      const start = (page - 1) * 20;
      const end = Math.min(total, start + 20);
      const out = { places: [] };
      for (let i = start; i < end; i++) out.places.push(makePlace(i));
      if (end < total) out.nextPageToken = 'page' + (page + 1);
      return json(res, out);
    }
    const biz = url.match(/^\/biz\/(\d+)(\/[a-z-]+)?$/);
    if (biz) {
      const n = Number(biz[1]);
      if (n % 4 === 3) { res.writeHead(500, { 'Content-Type': 'text/html' }); return res.end('<h1>Server error</h1>'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(bizPage(n, biz[2]));
    }
    if (url === '/site' || url.startsWith('/site/')) {
      let rel = url.replace(/^\/site\/?/, '') || 'index';
      if (!path.extname(rel)) rel += '.html';
      const file = path.join(__dirname, '..', 'fixtures', 'site', rel);
      if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>404</h1>'); }
      const isXml = rel.endsWith('.xml');
      res.writeHead(200, { 'Content-Type': isXml ? 'application/xml' : 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(file));
    }
    if (url.startsWith('/fixture/')) {
      const file = path.join(__dirname, '..', 'fixtures', path.basename(decodeURIComponent(url.slice(9))));
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
      const ext = path.extname(file).toLowerCase();
      const types = { '.html': 'text/html; charset=utf-8', '.xml': 'application/xml', '.json': 'application/json', '.ogg': 'audio/ogg', '.jpg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf', '.rss': 'application/rss+xml' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      return res.end(fs.readFileSync(file));
    }
    if (url.endsWith('/models')) {
      return json(res, { object: 'list', data: ['gpt-4.1-mini', 'gpt-4o-mini', 'text-embedding-3-small', 'whisper-1', 'tts-1'].map((id) => ({ id, object: 'model', created: 1700000000, owned_by: 'openai' })) });
    }
    if (url.endsWith('/chat/completions')) {
      const id = 'chatcmpl-' + crypto.randomBytes(6).toString('hex');
      const tc = toolCallAnswer(body);
      if (tc && tc.tool_calls) {
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta: { role: 'assistant', content: null, tool_calls: tc.tool_calls.map((t, index) => ({ index, ...t })) }, finish_reason: null }] })}\n\n`);
          res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })}\n\n`);
          res.write('data: [DONE]\n\n');
          return res.end();
        }
        return json(res, { id, object: 'chat.completion', created: 1, model: body.model, choices: [{ index: 0, message: { role: 'assistant', content: null, tool_calls: tc.tool_calls }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } });
      }
      const content = tc && tc.content ? tc.content : chatAnswer(body);
      if (body.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      return json(res, { id, object: 'chat.completion', created: 1, model: body.model || 'gpt-4.1-mini', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } });
    }
    if (url.endsWith('/embeddings')) {
      const inputs = Array.isArray(body.input) ? body.input : [body.input];
      const dims = body.dimensions || 1536;
      return json(res, {
        object: 'list',
        model: body.model,
        data: inputs.map((inp, index) => {
          const seed = crypto.createHash('sha256').update(String(inp)).digest();
          const embedding = Array.from({ length: dims }, (_, i) => ((seed[i % 32] / 255) - 0.5) * Math.sin(i + 1));
          return { object: 'embedding', index, embedding };
        }),
        usage: { prompt_tokens: 5, total_tokens: 5 },
      });
    }
    if (url.endsWith('/audio/transcriptions')) return json(res, { text: 'Mock transcript: remind me to call Sam tomorrow at 10am.' });
    if (url.endsWith('/audio/speech')) { res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); return res.end(Buffer.from('ID3mockaudio')); }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'mock: unknown route ' + url } }));
  });
});

function json(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

server.listen(PORT, () => console.log(`mock openai on :${PORT}`));
