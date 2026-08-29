import { test, expect } from '@playwright/test';

test('capture dashboard', async ({ page }) => {
  await page.goto('http://localhost:4000/dashboard');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/01_dashboard.png', fullPage: true });
});

test('capture chat inbox', async ({ page }) => {
  await page.goto('http://localhost:4000/chat');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/02_chat_inbox.png', fullPage: true });
});

test('capture campaigns', async ({ page }) => {
  await page.goto('http://localhost:4000/campaigns');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/03_campaigns.png', fullPage: true });
});

test('capture settings', async ({ page }) => {
  await page.goto('http://localhost:4000/settings');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/04_settings.png', fullPage: true });
});

test('capture leads', async ({ page }) => {
  await page.goto('http://localhost:4000/leads');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/05_leads.png', fullPage: true });
});
