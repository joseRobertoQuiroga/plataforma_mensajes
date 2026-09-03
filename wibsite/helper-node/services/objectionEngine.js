'use strict';
/**
 * objectionEngine.js — Banco de objeciones ejecutable (G15-03, Oleada 6)
 *
 * Matches incoming messages against objection trigger patterns and returns
 * a structured response with placeholders resolved from lead context.
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/**
 * Load a business template by ID (filename without .json)
 */
function loadTemplate(templateId) {
  const filePath = path.join(TEMPLATES_DIR, `${templateId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * List available templates
 */
function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ id: f.replace('.json', ''), path: path.join(TEMPLATES_DIR, f) }));
}

/**
 * Resolve placeholders like {{name}}, {{phone}}, {{score}}, etc.
 */
function resolvePlaceholders(pattern, lead = {}) {
  let resolved = pattern;
  const vars = {
    name: lead.name || 'Cliente',
    phone: lead.phone || '',
    email: lead.email || '',
    score: lead.score || 0,
    intent: lead.custom_fields?.intent || '',
    service_type: lead.custom_fields?.service_type || '',
  };
  for (const [key, value] of Object.entries(vars)) {
    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }
  return resolved;
}

/**
 * V1: Match a message against objection patterns in a template.
 * Returns { matched: boolean, response: string|null, triggers_followup: boolean, objection_index: number }
 */
function matchObjection(message, templateId, lead = {}) {
  const template = loadTemplate(templateId);
  if (!template || !template.objections) {
    return { matched: false, response: null, triggers_followup: false, objection_index: -1 };
  }

  const lower = String(message).toLowerCase().trim();

  for (let i = 0; i < template.objections.length; i++) {
    const obj = template.objections[i];
    const patterns = obj.trigger_patterns || [];
    const matched = patterns.some(pattern => lower.includes(pattern.toLowerCase()));
    if (matched) {
      return {
        matched: true,
        response: resolvePlaceholders(obj.response_pattern || '', lead),
        triggers_followup: obj.triggers_followup || false,
        objection_index: i,
      };
    }
  }

  return { matched: false, response: null, triggers_followup: false, objection_index: -1 };
}

module.exports = {
  loadTemplate,
  listTemplates,
  matchObjection,
  resolvePlaceholders,
};
