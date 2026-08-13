const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const SCHEMA = {
  meta: { required: true, fields: ['version', 'name', 'industry', 'description'] },
  lead_temperature: { required: true, fields: ['hot_threshold', 'warm_threshold', 'decay_percentage', 'decay_days'] },
  followup: { required: true, fields: ['sequence'] },
  sequence: { required: false, fields: ['delay_days', 'message_type', 'message_template'] },
  objections: { required: false, fields: ['trigger_patterns', 'response_pattern'] },
  handoff: { required: true, fields: ['required_fields', 'next_action'] },
  autonomy_zones: { required: true, fields: ['green', 'yellow', 'red'] },
  products: { required: false },
  industry_knowledge: { required: false },
  forbidden_topics: { required: false }
};

function loadTemplate(templateId) {
  const filePath = path.join(TEMPLATES_DIR, `template-${templateId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Template not found: ${templateId}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function loadClientConfig(clientId) {
  const filePath = path.join(TEMPLATES_DIR, `client-config-${clientId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Client config not found: ${clientId}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function validate(template) {
  const errors = [];
  for (const [section, rules] of Object.entries(SCHEMA)) {
    if (rules.required && !template[section]) {
      errors.push(`Missing required section: ${section}`);
      continue;
    }
    if (template[section] && rules.fields) {
      if (Array.isArray(template[section])) {
        template[section].forEach((item, i) => {
          rules.fields.forEach(f => {
            if (item[f] === undefined) {
              errors.push(`Missing field '${f}' in ${section}[${i}]`);
            }
          });
        });
      } else {
        rules.fields.forEach(f => {
          if (template[section][f] === undefined) {
            errors.push(`Missing field '${f}' in section '${section}'`);
          }
        });
      }
    }
  }
  if (template.meta && template.meta.version) {
    const parts = template.meta.version.split('.');
    if (parts.length !== 3 || parts.some(p => isNaN(parseInt(p)))) {
      errors.push(`Invalid semver version: ${template.meta.version}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function merge(template, clientConfig) {
  const merged = JSON.parse(JSON.stringify(template));
  if (!clientConfig || !clientConfig.overrides) return merged;
  const { overrides } = clientConfig;
  if (overrides.handoff_routing) {
    Object.assign(merged.handoff, overrides.handoff_routing);
  }
  if (overrides.autonomy_overrides) {
    Object.assign(merged.autonomy_zones, overrides.autonomy_overrides);
  }
  if (overrides.tariffs) {
    merged.products = merged.products || {};
    Object.assign(merged.products, overrides.tariffs);
  }
  return merged;
}

function resolvePlaceholders(text, leadData, clientConfig) {
  const overrides = clientConfig?.overrides || {};
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (leadData && leadData[key] !== undefined) return leadData[key];
    if (overrides[key] !== undefined) return overrides[key];
    return match;
  });
}

function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR)
    .filter(f => f.startsWith('template-') && f.endsWith('.json'))
    .map(f => ({
      id: f.replace('template-', '').replace('.json', ''),
      name: f.replace('.json', ''),
      path: path.join(TEMPLATES_DIR, f)
    }));
}

function listClientConfigs() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR)
    .filter(f => f.startsWith('client-config-') && f.endsWith('.json'))
    .map(f => ({
      id: f.replace('client-config-', '').replace('.json', ''),
      name: f.replace('.json', ''),
      path: path.join(TEMPLATES_DIR, f)
    }));
}

module.exports = {
  loadTemplate, loadClientConfig, validate, merge,
  resolvePlaceholders, listTemplates, listClientConfigs
};
