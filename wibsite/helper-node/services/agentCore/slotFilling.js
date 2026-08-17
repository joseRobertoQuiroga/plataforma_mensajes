'use strict';
const NAME_RE = /(?:mi nombre es|me llamo|soy)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]{2,})(?:\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}))?/i;
const PHONE_RE = /(\+?\d[\d\s\-()]{6,16}\d)/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const SERVICE_RE = /(desarrollo a medida|desarrollo web|desarrollo movil|desarrollo mobile|full stack|fullstack|modulo nuevo|integracion de plataformas|integracion|auditoria|consultoria|tienda en linea|tienda online|ecommerce|e-commerce|app movil|plataforma|pasarela de pagos)/i;
const URGENCY_RE = /(para el|antes de|cuanto antes|esta semana|este mes|urgente|la proxima)/i;

function extractLeadFields(message, state = {}, template = {}) {
  const extracted = {};

  if (!state.name) {
    const nameMatch = message.match(NAME_RE);
    if (nameMatch) {
      const name = nameMatch[2] ? `${nameMatch[1]} ${nameMatch[2]}` : nameMatch[1];
      if (name.length >= 2) extracted.name = name;
    }
  }

  if (!state.phone) {
    const phoneMatch = message.match(PHONE_RE);
    if (phoneMatch) extracted.phone = phoneMatch[1].replace(/[\s\-()]/g, '');
  }

  if (!state.email) {
    const emailMatch = message.match(EMAIL_RE);
    if (emailMatch) extracted.email = emailMatch[0];
  }

  if (!state.service_type) {
    const serviceMatch = message.match(SERVICE_RE);
    if (serviceMatch) extracted.service_type = serviceMatch[1];
  }

  if (!state.interest) {
    const products = template.products || [];
    const matched = products.find(p => message.toLowerCase().includes(p.name.toLowerCase()));
    if (matched) extracted.interest = matched.name;
    else if (SERVICE_RE.test(message)) extracted.interest = SERVICE_RE.exec(message)[1];
  }

  if (!state.urgency) {
    const urgencyMatch = message.match(URGENCY_RE);
    if (urgencyMatch) extracted.urgency = urgencyMatch[0];
  }

  return extracted;
}

function fitComplete(state = {}) {
  return !!(state.name || state.contact) && !!(state.interest || state.service_type);
}

function missingFields(state = {}, template = {}) {
  const required = template.handoff?.required_fields || ['name', 'phone'];
  const known = new Set([
    'name', 'phone', 'email', 'service_type', 'interest', 'urgency',
    'score', 'intent', 'objections_log', 'summary',
  ]);
  const extractable = required.filter(f => known.has(f) && f !== 'score' && f !== 'intent' && f !== 'objections_log' && f !== 'summary');
  return extractable.filter(f => !state[f]);
}

module.exports = { extractLeadFields, fitComplete, missingFields };