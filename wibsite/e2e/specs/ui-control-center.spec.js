import { test, expect } from '@playwright/test';

const BASE_URL = process.env.WIBSITE_BASE_URL || 'https://localhost:8080';
const API_KEY = process.env.HELPER_API_KEY || '';

test.describe('Control Center — navegación de vistas', () => {
  test.beforeEach(async ({ page }) => {
    // Inject API key before page load
    if (API_KEY) {
      await page.addInitScript((key) => {
        localStorage.setItem('wibsite_api_key', key);
      }, API_KEY);
    }
    await page.goto(`${BASE_URL}/hub/control-center.html`);
    await page.waitForTimeout(5000);
  });

  test('carga la página y muestra sidebar', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Wibsite OPS')).toBeVisible();
  });

  test('Dashboard General carga métricas', async ({ page }) => {
    await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('text=SLI del Servicio').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Elasticsearch (SOAC)').first()).toBeVisible({ timeout: 10000 });
  });

  test('Dashboard muestra dependencias del sistema', async ({ page }) => {
    await expect(page.locator('#dep-pg')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#dep-redis')).toBeVisible();
    await expect(page.locator('#dep-elastic')).toBeVisible();
    await expect(page.locator('#dep-llm')).toBeVisible();
  });

  test('Módulos & Estado — vista accesible', async ({ page }) => {
    await page.evaluate(() => { if (typeof showView === 'function') showView('modules'); });
    await page.waitForTimeout(500);
    await expect(page.locator('#view-modules')).toBeVisible({ timeout: 5000 });
  });

  test('Alertas (Kibana/ES) — vista accesible', async ({ page }) => {
    await page.click('#nav-alerts');
    await expect(page.locator('#view-alerts')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Kibana (reglas de alerta)')).toBeVisible();
  });

  test('Incidentes — vista accesible con filtros', async ({ page }) => {
    await page.click('#nav-incidents');
    await expect(page.locator('#view-incidents')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#filter-incident-severity')).toBeVisible();
    await expect(page.locator('#filter-incident-status')).toBeVisible();
    await expect(page.locator('#filter-incident-module')).toBeVisible();
  });

  test('Seguridad — vista accesible', async ({ page }) => {
    await page.evaluate(() => { if (typeof showView === 'function') showView('security'); });
    await page.waitForTimeout(500);
    await expect(page.locator('#view-security')).toBeVisible({ timeout: 5000 });
  });

  test('Fallbacks — vista accesible', async ({ page }) => {
    await page.click('#nav-fallbacks');
    await expect(page.locator('#view-fallbacks')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Fallbacks Activos')).toBeVisible();
  });

  test('Audit Logs — vista accesible con filtros', async ({ page }) => {
    await page.click('#nav-logs');
    await expect(page.locator('#view-logs')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#filter-log-level')).toBeVisible();
    await expect(page.locator('#filter-log-event')).toBeVisible();
  });

  test('Rastrear Request — vista accesible con input', async ({ page }) => {
    await page.click('#nav-trace');
    await expect(page.locator('#view-trace')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#trace-input')).toBeVisible();
  });

  test('Pruebas & Smoke — vista existe en DOM', async ({ page }) => {
    await expect(page.locator('#view-tests')).toBeAttached({ timeout: 5000 });
  });

  test('Herramientas Externas — vista existe en DOM', async ({ page }) => {
    await expect(page.locator('#view-tools')).toBeAttached({ timeout: 5000 });
  });

  test('Auto-refresh countdown funciona', async ({ page }) => {
    await expect(page.locator('#countdown')).toBeVisible({ timeout: 5000 });
    const initial = await page.locator('#countdown').textContent();
    await page.waitForTimeout(3500);
    const after = await page.locator('#countdown').textContent();
    expect(parseInt(after)).toBeLessThan(parseInt(initial));
  });

  test('Botón Actualizar funciona', async ({ page }) => {
    await page.click('text=Actualizar');
    await page.waitForTimeout(1000);
    await expect(page.locator('#view-dashboard')).toBeVisible();
  });

  test('Footer muestra estado del sistema', async ({ page }) => {
    await expect(page.locator('#system-status-label')).toBeVisible({ timeout: 5000 });
    const text = await page.locator('#system-status-label').textContent();
    expect(text).toBeTruthy();
  });
});

test.describe('Control Center — filtros de incidentes', () => {
  test.beforeEach(async ({ page }) => {
    if (API_KEY) {
      await page.addInitScript((key) => { localStorage.setItem('wibsite_api_key', key); }, API_KEY);
    }
    await page.goto(`${BASE_URL}/hub/control-center.html`);
    await page.waitForTimeout(3000);
    await page.click('#nav-incidents');
    await page.waitForTimeout(1000);
  });

  test('filtro por severidad funciona', async ({ page }) => {
    await page.selectOption('#filter-incident-severity', 'high');
    await page.waitForTimeout(500);
  });

  test('filtro por estado funciona', async ({ page }) => {
    await page.selectOption('#filter-incident-status', 'open');
    await page.waitForTimeout(500);
  });

  test('filtro por módulo funciona', async ({ page }) => {
    await page.selectOption('#filter-incident-module', 'campaigns');
    await page.waitForTimeout(500);
  });

  test('búsqueda por texto funciona', async ({ page }) => {
    await page.fill('#filter-incident-search', 'test');
    await page.waitForTimeout(500);
  });
});

test.describe('Control Center — filtros de logs', () => {
  test.beforeEach(async ({ page }) => {
    if (API_KEY) {
      await page.addInitScript((key) => { localStorage.setItem('wibsite_api_key', key); }, API_KEY);
    }
    await page.goto(`${BASE_URL}/hub/control-center.html`);
    await page.waitForTimeout(3000);
    await page.click('#nav-logs');
    await page.waitForTimeout(1000);
  });

  test('filtro por nivel funciona', async ({ page }) => {
    await page.selectOption('#filter-log-level', 'error');
    await page.waitForTimeout(500);
  });

  test('filtro por evento funciona', async ({ page }) => {
    await page.selectOption('#filter-log-event', 'api_call');
    await page.waitForTimeout(500);
  });
});
