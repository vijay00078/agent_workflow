// The problem catalog. Each check turns raw facts about a business into a short, verifiable piece of
// evidence. A check returns null when the facts don't support the claim (or we could not verify it).

// @node-only-start
const { hostOf, plural } = require('./util');
// @node-only-end

const DEFAULT_THRESHOLDS = {
  slowMobileScore: 50, // PageSpeed mobile performance below this = slow
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

const FETCH_REASONS = {
  'domain-not-found': "the domain doesn't resolve (it may have expired)",
  'connection-failed': 'the server refused the connection',
  timeout: 'it took more than 20 seconds to respond',
  'not-found': 'the homepage returns "page not found" (404)',
  'server-error': 'the server returns an error page',
  'redirect-loop': 'it gets stuck in a redirect loop',
  error: 'it failed to load',
};

function htmlChecked(ctx) {
  return Boolean(!ctx.lead.websitePlatform && ctx.site && ctx.site.status === 'ok' && ctx.analysis && !ctx.analysis.isPlaceholder);
}

const PROBLEMS = {
  no_website: {
    label: 'No website',
    detect: (ctx) => {
      if (ctx.lead.websitePlatform) return `Their Google Business Profile links to a ${ctx.lead.websitePlatform} (${siteName(ctx.lead)}) instead of a website of their own.`;
      return ctx.lead.website ? null : 'No website is listed on their Google Business Profile, so people who find them on Maps have nowhere to learn more or book.';
    },
  },
  site_down: {
    label: 'Website down',
    detect: (ctx) => {
      if (!ctx.lead.website || !ctx.site || ctx.site.reachable !== false || ctx.site.status === 'ssl-error') return null;
      const reason = FETCH_REASONS[ctx.site.status] || FETCH_REASONS.error;
      return `The website listed on Google (${siteName(ctx.lead)}) didn't load when checked: ${reason}.`;
    },
  },
  ssl_error: {
    label: 'Security certificate error',
    detect: (ctx) =>
      ctx.site && ctx.site.status === 'ssl-error'
        ? `${siteName(ctx.lead)} has a broken or expired security certificate, so browsers show visitors a "your connection is not private" warning.`
        : null,
  },
  placeholder_site: {
    label: 'Placeholder website',
    detect: (ctx) =>
      ctx.site && ctx.site.status === 'ok' && ctx.analysis && ctx.analysis.isPlaceholder
        ? `${siteName(ctx.lead)} is only a placeholder page ("coming soon", parked or default server page), not a real website.`
        : null,
  },
  slow_mobile: {
    label: 'Slow on mobile',
    detect: (ctx) => {
      const p = ctx.psi;
      if (!p || !p.ok || p.performance === null || p.performance >= ctx.t.slowMobileScore) return null;
      const lcp = p.lcp ? `; the main content takes ${p.lcp} to appear on a phone` : '';
      const field = p.fieldSpeed === 'SLOW' ? ' Real-visitor data from Chrome also rates it slow.' : '';
      return `Google PageSpeed scores the mobile site ${p.performance}/100${lcp}.${field}`;
    },
  },
  no_https: {
    label: 'Not secure (no HTTPS)',
    detect: (ctx) => {
      const p = ctx.psi;
      if (!p || !p.ok) return null;
      const insecure = p.isOnHttps === 0 || (p.finalUrl && /^http:\/\//i.test(p.finalUrl));
      return insecure ? `${siteName(ctx.lead)} doesn't use HTTPS, so Chrome marks it "Not secure" next to the address.` : null;
    },
  },
  not_mobile_friendly: {
    label: 'Not mobile-friendly',
    detect: (ctx) => {
      if (!htmlChecked(ctx)) return null;
      const psiSaysOk = ctx.psi && ctx.psi.ok && ctx.psi.viewport === 1;
      if (ctx.analysis.hasViewport || psiSaysOk) return null;
      return `${siteName(ctx.lead)} isn't set up for phones (no mobile viewport), so it shows as a shrunken desktop page on mobile.`;
    },
  },
  outdated_site: {
    label: 'Outdated website',
    detect: (ctx) => {
      if (!htmlChecked(ctx) || !ctx.analysis.copyrightYear) return null;
      const year = ctx.now.getUTCFullYear();
      const age = year - ctx.analysis.copyrightYear;
      if (age < ctx.t.outdatedYears || age > 40) return null;
      return `The website footer still says © ${ctx.analysis.copyrightYear}, which suggests it hasn't been updated in about ${plural(age, 'year')}.`;
    },
  },
  weak_seo: {
    label: 'Weak SEO basics',
    detect: (ctx) => {
      if (!htmlChecked(ctx)) return null;
      const missing = [];
      if (!ctx.analysis.hasTitle) missing.push('no page title');
      if (!ctx.analysis.hasMetaDescription) missing.push('no meta description');
      if (!ctx.analysis.hasH1) missing.push('no main heading (H1)');
      const seo = ctx.psi && ctx.psi.ok ? ctx.psi.seo : null;
      const lowScore = seo !== null && seo < ctx.t.weakSeoScore;
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
        ? `The homepage has no structured data (schema.org LocalBusiness), which helps Google show their hours, reviews and services in search.`
        : null,
  },
  low_rating: {
    label: 'Low Google rating',
    detect: (ctx) => {
      const { rating, reviewCount } = ctx.lead;
      if (rating === null || reviewCount < ctx.t.minReviewsForRating || rating >= ctx.t.lowRating) return null;
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
        ? `There's no way to book online on ${siteName(ctx.lead)}; customers have to call during opening hours.`
        : null,
  },
  no_chat: {
    label: 'No chat or WhatsApp',
    detect: (ctx) =>
      htmlChecked(ctx) && !ctx.analysis.hasChat && !ctx.analysis.hasWhatsApp
        ? `The website has no live chat, chatbot or WhatsApp button, so questions outside office hours go unanswered.`
        : null,
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
      return `According to Google they ${parts.join(' and ')}, so calls and enquiries outside those hours go to voicemail.`;
    },
  },
  no_social: {
    label: 'No social media links',
    detect: (ctx) =>
      htmlChecked(ctx) && !ctx.analysis.hasSocial
        ? `${siteName(ctx.lead)} doesn't link to any Instagram, Facebook or TikTok account.`
        : null,
  },
  no_tracking: {
    label: 'No analytics or ad pixel',
    detect: (ctx) =>
      htmlChecked(ctx) && !ctx.analysis.hasAnalytics && !ctx.analysis.hasMetaPixel
        ? `The website has no Google Analytics or Meta Pixel installed, so they can't measure visitors or retarget them with ads.`
        : null,
  },
};

// pack.weights decides which checks run for a niche and how much each one counts.
function detectProblems(ctx, pack) {
  const t = Object.assign({}, DEFAULT_THRESHOLDS, (pack && pack.thresholds) || {});
  const full = Object.assign({ now: new Date() }, ctx, { t });
  // A social/booking-platform link is not their website: never judge that page's speed, HTML or SSL.
  if (full.lead && full.lead.websitePlatform) Object.assign(full, { site: null, analysis: null, psi: null });
  const out = [];
  for (const [id, points] of Object.entries((pack && pack.weights) || {})) {
    const def = PROBLEMS[id];
    if (!def || !(points > 0)) continue;
    const evidence = def.detect(full);
    if (evidence) out.push({ id, label: def.label, evidence, points });
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
module.exports = { DEFAULT_THRESHOLDS, PROBLEMS, FETCH_REASONS, detectProblems, scoreProblems, priorityFor, rankLeads };
