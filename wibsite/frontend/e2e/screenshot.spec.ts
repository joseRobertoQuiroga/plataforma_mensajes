import { test } from '@playwright/test';

test('take screenshot', async ({ page }) => {
  await page.goto('http://localhost:4000/dashboard');
  await page.screenshot({ path: 'screenshot.png' });
});
