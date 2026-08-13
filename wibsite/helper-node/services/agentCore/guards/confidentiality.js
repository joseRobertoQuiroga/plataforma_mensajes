'use strict';
const { logEvent } = require('../../auditLogger');

const LEVELS = { PUBLIC: 'public', ASSISTED: 'assisted', INTERNAL: 'internal' };

const SENSITIVE_FIELDS = new Set(['phone', 'email', 'full_name', 'address', 'id_card', 'cc_number']);

function classifyField(fieldName, template) {
  if (!fieldName || fieldName.startsWith('_')) return LEVELS.INTERNAL;
  const forbidden = template.forbidden_topics || [];
  if (forbidden.some(t => fieldName.toLowerCase().includes(String(t).toLowerCase()))) return LEVELS.INTERNAL;
  if (SENSITIVE_FIELDS.has(fieldName)) return LEVELS.ASSISTED;
  return LEVELS.PUBLIC;
}

function applyAssistedTransform(value, fieldName) {
  if (value == null) return null;
  const str = String(value);
  if (fieldName === 'phone') {
    const digits = str.replace(/[^\d+]/g, '');
    if (digits.length <= 4) return '****';
    return `${'*'.repeat(Math.max(3, digits.length - 4))}${digits.slice(-4)}`;
  }
  if (fieldName === 'email') {
    const [user, domain] = str.split('@');
    if (!domain) return str;
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (fieldName === 'full_name') return str.split(' ').map((w, i) => (i === 0 ? w : `${w[0]}.`)).join(' ');
  return str;
}

function filterContext(rawState = {}, template) {
  const cleanState = {};
  const removed = [];
  for (const [key, value] of Object.entries(rawState)) {
    const level = classifyField(key, template);
    if (level === LEVELS.INTERNAL) {
      removed.push(key);
      continue;
    }
    cleanState[key] = level === LEVELS.ASSISTED ? applyAssistedTransform(value, key) : value;
  }
  return { cleanState, removed };
}

function detectLeak(text = '', template) {
  const forbidden = template?.forbidden_topics || [];
  const lower = text.toLowerCase();
  const hits = forbidden.filter(topic => {
    const keyword = String(topic).toLowerCase().replace(/_/g, ' ');
    return lower.includes(keyword) || keyword.includes(' ') && lower.includes(String(topic).toLowerCase().replace(/_/g, ''));
  });
  if (hits.length === 0 && forbidden.some(t => lower.includes(String(t).toLowerCase()))) {
    return { leaked: true, topic: forbidden.find(t => lower.includes(String(t).toLowerCase())) };
  }
  return hits.length ? { leaked: true, topic: hits[0] } : { leaked: false, topic: null };
}

function sanitizeOutput(text, template, { conversationId, tenantId, module = 'agentCore' } = {}) {
  const leak = detectLeak(text, template);
  if (!leak.leaked) return { leaked: false, text };
  logEvent('security_alert', {
    level: 'security',
    message: `Intento de exposicion bloqueado: tema '${leak.topic}'`,
    tenantId,
    conversationId,
    module,
    flow: 'guards.confidentiality',
    action: 'output_leak_blocked',
    severity: 'high',
    data: { topic: leak.topic, blocked: true },
  });
  return {
    leaked: true,
    topic: leak.topic,
    text: 'No puedo compartir esa informacion. ¿Queres que te explique el alcance del servicio o hable con una persona?',
  };
}

module.exports = {
  LEVELS, classifyField, applyAssistedTransform, filterContext, detectLeak, sanitizeOutput,
};