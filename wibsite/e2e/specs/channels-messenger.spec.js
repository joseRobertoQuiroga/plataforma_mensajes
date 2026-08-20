import { test, expect } from '@playwright/test';
import { messengerTextPayload } from '../helpers/channel-updates.js';

/**
 * Canal posterior: MESSENGER (Meta Graph API v21).
 * La suite queda PREPARADA: los tests de verificación e inbound corren en modo
 * degradado desde ya (webhook responde aunque MESSENGER_PAGE_TOKEN no exista),
 * y los tests que requieren credenciales reales de Meta quedan en skip hasta
 * que META_APP_ACCESS_TOKEN / MESSENGER_PAGE_TOKEN estén configurados.
 *
 * Activar Meta:
 *  1. Crear app en Meta Developers (ya existe: META_APP_ID=1694506861827055)
 *  2. Configurar MESSENGER_PAGE_TOKEN (token de página) en .env del helper
 *  3. Configurar MESSENGER_VERIFY_TOKEN en .env (mismo valor que en Meta Dashboard)
 *  4. Suscribir el webhook a https://<dominio>/webhooks/messenger
 */
const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || '';

test.describe('Canal Messenger (Meta) — verificación hub.verify', () => {
  test('GET /webhooks/messenger sin token configurado → 503 (no listo)', async ({ request }) => {
    if (VERIFY_TOKEN) {
      test.skip(true, 'MESSENGER_VERIFY_TOKEN configurado — usar verificación completa');
    }
    const resp = await request.get(`${HELPER_URL}/webhooks/messenger`);
    expect([403, 503, 429]).toContain(resp.status());
  });

  test('GET /webhooks/messenger hub.verify devuelve challenge', async ({ request }) => {
    if (!VERIFY_TOKEN) {
      test.skip(true, 'MESSENGER_VERIFY_TOKEN no configurado — pendiente activar Meta');
    }
    const challenge = 'CHALLENGE_E2E_12345';
    const resp = await request.get(
      `${HELPER_URL}/webhooks/messenger?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY_TOKEN)}&hub.challenge=${challenge}`
    );
    expect([200, 429]).toContain(resp.status());
    if (resp.status() === 200) {
      const text = await resp.text();
      expect(text).toContain(challenge);
    }
  });

  test('GET /webhooks/messenger verify_token inválido → 403', async ({ request }) => {
    if (!VERIFY_TOKEN) {
      test.skip(true, 'MESSENGER_VERIFY_TOKEN no configurado — pendiente activar Meta');
    }
    const resp = await request.get(
      `${HELPER_URL}/webhooks/messenger?hub.mode=subscribe&hub.verify_token=token-invalido&hub.challenge=xyz`
    );
    expect([403, 429]).toContain(resp.status());
  });
});

test.describe('Canal Messenger (Meta) — mensaje entrante', () => {
  test('POST /webhooks/messenger texto → pipeline (degradado sin PAGE_TOKEN)', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/webhooks/messenger`, {
      headers: { 'Content-Type': 'application/json' },
      data: messengerTextPayload({ text: 'Hola, quiero una demo' }),
    });
    expect([200, 429]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.ok).toBe(true);
    }
  });

  test('POST /webhooks/messenger con intención de compra → pipeline comercial', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/webhooks/messenger`, {
      headers: { 'Content-Type': 'application/json' },
      data: messengerTextPayload({ senderId: 'E2E_USER_2', text: 'Quiero cotizar un desarrollo web' }),
    });
    expect([200, 429]).toContain(resp.status());
  });

  test('POST /webhooks/messenger payload sin messaging → skip sin error', async ({ request }) => {
    const resp = await request.post(`${HELPER_URL}/webhooks/messenger`, {
      headers: { 'Content-Type': 'application/json' },
      data: { object: 'page', entry: [] },
    });
    expect([200, 429]).toContain(resp.status());
  });

  test('reply real con MESSENGER_PAGE_TOKEN (pendiente Meta)', async ({ request }) => {
    test.skip(true, 'MESSENGER_PAGE_TOKEN no configurado — requiere página de Meta + token (fase posterior)');
  });
});
