/**
 * Wibsite Business — Initialization Script
 *
 * Configures all services via their APIs after docker-compose up:
 * 1. Chatwoot: Create account, API key, WhatsApp inbox, webhook
 * 2. Dify: Create admin, API key, import workflow
 * 3. Twenty CRM: Create workspace, API token, custom fields
 * 4. n8n: Import workflows, set credentials
 * 5. Verify all connections
 *
 * Usage: node scripts/init-wibsite.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ─── Load .env file ───────────────────────────────────
try {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = process.env[key] || value;
      }
    }
  }
} catch (e) {
  console.warn('  ⚠️  Could not load .env file:', e.message);
}

// ─── Configuration ────────────────────────────────────
const CFG = {
  chatwoot: {
    url: process.env.CHATWOOT_URL || 'http://localhost:3002',
    adminEmail: process.env.CHATWOOT_ADMIN_EMAIL || 'admin@wibsite.com',
    adminPassword: process.env.CHATWOOT_ADMIN_PASSWORD || 'Admin@123',
    apiKey: process.env.CHATWOOT_API_KEY || '',
  },
  dify: {
    url: process.env.DIFY_URL || 'http://localhost:8080',
    apiUrl: process.env.DIFY_API_URL || 'http://localhost:5001',
    adminEmail: process.env.DIFY_ADMIN_EMAIL || 'joserobertoquirogasalvador@gmail.com',
    adminPassword: process.env.DIFY_ADMIN_PASSWORD || 'Admin@123',
    apiKey: process.env.DIFY_API_KEY || 'app-IohwPPX3HDWA46TQLEcGBZq0',
  },
  twenty: {
    url: process.env.TWENTY_URL || 'http://localhost:3001',
    apiKey: process.env.TWENTY_API_KEY || '',
  },
  n8n: {
    url: process.env.N8N_URL || 'http://localhost:5679',
    apiKey: process.env.N8N_API_KEY || '',
    loginField: 'emailOrLdapLoginId', // IMPORTANT: n8n uses emailOrLdapLoginId NOT email
  },
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    apiVersion: process.env.META_API_VERSION || 'v21.0',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'wibsite_verify_2026',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  },
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Logger ────────────────────────────────────────────
const log = {
  info: (msg) => console.log(`  ℹ️  ${msg}`),
  success: (msg) => console.log(`  ✅ ${msg}`),
  warn: (msg) => console.log(`  ⚠️  ${msg}`),
  error: (msg) => console.log(`  ❌ ${msg}`),
  section: (title) => console.log(`\n📌 ${title}\n${'─'.repeat(50)}`),
};

// ─── API Helpers ───────────────────────────────────────
async function retry(fn, maxRetries = 10, delay = 3000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      log.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

// ─── 1. Chatwoot Setup ────────────────────────────────
async function setupChatwoot() {
  log.section('Chatwoot Setup');

  const api = axios.create({ baseURL: CFG.chatwoot.url, timeout: 10000 });

  // Check onboarding state
  let onboarding = false;
  try {
    const res = await api.get('/installation/onboarding');
    if (res.status === 200 && res.data?.includes?.('superadmin')) onboarding = true;
  } catch (e) { /* ignore */ }

  if (onboarding) {
    log.info('Chatwoot is in onboarding mode. First-time setup required.');
    log.info('');
    log.info('  Open http://localhost:3002 in your browser');
    log.info('  Follow the super admin setup wizard');
    log.info('  Email: admin@wibsite.com');
    log.info('  Password: Admin@123');
    log.info('');
    log.info('  After setup, run this script again.');
    return null;
  }

  // Try to authenticate
  let accessToken, accountId;
  try {
    const loginRes = await api.post('/auth/sign_in', {
      email: CFG.chatwoot.adminEmail,
      password: CFG.chatwoot.adminPassword
    });
    accessToken = loginRes.data.data.access_token;
    accountId = loginRes.data.data.account_id;
    log.success(`Logged in. Account ID: ${accountId}`);
  } catch (e) {
    log.info('Login failed — Chatwoot needs initial setup via browser.');
    log.info('  Open http://localhost:3002 and create the admin account.');
    log.info('  Then run this script again.');
    return null;
  }

  // Step 3: Generate API key
  log.info('Generating API access token...');
  try {
    const tokenRes = await api.post('/api/v1/profile/reset_access_token', {}, {
      headers: { api_access_token: accessToken }
    });
    const apiKey = tokenRes.data.access_token;
    log.success(`API Key generated: ${apiKey.substring(0, 20)}...`);

    // Save to .env
    try {
      const envPath = path.join(__dirname, '..', '.env');
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('CHATWOOT_API_KEY=')) {
        envContent = envContent.replace(/CHATWOOT_API_KEY=.*/, `CHATWOOT_API_KEY=${apiKey}`);
      } else {
        envContent += `\nCHATWOOT_API_KEY=${apiKey}\n`;
      }
      fs.writeFileSync(envPath, envContent);
      log.success('Saved CHATWOOT_API_KEY to .env');
    } catch (e) {
      log.warn(`Could not save to .env: ${e.message}`);
    }

    // Step 4: Set webhook to n8n
    log.info('Setting webhook to n8n...');
    try {
      const webhookUrl = process.env.N8N_WEBHOOK_URL
        ? `${process.env.N8N_WEBHOOK_URL}/webhook/chatwoot-inbound`
        : 'http://n8n:5678/webhook/chatwoot-inbound';

      const subscriptions = await api.get(`/api/v1/accounts/${accountId}/webhooks`, {
        headers: { api_access_token: apiKey }
      });

      const webhookList = subscriptions.data?.payload || subscriptions.data || [];
      const existingWebhook = Array.isArray(webhookList) ? webhookList.find(s => s.url?.includes('n8n')) : null;
      if (!existingWebhook) {
        await api.post(`/api/v1/accounts/${accountId}/webhooks`, {
          url: webhookUrl,
          subscriptions: ['conversation_created', 'message_created', 'conversation_status_changed']
        }, {
          headers: { api_access_token: apiKey }
        });
        log.success(`Webhook set to: ${webhookUrl}`);
      } else {
        log.success('Webhook already exists');
      }
    } catch (e) {
      log.warn(`Could not set webhook: ${e.message}`);
      log.info('Configure manually: Chatwoot > Settings > Integrations > Webhooks');
    }

    return { accountId, apiKey, accessToken };
  } catch (e) {
    log.warn(`Could not generate API key: ${e.message}`);
    log.info('Generate manually: Settings > Account > API Tokens');
    return { accountId, accessToken };
  }
}

// ─── 2. Dify Setup ────────────────────────────────────
async function setupDify() {
  log.section('Dify Setup');

  const api = axios.create({ baseURL: CFG.dify.apiUrl, timeout: 15000 });

  // Wait for Dify to be ready
  await retry(async () => {
    const res = await api.get('/health');
    if (res.status !== 200) throw new Error('Dify not ready');
  });
  log.success('Dify API is reachable');

  // Check setup status
  try {
    const initRes = await api.get('/console/api/init');
    if (initRes.data.status === 'not_started') {
      log.info('Dify setup not started. Please complete setup via browser first.');
      log.info(`  Open ${CFG.dify.url}`);
      return { token: null, apiKey: null };
    }
  } catch (e) {
    log.warn(`Could not check Dify setup state: ${e.message}`);
  }

  // Login (v1.15.0 uses cookie-based auth)
  try {
    const encodedPassword = Buffer.from(CFG.dify.adminPassword).toString('base64');
    const loginApi = axios.create({
      baseURL: CFG.dify.apiUrl,
      timeout: 15000
    });
    const loginRes = await loginApi.post('/console/api/login', {
      email: CFG.dify.adminEmail,
      password: encodedPassword
    });

    // Extract cookies from login response - need both access_token AND csrf_token
    const setCookie = loginRes.headers['set-cookie'] || [];
    if (!setCookie.find(c => c.startsWith('access_token='))) {
      log.warn('Login succeeded but no access_token cookie received');
      return { token: null, apiKey: null };
    }
    const cookieStr = setCookie.map(c => c.split(';')[0]).join('; ');
    // Extract CSRF token for X-CSRF-TOKEN header
    const csrfCookie = setCookie.find(c => c.startsWith('csrf_token='));
    const csrfToken = csrfCookie ? csrfCookie.split(';')[0].replace('csrf_token=', '') : '';
    log.success('Admin logged in');

    // Create shared API instance with cookies + CSRF header
    const csrfHeaders = { Cookie: cookieStr };
    if (csrfToken) csrfHeaders['X-CSRF-TOKEN'] = csrfToken;
    const apiWithCookie = axios.create({
      baseURL: CFG.dify.apiUrl,
      timeout: 15000,
      headers: csrfHeaders
    });

    // In Dify 1.15.0, API keys are per-app. Check for existing apps.
    let appId = null;
    try {
      const appsRes = await apiWithCookie.get('/console/api/apps');
      const apps = appsRes.data?.data || [];
      if (apps.length > 0) {
        appId = apps[0].id;
        log.success(`Found existing app: ${apps[0].name || appId}`);
      } else {
        log.info('No apps found. Creating a default app...');
        const createRes = await apiWithCookie.post('/console/api/apps', {
          name: 'WhatsApp Lead Classifier',
          mode: 'workflow',
          description: 'Classify WhatsApp leads from Chatwoot conversations'
        });
        appId = createRes.data?.id || createRes.data?.data?.id;
        if (appId) log.success(`App created: ${appId}`);
      }
    } catch (e) {
      log.warn(`Could not list/create apps: ${e.response?.status || e.message}`);
    }

    // Generate API key for the app
    let apiKey = CFG.dify.apiKey;
    if (appId) {
      try {
        const keyRes = await apiWithCookie.post(`/console/api/apps/${appId}/api-keys`, {});
        apiKey = keyRes.data?.token || keyRes.data?.data?.api_key || keyRes.data?.api_key;
        if (apiKey) log.success(`Dify API Key generated: ${apiKey.substring(0, 20)}...`);
      } catch (e) {
        log.warn(`Could not generate API key: ${e.response?.status || e.message}`);
      }
    }

    // Save to .env
    if (apiKey && apiKey !== CFG.dify.apiKey) {
      try {
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = fs.readFileSync(envPath, 'utf-8');
        if (envContent.includes('DIFY_API_KEY=')) {
          envContent = envContent.replace(/DIFY_API_KEY=.*/, `DIFY_API_KEY=${apiKey}`);
        } else {
          envContent += `\nDIFY_API_KEY=${apiKey}\n`;
        }
        fs.writeFileSync(envPath, envContent);
        log.success('Saved DIFY_API_KEY to .env');
      } catch (e) {
        log.warn(`Could not save to .env: ${e.message}`);
      }
    }

    return { token: null, apiKey };
  } catch (e) {
    log.warn(`Dify auto-setup failed: ${e.message}`);
    log.info('Complete Dify setup manually:');
    log.info(`  1. Open ${CFG.dify.url}`);
    log.info('  2. Create an app (Workflow mode recommended)');
    log.info('  3. Go to API Access > Create API Key');
    log.info('  4. Import workflow: dify/workflows/whatsapp-lead-classifier.yml');
    return { token: null, apiKey: null };
  }
}

// ─── 3. Twenty CRM Setup ──────────────────────────────
async function setupTwenty() {
  log.section('Twenty CRM Setup');

  const api = axios.create({ baseURL: CFG.twenty.url, timeout: 10000 });

  // Wait for Twenty to be ready
  await retry(async () => {
    const res = await api.get('/healthz');
    if (res.status !== 200) throw new Error('Twenty not ready');
  });
  log.success('Twenty CRM is reachable');

  // Twenty uses a signup flow via GraphQL
  log.info('Twenty CRM requires manual first-time setup:');
  log.info('  1. Open http://localhost:3001');
  log.info('  2. Create your workspace (email + password)');
  log.info('  3. Go to Settings > API > Create API Key');
  log.info('  4. Copy the API key to .env as TWENTY_API_KEY');
  log.info('');
  log.info('  After setup, run this script again to configure integrations.');
}

// ─── 4. n8n Setup ─────────────────────────────────────
async function setupN8n() {
  log.section('n8n Setup');

  const api = axios.create({ baseURL: CFG.n8n.url, timeout: 10000 });

  // Wait for n8n to be ready
  await retry(async () => {
    const res = await api.get('/healthz');
    if (res.status !== 200) throw new Error('n8n not ready');
  });
  log.success('n8n is reachable');

  // Try to create owner account (first-time setup)
  try {
    const ownerRes = await api.post('/rest/owner/setup', {
      email: 'admin@wibsite.com',
      password: 'Admin@123',
      firstName: 'Admin',
      lastName: 'Wibsite'
    });
    log.success('n8n owner account created');
    log.info('  Email: admin@wibsite.com / Password: Admin@123');
  } catch (e) {
    if (e.response?.status === 409) {
      log.success('n8n owner account already exists');
    } else {
      log.warn(`n8n owner setup returned ${e.response?.status || e.message}`);
      log.info('  If already set up, log in at http://localhost:5679');
    }
  }

  // Import workflows from the workflows directory
  const workflowsDir = path.join(__dirname, '..', 'n8n', 'workflows');
  if (fs.existsSync(workflowsDir)) {
    const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json'));
    if (files.length > 0) {
      log.info(`Found ${files.length} workflow(s) to import...`);

      // Login to get cookie/session
      try {
        const loginRes = await api.post('/rest/login', {
          emailOrLdapLoginId: 'admin@wibsite.com',  // NOTE: field is emailOrLdapLoginId, not email
          password: 'Admin@123'
        });
        const cookie = loginRes.headers['set-cookie']?.[0];

        for (const file of files) {
          const workflowPath = path.join(workflowsDir, file);
          const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));
          log.info(`  Importing: ${workflowData.name || file}...`);

          try {
            await api.post('/rest/workflows', workflowData, {
              headers: cookie ? { Cookie: cookie } : {}
            });
            log.success(`  ✅ ${workflowData.name || file} imported`);
          } catch (e) {
            log.warn(`  Could not import ${file}: ${e.response?.status || e.message}`);
            log.info(`  Import manually: n8n UI > Workflows > Add > Import from File > n8n/workflows/${file}`);
          }
        }
      } catch (e) {
        log.warn(`Could not login to n8n: ${e.message}`);
        log.info('Import workflows manually: n8n UI > Workflows > Import');
        log.info('  Files: n8n/workflows/01-inbound-message.json');
        log.info('         n8n/workflows/02-campaign-broadcast.json');
      }
    }
  }

  log.info('');
  log.info('  Create credentials in n8n:');
  log.info('  1. Open http://localhost:5679');
  log.info('  2. Go to Credentials > Add');
  log.info('  3. Create credentials for each service:');
  log.info('     - Chatwoot API: Header Auth with api_access_token');
  log.info('     - Dify API: Header Auth with Bearer token');
  log.info('     - Twenty CRM: Header Auth with Bearer token');
  log.info('     - Meta Graph API: OAuth2 or Header Auth');
  log.info('  4. Set env vars in n8n Settings > Environment Variables:');
  log.info('     DIFY_API_KEY, CHATWOOT_API_KEY, TWENTY_API_KEY,');
  log.info('     META_API_VERSION, WHATSAPP_PHONE_NUMBER_ID, META_APP_ACCESS_TOKEN');
}

// ─── 5. Run Campaign Schema Migration ────────────────
async function runMigration() {
  log.section('Campaign Schema Migration');

  const schemaPath = path.join(__dirname, 'campaigns-schema.sql');
  if (!fs.existsSync(schemaPath)) {
    log.warn('Schema file not found: campaigns-schema.sql');
    return;
  }

  log.info('Running campaign schema migration...');
  try {
    const { execSync } = require('child_process');
    const result = execSync(
      `PGPASSWORD=${process.env.POSTGRES_PASSWORD || 'wibsite_pass'} ` +
      `psql -h postgres -U ${process.env.POSTGRES_USER || 'wibsite'} -d wibsite -f ${schemaPath}`,
      { timeout: 15000, encoding: 'utf-8' }
    );
    log.success(`Schema migration completed:\n${result}`);
  } catch (e) {
    log.warn(`Migration command failed (may need manual run): ${e.message}`);
    log.info(`  To run manually: cat scripts/campaigns-schema.sql | docker exec -i wibsite-postgres psql -U wibsite -d wibsite`);
  }
}

// ─── 6. Helper Node Verification ─────────────────────
async function verifyHelper() {
  log.section('Helper Node Verification');

  const helperUrl = `http://helper:3100`;
  try {
    const res = await axios.get(`${helperUrl}/health`, { timeout: 5000 });
    log.success(`Helper: OK (v${res.data.version}, DB: ${res.data.db})`);
    log.success(`Dashboard: http://localhost:3100`);
    log.success(`API: http://localhost:3100/api/dashboard/summary`);
    return res.data;
  } catch (e) {
    log.error(`Helper: FAILED (${e.message})`);
    return null;
  }
}

// ─── 7. Verify End-to-End ─────────────────────────────
async function verifyConnections() {
  log.section('Verifying Connections');

  const checks = [
    { name: 'Chatwoot', url: `${CFG.chatwoot.url}/health` },
    { name: 'Dify API', url: `${CFG.dify.apiUrl}/health` },
    { name: 'Dify Web', url: `${CFG.dify.url}` },
    { name: 'n8n', url: `${CFG.n8n.url}/healthz` },
    { name: 'Twenty CRM', url: `${CFG.twenty.url}/healthz` },
    { name: 'Helper', url: `http://helper:3100/health` },
  ];

  let allOk = true;
  for (const check of checks) {
    try {
      const res = await axios.get(check.url, { timeout: 5000 });
      log.success(`${check.name}: OK (${res.status})`);
    } catch (e) {
      log.error(`${check.name}: FAILED (${e.code || e.message})`);
      allOk = false;
    }
  }

  if (allOk) {
    log.success('All services are running!');
  } else {
    log.warn('Some services are not reachable. Check docker-compose logs.');
  }
}

// ─── Main ──────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     Wibsite Business - Initial Setup             ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  let results = {};

  try {
    results.chatwoot = await setupChatwoot();
  } catch (e) {
    log.error(`Chatwoot setup failed: ${e.message}`);
  }

  try {
    results.dify = await setupDify();
  } catch (e) {
    log.error(`Dify setup failed: ${e.message}`);
  }

  try {
    results.twenty = await setupTwenty();
  } catch (e) {
    log.error(`Twenty setup failed: ${e.message}`);
  }

  try {
    results.n8n = await setupN8n();
  } catch (e) {
    log.error(`n8n setup failed: ${e.message}`);
  }

  // Run migrations and verify helper
  await runMigration();
  await verifyHelper();

  await verifyConnections();

  // ─── Summary ──────────────────────────────────────────
  log.section('Setup Summary');

  if (results.chatwoot) {
    log.success(`Chatwoot Account ID: ${results.chatwoot.accountId}`);
    if (results.chatwoot.apiKey) log.success(`Chatwoot API Key: ${results.chatwoot.apiKey.substring(0, 20)}...`);
  } else {
    log.info('  ◻ Complete Chatwoot setup: http://localhost:3002');
  }

  if (results.dify?.apiKey) {
    log.success(`Dify API Key: ${results.dify.apiKey.substring(0, 20)}...`);
  } else {
    log.info(`  ◻ Complete Dify setup: ${CFG.dify.url}`);
  }

  log.info('  ◻ Complete Twenty setup: http://localhost:3001');
  log.info('    → Settings > API > Create API Key → guardar en .env como TWENTY_API_KEY');
  log.info('  ◻ Configure WhatsApp Business API credentials in .env:');
  log.info('    → META_APP_ID, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID');
  log.info('  ◻ Monitoreo: http://localhost:3100 (dashboard con LEDs)');
  log.info('  ◻ Guía completa: docs/INDEX.md');
  log.info('');
  log.info('After completing manual steps, run this script again to configure integrations.');
}

main().catch((e) => {
  console.error('Fatal error during initialization:', e);
  process.exit(1);
});
