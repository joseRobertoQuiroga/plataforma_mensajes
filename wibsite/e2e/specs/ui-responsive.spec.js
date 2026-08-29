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
    await page.getByRole('textbox', { name: /Usuario|Username/ }).fill(E2E_USER);
    await page.getByRole('textbox', { name: /ContraseÃ±a|Password/ }).fill(E2E_PASS);
    await page.getByRole('button', { name: /Iniciar SesiÃ³n|Sign in/ }).click();
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  }
}

async function noHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
  }));
  expect(metrics.docScroll <= metrics.docClient, `${label}: overflow horizontal (${metrics.docScroll} > ${metrics.docClient})`).toBe(true);
}

const VIEWS = [
  ['/dashboard', 'Dashboard de Negocio'],
  ['/chat', 'Inbox Omnicanal'],
  ['/leads', 'GestiÃ³n de Leads'],
  ['/pipeline', 'Pipeline de Ventas'],
  ['/campaigns', 'CampaÃ±as Broadcast'],
  ['/templates', 'Biblioteca de Plantillas'],
  ['/reports', 'Reporte de Impacto y Actividad'],
  ['/automation', 'AutomatizaciÃ³n y Conectividad'],
  ['/settings', 'Agente IA de Ventas'],
];

test.describe('AuditorÃ­a Responsive â€” mÃ³vil 375x812', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('sidebar oculta y hamburguesa abre drawer', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('button', { name: 'Abrir menÃº' })).toBeVisible();
    // Sidebar oculto en mÃ³vil
    const sidebarHidden = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      return aside ? aside.getBoundingClientRect().left < -200 : true;
    });
    expect(sidebarHidden).toBe(true);
    // Abrir menÃº
    await page.getByRole('button', { name: 'Abrir menÃº' }).click();
    await expect(page.getByRole('link', { name: 'CampaÃ±as', exact: true })).toBeVisible({ timeout: 5000 });
    // Navegar desde el drawer
    await page.getByRole('link', { name: 'CampaÃ±as', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'CampaÃ±as Broadcast' })).toBeVisible({ timeout: 15000 });
    // El drawer se cerrÃ³ y el heading no tiene solapamiento
    await noHorizontalOverflow(page, 'dashboard-campaÃ±as');
  });

  for (const [path, title] of VIEWS) {
    test(`vista ${path} sin overflow y con contenido visible`, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(2500);
      await noHorizontalOverflow(page, path);
      await page.screenshot({ path: `responsive-375${path.replace(/\//g, '-')}.png`, fullPage: false });
    });
  }

  test('chat omnicanal: lista â†’ detalle â†’ back (mÃ³vil)', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/chat`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder('Buscar en todas las fuentes...')).toBeVisible({ timeout: 20000 });
    // Click en primera conversaciÃ³n
    await page.locator('div[class*="cursor-pointer"]').first().click();
    await expect(page.getByRole('button', { name: 'Volver a la lista' })).toBeVisible({ timeout: 10000 });
    await noHorizontalOverflow(page, 'chat-detalle');
    // Abrir perfil (overlay en mÃ³vil)
    await page.getByTitle('Ver perfil del cliente').click();
    await expect(page.getByText('Score IA').first()).toBeVisible({ timeout: 10000 });
    await noHorizontalOverflow(page, 'chat-perfil');
    // Cerrar perfil y volver a la lista
    await page.getByRole('button', { name: 'Cerrar perfil' }).click();
    await page.getByRole('button', { name: 'Volver a la lista' }).click();
    await expect(page.getByPlaceholder('Buscar en todas las fuentes...')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('AuditorÃ­a Responsive â€” tablet 768x1024', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  for (const [path, title] of VIEWS.slice(0, 5)) {
    test(`tablet: vista ${path} sin overflow`, async ({ page }) => {
      await login(page);
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(2000);
      await noHorizontalOverflow(page, `tablet-${path}`);
      await page.screenshot({ path: `responsive-768${path.replace(/\//g, '-')}.png`, fullPage: false });
    });
  }
});
