const os = require('os');
const path = require('path');

const suiteId = (global.__TEST_SUITE_ID__ || process.env.JEST_WORKER_ID || 'default');
const tempStorePath = path.join(os.tmpdir(), `wibsite-store-test-${process.pid}-${suiteId}.json`);

process.env.STORE_PATH = process.env.STORE_PATH || tempStorePath;
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.PG_HOST = process.env.PG_HOST || '127.0.0.1';
process.env.PG_PORT = process.env.PG_PORT || '5433';
// Puerto único por proceso: evita colisión EADDRINUSE cuando los jobs de CI
// (unit/smoke/flow) arrancan la app del helper en paralelo en el mismo runner.
process.env.PORT = process.env.PORT || String(3100 + (process.pid % 2000));

function loadApp() {
  return require('../../index.js');
}

async function closeApp(app) {
  if (app && typeof app.closeAll === 'function') {
    await app.closeAll();
  }
}

module.exports = { loadApp, closeApp, tempStorePath };
