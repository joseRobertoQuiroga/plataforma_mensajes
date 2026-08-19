import { expect } from '@playwright/test';

/**
 * Login SSO Authelia — usuario de pruebas admin@wibsite.com
 * Configurables vía env E2E_USER / E2E_PASS.
 */
export async function loginViaAuthelia(page, baseURL) {
  const user = process.env.E2E_USER || 'admin@wibsite.com';
  const pass = process.env.E2E_PASS || 'Wibsite2024!';
  await page.goto(`${baseURL}/auth/`, { waitUntil: 'domcontentloaded' });
  // Authelia es una SPA: esperar a que renderice el formulario
  await page.waitForSelector('input[type="text"], input[type="email"], input[name="username"]', { timeout: 20000 });
  const userInput = page.locator('input[type="text"], input[type="email"], input[name="username"]').first();
  await userInput.fill(user);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.locator('button[type="submit"], button[type="button"]').first().click();
  // Esperar a que Authelia confirme (redirige o muestra error)
  await page.waitForTimeout(2500);
}

export async function expectModuleLoaded(frameLocator, hint) {
  await expect(frameLocator).toBeVisible({ timeout: 15000 });
}
