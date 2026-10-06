// --- Tiny URL helper (n8n's Code node sandbox has no URL class) -------------
function resolveUrl(href, base) {
  href = String(href || '').trim().replace(/&amp;/g, '&');
  if (!href || /^(mailto:|tel:|javascript:|data:|sms:|whatsapp:|#)/i.test(href)) return null;
  const b = String(base || '').match(/^(https?:)\/\/([^\/?#]+)([^?#]*)/i);
  let proto, host, path, query = '';
  let m;
  if ((m = href.match(/^(https?:)\/\/([^\/?#]+)([^?#]*)(\?[^#]*)?/i))) {
    [, proto, host, path, query = ''] = m;
  } else if (href.startsWith('//') && b) {
    m = href.match(/^\/\/([^\/?#]+)([^?#]*)(\?[^#]*)?/);
    if (!m) return null;
    proto = b[1];
    [, host, path, query = ''] = m;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(href) || !b) {
    return null;
  } else {
    proto = b[1];
    host = b[2];
    const rel = href.match(/^([^?#]*)(\?[^#]*)?/);
    query = rel[2] || '';
    if (rel[1].startsWith('/')) path = rel[1];
    else if (rel[1] === '') path = b[3] || '/';
    else path = (b[3] || '/').replace(/[^\/]*$/, '') + rel[1];
  }
  const segments = [];
  for (const s of (path || '/').split('/')) {
    if (s === '..') segments.pop();
    else if (s !== '.') segments.push(s);
  }
  path = segments.join('/');
  if (!path.startsWith('/')) path = '/' + path;
  proto = proto.toLowerCase();
  host = host.toLowerCase();
  return {
    protocol: proto,
    host,
    hostname: host.replace(/:\d+$/, ''),
    domain: host.replace(/:\d+$/, '').replace(/^www\./, ''),
    pathname: path,
    search: query,
    origin: `${proto}//${host}`,
    href: `${proto}//${host}${path}${query}`,
  };
}
// ---------------------------------------------------------------------------
