import { test, expect } from '@playwright/test';

/**
 * Spec 5 — Monitoreo SOAC desde la UI.
 * Verifica que el hub muestra el estado real (dependencias, incluye Elasticsearch SOAC).
 */
test.describe('Monitoreo SOAC en la UI', () => {
  test('control-center muestra dependencia Elasticsearch (SOAC)', async ({ page }) => {
    await page.goto('/hub/control-center.html');
    await expect(page.locator('text=Elasticsearch (SOAC)').first()).toBeVisible({ timeout: 15000 });

    // La vista de dashboard consulta /api/internal/health-detailed
    await page.waitForTimeout(2000);
    const elasticChip = page.locator('#dep-elastic .chip').first();
    const text = (await elasticChip.textContent().catch(() => '')).trim();
    expect(['connected', 'connected-yellow', 'yellow', 'green', 'red', '...'].some((s) => text.includes(s))).toBeTruthy();
  });

  test('health público del helper responde OK', async ({ page }) => {
    const helperUrl = process.env.HELPER_URL || 'http://localhost:3100';
    const resp = await page.request.get(`${helperUrl}/health`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.service).toBe('wibsite-helper');
    expect(body.modules.channels).toBeTruthy();
    expect(body.modules.multimodal).toBeTruthy();
  });
});
