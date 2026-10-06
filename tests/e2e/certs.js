// Creates a throwaway CA and TLS certificates for the mock servers (requires the openssl CLI).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function run(args, cwd) {
  execFileSync('openssl', args, { cwd, stdio: 'pipe' });
}

function makeCerts(dir, hostnames) {
  fs.mkdirSync(dir, { recursive: true });
  const marker = path.join(dir, 'hosts.txt');
  const wanted = hostnames.join(',');
  if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === wanted) return paths(dir);
  run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '30', '-subj', '/CN=Client Finder E2E Test CA'], dir);
  const leaf = (name, sans) => {
    fs.writeFileSync(path.join(dir, `${name}.ext`), `subjectAltName=${sans.map((h) => `DNS:${h}`).join(',')}\nextendedKeyUsage=serverAuth\n`);
    run(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`, '-subj', `/CN=${sans[0]}`], dir);
    run(['x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', `${name}.pem`, '-days', '30', '-extfile', `${name}.ext`], dir);
  };
  leaf('server', hostnames);
  leaf('wrong', ['wrong-host.test']); // served for the "bad certificate" business
  fs.writeFileSync(marker, wanted);
  return paths(dir);
}

function paths(dir) {
  return {
    ca: path.join(dir, 'ca.pem'),
    key: path.join(dir, 'server.key'),
    cert: path.join(dir, 'server.pem'),
    wrongKey: path.join(dir, 'wrong.key'),
    wrongCert: path.join(dir, 'wrong.pem'),
  };
}

module.exports = { makeCerts };
