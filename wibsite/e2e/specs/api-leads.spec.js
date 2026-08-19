import { test, expect } from '@playwright/test';

const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
const API_KEY = process.env.HELPER_API_KEY || '';

function headers() {
  return { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) };
}

test.describe('Leads — scoring y perfil', () => {
  test('GET /api/leads/top retorna leads', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/leads/top?limit=5`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body.data || body)).toBeTruthy();
  });

  test('POST /api/scoring/rules retorna reglas', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/scoring/rules`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.weights || body.rules).toBeTruthy();
  });

  test('PUT /api/scoring/rules actualiza reglas', async ({ request }) => {
    const resp = await request.put(`${HELPER_URL}/api/scoring/rules`, {
      headers: headers(),
      data: {
        weights: { engagement: 0.35, recency: 0.25, channel_affinity: 0.15, profile: 0.15, interest: 0.1 },
        thresholds: { hot: 70, warm: 40 },
      },
    });
    expect(resp.status()).toBe(200);
  });

  test('POST /api/scoring/evaluate evalúa lead', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/scoring/evaluate`, {
      headers: headers(),
      data: { lead_id: 'e2e-test-lead' },
    });
    expect([200, 404]).toContain(resp.status());
  });

  test('POST /api/scoring/evaluate-all evalúa todos', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/scoring/evaluate-all`, { headers: headers() });
    expect(resp.status()).toBe(200);
  });
});

test.describe('Leads — perfil y conversaciones', () => {
  test('GET /api/leads/:id/profile retorna perfil', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/leads/nonexistent/profile`, { headers: headers() });
    expect([200, 404]).toContain(resp.status());
  });

  test('GET /api/conversations/states retorna estados válidos', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/conversations/states`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.states || body).toBeTruthy();
  });

  test('POST /api/conversations crea estado', async ({ request }) => {
    const convId = `e2e-conv-${Date.now()}`;
    const resp = await request.post(`${HELPER_URL}/api/conversations/default/${convId}`, {
      headers: headers(),
      data: { metadata: { source: 'e2e-test' } },
    });
    expect([200, 201]).toContain(resp.status());
  });
});

test.describe('Opt-Outs', () => {
  test('POST /api/opt-outs registra opt-out', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/opt-outs`, {
      headers: headers(),
      data: { phone: '+59170999999', channel: 'whatsapp', reason: 'e2e-test', source: 'api' },
    });
    expect([200, 201]).toContain(resp.status());
  });

  test('GET /api/opt-outs/check verifica opt-out', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/opt-outs/check?phone=%2B59170999999`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.optedOut === true || body.opted_out === true || body.found === true).toBeTruthy();
  });
});

test.describe('Templates', () => {
  let templateId;

  test('GET /api/templates lista plantillas', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/templates`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const templates = body.data || body;
    expect(Array.isArray(templates)).toBeTruthy();
  });

  test('POST /api/templates crea plantilla', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/templates`, {
      headers: headers(),
      data: { name: `E2E Template ${Date.now()}`, channel: 'whatsapp', body: 'Hola {{name}}' },
    });
    expect([200, 201]).toContain(resp.status());
    const body = await resp.json();
    templateId = body.id;
  });

  test('POST /api/templates/preview preview con template_id', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/templates/preview`, {
      headers: headers(),
      data: { template_id: 'default', variables: { name: 'Juan', phone: '+59170000000' } },
    });
    expect([200, 400, 404]).toContain(resp.status());
  });

  test('DELETE /api/templates/:id elimina plantilla', async ({ request }) => {
    if (!templateId) test.skip();
    const resp = await request.delete(`${HELPER_URL}/api/templates/${templateId}`, { headers: headers() });
    expect(resp.status()).toBe(200);
  });
});

test.describe('Agent Templates', () => {
  test('GET /api/agent/templates lista plantillas de negocio', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/agent/templates`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data || body.templates || Array.isArray(body)).toBeTruthy();
  });

  test('GET /api/agent/templates/validate valida todas', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/agent/templates/validate`, { headers: headers() });
    expect(resp.status()).toBe(200);
  });

  test('GET /api/agent/config retorna configuración', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/agent/config`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.business_name || body.business_type).toBeTruthy();
  });

  test('GET /api/agent/business-types retorna tipos de negocio', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/agent/business-types`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Object.keys(body).length).toBeGreaterThan(0);
  });

  test('GET /api/agent/personalities retorna personalidades', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/agent/personalities`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Object.keys(body).length).toBeGreaterThan(0);
  });

  test('GET /api/agent/config/system-prompt genera prompt', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/agent/config/system-prompt`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect((body.prompt || body.systemPrompt || '').length).toBeGreaterThan(0);
  });
});
