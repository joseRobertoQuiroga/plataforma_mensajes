const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

const { authMiddleware, verifyMetaWebhookSignature, verifyTwilioWebhookSignature } = require('./middleware/auth');
const { createTenantContextMiddleware, queryWithTenant, getTenantId } = require('./middleware/tenantContext');
const { rateLimiter } = require('./middleware/rateLimiter');
const { sanitizerMiddleware, normalizationMiddleware } = require('./middleware/sanitizer');
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
const { getAgentConfig, updateAgentConfig, buildSystemPrompt, BUSINESS_TYPES, PERSONALITY_TYPES } = require('./services/agentConfig');
const agentKnowledge = require('./services/agentKnowledge');
const agentRegistry = require('./services/agentRegistry');
const mediaProcessor = require('./services/mediaProcessor');
const { addDocument, queryKnowledgeBase, deleteDocument, listDocuments, checkWeaviateHealth, addInMemoryDocument, queryInMemoryKB } = require('./services/ragEngine');
const { 
  initRedis, closeRedis, checkRedisHealth, createConversationState, 
  getConversationState, transitionState, incrementMessageCount, deleteConversationState, listActiveConversations, 
  isValidTransition, CONVERSATION_STATES, STATE_LABELS,
  initConvArchivePool, runArchiveJob, getArchivedByPhone, getArchivedByLeadId,
} = require('./services/conversationStore');
const chatGroups = require('./services/chatGroups');
const { runScheduledScoreDecay } = require('./services/scoreDecay');
const { runScheduledDeduplication } = require('./services/deduplicator');
const { executeTestGraph, executeCommercialGraph } = require('./services/agentCore');
const checkpointer = require('./services/agentCore/checkpointer');
const templateEngine = require('./services/templateEngine');
const { tracingMiddleware } = require('./services/otelBridge');

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ GlitchTip / Sentry Error Tracking Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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


// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Request ID Middleware (FIRST Ã¢â‚¬â€ needed for full traceability) Ã¢â€â‚¬
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ OpenTelemetry tracing (span raÃƒÂ­z por request, traza E2E en Elastic) Ã¢â€â‚¬
app.use(tracingMiddleware);

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Security Middleware Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.use(authMiddleware);
app.use(rateLimiter);
app.use(sanitizerMiddleware);
app.use(normalizationMiddleware);
app.use(sanitizeMiddleware);
app.use(createAuditMiddleware('api_call'));
app.use(errorTrackerMiddleware()); // auto-tracks 500 errors with full context
app.use('/webhooks', verifyMetaWebhookSignature);
app.use(verifyTwilioWebhookSignature);

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Multi-Tenant Context (se inicializa despuÃƒÂ©s del pool PG) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// La funciÃƒÂ³n initTenantMiddleware() se llama en el bloque de DB init
let tenantContextMiddleware = (req, res, next) => next(); // placeholder until DB ready

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Metrics endpoint (prom-client) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
  promCounters.uiE2eTotal = new promClient.Counter({
    name: 'ui_e2e_total', help: 'Total UI E2E test results (Playwright)',
    labelNames: ['spec', 'result']
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


// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ DB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ File upload middleware (Excel/CSV) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ KB documents: carga de la base de conocimiento en el arranque (RAG R2) Ã¢â€â‚¬
function loadKbFromDisk() {
  const kbDir = path.join(__dirname, 'kb-documents');
  try {
    if (!fs.existsSync(kbDir)) return;
    const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(kbDir, file), 'utf-8').trim();
        if (content) addInMemoryDocument('default', file.replace(/\.(txt|md)$/i, ''), content, file);
      } catch (e) { console.warn(`  KB file ${file} error:`, e.message); }
    }
    console.log(`  RAG KB: ${files.length} documento(s) cargado(s) en memoria`);
  } catch (e) { /* KB opcional */ }
}
loadKbFromDisk();

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Initialize services after DB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
initRedis().then(() => console.log('  Conversation store: Redis/In-Memory ready'))  .catch(e => {
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
initConvArchivePool(pool);  // D11: habilita archivado de conversaciones Ã¢â€ â€™ PG
console.log(`  Store mode: ${storeFacade.getStoreMode()}`);
console.log(`  Error tracker: initialized (${pool ? 'PostgreSQL' : 'in-memory fallback'})`);
console.log(`  Checkpointer (F-14): conversation_summaries ${pool ? 'PostgreSQL' : 'in-memory fallback'}`);
console.log(`  Conv archiver (D11): ${pool ? 'PostgreSQL' : 'disabled (no pool)'}`);

// D11: archive job Ã¢â‚¬â€ corre cada hora para no perder convs por TTL Redis
if (pool) {
  const ARCHIVE_INTERVAL_MS = Number(process.env.CONV_ARCHIVE_INTERVAL_MS) || 3600000; // 1h
  setInterval(async () => {
    try { await runArchiveJob(); } catch (e) { console.error('[ConvStore] archive job error:', e.message); }
  }, ARCHIVE_INTERVAL_MS).unref();
}


// K1: Deduplicacion programada (cada 24h)
const DEDUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
setInterval(async () => {
  try { await runScheduledDeduplication(); } catch (e) { console.error('[Dedup] job error:', e.message); }
}, DEDUP_INTERVAL_MS).unref();

// L5: Score Decay (cada 24h)
setInterval(async () => {
  try { await runScheduledScoreDecay(); } catch (e) { console.error('[Decay] job error:', e.message); }
}, DEDUP_INTERVAL_MS).unref();



// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Multi-Tenant Context Middleware (FASE 8) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Ahora que tenemos el pool, inicializamos el middleware real
tenantContextMiddleware = createTenantContextMiddleware(pool);
// Registrar globalmente: todas las rutas tendrÃƒÂ¡n req.tenantId disponible
app.use(tenantContextMiddleware);
console.log('  Tenant context: middleware registered (pool-aware)');

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ JSON File Store (vÃƒÂ­a facade unificado services/store.js) Ã¢â€â‚¬
// Las funciones locales delegan al facade para evitar caches duplicados
function getStore() { return storeFacade.getStore(); }
function updateStore(mutator) { return storeFacade.updateStore(mutator); }

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// CAMPAIGNS
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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
await updateStore(s => s.campaigns.push(c));
    await storeFacade.writeCampaignToPg(c);
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// AGENT CORE - Test Graph
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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
    const { template_id, client_id, message, conversationId, agent_id, mediaUrl, mediaType, audioBase64 } = req.body;
    if (!message && !mediaUrl && !audioBase64) return res.status(400).json({ error: 'El campo message (o media/audio) es requerido' });
    const template = templateEngine.loadTemplate(template_id || 'default');
    let clientConfig = null;
    if (client_id) clientConfig = templateEngine.loadClientConfig(client_id);

    // 1. Perfil del agente seleccionado (multi-agente)
    const store = getStore();
    const agent = agent_id ? agentRegistry.getAgent(agent_id, store) : agentRegistry.getActiveAgent(store);
    if (agent) {
      template.meta = {
        ...(template.meta || {}),
        agent_name: agent.name,
        agent_personality: PERSONALITY_TYPES[agent.personality]?.label || agent.personality,
        agent_instructions: PERSONALITY_TYPES[agent.personality]?.instructions || '',
        agent_tone: agent.tone,
      };
      template.agent_profile = {
        name: agent.name,
        personality: agent.personality,
        tone: agent.tone,
        business_type: agent.business_type,
        auto_reply_enabled: agent.auto_reply_enabled,
      };
    }

    // 2. Conocimiento cargado por el usuario (lotes) Ã¢â€ â€™ contexto del agente
    const knowledgeContext = agentKnowledge.buildKnowledgeContext(store);
    if (knowledgeContext) {
      template.industry_knowledge = (template.industry_knowledge || '')
        + (template.industry_knowledge ? '\n' : '')
        + knowledgeContext;
      const productBatches = agentKnowledge.listKnowledge(store).filter(k => k.type === 'producto');
      if (productBatches.length) {
        const products = (template.products || []);
        for (const batch of productBatches) {
          const name = batch.items[0] || batch.title;
          if (!products.some(p => p.name === name)) {
            products.push({
              name,
              description: batch.content || batch.title,
              price: batch.items[1] || 'consultar precio',
            });
          }
        }
        template.products = products;
      }
    }

    // 3. Multimodal: imagen Ã¢â€ â€™ descripciÃƒÂ³n de visiÃƒÂ³n; audio Ã¢â€ â€™ transcripciÃƒÂ³n STT
    let augmented = String(message || '');
    const conversationIdUsed = conversationId || crypto.randomUUID();
    if (mediaUrl) {
      const description = await mediaProcessor.describeImage({
        url: mediaUrl,
        prompt: 'Describe esta imagen en detalle para una conversaciÃƒÂ³n de ventas: quÃƒÂ© contiene, texto legible, contexto comercial.',
        conversationId: conversationIdUsed,
      }).catch(() => null);
      if (description) {
        augmented = `[El cliente enviÃƒÂ³ una imagen. DescripciÃƒÂ³n de visiÃƒÂ³n: ${description}]\n${augmented}`;
      } else {
        augmented = `[El cliente enviÃƒÂ³ una imagen (${mediaType || 'adjunto'})]\n${augmented}`;
      }
    }
    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const transcript = await mediaProcessor.transcribeAudio({
        buffer: audioBuffer, filename: 'voice.webm', language: 'es',
        conversationId: conversationIdUsed,
      }).catch(() => null);
      if (transcript) {
        augmented = `[El cliente enviÃƒÂ³ un audio. TranscripciÃƒÂ³n: ${transcript}]\n${augmented}`;
      } else {
        augmented = `[El cliente enviÃƒÂ³ un audio (sin transcripciÃƒÂ³n disponible)]\n${augmented}`;
      }
    }

    const result = await executeCommercialGraph({
      message: augmented || 'Hola',
      conversationId: conversationIdUsed,
      tenantId: req.tenantId || 'default',
      template,
      clientConfig,
    });
    res.json({ ...result, agent: agent ? { id: agent.id, name: agent.name, personality: agent.personality, tone: agent.tone } : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// TEMPLATE ENGINE
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// AUDIT LOGS
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// LEADS (Campaign recipients)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

app.post('/api/campaigns/:id/leads', async (req, res) => {
  try {
    const campaignExists = getStore().campaigns.some(c => c.id === req.params.id);
    if (!campaignExists) return res.status(404).json({ error: 'Campaign not found' });
    const leads = Array.isArray(req.body) ? req.body : [req.body];
    const created = [];
    await updateStore(s => {
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
    for (const lead of created) {
      await storeFacade.writeLeadToPg(req.params.id, lead);
    }
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// EXCEL/CSV UPLOAD
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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
      phone: headers.find(h => /^(phone|tel|telefono|celular|cel|movil|mÃƒÂ³vil|whatsapp)$/i.test(h)),
      name: headers.find(h => /^(name|nombre|full_name|cliente|contacto)$/i.test(h)),
      email: headers.find(h => /^(email|e-mail|correo|mail)$/i.test(h)),
    };

    const created = [];
    const errors = [];
    const duplicates = [];

    await updateStore(s => {
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

    for (const lead of created) {
      await storeFacade.writeLeadToPg(campaignId, lead);
    }

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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// TRACKING
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// LEGACY v1 ENDPOINTS (compatibilidad n8n Ã¢â‚¬â€ sin /api/)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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
    await storeFacade.writeCampaignToPg(c);
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// LEAD SCORING
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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
    await updateStore(s => {
      s.scores.push(scoreEntry);
      // Update lead score
      const lead = s.leads.find(l => l.id === lead_id);
      if (lead) {
        lead.score = score || 0; lead.score_data = score_factors || {};
      }
      // Update delivery score
      const delivery = s.deliveries.find(d => d.contact_id === lead_id);
      if (delivery) delivery.score = score || 0;
    });
    await storeFacade.writeScoreToPg(scoreEntry);
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// LEAD PROFILE (MVP-03: ExtracciÃƒÂ³n y actualizaciÃƒÂ³n de leads)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

app.get('/api/leads/:id/profile', async (req, res) => {
  try {
    const store = getStore();
    const profile = buildLeadProfile(req.params.id, store);
    if (!profile) return res.status(404).json({ error: 'Lead not found' });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// CHANNEL STATUS (LED indicators)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

app.get('/api/channels', async (req, res) => {
  try {
    const store = getStore();
    const channels = store.channels.length > 0 ? store.channels : [
      { channel: 'whatsapp', status: 'pending', status_message: 'Esperando configuraciÃƒÂ³n de Meta', last_checked_at: null, error_count: 0 },
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// OPT-OUT
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

app.post('/api/opt-outs', async (req, res) => {
  try {
    const { phone, email, channel, reason, source } = req.body;
    let createdEntry = null;
    await updateStore(s => {
      const existing = s.optOuts.findIndex(o => o.phone === phone || o.email === email);
      if (existing >= 0) {
        s.optOuts[existing].reason = reason || s.optOuts[existing].reason;
        s.optOuts[existing].updated_at = new Date().toISOString();
      } else {
        createdEntry = {
          id: s.optOuts.length + 1,
          phone: phone || null,
          email: email || null,
          channel: channel || 'whatsapp',
          reason: reason || null,
          source: source || 'user_reply',
          created_at: new Date().toISOString(),
        };
        s.optOuts.push(createdEntry);
      }
      // Mark campaign leads as opted_out
      if (phone) {
        s.leads.filter(l => l.phone === phone).forEach(l => { l.status = 'opted_out'; });
      }
    });
    if (createdEntry) await storeFacade.writeOptOutToPg(createdEntry);
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// LEAD SCORING ENGINE (rule-based)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Shared scoring logic (used by evaluate + evaluate-all) Ã¢â€â‚¬
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

// Evaluate all leads (uses shared logic Ã¢â‚¬â€ fixed #1, #2, #11)
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

// Auto-scoring trigger desde el pipeline nativo (Wibsite 2.0)
app.post('/api/scoring/trigger-inbound', async (req, res) => {
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
        updateStore(s => {
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Campaign: auto-activate scheduled campaigns (on health check or endpoint)
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Campaign: delivery details per lead
app.get('/api/campaigns/:id/leads/:leadId/deliveries', async (req, res) => {
  try {
    const store = getStore();
    const lead = store.leads.find(l => l.id === req.params.leadId && l.campaign_id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found in campaign' });
    const deliveries = store.deliveries.filter(d => d.campaign_id === req.params.id && (d.contact_id === lead.id || d.contact_id === lead.phone));
    res.json({ lead_id: lead.id, lead_name: lead.name, total: deliveries.length, deliveries: deliveries.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Opt-out: pre-check before sending (middleware for n8n)
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

// =========================================================================
// COMPANIES CRUD
// =========================================================================

app.get('/api/companies', async (req, res) => {
  try {
    const store = getStore();
    res.json(store.companies || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/companies', async (req, res) => {
  try {
    const { name, domain, industry } = req.body;
    if (!name) return res.status(400).json({ error: 'name requerido' });
    
    const company = {
      id: crypto.randomUUID(),
      tenant_id: getTenantId(req) || 'default',
      name, domain, industry,
      created_at: new Date().toISOString()
    };
    
    await updateStore(store => {
      if (!store.companies) store.companies = [];
      store.companies.push(company);
    });
    
    res.status(201).json(company);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/companies/:id', async (req, res) => {
  try {
    let updated = null;
    await updateStore(store => {
      const idx = (store.companies || []).findIndex(c => c.id === req.params.id);
      if (idx !== -1) {
        store.companies[idx] = { ...store.companies[idx], ...req.body, id: store.companies[idx].id };
        updated = store.companies[idx];
      }
    });
    if (!updated) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/companies/:id', async (req, res) => {
  try {
    let deleted = false;
    await updateStore(store => {
      const idx = (store.companies || []).findIndex(c => c.id === req.params.id);
      if (idx !== -1) {
        store.companies.splice(idx, 1);
        deleted = true;
      }
    });
    if (!deleted) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â€”â€”â€” Auto-transition scheduled campaigns (called from health + dashboard)
app.post('/api/campaigns/auto-activate', async (req, res) => {
  try {
    const store = getStore();
    const count = activateScheduledCampaigns(store);
    res.json({ activated: count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// â€”â€”â€” Dashboard: trends data for charts
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Dashboard summary
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// LEADS CRUD (Individual)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

// Lista de leads con filtros (Wibsite 2.0)
app.get('/api/leads', async (req, res) => {
  try {
    const store = getStore();
    const { search: q, status, channel, min_score, limit = 200 } = req.query;
    let items = [...store.leads];
    if (q) {
      const needle = String(q).toLowerCase().trim();
      items = items.filter(l => [l.name, l.phone, l.email, l.source, l.id]
        .filter(Boolean).some(f => String(f).toLowerCase().includes(needle)));
    }
    if (status) items = items.filter(l => String(l.status || 'new').toLowerCase() === String(status).toLowerCase());
    if (channel) {
      items = items.filter(l => (l.source || l.custom_fields?.channel || 'web').toLowerCase().includes(String(channel).toLowerCase()));
    }
    if (min_score !== undefined) items = items.filter(l => (l.score || 0) >= parseInt(min_score));
    items.sort((a, b) => (b.score || 0) - (a.score || 0));
    res.json(items.slice(0, parseInt(limit)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Crear lead manual (Wibsite 2.0 Ã¢â‚¬â€ pipeline FAB, importaciÃƒÂ³n, API)
app.post('/api/leads', async (req, res) => {
  try {
    const { name, phone, email, status, source, campaign_id, custom_fields, company_id, user_tags } = req.body;
    if (!name && !phone && !email) return res.status(400).json({ error: 'name, phone o email requeridos' });
    const lead = {
      id: crypto.randomUUID(),
      campaign_id: campaign_id || null,
      company_id: company_id || null,
      contact_id: null,
      name: name || phone || 'Desconocido',
      phone: phone || null,
      email: email || null,
      source: source || 'manual',
      status: normalizeStage(status),
      score: 0,
      score_data: {},
      custom_fields: custom_fields || {},
      user_tags: user_tags || [],
      notes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await updateStore(s => s.leads.push(lead));
    if (lead.campaign_id) {
       // write to pg
       const pgStore = require('./services/pgStore');
       if(pgStore.LeadStore) pgStore.LeadStore.create(lead).catch(()=>{});
    }
    await logEvent('lead_created', {
      level: 'info', message: 'Lead creado manualmente: ' + lead.name,
      tenantId: req.tenantId || 'default', module: 'leads', flow: 'leads.manual', action: 'lead.created',
      metadata: { lead_id: lead.id, status: lead.status }
    });
    res.status(201).json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// --- DEDUPLICACION K1 ---
app.post('/api/leads/deduplicate', async (req, res) => {
  try {
    const result = await runScheduledDeduplication();
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });

// D3: Pipeline configurable por tenant
const DEFAULT_PIPELINE_STAGES = [
  { id: 'primer_contacto', label: '1° Contacto', color: 'primary' },
  { id: 'primer_mensaje', label: '1° Mensaje', color: 'blue' },
  { id: 'interesado', label: 'Interesado', color: 'secondary' },
  { id: 'cotizacion_pendiente', label: 'Cotización Pend.', color: 'tertiary' },
  { id: 'posible_comprador', label: 'Posible Comprador', color: 'warning' },
  { id: 'comprador', label: 'Comprador', color: 'success' },
  { id: 'descartado', label: 'Descartado', color: 'error' },
  { id: 'opt_out', label: 'Opt-Out', color: 'gray' }
];

// In-memory per-tenant pipeline config store (MVP: replaced by PG later)
const pipelineConfigs = {};

app.get('/api/pipeline/config', (req, res) => {
  const tenantId = req.tenantId || 'default';
  res.json({ stages: pipelineConfigs[tenantId] || DEFAULT_PIPELINE_STAGES });
});

app.put('/api/pipeline/config', (req, res) => {
  const tenantId = req.tenantId || 'default';
  const { stages } = req.body;
  if (!Array.isArray(stages) || stages.length === 0) return res.status(400).json({ error: 'stages[] required' });
  pipelineConfigs[tenantId] = stages;
  res.json({ ok: true, stages });
});

  }
});
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
    const allowed = ['name', 'phone', 'email', 'custom_fields', 'status', 'company_id', 'is_favorite', 'user_tags']; // K6 + K4
    let updated = null;
    let transitionError = null;
    let oldStatus = null;
    let newStatus = null;

    await updateStore(s => {
      const l = s.leads.find(l => l.id === req.params.id);
      if (!l) return;
      
      oldStatus = normalizeStage(l.status);

      for (const k of allowed) {
        if (req.body[k] !== undefined) {
          if (k === 'status') {
            const requestedStatus = normalizeStage(req.body.status);
            if (!req.body.force_transition && !isValidTransition(oldStatus, requestedStatus)) {
              transitionError = 'Transicion invalida de ' + oldStatus + ' a ' + requestedStatus;
              return; 
            }
            l[k] = requestedStatus;
            newStatus = requestedStatus;
          } else {
            l[k] = req.body[k];
          }
        }
      }
      
      if (transitionError) return;

      if (req.body.notes !== undefined) {
        if (!Array.isArray(l.notes)) l.notes = [];
        l.notes.push({ text: String(req.body.notes), at: new Date().toISOString(), by: req.body.notes_by || 'agente' });
      }
      if (Array.isArray(req.body.notes_replace)) l.notes = req.body.notes_replace;
      l.updated_at = new Date().toISOString();
      updated = l;
    });

    if (transitionError) return res.status(400).json({ error: transitionError });
    if (!updated) return res.status(404).json({ error: 'Lead not found' });

    if (newStatus && newStatus !== oldStatus && global.pool) {
      global.pool.query(
        'INSERT INTO lead_stage_history (lead_id, tenant_id, old_stage, new_stage, changed_by, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [updated.id, req.tenantId || 'default', oldStatus, newStatus, req.body.changed_by || 'system', req.body.reason || 'manual']
      ).catch(e => console.error('[LeadStages] Error logging history:', e.message));
    }

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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// CAMPAIGN EXPORT
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// WEBHOOKS (WhatsApp Meta)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'wibsite_verify_2026';
  if (mode === 'subscribe' && token === expectedToken) return res.status(200).send(challenge);
  res.status(403).send('Verification failed');
});

app.post('/webhooks/whatsapp', async (req, res) => {
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
          const optEntry = { phone: msg.from, channel: 'whatsapp', reason: 'User replied STOP', source: 'user_reply', created_at: new Date().toISOString() };
          await updateStore(s => {
            s.optOuts.push(optEntry);
          });
          await storeFacade.writeOptOutToPg(optEntry);
        } else if (msg.type === 'text') {
          const contact = value.contacts?.[0];
          const profileName = contact?.profile?.name || 'Desconocido';
          const waId = msg.from;
          const textBody = msg.text?.body || '';
          let inboundLead = null;
          await updateStore(s => {
            const existing = s.leads.find(l => l.phone === waId);
            if (!existing) {
              const campaign = s.campaigns.find(c => c.channel === 'whatsapp' && c.status === 'sending');
              inboundLead = {
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
              s.leads.push(inboundLead);
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
          if (inboundLead) await storeFacade.writeLeadToPg(inboundLead.campaign_id, inboundLead);
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// CONVERSATION STATE (MVP-02: Memoria de conversaciÃƒÂ³n)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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


// --- D11: Conversation Archive endpoints ---
app.get('/api/conversations/archive/phone/:phone', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await getArchivedByPhone(req.params.phone, limit);
    res.json({ data: history, total: history.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/conversations/archive/lead/:leadId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await getArchivedByLeadId(req.params.leadId, limit);
    res.json({ data: history, total: history.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/conversations/archive/run', async (req, res) => {
  try {
    const result = await runArchiveJob();
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// GRUPOS DE CHAT (agrupaciÃƒÂ³n manual + clasificaciÃƒÂ³n IA)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

app.get('/api/chat-groups', (req, res) => {
  try {
    const groups = chatGroups.listGroups();
    res.json({ groups, total: groups.length, pendingGroupId: chatGroups.PENDING_GROUP_ID });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/leads/:id/groups', (req, res) => {
  try {
    const groups = chatGroups.getLeadGroups(req.params.id);
    res.json({ groups });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/leads/:id/groups', (req, res) => {
  try {
    const { groupId } = req.body;
    const groups = chatGroups.assignLead(req.params.id, groupId);
    res.json({ success: true, groups });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/leads/:id/groups/:groupId', (req, res) => {
  try {
    const groups = chatGroups.removeLeadFromGroup(req.params.id, req.params.groupId);
    res.json({ success: true, groups });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chat-groups', async (req, res) => {
  try {
    const group = await chatGroups.createGroup(req.body || {});
    res.status(201).json(group);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.put('/api/chat-groups/:groupId', async (req, res) => {
  try {
    const group = await chatGroups.updateGroup(req.params.groupId, req.body || {});
    res.json(group);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.delete('/api/chat-groups/:groupId', async (req, res) => {
  try {
    const result = await chatGroups.deleteGroup(req.params.groupId);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.put('/api/conversations/:tenantId/:conversationId/group', async (req, res) => {
  try {
    const { groupId } = req.body || {};
    if (!groupId) return res.status(400).json({ error: 'groupId is required' });
    const result = await chatGroups.assignConversation(req.params.tenantId, req.params.conversationId, groupId, { source: 'manual' });
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/chat-groups/review', async (req, res) => {
  try {
    const { tenantId, conversationId } = req.body || {};
    if (!tenantId || !conversationId) return res.status(400).json({ error: 'tenantId and conversationId are required' });
    const result = await chatGroups.reviewConversation(tenantId, conversationId);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/chat-groups/review-pending', async (req, res) => {
  try {
    const { tenantId } = req.body || {};
    const result = await chatGroups.reviewPending({ tenantId });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// NORMALIZACIÃƒâ€œN DE MENSAJES (pipeline nativo Wibsite 2.0)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// MESSAGE TEMPLATES
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

const DEFAULT_TEMPLATES = [
  {
    id: 'welcome-whatsapp',
    name: 'Bienvenida WhatsApp',
    channel: 'whatsapp',
    description: 'Mensaje de bienvenida para nuevos contactos',
    body: 'Hola {{name}}, gracias por contactarnos. Soy el asistente virtual de {{business}}. Ã‚Â¿En quÃƒÂ© puedo ayudarte hoy?',
    variables: ['name', 'business'],
    category: 'welcome',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'promo-whatsapp',
    name: 'PromociÃƒÂ³n WhatsApp',
    channel: 'whatsapp',
    description: 'Oferta especial para leads calientes',
    body: 'Ã‚Â¡Hola {{name}}! Tenemos una oferta especial para ti: {{offer}}. VÃƒÂ¡lido hasta {{expiry}}. Responde "QUIERO" para mÃƒÂ¡s info.',
    variables: ['name', 'offer', 'expiry'],
    category: 'promotion',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'followup-whatsapp',
    name: 'Seguimiento WhatsApp',
    channel: 'whatsapp',
    description: 'Recordatorio amable para leads que no han respondido',
    body: 'Hola {{name}}, solo querÃƒÂ­a recordarte que estamos aquÃƒÂ­ para lo que necesites. Ã‚Â¿Te gustarÃƒÂ­a agendar una llamada con nuestro equipo? Responde "SÃƒÂ" para coordinar.',
    variables: ['name'],
    category: 'followup',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'welcome-messenger',
    name: 'Bienvenida Messenger',
    channel: 'messenger',
    description: 'Mensaje inicial por Messenger',
    body: 'Ã‚Â¡Hola {{name}}! Ã°Å¸â€˜â€¹ Bienvenido a {{business}}. Estamos para ayudarte. CuÃƒÂ©ntanos, Ã‚Â¿quÃƒÂ© te interesa?',
    variables: ['name', 'business'],
    category: 'welcome',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'promo-messenger',
    name: 'Oferta Messenger',
    channel: 'messenger',
    description: 'Oferta con imagen/video para Messenger',
    body: 'Ã°Å¸â€Â¥ {{name}}, tenemos algo que te va a encantar: {{offer}}. Por tiempo limitado. Ã‚Â¿Quieres saber mÃƒÂ¡s?',
    variables: ['name', 'offer'],
    category: 'promotion',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'promo-tiktok',
    name: 'PromociÃƒÂ³n TikTok DM',
    channel: 'tiktok',
    description: 'Mensaje directo promocional en TikTok',
    body: 'Ã‚Â¡Hola {{name}}! Vimos que te interesa {{interest}}. Tenemos contenido exclusivo para ti en {{business}}. Ã‚Â¿Te gustarÃƒÂ­a recibir mÃƒÂ¡s info?',
    variables: ['name', 'interest', 'business'],
    category: 'promotion',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'followup-tiktok',
    name: 'Seguimiento TikTok',
    channel: 'tiktok',
    description: 'Engagement follow-up en TikTok',
    body: 'Hey {{name}}, gracias por seguirnos. Ã‚Â¿Te gustarÃƒÂ­a ser el primero en enterarte de nuestras novedades? Activa la campanita Ã°Å¸â€â€',
    variables: ['name'],
    category: 'followup',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'notification-sms',
    name: 'NotificaciÃƒÂ³n SMS',
    channel: 'sms',
    description: 'Alerta o notificaciÃƒÂ³n corta por SMS',
    body: '{{business}}: Hola {{name}}, {{message}}. MÃƒÂ¡s info: {{short_url}}',
    variables: ['name', 'business', 'message', 'short_url'],
    category: 'notification',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'promo-sms',
    name: 'PromociÃƒÂ³n SMS',
    channel: 'sms',
    description: 'Oferta corta por SMS (mÃƒÂ¡x 160 chars)',
    body: '{{name}}: Oferta {{offer}} en {{business}}. VÃƒÂ¡lido hoy. Responde INFO.',
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
    subject: '{{business}} Ã¢â‚¬â€ Novedades para {{name}}',
    body: 'Hola {{name}},\n\nEstas son las novedades de {{business}} este mes:\n\n{{content}}\n\nSaludos,\nEl equipo de {{business}}',
    variables: ['name', 'business', 'content'],
    category: 'newsletter',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'followup-email',
    name: 'Email Seguimiento',
    channel: 'email',
    description: 'Email de seguimiento post-demo/reuniÃƒÂ³n',
    subject: 'Gracias por tu interÃƒÂ©s, {{name}}',
    body: 'Hola {{name}},\n\nGracias por tu tiempo el {{meeting_date}}. Adjuntamos la informaciÃƒÂ³n que solicitaste:\n\n{{attachment_links}}\n\nQuedamos atentos a cualquier pregunta.\n\nSaludos,\n{{business}}',
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// AGENT CONFIG (MVP-04: Editor de contexto + Switcher)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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
    await updateStore(s => {
      updateAgentConfig(tenantId, req.body, s);
    });
    const store = getStore();
    const updated = getAgentConfig(tenantId, store);
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// AGENT KNOWLEDGE (Wibsite 2.0 Ã¢â‚¬â€ lotes de contexto cargados)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

app.get('/api/agent/knowledge', (req, res) => {
  try {
    const store = getStore();
    const { grouped } = req.query;
    if (grouped === 'true' || grouped === '1') {
      return res.json({ data: agentKnowledge.groupByDay(store), total: agentKnowledge.listKnowledge(store).length, types: agentKnowledge.KNOWLEDGE_TYPES });
    }
    res.json({ data: agentKnowledge.listKnowledge(store), total: agentKnowledge.listKnowledge(store).length, types: agentKnowledge.KNOWLEDGE_TYPES });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/agent/knowledge', async (req, res) => {
  try {
    const { type, title, content, items } = req.body;
    let created = null;
    await updateStore(s => { created = agentKnowledge.createKnowledge({ type, title, content, items }, s); });
    await logEvent('knowledge_loaded', {
      level: 'info', message: `Lote de conocimiento cargado: ${created.title}`,
      tenantId: req.tenantId || 'default', module: 'agent', flow: 'agent.knowledge', action: 'knowledge.loaded',
      data: { knowledge_id: created.id, type: created.type },
    });
    res.status(201).json(created);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.patch('/api/agent/knowledge/:id', async (req, res) => {
  try {
    let updated = null;
    await updateStore(s => { updated = agentKnowledge.updateKnowledge(req.params.id, req.body, s); });
    if (!updated) return res.status(404).json({ error: 'Lote no encontrado' });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/agent/knowledge/:id', async (req, res) => {
  try {
    let deleted = false;
    await updateStore(s => { deleted = agentKnowledge.deleteKnowledge(req.params.id, s); });
    if (!deleted) return res.status(404).json({ error: 'Lote no encontrado' });
    res.json({ status: 'deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// AGENT REGISTRY (Wibsite 2.0 Ã¢â‚¬â€ multi-agente)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

app.get('/api/agents', (req, res) => {
  try {
    const store = getStore();
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const config = getAgentConfig(tenantId, store);
    res.json({
      agents: agentRegistry.listAgents(store),
      activeAgentId: agentRegistry.getActiveAgent(store)?.id || null,
      active: config.auto_reply_enabled,
      current: config,
      businessTypes: Object.entries(BUSINESS_TYPES).map(([id, v]) => ({ id, ...v })),
      personalities: Object.entries(PERSONALITY_TYPES).map(([id, v]) => ({ id, ...v })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/agents', async (req, res) => {
  try {
    const { name, personality, tone, business_type, description } = req.body;
    let created = null;
    await updateStore(s => {
      created = agentRegistry.createAgent({ name, personality, tone, business_type, description }, s);
      if ((s.agents || []).length === 1) created.active = true;
    });
    await logEvent('agent_created', {
      level: 'info', message: `Agente creado: ${created.name}`,
      tenantId: req.tenantId || 'default', module: 'agent', flow: 'agent.registry', action: 'agent.created',
      data: { agent_id: created.id, name: created.name },
    });
    res.status(201).json(created);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/agents/:id', async (req, res) => {
  try {
    let updated = null;
    await updateStore(s => { updated = agentRegistry.updateAgent(req.params.id, req.body, s); });
    if (!updated) return res.status(404).json({ error: 'Agente no encontrado' });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/agents/:id', async (req, res) => {
  try {
    let deleted = false;
    await updateStore(s => { deleted = agentRegistry.deleteAgent(req.params.id, s); });
    if (!deleted) return res.status(404).json({ error: 'Agente no encontrado' });
    res.json({ status: 'deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/agents/:id/activate', async (req, res) => {
  try {
    let activated = null;
    await updateStore(s => { activated = agentRegistry.setActiveAgent(req.params.id, s); });
    if (!activated) return res.status(404).json({ error: 'Agente no encontrado' });
    res.json({ status: 'activated', agent: activated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// SEED DATA (mock para pruebas end-to-end)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

app.post('/api/seed', (req, res) => {
  try {
    const now = new Date();

    const firstNames = ['MarÃƒÂ­a', 'Carlos', 'Ana', 'Luis', 'SofÃƒÂ­a', 'Pedro', 'Laura', 'Jorge', 'Valentina', 'Diego', 'Gabriela', 'AndrÃƒÂ©s', 'Fernanda', 'Ricardo', 'Isabella'];
    const lastNames = ['GarcÃƒÂ­a', 'RodrÃƒÂ­guez', 'MartÃƒÂ­nez', 'LÃƒÂ³pez', 'HernÃƒÂ¡ndez', 'GonzÃƒÂ¡lez', 'PÃƒÂ©rez', 'MuÃƒÂ±oz', 'Rojas', 'DÃƒÂ­az', 'Silva', 'Vargas', 'Castro', 'Torres', 'Mendoza'];
    const interests = ['marketing digital', 'desarrollo web', 'e-commerce', 'IA', 'redes sociales', 'SEO', 'email marketing', 'chatbots', 'analÃƒÂ­tica', 'automatizaciÃƒÂ³n'];
    const painPoints = ['poco trÃƒÂ¡fico', 'baja conversiÃƒÂ³n', 'sin automatizaciÃƒÂ³n', 'altos costos', 'falta de leads', 'sin presencia digital', 'procesos manuales', 'poco engagement'];

    const camp1 = {
      id: crypto.randomUUID(), name: 'Lanzamiento WhatsApp Jul 2026',
      description: 'PromociÃƒÂ³n de lanzamiento para clientes premium',
      channel: 'whatsapp', message_template: 'Ã‚Â¡Hola {{name}}! Lanzamos {{product}} con 30% OFF. Usa cÃƒÂ³digo WIB30. VÃƒÂ¡lido hasta 31/07.',
      template_name: 'promo-whatsapp', audience_filter: { segment: 'premium' },
      status: 'sending', sent_count: 0, delivered_count: 0, read_count: 0, replied_count: 0, failed_count: 0, opt_out_count: 0,
      scheduled_at: null, started_at: new Date(now - 86400000).toISOString(),
      created_at: new Date(now - 172800000).toISOString(), updated_at: now.toISOString(),
    };
    const camp2 = {
      id: crypto.randomUUID(), name: 'CampaÃƒÂ±a Messenger Julio',
      description: 'Engagement para leads de Facebook',
      channel: 'messenger', message_template: 'Ã‚Â¡Hola {{name}}! Te tenemos una sorpresa Ã°Å¸Å½Â',
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
      { channel: 'whatsapp', status: 'connected', status_message: 'Conectado vÃƒÂ­a Meta API', last_checked_at: now.toISOString(), error_count: 0 },
      { channel: 'messenger', status: 'pending', status_message: 'Esperando configuraciÃƒÂ³n Meta', last_checked_at: now.toISOString(), error_count: 0 },
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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// OPENROUTER LLM (replaces xAI Grok)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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
        choices: [{ index: 0, message: { role: 'assistant', content: '[LLM offline - modo simulaciÃƒÂ³n] Mensaje recibido correctamente.' }, finish_reason: 'stop' }],
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

    const prompt = `EvalÃƒÂºa este lead de campaÃƒÂ±a de marketing y asigna un score de 0-100.
Responde SOLO con JSON: {"score": <0-100>, "reason": "<explicaciÃƒÂ³n breve>", "category": "hot|warm|cold"}

Datos del lead:
- Nombre: ${lead.name || 'Desconocido'}
- TelÃƒÂ©fono: ${lead.phone || 'N/A'}
- Email: ${lead.email || 'N/A'}
- Intereses: ${lead.custom_fields?.interest || 'N/A'}
- Punto de dolor: ${lead.custom_fields?.pain_point || 'N/A'}
- Segmento: ${lead.custom_fields?.segment || 'standard'}
- Estado actual: ${lead.status}
- Score actual (rule-based): ${lead.score}
- CampaÃƒÂ±a: ${campaign?.name || 'N/A'} (canal: ${campaign?.channel || 'N/A'})
- Historial de entregas: ${deliveries.length} eventos
- ÃƒÅ¡ltimo estado de entrega: ${deliveries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.status || 'sin entregas'}

Criterios:
- HOT (70-100): lead muy calificado, alta probabilidad de conversiÃƒÂ³n
- WARM (40-69): lead interesado, requiere seguimiento
- COLD (0-39): lead frÃƒÂ­o, necesita nurturing`;

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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// KNOWLEDGE BASE (MVP-05: RAG bÃƒÂ¡sico)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// TWILIO SEND (proxy to avoid credential exposure in n8n)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// TWILIO INBOUND WEBHOOK (reemplazo Meta hasta migraciÃƒÂ³n)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

app.post('/webhooks/twilio-inbound', async (req, res) => {
  try {
    const from = req.body.From || req.body.from;
    const body = req.body.Body || req.body.body;
    const messageSid = req.body.MessageSid || req.body.messageSid || `twilio_${Date.now()}`;
    if (!from || !body) return res.status(400).send('<Response></Response>');

    const phone = from.replace(/^whatsapp:/, '').replace(/[^\d+]/g, '');
    const profileName = req.body.ProfileName || req.body.profileName || phone;

    // 0. Opt-out: STOP/DETENER/BAJA marcan el lead como opt-out (cumplimiento WhatsApp)
    if (/^(stop|detener|baja|opt.?out)$/i.test(String(body).trim())) {
      const optEntry = { phone, channel: 'whatsapp', reason: 'User replied STOP', source: 'user_reply', created_at: new Date().toISOString() };
      await updateStore(s => {
        s.optOuts.push(optEntry);
        s.leads.filter(l => l.phone === phone).forEach(l => { l.status = 'opted_out'; l.opt_out = true; });
      });
      await storeFacade.writeOptOutToPg(optEntry);
      return res.type('text/xml').send('<Response></Response>');
    }

    // 1. Create lead + delivery in helper store
    let inboundLead = null;
    await updateStore(s => {
      const existing = s.leads.find(l => l.phone === phone);
      if (!existing) {
        const campaign = s.campaigns.find(c => ['whatsapp', 'sms'].includes(c.channel) && c.status === 'sending');
        inboundLead = {
          id: crypto.randomUUID(), campaign_id: campaign?.id || null,
          name: profileName, phone, email: '', source: 'twilio_inbound',
          status: 'new', score: 0, score_data: {},
          custom_fields: { message: body, source: 'twilio_webhook' },
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        s.leads.push(inboundLead);
      }
      s.deliveries.push({
        id: crypto.randomUUID(), campaign_id: null, contact_id: phone,
        contact_name: profileName, phone, status: 'received', channel: 'twilio',
        direction: 'inbound', content: body, message_id: messageSid,
        sent_at: new Date().toISOString(), created_at: new Date().toISOString(),
      });
    });
    if (inboundLead) await storeFacade.writeLeadToPg(inboundLead.campaign_id, inboundLead);

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

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// MULTICANAL WEBHOOKS (Email Ã‚Â· Telegram Ã‚Â· WhatsApp Ã‚Â· TikTok Ã‚Â· Messenger)
// Pipeline unificado: normalizar Ã¢â€ â€™ lead+delivery Ã¢â€ â€™ media (STT/vision) Ã¢â€ â€™ agente Ã¢â€ â€™ responder por el canal
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

const { getChannel, listChannels, sendToChannel } = require('./services/channels');
const { processMedia } = mediaProcessor;

async function handleInboundMessage(channel, normalized) {
  const adapter = getChannel(channel);
  if (!adapter || !normalized) return null;

  const { senderId, senderName, text, conversationId, media } = normalized;

  await logEvent('webhook_received', {
    level: 'info',
    message: `Mensaje entrante ${channel} de ${senderId}`,
    tenantId: 'default',
    conversationId,
    module: 'channels',
    flow: 'multicanal.inbound',
    action: 'webhook.received',
    data: { channel, senderId, hasMedia: (media || []).length > 0 },
  });

  let inboundLead = null;
  await updateStore(s => {
    const existing = s.leads.find(l => l.phone === senderId || l.email === senderId);
    if (!existing) {
      inboundLead = {
        id: crypto.randomUUID(),
        campaign_id: null,
        name: senderName || senderId,
        phone: channel === 'email' ? null : senderId,
        email: channel === 'email' ? senderId : null,
        source: `${channel}_inbound`,
        status: 'new',
        score: 0,
        score_data: {},
        custom_fields: { channel, media_count: (media || []).length },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      s.leads.push(inboundLead);
    }
    s.deliveries.push({
      id: crypto.randomUUID(),
      campaign_id: null,
      contact_id: senderId,
      contact_name: senderName || senderId,
      phone: channel === 'email' ? null : senderId,
      status: 'received',
      channel,
      direction: 'inbound',
      content: text,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  });
  if (inboundLead) await storeFacade.writeLeadToPg(null, inboundLead);

  // Bases multimodales: transcribir audio / describir imagen y aÃƒÂ±adir al contexto
  let agentInput = text || '';
  try {
    const mediaPieces = await processMedia(media || [], {
      resolveMediaUrl: typeof adapter.resolveMediaUrl === 'function' ? adapter.resolveMediaUrl : null,
      conversationId,
    });
    if (mediaPieces.length) {
      agentInput = `${agentInput}\n${mediaPieces.join('\n')}`;
      await logEvent('webhook_received', {
        level: 'info',
        message: `Media procesado (${channel}): ${mediaPieces.length} pieza(s)`,
        tenantId: 'default',
        conversationId,
        module: 'channels',
        flow: 'multicanal.media',
        action: 'media.processed',
        data: { channel, pieces: mediaPieces.length },
      });
    } else if ((media || []).length) {
      await logEvent('fallback_activated', {
        level: 'warn',
        message: `Media recibido (${channel}) sin procesar Ã¢â‚¬â€ STT/visiÃƒÂ³n no configurados o fallaron`,
        tenantId: 'default',
        conversationId,
        module: 'channels',
        flow: 'multicanal.media',
        action: 'media.degraded',
        severity: 'medium',
        dependency: 'mediaProcessor',
        data: { channel, media_count: media.length },
      });
    }
  } catch (e) { /* media best-effort */ }

  // Agente comercial (grafo 8 etapas) Ã¢â‚¬â€ responde por el mismo canal
  try {
    let template = null;
    try { template = templateEngine.loadTemplate(process.env.AGENT_TEMPLATE_ID || 'consultora-software'); }
    catch (e) { template = templateEngine.loadTemplate('default'); }
    const currentStore = getStore();
    const currentLead = inboundLead || currentStore.leads.find(l => l.phone === senderId || l.email === senderId);
    const result = await executeCommercialGraph({
      message: agentInput,
      conversationId,
      tenantId: 'default',
      template,
      clientConfig: null,
      lead: currentLead || null,
      store: currentStore,
    });
    const reply = result?.response || 'Ã‚Â¡Gracias por tu mensaje! Te contactaremos a la brevedad.';
    const sent = await sendToChannel(channel, normalized.chatId || senderId, reply);

    // Respuesta por voz (G-37): si el mensaje entrante fue de voz y el modo lo permite,
    // sintetizar la respuesta y enviarla como nota de voz (Telegram)
    let voiceSent = { ok: false, skipped: true };
    const replyAudioMode = (process.env.REPLY_AUDIO_MODE || 'on_demand').toLowerCase();
    const hasInboundAudio = (media || []).some(m => ['voice', 'audio', 'video_note'].includes(m.type));
    try {
      if (hasInboundAudio && replyAudioMode !== 'off' && channel === 'telegram' && typeof adapter.sendVoice === 'function') {
        const speech = await mediaProcessor.synthesizeSpeech({ text: reply, conversationId });
        if (speech) {
          voiceSent = await (async () => {
            try {
              const r = await adapter.sendVoice({ to: normalized.chatId || senderId, audioBuffer: speech.buffer, filename: `reply.${speech.format || 'mp3'}`, caption: '' });
              return { ok: true, result: r, skipped: false };
            } catch (e) {
              return { ok: false, error: e.message, skipped: false };
            }
          })();
        }
      }
    } catch (e) { voiceSent = { ok: false, error: e.message, skipped: false }; }

    if (voiceSent && !voiceSent.skipped) {
      await logEvent(voiceSent.ok ? 'api_call' : 'error', {
        level: voiceSent.ok ? 'info' : 'warn',
        message: voiceSent.ok ? `Respuesta de voz enviada a ${senderId}` : `Respuesta de voz fallÃƒÂ³: ${voiceSent.error}`,
        tenantId: 'default',
        conversationId,
        module: 'channels',
        flow: 'multicanal.outbound',
        action: 'channel.voice_reply',
        severity: voiceSent.ok ? null : 'medium',
        dependency: `${channel}-tts`,
        data: { channel, ok: voiceSent.ok, error: voiceSent.ok ? null : voiceSent.error },
      });
    }

    await logEvent('api_call', {
      level: sent.ok ? 'info' : 'warn',
      message: `Respuesta ${channel} a ${senderId} Ã¢â€ â€™ ${sent.ok ? 'enviada' : sent.error}`,
      tenantId: 'default',
      conversationId,
      module: 'channels',
      flow: 'multicanal.outbound',
      action: 'channel.reply',
      severity: sent.ok ? null : 'medium',
      dependency: `${channel}-api`,
      data: { channel, ok: sent.ok, stage: result?.stage || null, error: sent.ok ? null : sent.error },
    });
    return { sent, agent: result };
  } catch (e) {
    await logEvent('webhook_failed', {
      level: 'error',
      message: `Pipeline multicanal fallÃƒÂ³ (${channel}): ${e.message}`,
      tenantId: 'default',
      conversationId,
      module: 'channels',
      flow: 'multicanal.inbound',
      action: 'pipeline.error',
      severity: 'high',
      dependency: 'agentCore',
      data: { channel, error: e.message },
    });
    return null;
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Telegram Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get('/webhooks/telegram', async (req, res) => {
  const adapter = getChannel('telegram');
  const token = adapter?.WEBHOOK_SECRET || '';
  if (token && req.query.secret !== token) return res.status(403).json({ error: 'Secret invÃƒÂ¡lido' });
  res.json({ ok: true, channel: 'telegram', configured: adapter?.isConfigured() || false });
});

app.post('/webhooks/telegram', async (req, res) => {
  try {
    const adapter = getChannel('telegram');
    if (!adapter) return res.status(500).json({ error: 'Adapter telegram no disponible' });
    const secret = adapter.WEBHOOK_SECRET;
    if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
      await logEvent('security_alert', {
        level: 'security',
        message: 'Webhook telegram con secret_token invÃƒÂ¡lido rechazado',
        tenantId: 'default',
        module: 'channels',
        flow: 'multicanal.inbound',
        action: 'webhook.rejected',
        severity: 'high',
        data: { channel: 'telegram' },
      });
      return res.status(403).json({ error: 'Secret invÃƒÂ¡lido' });
    }
    if (!adapter.isConfigured()) {
      console.warn('[telegram] TELEGRAM_BOT_TOKEN no configurado Ã¢â‚¬â€ pipeline degradado (sin reply)');
    }
    const normalized = await adapter.normalizeUpdate(req.body);
    if (!normalized) return res.status(200).json({ ok: true, skipped: true });
    await handleInboundMessage('telegram', normalized);
    res.json({ ok: true });
  } catch (e) {
    console.error('[telegram] webhook error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Messenger (Meta) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get('/webhooks/messenger', (req, res) => {
  const adapter = getChannel('messenger');
  const token = adapter?.VERIFY_TOKEN || '';
  if (!token) return res.status(503).json({ error: 'MESSENGER_VERIFY_TOKEN no configurado' });
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === token) {
    return res.status(200).send(req.query['hub.challenge'] || '');
  }
  res.status(403).send('Verification failed');
});

app.post('/webhooks/messenger', async (req, res) => {
  try {
    const adapter = getChannel('messenger');
    if (!adapter) return res.status(500).json({ error: 'Adapter messenger no disponible' });
    if (!adapter.isConfigured()) {
      console.warn('[messenger] MESSENGER_PAGE_TOKEN no configurado Ã¢â‚¬â€ pipeline degradado (sin reply)');
    }
    const normalized = await adapter.normalizeUpdate(req.body);
    if (!normalized) return res.status(200).json({ ok: true, skipped: true });
    await handleInboundMessage('messenger', normalized);
    res.json({ ok: true });
  } catch (e) {
    console.error('[messenger] webhook error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Email (inbound provider-agnÃƒÂ³stico) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post('/webhooks/email-inbound', async (req, res) => {
  try {
    const adapter = getChannel('email');
    const normalized = await adapter.normalizeUpdate(req.body);
    if (!normalized) return res.status(400).json({ error: 'Payload de email no reconocido' });
    await handleInboundMessage('email', normalized);
    res.json({ ok: true });
  } catch (e) {
    console.error('[email] webhook error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ TikTok (comentarios, vÃƒÂ­a agregador/API aprobada) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.post('/webhooks/tiktok-comments', async (req, res) => {
  try {
    const adapter = getChannel('tiktok');
    const normalized = await adapter.normalizeUpdate(req.body);
    if (!normalized) return res.status(400).json({ error: 'Payload de TikTok no reconocido' });
    await handleInboundMessage('tiktok', normalized);
    res.json({ ok: true });
  } catch (e) {
    console.error('[tiktok] webhook error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Estado + prueba manual de canales Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get('/api/channels/status', async (req, res) => {
  res.json({ data: listChannels() });
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Resultados E2E de UI (Playwright Ã¢â€ â€™ SOAC) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// El reporter de Playwright publica aquÃƒÂ­ el resultado de cada spec;
// se registra como evento e2e_ui (audit PG + ES logs) con trace/span.
app.post('/api/internal/ui-results', async (req, res) => {
  try {
    const { spec, result, duration_ms, trace_url, video_url, console_errors, network_errors, project } = req.body;
    if (!spec || !result) return res.status(400).json({ error: 'spec y result requeridos' });

    const ok = result === 'passed';
    const skipped = result === 'skipped';
    await logEvent('e2e_ui', {
      level: skipped ? 'info' : (ok ? 'info' : 'error'),
      message: `UI E2E ${spec} Ã¢â€ â€™ ${result} (${duration_ms || 0}ms)`,
      tenantId: 'default',
      module: 'ui-e2e',
      flow: 'e2e.playwright',
      action: skipped ? 'test.skipped' : (ok ? 'test.finished' : 'test.failed'),
      severity: skipped ? null : (ok ? null : 'high'),
      dependency: 'playwright',
      latencyMs: duration_ms || null,
      data: {
        spec, result, project: project || 'chromium',
        duration_ms: duration_ms || null,
        trace_url: trace_url || null,
        video_url: video_url || null,
        console_errors: (console_errors || []).slice(0, 20),
        network_errors: (network_errors || []).slice(0, 20),
      },
    });

    if (promCounters && promCounters.uiE2eTotal) {
      promCounters.uiE2eTotal.inc({ spec, result: ok ? 'passed' : 'failed' });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').toLowerCase().trim();
    const store = getStore();
    const limit = parseInt(req.query.limit || '10', 10);

    const leads = q
      ? store.leads
          .filter(l => [l.name, l.phone, l.email, l.source].filter(Boolean).some(f => String(f).toLowerCase().includes(q)))
          .slice(0, limit)
          .map(l => ({ type: 'lead', id: l.id, title: l.name || l.phone || l.id, subtitle: `${l.phone || l.email || ''} Ã‚Â· score ${l.score ?? 0}`, score: l.score ?? 0 }))
      : [];

    const campaigns = q
      ? store.campaigns
          .filter(c => String(c.name || '').toLowerCase().includes(q))
          .slice(0, limit)
          .map(c => ({ type: 'campaign', id: c.id, title: c.name, subtitle: `${c.status} Ã‚Â· ${c.channel}` }))
      : [];

    res.json({ query: q, total: leads.length + campaigns.length, leads, campaigns });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Notificaciones unificadas (portal) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
app.get('/api/notifications', async (req, res) => {
  try {
    const summary = await getIncidentSummary({ hours: 24 }).catch(() => ({ incidents: [], fallbacks: [], securityEvents: [], alerts: [] }));
    const notifications = [
      ...(summary.incidents || []).map(i => ({ type: 'incident', severity: 'high', text: `${i.type || 'incidente'} Ãƒâ€”${i.count}`, ts: null })),
      ...(summary.securityEvents || []).map(s => ({ type: 'security', severity: 'medium', text: `${s.type || 'evento de seguridad'} Ãƒâ€”${s.count}`, ts: null })),
      ...(summary.fallbacks || []).map(f => ({ type: 'fallback', severity: 'medium', text: `Fallback activo: ${f.dependency || 'dependencia'}`, ts: null })),
    ].slice(0, 15);
    res.json({ data: notifications, total: notifications.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/channels/broadcast', async (req, res) => {
  try {
    const { channel, message_template, audience = {}, subject } = req.body;
    if (!channel || !message_template) return res.status(400).json({ error: 'channel y message_template requeridos' });
    const adapter = getChannel(channel);
    if (!adapter) return res.status(400).json({ error: `Canal no soportado: ${channel}` });

    const store = getStore();
    let targets = audience.phones || [];
    if (!targets.length) {
      targets = store.leads
        .filter(l => !l.opt_out && l.status !== 'opted_out')
        .filter(l => {
          if (audience.all) return true;
          if (audience.channel) return l.custom_fields?.channel === audience.channel || l.source?.includes(audience.channel);
          return true;
        })
        .map(l => (channel === 'email' ? l.email : l.phone))
        .filter(Boolean)
        .slice(0, audience.limit || 100);
    }

    const results = [];
    for (const to of targets) {
      const text = String(message_template).replace(/\{\{name\}\}/g, (store.leads.find(l => l.phone === to || l.email === to)?.name) || '');
      const started = Date.now();
      const sent = await sendToChannel(channel, to, text, { subject: subject || 'Wibsite Business' });
      results.push({ to, ok: sent.ok, error: sent.ok ? null : sent.error });
      await logEvent(sent.ok ? 'campaign_sent' : 'error', {
        level: sent.ok ? 'info' : 'warn',
        message: `Broadcast ${channel} Ã¢â€ â€™ ${to}: ${sent.ok ? 'enviado' : sent.error}`,
        tenantId: req.tenantId || 'default',
        module: 'channels',
        flow: 'multicanal.broadcast',
        action: 'broadcast.send',
        severity: sent.ok ? null : 'medium',
        dependency: `${channel}-api`,
        latencyMs: Date.now() - started,
        data: { channel, to, ok: sent.ok, error: sent.ok ? null : sent.error },
      });
    }

    const okCount = results.filter(r => r.ok).length;
    res.json({
      channel,
      total: results.length,
      sent: okCount,
      failed: results.length - okCount,
      results,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/channels/test', async (req, res) => {
  try {
    const { channel, to, text } = req.body;
    if (!channel || !to || !text) return res.status(400).json({ error: 'channel, to y text requeridos' });
    const started = Date.now();
    const sent = await sendToChannel(channel, to, text);
    await logEvent(sent.ok ? 'api_call' : 'error', {
      level: sent.ok ? 'info' : 'warn',
      message: `EnvÃƒÂ­o de prueba ${channel} Ã¢â€ â€™ ${sent.ok ? 'ok' : sent.error}`,
      tenantId: req.tenantId || 'default',
      module: 'channels',
      flow: 'multicanal.outbound',
      action: 'channel.test_send',
      severity: sent.ok ? null : 'medium',
      dependency: `${channel}-api`,
      latencyMs: Date.now() - started,
      data: { channel, ok: sent.ok, error: sent.ok ? null : sent.error },
    });
    res.status(sent.ok ? 200 : 502).json(sent);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// INTERNAL CONTROL CENTER ENDPOINTS
// Accesibles solo con API key Ã¢â‚¬â€ alimentan el panel de superusuario
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

// GET /api/internal/health-detailed Ã¢â‚¬â€ estado extendido de todas las dependencias
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
    const redisHealth = await checkRedisHealth();

    // Elasticsearch (SOAC): _cluster/health con timeout corto
    let elastic = { status: 'not-configured', cluster: null };
    const ES_URL = process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
    const ES_PASSWORD = process.env.ELASTIC_PASSWORD || '';
    if (ES_PASSWORD) {
      try {
        const esResp = await axios.get(`${ES_URL}/_cluster/health`, {
          auth: { username: 'elastic', password: ES_PASSWORD },
          timeout: 3000,
        });
        elastic = { status: esResp.data?.status === 'green' ? 'connected' : 'connected-yellow', cluster: esResp.data?.status || 'unknown' };
      } catch (e) {
        elastic = { status: 'unreachable', cluster: null };
      }
    }

    const [incidentSummary] = await Promise.all([
      getIncidentSummary({ hours: 24 }).catch(() => ({ incidents: [], fallbacks: [], securityEvents: [], alerts: [] }))
    ]);

    res.json({
      service: 'wibsite-helper', version: '2.2.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - uptimeStart) / 1000),
      dependencies: {
        postgresql: { status: pgOk ? 'connected' : 'unavailable', mode: pool ? 'postgresql' : 'json-fallback', latencyMs: pgLatency },
        redis: redisHealth,
        weaviate: { status: weaviateOk ? 'connected' : 'fallback', mode: weaviateOk ? 'weaviate' : 'in-memory-kb' },
        llm: { status: OPENROUTER_API_KEY ? 'configured' : 'missing', model: OPENROUTER_MODEL },
        elastic: { status: elastic.status, cluster: elastic.cluster, url: ES_URL }
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
        scores: { total: store.scores.length },
        channels: listChannels().map(c => ({ channel: c.channel, configured: c.configured })),
        multimodal: {
          sttConfigured: mediaProcessor.isSttConfigured(),
          visionConfigured: mediaProcessor.isVisionConfigured(),
        },
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

// GET /api/internal/incidents/summary Ã¢â‚¬â€ resumen agrupado por mÃƒÂ³dulo/severidad
app.get('/api/internal/incidents/summary', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours || '24');
    const tenantId = req.query.tenantId || req.tenantId;
    const summary = await getIncidentSummary({ hours, tenantId });
    res.json(summary);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/incidents Ã¢â‚¬â€ listado de incidentes con contexto completo
app.get('/api/internal/incidents', async (req, res) => {
  try {
    const { module: mod, severity, status = 'open', tenantId, limit = 50, offset = 0, hours = 72 } = req.query;
    const result = await getIncidents({ module: mod, severity, status, tenantId, limit: parseInt(limit), offset: parseInt(offset), hours: parseInt(hours) });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/incidents/:id Ã¢â‚¬â€ detalle completo de un incidente
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

// POST /api/internal/incidents/:id/resolve Ã¢â‚¬â€ marcar incidente como resuelto
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

// GET /api/internal/security/events Ã¢â‚¬â€ eventos de seguridad recientes
app.get('/api/internal/security/events', async (req, res) => {
  try {
    const { hours = 24, type, limit = 100 } = req.query;
    const result = await getSecurityEvents({ hours: parseInt(hours), type, limit: parseInt(limit) });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/fallback-events Ã¢â‚¬â€ historial de fallbacks por dependencia
app.get('/api/internal/fallback-events', async (req, res) => {
  try {
    const { hours = 24, dependency, limit = 100 } = req.query;
    const result = await getFallbackEvents({ hours: parseInt(hours), dependency, limit: parseInt(limit) });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/alerts Ã¢â‚¬â€ alertas de Prometheus/Alertmanager recibidas
app.get('/api/internal/alerts', async (req, res) => {
  try {
    const { hours = 24, status, limit = 100 } = req.query;
    const result = await getAlerts({ hours: parseInt(hours), status, limit: parseInt(limit) });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/internal/alerts/webhook Ã¢â‚¬â€ receptor de Alertmanager
app.post('/api/internal/alerts/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const alert = await receiveAlert(payload);
    console.log(`[AlertManager] Alert received: ${alert.alert_name} (${alert.severity}) Ã¢â‚¬â€ ${alert.status}`);
    res.json({ status: 'received', alert_name: alert.alert_name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/internal/module-status Ã¢â‚¬â€ SLI por mÃƒÂ³dulo
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

// POST /api/internal/run-smoke Ã¢â‚¬â€ ejecuta smoke checks internos (sin Jest)
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
    else throw new Error('PG pool not initialized Ã¢â‚¬â€ using JSON fallback');
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

// GET /api/internal/audit-trail/:requestId Ã¢â‚¬â€ traza completa de un request
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

// GET /api/logs/trace/:conversationId Ã¢â‚¬â€ traza E2E por conversaciÃƒÂ³n (G-24/F-46)
// Devuelve quiÃƒÂ©n Ã¢â€ â€™ quÃƒÂ© Ã¢â€ â€™ cÃƒÂ³mo Ã¢â€ â€™ mÃƒÂ³dulo Ã¢â€ â€™ proceso de cada evento de la conversaciÃƒÂ³n.
app.get('/api/logs/trace/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  try {
    let rows = [];
    if (pool) {
      rows = (await pool.query(
        `SELECT level, tenant_id, request_id, conversation_id, trace_id, span_id,
                event_type, message, timestamp AS created_at, data
         FROM audit_logs WHERE conversation_id = $1 ORDER BY timestamp ASC`,
        [conversationId]
      ).catch(() => ({ rows: [] }))).rows;
    }
    if (rows.length === 0) {
      res.status(404).json({ conversationId, trace: [], found: false, note: 'No audit events yet for this conversation' });
      return;
    }
    await logEvent('e2e_trace', {
      level: 'info',
      message: `Traza E2E consultada (${rows.length} eventos)`,
      tenantId: req.tenantId,
      conversationId,
      module: 'observability',
      flow: 'logs.trace',
      action: 'trace.byConversation',
      data: { event_count: rows.length, trace_ids: [...new Set(rows.map(r => r.trace_id).filter(Boolean))] },
    }, req);
    res.json({
      conversationId,
      trace: rows.map(r => ({
        at: r.created_at,
        quien: r.tenant_id || r.request_id,
        queso: r.event_type,
        como: r.span_id,
        modulo: r.module,
        proceso: r.flow,
        message: r.message,
        request_id: r.request_id,
        trace_id: r.trace_id,
        span_id: r.span_id,
        event_type: r.event_type,
        level: r.level,
        data: r.data,
      })),
      found: true,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// HEALTH + SLI METRICS (MVP-10: KPIs, SLA/SLI monitoring)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â


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
      channels: listChannels().map(c => ({ channel: c.channel, configured: c.configured })),
      multimodal: {
        sttConfigured: mediaProcessor.isSttConfigured(),
        visionConfigured: mediaProcessor.isVisionConfigured(),
      },
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Wibsite 2.0 Ã¢â‚¬â€ CHAT UNIFICADO (reply + media + intereses + agentes) Ã¢â€â‚¬Ã¢â€â‚¬
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, 'storage', 'media');

// Subida de media (imagen/audio) para envÃƒÂ­o en chat
app.post('/api/chat/media', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido (campo file)' });
    const ext = path.extname(req.file.originalname).toLowerCase() || (req.file.mimetype?.includes('audio') ? '.ogg' : '.bin');
    const filename = `${crypto.randomUUID()}${ext}`;
    if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, filename), req.file.buffer);
    await logEvent('media_uploaded', {
      level: 'info', message: `Media subida ${filename} (${req.file.mimetype})`,
      tenantId: req.tenantId || 'default', module: 'channels', flow: 'multicanal.media', action: 'media.uploaded',
      data: { filename, mimetype: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json({ url: `/media/${filename}`, filename, mimetype: req.file.mimetype, size: req.file.size });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Servir media subida (pÃƒÂºblica a nivel helper; nginx la protege con SSO)
app.use('/media', express.static(MEDIA_DIR));

// Reply unificado: envÃƒÂ­a por el adaptador del canal con soporte de media/audio
app.post('/api/chat/reply', async (req, res) => {
  try {
    const { channel, to, text, mediaUrl, mediaType, audioBase64, audioFilename } = req.body;
    if (!channel || !to) return res.status(400).json({ error: 'channel y to requeridos' });
    if (!text && !mediaUrl && !audioBase64) return res.status(400).json({ error: 'text, mediaUrl o audioBase64 requeridos' });

    const started = Date.now();
    let sent;

    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const adapter = getChannel(channel);
      if (adapter?.sendVoice) {
        const result = await adapter.sendVoice({ to, audioBuffer, filename: audioFilename || 'voice.ogg', caption: text || '' });
        sent = { ok: true, result };
      } else {
        sent = await sendToChannel(channel, to, text || '[audio]');
      }
    } else if (channel === 'telegram' && mediaUrl) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const FormData = require('form-data');
        const form = new FormData();
        form.append('chat_id', to);
        if (String(mediaType || '').startsWith('image/')) form.append('photo', mediaUrl);
        else form.append('document', mediaUrl);
        if (text) form.append('caption', String(text).slice(0, 1024));
        const resp = await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, {
          headers: { ...form.getHeaders() }, timeout: 30000, maxContentLength: 50 * 1024 * 1024,
        });
        sent = resp.data?.ok ? { ok: true, result: resp.data.result } : { ok: false, error: resp.data?.description || 'telegram media failed' };
      } catch (e) { sent = { ok: false, error: e.message }; }
    } else {
      sent = await sendToChannel(channel, to, text || '', mediaUrl ? { mediaUrl, mediaType } : {});
    }

    if (sent.ok) {
      updateStore(s => {
        s.deliveries.push({
          id: crypto.randomUUID(), campaign_id: null, contact_id: to, contact_name: null,
          phone: channel === 'email' ? null : to, status: 'sent', channel, direction: 'outbound',
          content: text || `[media ${mediaType || 'audio'}]`, media_url: mediaUrl || null,
          sent_at: new Date().toISOString(), created_at: new Date().toISOString(),
        });
      });
      await incrementMessageCount('default', `${channel}_${to}`).catch(() => {});
    }

    await logEvent(sent.ok ? 'channel_reply' : 'error', {
      level: sent.ok ? 'info' : 'warn',
      message: `Reply ${channel} Ã¢â€ â€™ ${to}: ${sent.ok ? 'enviado' : sent.error}`,
      tenantId: req.tenantId || 'default', module: 'channels', flow: 'multicanal.reply', action: 'channel.reply',
      severity: sent.ok ? null : 'medium', dependency: `${channel}-api`, latencyMs: Date.now() - started,
      data: { channel, to, ok: sent.ok, error: sent.ok ? null : sent.error, hasMedia: !!(mediaUrl || audioBase64) },
    });

    res.status(sent.ok ? 200 : 502).json({ ok: sent.ok, channel, to, error: sent.ok ? null : sent.error, ...(sent.result || {}) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// AnÃƒÂ¡lisis de intereses del pipeline (dashboard)
app.get('/api/interests', (req, res) => {
  try {
    const store = getStore();
    const limit = parseInt(req.query.limit || '12', 10);
    const interestMap = new Map();
    const STOP = ['para', 'con', 'una', 'como', 'todo', 'esta', 'tiene', 'quiero', 'info', 'hola', 'mensaje', 'gracias', 'puede', 'esto', 'pero', 'mas', 'mÃƒÂ¡s', 'buenas', 'dias', 'tarde', 'noche', 'whatsapp', 'telegram'];
    for (const lead of store.leads) {
      const raw = [
        lead.custom_fields?.interest, lead.custom_fields?.message, lead.custom_fields?.interests,
        lead.custom_fields?.pain_points, lead.custom_fields?.product, lead.custom_fields?.segment,
      ].filter(Boolean).join(' ').toLowerCase();
      const score = lead.score || 0;
      const channel = lead.source || lead.custom_fields?.channel || 'web';
      if (!raw) continue;
      for (const word of raw.split(/[^a-zÃƒÂ¡ÃƒÂ©ÃƒÂ­ÃƒÂ³ÃƒÂºÃƒÂ±ÃƒÂ¼0-9#]+/)) {
        if (!word || word.length < 4 || STOP.includes(word)) continue;
        const prev = interestMap.get(word) || { count: 0, scoreSum: 0, channels: new Set() };
        prev.count++; prev.scoreSum += score; prev.channels.add(channel);
        interestMap.set(word, prev);
      }
    }
    const items = [...interestMap.entries()]
      .map(([term, v]) => ({ term, count: v.count, avgScore: Math.round(v.scoreSum / v.count), channels: [...v.channels] }))
      .sort((a, b) => (b.count * 0.6 + b.avgScore * 0.4) - (a.count * 0.6 + a.avgScore * 0.4))
      .slice(0, limit);
    res.json({ data: items, total: store.leads.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Agentes IA (config actual + catÃƒÂ¡logo)
app.get('/api/agents', (req, res) => {
  try {
    const store = getStore();
    const config = getAgentConfig(req.tenantId || 'default', store);
    res.json({
      active: config.auto_reply_enabled,
      current: config,
      businessTypes: Object.entries(BUSINESS_TYPES).map(([id, v]) => ({ id, ...v })),
      personalities: Object.entries(PERSONALITY_TYPES).map(([id, v]) => ({ id, ...v })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Catch-all: API JSON 404 (Wibsite 2.0 Ã¢â‚¬â€ UI servida por Next.js) Ã¢â€â‚¬Ã¢â€â‚¬
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Wibsite Helper v2 running on port ${PORT}`);
    if (pool) console.log('  DB: PostgreSQL connected');
    else console.log('  DB: JSON file store (fallback)');
  });
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} recibido Ã¢â‚¬â€ cerrando conexiones...`);
    try {
      await closeRedis();
      if (pool) await pool.end();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 3000).unref();
    } catch (e) {
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
module.exports = app;
app.closeAll = async () => {
  await closeRedis();
  if (pool) { try { await pool.end(); } catch (e) { /* ignore */ } }
};
