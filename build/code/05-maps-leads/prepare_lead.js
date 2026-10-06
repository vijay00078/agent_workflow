// Flattens one Google Maps result into a clean lead record.
// Empty contact fields are filled later from the business website.
const place = $json;
const form = $('Lead Search Form').first().json;
const text = (v) => (v && typeof v === 'object' ? v.text : v) || '';

return {
  json: {
    place_id: place.id || '',
    name: text(place.displayName),
    category: text(place.primaryTypeDisplayName),
    address: place.formattedAddress || '',
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || '',
    website: place.websiteUri || '',
    rating: place.rating ?? '',
    reviews: place.userRatingCount ?? 0,
    maps_url: place.googleMapsUri || '',
    search: `${form['Business type']} in ${form['City or area']}`,
    email: '',
    other_emails: '',
    instagram: '',
    facebook: '',
    linkedin: '',
    website_title: '',
    website_summary: '',
    website_signals: place.websiteUri ? '' : 'No website listed on Google Maps',
    contact_url: '',
  },
};
