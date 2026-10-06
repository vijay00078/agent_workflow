// Turns a submission from the n8n lead form OR any website form (Webflow,
// WordPress, Elementor, Typeform, Tally, Framer…) into one standard lead.
const data = $json.body && typeof $json.body === 'object' ? $json.body : $json;
const flat = {};
(function walk(obj, prefix) {
  for (const [key, value] of Object.entries(obj || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) walk(value, prefix + key + '.');
    else flat[(prefix + key).toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
})(data, '');

const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');
function pick(...aliases) {
  const wanted = aliases.map(norm);
  for (const [key, value] of Object.entries(flat)) {
    const last = norm(key.split('.').pop());
    if (wanted.includes(last) && value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

const first = pick('first name', 'firstname', 'fname', 'given name');
const last = pick('last name', 'lastname', 'lname', 'surname', 'family name');
const rawName = pick('full name', 'fullname', 'name', 'your name', 'contact name') || [first, last].filter(Boolean).join(' ');
// "jane smith" -> "Jane Smith" (only when typed all lowercase)
const name = rawName === rawName.toLowerCase() ? rawName.replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase()) : rawName;
let website = pick('website', 'company website', 'url', 'site', 'web', 'domain');
if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website.replace(/^\/+/, '');

return {
  json: {
    name: name || 'there',
    first_name: (first || name.split(/\s+/)[0] || 'there').replace(/^./, (c) => c.toUpperCase()),
    email: pick('email', 'e-mail', 'email address', 'your email', 'work email', 'business email', 'mail').toLowerCase(),
    company: pick('company', 'company name', 'business', 'business name', 'organisation', 'organization', 'brand'),
    website,
    phone: pick('phone', 'phone number', 'mobile', 'telephone', 'tel', 'whatsapp'),
    message: pick('what can we help you with', 'message', 'details', 'project', 'project details', 'description', 'notes', 'comments', 'inquiry', 'enquiry', 'how can we help', 'question').slice(0, 4000),
    budget: pick('budget', 'project budget', 'monthly budget'),
    timeline: pick('timeline', 'timeframe', 'when', 'start date', 'deadline'),
    source: $json.formMode ? 'Lead form' : 'Website form (webhook)',
    received_at: new Date().toISOString(),
  },
};
