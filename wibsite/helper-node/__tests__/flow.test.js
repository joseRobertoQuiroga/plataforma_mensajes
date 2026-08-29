const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.STORE_PATH = path.join(os.tmpdir(), `wibsite-store-test-${process.pid}.json`);
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PG_HOST = '127.0.0.1';
process.env.PG_PORT = '5433';
process.env.TWILIO_ACCOUNT_SID = 'AC-test';

const request = require('supertest');
const app = require('../index');
const storeFacade = require('../services/store');

jest.mock('../services/ragEngine', () => require('./helpers/ragEngineMock'));

describe('Flujos de Negocio (Business Flows) — pipeline nativo Wibsite 2.0', () => {
  beforeAll(async () => {
    storeFacade.initPgStore(null);
  }, 30000);

  afterAll(async () => {
    if (fs.existsSync(process.env.STORE_PATH)) {
      fs.unlinkSync(process.env.STORE_PATH);
    }
    await app.closeAll();
  }, 30000);

  afterEach(() => {
    if (fs.existsSync(process.env.STORE_PATH)) fs.unlinkSync(process.env.STORE_PATH);
    storeFacade.getStore().leads = [];
    storeFacade.getStore().campaigns = [];
    storeFacade.getStore().scores = [];
    jest.clearAllMocks();
  });

  test('Flujo Completo: Webhook Twilio Inbound -> Lead -> Scoring -> Campaign', async () => {
    const resWebhook = await request(app)
      .post('/webhooks/twilio-inbound')
      .type('form')
      .send({
        From: 'whatsapp:+59170000001',
        Body: 'Hola, quiero más información sobre los servicios',
        ProfileName: 'Carlos Perez',
        MessageSid: 'SM-test-101'
      });

    expect(resWebhook.status).toBe(200);

    const store = storeFacade.getStore();
    expect(store.leads.length).toBeGreaterThan(0);
    const lead = store.leads.find(l => l.phone === '+59170000001');
    expect(lead).toBeDefined();
    const leadId = lead.id;

    const resScore = await request(app)
      .post('/api/leads/score')
      .set('x-api-key', 'test-key')
      .send({ lead_id: leadId, score: 85, score_factors: { budget: 0.8, authority: 0.9 } });

    expect(resScore.status).toBe(201);
    expect(resScore.body.score).toBe(85);
    expect(storeFacade.getStore().leads.find(l => l.id === leadId).score).toBe(85);

    const resCampaign = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', 'test-key')
      .send({
        name: 'Promo Seguimiento',
        message_template: 'Hola {{name}}, tenemos una promo para ti.',
        audience_filter: { all: true },
        scheduled_at: null
      });

    expect(resCampaign.status).toBe(201);
    expect(resCampaign.body.status).toBe('draft');
  });

  test('Flujo de Opt-Out (Unsubscribe) vía STOP', async () => {
    storeFacade.getStore().leads.push({ id: 'L-123', name: 'Ana', phone: '+59160000002', status: 'active', opt_out: false });

    const resWebhook = await request(app)
      .post('/webhooks/twilio-inbound')
      .type('form')
      .send({
        From: 'whatsapp:+59160000002',
        Body: 'STOP',
        ProfileName: 'Ana',
        MessageSid: 'SM-test-102'
      });

    expect(resWebhook.status).toBe(200);

    const lead = storeFacade.getStore().leads.find(l => l.phone === '+59160000002');
    expect(lead).toBeDefined();
    const optOuts = storeFacade.getStore().optOuts;
    expect(optOuts.some(o => o.phone === '+59160000002')).toBe(true);
  });

  test('GET /api/leads lista leads creados por inbound', async () => {
    await request(app)
      .post('/webhooks/twilio-inbound')
      .type('form')
      .send({ From: '+59170000003', Body: 'Hola, necesito una cotización', MessageSid: 'SM-test-103' });

    const res = await request(app).get('/api/leads').set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(l => l.phone === '+59170000003')).toBe(true);
  });
});