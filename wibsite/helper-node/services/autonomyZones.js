'use strict';
/**
 * autonomyZones.js — Zonas de autonomía (G15-02, Oleada 6)
 *
 * Green: Califica, responde preguntas, agenda reuniones
 * Yellow: Comparte rangos de precio, requiere supervisión
 * Red: Solo humano puede cotizar y cerrar
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function loadTemplate(templateId) {
  const filePath = path.join(TEMPLATES_DIR, `${templateId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * V5: Determine the autonomy zone for a given action based on lead state.
 * Returns { zone, allowed, description, reason }
 */
function getAutonomyZone(action, lead, templateId = 'template-consultora-software') {
  const template = loadTemplate(templateId);
  if (!template || !template.autonomy_zones) {
    return { zone: 'green', allowed: true, description: 'Default zone', reason: 'no_template' };
  }

  const zones = template.autonomy_zones;
  const leadScore = lead.score || 0;
  const handoffRequested = lead.handoffRequested || lead.status === 'escalated';

  // Red zone: handoff requested or high-value actions
  if (handoffRequested || action === 'commit' || action === 'close') {
    const redZone = zones.red || {};
    return {
      zone: 'red',
      allowed: false,
      description: redZone.description || 'Solo humano puede cotizar y cerrar',
      reason: handoffRequested ? 'handoff_requested' : 'action_requires_human',
    };
  }

  // Determine zone based on action and lead score
  if (action === 'quote' || action === 'pricing') {
    if (leadScore >= 70) {
      const redZone = zones.red || {};
      return {
        zone: 'red',
        allowed: false,
        description: redZone.description || 'Solo humano puede cotizar',
        reason: 'high_score_lead',
      };
    } else if (leadScore >= 40) {
      const yellowZone = zones.yellow || {};
      return {
        zone: 'yellow',
        allowed: yellowZone.can_share_pricing !== false,
        description: yellowZone.description || 'Comparte rangos de precio, requiere supervisión',
        reason: 'warm_lead',
      };
    } else {
      const greenZone = zones.green || {};
      return {
        zone: 'green',
        allowed: greenZone.can_quote !== true,
        description: greenZone.description || 'Califica, responde preguntas, agenda reuniones',
        reason: 'cold_lead',
      };
    }
  }

  // Default: green zone for qualification and scheduling
  const greenZone = zones.green || {};
  return {
    zone: 'green',
    allowed: true,
    description: greenZone.description || 'Califica, responde preguntas, agenda reuniones',
    reason: 'qualification_action',
  };
}

/**
 * Check if an action is allowed in the current autonomy zone
 */
function isActionAllowed(action, lead, templateId = 'template-consultora-software') {
  const result = getAutonomyZone(action, lead, templateId);
  return result.allowed;
}

/**
 * Get all zones with their capabilities
 */
function getZones(templateId = 'template-consultora-software') {
  const template = loadTemplate(templateId);
  return template?.autonomy_zones || {
    green: { can_quote: false, can_commit: false, can_share_pricing: false },
    yellow: { can_quote: false, can_commit: false, can_share_pricing: true },
    red: { can_quote: true, can_commit: true, can_share_pricing: true },
  };
}

module.exports = {
  getAutonomyZone,
  isActionAllowed,
  getZones,
};
