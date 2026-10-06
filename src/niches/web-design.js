// Niche pack: web designers and web agencies.
module.exports = {
  id: 'web-design',
  title: 'Web Design',
  tagline: 'Find local businesses with a missing, broken, slow or outdated website.',
  needsWebsiteCheck: true,
  needsPageSpeed: true,
  defaultService: 'website design and redesign',
  defaultOffer: 'a free 2-minute video showing exactly what I would fix',
  exampleSearch: { businessType: 'dentists', location: 'Austin, TX' },
  weights: {
    no_website: 45,
    site_down: 45,
    ssl_error: 40,
    placeholder_site: 40,
    slow_mobile: 30,
    not_mobile_friendly: 30,
    no_https: 25,
    outdated_site: 20,
    weak_seo: 10,
  },
  thresholds: {},
  pitchAngle:
    'The sender is a web designer. Make the owner feel the cost of the website problem in plain words (people leave, call a competitor, or stop trusting the business) and position a fast, modern, mobile-friendly website as the fix.',
  fallback: {
    subject: 'quick question about {shortName}',
    impact: "For a lot of people the website is the first impression, and when it doesn't work well on their phone they simply call the next business on the list.",
  },
};
