// Loaded into the n8n test process with NODE_OPTIONS=--require. Resolves the mocked hostnames
// (Google, Anthropic, the fake business sites) to the local mock server, only inside that process.
// Unknown *.test hostnames fail like a real expired domain (ENOTFOUND).
const dns = require('dns');

const mocked = new Set((process.env.E2E_MOCK_HOSTS || '').split(',').filter(Boolean));
const ip = process.env.E2E_MOCK_IP || '127.0.0.1';

function decide(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (mocked.has(h)) return { address: ip };
  if (h.endsWith('.test')) {
    const err = new Error(`getaddrinfo ENOTFOUND ${h}`);
    err.code = 'ENOTFOUND';
    err.errno = -3008;
    err.syscall = 'getaddrinfo';
    err.hostname = h;
    return { error: err };
  }
  return null;
}

const originalLookup = dns.lookup;
dns.lookup = function lookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'function' ? {} : typeof options === 'number' ? { family: options } : options || {};
  const d = decide(hostname);
  if (!d) return originalLookup.call(dns, hostname, options, callback);
  process.nextTick(() => {
    if (d.error) return cb(d.error);
    if (opts.all) return cb(null, [{ address: d.address, family: 4 }]);
    return cb(null, d.address, 4);
  });
  return {};
};

const originalPromiseLookup = dns.promises.lookup;
dns.promises.lookup = async function lookup(hostname, options) {
  const d = decide(hostname);
  if (!d) return originalPromiseLookup.call(dns.promises, hostname, options);
  if (d.error) throw d.error;
  return options && options.all ? [{ address: d.address, family: 4 }] : { address: d.address, family: 4 };
};
