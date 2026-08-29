const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { loadApp, closeApp } = require('./helpers/testApp');

jest.mock('../services/ragEngine', () => require('./helpers/ragEngineMock'));

const tmpGroupsPath = path.join(os.tmpdir(), `chat-groups-test-${process.pid}-${Date.now()}.json`);
process.env.CHAT_GROUPS_PATH = tmpGroupsPath;
delete process.env.OPENROUTER_API_KEY;

jest.setTimeout(20000);

describe('Chat Groups - Agrupación manual + IA', () => {
  let app;

  beforeAll(async () => {
    process.env.HELPER_API_KEY = 'test-api-key-123';
    app = loadApp();
  }, 15000);

  afterAll(async () => {
    await closeApp(app);
    delete process.env.HELPER_API_KEY;
    delete process.env.CHAT_GROUPS_PATH;
    try { fs.unlinkSync(tmpGroupsPath); } catch (e) { /* ignore */ }
  });

  const API_KEY = 'test-api-key-123';
  const auth = { 'x-api-key': API_KEY };
  const TENANT = 'group-tenant';
  const CONV = 'whatsapp_59177777777';

  beforeAll(async () => {
    await request(app)
      .post(`/api/conversations/${TENANT}/${CONV}`)
      .set(auth)
      .send({ metadata: { phone: '+59177777777', customerName: 'Cliente Test' } });
  });

  test('GET /api/chat-groups incluye el grupo de sistema Pendiente de revisión', async () => {
    const res = await request(app).get('/api/chat-groups').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.pendingGroupId).toBe('pending-review');
    const pending = res.body.groups.find((g) => g.id === 'pending-review');
    expect(pending).toBeDefined();
    expect(pending.isSystem).toBe(true);
  });

  test('POST /api/chat-groups crea un grupo personalizado', async () => {
    const res = await request(app)
      .post('/api/chat-groups')
      .set(auth)
      .send({ name: 'Producto caliente', description: 'Interés alto en compra', criteria: 'precio, cotizar, comprar, cuánto cuesta' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Producto caliente');
    expect(res.body.color).toBe('primary');
  });

  test('POST /api/chat-groups sin nombre devuelve 400', async () => {
    const res = await request(app).post('/api/chat-groups').set(auth).send({});
    expect(res.status).toBe(400);
  });

  test('PUT /api/chat-groups/:id actualiza nombre, criterio y color', async () => {
    const created = await request(app)
      .post('/api/chat-groups')
      .set(auth)
      .send({ name: 'Estado LED', color: 'danger' });
    const res = await request(app)
      .put(`/api/chat-groups/${created.body.id}`)
      .set(auth)
      .send({ name: 'Estado del LED', criteria: 'led, luz, no enciende', color: 'warning' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Estado del LED');
    expect(res.body.criteria).toContain('led');
    expect(res.body.color).toBe('warning');
  });

  test('PUT grupo de sistema no permite cambiar el nombre', async () => {
    const res = await request(app)
      .put('/api/chat-groups/pending-review')
      .set(auth)
      .send({ name: 'Otro nombre' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/conversations/:t/:c/group asigna manualmente', async () => {
    const group = await request(app).post('/api/chat-groups').set(auth).send({ name: 'Soporte técnico' });
    const res = await request(app)
      .put(`/api/conversations/${TENANT}/${CONV}/group`)
      .set(auth)
      .send({ groupId: group.body.id });
    expect(res.status).toBe(200);
    expect(res.body.groupId).toBe(group.body.id);
    expect(res.body.status).toBe('assigned');
    expect(res.body.source).toBe('manual');
  });

  test('PUT grupo inexistente devuelve 404', async () => {
    const res = await request(app)
      .put(`/api/conversations/${TENANT}/${CONV}/group`)
      .set(auth)
      .send({ groupId: 'no-existe' });
    expect(res.status).toBe(404);
  });

  test('PUT a pending-review marca la conversación como pendiente', async () => {
    const res = await request(app)
      .put(`/api/conversations/${TENANT}/${CONV}/group`)
      .set(auth)
      .send({ groupId: 'pending-review' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(res.body.groupId).toBe('pending-review');
  });

  test('POST /api/chat-groups/review analiza y asigna con IA (heurística sin API key)', async () => {
    const res = await request(app)
      .post('/api/chat-groups/review')
      .set(auth)
      .send({ tenantId: TENANT, conversationId: CONV });
    expect(res.status).toBe(200);
    expect(res.body.analysis).toBeDefined();
    expect(res.body.analysis.mode).toBe('heuristic');
    expect(res.body.source).toBe('ai');
  });

  test('POST /api/chat-groups/review sin conversación devuelve 404', async () => {
    const res = await request(app)
      .post('/api/chat-groups/review')
      .set(auth)
      .send({ tenantId: TENANT, conversationId: 'no-existe' });
    expect(res.status).toBe(404);
  });

  test('POST /api/chat-groups/review-pending procesa pendientes en paralelo', async () => {
    const res = await request(app)
      .post('/api/chat-groups/review-pending')
      .set(auth)
      .send({ tenantId: TENANT });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  test('DELETE /api/chat-groups/:id elimina y reenvía sus chats a pendientes', async () => {
    const group = await request(app).post('/api/chat-groups').set(auth).send({ name: 'Temporal' });
    const res = await request(app).delete(`/api/chat-groups/${group.body.id}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('deleted');
  });

  test('DELETE grupo de sistema devuelve 400', async () => {
    const res = await request(app).delete('/api/chat-groups/pending-review').set(auth);
    expect(res.status).toBe(400);
  });
});
