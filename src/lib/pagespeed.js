// Google PageSpeed Insights (Lighthouse) helpers.

// @node-only-start
const { str, num, round } = require('./util');
// @node-only-end

const PAGESPEED_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

function pageSpeedUrl(siteUrl) {
  return `${PAGESPEED_ENDPOINT}?url=${encodeURIComponent(siteUrl)}&strategy=mobile&category=PERFORMANCE&category=SEO&category=BEST_PRACTICES`;
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

// resp = the HTTP Request output for runPagespeed (or an n8n error item).
function parsePageSpeed(resp) {
  const r = resp || {};
  if (r.error) {
    const e = r.error;
    return { ok: false, error: str(e.message || e.description || (typeof e === 'string' ? e : 'PageSpeed request failed')).slice(0, 300) };
  }
  const lr = r.lighthouseResult;
  if (!lr || typeof lr !== 'object') return { ok: false, error: 'No Lighthouse result in the PageSpeed response' };
  if (lr.runtimeError && lr.runtimeError.code && lr.runtimeError.code !== 'NO_ERROR') {
    return { ok: false, error: `Lighthouse could not test the page (${lr.runtimeError.code})`, runtimeError: str(lr.runtimeError.code) };
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
    viewport: auditScore(audits, 'viewport'),
    metaDescription: auditScore(audits, 'meta-description'),
    documentTitle: auditScore(audits, 'document-title'),
    finalUrl: str(lr.finalDisplayedUrl || lr.finalUrl || r.id),
    fieldSpeed: field, // real-user (Chrome UX Report) verdict when Google has enough traffic data: FAST / AVERAGE / SLOW
  };
}

// @export
module.exports = { PAGESPEED_ENDPOINT, pageSpeedUrl, parsePageSpeed };
