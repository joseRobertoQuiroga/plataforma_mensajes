import { test, expect } from '@playwright/test';

const BASE_URL = process.env.WIBSITE_BASE_URL || 'https://localhost:8080';

test.describe('Hub Diccionario Visual — carga y navegación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/hub/`);
    await page.waitForTimeout(1500);
  });

  test('carga la página con sidebar', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Wibsite Hub')).toBeVisible();
  });

  test('Dashboard — muestra stats de servicios', async ({ page }) => {
    await expect(page.locator('#tab-dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Servicios Docker')).toBeVisible();
    await expect(page.locator('text=Endpoints API')).toBeVisible();
  });

  test('Dashboard — muestra progreso por área', async ({ page }) => {
    await expect(page.locator('#progressAreas')).toBeVisible({ timeout: 10000 });
    const content = await page.locator('#progressAreas').textContent();
    expect(content).toContain('SSO');
  });

  test('Dashboard — muestra servicios en línea', async ({ page }) => {
    await expect(page.locator('#dashServices')).toBeVisible({ timeout: 10000 });
    const cards = page.locator('#dashServices .card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(5);
  });

  test('Diccionario de Módulos — vista accesible', async ({ page }) => {
    await page.click('[data-tab="diccionario"]');
    await expect(page.locator('#tab-diccionario')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#moduleCards')).toBeVisible();
    const cards = page.locator('#moduleCards .card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(5);
  });

  test('Flujos Paso a Paso — vista accesible', async ({ page }) => {
    await page.click('[data-tab="flujos"]');
    await expect(page.locator('#tab-flujos')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#flowTabs')).toBeVisible();
    await expect(page.locator('#flowContent')).toBeVisible();
  });

  test('Objetivos — vista accesible con filtros', async ({ page }) => {
    await page.click('[data-tab="objetivos"]');
    await expect(page.locator('#tab-objetivos')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Logrados')).toBeVisible();
    await expect(page.locator('text=Pendientes')).toBeVisible();
  });

  test('Verificación — vista accesible', async ({ page }) => {
    await page.click('[data-tab="verificacion"]');
    await expect(page.locator('#tab-verificacion')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#verificationContent')).toBeVisible();
  });

  test('Impacto y Dependencias — vista accesible', async ({ page }) => {
    await page.click('[data-tab="impacto"]');
    await expect(page.locator('#tab-impacto')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#impactGrid')).toBeVisible();
    const cards = page.locator('#impactGrid .impact-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(5);
  });

  test('Link a Control Center funciona', async ({ page }) => {
    const link = page.locator('a[href="control-center.html"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('Búsqueda filtra módulos', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('PostgreSQL');
    await page.waitForTimeout(500);
    const results = page.locator('#searchResults');
    const visible = await results.isVisible();
    if (visible) {
      const items = page.locator('.search-result-item');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

test.describe('Hub — barra de estado de servicios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/hub/`);
    await page.waitForTimeout(3000);
  });

  test('status bar muestra chips de servicios', async ({ page }) => {
    await expect(page.locator('#statusBar')).toBeVisible({ timeout: 10000 });
    const chips = page.locator('.status-chip');
    const count = await chips.count();
    expect(count).toBeGreaterThan(10);
  });

  test('servicios muestran estado online/offline', async ({ page }) => {
    await page.waitForTimeout(5000);
    const onlineChips = page.locator('.status-chip.online');
    const count = await onlineChips.count();
    expect(count).toBeGreaterThan(0);
  });

  test('dashboard stats se actualizan', async ({ page }) => {
    await expect(page.locator('#dashStats')).toBeVisible({ timeout: 10000 });
    const text = await page.locator('#dashStats').textContent();
    expect(text).toContain('Servicios');
  });
});
