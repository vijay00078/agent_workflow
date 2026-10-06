// Google PageSpeed Insights (Lighthouse) helpers.

// @node-only-start
const { str, num, round } = require('./util');
const { errorText } = require('./places');
// @node-only-end

const PAGESPEED_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// Google's standard partial-response mask: only the parts parsePageSpeed reads. It drops the full-page screenshot,
// i18n strings, timing and entity data, which are most of a 1-2 MB Lighthouse report.
const PAGESPEED_FIELDS = 'id,loadingExperience(overall_category),lighthouseResult(requestedUrl,finalUrl,finalDisplayedUrl,lighthouseVersion,runtimeError,categories,audits)';

function pageSpeedUrl(siteUrl) {
  return `${PAGESPEED_ENDPOINT}?url=${encodeURIComponent(siteUrl)}&strategy=mobile&category=PERFORMANCE&category=SEO&category=BEST_PRACTICES&fields=${encodeURIComponent(PAGESPEED_FIELDS)}`;
}

function categoryScore(categories, key) {
  const c = categories && categories[key];
  const s = c ? num(c.score) : null;
  return s === null ? null : Math.round(s * 100);
}

function auditScore(audits, key) {
  const a = audits && audits[key];
  if (!a) return null;
  return num(a.score);
}

function seconds(ms) {
  return ms === null ? '' : `${round(ms / 1000, 1)} s`;
}

// Chrome's certificate error ("net::ERR_CERT_DATE_INVALID") when Lighthouse refused the page for an invalid certificate.
function certErrorIn(text) {
  const t = str(text);
  if (!/INSECURE_DOCUMENT_REQUEST|ERR_CERT_/i.test(t)) return '';
  const m = t.match(/net::ERR_CERT_[A-Z_]{2,40}/);
  return m ? m[0] : 'INSECURE_DOCUMENT_REQUEST';
}

// resp = the HTTP Request output for runPagespeed (or an n8n error item).
function parsePageSpeed(resp) {
  const r = resp || {};
  if (r.error) {
    const e = r.error;
    const all = errorText(e);
    const out = { ok: false, error: str(e.message || e.description || (typeof e === 'string' ? e : 'PageSpeed request failed')).slice(0, 300) };
    const cert = certErrorIn(all);
    if (cert) out.certError = cert;
    return out;
  }
  const lr = r.lighthouseResult;
  if (!lr || typeof lr !== 'object') return { ok: false, error: 'No Lighthouse result in the PageSpeed response' };
  if (lr.runtimeError && lr.runtimeError.code && lr.runtimeError.code !== 'NO_ERROR') {
    const out = { ok: false, error: `Lighthouse could not test the page (${lr.runtimeError.code})`, runtimeError: str(lr.runtimeError.code) };
    const cert = certErrorIn(`${lr.runtimeError.code} ${str(lr.runtimeError.message)}`);
    if (cert) out.certError = cert;
    return out;
  }
  const audits = lr.audits || {};
  const lcpMs = audits['largest-contentful-paint'] ? num(audits['largest-contentful-paint'].numericValue) : null;
  const fcpMs = audits['first-contentful-paint'] ? num(audits['first-contentful-paint'].numericValue) : null;
  const field = r.loadingExperience && r.loadingExperience.overall_category ? str(r.loadingExperience.overall_category) : '';
  return {
    ok: true,
    performance: categoryScore(lr.categories, 'performance'),
    seo: categoryScore(lr.categories, 'seo'),
    bestPractices: categoryScore(lr.categories, 'best-practices'),
    lcpMs,
    lcp: seconds(lcpMs),
    fcpMs,
    fcp: seconds(fcpMs),
    isOnHttps: auditScore(audits, 'is-on-https'),
    // Lighthouse 13 replaced the "viewport" audit with "viewport-insight" (same meaning: 1 pass, 0 fail).
    viewport: auditScore(audits, 'viewport') !== null ? auditScore(audits, 'viewport') : auditScore(audits, 'viewport-insight'),
    metaDescription: auditScore(audits, 'meta-description'),
    documentTitle: auditScore(audits, 'document-title'),
    finalUrl: str(lr.finalDisplayedUrl || lr.finalUrl),
    fieldSpeed: field, // real-user (Chrome UX Report) verdict when Google has enough traffic data: FAST / AVERAGE / SLOW
  };
}

// @export
module.exports = { PAGESPEED_ENDPOINT, PAGESPEED_FIELDS, pageSpeedUrl, certErrorIn, parsePageSpeed };
