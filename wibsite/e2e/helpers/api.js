const http = require('http');
const https = require('https');

const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
const HELPER_API_KEY = process.env.HELPER_API_KEY || '';

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 2200; // ~27 req/min, under the 30/min limit

async function waitIfNeeded() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(HELPER_API_KEY ? { 'x-api-key': HELPER_API_KEY } : {}),
  };
}

async function apiGet(path) {
  await waitIfNeeded();
  const url = new URL(path.startsWith('http') ? path : `${HELPER_URL}${path}`);
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(url, { headers: headers(), rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
  });
}

async function apiPost(path, data) {
  await waitIfNeeded();
  const url = new URL(path.startsWith('http') ? path : `${HELPER_URL}${path}`);
  const body = JSON.stringify(data);
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'POST',
      headers: { ...headers(), 'Content-Length': Buffer.byteLength(body) },
      rejectUnauthorized: false,
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function apiPut(path, data) {
  await waitIfNeeded();
  const url = new URL(path.startsWith('http') ? path : `${HELPER_URL}${path}`);
  const body = JSON.stringify(data);
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'PUT',
      headers: { ...headers(), 'Content-Length': Buffer.byteLength(body) },
      rejectUnauthorized: false,
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function apiDelete(path) {
  await waitIfNeeded();
  const url = new URL(path.startsWith('http') ? path : `${HELPER_URL}${path}`);
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'DELETE',
      headers: headers(),
      rejectUnauthorized: false,
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function apiPatch(path, data) {
  await waitIfNeeded();
  const url = new URL(path.startsWith('http') ? path : `${HELPER_URL}${path}`);
  const body = JSON.stringify(data);
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'PATCH',
      headers: { ...headers(), 'Content-Length': Buffer.byteLength(body) },
      rejectUnauthorized: false,
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

module.exports = { apiGet, apiPost, apiPut, apiDelete, apiPatch, HELPER_URL, HELPER_API_KEY, headers };
