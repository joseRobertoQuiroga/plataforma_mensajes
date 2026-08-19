import { test, expect } from '@playwright/test';

const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
const API_KEY = process.env.HELPER_API_KEY || '';

function headers() {
  return { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) };
}

test.describe('Campañas — CRUD y ciclo de vida', () => {
  let campaignId;

  test('POST /api/campaigns crea campaña', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/campaigns`, {
      headers: headers(),
      data: {
        name: `E2E Test Campaign ${Date.now()}`,
        channel: 'whatsapp',
        message_template: 'Hola {{name}}, tenemos ofertas para ti.',
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.id).toBeTruthy();
    expect(body.name).toBeTruthy();
    expect(body.status).toBe('draft');
    campaignId = body.id;
  });

  test('GET /api/campaigns lista campañas', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/campaigns`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body.data || body)).toBeTruthy();
  });

  test('GET /api/campaigns/:id obtiene campaña', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.get(`${HELPER_URL}/api/campaigns/${campaignId}`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.id).toBe(campaignId);
  });

  test('PATCH /api/campaigns/:id actualiza campaña', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.patch(`${HELPER_URL}/api/campaigns/${campaignId}`, {
      headers: headers(),
      data: { name: 'E2E Updated Campaign' },
    });
    expect(resp.status()).toBe(200);
  });

  test('POST /api/campaigns/:id/schedule programa campaña', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.post(`${HELPER_URL}/api/campaigns/${campaignId}/schedule`, {
      headers: headers(),
      data: { scheduled_at: new Date().toISOString() },
    });
    expect(resp.status()).toBe(200);
  });

  test('POST /api/campaigns/:id/start inicia campaña', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.post(`${HELPER_URL}/api/campaigns/${campaignId}/start`, {
      headers: headers(),
    });
    expect(resp.status()).toBe(200);
  });

  test('POST /api/campaigns/:id/pause pausa campaña', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.post(`${HELPER_URL}/api/campaigns/${campaignId}/pause`, {
      headers: headers(),
    });
    expect(resp.status()).toBe(200);
  });

  test('POST /api/campaigns/:id/complete completa campaña', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.post(`${HELPER_URL}/api/campaigns/${campaignId}/complete`, {
      headers: headers(),
    });
    expect(resp.status()).toBe(200);
  });

  test('GET /api/campaigns/pending lista pendientes', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/campaigns/pending`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body.data || body)).toBeTruthy();
  });

  test('GET /api/campaigns/:id/stats estadísticas', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.get(`${HELPER_URL}/api/campaigns/${campaignId}/stats`, { headers: headers() });
    expect(resp.status()).toBe(200);
  });

  test('DELETE /api/campaigns/:id elimina campaña', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.delete(`${HELPER_URL}/api/campaigns/${campaignId}`, { headers: headers() });
    expect(resp.status()).toBe(200);
  });

  test('GET /api/campaigns/:id después de DELETE retorna 404', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.get(`${HELPER_URL}/api/campaigns/${campaignId}`, { headers: headers() });
    expect(resp.status()).toBe(404);
  });
});

test.describe('Campañas — leads de campaña', () => {
  let campaignId;

  test.beforeAll(async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/campaigns`, {
      headers: headers(),
      data: { name: `E2E Leads Test ${Date.now()}`, channel: 'whatsapp', message_template: 'Test' },
    });
    if (resp.status() === 201) {
      const body = await resp.json();
      campaignId = body.id;
    }
  });

  test.afterAll(async ({ request }) => {
    if (campaignId) {
      await request.delete(`${HELPER_URL}/api/campaigns/${campaignId}`, { headers: headers() });
    }
  });

  test('POST /api/campaigns/:id/leads agrega leads', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.post(`${HELPER_URL}/api/campaigns/${campaignId}/leads`, {
      headers: headers(),
      data: { leads: [{ phone: '+59170000001', name: 'Test Lead 1' }, { phone: '+59170000002', name: 'Test Lead 2' }] },
    });
    expect(resp.status()).toBe(201);
  });

  test('GET /api/campaigns/:id/leads lista leads', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.get(`${HELPER_URL}/api/campaigns/${campaignId}/leads`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const leads = body.data || body;
    expect(leads.length).toBeGreaterThanOrEqual(1);
  });
});
