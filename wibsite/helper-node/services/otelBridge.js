'use strict';
/**
 * otelBridge.js — Wibsite Business
 * Emisor OTLP/HTTP mínimo (JSON, sin dependencias externas) hacia el OTel Collector.
 * Provee spans por request y por operación LLM/grafo, correlacionando trace_id/span_id
 * en auditLogger para cumplir el estándar de trazabilidad E2E
 * (quién → qué → cómo → módulo → proceso → traza continua en Elastic/Kibana).
 *
 * Convenciones OTel GenAI emitidas:
 *   gen_ai.provider, gen_ai.request.model, gen_ai.usage.input_tokens,
 *   gen_ai.usage.output_tokens, llm.usage.total_tokens
 */

const http = require('http');
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const OTLP_URL = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  || (process.env.NODE_ENV === 'production' ? 'http://otel-collector:4318' : 'http://localhost:4318');
const ENABLED = process.env.OTEL_BRIDGE_ENABLED !== 'false';
const MAX_BUFFER = 200;
const FLUSH_MS = 2000;

const als = new AsyncLocalStorage();
let buffer = [];
let flushTimer = null;
let logBuffer = [];
let logFlushTimer = null;

function toAttr(key, value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return { key, value: { boolValue: value } };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { key, value: { intValue: String(value) } }
      : { key, value: { doubleValue: value } };
  }
  if (typeof value === 'object') return { key, value: { stringValue: JSON.stringify(value) } };
  return { key, value: { stringValue: String(value) } };
}

function nowNano() {
  return String(BigInt(Date.now()) * 1000000n);
}

function spanContext() {
  const store = als.getStore && als.getStore();
  if (!store || !store.spans || !store.spans.length) return null;
  return store.spans[store.spans.length - 1];
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_MS);
  if (flushTimer.unref) flushTimer.unref();
}

function flush() {
  if (!ENABLED || !buffer.length) return;
  const spans = buffer.splice(0, MAX_BUFFER);
  const body = JSON.stringify({
    resourceSpans: [{
      resource: { attributes: [] },
      scopeSpans: [{
        scope: { name: 'wibsite-helper', version: '1.0.0' },
        spans,
      }],
    }],
  });
  const target = OTLP_URL.endsWith('/') ? OTLP_URL.slice(0, -1) : OTLP_URL;
  let u;
  try {
    u = new URL(target + '/v1/traces');
  } catch (e) {
    return;
  }
  const buf = Buffer.from(body);
  const req = http.request({
    hostname: u.hostname,
    port: u.port || 4318,
    path: u.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': buf.length,
    },
  }, (res) => { res.resume(); });
  req.on('error', () => { /* degradación silenciosa: sin collector no se rompe el flujo */ });
  req.end(buf);
}

function startSpan({ name, kind = 1, attributes = {}, traceId, parentSpanId, parent } = {}) {
  if (!ENABLED) return { traceId: null, spanId: null };
  const store = als.getStore && als.getStore();
  const parentCtx = parent || spanContext();
  const span = {
    traceId: traceId || (parentCtx && parentCtx.traceId) || crypto.randomBytes(16).toString('hex'),
    spanId: crypto.randomBytes(8).toString('hex'),
    name,
    kind,
    startTimeUnixNano: nowNano(),
    endTimeUnixNano: '',
    attributes: Object.entries(attributes || {}).map(([k, v]) => toAttr(k, v)).filter(Boolean),
    status: { code: 0 },
    parentSpanId: parentSpanId || (parentCtx && parentCtx.spanId) || undefined,
  };
  if (!span.parentSpanId) delete span.parentSpanId;
  if (store && Array.isArray(store.spans)) store.spans.push(span);
  return span;
}

function endSpan(span, { status = 'OK', attributes = {} } = {}) {
  if (!span) return;
  span.endTimeUnixNano = nowNano();
  if (status === 'ERROR') span.status = { code: 2, message: attributes?.error_message || 'error' };
  else span.status = { code: 1 };
  Object.entries(attributes || {}).forEach(([k, v]) => {
    const attr = toAttr(k, v);
    if (attr) span.attributes.push(attr);
  });
  buffer.push(span);
  scheduleFlush();
  const store = als.getStore && als.getStore();
  if (store && Array.isArray(store.spans)) {
    const idx = store.spans.lastIndexOf(span);
    if (idx >= 0) store.spans.splice(idx, 1);
  }
}

function getTraceContext() {
  const ctx = spanContext();
  return ctx ? { traceId: ctx.traceId, spanId: ctx.spanId } : null;
}

// ─── OTLP Logs (v1/logs) ──────────────────────────────────────
const SEVERITY_NUMBERS = {
  trace: 5, debug: 5, info: 9, warn: 13, error: 17, security: 17, fatal: 21,
};

function isValidHexId(value, len) {
  return typeof value === 'string' && new RegExp(`^[0-9a-f]{${len}}$`).test(value);
}

function scheduleLogFlush() {
  if (logFlushTimer) return;
  logFlushTimer = setTimeout(() => {
    logFlushTimer = null;
    flushLogs();
  }, FLUSH_MS);
  if (logFlushTimer.unref) logFlushTimer.unref();
}

function flushLogs() {
  if (!ENABLED || !logBuffer.length) return;
  const records = logBuffer.splice(0, MAX_BUFFER);
  const body = JSON.stringify({
    resourceLogs: [{
      resource: {
        attributes: [
          toAttr('service.name', 'wibsite-helper'),
          toAttr('deployment.environment', process.env.NODE_ENV || 'production'),
          toAttr('platform.name', 'wibsite'),
        ].filter(Boolean),
      },
      scopeLogs: [{
        scope: { name: 'wibsite-helper', version: '1.0.0' },
        logRecords: records,
      }],
    }],
  });
  const target = OTLP_URL.endsWith('/') ? OTLP_URL.slice(0, -1) : OTLP_URL;
  let u;
  try {
    u = new URL(target + '/v1/logs');
  } catch (e) {
    return;
  }
  const buf = Buffer.from(body);
  const req = http.request({
    hostname: u.hostname,
    port: u.port || 4318,
    path: u.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': buf.length,
    },
  }, (res) => { res.resume(); });
  req.on('error', () => { /* degradación silenciosa */ });
  req.end(buf);
}

/**
 * Envía un log OTLP (JSON) al collector. Best-effort: nunca lanza.
 */
function sendLog({ level = 'info', message = '', attributes = {}, traceId = null, spanId = null } = {}) {
  if (!ENABLED) return;
  const record = {
    timeUnixNano: nowNano(),
    severityNumber: SEVERITY_NUMBERS[level] || 9,
    severityText: String(level || 'INFO').toUpperCase(),
    body: { stringValue: String(message || '') },
    attributes: Object.entries(attributes || {})
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => toAttr(k, v))
      .filter(Boolean),
  };
  if (isValidHexId(traceId, 32)) record.traceId = traceId;
  if (isValidHexId(spanId, 16)) record.spanId = spanId;
  logBuffer.push(record);
  scheduleLogFlush();
}

/**
 * Middleware Express: crea el span raíz del request dentro de AsyncLocalStorage,
 * lo cierra al finalizar la respuesta.
 */
function tracingMiddleware(req, res, next) {
  const store = { spans: [] };
  als.run(store, () => {
    const span = startSpan({
      name: `HTTP ${req.method} ${req.path}`,
      kind: 2,
      attributes: {
        'http.request.method': req.method,
        'http.route': req.path,
        'thread.id': req.id || null,
      },
    });
    res.on('finish', () => {
      endSpan(span, {
        status: res.statusCode >= 500 ? 'ERROR' : 'OK',
        attributes: {
          'http.response.status_code': res.statusCode,
          'wibsite.request_id': req.id || null,
        },
      });
    });
    next();
  });
}

module.exports = {
  tracingMiddleware,
  startSpan,
  endSpan,
  getTraceContext,
  sendLog,
  flush,
  flushLogs,
  OTLP_URL,
};