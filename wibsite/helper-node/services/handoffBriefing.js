'use strict';
/**
 * handoffBriefing.js — Handoff + briefing extendido (G15-06, Oleada 6)
 *
 * Generates a complete briefing for the human operator when a handoff occurs.
 * Includes lead info, objection history, temperature, and recommended actions.
 */

const fs = require('fs');
const path = require('path');
const { calculateTemperature } = require('./leadTemperature');
const { matchObjection } = require('./objectionEngine');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function loadTemplate(templateId) {
  const filePath = path.join(TEMPLATES_DIR, `${templateId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * V6: Generate a complete handoff briefing for the human operator.
 * Returns { briefing, required_fields_check, next_actions }
 */
function generateBriefing(lead, conversationHistory = [], templateId = 'template-consultora-software', deliveryHistory = []) {
  const template = loadTemplate(templateId);
  const handoffConfig = template?.handoff || {};
  const requiredFields = handoffConfig.required_fields || ['name', 'phone', 'score', 'intent', 'service_type'];

  // Calculate lead temperature
  const temperature = calculateTemperature(lead, templateId, deliveryHistory);

  // Analyze objections from conversation history
  const objectionsLog = [];
  for (const msg of conversationHistory) {
    if (msg.direction === 'inbound' || msg.role === 'user') {
      const content = msg.content || msg.text || '';
      const result = matchObjection(content, templateId, lead);
      if (result.matched) {
        objectionsLog.push({
          message: content,
          response: result.response,
          triggers_followup: result.triggers_followup,
        });
      }
    }
  }

  // Check required fields
  const fieldsCheck = {};
  for (const field of requiredFields) {
    fieldsCheck[field] = lead[field] || lead.custom_fields?.[field] || null;
  }

  // Determine recommended next actions
  const nextActions = determineNextActions(lead, temperature, objectionsLog, handoffConfig);

  // Generate briefing text
  const briefing = [
    `=== BRIEFING HANDOFF ===`,
    `Lead: ${lead.name || 'N/A'} | Tel: ${lead.phone || 'N/A'}`,
    `Email: ${lead.email || 'N/A'} | Score: ${lead.score || 0}`,
    `Temperatura: ${temperature.category.toUpperCase()} (${temperature.score}/100)`,
    `  - Fit: ${temperature.dimensions.fit}/100 | Engagement: ${temperature.dimensions.engagement}/100 | Intent: ${temperature.dimensions.intent}/100`,
    temperature.decay_applied > 0 ? `  - Decay: -${temperature.decay_applied}pts (${temperature.reason})` : '',
    ``,
    `=== OBJECIONES DETECTADAS ===`,
    objectionsLog.length > 0
      ? objectionsLog.map((o, i) => `${i + 1}. "${o.message}" → ${o.response}`).join('\n')
      : 'Sin objeciones detectadas',
    ``,
    `=== HISTORIAL DE CONVERSACIÓN ===`,
    conversationHistory.slice(-5).map(m => {
      const dir = m.direction === 'inbound' || m.role === 'user' ? 'Cliente' : 'Agente';
      const content = (m.content || m.text || '').substring(0, 100);
      return `[${dir}] ${content}`;
    }).join('\n'),
    ``,
    `=== ACCIONES RECOMENDADAS ===`,
    nextActions.map(a => `- ${a}`).join('\n'),
    ``,
    `=== CAMPOS REQUERIDOS ===`,
    Object.entries(fieldsCheck).map(([k, v]) => `- ${k}: ${v || '⚠️ FALTANTE'}`).join('\n'),
    ``,
    `=== ROUTING ===`,
    `Next action: ${handoffConfig.next_action || 'agendar_llamada'}`,
    `Notify target: ${handoffConfig.notify_target || 'chatwoot_note'}`,
  ].filter(Boolean).join('\n');

  return {
    briefing,
    required_fields_check: fieldsCheck,
    next_actions: nextActions,
    temperature,
    objections_count: objectionsLog.length,
  };
}

/**
 * Determine recommended next actions based on lead state
 */
function determineNextActions(lead, temperature, objectionsLog, handoffConfig) {
  const actions = [];

  if (temperature.category === 'hot') {
    actions.push('🔴 Lead HOT — Contacto inmediato recomendado');
    actions.push('Agendar llamada en las próximas 2 horas');
  } else if (temperature.category === 'warm') {
    actions.push('🟡 Lead WARM — Seguimiento en 24h');
    actions.push('Enviar propuesta personalizada');
  } else {
    actions.push('🔵 Lead COLD — Nutrición continua');
    actions.push('Agregar a secuencia de nurturing');
  }

  if (objectionsLog.length > 0) {
    actions.push(`📋 ${objectionsLog.length} objeción(es) detectada(s) — Revisar respuestas del agente`);
  }

  if (lead.handoffRequested) {
    actions.push('🚨 Handoff solicitado por el cliente — Prioridad máxima');
  }

  actions.push(`📞 Siguiente acción: ${handoffConfig.next_action || 'agendar_llamada'}`);

  return actions;
}

module.exports = {
  generateBriefing,
  determineNextActions,
};
