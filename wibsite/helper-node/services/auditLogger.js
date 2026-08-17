'use strict';
/**
 * auditLogger.js — Wibsite Business
 * Enhanced audit logger with structured incident tracking, fallback logging,
 * and full context propagation (requestId, tenantId, module, flow, severity).
 */

const { sanitizeForLog, logger } = require('./piiFilter');
const { getTraceContext, sendLog } = require('./otelBridge');

const EVENT_TYPES = [
  'security_alert', 'state_transition', 'api_call', 'error',
  'config_change', 'data_migration', 'deployment', 'handoff_created',
  'followup_scheduled', 'compliance_event', 'backup_completed',
  'hallucination_blocked', 'campaign_sent', 'e2e_trace',
  'fallback_activated', 'incident_opened', 'incident_resolved',
  'webhook_received', 'webhook_failed', 'csv_upload', 'export_generated',
  'rate_limit_exceeded', 'injection_blocked', 'unauthorized_access'
];

const LEVELS = { info: 'info', warn: 'warn', error: 'error', security: 'security' };
const SEVERITY = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low', INFO: 'info' };

let pool = null;

function initAuditLogger(pgPool) {
  pool = pgPool;
}

/**
 * Core event logging with full structured context
 */
async function logEvent(eventType, data, req = null) {
  if (!EVENT_TYPES.includes(eventType)) {
    console.warn(`[AuditLogger] Unknown event type: ${eventType}`);
  }

  const traceCtx = getTraceContext();
  const entry = {
    timestamp: new Date().toISOString(),
    level: data.level || LEVELS.info,
    traceId: traceCtx?.traceId || data.traceId || null,
    spanId: traceCtx?.spanId || data.spanId || null,
    tenantId: data.tenantId || req?.tenantId || req?.headers?.['x-tenant-id'] || 'default',
    requestId: data.requestId || req?.id || null,
    conversationId: data.conversationId || null,
    userId: data.userId || req?.headers?.['x-user-id'] || null,
    // Extended context fields
    module: data.module || null,
    flow: data.flow || null,
    action: data.action || null,
    severity: data.severity || null,
    dependency: data.dependency || null,
    // Core fields
    eventType,
    message: data.message || '',
    latencyMs: data.latencyMs || null,
    data: sanitizeForLog(data)
  };

  // Log via pino with sanitization
  const pinoLevel = entry.level === 'security' ? 'warn' : (entry.level || 'info');
  if (logger[pinoLevel]) {
    logger[pinoLevel]({ eventType, ...entry }, entry.message);
  } else {
    logger.info({ eventType, ...entry }, entry.message);
  }

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO audit_logs
          (level, tenant_id, request_id, conversation_id, trace_id, span_id, event_type, message, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.level, entry.tenantId, entry.requestId,
          entry.conversationId, entry.traceId, entry.spanId,
          eventType, entry.message,
          JSON.stringify(entry.data)
        ]
      );
    } catch (e) {
      console.error('[AuditLogger] DB insert failed:', e.message);
    }
  }

  // OTLP Logs bridge (Elasticsearch logs datastream) — best-effort, nunca lanza
  try {
    sendLog({
      level: entry.level,
      message: entry.message,
      traceId: entry.traceId,
      spanId: entry.spanId,
      attributes: {
        'event.type': eventType,
        'wibsite.tenant_id': entry.tenantId,
        'wibsite.request_id': entry.requestId,
        'wibsite.conversation_id': entry.conversationId,
        'wibsite.user_id': entry.userId,
        'wibsite.module': entry.module,
        'wibsite.flow': entry.flow,
        'wibsite.action': entry.action,
        'wibsite.severity': entry.severity,
        'wibsite.dependency': entry.dependency,
        'wibsite.latency_ms': entry.latencyMs,
      },
    });
  } catch (e) { /* ignore */ }

  return entry;
}

/**
 * Log a dependency fallback activation
 */
async function logFallback(dependency, reason, tenantId, requestId, { module: mod, durationMs } = {}) {
  return logEvent('fallback_activated', {
    level: LEVELS.warn,
    message: `Fallback activated for dependency: ${dependency} — ${reason}`,
    tenantId,
    requestId,
    module: mod || 'infrastructure',
    dependency,
    severity: SEVERITY.MEDIUM,
    data: { dependency, reason, fallback_type: `${dependency}-in-memory`, duration_ms: durationMs }
  });
}

/**
 * Log a structured incident (critical error requiring investigation)
 */
async function logIncident(data) {
  const {
    requestId, tenantId, module: mod, flow, action,
    error, title, severity = SEVERITY.HIGH,
    httpMethod, httpPath, httpStatus,
    affectedDependencies = [], context = {}
  } = data;

  return logEvent('incident_opened', {
    level: LEVELS.error,
    message: title || `Incident: ${error?.message || 'Unknown error'}`,
    requestId, tenantId,
    module: mod, flow, action, severity,
    data: {
      title,
      error_type: error?.constructor?.name || error?.name,
      error_message: error?.message,
      http_method: httpMethod,
      http_path: httpPath,
      http_status: httpStatus,
      affected_dependencies: affectedDependencies,
      context: sanitizeForLog(context)
    }
  });
}

/**
 * Middleware that logs all API errors and attaches timing
 */
function createAuditMiddleware(eventType) {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const latencyMs = Date.now() - start;
      if (res.statusCode >= 400) {
        const level = res.statusCode >= 500 ? LEVELS.error : LEVELS.warn;
        const severity = res.statusCode >= 500 ? SEVERITY.HIGH : SEVERITY.MEDIUM;
        logEvent(eventType || 'api_call', {
          level,
          severity,
          message: `${req.method} ${req.path} → ${res.statusCode} (${latencyMs}ms)`,
          latencyMs,
          requestId: req.id,
          tenantId: req.tenantId,
          conversationId: req.body?.conversationId || req.params?.conversationId || null,
          module: null,
          flow: `${req.method} ${req.path}`,
          data: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            latencyMs,
            userAgent: req.headers?.['user-agent']
          }
        }, req);
      }
    });
    next();
  };
}

module.exports = {
  initAuditLogger, logEvent, logFallback, logIncident,
  createAuditMiddleware, EVENT_TYPES, LEVELS, SEVERITY
};
