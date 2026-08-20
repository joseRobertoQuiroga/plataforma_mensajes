import { test, expect } from '@playwright/test';

const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
const API_KEY = process.env.HELPER_API_KEY || '';

function headers() {
  return { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) };
}

const OK = [200, 429];

test.describe('Monitoreo — logs y auditoría', () => {
  test('GET /api/logs retorna audit logs', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/logs?limit=10`, { headers: headers() });
    expect(OK).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      const logs = body.data || body.logs || body;
      expect(Array.isArray(logs)).toBeTruthy();
    }
  });

  test('GET /api/logs filtra por nivel', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/logs?limit=5&level=info`, { headers: headers() });
    expect(OK).toContain(resp.status());
  });

  test('GET /api/logs filtra por evento', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/logs?limit=5&event=api_call`, { headers: headers() });
    expect(OK).toContain(resp.status());
  });

  test('GET /api/dashboard/trends retorna tendencias', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/dashboard/trends`, { headers: headers() });
    expect(OK).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.trends || body.data).toBeTruthy();
    }
  });

  test('GET /api/dashboard/summary retorna resumen', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/dashboard/summary`, { headers: headers() });
    expect(OK).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.campaigns || body.leads || body.deliveries).toBeTruthy();
    }
  });
});

test.describe('Monitoreo — incidentes y seguridad', () => {
  test('GET /api/internal/incidents/summary retorna resumen', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/internal/incidents/summary?hours=24`, { headers: headers() });
    expect(OK).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.incidents !== undefined || body.summary).toBeTruthy();
    }
  });

  test('GET /api/internal/incidents retorna incidentes', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/internal/incidents?hours=24&limit=10`, { headers: headers() });
    expect(OK).toContain(resp.status());
  });

  test('GET /api/internal/security/events retorna eventos', async ({ request }) => {
    if (!API_KEY) test.skip();
    const resp = await request.get(`${HELPER_URL}/api/internal/security/events?hours=24`, { headers: headers() });
    expect([200, 401, 429]).toContain(resp.status());
  });

  test('GET /api/internal/fallback-events retorna fallbacks', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/internal/fallback-events?hours=24`, { headers: headers() });
    expect(OK).toContain(resp.status());
  });
});

test.describe('Monitoreo — canales y canales status', () => {
  test('GET /api/channels retorna estados de canales', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/channels`, { headers: headers() });
    expect(OK).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.channels || Array.isArray(body)).toBeTruthy();
    }
  });

  test('PATCH /api/channels/:channel actualiza estado', async ({ request }) => {
    const resp = await request.patch(`${HELPER_URL}/api/channels/whatsapp`, {
      headers: headers(),
      data: { status: 'active' },
    });
    expect([200, 404, 429]).toContain(resp.status());
  });
});

test.describe('Monitoreo — RAG y KB', () => {
  test('GET /api/knowledge-base/documents lista documentos', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/knowledge-base/documents`, { headers: headers() });
    expect(OK).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(Array.isArray(body.documents || body)).toBeTruthy();
    }
  });

  test('POST /api/knowledge-base/documents agrega documento', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/knowledge-base/documents`, {
      headers: headers(),
      data: { title: 'E2E Test Doc', content: 'Este es un documento de prueba E2E', source: 'e2e-test' },
    });
    expect([200, 201, 429]).toContain(resp.status());
  });
});

test.describe('Seed data', () => {
  test('POST /api/seed crea datos de prueba', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/seed`, { headers: headers() });
    expect([200, 201, 429]).toContain(resp.status());
  });

  test('DELETE /api/seed limpia datos', async ({ request }) => {
    const resp = await request.delete(`${HELPER_URL}/api/seed`, { headers: headers() });
    expect([200, 204, 429]).toContain(resp.status());
  });
});
