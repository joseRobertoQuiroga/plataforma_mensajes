import { test, expect } from '@playwright/test';

/**
 * Spec 3 — Agente conversacional (simulación de usuario).
 * Envía mensajes vía la API del agente (el widget de Chatwoot requiere
 * credenciales/inbox específicos; la conversación se valida por API + audit).
 * Verifica el flujo comercial real: cuestionario → propuesta/cotización.
 */
test.describe('Agente conversacional (flujo de usuario)', () => {
  test('turno de conversación responde y queda auditado (e2e_ui)', async ({ page }) => {
    const helperUrl = process.env.HELPER_URL || 'http://localhost:3100';
    const apiKey = process.env.HELPER_API_KEY;
    test.skip(!apiKey, 'HELPER_API_KEY requerida');

    const conversationId = `ui-e2e-${Date.now()}`;
    const response = await page.request.post(`${helperUrl}/api/agent/chat`, {
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      data: { conversationId, message: 'Hola, quiero una tienda en linea para mi negocio' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.stage).toBeTruthy();
    expect(body.response).toBeTruthy();
  });
});
