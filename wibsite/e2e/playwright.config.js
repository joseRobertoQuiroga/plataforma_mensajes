import { defineConfig } from '@playwright/test';

/**
 * Config E2E de UI â€” Wibsite Business
 * Apunta al gateway (https://localhost:8080) con el stack levantado.
 * Variables de entorno:
 *  WIBSITE_BASE_URL   (default https://localhost:8080)
 *  HELPER_URL         (default http://localhost:3100) â€” para reporter SOAC
 *  HELPER_API_KEY     â€” clave de la API del helper (reporter)
 *  E2E_USER / E2E_PASS â€” credenciales SSO (default admin@wibsite.com / Admin@123)
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  globalSetup: './global-setup.js',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['./reporter.js', { baseUrl: process.env.HELPER_URL || 'http://localhost:3100', apiKey: process.env.HELPER_API_KEY || '' }],
  ],
  use: {
    baseURL: process.env.WIBSITE_BASE_URL || 'https://localhost:8080',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
