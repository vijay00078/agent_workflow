// Niche pack: social media managers and paid-social / ads agencies.
module.exports = {
  id: 'social-media',
  title: 'Social Media & Ads',
  tagline: 'Find businesses with no social presence on their website and no ad tracking.',
  needsWebsiteCheck: true,
  needsPageSpeed: false,
  defaultService: 'social media management and Instagram/Facebook ads',
  defaultOffer: '3 ready-to-post content ideas for their Instagram, free',
  exampleSearch: { businessType: 'gyms', location: 'Pune, India' },
  weights: {
    no_social: 40,
    no_tracking: 30,
    no_website: 15,
    few_reviews: 15,
    outdated_site: 10,
  },
  thresholds: {},
  pitchAngle:
    'The sender manages social media and ads. Explain that many customers check Instagram or Facebook before visiting, and that without a pixel they cannot re-reach people who already visited the website. Keep it practical, not salesy.',
  fallback: {
    subject: '{shortName} on Instagram',
    impact: "A lot of customers check Instagram or Facebook before they visit, and it's also the easiest way to bring back people who already looked at the website.",
  },
};
