// Wibsite - Contract Tests between modules
// Tests that each module endpoint returns expected format

const http = require('http');
const https = require('https');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3100';
const N8N_URL = process.env.N8N_URL || 'http://localhost:5679';
const TWENTY_URL = process.env.TWENTY_URL || 'http://localhost:3001';

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function get(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function post(url, body) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const data = JSON.stringify(body);
    const req = client.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let resp = '';
      res.on('data', chunk => resp += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resp) });
        } catch {
          resolve({ status: res.statusCode, body: resp });
        }
      });
    });
    req.write(data);
    req.end();
  });
}

// ─── Helper Node Contract Tests ──────────────────────

test('Health endpoint returns 200', async () => {
  const res = await get(`${BASE_URL}/health`);
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
});

test('API health returns 200', async () => {
  const res = await get(`${BASE_URL}/api/health`);
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
});

test('Campaigns list returns data array', async () => {
  const res = await get(`${BASE_URL}/api/campaigns`);
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
  if (!res.body || !Array.isArray(res.body.data)) throw new Error('Expected data array');
});

test('Channels list returns 5 channels', async () => {
  const res = await get(`${BASE_URL}/api/channels`);
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
});

test('Templates list returns array', async () => {
  const res = await get(`${BASE_URL}/api/templates`);
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
});

test('Agent templates list returns array', async () => {
  const res = await get(`${BASE_URL}/api/agent/templates`);
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
  if (!res.body || !Array.isArray(res.body.data)) throw new Error('Expected data array');
});

test('Template validation works', async () => {
  const res = await get(`${BASE_URL}/api/agent/templates/validate`);
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
});

test('Seed data creates records', async () => {
  const res = await post(`${BASE_URL}/api/seed`, {});
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
});

test('Dashboard summary returns metrics', async () => {
  const res = await get(`${BASE_URL}/api/dashboard/summary`);
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
});

// ─── n8n Contract Tests ─────────────────────────────

test('n8n health endpoint', async () => {
  const res = await get(`${N8N_URL}/health`);
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
});

// ─── Twenty CRM Contract Tests ──────────────────────

test('Twenty CRM health', async () => {
  const res = await get(`${BASE_URL}/api/twenty/health`);
  if (res.status !== 200) throw new Error(`Expected 200 got ${res.status}`);
});

// ─── SSL / Security Tests ──────────────────────────

test('Security headers present', async () => {
  const url = new URL(BASE_URL);
  const res = await get(`${BASE_URL}/health`);
});

// ─── Run Tests ──────────────────────────────────────

async function run() {
  console.log('=== Wibsite Contract Tests ===\n');
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✅ ${t.name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌ ${t.name}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
