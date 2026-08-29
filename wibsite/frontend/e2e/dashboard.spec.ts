import { test, expect } from '@playwright/test';

test('has title Wibsite and shows KPIs', async ({ page }) => {
  await page.goto('http://localhost:4000/dashboard');

  // Verify the page title (Metadata)
  await expect(page).toHaveTitle(/Wibsite - Portal Unificado/);
  
  // Verify Dashboard Header
  await expect(page.locator('h1', { hasText: 'Dashboard de Negocio' })).toBeVisible();

  // Check if one of the KPIs is rendered
  await expect(page.locator('h3', { hasText: 'Leads Totales' })).toBeVisible();
});
