'use strict';
/**
 * clientConfig.js — Config por cliente (G16-02, Oleada 6)
 *
 * Loads client-specific configurations that override template defaults.
 * Each client config is a small JSON file that customizes branding,
 * commercial parameters, objection overrides, followup overrides,
 * and handoff routing.
 */

const fs = require('fs');
const path = require('path');

const CONFIGS_DIR = path.join(__dirname, '..', 'configs');

/**
 * Ensure configs directory exists
 */
function ensureDir() {
  if (!fs.existsSync(CONFIGS_DIR)) {
    fs.mkdirSync(CONFIGS_DIR, { recursive: true });
  }
}

/**
 * Load a client configuration by client ID
 */
function loadClientConfig(clientId) {
  ensureDir();
  const filePath = path.join(CONFIGS_DIR, `${clientId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Save a client configuration
 */
function saveClientConfig(clientId, config) {
  ensureDir();
  const filePath = path.join(CONFIGS_DIR, `${clientId}.json`);
  const data = {
    ...config,
    client_id: clientId,
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

/**
 * List all client configurations
 */
function listClientConfigs() {
  ensureDir();
  return fs.readdirSync(CONFIGS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(CONFIGS_DIR, f), 'utf8'));
      return { id: f.replace('.json', ''), name: data.name || f.replace('.json', ''), updated_at: data.updated_at };
    });
}

/**
 * Delete a client configuration
 */
function deleteClientConfig(clientId) {
  ensureDir();
  const filePath = path.join(CONFIGS_DIR, `${clientId}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/**
 * V4: Merge client config with template defaults.
 * Client config overrides template values.
 */
function mergeWithTemplate(clientId, templateId) {
  const clientConfig = loadClientConfig(clientId);
  const templatePath = path.join(__dirname, '..', 'templates', `${templateId}.json`);
  if (!fs.existsSync(templatePath)) return clientConfig || {};
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  if (!clientConfig) return template;

  return {
    ...template,
    meta: { ...template.meta, ...clientConfig.branding },
    commercial_params: {
      min_ticket: clientConfig.commercial_params?.min_ticket || template.commercial_params?.min_ticket || 0,
      price_ranges: clientConfig.commercial_params?.price_ranges || template.commercial_params?.price_ranges || [],
      disclaimer: clientConfig.commercial_params?.disclaimer || template.commercial_params?.disclaimer || '',
    },
    objections: mergeObjections(template.objections || [], clientConfig.objection_overrides || []),
    followup: {
      ...template.followup,
      ...(clientConfig.followup_overrides || {}),
    },
    handoff: {
      ...template.handoff,
      routing: clientConfig.handoff_routing || template.handoff?.routing || {},
    },
  };
}

/**
 * Merge objections: client overrides replace template objections by index or trigger pattern
 */
function mergeObjections(templateObjections, clientOverrides) {
  const merged = [...templateObjections];

  for (const override of clientOverrides) {
    if (override.index !== undefined && override.index < merged.length) {
      merged[override.index] = { ...merged[override.index], ...override };
    } else if (override.trigger_patterns) {
      const existing = merged.findIndex(m =>
        m.trigger_patterns?.some(tp => override.trigger_patterns.includes(tp))
      );
      if (existing >= 0) {
        merged[existing] = { ...merged[existing], ...override };
      } else {
        merged.push(override);
      }
    }
  }

  return merged;
}

module.exports = {
  loadClientConfig,
  saveClientConfig,
  listClientConfigs,
  deleteClientConfig,
  mergeWithTemplate,
};
