'use strict';
/**
 * errorTracker.js — Wibsite Business
 * Tracks errors, incidents, security events and fallbacks with full context.
 * Persists to PostgreSQL with in-memory fallback.
 * Exposes structured data for the Control Center and GlitchTip integration.
 */

const crypto = require('crypto');
const { sanitizeForLog } = require('./piiFilter');

const SEVERITY = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low', INFO: 'info' };
const MODULE = {
  CAMPAIGNS: 'campaigns', LEADS: 'leads', SCORING: 'scoring',
  CONVERSATIONS: 'conversations', SECURITY: 'security',
  INTEGRATIONS: 'integrations', WEBHOOKS: 'webhooks',
  KB: 'knowledge-base', AUTH: 'auth', TEMPLATES: 'templates',
  AGENT: 'agent', INFRASTRUCTURE: 'infrastructure'
};
const STATUS = { OPEN: 'open', INVESTIGATING: 'investigating', RESOLVED: 'resolved', IGNORED: 'ignored' };

let pgPool = null;
// In-memory store as fallback
const incidents = [];
const fallbackEvents = [];
const securityEvents = [];
const alertsReceived = [];
const MAX_IN_MEMORY = 500;

// Prometheus counters (injected externally)
let prometheusCounters = null;

function initErrorTracker(pool, counters = null) {
  pgPool = pool;
  prometheusCounters = counters;
  if (pool) {
    ensureTablesExist(pool).catch(e => {
      console.warn('[ErrorTracker] DB Init failed, falling back to in-memory store:', e.message);
      pgPool = null; // Disable DB usage if tables can't be created to prevent log spam
    });
  }
}

async function ensureTablesExist(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incidents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id TEXT,
      tenant_id TEXT DEFAULT 'default',
      user_id TEXT,
      module TEXT NOT NULL,
      flow TEXT,
      action TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      title TEXT NOT NULL,
      description TEXT,
      error_type TEXT,
      error_message TEXT,
      error_stack TEXT,
      affected_dependencies TEXT[],
      http_method TEXT,
      http_path TEXT,
      http_status INTEGER,
      payload JSONB,
      context JSONB,
      fingerprint TEXT,
      occurrence_count INTEGER DEFAULT 1,
      first_seen_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      resolved_by TEXT,
      resolution_notes TEXT,
      tags TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_incidents_module ON incidents(module);
    CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_incidents_fingerprint ON incidents(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);

    CREATE TABLE IF NOT EXISTS fallback_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dependency TEXT NOT NULL,
      reason TEXT,
      tenant_id TEXT DEFAULT 'default',
      request_id TEXT,
      module TEXT,
      fallback_type TEXT,
      duration_ms INTEGER,
      recovered BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_fallback_dependency ON fallback_events(dependency);
    CREATE INDEX IF NOT EXISTS idx_fallback_created_at ON fallback_events(created_at);

    CREATE TABLE IF NOT EXISTS security_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id TEXT,
      tenant_id TEXT DEFAULT 'default',
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'high',
      ip_address TEXT,
      user_agent TEXT,
      path TEXT,
      method TEXT,
      details JSONB,
      blocked BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_security_event_type ON security_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_security_created_at ON security_events(created_at);

    CREATE TABLE IF NOT EXISTS prometheus_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_name TEXT NOT NULL,
      severity TEXT,
      status TEXT,
      service TEXT,
      description TEXT,
      payload JSONB,
      received_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

/** Generate a fingerprint for deduplication: same module+flow+error_type = same incident bucket */
function generateFingerprint(module, flow, errorType, httpPath) {
  const raw = [module || '', flow || '', errorType || '', httpPath || ''].join('|');
  return crypto.createHash('md5').update(raw).digest('hex').substring(0, 16);
}

/** Determine severity from HTTP status and error context */
function determineSeverity(httpStatus, errorType, module) {
  if (errorType === 'SecurityViolation' || errorType === 'PromptInjection') return SEVERITY.CRITICAL;
  if (httpStatus >= 500) return SEVERITY.HIGH;
  if (module === MODULE.SECURITY || module === MODULE.AUTH) return SEVERITY.HIGH;
  if (httpStatus >= 400) return SEVERITY.MEDIUM;
  return SEVERITY.LOW;
}

/** Determine affected module from request path */
function pathToModule(path) {
  if (!path) return MODULE.INFRASTRUCTURE;
  if (path.includes('/leads')) return MODULE.LEADS;
  if (path.includes('/campaigns')) return MODULE.CAMPAIGNS;
  if (path.includes('/scoring')) return MODULE.SCORING;
  if (path.includes('/conversations')) return MODULE.CONVERSATIONS;
  if (path.includes('/security') || path.includes('/auth')) return MODULE.SECURITY;
  if (path.includes('/webhooks')) return MODULE.WEBHOOKS;
  if (path.includes('/knowledge-base') || path.includes('/kb')) return MODULE.KB;
  if (path.includes('/templates')) return MODULE.TEMPLATES;
  if (path.includes('/agent')) return MODULE.AGENT;
  if (
    path.includes('/twenty') || path.includes('/n8n') ||
    path.includes('/chatwoot') || path.includes('/llm')
  ) return MODULE.INTEGRATIONS;
  return MODULE.INFRASTRUCTURE;
}

function detectAffectedDependencies(errorMessage = '', path = '') {
  const deps = [];
  if (errorMessage.includes('weaviate') || path.includes('knowledge-base')) deps.push('weaviate');
  if (errorMessage.toLowerCase().includes('redis')) deps.push('redis');
  if (
    errorMessage.toLowerCase().includes('postgres') ||
    errorMessage.toLowerCase().includes(' pg ') ||
    errorMessage.includes('relation')
  ) deps.push('postgresql');
  if (errorMessage.includes('twenty') || path.includes('twenty')) deps.push('twenty-crm');
  if (errorMessage.includes('n8n') || path.includes('n8n')) deps.push('n8n');
  if (errorMessage.includes('dify') || errorMessage.includes('llm') || path.includes('llm')) deps.push('dify-llm');
  if (errorMessage.toLowerCase().includes('chatwoot') || path.includes('chatwoot')) deps.push('chatwoot');
  if (errorMessage.toLowerCase().includes('whatsapp') || path.includes('whatsapp')) deps.push('meta-whatsapp');
  if (errorMessage.includes('Twilio') || path.includes('twilio')) deps.push('twilio');
  if (errorMessage.toLowerCase().includes('minio')) deps.push('minio');
  return deps;
}

/** Track an error/incident with full context */
async function trackIncident(data) {
  const {
    requestId, tenantId = 'default', userId,
    module: mod, flow, action,
    error, title, description,
    httpMethod, httpPath, httpStatus,
    payload, context, tags = [],
    severity: overrideSeverity
  } = data;

  const errorType = error?.constructor?.name || error?.name || 'Error';
  const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
  const errorStack = error?.stack || null;
  const resolvedModule = mod || pathToModule(httpPath);
  const severity = overrideSeverity || determineSeverity(httpStatus, errorType, resolvedModule);
  const fingerprint = generateFingerprint(resolvedModule, flow, errorType, httpPath);

  const incident = {
    id: crypto.randomUUID(),
    request_id: requestId,
    tenant_id: tenantId,
    user_id: userId,
    module: resolvedModule,
    flow: flow || null,
    action: action || null,
    severity,
    status: STATUS.OPEN,
    title: title || `${errorType} in ${resolvedModule}`,
    description: description || errorMessage,
    error_type: errorType,
    error_message: errorMessage,
    error_stack: errorStack,
    affected_dependencies: detectAffectedDependencies(errorMessage, httpPath),
    http_method: httpMethod,
    http_path: httpPath,
    http_status: httpStatus,
    payload: sanitizeForLog(payload || {}),
    context: sanitizeForLog(context || {}),
    fingerprint,
    occurrence_count: 1,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    tags: [...new Set([...tags, resolvedModule, severity])]
  };

  // Prometheus counters
  if (prometheusCounters?.incidentTotal) {
    prometheusCounters.incidentTotal.inc({ module: resolvedModule, severity });
  }

  if (pgPool) {
    try {
      // Upsert by fingerprint to avoid duplicate open incidents
      const existing = await pgPool.query(
        `SELECT id, occurrence_count FROM incidents WHERE fingerprint = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
        [fingerprint]
      );
      if (existing.rows.length > 0) {
        const existingId = existing.rows[0].id;
        await pgPool.query(
          `UPDATE incidents SET occurrence_count = occurrence_count + 1, last_seen_at = NOW(), error_stack = $1, request_id = $2 WHERE id = $3`,
          [errorStack, requestId, existingId]
        );
        return existingId;
      } else {
        const result = await pgPool.query(
          `INSERT INTO incidents
            (request_id, tenant_id, user_id, module, flow, action, severity, status, title, description,
             error_type, error_message, error_stack, affected_dependencies, http_method, http_path,
             http_status, payload, context, fingerprint, occurrence_count, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
           RETURNING id`,
          [
            incident.request_id, incident.tenant_id, incident.user_id,
            incident.module, incident.flow, incident.action,
            incident.severity, incident.status,
            incident.title, incident.description,
            incident.error_type, incident.error_message, incident.error_stack,
            incident.affected_dependencies, incident.http_method, incident.http_path,
            incident.http_status,
            JSON.stringify(incident.payload), JSON.stringify(incident.context),
            incident.fingerprint, 1, incident.tags
          ]
        );
        return result.rows[0].id;
      }
    } catch (e) {
      console.error('[ErrorTracker] DB insert failed:', e.message);
    }
  }

  // In-memory fallback
  const existingIdx = incidents.findIndex(
    i => i.fingerprint === fingerprint && i.status === STATUS.OPEN
  );
  if (existingIdx >= 0) {
    incidents[existingIdx].occurrence_count++;
    incidents[existingIdx].last_seen_at = new Date().toISOString();
    return incidents[existingIdx].id;
  }
  incidents.unshift(incident);
  if (incidents.length > MAX_IN_MEMORY) incidents.length = MAX_IN_MEMORY;
  return incident.id;
}

/** Track a fallback activation event */
async function trackFallback(dependency, { reason, tenantId = 'default', requestId, module: mod, fallbackType, durationMs } = {}) {
  const event = {
    dependency, reason,
    tenant_id: tenantId,
    request_id: requestId,
    module: mod,
    fallback_type: fallbackType || `${dependency}-fallback`,
    duration_ms: durationMs,
    created_at: new Date().toISOString()
  };

  if (prometheusCounters) {
    const key = `${dependency}FallbackTotal`;
    if (prometheusCounters[key]) {
      prometheusCounters[key].inc();
    } else if (prometheusCounters.fallbackTotal) {
      prometheusCounters.fallbackTotal.inc({ dependency });
    }
  }

  if (pgPool) {
    try {
      await pgPool.query(
        `INSERT INTO fallback_events (dependency, reason, tenant_id, request_id, module, fallback_type, duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [dependency, reason, tenantId, requestId, mod, event.fallback_type, durationMs]
      );
    } catch (e) {
      console.error('[ErrorTracker] Fallback event DB insert failed:', e.message);
    }
  }
  fallbackEvents.unshift(event);
  if (fallbackEvents.length > MAX_IN_MEMORY) fallbackEvents.length = MAX_IN_MEMORY;
}

/** Track a security event */
async function trackSecurityEvent(type, {
  requestId, tenantId = 'default', ip, userAgent,
  path, method, details, blocked = true, severity = SEVERITY.HIGH
} = {}) {
  const event = {
    request_id: requestId, tenant_id: tenantId,
    event_type: type, severity,
    ip_address: ip, user_agent: userAgent,
    path, method,
    details: sanitizeForLog(details || {}),
    blocked,
    created_at: new Date().toISOString()
  };

  if (prometheusCounters?.securityBlocksTotal) {
    prometheusCounters.securityBlocksTotal.inc({ type });
  }

  if (pgPool) {
    try {
      await pgPool.query(
        `INSERT INTO security_events (request_id, tenant_id, event_type, severity, ip_address, user_agent, path, method, details, blocked)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [requestId, tenantId, type, severity, ip, userAgent, path, method, JSON.stringify(details || {}), blocked]
      );
    } catch (e) {
      console.error('[ErrorTracker] Security event DB insert failed:', e.message);
    }
  }
  securityEvents.unshift(event);
  if (securityEvents.length > MAX_IN_MEMORY) securityEvents.length = MAX_IN_MEMORY;
}

/** Receive and store an Alertmanager webhook alert */
async function receiveAlert(payload) {
  const alert = {
    id: crypto.randomUUID(),
    alert_name: payload.commonLabels?.alertname || 'unknown',
    severity: payload.commonLabels?.severity || 'unknown',
    status: payload.status || 'firing',
    service: payload.commonLabels?.service || 'wibsite',
    description: payload.commonAnnotations?.description || payload.commonAnnotations?.summary || '',
    payload,
    received_at: new Date().toISOString()
  };

  if (pgPool) {
    try {
      await pgPool.query(
        `INSERT INTO prometheus_alerts (alert_name, severity, status, service, description, payload)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [alert.alert_name, alert.severity, alert.status, alert.service, alert.description, JSON.stringify(payload)]
      );
    } catch (e) {
      console.error('[ErrorTracker] Alert DB insert failed:', e.message);
    }
  }
  alertsReceived.unshift(alert);
  if (alertsReceived.length > 200) alertsReceived.length = 200;

  // Also create an incident for critical/high alerts that are firing
  if (alert.status === 'firing' && ['critical', 'high'].includes(alert.severity)) {
    await trackIncident({
      module: MODULE.INFRASTRUCTURE,
      flow: 'prometheus-alert',
      action: alert.alert_name,
      title: `[ALERT] ${alert.alert_name}`,
      description: alert.description,
      severity: alert.severity,
      error: { name: 'PrometheusAlert', message: alert.description },
      context: { alertmanager: true, service: alert.service }
    }).catch(() => {});
  }

  return alert;
}

/** Resolve an incident */
async function resolveIncident(id, { resolvedBy, notes } = {}) {
  if (pgPool) {
    try {
      await pgPool.query(
        `UPDATE incidents SET status = 'resolved', resolved_at = NOW(), resolved_by = $1, resolution_notes = $2 WHERE id = $3`,
        [resolvedBy || 'superuser', notes || '', id]
      );
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  const inc = incidents.find(i => i.id === id);
  if (inc) {
    inc.status = STATUS.RESOLVED;
    inc.resolved_at = new Date().toISOString();
    inc.resolved_by = resolvedBy || 'superuser';
    inc.resolution_notes = notes || '';
  }
  return { success: true };
}

/** Get incident summary grouped by module/severity */
async function getIncidentSummary({ hours = 24, tenantId } = {}) {
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  if (pgPool) {
    try {
      const tenantClause = tenantId ? 'AND tenant_id = $2' : '';
      const params = tenantId ? [since, tenantId] : [since];

      const result = await pgPool.query(`
        SELECT
          module, severity, status,
          COUNT(*) as count,
          MAX(last_seen_at) as last_seen,
          SUM(occurrence_count) as total_occurrences
        FROM incidents
        WHERE created_at >= $1 ${tenantClause}
        GROUP BY module, severity, status
        ORDER BY
          CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
          count DESC
      `, params);

      const fallbackResult = await pgPool.query(`
        SELECT dependency, COUNT(*) as count, MAX(created_at) as last_seen
        FROM fallback_events WHERE created_at >= $1
        GROUP BY dependency ORDER BY count DESC
      `, [since]);

      const secResult = await pgPool.query(`
        SELECT event_type, COUNT(*) as count, MAX(created_at) as last_seen
        FROM security_events WHERE created_at >= $1
        GROUP BY event_type ORDER BY count DESC
      `, [since]);

      const alertResult = await pgPool.query(`
        SELECT alert_name, severity, status, COUNT(*) as count, MAX(received_at) as last_seen
        FROM prometheus_alerts WHERE received_at >= $1
        GROUP BY alert_name, severity, status ORDER BY count DESC
      `, [since]);

      return {
        period: `last_${hours}h`,
        incidents: result.rows,
        fallbacks: fallbackResult.rows,
        securityEvents: secResult.rows,
        alerts: alertResult.rows,
        generatedAt: new Date().toISOString()
      };
    } catch (e) {
      console.error('[ErrorTracker] getIncidentSummary DB error:', e.message);
    }
  }

  // In-memory fallback
  const since_ts = new Date(since);
  const recent = incidents.filter(i => new Date(i.created_at) >= since_ts);
  const byModule = {};
  for (const inc of recent) {
    const key = `${inc.module}|${inc.severity}|${inc.status}`;
    if (!byModule[key]) byModule[key] = { module: inc.module, severity: inc.severity, status: inc.status, count: 0, last_seen: inc.created_at, total_occurrences: 0 };
    byModule[key].count++;
    byModule[key].total_occurrences += (inc.occurrence_count || 1);
    if (inc.last_seen_at > byModule[key].last_seen) byModule[key].last_seen = inc.last_seen_at;
  }
  return {
    period: `last_${hours}h`,
    incidents: Object.values(byModule),
    fallbacks: fallbackEvents.slice(0, 20).map(f => ({ dependency: f.dependency, count: 1, last_seen: f.created_at })),
    securityEvents: securityEvents.slice(0, 20).map(s => ({ event_type: s.event_type, count: 1, last_seen: s.created_at })),
    alerts: alertsReceived.slice(0, 10).map(a => ({ alert_name: a.alert_name, severity: a.severity, status: a.status, count: 1, last_seen: a.received_at })),
    generatedAt: new Date().toISOString()
  };
}

/** Get incident list with full context */
async function getIncidents({ module: mod, severity, status, tenantId, limit = 50, offset = 0, hours = 72 } = {}) {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  if (pgPool) {
    try {
      const conditions = ['created_at >= $1'];
      const params = [since];
      let pi = 2;
      if (mod) { conditions.push(`module = $${pi++}`); params.push(mod); }
      if (severity) { conditions.push(`severity = $${pi++}`); params.push(severity); }
      if (status) { conditions.push(`status = $${pi++}`); params.push(status); }
      if (tenantId) { conditions.push(`tenant_id = $${pi++}`); params.push(tenantId); }

      const countParams = [...params];
      params.push(limit, offset);

      const result = await pgPool.query(`
        SELECT * FROM incidents
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
          last_seen_at DESC
        LIMIT $${pi++} OFFSET $${pi}
      `, params);

      const countResult = await pgPool.query(
        `SELECT COUNT(*) FROM incidents WHERE ${conditions.join(' AND ')}`,
        countParams
      );

      return { data: result.rows, total: parseInt(countResult.rows[0].count), limit, offset };
    } catch (e) {
      console.error('[ErrorTracker] getIncidents DB error:', e.message);
    }
  }
  let data = incidents;
  if (mod) data = data.filter(i => i.module === mod);
  if (severity) data = data.filter(i => i.severity === severity);
  if (status) data = data.filter(i => i.status === status);
  if (tenantId) data = data.filter(i => i.tenant_id === tenantId);
  return { data: data.slice(offset, offset + limit), total: data.length, limit, offset };
}

/** Get security events */
async function getSecurityEvents({ hours = 24, type, limit = 100 } = {}) {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  if (pgPool) {
    try {
      const conditions = ['created_at >= $1'];
      const params = [since];
      if (type) { conditions.push(`event_type = $2`); params.push(type); }
      params.push(limit);
      const result = await pgPool.query(
        `SELECT * FROM security_events WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
        params
      );
      return { data: result.rows, total: result.rowCount };
    } catch (e) {
      console.error('[ErrorTracker] getSecurityEvents DB error:', e.message);
    }
  }
  let data = securityEvents.filter(e => new Date(e.created_at) >= new Date(since));
  if (type) data = data.filter(e => e.event_type === type);
  return { data: data.slice(0, limit), total: data.length };
}

/** Get fallback events */
async function getFallbackEvents({ hours = 24, dependency, limit = 100 } = {}) {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  if (pgPool) {
    try {
      const conditions = ['created_at >= $1'];
      const params = [since];
      if (dependency) { conditions.push(`dependency = $2`); params.push(dependency); }
      params.push(limit);
      const result = await pgPool.query(
        `SELECT * FROM fallback_events WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
        params
      );
      return { data: result.rows, total: result.rowCount };
    } catch (e) {
      console.error('[ErrorTracker] getFallbackEvents DB error:', e.message);
    }
  }
  let data = fallbackEvents.filter(e => new Date(e.created_at) >= new Date(since));
  if (dependency) data = data.filter(e => e.dependency === dependency);
  return { data: data.slice(0, limit), total: data.length };
}

/** Get Prometheus alerts */
async function getAlerts({ hours = 24, limit = 100, status } = {}) {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  if (pgPool) {
    try {
      const conditions = ['received_at >= $1'];
      const params = [since];
      if (status) { conditions.push(`status = $2`); params.push(status); }
      params.push(limit);
      const result = await pgPool.query(
        `SELECT * FROM prometheus_alerts WHERE ${conditions.join(' AND ')} ORDER BY received_at DESC LIMIT $${params.length}`,
        params
      );
      return { data: result.rows, total: result.rowCount };
    } catch (e) {
      console.error('[ErrorTracker] getAlerts DB error:', e.message);
    }
  }
  let data = alertsReceived.filter(a => new Date(a.received_at) >= new Date(since));
  if (status) data = data.filter(a => a.status === status);
  return { data: data.slice(0, limit), total: data.length };
}

/**
 * Express middleware: auto-track 500 errors with full request context
 */
function errorTrackerMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    res.json = function(body) {
      if (res.statusCode >= 500) {
        const durationMs = Date.now() - start;
        trackIncident({
          requestId: req.id,
          tenantId: req.tenantId || req.headers['x-tenant-id'] || 'default',
          module: pathToModule(req.path),
          flow: `${req.method} ${req.path}`,
          action: req.method,
          error: { name: 'ServerError', message: body?.error || 'Internal server error' },
          httpMethod: req.method,
          httpPath: req.path,
          httpStatus: res.statusCode,
          context: { durationMs, userAgent: req.headers['user-agent'], ip: req.ip }
        }).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = {
  initErrorTracker, trackIncident, trackFallback, trackSecurityEvent,
  resolveIncident, receiveAlert,
  getIncidentSummary, getIncidents, getSecurityEvents, getFallbackEvents, getAlerts,
  errorTrackerMiddleware, pathToModule,
  SEVERITY, MODULE, STATUS
};
