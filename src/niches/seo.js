// Niche pack: local SEO freelancers and agencies.
module.exports = {
  id: 'seo',
  title: 'Local SEO',
  tagline: 'Find businesses that are losing Google searches to competitors.',
  needsWebsiteCheck: true,
  needsPageSpeed: true,
  defaultService: 'local SEO (getting found on Google Search and Google Maps)',
  defaultOffer: 'a free mini SEO audit with the 3 fixes that would help them most',
  exampleSearch: { businessType: 'plumbers', location: 'Denver, CO' },
  weights: {
    weak_seo: 35,
    slow_mobile: 25,
    no_schema: 20,
    few_reviews: 20,
    not_mobile_friendly: 20,
    no_https: 15,
    no_website: 15,
    outdated_site: 10,
  },
  thresholds: {},
  pitchAngle:
    'The sender does local SEO. Connect the problem to being found: when someone nearby searches for this kind of business, competitors with these basics fixed tend to show up first. Avoid jargon; explain any technical term in a few plain words.',
  fallback: {
    subject: '{shortName} on Google',
    impact: 'Small fixes like these often decide who shows up first when someone nearby searches on Google.',
  },
};
