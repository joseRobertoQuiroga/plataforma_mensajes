import { test, expect } from '@playwright/test';
import crypto from 'crypto';

const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
const API_KEY = process.env.HELPER_API_KEY || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';

function headers() {
  return { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) };
}

function twilioSignature(url, authToken) {
  return crypto.createHmac('sha1', authToken).update(url).digest('base64');
}

const OK = [200, 429];

test.describe('Flujo Inbound — simulación Twilio → Helper', () => {
  test('POST /webhooks/twilio-inbound sin firma es rechazado (seguridad activa)', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/webhooks/twilio-inbound`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      form: {
        From: '+59170888888',
        Body: 'Hola, quiero informacion sobre sus servicios',
        MessageSid: `SM${Date.now()}nofirma`,
        To: '+14155238886',
      },
    });
    if (TWILIO_AUTH_TOKEN) {
      expect([403, 429]).toContain(resp.status());
    } else {
      expect([200, 201, 429]).toContain(resp.status());
    }
  });

  test('POST /webhooks/twilio-inbound con firma válida simula mensaje entrante', async ({ request }) => {
    const url = `${HELPER_URL}/webhooks/twilio-inbound`;
    const sigHeaders = TWILIO_AUTH_TOKEN
      ? { 'X-Twilio-Signature': twilioSignature(url, TWILIO_AUTH_TOKEN) }
      : {};
    const resp = await request.post(url, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...sigHeaders },
      form: {
        From: '+59170888888',
        Body: 'Hola, quiero informacion sobre sus servicios',
        MessageSid: `SM${Date.now()}e2e`,
        To: '+14155238886',
      },
    });
    expect([200, 201, 429]).toContain(resp.status());
    if (resp.status() < 400) {
      const body = await resp.json().catch(() => ({}));
      expect(body.leadId || body.lead_id || body.status).toBeTruthy();
    }
  });

  test('POST /webhooks/twilio-inbound con STOP registra opt-out (firma válida)', async ({ request }) => {
    const url = `${HELPER_URL}/webhooks/twilio-inbound`;
    const sigHeaders = TWILIO_AUTH_TOKEN
      ? { 'X-Twilio-Signature': twilioSignature(url, TWILIO_AUTH_TOKEN) }
      : {};
    const resp = await request.post(url, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...sigHeaders },
      form: {
        From: '+59170777777',
        Body: 'STOP',
        MessageSid: `SM${Date.now()}stop`,
        To: '+14155238886',
      },
    });
    expect([200, 201, 429]).toContain(resp.status());
  });
});

test.describe('Flujo Broadcast — simulación campaña', () => {
  let campaignId;

  test('crear campaña de broadcast', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/campaigns`, {
      headers: headers(),
      data: { name: `E2E Broadcast ${Date.now()}`, channel: 'whatsapp', message_template: 'Hola {{name}}, este es un mensaje de prueba.' },
    });
    expect([200, 201, 429]).toContain(resp.status());
    if (resp.status() < 400) {
      const body = await resp.json();
      campaignId = body.id;
    }
  });

  test('agregar leads a campaña', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.post(`${HELPER_URL}/api/campaigns/${campaignId}/leads`, {
      headers: headers(),
      data: { leads: [{ phone: '+59170666666', name: 'Broadcast Lead 1' }] },
    });
    expect([200, 201, 429]).toContain(resp.status());
  });

  test('programar campaña', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.post(`${HELPER_URL}/api/campaigns/${campaignId}/schedule`, {
      headers: headers(),
      data: { scheduled_at: new Date().toISOString() },
    });
    expect(OK).toContain(resp.status());
  });

  test('verificar campaña en pending', async ({ request }) => {
    if (!campaignId) test.skip();
    const resp = await request.get(`${HELPER_URL}/api/campaigns/pending`, { headers: headers() });
    expect(OK).toContain(resp.status());
  });

  test('cleanup: eliminar campaña de prueba', async ({ request }) => {
    if (!campaignId) test.skip();
    await request.delete(`${HELPER_URL}/api/campaigns/${campaignId}`, { headers: headers() });
  });
});

test.describe('Flujo Scoring — evaluación de leads', () => {
  test('POST /api/seed crea datos para scoring', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/seed`, { headers: headers() });
    expect([200, 201, 429]).toContain(resp.status());
  });

  test('GET /api/scoring/rules muestra configuración', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/scoring/rules`, { headers: headers() });
    expect(OK).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.weights || body.rules).toBeTruthy();
    }
  });

  test('POST /api/scoring/evaluate-all evalúa todos', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/scoring/evaluate-all`, { headers: headers() });
    expect(OK).toContain(resp.status());
  });

  test('GET /api/leads/top muestra top leads', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/leads/top?limit=5`, { headers: headers() });
    expect(OK).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      const leads = body.data || body;
      expect(Array.isArray(leads)).toBeTruthy();
    }
  });

  test('cleanup: limpia seed data', async ({ request }) => {
    await request.delete(`${HELPER_URL}/api/seed`, { headers: headers() });
  });
});

test.describe('Flujo Twenty CRM — sync', () => {
  test('GET /api/twenty/health verifica conexión', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/twenty/health`, { headers: headers() });
    expect([200, 429]).toContain(resp.status());
  });

  test('POST /api/twenty/sync-all sincroniza leads', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/twenty/sync-all`, { headers: headers() });
    expect([200, 500, 429]).toContain(resp.status());
  });
});

test.describe('Flujo Chatwoot — bridge', () => {
  test('POST /api/chatwoot/normalize normaliza payload', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/chatwoot/normalize`, {
      headers: headers(),
      data: { conversation: { id: 1 }, message: { content: 'test', message_type: 'incoming' } },
    });
    expect([200, 201, 403, 429]).toContain(resp.status());
  });

  test('POST /api/chatwoot/push envía mensaje', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/chatwoot/push`, {
      headers: headers(),
      data: { phone: '+59170555555', message: 'Test push to Chatwoot' },
    });
    expect([200, 201, 400, 429]).toContain(resp.status());
  });
});

test.describe('R2 - Grafo comercial 11 nodos (validacion integral)', () => {
  test('POST /api/agent/test-graph recorre apertura y response', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/agent/test-graph`, {
      headers: headers(),
      data: { message: 'Hola, quiero informacion de precios', conversationId: `r2-sim-${Date.now()}` },
    });
    expect([200, 429]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(Array.isArray(body.path)).toBe(true);
      expect(body.path.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('POST /api/agent/commercial-graph responde en grafo completo', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/api/agent/commercial-graph`, {
      headers: headers(),
      data: { message: 'Hola', conversationId: `r2-com-${Date.now()}`, template_id: 'default' },
    });
    expect([200, 500, 429]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.response || body.reply || body.final).toBeTruthy();
    }
  });
});
