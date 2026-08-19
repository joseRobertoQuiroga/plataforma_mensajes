import { test, expect } from '@playwright/test';

/**
 * Spec 1 — Portal y hub (validación sin SSO).
 * /hub/control-center.html es público: verifica SLI y dependencias SOAC.
 * La navegación del portal shell (SSO) queda SKIP hasta que el usuario
 * configure credenciales Authelia válidas (hallazgo 15/08: login da
 * "Incorrect username or password" con admin@wibsite.com / Wibsite2024!).
 */
test.describe('Portal y microfrontends', () => {
  test('hub carga estado real (SLI + dependencias Elasticsearch SOAC)', async ({ page }) => {
    await page.goto('/hub/control-center.html');
    await expect(page.locator('text=SLI del Servicio').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Elasticsearch (SOAC)').first()).toBeVisible({ timeout: 10000 });
  });

  test('portal shell navega los 8 módulos con SSO', async ({ page }) => {
    test.skip(true, 'SSO bloqueado: credenciales Authelia no válidas (admin@wibsite.com / Wibsite2024! → "Incorrect username or password"). Configurar password real para habilitar.');
  });
});
