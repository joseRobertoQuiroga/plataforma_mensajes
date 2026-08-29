import { test, expect } from '@playwright/test';
test('capture pipeline', async ({ page }) => {
  await page.goto('http://localhost:4000/pipeline');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'playwright-screens/06_pipeline.png', fullPage: true });
});
