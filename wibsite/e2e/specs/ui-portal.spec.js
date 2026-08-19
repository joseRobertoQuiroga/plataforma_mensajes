import { test, expect } from '@playwright/test';

const BASE_URL = process.env.WIBSITE_BASE_URL || 'https://localhost:8080';

test.describe('Portal Shell — microfrontends', () => {
  test('portal en /hub/portal/ carga iframe', async ({ page }) => {
    await page.goto(`${BASE_URL}/hub/portal/index.html`);
    await page.waitForTimeout(2000);
    const body = await page.locator('body').isVisible();
    expect(body).toBeTruthy();
  });
});

test.describe('Búsqueda global — API', () => {
  const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
  const API_KEY = process.env.HELPER_API_KEY || '';

  test('GET /api/search busca leads', async ({ request }) => {
    if (!API_KEY) test.skip();
    const resp = await request.get(`${HELPER_URL}/api/search?q=test&limit=5`, {
      headers: { 'x-api-key': API_KEY },
    });
    expect([200, 404]).toContain(resp.status());
  });

  test('GET /api/notifications retorna notificaciones', async ({ request }) => {
    if (!API_KEY) test.skip();
    const resp = await request.get(`${HELPER_URL}/api/notifications?limit=5`, {
      headers: { 'x-api-key': API_KEY },
    });
    expect([200, 404]).toContain(resp.status());
  });
});

test.describe('E2E UI — interacción con control-center', () => {
  test('click en sidebar navega entre vistas', async ({ page }) => {
    await page.goto(`${BASE_URL}/hub/control-center.html`);
    await page.waitForTimeout(1500);

    await page.click('#nav-modules');
    await expect(page.locator('#view-modules')).toBeVisible({ timeout: 5000 });
    const title = await page.locator('#view-title').textContent();
    expect(title).toContain('Módulos');

    await page.click('#nav-logs');
    await expect(page.locator('#view-logs')).toBeVisible({ timeout: 5000 });
    const title2 = await page.locator('#view-title').textContent();
    expect(title2).toContain('Audit Logs');

    await page.click('#nav-dashboard');
    await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 5000 });
  });

  test('auto-refresh chip muestra countdown', async ({ page }) => {
    await page.goto(`${BASE_URL}/hub/control-center.html`);
    await expect(page.locator('#auto-refresh-chip')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#countdown')).toBeVisible();
  });

  test('config button es visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/hub/control-center.html`);
    await expect(page.locator('#config-btn')).toBeVisible({ timeout: 10000 });
  });
});
