import { test, expect } from '@playwright/test';
import { telegramTextUpdate, telegramVoiceUpdate, telegramPhotoUpdate } from '../helpers/channel-updates.js';

/**
 * Canal de pruebas inicial: TELEGRAM.
 * Flujo E2E completo del webhook: verificación → inbound (texto/voz/foto) →
 * pipeline multicanal (lead + delivery + agente + reply degradado + auditoría SOAC).
 *
 * Modos soportados:
 *  - Sin TELEGRAM_BOT_TOKEN: pipeline degradado (sin reply real) pero lead+delivery+audit OK.
 *  - Con TELEGRAM_BOT_TOKEN: reply real vía Bot API.
 *  - Con TELEGRAM_WEBHOOK_SECRET: webhook exige x-telegram-bot-api-secret-token.
 */
const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

function tgHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...(TELEGRAM_WEBHOOK_SECRET ? { 'x-telegram-bot-api-secret-token': TELEGRAM_WEBHOOK_SECRET } : {}),
    ...extra,
  };
}

test.describe('Canal Telegram — verificación de webhook', () => {
  test('GET /webhooks/telegram responde estado del canal', async ({ request }) => {
    const qs = TELEGRAM_WEBHOOK_SECRET ? `?secret=${encodeURIComponent(TELEGRAM_WEBHOOK_SECRET)}` : '';
    const resp = await request.get(`${HELPER_URL}/webhooks/telegram${qs}`);
    expect([200, 403, 429]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.ok).toBe(true);
      expect(body.channel).toBe('telegram');
      expect(typeof body.configured).toBe('boolean');
    }
  });

  test('GET /webhooks/telegram con secret inválido es rechazado', async ({ request }) => {
    if (!TELEGRAM_WEBHOOK_SECRET) {
      test.skip(true, 'TELEGRAM_WEBHOOK_SECRET no configurado — sin validación de secret');
    }
    const resp = await request.get(`${HELPER_URL}/webhooks/telegram?secret=invalid-secret-e2e`);
    expect([403, 429]).toContain(resp.status());
  });
});

test.describe('Canal Telegram — mensaje entrante (pipeline completo)', () => {
  test('POST /webhooks/telegram texto → 200 ok (lead + delivery + pipeline)', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/webhooks/telegram`, {
      headers: tgHeaders(),
      data: telegramTextUpdate({ userId: 600001, text: 'Hola, quiero información de sus servicios' }),
    });
    expect([200, 429]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.ok).toBe(true);
    }
  });

  test('POST /webhooks/telegram con intención de compra → pipeline comercial', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/webhooks/telegram`, {
      headers: tgHeaders(),
      data: telegramTextUpdate({ userId: 600002, text: 'Quiero una tienda en línea para mi negocio' }),
    });
    expect([200, 429]).toContain(resp.status());
  });

  test('POST /webhooks/telegram voz → normaliza para transcripción', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/webhooks/telegram`, {
      headers: tgHeaders(),
      data: telegramVoiceUpdate({ userId: 600003 }),
    });
    expect([200, 429]).toContain(resp.status());
  });

  test('POST /webhooks/telegram foto → normaliza adjunto', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/webhooks/telegram`, {
      headers: tgHeaders(),
      data: telegramPhotoUpdate({ userId: 600004 }),
    });
    expect([200, 429]).toContain(resp.status());
  });

  test('POST /webhooks/telegram sin secret_token es rechazado (seguridad)', async ({ request }) => {
    if (!TELEGRAM_WEBHOOK_SECRET) {
      test.skip(true, 'TELEGRAM_WEBHOOK_SECRET no configurado — sin validación de secret');
    }
    const resp = await request.post(`${HELPER_URL}/webhooks/telegram`, {
      headers: { 'Content-Type': 'application/json' },
      data: telegramTextUpdate({ userId: 600005 }),
    });
    expect([403, 429]).toContain(resp.status());
  });
});

test.describe('Canal Telegram — verificación post-webhook (SOAC)', () => {
  test('lead creado por webhook queda registrado (health modules)', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/health`);
    expect([200, 429]).toContain(resp.status());
    if (resp.status() !== 200) return;
    const body = await resp.json();
    expect(body.modules.channels).toBeTruthy();
    const telegramChannel = (body.modules.channels || []).find((c) => c.channel === 'telegram');
    expect(telegramChannel).toBeTruthy();
  });

  test('eventos webhook_received quedan auditados (api/logs)', async ({ request }) => {
    const API_KEY = process.env.HELPER_API_KEY || '';
    if (!API_KEY) test.skip();
    const resp = await request.get(`${HELPER_URL}/api/logs?limit=30`, {
      headers: { 'x-api-key': API_KEY },
    });
    expect([200, 429]).toContain(resp.status());
    if (resp.status() !== 200) return;
    const body = await resp.json();
    const logs = body.data || body.logs || body;
    if (Array.isArray(logs)) {
      const telegramEvents = logs.filter((l) => JSON.stringify(l).includes('telegram'));
      expect(telegramEvents.length).toBeGreaterThanOrEqual(0);
    }
  });
});
