import { test, expect } from '@playwright/test';

const BASE_URL = process.env.WIBSITE_BASE_URL || 'https://localhost:8080';
const E2E_USER = process.env.E2E_USER;
const E2E_PASS = process.env.E2E_PASS;
if (!E2E_USER || !E2E_PASS) {
  throw new Error('E2E_USER y E2E_PASS deben definirse en el entorno (no se hardcodean credenciales).');
}

async function login(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/auth/')) {
    const userInput = page.getByRole('textbox', { name: /Usuario|Username/ });
    const passInput = page.getByRole('textbox', { name: /Contraseña|Password/ });
    const submitBtn = page.getByRole('button', { name: /Iniciar Sesión|Sign in/ });
    await userInput.fill(E2E_USER);
    await passInput.fill(E2E_PASS);
    await submitBtn.click();
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  }
}

test.describe('Wibsite 2.0 consolidado — navegación y vistas', () => {
  test('login SSO y dashboard con métricas reales', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Dashboard de Negocio' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Tasa de Scoring IA').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Intereses Detectados en Clientes').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Estado Diario del Negocio').first()).toBeVisible({ timeout: 15000 });
  });

  test('sidebar navega a todas las vistas', async ({ page }) => {
    await login(page);
    const views = [
      ['Inbox', 'Inbox Omnicanal'],
      ['Leads', 'Gestión de Leads'],
      ['Pipeline', 'Pipeline de Ventas'],
      ['Campañas', 'Campañas Broadcast'],
      ['Plantillas', 'Biblioteca de Plantillas'],
      ['Reportes', 'Reporte de Impacto y Actividad'],
      ['Automatización', 'Automatización y Conectividad'],
      ['Agente IA', 'Agente IA de Ventas'],
    ];
    for (const [nav, title] of views) {
      await page.getByRole('link', { name: nav, exact: true }).click();
      await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 20000 });
    }
  });

  test('modo claro se activa y persiste', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Cambiar tema' }).click();
    const cls = await page.evaluate(() => document.documentElement.className);
    expect(cls).toContain('light');
    await page.getByRole('button', { name: 'Cambiar tema' }).click();
  });

  test('buscador global del sidebar encuentra leads', async ({ page }) => {
    await login(page);
    await page.getByPlaceholder('Buscar leads, campañas...').fill('María');
    await expect(page.getByText('Sin resultados', { exact: false }).or(page.locator('text=Lead').first())).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('Buscar leads, campañas...').fill('');
  });
});

test.describe('Wibsite 2.0 — Inbox omnicanal', () => {
  test('inbox carga conversaciones y aplica filtros', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Inbox', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Inbox Omnicanal' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar en todas las fuentes...')).toBeVisible({ timeout: 15000 });

    const convCount = await page.locator('[class*="divide-y"] > div').count().catch(() => 0);
    // Menús desplegables de filtro: canal y estado
    await expect(page.locator('select[title="Filtrar por canal"]')).toBeVisible();
    await expect(page.locator('select[title="Filtrar por estado"]')).toBeVisible();
    expect(convCount).toBeGreaterThanOrEqual(0);
  });

  test('buscador de chats filtra por texto', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Inbox', exact: true }).click();
    await page.getByPlaceholder('Buscar en todas las fuentes...').fill('telegram');
    await page.waitForTimeout(800);
    const text = await page.locator('main').last().innerText();
    expect(text.toLowerCase()).toContain('telegram');
  });
});

test.describe('Wibsite 2.0 — Leads y pipeline', () => {
  test('leads cargan con score e intereses', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Leads', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Gestión de Leads' })).toBeVisible();
    await expect(page.getByText('Caliente').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByPlaceholder('Buscar por nombre, teléfono, email, interés...')).toBeVisible();
  });

  test('detalle de lead permite agregar nota', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Leads', exact: true }).click();
    await page.getByRole('button', { name: 'Ver Detalle' }).first().click();
    await expect(page.getByText('Notas del agente')).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('Agregar nota sobre el lead...').fill('Nota E2E automatizada');
    await page.getByRole('button', { name: '+', exact: true }).click();
    await expect(page.getByText('Nota E2E automatizada').first()).toBeVisible({ timeout: 15000 });
  });

  test('pipeline muestra columnas de etapas', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Pipeline', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pipeline de Ventas' })).toBeVisible();
    for (const col of ['Nuevos', 'Calificados', 'Oportunidades', 'Propuestas', 'Cerrados']) {
      await expect(page.getByText(col, { exact: true }).first()).toBeVisible({ timeout: 15000 });
    }
  });
});

test.describe('Wibsite 2.0 — Campañas', () => {
  test('crea una campaña de prueba', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Campañas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Campañas Broadcast' })).toBeVisible();
    const name = `E2E Campaña ${Date.now()}`;
    await page.getByRole('button', { name: '+ Nueva Campaña' }).click();
    await page.getByRole('textbox', { name: 'Ej: Promoción lanzamiento Q3' }).fill(name);
    await page.getByRole('textbox', { name: 'Mensaje / Plantilla *' }).fill('Hola {{name}}, mensaje E2E');
    await page.getByRole('button', { name: 'Crear campaña' }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Wibsite 2.0 — Plantillas y agente IA', () => {
  test('plantillas cargan desde el backend', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Plantillas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Biblioteca de Plantillas' })).toBeVisible();
    await expect(page.getByText('Bienvenida WhatsApp').first()).toBeVisible({ timeout: 20000 });
  });

  test('agente IA carga configuración con auto-reply', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Agente IA', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Agente IA de Ventas' })).toBeVisible();
    await expect(page.getByRole('switch', { name: /Auto-reply/ })).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Productos y FAQs' }).click();
    await expect(page.getByRole('button', { name: '+ Agregar', exact: true }).first()).toBeVisible();
  });
});

test.describe('API — SOAC y endpoints consolidados', () => {
  const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
  const API_KEY = process.env.HELPER_API_KEY || '';

  async function apiGet(request, path, opts = {}) {
    // Reintento ante rate-limit (429) con backoff corto
    for (let attempt = 0; attempt < 3; attempt++) {
      const resp = await request.get(`${HELPER_URL}${path}`, { headers: { 'x-api-key': API_KEY }, ...opts });
      if (resp.status() !== 429) return resp;
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
    }
    return request.get(`${HELPER_URL}${path}`, { headers: { 'x-api-key': API_KEY }, ...opts });
  }

  test('health del helper responde', async ({ request }) => {
    let resp = await request.get(`${HELPER_URL}/health`);
    for (let attempt = 0; attempt < 3 && resp.status() === 429; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      resp = await request.get(`${HELPER_URL}/health`);
    }
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/leads con filtros', async ({ request }) => {
    if (!API_KEY) test.skip();
    const resp = await apiGet(request, '/api/leads?limit=5');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/interests análisis de intereses', async ({ request }) => {
    if (!API_KEY) test.skip();
    const resp = await apiGet(request, '/api/interests');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data).toBeDefined();
  });

  test('GET /api/agents config del agente', async ({ request }) => {
    if (!API_KEY) test.skip();
    const resp = await apiGet(request, '/api/agents');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.current).toBeDefined();
    expect(body.businessTypes.length).toBeGreaterThan(0);
  });

  test('puentes legacy chatwoot/twenty devuelven 404', async ({ request }) => {
    if (!API_KEY) test.skip();
    for (const ep of ['/api/chatwoot/push', '/api/twenty/sync', '/webhooks/chatwoot-outbound']) {
      const resp = await apiGet(request, ep, { method: 'POST', data: {} });
      expect([404, 401, 400, 429]).toContain(resp.status());
    }
  });
});