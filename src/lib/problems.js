// The problem catalog. Each check turns raw facts about a business into a short, verifiable piece of
// evidence. A check returns null when the facts don't support the claim (or we could not verify it).

// @node-only-start
const { str, hostOf, parseUrl, plural } = require('./util');
const { DOWN_STATUSES } = require('./website');
// @node-only-end

const DEFAULT_THRESHOLDS = {
  slowMobileScore: 45, // PageSpeed mobile performance below this = slow (a margin below Google's 50 "poor" line: lab scores vary between runs)
  weakSeoScore: 80, // Lighthouse SEO score below this = weak basics
  lowRating: 4.0, // Google rating below this (with enough reviews) = reputation problem
  minReviewsForRating: 5,
  fewReviewsMax: 25, // fewer than this many reviews...
  fewReviewsRatio: 0.35, // ...and below 35% of the local median = "few reviews"
  minMarketForComparison: 5,
  outdatedYears: 3, // footer copyright this many years old or more = outdated
  earlyCloseWeekdays: 3, // closes before 6pm on at least this many weekdays = limited hours
};

function siteName(lead) {
  return hostOf(lead.website) || 'their website';
}

// The listed URL without the scheme, e.g. "brightsmiles.com/locations/austin/".
function listedLink(lead) {
  const u = parseUrl(lead.website);
  return u ? u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '') : siteName(lead);
}

function isHomepage(lead) {
  const u = parseUrl(lead.website);
  return !u || u.pathname === '/' || u.pathname === '';
}

// Wording for fetch failures that were seen twice, 15 seconds apart (see the "Recheck" step).
const FETCH_REASONS = {
  'domain-not-found': "the domain doesn't resolve (it may have expired)",
  'connection-refused': 'the server refused the connection',
  timeout: 'it took more than 20 seconds to respond',
  'not-found': 'the homepage returns "page not found" (404)',
  'server-error': 'the server returns an error page',
};

const CERT_WORDS = {
  expired: 'an expired security certificate',
  'not-yet-valid': 'a security certificate that is not valid yet',
  'wrong-host': 'a security certificate issued for a different domain',
  'self-signed': 'a self-signed security certificate',
};

function certWording(site, psi) {
  const chrome = str(psi && psi.certError);
  if (/DATE_INVALID|EXPIRED/i.test(chrome)) return CERT_WORDS.expired;
  if (/COMMON_NAME_INVALID|NAME_INVALID/i.test(chrome)) return CERT_WORDS['wrong-host'];
  if (/AUTHORITY_INVALID/i.test(chrome)) return 'a security certificate that browsers do not trust';
  return CERT_WORDS[site.sslKind] || 'an invalid security certificate';
}

// HTML-based absence checks only run on pages we could really read: their own site, loaded, not a placeholder,
// not a bot-protection page or an empty JavaScript shell.
function htmlChecked(ctx) {
  return Boolean(
    !ctx.lead.websitePlatform && ctx.site && ctx.site.status === 'ok' && ctx.analysis && !ctx.analysis.isPlaceholder && ctx.analysis.verifiable !== false,
  );
}

const PROBLEMS = {
  no_website: {
    label: 'No website',
    detect: (ctx) => {
      const l = ctx.lead;
      if (l.websitePlatform && l.redirectedTo) return `Their Google listing links to ${siteName(l)}, which forwards to a ${l.websitePlatform} (${hostOf(l.redirectedTo)}), not a website of their own.`;
      if (l.websitePlatform) return `Their Google Business Profile links to a ${l.websitePlatform} (${siteName(l)}) instead of a website of their own.`;
      return l.website ? null : 'No website is listed on their Google Business Profile, so people who find them on Maps have nowhere to learn more or book.';
    },
  },
  site_down: {
    label: 'Website down',
    detect: (ctx) => {
      const site = ctx.site;
      // Only after the second load 15 s later failed too (the "Recheck Website" step). A custom pack that adds this
      // check to a workflow built without the recheck nodes never claims it after a single failed load.
      if (!ctx.lead.website || !site || !DOWN_STATUSES.includes(site.status) || !site.rechecked) return null;
      if (site.status === 'not-found' && !isHomepage(ctx.lead)) {
        return { label: 'Broken website link', evidence: `The website link on their Google listing (${listedLink(ctx.lead)}) leads to a "page not found" error (404).` };
      }
      return `The website listed on Google (${siteName(ctx.lead)}) didn't load in two checks a few seconds apart: ${FETCH_REASONS[site.status]}.`;
    },
  },
  ssl_error: {
    label: 'Security certificate error',
    detect: (ctx) => {
      const site = ctx.site;
      if (!site || site.status !== 'ssl-error') return null;
      const chromeAgrees = Boolean(ctx.psi && ctx.psi.certError);
      // Node rejects some certificates that Chrome accepts (a missing intermediate certificate, for example):
      // claim it only when Chrome (via PageSpeed) also refused it, or the fault is one every browser rejects.
      if (!chromeAgrees && !CERT_WORDS[site.sslKind]) return null;
      const how = chromeAgrees ? " (Google's PageSpeed test hit the same error in Chrome)" : '';
      return `${siteName(ctx.lead)} has ${certWording(site, ctx.psi)}, so browsers show visitors a "Your connection is not private" warning instead of the site${how}.`;
    },
  },
  placeholder_site: {
    label: 'Placeholder website',
    detect: (ctx) =>
      ctx.site && ctx.site.status === 'ok' && ctx.analysis && ctx.analysis.isPlaceholder
        ? `${siteName(ctx.lead)} only shows a placeholder page ("coming soon", parked or default server page), not a real website.`
        : null,
  },
  slow_mobile: {
    label: 'Slow on mobile',
    detect: (ctx) => {
      const p = ctx.psi;
      if (!p || !p.ok || p.performance === null || p.performance >= ctx.t.slowMobileScore) return null;
      const lcp = p.lcp ? ` and the main content took ${p.lcp} to appear` : '';
      const field = p.fieldSpeed === 'SLOW' ? " Chrome's data from real visitors also rates the site slow." : '';
      return `In Google's PageSpeed mobile test (a simulated phone on a 4G connection) the homepage scored ${p.performance}/100${lcp}.${field}`;
    },
  },
  no_https: {
    label: 'Not secure (no HTTPS)',
    detect: (ctx) => {
      const p = ctx.psi;
      // Decided by the address the page finally loads on. Lighthouse's "is-on-https" audit also fails for a single
      // http:// image or an http→https redirect, which would make the claim false.
      if (!p || !p.ok || !p.finalUrl) return null;
      return /^http:\/\//i.test(p.finalUrl) ? `${siteName(ctx.lead)} loads without HTTPS, so Chrome marks it "Not secure" next to the address.` : null;
    },
  },
  not_mobile_friendly: {
    label: 'Not mobile-friendly',
    detect: (ctx) => {
      if (ctx.lead.websitePlatform) return null;
      const p = ctx.psi;
      const psiViewport = p && p.ok ? p.viewport : null;
      if (psiViewport === 1) return null;
      const claim = `${siteName(ctx.lead)} isn't set up for phones (no mobile viewport), so it shows as a shrunken desktop page on mobile.`;
      if (psiViewport === 0) return claim; // Lighthouse confirms it
      return htmlChecked(ctx) && !ctx.analysis.hasViewport ? claim : null;
    },
  },
  outdated_site: {
    label: 'Outdated website',
    detect: (ctx) => {
      if (!htmlChecked(ctx) || !ctx.analysis.copyrightYear) return null;
      const year = ctx.now.getUTCFullYear();
      const age = year - ctx.analysis.copyrightYear;
      if (age < ctx.t.outdatedYears || age > 40) return null;
      return `The footer of their homepage still shows © ${ctx.analysis.copyrightYear}, which suggests the site hasn't been updated in about ${plural(age, 'year')}.`;
    },
  },
  weak_seo: {
    label: 'Weak SEO basics',
    detect: (ctx) => {
      const psi = ctx.psi && ctx.psi.ok ? ctx.psi : null;
      const missing = [];
      if (htmlChecked(ctx)) {
        // Lighthouse runs the page in Chrome, so its verdict wins over our reading of the raw HTML.
        if (!ctx.analysis.hasTitle && !(psi && psi.documentTitle === 1)) missing.push('no page title');
        if (!ctx.analysis.hasMetaDescription && !(psi && psi.metaDescription === 1)) missing.push('no meta description');
        if (!ctx.analysis.hasH1) missing.push('no main heading (H1)');
      }
      const seo = psi ? psi.seo : null;
      const lowScore = seo !== null && seo !== undefined && seo < ctx.t.weakSeoScore;
      if (!missing.length && !lowScore) return null;
      const parts = [];
      if (lowScore) parts.push(`Google's Lighthouse SEO check scores the homepage ${seo}/100`);
      if (missing.length) parts.push(`the homepage has ${missing.join(', ')}`);
      const sentence = parts.join(' and ');
      return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
    },
  },
  no_schema: {
    label: 'No schema markup',
    detect: (ctx) =>
      htmlChecked(ctx) && !ctx.analysis.hasSchema
        ? `We found no structured data (schema.org LocalBusiness) on their homepage; it helps Google show their hours, reviews and services in search.`
        : null,
  },
  low_rating: {
    label: 'Low Google rating',
    detect: (ctx) => {
      const { rating, reviewCount } = ctx.lead;
      if (rating === null || rating === undefined || reviewCount < ctx.t.minReviewsForRating || rating >= ctx.t.lowRating) return null;
      const m = ctx.market && ctx.market.medianRating;
      const comparison = m && m > rating ? ` (similar businesses nearby average ${m}★)` : '';
      return `They're rated ${rating}★ on Google from ${plural(reviewCount, 'review')}${comparison}.`;
    },
  },
  few_reviews: {
    label: 'Few Google reviews',
    detect: (ctx) => {
      const m = ctx.market;
      const n = ctx.lead.reviewCount;
      if (!m || m.count < ctx.t.minMarketForComparison || m.medianReviews === null) return null;
      if (n >= ctx.t.fewReviewsMax || n >= m.medianReviews * ctx.t.fewReviewsRatio) return null;
      const top = m.topReviewsAvg ? `, and the top 3 average ${m.topReviewsAvg}` : '';
      return `They have ${plural(n, 'Google review')} while similar businesses in the same search have a median of ${m.medianReviews}${top}.`;
    },
  },
  no_booking: {
    label: 'No online booking',
    detect: (ctx) =>
      htmlChecked(ctx) && !ctx.analysis.hasBooking
        ? `We couldn't find an online booking button or booking widget on their homepage (${siteName(ctx.lead)}).`
        : null,
  },
  no_chat: {
    label: 'No chat or WhatsApp',
    detect: (ctx) => {
      if (!htmlChecked(ctx) || ctx.analysis.hasChat || ctx.analysis.hasWhatsApp) return null;
      // A tag manager can add a chat widget that only appears in a browser: we can't be sure, so no claim.
      if (ctx.analysis.hasTagManager) return null;
      return `We didn't see a live chat, chatbot or WhatsApp button on their homepage (${siteName(ctx.lead)}).`;
    },
  },
  limited_hours: {
    label: 'Limited opening hours',
    detect: (ctx) => {
      const h = ctx.lead.hours;
      if (!h || !h.known || h.open24h) return null;
      // Closed on Sunday alone is normal; closed all weekend or closing early most weekdays is not.
      const closedWeekend = h.closedDays.includes('Saturday') && h.closedDays.includes('Sunday');
      const early = h.earlyCloseWeekdays >= ctx.t.earlyCloseWeekdays;
      if (!closedWeekend && !early) return null;
      const parts = [];
      if (early) parts.push(`close before 6pm on ${plural(h.earlyCloseWeekdays, 'weekday')}`);
      if (closedWeekend) parts.push('are closed all weekend');
      return `According to their Google listing they ${parts.join(' and ')}.`;
    },
  },
  no_social: {
    label: 'No social media links',
    detect: (ctx) => {
      if (!htmlChecked(ctx) || ctx.analysis.hasSocial || ctx.analysis.hasSocialWidget) return null;
      return `Their homepage (${siteName(ctx.lead)}) doesn't link to an Instagram, Facebook or TikTok account.`;
    },
  },
  no_tracking: {
    label: 'No analytics or ad pixel',
    detect: (ctx) => {
      if (!htmlChecked(ctx) || ctx.analysis.hasAnalytics || ctx.analysis.hasMetaPixel) return null;
      // Wix, Squarespace, Shopify and similar builders track visitors themselves; tags can also hide in a tag manager.
      if (ctx.analysis.builder || ctx.analysis.hasTagManager) return null;
      return `We didn't find a Google Analytics tag or a Meta Pixel in their homepage code, so they likely can't retarget website visitors with Instagram or Facebook ads.`;
    },
  },
};

// pack.weights decides which checks run for a niche and how much each one counts.
function detectProblems(ctx, pack) {
  const t = Object.assign({}, DEFAULT_THRESHOLDS, (pack && pack.thresholds) || {});
  const full = Object.assign({ now: new Date() }, ctx, { t });
  // A social/booking-platform link is not their website: never judge that page's speed, HTML or SSL.
  if (full.lead && full.lead.websitePlatform) Object.assign(full, { site: null, analysis: null, psi: null });
  // A "coming soon" or parked page is the problem; its speed or SEO score is beside the point.
  if (full.analysis && full.analysis.isPlaceholder) full.psi = null;
  const out = [];
  for (const [id, points] of Object.entries((pack && pack.weights) || {})) {
    const def = PROBLEMS[id];
    if (!def || !(points > 0)) continue;
    const found = def.detect(full);
    if (!found) continue;
    // A check returns its evidence sentence, or { label, evidence } when the finding needs a more precise label.
    const evidence = typeof found === 'string' ? found : found.evidence;
    const label = typeof found === 'string' ? def.label : found.label || def.label;
    if (evidence) out.push({ id, label, evidence, points });
  }
  out.sort((a, b) => b.points - a.points);
  return out;
}

function scoreProblems(problems) {
  return Math.min(100, problems.reduce((sum, p) => sum + p.points, 0));
}

function priorityFor(score) {
  if (score >= 60) return 'Hot';
  if (score >= 30) return 'Warm';
  if (score > 0) return 'Low';
  return 'None';
}

function rankLeads(leads) {
  return [...leads].sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount || String(a.name).localeCompare(String(b.name)));
}

// @export
module.exports = { DEFAULT_THRESHOLDS, PROBLEMS, FETCH_REASONS, htmlChecked, detectProblems, scoreProblems, priorityFor, rankLeads };
