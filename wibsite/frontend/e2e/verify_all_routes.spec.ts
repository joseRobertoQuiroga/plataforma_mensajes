import { test } from '@playwright/test';

test('dashboard ok', async ({ page }) => {
  const r = await page.goto('http://localhost:4000/dashboard');
  if ((r?.status() ?? 0) >= 400) throw new Error('dashboard: ' + r?.status());
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/final_dashboard.png', fullPage: true });
});

test('leads ok', async ({ page }) => {
  const r = await page.goto('http://localhost:4000/leads');
  if ((r?.status() ?? 0) >= 400) throw new Error('leads: ' + r?.status());
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/final_leads.png', fullPage: true });
});

test('chat ok', async ({ page }) => {
  const r = await page.goto('http://localhost:4000/chat');
  if ((r?.status() ?? 0) >= 400) throw new Error('chat: ' + r?.status());
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/final_chat.png', fullPage: true });
});

test('campaigns ok', async ({ page }) => {
  const r = await page.goto('http://localhost:4000/campaigns');
  if ((r?.status() ?? 0) >= 400) throw new Error('campaigns: ' + r?.status());
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/final_campaigns.png', fullPage: true });
});

test('settings ok', async ({ page }) => {
  const r = await page.goto('http://localhost:4000/settings');
  if ((r?.status() ?? 0) >= 400) throw new Error('settings: ' + r?.status());
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/final_settings.png', fullPage: true });
});

test('pipeline ok', async ({ page }) => {
  const r = await page.goto('http://localhost:4000/pipeline');
  if ((r?.status() ?? 0) >= 400) throw new Error('pipeline: ' + r?.status());
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/final_pipeline.png', fullPage: true });
});

test('reports ok', async ({ page }) => {
  const r = await page.goto('http://localhost:4000/reports');
  if ((r?.status() ?? 0) >= 400) throw new Error('reports: ' + r?.status());
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/final_reports.png', fullPage: true });
});

test('templates ok', async ({ page }) => {
  const r = await page.goto('http://localhost:4000/templates');
  if ((r?.status() ?? 0) >= 400) throw new Error('templates: ' + r?.status());
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/final_templates.png', fullPage: true });
});

test('automation ok', async ({ page }) => {
  const r = await page.goto('http://localhost:4000/automation');
  if ((r?.status() ?? 0) >= 400) throw new Error('automation: ' + r?.status());
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/final_automation.png', fullPage: true });
});
