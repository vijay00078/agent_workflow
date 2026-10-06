// Niche pack: review generation and reputation management.
module.exports = {
  id: 'reviews',
  title: 'Google Reviews & Reputation',
  tagline: 'Find businesses with a low rating or far fewer reviews than their competitors.',
  needsWebsiteCheck: true, // only to find the contact email: the reviews checks use Google data
  needsPageSpeed: false,
  defaultService: 'getting more 5-star Google reviews from happy customers',
  defaultOffer: 'a free one-page plan to get more reviews from customers they already have',
  exampleSearch: { businessType: 'hair salons', location: 'Manchester, UK' },
  weights: {
    low_rating: 45,
    few_reviews: 45,
    no_website: 10,
  },
  thresholds: {},
  pitchAngle:
    'The sender helps businesses collect more Google reviews. Compare the business to its local competitors using only the numbers provided, and frame more reviews as winning the comparison customers make on Google Maps. Never promise a specific rating or number of reviews.',
  fallback: {
    subject: 'your Google reviews',
    impact: 'Reviews are usually the first thing people compare on Google Maps, so a steady flow of fresh reviews can change who they call.',
  },
};
