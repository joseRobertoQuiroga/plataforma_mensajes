const path = require('path');
process.env.STORE_PATH = require('os').tmpdir() + '/test-copilot-' + Date.now() + '.json';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PG_HOST = '127.0.0.1';
process.env.PG_PORT = '5433';
process.env.PORT = String(3100 + Math.floor(Math.random()*2000));
process.env.TWILIO_ACCOUNT_SID = 'AC-test';
process.env.HELPER_API_KEY = 'test-key';
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
process.env.OPENROUTER_MODEL = 'openai/gpt-4o-mini';

const app = require('./index');
const request = require('supertest');
const { getStore, updateStore } = require('./services/store');

async function test() {
  await new Promise(r => setTimeout(r, 3000));
  
  // Set business hours to 24/7 for testing
  await updateStore(s => {
    s.businessHours = { start: 0, end: 23, timezone: 'UTC' };
  });
  
  // Test 1: Create a conversation (use a message that won't trigger outside hours)
  console.log('=== Test 1: Create conversation ===');
  const res1 = await request(app)
    .post('/webhooks/twilio-inbound')
    .type('form')
    .send({ From: 'whatsapp:+59170000001', Body: 'Hola, quiero info', To: 'whatsapp:+15017250604' });
  console.log('Status:', res1.status);
  console.log('Body:', res1.body);
  
  // Get the conversation
  console.log('=== Test 2: Get conversations ===');
  const res2 = await request(app)
    .get('/api/conversations/default')
    .set('x-api-key', 'test-key');
  console.log('Conversations:', JSON.stringify(res2.body, null, 2));
  
  if (res2.body && res2.body.conversations && res2.body.conversations.length > 0) {
    const conv = res2.body.conversations[0];
    console.log('Conv ID:', conv.conversationId || conv.id);
    console.log('Messages:', conv.messages?.length || 0);
    
    // Test 3: Request copilot suggestion
    console.log('=== Test 3: Copilot suggest ===');
    const res3 = await request(app)
      .post('/api/copilot/suggest')
      .set('x-api-key', 'test-key')
      .send({
        conversation_id: conv.conversationId || conv.id,
        lead_id: null,
        max_tokens: 300,
        temperature: 0.5,
      });
    console.log('Status:', res3.status);
    console.log('Suggestion:', res3.body.suggestion);
    console.log('Model:', res3.body.model);
    console.log('Offline:', res3.body.offline);
  }
  
  console.log('=== ALL TESTS COMPLETED ===');
  process.exit(0);
}

test().catch(e => { console.error('TEST ERROR:', e); process.exit(1); });