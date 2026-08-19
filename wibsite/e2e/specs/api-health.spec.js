import { test, expect } from '@playwright/test';

const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
const API_KEY = process.env.HELPER_API_KEY || '';

function h() {
  return { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) };
}

test.describe('API Health & Dependencies', () => {
  test('health público reporta servicio, versión y dependencias', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/health`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.service).toBe('wibsite-helper');
    expect(body.version).toBeTruthy();
    expect(body.status).toBe('ok');
    expect(body.dependencies).toBeTruthy();
    expect(body.dependencies.db).toBe('postgresql');
    expect(body.dependencies.redis).toBe('available');
    expect(body.dependencies.weaviate).toBe('connected');
    expect(body.dependencies.llm).toBeTruthy();
    expect(body.dependencies.llm.configured).toBe(true);
  });

  test('health reporta módulos activos', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/health`);
    const body = await resp.json();
    expect(body.modules).toBeTruthy();
    expect(body.modules.campaigns).toBeTruthy();
    expect(body.modules.leads).toBeTruthy();
    expect(body.modules.channels).toBeTruthy();
    expect(body.modules.multimodal).toBeTruthy();
  });

  test('health reporta SLI', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/health`);
    const body = await resp.json();
    expect(body.sli).toBeTruthy();
    expect(body.sli.errorRate).toBeTruthy();
    expect(body.sli.uptime).toBeTruthy();
  });

  test('health reporta uptime', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/health`);
    const body = await resp.json();
    expect(body.uptime).toBeTruthy();
    expect(body.uptime.seconds).toBeGreaterThan(0);
  });

  test('SLI metrics endpoint responde con datos', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/api/sli/metrics`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.requests).toBeTruthy();
    expect(body.requests.errorRate).toBeTruthy();
    expect(body.today).toBeTruthy();
    expect(body.version).toBeTruthy();
  });

  test('metrics endpoint (prometheus) responde', async ({ request }) => {
    const resp = await request.get(`${HELPER_URL}/metrics`);
    expect(resp.status()).toBe(200);
    const text = await resp.text();
    expect(text).toContain('http_requests_total');
  });

  test('health-detailed requiere API key', async ({ request }) => {
    if (!API_KEY) {
      const resp = await request.get(`${HELPER_URL}/api/internal/health-detailed`);
      expect([401, 403]).toContain(resp.status());
      return;
    }
    const resp = await request.get(`${HELPER_URL}/api/internal/health-detailed`, {
      headers: { 'x-api-key': API_KEY },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.sli).toBeTruthy();
    expect(body.modules).toBeTruthy();
  });
});
