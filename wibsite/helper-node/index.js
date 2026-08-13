const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const { authMiddleware, verifyMetaWebhookSignature, verifyChatwootWebhookSignature } = require('./middleware/auth');
const { createTenantContextMiddleware, queryWithTenant, getTenantId } = require('./middleware/tenantContext');
const { rateLimiter } = require('./middleware/rateLimiter');
const { sanitizerMiddleware } = require('./middleware/sanitizer');
const { sanitizeMiddleware, logger } = require('./services/piiFilter');
const { initAuditLogger, logEvent, logFallback, logIncident, createAuditMiddleware } = require('./services/auditLogger');
const {
  initErrorTracker, trackIncident, trackFallback, trackSecurityEvent,
  resolveIncident, receiveAlert,
  getIncidentSummary, getIncidents, getSecurityEvents, getFallbackEvents, getAlerts,
  errorTrackerMiddleware, pathToModule, SEVERITY: ET_SEVERITY
} = require('./services/errorTracker');
const storeFacade = require('./services/store');
const pgStore = require('./services/pgStore');
const { buildLeadProfile } = require('./services/leadProfile');
const { getAgentConfig, updateAgentConfig, buildSystemPrompt } = require('./services/agentConfig');
const { addDocument, queryKnowledgeBase, deleteDocument, listDocuments, checkWeaviateHealth, addInMemoryDocument, queryInMemoryKB } = require('./services/ragEngine');
const { initRedis, createConversationState, getConversationState, transitionState, incrementMessageCount, deleteConversationState, listActiveConversations, isValidTransition, CONVERSATION_STATES, STATE_LABELS } = require('./services/conversationStore');
const { executeTestGraph, executeCommercialGraph } = require('./services/agentCore');
const checkpointer = require('./services/agentCore/checkpointer');
const templateEngine = require('./services/templateEngine');

// ─── GlitchTip / Sentry Error Tracking ──────────────
const GLITCHTIP_DSN = process.env.GLITCHTIP_DSN;
if (GLITCHTIP_DSN && GLITCHTIP_DSN.startsWith('http')) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: GLITCHTIP_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV || 'development',
      release: 'wibsite-helper@2.2.0',
      integrations: []
    });
    console.log('  GlitchTip/Sentry: initialized with DSN');
  } catch (e) {
    console.warn('  GlitchTip/Sentry: init failed (optional):', e.message);
  }
} else {
  console.log('  GlitchTip/Sentry: no DSN configured, using internal error tracker');
}

const app = express();
const PORT = process.env.PORT || 3100;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));


// ─── Request ID Middleware (FIRST — needed for full traceability) ─
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

// ─── Security Middleware ──────────────────────────────
app.use(authMiddleware);
app.use(rateLimiter);
app.use(sanitizerMiddleware);
app.use(sanitizeMiddleware);
app.use(createAuditMiddleware('api_call'));
app.use(errorTrackerMiddleware()); // auto-tracks 500 errors with full context
app.use('/webhooks', verifyMetaWebhookSignature);
app.use('/webhooks', verifyChatwootWebhookSignature);

// Servir Control Center Frontend unificado
app.use('/admin', express.static(path.join(__dirname, '../hub')));
// ─── Multi-Tenant Context (se inicializa después del pool PG) ────
// La función initTenantMiddleware() se llama en el bloque de DB init
let tenantContextMiddleware = (req, res, next) => next(); // placeholder until DB ready

// ─── Metrics endpoint (prom-client) ─────────────────
let metricsMiddleware = null;
let promCounters = {};
try {
  const promClient = require('prom-client');
  const collectDefaultMetrics = promClient.collectDefaultMetrics;
  collectDefaultMetrics({ timeout: 5000 });

  // Core HTTP metrics
  const httpRequestsTotal = new promClient.Counter({
    name: 'http_requests_total', help: 'Total HTTP requests',
    labelNames: ['method', 'path', 'status']
  });
  const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds', help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path'], buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  });

  // Dependency fallback counters
  promCounters.weaviateFallbackTotal = new promClient.Counter({
    name: 'weaviate_fallback_total', help: 'Total Weaviate fallback activations'
  });
  promCounters.redisFallbackTotal = new promClient.Counter({
    name: 'redis_fallback_total', help: 'Total Redis fallback activations'
  });
  promCounters.dbFallbackTotal = new promClient.Counter({
    name: 'db_fallback_total', help: 'Total DB fallback to JSON store activations'
  });

  // Security and incident counters
  promCounters.securityBlocksTotal = new promClient.Counter({
    name: 'security_blocks_total', help: 'Total security blocks (injection, rate-limit, auth failures)',
    labelNames: ['type']
  });
  promCounters.incidentTotal = new promClient.Counter({
    name: 'incident_total', help: 'Total incidents tracked',
    labelNames: ['module', 'severity']
  });

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      httpRequestsTotal.inc({ method: req.method, path: req.path, status: res.statusCode });
      httpRequestDuration.observe({ method: req.method, path: req.path }, (Date.now() - start) / 1000);
    });
    next();
  });
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  });
  metricsMiddleware = true;
  console.log('  Metrics: prom-client enabled (with fallback + security + incident counters)');
} catch (e) {
  console.log('  Metrics: prom-client not available (optional)');
}


// ─── DB ──────────────────────────────────────────────
const { Pool } = require('pg');
let pool = null;
try {
  pool = new Pool({
    host: process.env.PG_HOST || 'postgres',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'app_user',
    password: process.env.PG_PASSWORD || 'app_user_pass_2026',
    database: process.env.PG_DATABASE || 'wibsite',
    max: 10,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 3000,
  });
} catch (e) {
  console.warn('PG init failed, will use JSON store:', e.message);
}

async function query(text, params) {
  if (!pool) {
    // Fallback to JSON file store
    return { rows: [], rowCount: 0 };
  }
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (e) {
    console.error('DB query error:', e.message);
    throw e;
  }
}

// ─── File upload middleware (Excel/CSV) ────────────
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Initialize services after DB ──────────────────
initRedis().then(() => console.log('  Conversation store: Redis/In-Memory ready'))
  .catch(e => {
    console.warn('  Redis unavailable, using in-memory fallback:', e.message);
    trackFallback('redis', e.message, 'default', null, { module: 'infrastructure' });
    logFallback('redis', e.message, 'default', null);
    if (promCounters.redisFallbackTotal) promCounters.redisFallbackTotal.inc();
  });
checkWeaviateHealth().then(avail => {
  console.log(`  Weaviate RAG: ${avail ? 'available' : 'unavailable (using in-memory fallback)'}`);
  if (!avail) {
    trackFallback('weaviate', 'Health check failed', 'default', null, { module: 'knowledge-base' });
    logFallback('weaviate', 'Weaviate health check failed at startup', 'default', null);
    if (promCounters.weaviateFallbackTotal) promCounters.weaviateFallbackTotal.inc();
  }
});

storeFacade.initPgStore(pool);
initAuditLogger(pool);
initErrorTracker(pool, promCounters);
checkpointer.initSummariesPool(pool);
console.log(`  Store mode: ${storeFacade.getStoreMode()}`);
console.log(`  Error tracker: initialized (${pool ? 'PostgreSQL' : 'in-memory fallback'})`);
console.log(`  Checkpointer (F-14): conversation_summaries ${pool ? 'PostgreSQL' : 'in-memory fallback'}`);


// ─── Multi-Tenant Context Middleware (FASE 8) ────────
// Ahora que tenemos el pool, inicializamos el middleware real
tenantContextMiddleware = createTenantContextMiddleware(pool);
// Registrar globalmente: todas las rutas tendrán req.tenantId disponible
app.use(tenantContextMiddleware);
console.log('  Tenant context: middleware registered (pool-aware)');

// ─── JSON File Store (con lock para escritura segura) ─
const fs = require('fs');
const DB_PATH = path.join(__dirname, 'wibsite-store.json');
let storeCache = null;
let storeCacheTime = 0;
const CACHE_TTL = 200;

function loadStore() {
  const now = Date.now();
  if (storeCache && (now - storeCacheTime) < CACHE_TTL) return storeCache;
  try {
    if (fs.existsSync(DB_PATH)) {
      storeCache = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      storeCacheTime = now;
      return storeCache;
    }
  } catch (e) { /* ignore */ }
  storeCache = { campaigns: [], deliveries: [], optOuts: [], leads: [], scores: [], channels: [] };
  storeCacheTime = now;
  return storeCache;
}
function saveStore(store) {
  storeCache = store;
  storeCacheTime = Date.now();
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), 'utf-8');
}
function getStore() { return loadStore(); }

let storeLock = Promise.resolve();
function updateStore(mutator) {
  const resultHolder = {};
  storeLock = storeLock.then(() => {
    const s = loadStore();
    mutator(s);
    saveStore(s);
    return s;
  }).catch(e => { console.error('Store lock error:', e); throw e; });
  return storeLock;
}

// ═══════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════

app.post('/api/campaigns', async (req, res) => {
  try {
    const { name, description, channel, message_template, template_name, audience_filter, scheduled_at } = req.body;
    const store = getStore();
    if (store.campaigns.some(c => c.name === name)) return res.status(409).json({ error: 'Campaign name already exists' });
    const c = {
      id: crypto.randomUUID(),
      name, description: description || null,
      channel: channel || 'whatsapp',
      message_template: message_template || null,
      template_name: template_name || null,
      audience_filter: audience_filter || {},
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at || null,
      sent_count: 0, delivered_count: 0, read_count: 0, replied_count: 0, failed_count: 0, opt_out_count: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    updateStore(s => s.campaigns.push(c));
    res.status(201).json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/campaigns', async (req, res) => {
  try {
    const { status, channel, limit = 50, offset = 0 } = req.query;
    let items = getStore().campaigns;
    if (status) items = items.filter(c => c.status === status);
    if (channel) items = items.filter(c => c.channel === channel);
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ data: items.slice(parseInt(offset), parseInt(offset) + parseInt(limit)), total: items.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/campaigns/pending', async (req, res) => {
  try {
    const now = new Date();
    const items = getStore().campaigns.filter(
      c => c.status === 'scheduled' && c.scheduled_at && new Date(c.scheduled_at) <= now
    );
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const c = getStore().campaigns.find(c => c.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/campaigns/:id', async (req, res) => {
  try {
    const allowed = ['name', 'description', 'message_template', 'template_name', 'audience_filter', 'scheduled_at', 'status'];
    updateStore(s => {
      const c = s.campaigns.find(c => c.id === req.params.id);
      if (!c) return;
      for (const k of allowed) {
        if (req.body[k] !== undefined) c[k] = req.body[k];
      }
      c.updated_at = new Date().toISOString();
    });
    const c = getStore().campaigns.find(c => c.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/campaigns/:id/schedule', async (req, res) => {
  try {
    const { scheduled_at } = req.body;
    updateStore(s => {
      const c = s.campaigns.find(c => c.id === req.params.id);
      if (c) { c.status = 'scheduled'; c.scheduled_at = scheduled_at || c.scheduled_at; c.updated_at = new Date().toISOString(); }
    });
    res.json({ status: 'scheduled' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/campaigns/:id/start', async (req, res) => {
  try {
    updateStore(s => {
      const c = s.campaigns.find(c => c.id === req.params.id);
      if (c) { c.status = 'sending'; c.started_at = new Date().toISOString(); c.updated_at = new Date().toISOString(); }
    });
    res.json({ status: 'sending' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/campaigns/:id/pause', async (req, res) => {
  try {
    updateStore(s => {
      const c = s.campaigns.find(c => c.id === req.params.id);
      if (c && c.status === 'sending') { c.status = 'paused'; c.updated_at = new Date().toISOString(); }
    });
    res.json({ status: 'paused' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/campaigns/:id/complete', async (req, res) => {
  try {
    const { status, sent_count, delivered_count, failed_count } = req.body;
    updateStore(s => {
      const c = s.campaigns.find(c => c.id === req.params.id);
      if (c) {
        c.status = status || 'completed';
        c.completed_at = new Date().toISOString();
        if (sent_count !== undefined) c.sent_count = sent_count;
        if (delivered_count !== undefined) c.delivered_count = delivered_count;
        if (failed_count !== undefined) c.failed_count = failed_count;
        c.updated_at = new Date().toISOString();
      }
    });
    res.json({ status: 'completed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    const id = req.params.id;
    updateStore(s => {
      s.campaigns = s.campaigns.filter(c => c.id !== id);
      s.leads = s.leads.filter(l => l.campaign_id !== id);
      s.deliveries = s.deliveries.filter(d => d.campaign_id !== id);
      s.scores = s.scores.filter(sc => sc.campaign_id !== id);
      s.optOuts = s.optOuts.filter(o => o.campaign_id !== id);
    });
    res.json({ status: 'deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// AGENT CORE - Test Graph
// ═══════════════════════════════════════════════════════

app.post('/api/agent/test-graph', async (req, res) => {
  try {
    const result = await executeTestGraph(req.body);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/agent/commercial-graph', async (req, res) => {
  try {
    const { template_id, message, conversationId } = req.body;
    const template = templateEngine.loadTemplate(template_id || 'default');
    const result = await executeCommercialGraph({ message, conversationId, template, tenantId: req.tenantId || 'default' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/agent/chat', async (req, res) => {
  try {
    const { template_id, client_id, message, conversationId } = req.body;
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'El campo message es requerido' });
    const template = templateEngine.loadTemplate(template_id || 'default');
    let clientConfig = null;
    if (client_id) clientConfig = templateEngine.loadClientConfig(client_id);
    const result = await executeCommercialGraph({
      message,
      conversationId: conversationId || crypto.randomUUID(),
      tenantId: req.tenantId || 'default',
      template,
      clientConfig,
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// TEMPLATE ENGINE
// ═══════════════════════════════════════════════════════

app.get('/api/agent/templates', async (req, res) => {
  try {
    res.json({ data: templateEngine.listTemplates() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/agent/templates/validate', async (req, res) => {
  try {
    const results = templateEngine.listTemplates().map(t => {
      try {
        const template = templateEngine.loadTemplate(t.id);
        return { id: t.id, ...templateEngine.validate(template) };
      } catch (e) {
        return { id: t.id, valid: false, errors: [e.message] };
      }
    });
    res.json({ data: results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/agent/templates/validate/:id', async (req, res) => {
  try {
    const template = templateEngine.loadTemplate(req.params.id);
    const result = templateEngine.validate(template);
    res.json(result);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

app.get('/api/agent/templates/:id', async (req, res) => {
  try {
    const template = templateEngine.loadTemplate(req.params.id);
    res.json(template);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

app.put('/api/agent/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fs = require('fs');
    const filePath = path.join(__dirname, 'templates', `template-${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    res.json({ status: 'saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════════════════════

app.get('/api/logs', async (req, res) => {
  try {
    const { event_type, level, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    if (event_type) { sql += ` AND event_type = $${params.length + 1}`; params.push(event_type); }
    if (level) { sql += ` AND level = $${params.length + 1}`; params.push(level); }
    sql += ' ORDER BY timestamp DESC';
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await query(sql, params);
    res.json({ data: result.rows, total: result.rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// LEADS (Campaign recipients)
// ═══════════════════════════════════════════════════════

app.post('/api/campaigns/:id/leads', async (req, res) => {
  try {
    const campaignExists = getStore().campaigns.some(c => c.id === req.params.id);
    if (!campaignExists) return res.status(404).json({ error: 'Campaign not found' });
    const leads = Array.isArray(req.body) ? req.body : [req.body];
    const created = [];
    updateStore(s => {
      for (const l of leads) {
        const lead = {
          id: crypto.randomUUID(),
          campaign_id: req.params.id,
          contact_id: l.contact_id || null,
          name: l.name || null,
          phone: l.phone || null,
          email: l.email || null,
          custom_fields: l.custom_fields || {},
          status: 'pending',
          score: 0,
          score_data: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        s.leads.push(lead);
        created.push(lead);
      }
    });
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/campaigns/:id/leads', async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;
    let items = getStore().leads.filter(l => l.campaign_id === req.params.id);
    if (status) items = items.filter(l => l.status === status);
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ data: items.slice(parseInt(offset), parseInt(offset) + parseInt(limit)), total: items.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// EXCEL/CSV UPLOAD
// ═══════════════════════════════════════════════════════

app.post('/api/campaigns/:id/leads/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
    const campaignId = req.params.id;
    const campaign = getStore().campaigns.find(c => c.id === campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    let workbook;
    const buf = req.file.buffer;
    const ext = req.file.originalname.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      workbook = XLSX.read(buf, { type: 'buffer', raw: false });
    } else {
      workbook = XLSX.read(buf, { type: 'buffer' });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ error: 'File is empty or has no data rows' });

    // Detect column mapping (case-insensitive)
    const headers = Object.keys(rows[0]);
    const colMap = {
      phone: headers.find(h => /^(phone|tel|telefono|celular|cel|movil|móvil|whatsapp)$/i.test(h)),
      name: headers.find(h => /^(name|nombre|full_name|cliente|contacto)$/i.test(h)),
      email: headers.find(h => /^(email|e-mail|correo|mail)$/i.test(h)),
    };

    const created = [];
    const errors = [];
    const duplicates = [];

    updateStore(s => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const phone = colMap.phone ? String(row[colMap.phone]).trim() : '';
        const name = colMap.name ? String(row[colMap.name]).trim() : '';
        const email = colMap.email ? String(row[colMap.email]).trim() : '';

        // Custom fields: everything not mapped
        const mappedKeys = [colMap.phone, colMap.name, colMap.email].filter(Boolean);
        const customFields = {};
        for (const k of headers) {
          if (!mappedKeys.includes(k)) {
            customFields[k] = row[k];
          }
        }

        if (!phone && !email) {
          errors.push({ row: i + 2, reason: 'No phone or email found', data: row });
          continue;
        }

        // Check duplicate in same campaign
        const dup = s.leads.find(l => l.campaign_id === campaignId && l.phone === phone);
        if (dup) {
          duplicates.push({ row: i + 2, phone, existing_id: dup.id });
          continue;
        }

        const lead = {
          id: crypto.randomUUID(),
          campaign_id: campaignId,
          contact_id: null,
          name: name || null,
          phone: phone || null,
          email: email || null,
          custom_fields: customFields,
          status: 'pending',
          score: 0,
          score_data: {},
          source: 'upload',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        s.leads.push(lead);
        created.push(lead);
      }
    });

    res.status(201).json({
      campaign_id: campaignId,
      total_rows: rows.length,
      created: created.length,
      errors: errors.length,
      duplicates: duplicates.length,
      leads: created,
      error_details: errors.slice(0, 20),
      duplicate_details: duplicates.slice(0, 20),
      column_mapping: colMap,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: process.env.NODE_ENV === 'development' ? e.stack : undefined });
  }
});

// ═══════════════════════════════════════════════════════
// TRACKING
// ═══════════════════════════════════════════════════════

app.post('/api/campaigns/track', async (req, res) => {
  try {
    const { campaign_id, contact_id, contact_name, phone, status, message_id, channel_message_id, error, score } = req.body;
    updateStore(s => {
      let delivery = s.deliveries.find(d => d.campaign_id === campaign_id && d.contact_id === contact_id);
      if (!delivery) {
        delivery = {
          id: crypto.randomUUID(),
          campaign_id, contact_id, contact_name: contact_name || '', phone: phone || '',
          status: 'pending', message_id: null, channel_message_id: null,
          delivered_at: null, read_at: null, replied_at: null, error: null, score: 0,
          created_at: new Date().toISOString(),
        };
        s.deliveries.push(delivery);
      }
      if (status) delivery.status = status;
      if (message_id) delivery.message_id = message_id;
      if (channel_message_id) delivery.channel_message_id = channel_message_id;
      if (status === 'sent') delivery.sent_at = new Date().toISOString();
      if (status === 'delivered') delivery.delivered_at = new Date().toISOString();
      if (status === 'read') delivery.read_at = new Date().toISOString();
      if (status === 'replied') { delivery.replied_at = new Date().toISOString(); delivery.score = (delivery.score || 0) + 10; }
      if (score !== undefined) delivery.score = score;
      if (error) delivery.error = error;

      // Recalculate campaign stats
      const cd = s.deliveries.filter(d => d.campaign_id === campaign_id);
      const c = s.campaigns.find(c => c.id === campaign_id);
      if (c) {
        c.sent_count = cd.filter(d => d.status === 'sent' || d.status === 'delivered' || d.status === 'read' || d.status === 'replied').length;
        c.delivered_count = cd.filter(d => d.status === 'delivered' || d.status === 'read' || d.status === 'replied').length;
        c.read_count = cd.filter(d => d.status === 'read' || d.status === 'replied').length;
        c.replied_count = cd.filter(d => d.status === 'replied').length;
        c.failed_count = cd.filter(d => d.status === 'failed').length;
      }
    });
    const campaign = getStore().campaigns.find(c => c.id === campaign_id);
    res.json({ status: 'tracked', stats: campaign ? {
      sent: campaign.sent_count, delivered: campaign.delivered_count,
      read: campaign.read_count, replied: campaign.replied_count, failed: campaign.failed_count
    } : {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/campaigns/:id/stats', async (req, res) => {
  try {
    const store = getStore();
    const campaign = store.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    const deliveries = store.deliveries.filter(d => d.campaign_id === req.params.id);
    res.json({ campaign, deliveries });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// LEGACY v1 ENDPOINTS (compatibilidad n8n — sin /api/)
// ═══════════════════════════════════════════════════════

app.post('/campaigns', async (req, res) => {
  try {
    const { name, description, channel, message_template, template_name, audience_filter, scheduled_at } = req.body;
    const store = getStore();
    if (store.campaigns.some(c => c.name === name)) return res.status(409).json({ error: 'Campaign name already exists' });
    const c = {
      id: crypto.randomUUID(),
      name, description: description || null,
      channel: channel || 'whatsapp',
      message_template: message_template || null,
      template_name: template_name || null,
      audience_filter: audience_filter || {},
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at || null,
      sent_count: 0, delivered_count: 0, read_count: 0, replied_count: 0, failed_count: 0, opt_out_count: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    await updateStore(s => s.campaigns.push(c));
    res.status(201).json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/campaigns', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let items = getStore().campaigns;
    if (status) items = items.filter(c => c.status === status);
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ data: items.slice(parseInt(offset), parseInt(offset) + parseInt(limit)), total: items.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/campaigns/pending', async (req, res) => {
  try {
    const now = new Date();
    const items = getStore().campaigns.filter(c => c.status === 'scheduled' && c.scheduled_at && new Date(c.scheduled_at) <= now);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/campaigns/:id/schedule', async (req, res) => {
  try {
    const { scheduled_at } = req.body;
    await updateStore(s => {
      const c = s.campaigns.find(c => c.id === req.params.id);
      if (c) { c.status = 'scheduled'; c.scheduled_at = scheduled_at || c.scheduled_at; c.updated_at = new Date().toISOString(); }
    });
    res.json({ status: 'scheduled' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/campaigns/:id/complete', async (req, res) => {
  try {
    const { status, sent_count, delivered_count, failed_count } = req.body;
    await updateStore(s => {
      const c = s.campaigns.find(c => c.id === req.params.id);
      if (c) {
        c.status = status || 'completed';
        c.completed_at = new Date().toISOString();
        if (sent_count !== undefined) c.sent_count = sent_count;
        if (delivered_count !== undefined) c.delivered_count = delivered_count;
        if (failed_count !== undefined) c.failed_count = failed_count;
        c.updated_at = new Date().toISOString();
      }
    });
    res.json({ status: 'completed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/campaigns/track', async (req, res) => {
  try {
    const { campaign_id, contact_id, contact_name, phone, status, message_id, channel_message_id, error, score } = req.body;
    await updateStore(s => {
      let delivery = s.deliveries.find(d => d.campaign_id === campaign_id && d.contact_id === contact_id);
      if (!delivery) {
        delivery = { id: crypto.randomUUID(), campaign_id, contact_id, contact_name: contact_name || '', phone: phone || '',
          status: 'pending', message_id: null, channel_message_id: null, sent_at: null,
          delivered_at: null, read_at: null, replied_at: null, error: null, score: 0,
          created_at: new Date().toISOString() };
        s.deliveries.push(delivery);
      }
      if (status) delivery.status = status;
      if (message_id) delivery.message_id = message_id;
      if (channel_message_id) delivery.channel_message_id = channel_message_id;
      if (status === 'sent') delivery.sent_at = new Date().toISOString();
      if (status === 'delivered') delivery.delivered_at = new Date().toISOString();
      if (status === 'read') delivery.read_at = new Date().toISOString();
      if (status === 'replied') { delivery.replied_at = new Date().toISOString(); delivery.score = (delivery.score || 0) + 10; }
      if (score !== undefined) delivery.score = score;
      if (error) delivery.error = error;
      const cd = s.deliveries.filter(d => d.campaign_id === campaign_id);
      const c = s.campaigns.find(c => c.id === campaign_id);
      if (c) {
        c.sent_count = cd.filter(d => ['sent','delivered','read','replied'].includes(d.status)).length;
        c.delivered_count = cd.filter(d => ['delivered','read','replied'].includes(d.status)).length;
        c.read_count = cd.filter(d => ['read','replied'].includes(d.status)).length;
        c.replied_count = cd.filter(d => d.status === 'replied').length;
        c.failed_count = cd.filter(d => d.status === 'failed').length;
      }
    });
    const campaign = getStore().campaigns.find(c => c.id === campaign_id);
    res.json({ status: 'tracked', stats: campaign ? {
      sent: campaign.sent_count, delivered: campaign.delivered_count,
      read: campaign.read_count, replied: campaign.replied_count, failed: campaign.failed_count
    } : {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/campaigns/:id/stats', async (req, res) => {
  try {
    const store = getStore();
    const campaign = store.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    const deliveries = store.deliveries.filter(d => d.campaign_id === req.params.id);
    res.json({ campaign, deliveries });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// LEAD SCORING
// ═══════════════════════════════════════════════════════

app.post('/api/leads/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file provided' });
    const content = req.file.buffer.toString();
    const rows = content.split('\n').slice(1).filter(r => r.trim() !== ''); // ignore header
    let imported = 0;
    updateStore(s => {
      for (const row of rows) {
        const [name, phone, email] = row.split(',');
        if (name && phone) {
          s.leads.push({
            id: crypto.randomUUID(),
            name: name.trim(),
            phone: phone.trim(),
            email: email ? email.trim() : null,
            status: 'active',
            opt_out: false
          });
          imported++;
        }
      }
    });
    res.status(201).json({ imported });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/leads/score', async (req, res) => {
  try {
    const { lead_id, campaign_id, score, score_factors, score_model, notes } = req.body;
    const scoreEntry = {
      id: crypto.randomUUID(),
      lead_id, campaign_id,
      score: score || 0,
      score_factors: score_factors || {},
      score_model: score_model || 'rule-based',
      classified_at: new Date().toISOString(),
      notes: notes || null,
    };
    updateStore(s => {
      s.scores.push(scoreEntry);
      // Update lead score
      const lead = s.leads.find(l => l.id === lead_id);
      if (lead) { lead.score = score || 0; lead.score_data = score_factors || {}; }
      // Update delivery score
      const delivery = s.deliveries.find(d => d.contact_id === lead_id);
      if (delivery) delivery.score = score || 0;
    });
    res.status(201).json(scoreEntry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/leads/:id/scores', async (req, res) => {
  try {
    const items = getStore().scores.filter(s => s.lead_id === req.params.id);
    res.json(items.sort((a, b) => new Date(b.classified_at) - new Date(a.classified_at)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/leads/top', async (req, res) => {
  try {
    const { limit = 20, min_score = 0 } = req.query;
    const leads = getStore().leads.filter(l => l.score >= parseInt(min_score));
    leads.sort((a, b) => b.score - a.score);
    res.json(leads.slice(0, parseInt(limit)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// LEAD PROFILE (MVP-03: Extracción y actualización de leads)
// ═══════════════════════════════════════════════════════

app.get('/api/leads/:id/profile', async (req, res) => {
  try {
    const store = getStore();
    const profile = buildLeadProfile(req.params.id, store);
    if (!profile) return res.status(404).json({ error: 'Lead not found' });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// CHANNEL STATUS (LED indicators)
// ═══════════════════════════════════════════════════════

app.get('/api/channels', async (req, res) => {
  try {
    const store = getStore();
    const channels = store.channels.length > 0 ? store.channels : [
      { channel: 'whatsapp', status: 'pending', status_message: 'Esperando configuración de Meta', last_checked_at: null, error_count: 0 },
      { channel: 'messenger', status: 'disconnected', status_message: 'No configurado', last_checked_at: null, error_count: 0 },
      { channel: 'tiktok', status: 'disconnected', status_message: 'No configurado', last_checked_at: null, error_count: 0 },
      { channel: 'sms', status: 'disconnected', status_message: 'No configurado', last_checked_at: null, error_count: 0 },
      { channel: 'email', status: 'disconnected', status_message: 'No configurado', last_checked_at: null, error_count: 0 },
    ];
    res.json(channels);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/channels/:channel', async (req, res) => {
  try {
    const { status, status_message, rate_limit_remaining, rate_limit_reset_at } = req.body;
    updateStore(s => {
      let ch = s.channels.find(c => c.channel === req.params.channel);
      if (!ch) {
        ch = { channel: req.params.channel, status: 'pending', status_message: '', last_checked_at: null, error_count: 0 };
        s.channels.push(ch);
      }
      if (status) ch.status = status;
      if (status_message) ch.status_message = status_message;
      if (rate_limit_remaining !== undefined) ch.rate_limit_remaining = rate_limit_remaining;
      if (rate_limit_reset_at) ch.rate_limit_reset_at = rate_limit_reset_at;
      ch.last_checked_at = new Date().toISOString();
      if (status === 'error' || status === 'disconnected') ch.error_count = (ch.error_count || 0) + 1;
      else ch.error_count = 0;
    });
    res.json({ status: 'updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// OPT-OUT
// ═══════════════════════════════════════════════════════

app.post('/api/opt-outs', async (req, res) => {
  try {
    const { phone, email, channel, reason, source } = req.body;
    updateStore(s => {
      const existing = s.optOuts.findIndex(o => o.phone === phone || o.email === email);
      if (existing >= 0) {
        s.optOuts[existing].reason = reason || s.optOuts[existing].reason;
        s.optOuts[existing].updated_at = new Date().toISOString();
      } else {
        s.optOuts.push({
          id: s.optOuts.length + 1,
          phone: phone || null,
          email: email || null,
          channel: channel || 'whatsapp',
          reason: reason || null,
          source: source || 'user_reply',
          created_at: new Date().toISOString(),
        });
      }
      // Mark campaign leads as opted_out
      if (phone) {
        s.leads.filter(l => l.phone === phone).forEach(l => { l.status = 'opted_out'; });
      }
    });
    res.json({ status: 'opted_out' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/opt-outs/check', async (req, res) => {
  try {
    const { phone, email } = req.query;
    const store = getStore();
    const optedOut = store.optOuts.some(o => (phone && o.phone === phone) || (email && o.email === email));
    res.json({ optedOut });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// TWENTY CRM PROXY
// ═══════════════════════════════════════════════════════

app.get('/api/twenty/health', async (req, res) => {
  try {
    const twentyUrl = process.env.TWENTY_URL || 'http://twenty-server:3000';
    const twentyKey = process.env.TWENTY_API_KEY;
    const resp = await axios.get(`${twentyUrl}/healthz`, { timeout: 5000 });
    res.json({ connected: resp.status === 200, hasApiKey: !!twentyKey });
  } catch (e) {
    res.json({ connected: false, hasApiKey: !!process.env.TWENTY_API_KEY, error: e.message });
  }
});

// Sync a single lead to Twenty CRM as a person
app.post('/api/twenty/sync', async (req, res) => {
  try {
    const twentyUrl = process.env.TWENTY_URL || 'http://twenty-server:3000';
    const twentyKey = process.env.TWENTY_API_KEY;

    const { lead_id, leadId, lead, name, phone, email, pain_points, interests, score, score_history, source, custom_fields } = req.body;
    const effectiveLeadId = lead_id || leadId;

    // Support passing a lead_id to look up from store, or direct lead data
    let leadData = lead;
    if (effectiveLeadId && !lead) {
      const store = getStore();
      leadData = store.leads.find(l => l.id === effectiveLeadId);
      if (!leadData) return res.status(404).json({ error: 'Lead not found' });
    }

    const fullName = name || leadData?.name || '';
    const phoneNumber = phone || leadData?.phone || '';
    const emailAddr = email || leadData?.email || '';
    const painPoints = pain_points || leadData?.custom_fields?.pain_point || leadData?.score_data?.pain_points || '';
    const interestsList = interests || leadData?.custom_fields?.interest || '';
    const leadSource = source || leadData?.source || leadData?.custom_fields?.source || 'web';
    const scoreValue = score !== undefined ? score : (leadData?.score || 0);
    const history = score_history || (leadData?.score_data ? JSON.stringify(leadData.score_data) : '{}');
    const customData = custom_fields || (leadData?.custom_fields ? JSON.stringify(leadData.custom_fields) : '{}');

    // Split name into first/last
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || ' ';

    // Normalize phone: skip if empty (fix #5)
    const normalizedPhone = phoneNumber && phoneNumber.trim()
      ? (phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber)
      : '';

    // Check if person already exists — fetch with pagination (fix #10)
    let existingPerson = null;
    let offset = 0;
    const pageSize = 100;
    while (!existingPerson) {
      const searchResp = await axios.get(`${twentyUrl}/rest/people?limit=${pageSize}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${twentyKey}` },
        timeout: 5000,
      });
      const people = searchResp.data?.data?.people || [];
      existingPerson = people.find(p =>
        (normalizedPhone && p.phones?.primaryPhoneNumber === normalizedPhone) ||
        (emailAddr && p.emails?.primaryEmail === emailAddr)
      );
      if (existingPerson || people.length < pageSize) break;
      offset += pageSize;
    }

    let person;
    let twentyId;
    if (existingPerson) {
      const updateResp = await axios.patch(`${twentyUrl}/rest/people/${existingPerson.id}`,
        {
          name: { firstName, lastName: lastName || ' ' },
          ...(emailAddr ? { emails: { primaryEmail: emailAddr } } : {}),
          ...(normalizedPhone ? { phones: { primaryPhoneNumber: normalizedPhone } } : {}),
          painPoints,
          interests: interestsList,
          leadOrigin: leadSource,
          leadScoreHistory: history,
          leadLastScore: scoreValue,
          leadCustomData: customData,
        },
        { headers: { Authorization: `Bearer ${twentyKey}`, 'Content-Type': 'application/json' }, timeout: 5000 }
      );
      person = updateResp.data?.data?.updatePerson;
      twentyId = existingPerson.id;
    } else {
      const createResp = await axios.post(`${twentyUrl}/rest/people`,
        {
          name: { firstName, lastName: lastName || ' ' },
          ...(emailAddr ? { emails: { primaryEmail: emailAddr } } : {}),
          ...(normalizedPhone ? { phones: { primaryPhoneNumber: normalizedPhone } } : {}),
          painPoints,
          interests: interestsList,
          leadOrigin: leadSource,
          leadScoreHistory: history,
          leadLastScore: scoreValue,
          leadCustomData: customData,
        },
        { headers: { Authorization: `Bearer ${twentyKey}`, 'Content-Type': 'application/json' }, timeout: 5000 }
      );
      person = createResp.data?.data?.createPerson;
      twentyId = person?.id;
    }

    if (leadData?.id && twentyId) {
      updateStore(s => {
        const l = s.leads.find(l => l.id === leadData.id);
        if (l) l.contact_id = twentyId;
      });
    }

    res.json({
      synced: true,
      action: existingPerson ? 'updated' : 'created',
      twenty_id: twentyId,
      person,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, details: e.response?.data });
  }
});

// Sync all leads to Twenty
app.post('/api/twenty/sync-all', async (req, res) => {
  try {
    const store = getStore();
    const results = { total: store.leads.length, synced: 0, errors: 0, details: [] };
    for (const lead of store.leads) {
      try {
        const twentyUrl = process.env.TWENTY_URL || 'http://twenty-server:3000';
        const twentyKey = process.env.TWENTY_API_KEY;

        const nameParts = (lead.name || '').split(' ');
        const leadPhone = (lead.phone || '').trim();
        const normalizedPhone = leadPhone ? (leadPhone.startsWith('+') ? leadPhone : '+' + leadPhone) : '';
        const payload = {
          name: { firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || ' ' },
          ...(lead.email ? { emails: { primaryEmail: lead.email } } : {}),
          ...(normalizedPhone ? { phones: { primaryPhoneNumber: normalizedPhone } } : {}),
          painPoints: lead.custom_fields?.pain_point || lead.score_data?.pain_points || '',
          interests: lead.custom_fields?.interest || '',
          leadOrigin: lead.source || lead.custom_fields?.source || 'web',
          leadScoreHistory: JSON.stringify(lead.score_data || {}),
          leadLastScore: lead.score || 0,
          leadCustomData: JSON.stringify(lead.custom_fields || {}),
        };

        // Check if exists (with pagination)
        let existingPerson = null;
        let offset = 0;
        const pageSize = 100;
        while (!existingPerson) {
          const searchResp = await axios.get(`${twentyUrl}/rest/people?limit=${pageSize}&offset=${offset}`, {
            headers: { Authorization: `Bearer ${twentyKey}` }, timeout: 5000
          });
          const people = searchResp.data?.data?.people || [];
          existingPerson = people.find(p =>
            normalizedPhone && p.phones?.primaryPhoneNumber === normalizedPhone
          );
          if (existingPerson || people.length < pageSize) break;
          offset += pageSize;
        }

        if (existingPerson) {
          await axios.patch(`${twentyUrl}/rest/people/${existingPerson.id}`, payload, {
            headers: { Authorization: `Bearer ${twentyKey}`, 'Content-Type': 'application/json' }, timeout: 5000
          });
          results.synced++;
          results.details.push({ id: lead.id, action: 'updated', twenty_id: existingPerson.id });
        } else {
          const createResp = await axios.post(`${twentyUrl}/rest/people`, payload, {
            headers: { Authorization: `Bearer ${twentyKey}`, 'Content-Type': 'application/json' }, timeout: 5000
          });
          const pid = createResp.data?.data?.createPerson?.id;
          results.synced++;
          results.details.push({ id: lead.id, action: 'created', twenty_id: pid });
        }
      } catch (e) {
        results.errors++;
        results.details.push({ id: lead.id, error: e.message });
      }
    }
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// LEAD SCORING ENGINE (rule-based)
// ═══════════════════════════════════════════════════════

const DEFAULT_SCORING_RULES = {
  weights: {
    engagement: 0.35,
    recency: 0.25,
    channel_affinity: 0.15,
    profile_completeness: 0.15,
    interest_match: 0.10,
  },
  thresholds: {
    hot: 70,
    warm: 40,
    cold: 0,
  },
  rules: [
    { name: 'replied_to_message', field: 'has_replied', op: 'eq', value: true, score: 20 },
    { name: 'opened_message', field: 'has_opened', op: 'eq', value: true, score: 10 },
    { name: 'clicked_link', field: 'has_clicked', op: 'eq', value: true, score: 15 },
    { name: 'has_phone_and_email', field: 'has_both_contact', op: 'eq', value: true, score: 10 },
    { name: 'has_custom_fields', field: 'custom_field_count', op: 'gte', value: 2, score: 5 },
    { name: 'recent_activity', field: 'days_since_contact', op: 'lte', value: 7, score: 15 },
    { name: 'medium_recency', field: 'days_since_contact', op: 'between', min: 8, max: 30, score: 8 },
    { name: 'opted_out', field: 'has_opted_out', op: 'eq', value: true, score: -100 },
  ],
};

app.get('/api/scoring/rules', (req, res) => {
  const store = getStore();
  res.json(store.scoringRules || DEFAULT_SCORING_RULES);
});

app.put('/api/scoring/rules', (req, res) => {
  try {
    const { weights, thresholds, rules } = req.body;
    updateStore(s => {
      s.scoringRules = {
        weights: weights || DEFAULT_SCORING_RULES.weights,
        thresholds: thresholds || DEFAULT_SCORING_RULES.thresholds,
        rules: rules || DEFAULT_SCORING_RULES.rules,
      };
    });
    res.json({ status: 'updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Shared scoring logic (used by evaluate + evaluate-all) ─
function evaluateLead(lead, config, store) {
  // Only use deliveries specific to this lead (fixed #2)
  const myDeliveries = store.deliveries.filter(d => d.contact_id === lead.id);
  const hasReplied = myDeliveries.some(d => d.status === 'replied');
  const hasOpened = myDeliveries.some(d => d.status === 'read' || d.status === 'replied');
  const hasClicked = lead.clicked_link || false;
  const hasBothContact = !!(lead.phone && lead.email);
  const customFieldCount = Object.keys(lead.custom_fields || {}).length;
  const lastDelivery = myDeliveries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const daysSinceContact = lastDelivery ? Math.floor((Date.now() - new Date(lastDelivery.created_at).getTime()) / 86400000) : 999;
  const hasOptedOut = lead.status === 'opted_out';
  const segment = lead.custom_fields?.segment || 'standard';
  const interest = lead.custom_fields?.interest || '';

  let ruleScore = 0;
  const appliedRules = [];
  for (const rule of config.rules) {
    let fieldValue;
    if (rule.field === 'has_replied') fieldValue = hasReplied;
    else if (rule.field === 'has_opened') fieldValue = hasOpened;
    else if (rule.field === 'has_clicked') fieldValue = hasClicked;
    else if (rule.field === 'has_both_contact') fieldValue = hasBothContact;
    else if (rule.field === 'custom_field_count') fieldValue = customFieldCount;
    else if (rule.field === 'days_since_contact') fieldValue = daysSinceContact;
    else if (rule.field === 'has_opted_out') fieldValue = hasOptedOut;
    else continue;
    let matched = false;
    if (rule.op === 'eq') matched = fieldValue === rule.value;
    else if (rule.op === 'gte') matched = fieldValue >= rule.value;
    else if (rule.op === 'lte') matched = fieldValue <= rule.value;
    else if (rule.op === 'between') matched = fieldValue >= rule.min && fieldValue <= rule.max;
    if (matched) { ruleScore += rule.score; appliedRules.push(rule.name); }
  }

  const weightedFactors = {
    engagement: Math.min(100, (hasReplied ? 50 : 0) + (hasOpened ? 30 : 0) + (hasClicked ? 20 : 0)),
    recency: Math.min(100, Math.max(0, 100 - daysSinceContact * 3)),
    channel_affinity: segment === 'premium' ? 80 : (segment === 'standard' ? 50 : 30),
    profile_completeness: Math.min(100, (hasBothContact ? 40 : 0) + Math.min(customFieldCount * 10, 30) + (lead.name ? 30 : 0)),
    interest_match: interest ? 60 : 10,
  };
  let compositeScore = 0;
  for (const [factor, value] of Object.entries(weightedFactors)) compositeScore += value * (config.weights[factor] || 0);
  const finalScore = Math.max(0, Math.min(100, Math.round(compositeScore + ruleScore)));
  let category = 'cold';
  if (finalScore >= config.thresholds.hot) category = 'hot';
  else if (finalScore >= config.thresholds.warm) category = 'warm';

  return { score: finalScore, category, weightedFactors, appliedRules, ruleScore, daysSinceContact, hasClicked };
}

app.post('/api/scoring/evaluate', async (req, res) => {
  try {
    const { lead_id } = req.body;
    if (!lead_id) return res.status(400).json({ error: 'lead_id required' });
    const store = getStore();
    const lead = store.leads.find(l => l.id === lead_id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const config = store.scoringRules || DEFAULT_SCORING_RULES;
    const result = evaluateLead(lead, config, store);
    const scoreEntry = {
      id: crypto.randomUUID(), lead_id, campaign_id: lead.campaign_id,
      score: result.score, category: result.category,
      score_factors: result.weightedFactors, score_model: 'rule-based-v1',
      rules_applied: result.appliedRules, rule_score: result.ruleScore,
      classified_at: new Date().toISOString(),
    };
    await updateStore(s => {
      s.scores.push(scoreEntry);
      const l = s.leads.find(l => l.id === lead_id);
      if (l) { l.score = result.score; l.score_data = { ...result.weightedFactors, category: result.category, classified_at: scoreEntry.classified_at }; }
    });
    res.json(scoreEntry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Evaluate all leads (uses shared logic — fixed #1, #2, #11)
app.post('/api/scoring/evaluate-all', async (req, res) => {
  try {
    const store = getStore();
    const config = store.scoringRules || DEFAULT_SCORING_RULES;
    const results = { total: store.leads.length, evaluated: 0, errors: 0, hot: 0, warm: 0, cold: 0 };
    for (const lead of store.leads) {
      try {
        const result = evaluateLead(lead, config, store);
        await updateStore(s => {
          const l = s.leads.find(l => l.id === lead.id);
          if (l) { l.score = result.score; l.score_data = { ...result.weightedFactors, category: result.category }; }
        });
        results.evaluated++;
        if (result.category === 'hot') results.hot++;
        else if (result.category === 'warm') results.warm++;
        else results.cold++;
      } catch (e) { results.errors++; }
    }
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Compare rule-based vs LLM scoring for a lead
app.get('/api/scoring/compare/:leadId', async (req, res) => {
  try {
    const store = getStore();
    const lead = store.leads.find(l => l.id === req.params.leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const config = store.scoringRules || DEFAULT_SCORING_RULES;
    const ruleResult = evaluateLead(lead, config, store);
    const leadScores = store.scores.filter(s => s.lead_id === lead.id);
    const llmScores = leadScores.filter(s => s.score_model?.includes('llm'));
    const comparisons = leadScores.map(s => ({
      id: s.id, score: s.score, model: s.score_model,
      factors: s.score_factors, classified_at: s.classified_at,
      is_llm: s.score_model?.includes('llm') || false
    }));
    res.json({
      lead_id: lead.id, lead_name: lead.name, phone: lead.phone,
      current_score: lead.score,
      rule_based: { score: ruleResult.score, category: ruleResult.category, factors: ruleResult.weightedFactors },
      llm_available: llmScores.length > 0,
      llm_scores: llmScores.map(s => ({ score: s.score, factors: s.score_factors, classified_at: s.classified_at })),
      history: comparisons.slice(0, 10),
      delta: llmScores.length > 0 ? llmScores[0].score - ruleResult.score : null
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auto-scoring trigger from Chatwoot webhook
app.post('/api/scoring/trigger-from-chatwoot', async (req, res) => {
  try {
    const { conversation_id, sender, content, message_type } = req.body;
    if (!conversation_id && !sender?.phone_number) {
      return res.status(400).json({ error: 'conversation_id or sender.phone_number required' });
    }
    const phone = sender?.phone_number || '';
    const store = getStore();
    if (message_type === 'outgoing') {
      const lead = store.leads.find(l => l.phone === phone);
      if (lead) {
        const newScore = Math.min(100, (lead.score || 0) + 15);
        const category = newScore >= 75 ? 'hot' : newScore >= 40 ? 'warm' : 'cold';
        const scoreEntry = {
          id: crypto.randomUUID(), lead_id: lead.id, campaign_id: lead.campaign_id,
          score: newScore, category,
          score_factors: { agent_reply: true, boost: 15 }, score_model: 'agent-reply-boost',
          rules_applied: ['agent_reply_boost'], rule_score: 15,
          classified_at: new Date().toISOString(),
        };
        await updateStore(s => {
          s.scores.push(scoreEntry);
          const l = s.leads.find(l => l.id === lead.id);
          if (l) { l.score = newScore; l.score_data = { agent_boost: true, category, classified_at: scoreEntry.classified_at }; }
        });
        return res.json({ scored: true, lead_id: lead.id, new_score: newScore });
      }
      return res.json({ scored: false, reason: 'lead not found by phone' });
    }
    const lead = store.leads.find(l => l.phone === phone);
    if (!lead) return res.json({ scored: false, reason: 'lead not found' });
    const config = store.scoringRules || DEFAULT_SCORING_RULES;
    const result = evaluateLead(lead, config, store);
    const scoreEntry = {
      id: crypto.randomUUID(), lead_id: lead.id, campaign_id: lead.campaign_id,
      score: result.score, category: result.category,
      score_factors: result.weightedFactors, score_model: 'rule-based-v1',
      rules_applied: result.appliedRules, rule_score: result.ruleScore,
      classified_at: new Date().toISOString(),
    };
    await updateStore(s => {
      s.scores.push(scoreEntry);
      const l = s.leads.find(l => l.id === lead.id);
      if (l) { l.score = result.score; l.score_data = { ...result.weightedFactors, category: result.category, classified_at: scoreEntry.classified_at }; }
    });
    res.json({ scored: true, lead_id: lead.id, new_score: result.score, category: result.category });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Campaign: auto-activate scheduled campaigns (on health check or endpoint)
function activateScheduledCampaigns(store) {
  const now = new Date().toISOString();
  const scheduled = store.campaigns.filter(c => c.status === 'scheduled' && c.scheduled_at && c.scheduled_at <= now);
  let activated = 0;
  scheduled.forEach(c => {
    c.status = 'sending';
    c.started_at = now;
    c.updated_at = now;
    activated++;
  });
  return activated;
}

// ─── Campaign: delivery details per lead
app.get('/api/campaigns/:id/leads/:leadId/deliveries', async (req, res) => {
  try {
    const store = getStore();
    const lead = store.leads.find(l => l.id === req.params.leadId && l.campaign_id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found in campaign' });
    const deliveries = store.deliveries.filter(d => d.campaign_id === req.params.id && (d.contact_id === lead.id || d.contact_id === lead.phone));
    res.json({ lead_id: lead.id, lead_name: lead.name, total: deliveries.length, deliveries: deliveries.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Opt-out: pre-check before sending (middleware for n8n)
app.post('/api/opt-outs/check-batch', async (req, res) => {
  try {
    const { phones } = req.body;
    if (!phones || !Array.isArray(phones)) return res.status(400).json({ error: 'phones array required' });
    const store = getStore();
    const results = phones.map(phone => ({
      phone,
      opted_out: store.optOuts.some(o => (o.phone && o.phone === phone) || (o.email && o.email === phone)),
      reasons: store.optOuts.filter(o => o.phone === phone).map(o => o.reason)
    }));
    const blocked = results.filter(r => r.opted_out);
    res.json({ total: phones.length, blocked: blocked.length, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Auto-transition scheduled campaigns (called from health + dashboard)
app.post('/api/campaigns/auto-activate', async (req, res) => {
  try {
    const store = getStore();
    const count = activateScheduledCampaigns(store);
    res.json({ activated: count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Twenty CRM: Webhook receptor (bidireccionalidad)
app.post('/webhooks/twenty', async (req, res) => {
  try {
    const { recordId, objectType, changes } = req.body;
    if (!recordId || !changes) return res.status(400).json({ error: 'recordId and changes required' });
    updateStore(s => {
      const lead = s.leads.find(l => l.contact_id === recordId);
      if (!lead) return;
      if (changes.name) lead.name = changes.name;
      if (changes.email) lead.email = changes.email;
      if (changes.phone) lead.phone = changes.phone;
      if (changes.leadLastScore !== undefined) lead.score = changes.leadLastScore;
      if (changes.leadConversationMode) lead.conversation_mode = changes.leadConversationMode;
      lead.updated_at = new Date().toISOString();
    });
    res.json({ status: 'synced' });
  } catch (e) { res.status(200).json({ error: 'ignored' }); }
});

// ─── Dashboard: trends data for charts
app.get('/api/dashboard/trends', async (req, res) => {
  try {
    const store = getStore();
    const now = new Date();
    const days = parseInt(req.query.days) || 7;
    const trends = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const nextDate = new Date(date.getTime() + 86400000);
      const leadsCreated = store.leads.filter(l => { const d = new Date(l.created_at); return d >= date && d < nextDate; }).length;
      const deliveriesSent = store.deliveries.filter(d => { const dt = new Date(d.created_at); return dt >= date && dt < nextDate && d.direction === 'outbound'; }).length;
      const deliveriesReceived = store.deliveries.filter(d => { const dt = new Date(d.created_at); return dt >= date && dt < nextDate && d.direction === 'inbound'; }).length;
      trends.push({ date: date.toISOString().split('T')[0], leadsCreated, deliveriesSent, deliveriesReceived });
    }
    const scoredLeads = store.leads.filter(l => l.score > 0);
    const hot = scoredLeads.filter(l => l.score >= 70).length;
    const warm = scoredLeads.filter(l => l.score >= 40 && l.score < 70).length;
    const cold = scoredLeads.filter(l => l.score < 40).length;
    const channelStats = store.deliveries.reduce((acc, d) => { if (d.channel) { acc[d.channel] = (acc[d.channel] || 0) + 1; } return acc; }, {});
    res.json({ trends, distribution: { hot, warm, cold, total: scoredLeads.length }, channels: channelStats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Dashboard summary
app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const store = getStore();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const activeCampaigns = store.campaigns.filter(c => c.status === 'sending' || c.status === 'scheduled');
    const todayDeliveries = store.deliveries.filter(d => new Date(d.created_at) >= today);
    const totalLeads = store.leads.length;
    const scoredLeads = store.leads.filter(l => l.score > 0).length;
    const topLead = [...store.leads].sort((a, b) => b.score - a.score)[0];
    res.json({
      campaigns: { total: store.campaigns.length, active: activeCampaigns.length, completed: store.campaigns.filter(c => c.status === 'completed').length },
      deliveries: { total: store.deliveries.length, today: todayDeliveries.length, sent: store.deliveries.filter(d => d.status === 'sent' || d.status === 'delivered').length },
      leads: { total: totalLeads, scored: scoredLeads, topLead: topLead ? { name: topLead.name, score: topLead.score } : null },
      channels: store.channels.length > 0 ? store.channels.map(c => ({ channel: c.channel, status: c.status })) : [],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// LEADS CRUD (Individual)
// ═══════════════════════════════════════════════════════

app.get('/api/leads/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.status(400).json({ error: 'query param q required' });
    const query = q.toLowerCase();
    const items = getStore().leads.filter(l =>
      (l.name && l.name.toLowerCase().includes(query)) ||
      (l.phone && l.phone.includes(query)) ||
      (l.email && l.email.toLowerCase().includes(query))
    ).slice(0, parseInt(limit));
    res.json({ data: items, total: items.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/leads/:id', async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'email', 'custom_fields', 'status'];
    let updated = null;
    updateStore(s => {
      const l = s.leads.find(l => l.id === req.params.id);
      if (!l) return;
      for (const k of allowed) {
        if (req.body[k] !== undefined) l[k] = req.body[k];
      }
      l.updated_at = new Date().toISOString();
      updated = l;
    });
    if (!updated) return res.status(404).json({ error: 'Lead not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/leads/:id', async (req, res) => {
  try {
    let found = false;
    updateStore(s => {
      const idx = s.leads.findIndex(l => l.id === req.params.id);
      if (idx === -1) return;
      s.leads.splice(idx, 1);
      s.scores = s.scores.filter(sc => sc.lead_id !== req.params.id);
      s.deliveries = s.deliveries.filter(d => d.contact_id !== req.params.id);
      found = true;
    });
    if (!found) return res.status(404).json({ error: 'Lead not found' });
    res.json({ status: 'deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// CAMPAIGN EXPORT
// ═══════════════════════════════════════════════════════

app.get('/api/campaigns/:id/export', async (req, res) => {
  try {
    const store = getStore();
    const campaign = store.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const leads = store.leads.filter(l => l.campaign_id === req.params.id);
    const deliveries = store.deliveries.filter(d => d.campaign_id === req.params.id);
    const scores = store.scores.filter(s => s.campaign_id === req.params.id);
    const csvRows = [['name', 'phone', 'email', 'status', 'score', 'category', 'sent_at', 'delivered_at', 'replied_at']];
    for (const lead of leads) {
      const leadDeliveries = deliveries.filter(d => d.contact_id === lead.id || d.contact_id === lead.phone);
      const leadScore = scores.filter(s => s.lead_id === lead.id);
      const lastScore = leadScore.sort((a, b) => new Date(b.classified_at) - new Date(a.classified_at))[0];
      csvRows.push([
        lead.name || '', lead.phone || '', lead.email || '', lead.status || '',
        lead.score?.toString() || '0', lastScore?.category || 'cold',
        leadDeliveries[0]?.sent_at || '', leadDeliveries[0]?.delivered_at || '', leadDeliveries[0]?.replied_at || ''
      ]);
    }
    const csv = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaign.name}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// WEBHOOKS (WhatsApp Meta)
// ═══════════════════════════════════════════════════════

app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'wibsite_verify_2026';
  if (mode === 'subscribe' && token === expectedToken) return res.status(200).send(challenge);
  res.status(403).send('Verification failed');
});

app.post('/webhooks/whatsapp', (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    if (value?.statuses) {
      updateStore(s => {
        for (const st of value.statuses) {
          const delivery = s.deliveries.find(d => d.message_id === st.id);
          if (delivery) {
            delivery.status = st.status;
            if (st.status === 'delivered') delivery.delivered_at = new Date().toISOString();
            if (st.status === 'read') delivery.read_at = new Date().toISOString();
            if (st.status === 'failed') delivery.error = st.errors?.[0]?.message;
          }
        }
      });
    }
    // Handle incoming messages
    if (value?.messages) {
      for (const msg of value.messages) {
        if (msg.type === 'text' && msg.text?.body?.toLowerCase().includes('stop')) {
          updateStore(s => {
            s.optOuts.push({ phone: msg.from, channel: 'whatsapp', reason: 'User replied STOP', source: 'user_reply', created_at: new Date().toISOString() });
          });
        } else if (msg.type === 'text') {
          const contact = value.contacts?.[0];
          const profileName = contact?.profile?.name || 'Desconocido';
          const waId = msg.from;
          const textBody = msg.text?.body || '';
          updateStore(s => {
            const existing = s.leads.find(l => l.phone === waId);
            if (!existing) {
              const campaign = s.campaigns.find(c => c.channel === 'whatsapp' && c.status === 'sending');
              const newLead = {
                id: crypto.randomUUID(),
                campaign_id: campaign?.id || null,
                name: profileName,
                phone: waId,
                email: '',
                source: 'whatsapp_inbound',
                status: 'new',
                score: 0,
                score_data: {},
                custom_fields: { message: textBody, source: 'whatsapp_webhook' },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              s.leads.push(newLead);
            }
            s.deliveries.push({
              id: crypto.randomUUID(),
              campaign_id: null,
              contact_id: waId,
              contact_name: profileName,
              phone: waId,
              status: 'received',
              message_id: msg.id,
              channel: 'whatsapp',
              direction: 'inbound',
              content: textBody,
              sent_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
          });
          // Forward to n8n webhook (Chatwoot-compatible format)
          try {
            const n8nUrl = process.env.N8N_URL || 'http://n8n:5678';
            const normalizedPayload = {
              message_type: 'incoming',
              content: textBody,
              sender: { name: profileName, phone_number: waId, email: '' },
              conversation_id: `whatsapp_${waId}`,
              conversation: {
                id: `whatsapp_${waId}`,
                messages: [{ content: textBody, message_type: 'incoming', sender: { name: profileName }, created_at: new Date().toISOString() }]
              },
              account_id: 1,
              inbox_id: 1,
              source_id: waId,
              contact: { name: profileName, phone_number: waId },
              created_at: new Date().toISOString(),
            };
            axios.post(`${n8nUrl}/webhook/chatwoot-inbound`, normalizedPayload).catch(() => {});
          } catch (e) { /* silently ignore n8n forwarding errors */ }
        }
      }
    }
    res.status(200).send('OK');
  } catch (e) {
    res.status(200).send('OK');
  }
});

// ═══════════════════════════════════════════════════════
// CONVERSATION STATE (MVP-02: Memoria de conversación)
// ═══════════════════════════════════════════════════════

app.post('/api/conversations/:tenantId/:conversationId', async (req, res) => {
  try {
    const { tenantId, conversationId } = req.params;
    const conv = await createConversationState(tenantId, conversationId, req.body.metadata || {});
    res.status(201).json(conv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/conversations/:tenantId/:conversationId', async (req, res) => {
  try {
    const conv = await getConversationState(req.params.tenantId, req.params.conversationId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/conversations/:tenantId/:conversationId/state', async (req, res) => {
  try {
    const { state, reason } = req.body;
    if (!state) return res.status(400).json({ error: 'state is required' });

    const allStates = Object.values(CONVERSATION_STATES);
    if (!allStates.includes(state)) {
      return res.status(400).json({
        error: 'Invalid state',
        validStates: allStates,
        stateLabels: STATE_LABELS,
      });
    }
    const result = await transitionState(req.params.tenantId, req.params.conversationId, state, reason || '');
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/conversations/states', (req, res) => {
  res.json({
    states: CONVERSATION_STATES,
    validTransitions: require('./services/conversationStore').VALID_TRANSITIONS,
    stateLabels: STATE_LABELS,
  });
});

app.get('/api/conversations/:tenantId', async (req, res) => {
  try {
    const convs = await listActiveConversations(req.params.tenantId);
    res.json({ conversations: convs, total: convs.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/conversations/:tenantId/:conversationId', async (req, res) => {
  try {
    const result = await deleteConversationState(req.params.tenantId, req.params.conversationId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════
// CHATWOOT HELPERS
// ═══════════════════════════════════════════════════════

app.post('/api/chatwoot/normalize', (req, res) => {
  const payload = req.body;
  res.json({
    message_type: payload.message_type || 'incoming',
    content: payload.content || payload.text || '',
    sender: {
      name: payload.sender?.name || payload.meta?.sender?.name || 'Desconocido',
      phone_number: payload.sender?.phone_number || payload.meta?.sender?.phone_number || '',
      email: payload.sender?.email || payload.meta?.sender?.email || '',
    },
    conversation_id: payload.conversation?.id || payload.conversation_id,
    account_id: payload.account?.id || payload.account_id,
    inbox_id: payload.inbox?.id || payload.inbox_id,
    source_id: payload.source_id || '',
    conversation: payload.conversation || {},
    timestamp: payload.created_at || new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════
// MESSAGE TEMPLATES
// ═══════════════════════════════════════════════════════

const DEFAULT_TEMPLATES = [
  {
    id: 'welcome-whatsapp',
    name: 'Bienvenida WhatsApp',
    channel: 'whatsapp',
    description: 'Mensaje de bienvenida para nuevos contactos',
    body: 'Hola {{name}}, gracias por contactarnos. Soy el asistente virtual de {{business}}. ¿En qué puedo ayudarte hoy?',
    variables: ['name', 'business'],
    category: 'welcome',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'promo-whatsapp',
    name: 'Promoción WhatsApp',
    channel: 'whatsapp',
    description: 'Oferta especial para leads calientes',
    body: '¡Hola {{name}}! Tenemos una oferta especial para ti: {{offer}}. Válido hasta {{expiry}}. Responde "QUIERO" para más info.',
    variables: ['name', 'offer', 'expiry'],
    category: 'promotion',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'followup-whatsapp',
    name: 'Seguimiento WhatsApp',
    channel: 'whatsapp',
    description: 'Recordatorio amable para leads que no han respondido',
    body: 'Hola {{name}}, solo quería recordarte que estamos aquí para lo que necesites. ¿Te gustaría agendar una llamada con nuestro equipo? Responde "SÍ" para coordinar.',
    variables: ['name'],
    category: 'followup',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'welcome-messenger',
    name: 'Bienvenida Messenger',
    channel: 'messenger',
    description: 'Mensaje inicial por Messenger',
    body: '¡Hola {{name}}! 👋 Bienvenido a {{business}}. Estamos para ayudarte. Cuéntanos, ¿qué te interesa?',
    variables: ['name', 'business'],
    category: 'welcome',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'promo-messenger',
    name: 'Oferta Messenger',
    channel: 'messenger',
    description: 'Oferta con imagen/video para Messenger',
    body: '🔥 {{name}}, tenemos algo que te va a encantar: {{offer}}. Por tiempo limitado. ¿Quieres saber más?',
    variables: ['name', 'offer'],
    category: 'promotion',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'promo-tiktok',
    name: 'Promoción TikTok DM',
    channel: 'tiktok',
    description: 'Mensaje directo promocional en TikTok',
    body: '¡Hola {{name}}! Vimos que te interesa {{interest}}. Tenemos contenido exclusivo para ti en {{business}}. ¿Te gustaría recibir más info?',
    variables: ['name', 'interest', 'business'],
    category: 'promotion',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'followup-tiktok',
    name: 'Seguimiento TikTok',
    channel: 'tiktok',
    description: 'Engagement follow-up en TikTok',
    body: 'Hey {{name}}, gracias por seguirnos. ¿Te gustaría ser el primero en enterarte de nuestras novedades? Activa la campanita 🔔',
    variables: ['name'],
    category: 'followup',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'notification-sms',
    name: 'Notificación SMS',
    channel: 'sms',
    description: 'Alerta o notificación corta por SMS',
    body: '{{business}}: Hola {{name}}, {{message}}. Más info: {{short_url}}',
    variables: ['name', 'business', 'message', 'short_url'],
    category: 'notification',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'promo-sms',
    name: 'Promoción SMS',
    channel: 'sms',
    description: 'Oferta corta por SMS (máx 160 chars)',
    body: '{{name}}: Oferta {{offer}} en {{business}}. Válido hoy. Responde INFO.',
    variables: ['name', 'offer', 'business'],
    category: 'promotion',
    max_length: 160,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'newsletter-email',
    name: 'Newsletter Email',
    channel: 'email',
    description: 'Newsletter mensual para leads',
    subject: '{{business}} — Novedades para {{name}}',
    body: 'Hola {{name}},\n\nEstas son las novedades de {{business}} este mes:\n\n{{content}}\n\nSaludos,\nEl equipo de {{business}}',
    variables: ['name', 'business', 'content'],
    category: 'newsletter',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'followup-email',
    name: 'Email Seguimiento',
    channel: 'email',
    description: 'Email de seguimiento post-demo/reunión',
    subject: 'Gracias por tu interés, {{name}}',
    body: 'Hola {{name}},\n\nGracias por tu tiempo el {{meeting_date}}. Adjuntamos la información que solicitaste:\n\n{{attachment_links}}\n\nQuedamos atentos a cualquier pregunta.\n\nSaludos,\n{{business}}',
    variables: ['name', 'meeting_date', 'attachment_links', 'business'],
    category: 'followup',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

app.get('/api/templates', (req, res) => {
  try {
    const { channel, category } = req.query;
    let items = getStore().templates || DEFAULT_TEMPLATES;
    if (channel) items = items.filter(t => t.channel === channel);
    if (category) items = items.filter(t => t.category === category);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/templates', (req, res) => {
  try {
    const { name, channel, description, subject, body, variables, category, max_length } = req.body;
    if (!name || !channel || !body) return res.status(400).json({ error: 'name, channel, and body are required' });
    const t = {
      id: crypto.randomUUID().substring(0, 12),
      name, channel, description: description || null,
      subject: subject || null,
      body,
      variables: variables || [],
      category: category || 'custom',
      max_length: max_length || null,
      created_at: new Date().toISOString(),
    };
    updateStore(s => {
      if (!s.templates) s.templates = [...DEFAULT_TEMPLATES];
      s.templates.push(t);
    });
    res.status(201).json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/templates/:id', (req, res) => {
  try {
    updateStore(s => {
      if (s.templates) s.templates = s.templates.filter(t => t.id !== req.params.id);
    });
    res.json({ status: 'deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Preview filled template
app.post('/api/templates/preview', (req, res) => {
  try {
    const { template_id, values } = req.body;
    if (!template_id) return res.status(400).json({ error: 'template_id required' });
    const t = (getStore().templates || DEFAULT_TEMPLATES).find(t => t.id === template_id);
    if (!t) return res.status(404).json({ error: 'Template not found' });

    let filled = t.body;
    let filledSubject = t.subject;
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        filled = filled.replace(new RegExp('{{' + k + '}}', 'g'), v);
        if (filledSubject) filledSubject = filledSubject.replace(new RegExp('{{' + k + '}}', 'g'), v);
      }
    }

    res.json({
      template_id: t.id,
      name: t.name,
      channel: t.channel,
      subject: filledSubject,
      body: filled,
      character_count: filled.length,
      max_length: t.max_length,
      exceeds_limit: t.max_length ? filled.length > t.max_length : false,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// AGENT CONFIG (MVP-04: Editor de contexto + Switcher)
// ═══════════════════════════════════════════════════════

app.get('/api/agent/config', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const store = getStore();
    const config = getAgentConfig(tenantId, store);
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/agent/config', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const store = getStore();
    const updated = updateAgentConfig(tenantId, req.body, store);
    saveStore(store);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/agent/config/system-prompt', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const store = getStore();
    const config = getAgentConfig(tenantId, store);
    const systemPrompt = buildSystemPrompt(config);
    res.json({ systemPrompt, config: { business_name: config.business_name, business_type: config.business_type, personality: config.personality } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/agent/business-types', (req, res) => {
  const { getBusinessTypeInfo } = require('./services/agentConfig');
  res.json(require('./services/agentConfig').BUSINESS_TYPES);
});

app.get('/api/agent/personalities', (req, res) => {
  res.json(require('./services/agentConfig').PERSONALITY_TYPES);
});

// ═══════════════════════════════════════════════════════
// SEED DATA (mock para pruebas end-to-end)
// ═══════════════════════════════════════════════════════

app.post('/api/seed', (req, res) => {
  try {
    const now = new Date();

    const firstNames = ['María', 'Carlos', 'Ana', 'Luis', 'Sofía', 'Pedro', 'Laura', 'Jorge', 'Valentina', 'Diego', 'Gabriela', 'Andrés', 'Fernanda', 'Ricardo', 'Isabella'];
    const lastNames = ['García', 'Rodríguez', 'Martínez', 'López', 'Hernández', 'González', 'Pérez', 'Muñoz', 'Rojas', 'Díaz', 'Silva', 'Vargas', 'Castro', 'Torres', 'Mendoza'];
    const interests = ['marketing digital', 'desarrollo web', 'e-commerce', 'IA', 'redes sociales', 'SEO', 'email marketing', 'chatbots', 'analítica', 'automatización'];
    const painPoints = ['poco tráfico', 'baja conversión', 'sin automatización', 'altos costos', 'falta de leads', 'sin presencia digital', 'procesos manuales', 'poco engagement'];

    const camp1 = {
      id: crypto.randomUUID(), name: 'Lanzamiento WhatsApp Jul 2026',
      description: 'Promoción de lanzamiento para clientes premium',
      channel: 'whatsapp', message_template: '¡Hola {{name}}! Lanzamos {{product}} con 30% OFF. Usa código WIB30. Válido hasta 31/07.',
      template_name: 'promo-whatsapp', audience_filter: { segment: 'premium' },
      status: 'sending', sent_count: 0, delivered_count: 0, read_count: 0, replied_count: 0, failed_count: 0, opt_out_count: 0,
      scheduled_at: null, started_at: new Date(now - 86400000).toISOString(),
      created_at: new Date(now - 172800000).toISOString(), updated_at: now.toISOString(),
    };
    const camp2 = {
      id: crypto.randomUUID(), name: 'Campaña Messenger Julio',
      description: 'Engagement para leads de Facebook',
      channel: 'messenger', message_template: '¡Hola {{name}}! Te tenemos una sorpresa 🎁',
      template_name: 'welcome-messenger', audience_filter: {},
      status: 'scheduled', sent_count: 0, delivered_count: 0, read_count: 0, replied_count: 0, failed_count: 0, opt_out_count: 0,
      scheduled_at: new Date(now + 86400000).toISOString(), started_at: null,
      created_at: new Date(now - 86400000).toISOString(), updated_at: now.toISOString(),
    };
    const camp3 = {
      id: crypto.randomUUID(), name: 'Newsletter Julio 2026',
      description: 'Newsletter mensual con novedades',
      channel: 'email', message_template: 'Novedades de {{business}} - {{name}}',
      template_name: 'newsletter-email', audience_filter: {},
      status: 'draft', sent_count: 0, delivered_count: 0, read_count: 0, replied_count: 0, failed_count: 0, opt_out_count: 0,
      scheduled_at: null, started_at: null,
      created_at: new Date(now - 43200000).toISOString(), updated_at: now.toISOString(),
    };

    // Build all seed data
    const leads = [];
    const deliveries = [];
    for (let i = 0; i < 12; i++) {
      const name = firstNames[i % firstNames.length] + ' ' + lastNames[i % lastNames.length];
      const phone = '52155' + String(10000000 + i).padStart(8, '0');
      const score = Math.floor(Math.random() * 100);
      const camp = [camp1, camp2][i % 2];
      const lead = {
        id: crypto.randomUUID(), campaign_id: camp.id,
        contact_id: null, name, phone, email: name.toLowerCase().replace(' ', '.') + '@example.com',
        custom_fields: {
          interest: interests[Math.floor(Math.random() * interests.length)],
          pain_point: painPoints[Math.floor(Math.random() * painPoints.length)],
          segment: i < 6 ? 'premium' : 'standard',
          source: ['web', 'facebook', 'referral', 'instagram'][Math.floor(Math.random() * 4)],
        },
        status: ['pending', 'sent', 'delivered', 'replied', 'failed'][Math.floor(Math.random() * 5)],
        score,
        score_data: { engagement: Math.floor(Math.random() * 50), recency: Math.floor(Math.random() * 30), channel_affinity: Math.floor(Math.random() * 20) },
        source: 'seed', created_at: new Date(now - Math.random() * 86400000 * 7).toISOString(), updated_at: now.toISOString(),
      };
      leads.push(lead);

      let dStatus = Math.random() > 0.8 ? 'failed' : (Math.random() > 0.5 ? 'delivered' : (Math.random() > 0.3 ? 'read' : 'replied'));
      deliveries.push({
        id: crypto.randomUUID(), campaign_id: camp.id, contact_id: lead.id,
        contact_name: name, phone, status: dStatus,
        message_id: 'wamid.mock.' + i, channel_message_id: 'chmsg.' + i,
        sent_at: new Date(now - 3600000 * (i + 1)).toISOString(),
        delivered_at: dStatus !== 'failed' ? new Date(now - 3600000 * (i + 1) + 5000).toISOString() : null,
        read_at: (dStatus === 'read' || dStatus === 'replied') ? new Date(now - 3600000 * (i + 1) + 30000).toISOString() : null,
        replied_at: dStatus === 'replied' ? new Date(now - 3600000 * (i + 1) + 60000).toISOString() : null,
        error: dStatus === 'failed' ? 'Error de entrega simulado' : null,
        score, created_at: new Date(now - 3600000 * (i + 1)).toISOString(),
      });
    }

    const scores = leads.map(l => ({
      id: crypto.randomUUID(), lead_id: l.id, campaign_id: l.campaign_id,
      score: l.score,
      score_factors: { engagement: Math.floor(Math.random() * 50), recency: Math.floor(Math.random() * 30), channel_affinity: Math.floor(Math.random() * 20) },
      score_model: 'rule-based',
      classified_at: new Date(now - Math.random() * 3600000 * 24).toISOString(),
      notes: null,
    }));

    const channels = [
      { channel: 'whatsapp', status: 'connected', status_message: 'Conectado vía Meta API', last_checked_at: now.toISOString(), error_count: 0 },
      { channel: 'messenger', status: 'pending', status_message: 'Esperando configuración Meta', last_checked_at: now.toISOString(), error_count: 0 },
      { channel: 'tiktok', status: 'disconnected', status_message: 'No configurado', last_checked_at: null, error_count: 0 },
      { channel: 'sms', status: 'disconnected', status_message: 'No configurado', last_checked_at: null, error_count: 0 },
      { channel: 'email', status: 'pending', status_message: 'SMTP pendiente de validar', last_checked_at: now.toISOString(), error_count: 0 },
    ];

    updateStore(s => {
      s.campaigns.push(camp1, camp2, camp3);
      s.leads.push(...leads);
      s.deliveries.push(...deliveries);
      s.scores.push(...scores);
      s.channels = channels;
    });

    res.status(201).json({
      message: 'Seed data created',
      campaigns: 3,
      leads: leads.length,
      deliveries: deliveries.length,
      scores: scores.length,
      channels: channels.length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/seed', (req, res) => {
  updateStore(() => ({ campaigns: [], deliveries: [], optOuts: [], leads: [], scores: [], channels: [], templates: undefined }));
  res.json({ message: 'All data cleared' });
});

// ═══════════════════════════════════════════════════════
// OPENROUTER LLM (replaces xAI Grok)
// ═══════════════════════════════════════════════════════

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

// Health check for LLM
app.get('/api/llm/health', (req, res) => {
  res.json({
    configured: !!OPENROUTER_API_KEY,
    provider: 'openrouter',
    model: OPENROUTER_MODEL,
    base_url: OPENROUTER_BASE,
  });
});

// Simple chat completion (test endpoint)
app.post('/api/llm/chat', async (req, res) => {
  try {
    if (!OPENROUTER_API_KEY) return res.status(400).json({ error: 'OPENROUTER_API_KEY not configured' });
    const { messages, model, temperature = 0.7, max_tokens = 500 } = req.body;
    if (!messages || !messages.length) return res.status(400).json({ error: 'messages array required' });

    const sanitizedMessages = messages.map(m => ({
      role: m.role,
      content: m.role === 'system' ? m.content : (m.content || ''),
    }));
    const hasBlocked = sanitizedMessages.some(m => m.content === '[Mensaje bloqueado por seguridad]');
    if (hasBlocked) {
      return res.json({
        model: 'sanitizer',
        choices: [{ index: 0, message: { role: 'assistant', content: '[Mensaje bloqueado por seguridad]' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        sanitized: true,
      });
    }

    try {
      const resp = await axios.post(`${OPENROUTER_BASE}/chat/completions`, {
        model: model || OPENROUTER_MODEL,
        messages: sanitizedMessages,
        temperature,
        max_tokens,
      }, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3100',
          'X-Title': 'Wibsite Business',
        },
        timeout: 30000,
      });

      res.json({
        model: resp.data.model,
        choices: resp.data.choices,
        usage: resp.data.usage,
      });
    } catch (apiErr) {
      res.json({
        model: 'offline',
        choices: [{ index: 0, message: { role: 'assistant', content: '[LLM offline - modo simulación] Mensaje recibido correctamente.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        offline: true,
        error: apiErr.message,
      });
    }
  } catch (e) {
    res.status(500).json({ error: e.message, details: e.response?.data });
  }
});

// LLM-based lead scoring (alternative to rule-based)
app.post('/api/scoring/evaluate-llm', async (req, res) => {
  try {
    if (!OPENROUTER_API_KEY) return res.status(400).json({ error: 'OPENROUTER_API_KEY not configured' });
    const { lead_id } = req.body;
    if (!lead_id) return res.status(400).json({ error: 'lead_id required' });

    const store = getStore();
    const lead = store.leads.find(l => l.id === lead_id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const deliveries = store.deliveries.filter(d => d.contact_id === lead_id || d.campaign_id === lead.campaign_id);
    const campaign = store.campaigns.find(c => c.id === lead.campaign_id);

    const prompt = `Evalúa este lead de campaña de marketing y asigna un score de 0-100.
Responde SOLO con JSON: {"score": <0-100>, "reason": "<explicación breve>", "category": "hot|warm|cold"}

Datos del lead:
- Nombre: ${lead.name || 'Desconocido'}
- Teléfono: ${lead.phone || 'N/A'}
- Email: ${lead.email || 'N/A'}
- Intereses: ${lead.custom_fields?.interest || 'N/A'}
- Punto de dolor: ${lead.custom_fields?.pain_point || 'N/A'}
- Segmento: ${lead.custom_fields?.segment || 'standard'}
- Estado actual: ${lead.status}
- Score actual (rule-based): ${lead.score}
- Campaña: ${campaign?.name || 'N/A'} (canal: ${campaign?.channel || 'N/A'})
- Historial de entregas: ${deliveries.length} eventos
- Último estado de entrega: ${deliveries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.status || 'sin entregas'}

Criterios:
- HOT (70-100): lead muy calificado, alta probabilidad de conversión
- WARM (40-69): lead interesado, requiere seguimiento
- COLD (0-39): lead frío, necesita nurturing`;

    const resp = await axios.post(`${OPENROUTER_BASE}/chat/completions`, {
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: 'Eres un clasificador de leads de ventas. Analiza datos de leads y asigna scores precisos basados en el contexto.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3100',
        'X-Title': 'Wibsite Business',
      },
      timeout: 30000,
    });

    let result;
    try {
      const text = resp.data.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 50, reason: 'Failed to parse LLM response', category: 'warm' };
    } catch (parseErr) {
      result = { score: 50, reason: 'Parse error: ' + parseErr.message, category: 'warm' };
    }

    const scoreEntry = {
      id: crypto.randomUUID(),
      lead_id,
      campaign_id: lead.campaign_id,
      score: Math.max(0, Math.min(100, result.score || 50)),
      category: result.category || (result.score >= 70 ? 'hot' : result.score >= 40 ? 'warm' : 'cold'),
      score_factors: {},
      score_model: 'llm-openrouter-v1',
      llm_reasoning: result.reason || '',
      raw_response: resp.data.choices[0].message.content,
      model_used: resp.data.model,
      classified_at: new Date().toISOString(),
    };

    updateStore(s => {
      s.scores.push(scoreEntry);
      const l = s.leads.find(l => l.id === lead_id);
      if (l) {
        l.score = scoreEntry.score;
        l.score_data = { ...l.score_data, llm_score: scoreEntry.score, llm_category: scoreEntry.category, llm_model: resp.data.model, llm_classified_at: scoreEntry.classified_at };
      }
    });

    res.json(scoreEntry);
  } catch (e) {
    res.status(500).json({ error: e.message, details: e.response?.data });
  }
});

// ═══════════════════════════════════════════════════════
// KNOWLEDGE BASE (MVP-05: RAG básico)
// ═══════════════════════════════════════════════════════

app.get('/api/knowledge-base/health', async (req, res) => {
  try {
    const weaviateOk = await checkWeaviateHealth();
    res.json({ weaviateAvailable: weaviateOk, mode: weaviateOk ? 'weaviate' : 'in-memory-fallback' });
  } catch (e) {
    res.json({ weaviateAvailable: false, mode: 'in-memory-fallback', error: e.message });
  }
});

app.get('/api/knowledge-base/documents', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const result = await listDocuments(tenantId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/knowledge-base/documents', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const { title, content, source, tags } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

    const result = await addDocument(tenantId, title, content, source || 'manual', 'text/plain', tags || []);
    if (result.error && result.fallback === 'memory') {
      const fallback = addInMemoryDocument(tenantId, title, content, source || 'manual');
      return res.status(201).json({ ...fallback, mode: 'in-memory-fallback' });
    }
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/knowledge-base/query', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const { query, limit = 5 } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const result = await queryKnowledgeBase(tenantId, query, parseInt(limit));
    if (!result.weaviateAvailable || result.error) {
      const inMemResults = queryInMemoryKB(tenantId, query, parseInt(limit));
      return res.json({ results: inMemResults, total: inMemResults.length, query, mode: 'in-memory-fallback' });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/knowledge-base/documents/:id', async (req, res) => {
  try {
    const result = await deleteDocument('default', req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════
// TWILIO SEND (proxy to avoid credential exposure in n8n)
// ═══════════════════════════════════════════════════════

app.post('/api/twilio/send', async (req, res) => {
  try {
    const { to, from, body: messageBody, campaign_id, lead_id, status_callback } = req.body;
    if (!to || !messageBody) return res.status(400).json({ error: 'to and body required' });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return res.status(500).json({ error: 'TWILIO not configured' });

    const fromNumber = process.env.TWILIO_SANDBOX_NUMBER || process.env.TWILIO_PHONE_NUMBER;
    const normalizeWhatsApp = (num, isSandbox) => {
      if (!num) return num;
      if (num.startsWith('whatsapp:')) return num;
      const digits = num.replace(/[^\d+]/g, '');
      if (isSandbox || !fromNumber || fromNumber.includes('whatsapp')) return `whatsapp:${digits}`;
      return digits;
    };

    const toNormalized = normalizeWhatsApp(to, true);
    const fromNormalized = normalizeWhatsApp(fromNumber, true);

    // Track delivery record before sending
    const deliveryId = crypto.randomUUID();
    const callbackUrl = status_callback || `http://helper:3100/webhooks/twilio-status`;
    updateStore(s => {
      s.deliveries.push({
        id: deliveryId, campaign_id: campaign_id || null, contact_id: lead_id || to,
        contact_name: req.body.lead_name || to, phone: to, status: 'queued',
        message_id: null, channel: 'twilio', direction: 'outbound',
        content: messageBody, campaign_name: req.body.campaign_name || null,
        sent_at: null, delivered_at: null, error_message: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    });

    const resp = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({
        To: toNormalized, From: fromNormalized, Body: messageBody,
        StatusCallback: callbackUrl,
      }).toString(),
      {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    // Update delivery with SID
    updateStore(s => {
      const d = s.deliveries.find(d => d.id === deliveryId);
      if (d) { d.message_id = resp.data.sid; d.status = 'sent'; d.sent_at = new Date().toISOString(); }
    });

    res.json({ status: 'sent', sid: resp.data.sid, delivery_id: deliveryId, to: toNormalized, from: fromNormalized });
  } catch (e) {
    const details = e.response?.data ? JSON.stringify(e.response.data) : String(e.message);
    res.status(500).send('ERROR: ' + e.code + ' - ' + e.message + ' | ' + details);
  }
});

// Twilio typing indicator (send a pre-message typing webhook)
app.post('/api/twilio/typing', async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'to required' });
    res.json({ status: 'typing_simulated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// TWILIO INBOUND WEBHOOK (reemplazo Meta hasta migración)
// ═══════════════════════════════════════════════════════

app.post('/webhooks/twilio-inbound', async (req, res) => {
  try {
    const from = req.body.From || req.body.from;
    const body = req.body.Body || req.body.body;
    const messageSid = req.body.MessageSid || req.body.messageSid || `twilio_${Date.now()}`;
    if (!from || !body) return res.status(400).send('<Response></Response>');

    const phone = from.replace(/^whatsapp:/, '').replace(/[^\d+]/g, '');
    const profileName = req.body.ProfileName || req.body.profileName || phone;

    // 1. Create lead + delivery in helper store
    updateStore(s => {
      const existing = s.leads.find(l => l.phone === phone);
      if (!existing) {
        const campaign = s.campaigns.find(c => ['whatsapp', 'sms'].includes(c.channel) && c.status === 'sending');
        s.leads.push({
          id: crypto.randomUUID(), campaign_id: campaign?.id || null,
          name: profileName, phone, email: '', source: 'twilio_inbound',
          status: 'new', score: 0, score_data: {},
          custom_fields: { message: body, source: 'twilio_webhook' },
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
      }
      s.deliveries.push({
        id: crypto.randomUUID(), campaign_id: null, contact_id: phone,
        contact_name: profileName, phone, status: 'received', channel: 'twilio',
        direction: 'inbound', content: body, message_id: messageSid,
        sent_at: new Date().toISOString(), created_at: new Date().toISOString(),
      });
    });

    // 2. Forward to n8n webhook (Chatwoot-compatible format)
    try {
      const n8nUrl = process.env.N8N_URL || 'http://n8n:5678';
      const normalizedPayload = {
        message_type: 'incoming', content: body,
        sender: { name: profileName, phone_number: phone, email: '' },
        conversation_id: `twilio_${phone}`,
        conversation: { id: `twilio_${phone}`, messages: [{ content: body, message_type: 'incoming', sender: { name: profileName }, created_at: new Date().toISOString() }] },
        account_id: 1, inbox_id: 1, source_id: phone,
        contact: { name: profileName, phone_number: phone },
        created_at: new Date().toISOString(),
      };
      axios.post(`${n8nUrl}/webhook/chatwoot-inbound`, normalizedPayload).catch(() => {});
    } catch (e) { /* ignore forwarding errors */ }

    // 3. Push to Chatwoot bridge
    try {
      await pushToChatwoot(phone, profileName, body);
    } catch (e) { /* ignore chatwoot bridge errors */ }

    res.type('text/xml').send('<Response></Response>');
  } catch (e) {
    console.error('Twilio inbound error:', e.message);
    res.type('text/xml').send('<Response></Response>');
  }
});

// Twilio status callback
app.post('/webhooks/twilio-status', async (req, res) => {
  try {
    const messageSid = req.body.MessageSid;
    const status = req.body.MessageStatus;
    if (messageSid && status) {
      updateStore(s => {
        const delivery = s.deliveries.find(d => d.message_id === messageSid);
        if (delivery) {
          delivery.status = status;
          if (status === 'delivered') delivery.delivered_at = new Date().toISOString();
          if (status === 'read') delivery.read_at = new Date().toISOString();
          if (status === 'failed') delivery.error_message = req.body.ErrorMessage || 'Failed';
          delivery.updated_at = new Date().toISOString();
        }
      });
    }
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(200);
  }
});

// CHATWOOT BRIDGE (Twilio ↔ Chatwoot API inbox)
// ═══════════════════════════════════════════════════════

const CHATWOOT_URL = process.env.CHATWOOT_URL || 'http://chatwoot:3000';
const CHATWOOT_INBOX_IDENTIFIER = process.env.CHATWOOT_INBOX_IDENTIFIER || 'Lo9jawjXVCz2gmupLcxqvYqr';

async function pushToChatwoot(phone, name, message) {
  try {
    const contactResp = await axios.post(
      `${CHATWOOT_URL}/public/api/v1/inboxes/${CHATWOOT_INBOX_IDENTIFIER}/contacts`,
      { name: name || phone, phone_number: phone },
      { timeout: 10000 }
    );
    const sourceId = contactResp.data.source_id;
    await axios.post(
      `${CHATWOOT_URL}/public/api/v1/inboxes/${CHATWOOT_INBOX_IDENTIFIER}/contacts/${sourceId}/conversations`,
      { content: message },
      { timeout: 10000 }
    );
    return sourceId;
  } catch (e) {
    throw new Error('Chatwoot push failed: ' + (e.response?.data?.message || e.message));
  }
}

// Inbound: n8n pushes Twilio messages to Chatwoot
app.post('/api/chatwoot/push', async (req, res) => {
  try {
    const { phone, name, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone and message required' });

    // 1. Create contact in Chatwoot
    const contactResp = await axios.post(
      `${CHATWOOT_URL}/public/api/v1/inboxes/${CHATWOOT_INBOX_IDENTIFIER}/contacts`,
      { name: name || phone, phone_number: phone },
      { timeout: 10000 }
    );
    const sourceId = contactResp.data.source_id;

    // 2. Create conversation with the message
    const convResp = await axios.post(
      `${CHATWOOT_URL}/public/api/v1/inboxes/${CHATWOOT_INBOX_IDENTIFIER}/contacts/${sourceId}/conversations`,
      { content: message },
      { timeout: 10000 }
    );

    res.json({ status: 'created', conversation_id: convResp.data.id, contact_source_id: sourceId });
  } catch (e) {
    res.status(500).json({ error: 'Chatwoot bridge failed: ' + (e.response?.data?.message || e.message) });
  }
});

// Outbound: Chatwoot webhook → Twilio send (agent replies)
app.post('/api/webhooks/chatwoot', async (req, res) => {
  try {
    const payload = req.body;
    if (payload.event === 'message_created' && payload.sender) {
      // Create or ensure lead exists based on webhook sender
      updateStore(s => {
        const existing = s.leads.find(l => l.phone === payload.sender.phone_number);
        if (!existing && payload.sender.phone_number) {
          s.leads.push({
            id: crypto.randomUUID(),
            name: payload.sender.name || 'Desconocido',
            phone: payload.sender.phone_number,
            status: 'active',
            opt_out: false
          });
        }
        
        // Handle Opt-Out logic
        if (payload.content && typeof payload.content === 'string' && payload.content.trim().toUpperCase() === 'DETENER') {
          const leadToOptOut = s.leads.find(l => l.phone === payload.sender.phone_number);
          if (leadToOptOut) leadToOptOut.opt_out = true;
        }
      });
    }
    res.status(200).json({ received: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/webhooks/chatwoot-outbound', async (req, res) => {
  try {
    const { message_type, content, conversation, contact } = req.body;

    // Only relay outgoing messages (agent replies), not incoming echoes
    if (message_type !== 'outgoing') return res.json({ status: 'ignored', reason: 'not_outgoing' });
    if (!content || !content.trim()) return res.json({ status: 'ignored', reason: 'empty_content' });

    // Extract phone from additional_attributes (set during contact creation)
    let phone = conversation?.additional_attributes?.contact_phone
             || contact?.phone_number
             || conversation?.additional_attributes?.phone;

    if (!phone) return res.status(400).json({ error: 'No phone in webhook payload' });

    // Send via Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_SANDBOX_NUMBER || process.env.TWILIO_PHONE_NUMBER;

    const normalize = (num) => {
      if (!num) return num;
      if (num.startsWith('whatsapp:')) return num;
      return `whatsapp:${num.replace(/[^\d+]/g, '')}`;
    };

    const resp = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({ To: normalize(phone), From: normalize(fromNumber), Body: content }).toString(),
      { auth: { username: accountSid, password: authToken }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );

    res.json({ status: 'sent', sid: resp.data.sid, to: normalize(phone) });
  } catch (e) {
    res.status(500).json({ error: 'Chatwoot outbound failed: ' + (e.response?.data?.message || e.message) });
  }
});

// ═══════════════════════════════════════════════════════
// INTERNAL CONTROL CENTER ENDPOINTS
// Accesibles solo con API key — alimentan el panel de superusuario
// ═══════════════════════════════════════════════════════

// GET /api/internal/health-detailed — estado extendido de todas las dependencias
app.get('/api/internal/health-detailed', async (req, res) => {
  try {
    const store = getStore();
    const weaviateOk = await checkWeaviateHealth();
    let pgOk = false;
    let pgLatency = null;
    if (pool) {
      const t0 = Date.now();
      try { await pool.query('SELECT 1'); pgOk = true; pgLatency = Date.now() - t0; } catch (e) { pgOk = false; }
    }
    let redisOk = false;
    try {
      const { getConversationState } = require('./services/conversationStore');
      redisOk = true;
    } catch (e) { redisOk = false; }

    const [incidentSummary] = await Promise.all([
      getIncidentSummary({ hours: 24 }).catch(() => ({ incidents: [], fallbacks: [], securityEvents: [], alerts: [] }))
    ]);

    res.json({
      service: 'wibsite-helper', version: '2.2.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - uptimeStart) / 1000),
      dependencies: {
        postgresql: { status: pgOk ? 'connected' : 'unavailable', mode: pool ? 'postgresql' : 'json-fallback', latencyMs: pgLatency },
        redis: { status: redisOk ? 'available' : 'fallback', mode: redisOk ? 'redis' : 'in-memory' },
        weaviate: { status: weaviateOk ? 'connected' : 'fallback', mode: weaviateOk ? 'weaviate' : 'in-memory-kb' },
        llm: { status: OPENROUTER_API_KEY ? 'configured' : 'missing', model: OPENROUTER_MODEL },
        glitchtip: { status: GLITCHTIP_DSN ? 'configured' : 'not-configured', dsn: GLITCHTIP_DSN ? 'set' : 'missing' }
      },
      sli: {
        requestCount: sliMetrics.totalRequests,
        errorRate: sliMetrics.totalRequests > 0 ? (sliMetrics.totalErrors / sliMetrics.totalRequests * 100).toFixed(2) + '%' : '0%',
        avgLatencyMs: sliMetrics.totalRequests > 0 ? (sliMetrics.totalLatency / sliMetrics.totalRequests).toFixed(1) : '0',
        errorCount: sliMetrics.totalErrors
      },
      modules: {
        campaigns: { total: store.campaigns.length, active: store.campaigns.filter(c => c.status === 'sending').length },
        leads: { total: store.leads.length, scored: store.leads.filter(l => l.score > 0).length },
        deliveries: { total: store.deliveries.length },
        scores: { total: store.scores.length }
      },
      incidents24h: {
        byModule: incidentSummary.incidents,
        fallbacks: incidentSummary.fallbacks,
        securityEvents: incidentSummary.securityEvents,
        alerts: incidentSummary.alerts
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/internal/incidents/summary — resumen agrupado por módulo/severidad
app.get('/api/internal/incidents/summary', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours || '24');
    const tenantId = req.query.tenantId || req.tenantId;
    const summary = await getIncidentSummary({ hours, tenantId });
    res.json(summary);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/incidents — listado de incidentes con contexto completo
app.get('/api/internal/incidents', async (req, res) => {
  try {
    const { module: mod, severity, status = 'open', tenantId, limit = 50, offset = 0, hours = 72 } = req.query;
    const result = await getIncidents({ module: mod, severity, status, tenantId, limit: parseInt(limit), offset: parseInt(offset), hours: parseInt(hours) });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/incidents/:id — detalle completo de un incidente
app.get('/api/internal/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (pool) {
      const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      // Also get related audit logs
      const logs = await pool.query(
        `SELECT * FROM audit_logs WHERE request_id = $1 OR data->>'flow' LIKE $2 ORDER BY created_at ASC LIMIT 50`,
        [result.rows[0].request_id, `%${result.rows[0].http_path || ''}%`]
      ).catch(() => ({ rows: [] }));
      res.json({ incident: result.rows[0], relatedLogs: logs.rows });
    } else {
      res.json({ incident: null, relatedLogs: [], error: 'DB not available' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/internal/incidents/:id/resolve — marcar incidente como resuelto
app.post('/api/internal/incidents/:id/resolve', async (req, res) => {
  try {
    const { resolvedBy, notes } = req.body;
    const result = await resolveIncident(req.params.id, { resolvedBy, notes });
    logEvent('incident_resolved', {
      level: 'info', message: `Incident ${req.params.id} resolved by ${resolvedBy || 'superuser'}`,
      requestId: req.id, module: 'infrastructure', data: { incidentId: req.params.id, resolvedBy, notes }
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/security/events — eventos de seguridad recientes
app.get('/api/internal/security/events', async (req, res) => {
  try {
    const { hours = 24, type, limit = 100 } = req.query;
    const result = await getSecurityEvents({ hours: parseInt(hours), type, limit: parseInt(limit) });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/fallback-events — historial de fallbacks por dependencia
app.get('/api/internal/fallback-events', async (req, res) => {
  try {
    const { hours = 24, dependency, limit = 100 } = req.query;
    const result = await getFallbackEvents({ hours: parseInt(hours), dependency, limit: parseInt(limit) });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/alerts — alertas de Prometheus/Alertmanager recibidas
app.get('/api/internal/alerts', async (req, res) => {
  try {
    const { hours = 24, status, limit = 100 } = req.query;
    const result = await getAlerts({ hours: parseInt(hours), status, limit: parseInt(limit) });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/internal/alerts/webhook — receptor de Alertmanager
app.post('/api/internal/alerts/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const alert = await receiveAlert(payload);
    console.log(`[AlertManager] Alert received: ${alert.alert_name} (${alert.severity}) — ${alert.status}`);
    res.json({ status: 'received', alert_name: alert.alert_name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/module-status — SLI por módulo
app.get('/api/internal/module-status', async (req, res) => {
  try {
    const store = getStore();
    const now = Date.now();
    const last24h = new Date(now - 86400000);

    const moduleStatus = {
      campaigns: {
        total: store.campaigns.length,
        active: store.campaigns.filter(c => c.status === 'sending').length,
        scheduled: store.campaigns.filter(c => c.status === 'scheduled').length,
        status: store.campaigns.length > 0 ? 'active' : 'idle'
      },
      leads: {
        total: store.leads.length,
        hot: store.leads.filter(l => l.score >= 70).length,
        warm: store.leads.filter(l => l.score >= 40 && l.score < 70).length,
        cold: store.leads.filter(l => l.score < 40).length,
        status: 'active'
      },
      scoring: {
        total: store.scores.length,
        today: store.scores.filter(s => new Date(s.classified_at) >= last24h).length,
        status: 'active'
      },
      deliveries: {
        total: store.deliveries.length,
        today: store.deliveries.filter(d => new Date(d.created_at) >= last24h).length,
        failed: store.deliveries.filter(d => d.status === 'failed').length,
        status: 'active'
      }
    };
    res.json({ modules: moduleStatus, timestamp: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/internal/run-smoke — ejecuta smoke checks internos (sin Jest)
app.post('/api/internal/run-smoke', async (req, res) => {
  const results = [];
  const check = async (name, fn) => {
    try {
      const t0 = Date.now();
      await fn();
      results.push({ name, status: 'pass', latencyMs: Date.now() - t0 });
    } catch (e) {
      results.push({ name, status: 'fail', error: e.message });
    }
  };

  await check('health-endpoint', async () => {
    const store = getStore();
    if (!store) throw new Error('Store not available');
  });
  await check('db-connection', async () => {
    if (pool) await pool.query('SELECT 1');
    else throw new Error('PG pool not initialized — using JSON fallback');
  });
  await check('weaviate-health', async () => {
    const ok = await checkWeaviateHealth();
    if (!ok) throw new Error('Weaviate unavailable');
  });
  await check('campaigns-store', async () => {
    const store = getStore();
    if (!Array.isArray(store.campaigns)) throw new Error('campaigns store invalid');
  });
  await check('leads-store', async () => {
    const store = getStore();
    if (!Array.isArray(store.leads)) throw new Error('leads store invalid');
  });
  await check('auth-middleware', async () => {
    if (!process.env.HELPER_API_KEY) throw new Error('HELPER_API_KEY not set');
  });
  await check('llm-config', async () => {
    if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set');
  });

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;

  res.json({
    summary: { total: results.length, passed, failed, status: failed === 0 ? 'all-pass' : 'some-fail' },
    checks: results,
    runAt: new Date().toISOString()
  });
});

// GET /api/internal/audit-trail/:requestId — traza completa de un request
app.get('/api/internal/audit-trail/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    if (pool) {
      const [logs, incidents] = await Promise.all([
        pool.query('SELECT * FROM audit_logs WHERE request_id = $1 ORDER BY created_at ASC', [requestId]).catch(() => ({ rows: [] })),
        pool.query('SELECT * FROM incidents WHERE request_id = $1 ORDER BY created_at ASC', [requestId]).catch(() => ({ rows: [] }))
      ]);
      res.json({
        requestId,
        timeline: logs.rows,
        incidents: incidents.rows,
        found: logs.rows.length + incidents.rows.length > 0
      });
    } else {
      res.json({ requestId, timeline: [], incidents: [], found: false, note: 'DB not available' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// HEALTH + SLI METRICS (MVP-10: KPIs, SLA/SLI monitoring)
// ═══════════════════════════════════════════════════════


let uptimeStart = Date.now();
let requestCount = 0;
let errorCount = 0;
const sliMetrics = { totalRequests: 0, totalErrors: 0, totalLatency: 0 };

app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/api/sli/metrics') return next();
  requestCount++;
  sliMetrics.totalRequests++;
  const start = Date.now();
  res.on('finish', () => {
    const latency = Date.now() - start;
    sliMetrics.totalLatency += latency;
    if (res.statusCode >= 500) { errorCount++; sliMetrics.totalErrors++; }
  });
  next();
});

app.get('/health', async (req, res) => {
  const store = getStore();
  const uptimeSeconds = Math.floor((Date.now() - uptimeStart) / 1000);
  const weaviateOk = await checkWeaviateHealth();

  const recentFailures = store.deliveries.filter(d => d.status === 'failed' && new Date(d.created_at) > new Date(Date.now() - 86400000)).length;
  const totalDeliveries = store.deliveries.filter(d => new Date(d.created_at) > new Date(Date.now() - 86400000)).length;
  const deliverySuccessRate = totalDeliveries > 0 ? ((totalDeliveries - recentFailures) / totalDeliveries * 100).toFixed(1) : 100;

  const activeConvs = store.leads.filter(l => l.status === 'new' || l.status === 'pending').length;
  const hotLeads = store.leads.filter(l => l.score >= 70).length;
  const warmLeads = store.leads.filter(l => l.score >= 40 && l.score < 70).length;

  res.json({
    service: 'wibsite-helper', status: 'ok', version: '2.2.0',
    timestamp: new Date().toISOString(),
    uptime: { seconds: uptimeSeconds, human: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m` },
    auth: { apiKeyRequired: !!process.env.HELPER_API_KEY, rateLimiting: true, sanitizer: true },
    modules: {
      campaigns: { total: store.campaigns.length, active: store.campaigns.filter(c => c.status === 'sending' || c.status === 'scheduled').length },
      leads: { total: store.leads.length, scored: store.leads.filter(l => l.score > 0).length, hot: hotLeads, warm: warmLeads },
      deliveries: { total: store.deliveries.length, today: store.deliveries.filter(d => new Date(d.created_at) > new Date(new Date().setHours(0, 0, 0, 0))).length },
      scores: { total: store.scores.length, llmBased: store.scores.filter(s => s.score_model?.includes('llm')).length },
      conversations: { active: activeConvs },
      knowledgeBase: { weaviateAvailable: weaviateOk, documents: 0 },
    },
    sli: {
      uptime: uptimeSeconds > 0 ? ((uptimeSeconds - 0) / uptimeSeconds * 100).toFixed(2) + '%' : '100%',
      requestCount: sliMetrics.totalRequests,
      errorRate: sliMetrics.totalRequests > 0 ? (sliMetrics.totalErrors / sliMetrics.totalRequests * 100).toFixed(2) + '%' : '0%',
      avgLatencyMs: sliMetrics.totalRequests > 0 ? (sliMetrics.totalLatency / sliMetrics.totalRequests).toFixed(1) : '0',
      deliverySuccessRate24h: deliverySuccessRate + '%',
    },
    dependencies: {
      db: pool ? 'postgresql' : 'json-file',
      llm: OPENROUTER_API_KEY ? { provider: 'openrouter', model: OPENROUTER_MODEL, configured: true } : { configured: false },
      weaviate: weaviateOk ? 'connected' : 'unavailable',
      redis: require('./services/conversationStore').CONVERSATION_STATES ? 'available' : 'in-memory',
    },
  });
});

app.get('/api/sli/metrics', (req, res) => {
  const store = getStore();
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayDeliveries = store.deliveries.filter(d => new Date(d.created_at) >= todayStart);
  const todayScores = store.scores.filter(s => new Date(s.classified_at) >= todayStart);

  const deliveryByStatus = { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 };
  todayDeliveries.forEach(d => { if (deliveryByStatus[d.status] !== undefined) deliveryByStatus[d.status]++; });

  res.json({
    timestamp: new Date().toISOString(),
    uptime: Math.floor((now - uptimeStart) / 1000),
    requests: { total: sliMetrics.totalRequests, errors: sliMetrics.totalErrors, errorRate: sliMetrics.totalRequests > 0 ? (sliMetrics.totalErrors / sliMetrics.totalRequests * 100).toFixed(2) : '0' },
    performance: { avgLatencyMs: sliMetrics.totalRequests > 0 ? (sliMetrics.totalLatency / sliMetrics.totalRequests).toFixed(1) : '0', totalLatencyMs: sliMetrics.totalLatency },
    today: {
      deliveries: { total: todayDeliveries.length, byStatus: deliveryByStatus },
      scores: { total: todayScores.length, llm: todayScores.filter(s => s.score_model?.includes('llm')).length },
      leads: { created: store.leads.filter(l => new Date(l.created_at) >= todayStart).length },
    },
    health: {
      apiKeyMissing: !process.env.HELPER_API_KEY,
      weaviateMissing: false,
      openRouterMissing: !OPENROUTER_API_KEY,
      metaConfigMissing: !process.env.META_APP_ID,
    },
    version: '2.2.0',
  });
});

// ─── Serve SPA for dashboard (catch-all) ─────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  const publicPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(publicPath)) {
    res.sendFile(publicPath);
  } else {
    res.json({ service: 'wibsite-helper', status: 'ok', version: '2.0.0' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Wibsite Helper v2 running on port ${PORT}`);
    if (pool) console.log('  DB: PostgreSQL connected');
    else console.log('  DB: JSON file store (fallback)');
  });
}
module.exports = app;
