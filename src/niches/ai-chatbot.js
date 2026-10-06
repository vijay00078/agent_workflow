// Niche pack: AI automation agencies selling chatbots, AI receptionists and booking automation.
module.exports = {
  id: 'ai-chatbot',
  title: 'AI Chatbots & Booking',
  tagline: 'Find businesses that lose enquiries after hours: no online booking, no chat, short opening hours.',
  needsWebsiteCheck: true,
  needsPageSpeed: false,
  defaultService: 'AI assistants that answer enquiries and book appointments 24/7',
  defaultOffer: 'a free 5-minute demo of an AI assistant trained on your own website',
  exampleSearch: { businessType: 'physiotherapy clinics', location: 'Bangalore, India' },
  weights: {
    no_booking: 35,
    no_chat: 30,
    limited_hours: 25,
    no_website: 10,
  },
  thresholds: {},
  pitchAngle:
    'The sender builds AI assistants and booking automation. Focus on enquiries that arrive after hours or while staff are busy, and how an assistant can answer and book instantly. Do not claim the AI replaces staff; position it as never missing an enquiry.',
  fallback: {
    subject: 'after-hours enquiries at {shortName}',
    impact: 'Every enquiry that arrives after hours or while the front desk is busy is a booking that can easily go to someone else.',
  },
};
