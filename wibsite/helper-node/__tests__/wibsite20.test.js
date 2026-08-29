const request = require('supertest');
const { loadApp, closeApp } = require('./helpers/testApp');

jest.mock('../services/ragEngine', () => require('./helpers/ragEngineMock'));

jest.setTimeout(25000);

describe('Wibsite 2.0 — Consolidación (puentes eliminados + endpoints nativos)', () => {
  let app;

  beforeAll(async () => {
    process.env.HELPER_API_KEY = 'test-api-key-123';
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    process.env.OPENROUTER_MODEL = 'openai/gpt-4o-mini';
    process.env.TWILIO_ACCOUNT_SID = 'AC-test';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    app = loadApp();
  });

  afterAll(async () => {
    await closeApp(app);
  });

  const API_KEY = 'test-api-key-123';
  const auth = { 'x-api-key': API_KEY };

  test('GET /api/leads devuelve lista con filtros', async () => {
    const res = await request(app).get('/api/leads?limit=5').set(auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/interests devuelve análisis de intereses', async () => {
    const res = await request(app).get('/api/interests?limit=5').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/agents devuelve config + catálogo', async () => {
    const res = await request(app).get('/api/agents').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('active');
    expect(res.body).toHaveProperty('current');
    expect(res.body.businessTypes.length).toBeGreaterThan(0);
    expect(res.body.personalities.length).toBeGreaterThan(0);
  });

  test('POST /api/leads crea un lead manual', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set(auth)
      .send({ name: 'Lead Test Manual', phone: '+59170009999', email: 'manual@test.com', status: 'nuevo' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Lead Test Manual');
    expect(res.body.status).toBe('nuevo');
    const list = await request(app).get('/api/leads?search=Lead+Test').set(auth);
    expect(list.body.some(l => l.phone === '+59170009999')).toBe(true);
  });

  test('PATCH /api/leads/:id acepta notas', async () => {
    await request(app).post('/api/seed').set(auth);
    const leads = await request(app).get('/api/leads?limit=1').set(auth);
    const lead = leads.body[0];
    expect(lead).toBeDefined();
    const res = await request(app)
      .patch(`/api/leads/${lead.id}`)
      .set(auth)
      .send({ notes: 'Nota de prueba Wibsite 2.0' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notes)).toBe(true);
    expect(res.body.notes[0].text).toBe('Nota de prueba Wibsite 2.0');
  });

  test('Los endpoints de puentes legacy ya no existen', async () => {
    const endpoints = [
      '/api/chatwoot/push',
      '/api/chatwoot/normalize',
      '/api/webhooks/chatwoot',
      '/webhooks/chatwoot-outbound',
      '/api/twenty/health',
      '/api/twenty/sync',
      '/api/scoring/trigger-from-chatwoot',
      '/admin',
    ];
    for (const ep of endpoints) {
      const res = await request(app).post(ep).set(auth).send({});
      expect([404, 401]).toContain(res.status);
    }
  });

  test('POST /api/chat/reply valida entrada (canal inválido → 502/400)', async () => {
    const missing = await request(app).post('/api/chat/reply').set(auth).send({ channel: 'whatsapp' });
    expect([400, 500]).toContain(missing.status);

    const badChannel = await request(app).post('/api/chat/reply').set(auth).send({ channel: 'noexiste', to: 'x', text: 'hola' });
    expect([502, 500]).toContain(badChannel.status);
  });

  test('POST /api/chat/media valida archivo requerido', async () => {
    const res = await request(app).post('/api/chat/media').set(auth).send({});
    expect(res.status).toBe(400);
  });
});