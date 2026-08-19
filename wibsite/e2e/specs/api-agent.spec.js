import { test, expect } from '@playwright/test';

const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
const API_KEY = process.env.HELPER_API_KEY || '';

function headers() {
  return { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) };
}

test.describe('Agente conversacional — flujo de usuario', () => {
  test('POST /api/agent/chat responde mensaje de saludo', async ({ request }) => {
    const convId = `ui-e2e-${Date.now()}`;
    const resp = await request.post(`${HELPER_URL}/api/agent/chat`, {
      headers: headers(),
      data: { conversationId: convId, message: 'Hola, buenas tardes' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.response || body.reply).toBeTruthy();
    expect(body.stage || body.state).toBeTruthy();
  });

  test('POST /api/agent/chat responde mensaje de compra', async ({ request }) => {
    const convId = `ui-e2e-buy-${Date.now()}`;
    const resp = await request.post(`${HELPER_URL}/api/agent/chat`, {
      headers: headers(),
      data: { conversationId: convId, message: 'Quiero una tienda en linea para mi negocio' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.response || body.reply).toBeTruthy();
  });

  test('POST /api/agent/chat responde mensaje de soporte', async ({ request }) => {
    const convId = `ui-e2e-support-${Date.now()}`;
    const resp = await request.post(`${HELPER_URL}/api/agent/chat`, {
      headers: headers(),
      data: { conversationId: convId, message: 'Tengo un problema con mi pedido' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.response || body.reply).toBeTruthy();
  });

  test('POST /api/agent/commercial-graph ejecuta grafo completo', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/agent/commercial-graph`, {
      headers: headers(),
      data: {
        template_id: 'consultora-software',
        message: 'Necesito desarrollo web a medida',
        conversationId: `e2e-graph-${Date.now()}`,
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.stage || body.currentStage).toBeTruthy();
  });

  test('POST /api/llm/chat chat completion funciona', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/llm/chat`, {
      headers: headers(),
      data: { messages: [{ role: 'user', content: 'Di hola' }], max_tokens: 50 },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.response || body.choices || body.content).toBeTruthy();
  });

  test('GET /api/llm/health estado LLM', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/llm/health`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status || body.provider).toBeTruthy();
  });

  test('GET /api/knowledge-base/health estado Weaviate', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/knowledge-base/health`, { headers: headers() });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status || body.mode).toBeTruthy();
  });

  test('POST /api/knowledge-base/query consulta KB', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/knowledge-base/query`, {
      headers: headers(),
      data: { query: 'horarios de atencion', limit: 3 },
    });
    expect(resp.status()).toBe(200);
  });
});

test.describe('Agente — objeciones y handoff', () => {
  test('POST /api/agent/chat maneja objeción de precio', async ({ request }) => {
    const convId = `e2e-obj-${Date.now()}`;
    const resp = await request.post(`${HELPER_URL}/api/agent/chat`, {
      headers: headers(),
      data: { conversationId: convId, message: 'Es muy caro, no tengo presupuesto' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.response || body.reply).toBeTruthy();
  });

  test('POST /api/agent/chat maneja petición de humano', async ({ request }) => {
    const convId = `e2e-human-${Date.now()}`;
    const resp = await request.post(`${HELPER_URL}/api/agent/chat`, {
      headers: headers(),
      data: { conversationId: convId, message: 'Quiero hablar con una persona real' },
    });
    expect(resp.status()).toBe(200);
  });
});
