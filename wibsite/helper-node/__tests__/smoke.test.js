const request = require('supertest');
const { loadApp, closeApp } = require('./helpers/testApp');

jest.mock('../services/ragEngine', () => require('./helpers/ragEngineMock'));

jest.setTimeout(25000);

describe('Smoke Tests - flujo esencial', () => {
  let app;

  beforeAll(async () => {
    process.env.HELPER_API_KEY = 'test-api-key-123';
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    process.env.OPENROUTER_MODEL = 'openai/gpt-4o-mini';
    process.env.TWILIO_ACCOUNT_SID = 'AC-test';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.TWENTY_API_KEY = 'eyJtest';
    process.env.TWENTY_URL = 'http://localhost:3001';
    process.env.N8N_URL = 'http://n8n:5678';
    process.env.CHATWOOT_URL = 'http://chatwoot:3000';
    process.env.CHATWOOT_INBOX_IDENTIFIER = 'test-inbox';
    app = loadApp();
  });

  afterAll(async () => {
    await closeApp(app);
  });

  const API_KEY = 'test-api-key-123';
  const auth = { 'x-api-key': API_KEY };

  test('health y métricas críticas responden con estado OK', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(health.body.service).toBe('wibsite-helper');

    const metrics = await request(app).get('/api/sli/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.body.requests).toBeDefined();
    expect(metrics.body.performance).toBeDefined();
  });

  test('campañas, scoring y canales responden con estructura estable', async () => {
    const campaigns = await request(app).get('/api/campaigns').set(auth);
    expect(campaigns.status).toBe(200);
    expect(campaigns.body).toHaveProperty('data');
    expect(campaigns.body).toHaveProperty('total');

    const scoring = await request(app).get('/api/scoring/rules').set(auth);
    expect(scoring.status).toBe(200);
    expect(scoring.body).toHaveProperty('weights');
    expect(scoring.body).toHaveProperty('thresholds');
    expect(scoring.body).toHaveProperty('rules');

    const channels = await request(app).get('/api/channels').set(auth);
    expect(channels.status).toBe(200);
    expect(Array.isArray(channels.body)).toBe(true);
    expect(channels.body.length).toBeGreaterThan(0);
  });
});
