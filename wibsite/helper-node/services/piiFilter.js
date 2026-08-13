const pino = require('pino');

const PHONE_PATTERN = /\+?\d{7,15}/g;
const EMAIL_PATTERN = /[\w\.-]+@[\w\.-]+\.\w+/g;
const KEY_PATTERN = /(?:sk-|api-)[a-zA-Z0-9]{20,}/g;
const ADDRESS_PATTERN = /(?:calle|av|avenida|blvd|boulevard|col|colonia|frac|fraccionamiento)\s[\w\s]+/gi;

const TECHNICAL_FIELDS = new Set([
  'id', 'status', 'score', 'latency', 'channel', 'campaignId', 'leadId',
  'tenantId', 'eventType', 'level', 'requestId', 'conversationId',
  'timestamp', 'error', 'code', 'message', 'stack', 'campaign_id',
  'lead_id', 'tenant_id', 'request_id', 'conversation_id', 'event_type',
  'latency_ms', 'workflow_name', 'source', 'method', 'path', 'statusCode'
]);

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value
      .replace(PHONE_PATTERN, '[PHONE_REDACTED]')
      .replace(EMAIL_PATTERN, '[EMAIL_REDACTED]')
      .replace(KEY_PATTERN, '[KEY_REDACTED]')
      .replace(ADDRESS_PATTERN, '[ADDRESS_REDACTED]');
  }
  return value;
}

function sanitizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return sanitizeValue(obj);
  if (Array.isArray(obj)) return obj.map(item => sanitizeForLog(item));
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (TECHNICAL_FIELDS.has(key)) {
      result[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLog(value);
    } else {
      result[key] = sanitizeValue(value);
    }
  }
  return result;
}

function sanitizeMiddleware(req, res, next) {
  const originalLog = console.log;
  console.log = function (...args) {
    const sanitized = args.map(a => {
      if (typeof a === 'object' && a !== null) return sanitizeForLog(a);
      if (typeof a === 'string') return sanitizeValue(a);
      return a;
    });
    originalLog.apply(console, sanitized);
  };
  req.sanitizeForLog = sanitizeForLog;
  next();
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    log(object) {
      return sanitizeForLog(object);
    }
  }
});

module.exports = { sanitizeForLog, sanitizeMiddleware, sanitizeValue, logger };
