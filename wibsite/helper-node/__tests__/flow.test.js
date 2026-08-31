const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.STORE_PATH = path.join(os.tmpdir(), `wibsite-store-test-${process.pid}.json`);
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PG_HOST = '127.0.0.1';
process.env.PG_PORT = '5433';
// Puerto Ãºnico por proceso: evita colisiÃ³n EADDRINUSE con otros jobs de tests
// (unit/smoke/flow) que arrancan la app en paralelo en el mismo runner de CI.
process.env.PORT = String(3100 + (process.pid % 2000));
process.env.TWILIO_ACCOUNT_SID = 'AC-test';

const request = require('supertest');
const app = require('../index');
const storeFacade = require('../services/store');

// En CI la variable protegida HELPER_API_KEY se inyecta; el header debe usar esa
// key real. Localmente (sin la variable) se usa la key de test.
const API_KEY = process.env.HELPER_API_KEY || 'test-key';

jest.mock('../services/ragEngine', () => require('./helpers/ragEngineMock'));

describe('Flujos de Negocio (Business Flows) â€” pipeline nativo Wibsite 2.0', () => {
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
        Body: 'Hola, quiero mÃ¡s informaciÃ³n sobre los servicios',
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
      .set('x-api-key', API_KEY)
      .send({ lead_id: leadId, score: 85, score_factors: { budget: 0.8, authority: 0.9 } });

    expect(resScore.status).toBe(201);
    expect(resScore.body.score).toBe(85);
    expect(storeFacade.getStore().leads.find(l => l.id === leadId).score).toBe(85);

    const resCampaign = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({
        name: 'Promo Seguimiento',
        message_template: 'Hola {{name}}, tenemos una promo para ti.',
        audience_filter: { all: true },
        scheduled_at: null
      });

    expect(resCampaign.status).toBe(201);
    expect(resCampaign.body.status).toBe('draft');
  });

  test('Flujo de Opt-Out (Unsubscribe) vÃ­a STOP', async () => {
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
      .send({ From: '+59170000003', Body: 'Hola, necesito una cotizaciÃ³n', MessageSid: 'SM-test-103' });

    const res = await request(app).get('/api/leads').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(l => l.phone === '+59170000003')).toBe(true);
  });

  // C1: el motor de campañas debe excluir opt-outs en todo envío
  test('C1: broadcast excluye leads opt-out y registra envio_bloqueado_optout', async () => {
    const store = storeFacade.getStore();
    const optLead = { id: 'C1-opt-1', name: 'Opt Out Lead', phone: '+591C1000001', email: 'opt1@example.com', status: 'opted_out', opt_out: true };
    const activeLead = { id: 'C1-active-1', name: 'Active Lead', phone: '+591C1000002', email: 'active1@example.com', status: 'active', opt_out: false };
    store.leads.push(optLead, activeLead);
    store.optOuts.push({ id: 'C1-oo-1', phone: '+591C1000001', email: 'opt1@example.com', reason: 'STOP', created_at: new Date().toISOString() });

    const res = await request(app)
      .post('/api/channels/broadcast')
      .set('x-api-key', API_KEY)
      .send({ channel: 'email', message_template: 'Hola {{name}}, oferta especial', audience: { all: true } });

    expect(res.status).toBe(200);
    expect(res.body.blocked_opt_out).toBe(1);
    expect(res.body.results.some(r => r.to === 'opt1@example.com')).toBe(false);
    expect(res.body.results.some(r => r.to === 'active1@example.com')).toBe(true);
  });

  test('C1: broadcast con phones explicitos filtra opt-outs', async () => {
    const store = storeFacade.getStore();
    if (!store.leads.some(l => l.phone === '+591C1000001')) {
      store.leads.push({ id: 'C1-opt-2', name: 'Opt2', phone: '+591C1000001', email: 'opt1@example.com', status: 'opted_out', opt_out: true });
    }

    const res = await request(app)
      .post('/api/channels/broadcast')
      .set('x-api-key', API_KEY)
      .send({
        channel: 'email',
        message_template: 'Hola {{name}}',
        audience: { phones: ['opt1@example.com', 'active1@example.com'] },
      });

    expect(res.status).toBe(200);
    expect(res.body.blocked_opt_out).toBe(1);
    expect(res.body.results.some(r => r.to === 'opt1@example.com')).toBe(false);
  });

  test('C1: resolveSegmentAudience excluye leads opted_out', async () => {
    const store = storeFacade.getStore();
    const res = await request(app)
      .post('/api/segments')
      .set('x-api-key', API_KEY)
      .send({ name: 'C1-segment-test', description: 'test', rules: [{ field: 'score', op: 'gte', value: 0 }] });

    expect(res.status).toBe(201);
    const segId = res.body.id;

    const resolveRes = await request(app)
      .get(`/api/segments/${segId}/resolve`)
      .set('x-api-key', API_KEY);

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.leads.some(l => l.status === 'opted_out')).toBe(false);
  });

  // C9: dry-run resuelve audiencia y bloquea envio sin confirmacion
  test('C9: start sin dry-run confirmado devuelve 428', async () => {
    const resCamp = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({ name: 'C9-no-dryrun', message_template: 'Hola {{name}}', audience_filter: { all: true } });
    expect(resCamp.status).toBe(201);

    const resStart = await request(app)
      .post(`/api/campaigns/${resCamp.body.id}/start`)
      .set('x-api-key', API_KEY)
      .send({});
    expect(resStart.status).toBe(428);
    expect(resStart.body.error).toBe('dry_run_required');
  });

  test('C9: dry-run devuelve conteo y costo estimado sin enviar', async () => {
    const store = storeFacade.getStore();
    store.leads.push({ id: 'C9-lead-1', name: 'Dry Run Lead', phone: '+591C9000001', email: 'dry1@example.com', status: 'active', score: 50 });
    const resCamp = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({ name: 'C9-dryrun-ok', message_template: 'Hola {{name}}', audience_filter: { all: true }, channel: 'whatsapp' });
    expect(resCamp.status).toBe(201);

    const resDry = await request(app)
      .post(`/api/campaigns/${resCamp.body.id}/dry-run`)
      .set('x-api-key', API_KEY)
      .send({});
    expect(resDry.status).toBe(200);
    expect(resDry.body.audience_total).toBeGreaterThan(0);
    expect(resDry.body.cost_estimate_usd).toBeGreaterThan(0);
    expect(resDry.body.channel).toBe('whatsapp');
  });

  test('C9: dry-run confirmado permite iniciar la campana', async () => {
    const resCamp = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({ name: 'C9-confirmado', message_template: 'Hola {{name}}', audience_filter: { all: true } });
    const campId = resCamp.body.id;

    const resConfirm = await request(app)
      .post(`/api/campaigns/${campId}/dry-run/confirm`)
      .set('x-api-key', API_KEY)
      .send({});
    expect(resConfirm.status).toBe(200);
    expect(resConfirm.body.status).toBe('dry_run_confirmed');

    const resStart = await request(app)
      .post(`/api/campaigns/${campId}/start`)
      .set('x-api-key', API_KEY)
      .send({});
    expect(resStart.status).toBe(200);
    expect(resStart.body.status).toBe('sending');
  });

  // C6: campañas por evento de fecha (aniversario/cumpleaños)
  test('C6: trigger de fecha dispara la campaña para leads del día', async () => {
    const store = storeFacade.getStore();
    const today = new Date().toISOString().slice(0, 10);
    store.leads.push({ id: 'C6-bday-1', name: 'Cumpleañero', phone: '+591C6000001', email: 'bday1@example.com', status: 'active', custom_fields: { birthday: today } });
    store.leads.push({ id: 'C6-nobday-1', name: 'Sin Cumple', phone: '+591C6000002', email: 'nobday1@example.com', status: 'active', custom_fields: { birthday: '1990-01-01' } });

    const resCamp = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({
        name: 'C6-birthday-campaign',
        message_template: 'Hola {{name}}, feliz cumpleaños 🎉',
        audience_filter: { all: true },
        event_trigger: { field: 'birthday', offset_days: 0 },
      });
    expect(resCamp.status).toBe(201);
    expect(resCamp.body.event_trigger).toEqual({ field: 'birthday', offset_days: 0 });

    const resRun = await request(app)
      .post('/api/campaigns/events/run')
      .set('x-api-key', API_KEY)
      .send({});
    expect(resRun.status).toBe(200);
    const hit = resRun.body.triggered.find(t => t.campaign_id === resCamp.body.id);
    expect(hit).toBeDefined();
    expect(hit.matches).toBe(1);
    expect(hit.date).toBe(today);
  });

  test('C6: campaña por evento excluye leads opted_out', async () => {
    const store = storeFacade.getStore();
    const today = new Date().toISOString().slice(0, 10);
    store.leads.push({ id: 'C6-opt-1', name: 'Opted', phone: '+591C6000003', email: 'opt6@example.com', status: 'opted_out', opt_out: true, custom_fields: { birthday: today } });

    const resCamp = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({
        name: 'C6-birthday-optout',
        message_template: 'Hola {{name}}',
        audience_filter: { all: true },
        event_trigger: { field: 'birthday', offset_days: 0 },
      });
    expect(resCamp.status).toBe(201);

    const resRun = await request(app)
      .post('/api/campaigns/events/run')
      .set('x-api-key', API_KEY)
      .send({});
    expect(resRun.status).toBe(200);
    const hit = resRun.body.triggered.find(t => t.campaign_id === resCamp.body.id);
    expect(hit).toBeUndefined();
  });
});
