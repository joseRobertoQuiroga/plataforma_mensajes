const { evaluateLead } = require('./index');
const templateEngine = require('./services/templateEngine');

const mockStore = { deliveries: [] };
const mockConfig = {
  weights: { engagement: 0.2, recency: 0.2, channel_affinity: 0.2, profile_completeness: 0.2, interest_match: 0.2 },
  rules: [], thresholds: { hot: 70, warm: 40, cold: 0 }
};

const lead = {
  id: 'lead-1',
  phone: '123',
  email: 'a@b.com', // profile_completeness has both (40) + name (0) + custom(0) = 40
  clicked_link: true, // engagement has clicked (20)
  custom_fields: { segment: 'premium', interest: 'test' } 
  // channel_affinity = premium (80)
  // interest_match = 60
  // recency = 0 (no delivery)
};

// 1. Default template
process.env.AGENT_TEMPLATE_ID = 'default';
const r1 = evaluateLead(lead, mockConfig, mockStore);

// 2. Consultora software template
process.env.AGENT_TEMPLATE_ID = 'consultora-software';
const r2 = evaluateLead(lead, mockConfig, mockStore);

console.log('Result with default:', r1.score);
console.log('Result with consultora:', r2.score);

if (r1.score !== r2.score) {
  console.log('Success! Different templates yield different scores.');
  process.exit(0);
} else {
  console.log('Failed! Same score.');
  process.exit(1);
}
