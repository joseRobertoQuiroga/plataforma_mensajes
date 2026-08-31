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
const pickVariant = app.pickVariant;

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

  // C4: campañas de reactivación automática
  test('C4: audiencia de reactivación coincide con la regla (score>=40 + sin reply en 14d)', async () => {
    const store = storeFacade.getStore();
    const oldDate = new Date(Date.now() - 20 * 86400000).toISOString();
    storeFacade.updateStore(s => {
      s.leads.push(
        { id: 'C4-warm-stale', name: 'Warm Stale', phone: '+591C4000001', email: 'c4s@example.com', status: 'active', score: 65 },
        { id: 'C4-warm-replied', name: 'Warm Replied', phone: '+591C4000002', email: 'c4r@example.com', status: 'active', score: 60 },
        { id: 'C4-cold', name: 'Cold', phone: '+591C4000003', email: 'c4c@example.com', status: 'active', score: 20 }
      );
      s.deliveries.push(
        { id: 'D-C4-1', campaign_id: 'c4', contact_id: 'C4-warm-stale', status: 'delivered', created_at: oldDate },
        { id: 'D-C4-2', campaign_id: 'c4', contact_id: 'C4-warm-replied', status: 'replied', created_at: oldDate },
        { id: 'D-C4-3', campaign_id: 'c4', contact_id: 'C4-cold', status: 'delivered', created_at: oldDate }
      );
    });
    await new Promise(r => setTimeout(r, 250));

    const res = await request(app)
      .post('/api/campaigns/reactivation/audience')
      .set('x-api-key', API_KEY)
      .send({ min_score: 40, days_without_reply: 14 });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.leads[0].id).toBe('C4-warm-stale');
  });

  test('C4: campaña de reactivación dispara sobre la audiencia', async () => {
    const oldDate = new Date(Date.now() - 20 * 86400000).toISOString();
    storeFacade.updateStore(s => {
      s.leads.push(
        { id: 'C4-run-1', name: 'Run Warm', phone: '+591C4000005', email: 'c4run@example.com', status: 'active', score: 70 }
      );
      s.deliveries.push(
        { id: 'D-C4-run-1', campaign_id: 'c4', contact_id: 'C4-run-1', status: 'delivered', created_at: oldDate }
      );
    });
    await new Promise(r => setTimeout(r, 250));

    const resCamp = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({
        name: 'C4-reactivation',
        message_template: 'Hola {{name}}, ¿seguís interesado?',
        campaign_type: 'reactivation',
        reactivation_rule: { min_score: 40, days_without_reply: 14 },
      });
    expect(resCamp.status).toBe(201);
    expect(resCamp.body.campaign_type).toBe('reactivation');

    const resRun = await request(app)
      .post('/api/campaigns/reactivation/run')
      .set('x-api-key', API_KEY)
      .send({});
    expect(resRun.status).toBe(200);
    const hit = resRun.body.triggered.find(t => t.campaign_id === resCamp.body.id);
    expect(hit).toBeDefined();
    expect(hit.audience).toBe(1);
  });

  // C5: A/B testing de plantillas
  test('C5: split 50/50 determinístico asigna variantes consistentes', async () => {
    const store = storeFacade.getStore();
    const variants = [
      { name: 'A', message_template: 'Hola {{name}}, oferta A' },
      { name: 'B', message_template: 'Hola {{name}}, oferta B' },
    ];
    const phones = Array.from({ length: 20 }, (_, i) => `+591C5${String(i).padStart(6, '0')}`);
    const firstPass = phones.map(to => {
      const v = pickVariant(to, variants);
      return v.name;
    });
    const secondPass = phones.map(to => {
      const v = pickVariant(to, variants);
      return v.name;
    });
    expect(firstPass).toEqual(secondPass); // determinístico
    const countA = firstPass.filter(n => n === 'A').length;
    const countB = firstPass.filter(n => n === 'B').length;
    expect(countA + countB).toBe(20);
    expect(Math.abs(countA - countB)).toBeLessThanOrEqual(4); // ~50/50
  });

  test('C5: ab-report separa métricas por variante y declara ganadora', async () => {
    const store = storeFacade.getStore();
    const resCamp = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({
        name: 'C5-ab',
        message_template: 'Hola {{name}}',
        variants: [
          { name: 'A', message_template: 'Oferta A {{name}}' },
          { name: 'B', message_template: 'Oferta B {{name}}' },
        ],
      });
    expect(resCamp.status).toBe(201);
    const campId = resCamp.body.id;

    store.deliveries.push(
      { id: 'D-AB-1', campaign_id: campId, contact_id: 'x1', status: 'replied', variant: 'A' },
      { id: 'D-AB-2', campaign_id: campId, contact_id: 'x2', status: 'sent', variant: 'A' },
      { id: 'D-AB-3', campaign_id: campId, contact_id: 'x3', status: 'sent', variant: 'B' },
      { id: 'D-AB-4', campaign_id: campId, contact_id: 'x4', status: 'sent', variant: 'B' }
    );

    const res = await request(app)
      .get(`/api/campaigns/${campId}/ab-report`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const a = res.body.variants.find(v => v.name === 'A');
    const b = res.body.variants.find(v => v.name === 'B');
    expect(a.stats.sent).toBe(2);
    expect(a.stats.replied).toBe(1);
    expect(b.stats.sent).toBe(2);
    expect(b.stats.replied).toBe(0);
    expect(res.body.winner).toBe('A');
  });

  // C10: atribución MVP campaña → replies → avance de etapa
  test('C10: atribución correcta sobre dataset sintético', async () => {
    const store = storeFacade.getStore();
    const resCamp = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', API_KEY)
      .send({ name: 'C10-attr', message_template: 'Hola {{name}}' });
    expect(resCamp.status).toBe(201);
    const campId = resCamp.body.id;

    store.leads.push(
      { id: 'C10-l1', name: 'Avanzó', phone: '+591C1000001', email: 'c10a@example.com', status: 'interesado', score: 70, entry_stage: 'primer_contacto' },
      { id: 'C10-l2', name: 'Replied sin avanzar', phone: '+591C1000002', email: 'c10b@example.com', status: 'primer_contacto', score: 40, entry_stage: 'primer_contacto' },
      { id: 'C10-l3', name: 'Sin reply', phone: '+591C1000003', email: 'c10c@example.com', status: 'primer_contacto', score: 30, entry_stage: 'primer_contacto' }
    );
    store.deliveries.push(
      { id: 'D-C10-1', campaign_id: campId, contact_id: 'C10-l1', status: 'replied', created_at: new Date().toISOString() },
      { id: 'D-C10-2', campaign_id: campId, contact_id: 'C10-l2', status: 'replied', created_at: new Date().toISOString() },
      { id: 'D-C10-3', campaign_id: campId, contact_id: 'C10-l3', status: 'delivered', created_at: new Date().toISOString() }
    );

    const res = await request(app)
      .get(`/api/campaigns/${campId}/attribution`)
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.delivered).toBe(3);
    expect(res.body.replied).toBe(2);
    expect(res.body.advanced_stage).toBe(1);
    expect(res.body.conversion_rate).toBeCloseTo(1 / 3, 3);
    const l1 = res.body.leads.find(l => l.lead_id === 'C10-l1');
    expect(l1.advanced_stage).toBe(true);
    const l2 = res.body.leads.find(l => l.lead_id === 'C10-l2');
    expect(l2.advanced_stage).toBe(false);
  });

  // C12: validación de plantillas por canal (HSM vs sesión)
  test('C12: plantilla HSM marcada rechaza envío directo fuera de sesión (simulado)', async () => {
    const resTpl = await request(app)
      .post('/api/templates')
      .set('x-api-key', API_KEY)
      .send({
        name: 'C12-hsm-whatsapp',
        channel: 'whatsapp',
        body: 'Hola {{name}}, oferta de la semana',
        requires_approval: true,
      });
    expect(resTpl.status).toBe(201);
    const tplId = resTpl.body.id;

    // Validación por canal: WhatsApp + HSM sin aprobación → inválido
    const resVal = await request(app)
      .get(`/api/templates/validate/${tplId}?channel=whatsapp`)
      .set('x-api-key', API_KEY);
    expect(resVal.status).toBe(200);
    expect(resVal.body.valid).toBe(false);
    expect(resVal.body.requires_approval).toBe(true);

    // Broadcast con template_id HSM en WhatsApp → rechazado (400)
    const resBroadcast = await request(app)
      .post('/api/channels/broadcast')
      .set('x-api-key', API_KEY)
      .send({
        channel: 'whatsapp',
        message_template: 'Hola {{name}}',
        template_id: tplId,
        audience: { phones: ['+591C12000001'] },
      });
    expect(resBroadcast.status).toBe(400);
    expect(resBroadcast.body.error).toBe('template_not_valid_for_channel');

    // Mismo template en Telegram (sesión libre) → válido
    const resTg = await request(app)
      .get(`/api/templates/validate/${tplId}?channel=telegram`)
      .set('x-api-key', API_KEY);
    expect(resTg.status).toBe(200);
    expect(resTg.body.valid).toBe(true);
  });
});
