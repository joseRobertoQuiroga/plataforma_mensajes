import { test, expect } from '@playwright/test';

/**
 * Spec 2 — Búsqueda global y Lead Panel (requiere SSO del portal).
 * SKIP hasta configurar credenciales Authelia válidas (hallazgo 15/08).
 */
test.describe('Búsqueda global y Lead Panel', () => {
  test('Ctrl+K busca y abre el panel del lead', async ({ page }) => {
    test.skip(true, 'Requiere portal SSO; credenciales Authelia no válidas. Habilitar al configurar la password real de admin@wibsite.com.');
  });
});
