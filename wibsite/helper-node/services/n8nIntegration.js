'use strict';

const fs = require('fs');
const path = require('path');

const N8N_DIR = path.join(__dirname, '..', 'data', 'n8n');
if (!fs.existsSync(N8N_DIR)) fs.mkdirSync(N8N_DIR, { recursive: true });

const DEFAULT_WORKFLOWS = [
  {
    id: 'wf-inbound-whatsapp',
    name: 'Inbound WhatsApp Processing',
    trigger: 'webhook',
    webhook_path: '/webhook/inbound-whatsapp',
    steps: ['validate_webhook', 'parse_message', 'route_to_agent', 'store_conversation', 'send_reply'],
    status: 'active',
    tenant_id: null,
  },
  {
    id: 'wf-outbound-campaign',
    name: 'Outbound Campaign Sender',
    trigger: 'schedule',
    schedule: '*/5 * * * *',
    steps: ['check_queue', 'validate_template', 'send_message', 'update_status', 'log_delivery'],
    status: 'active',
    tenant_id: null,
  },
  {
    id: 'wf-followup-cadence',
    name: 'Follow-up Cadence Engine',
    trigger: 'schedule',
    schedule: '0 */1 * * *',
    steps: ['check_leads', 'calculate_next_followup', 'generate_message', 'send_if_business_hours'],
    status: 'active',
    tenant_id: null,
  },
  {
    id: 'wf-lead-scoring',
    name: 'Lead Scoring Recalculation',
    trigger: 'schedule',
    schedule: '0 0 * * *',
    steps: ['fetch_active_leads', 'calculate_temperature', 'update_scores', 'trigger_alerts'],
    status: 'active',
    tenant_id: null,
  },
  {
    id: 'wf-handoff-notifications',
    name: 'Handoff Notification System',
    trigger: 'webhook',
    webhook_path: '/webhook/handoff-event',
    steps: ['validate_event', 'find_assigned_agent', 'send_notification', 'update_handoff_status'],
    status: 'active',
    tenant_id: null,
  },
];

class N8nIntegration {
  constructor() {
    this.workflows = this._loadWorkflows();
    this.credentials = this._loadCredentials();
  }

  listWorkflows(tenantId = null) {
    if (tenantId) return this.workflows.filter(w => w.tenant_id === tenantId || w.tenant_id === null);
    return this.workflows;
  }

  getWorkflow(workflowId) {
    return this.workflows.find(w => w.id === workflowId) || null;
  }

  createWorkflow(data) {
    const workflow = {
      id: `wf-${Date.now()}`,
      name: data.name || 'New Workflow',
      trigger: data.trigger || 'webhook',
      webhook_path: data.webhook_path || `/webhook/${Date.now()}`,
      steps: data.steps || [],
      status: 'inactive',
      tenant_id: data.tenant_id || null,
      created_at: new Date().toISOString(),
    };
    this.workflows.push(workflow);
    this._saveWorkflows();
    return workflow;
  }

  updateWorkflow(workflowId, updates) {
    const idx = this.workflows.findIndex(w => w.id === workflowId);
    if (idx === -1) return null;
    this.workflows[idx] = { ...this.workflows[idx], ...updates, updated_at: new Date().toISOString() };
    this._saveWorkflows();
    return this.workflows[idx];
  }

  deleteWorkflow(workflowId) {
    const idx = this.workflows.findIndex(w => w.id === workflowId);
    if (idx === -1) return false;
    this.workflows.splice(idx, 1);
    this._saveWorkflows();
    return true;
  }

  activateWorkflow(workflowId) {
    return this.updateWorkflow(workflowId, { status: 'active', activated_at: new Date().toISOString() });
  }

  deactivateWorkflow(workflowId) {
    return this.updateWorkflow(workflowId, { status: 'inactive', deactivated_at: new Date().toISOString() });
  }

  storeCredential(name, credential) {
    this.credentials[name] = {
      name,
      type: credential.type || 'api_key',
      data: credential.data,
      created_at: new Date().toISOString(),
    };
    this._saveCredentials();
    return { name, stored: true };
  }

  getCredential(name) {
    return this.credentials[name] || null;
  }

  deleteCredential(name) {
    if (!this.credentials[name]) return false;
    delete this.credentials[name];
    this._saveCredentials();
    return true;
  }

  listCredentials() {
    return Object.keys(this.credentials).map(name => ({
      name,
      type: this.credentials[name].type,
      created_at: this.credentials[name].created_at,
    }));
  }

  getWebhookRoutes() {
    return this.workflows
      .filter(w => w.trigger === 'webhook' && w.status === 'active')
      .map(w => ({ path: w.webhook_path, workflow_id: w.id, name: w.name }));
  }

  getHealthStatus() {
    const active = this.workflows.filter(w => w.status === 'active').length;
    const total = this.workflows.length;
    return {
      status: active > 0 ? 'healthy' : 'no_active_workflows',
      active_workflows: active,
      total_workflows: total,
      credentials_count: Object.keys(this.credentials).length,
      webhook_routes: this.getWebhookRoutes().length,
    };
  }

  _loadWorkflows() {
    const file = path.join(N8N_DIR, 'workflows.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    return [...DEFAULT_WORKFLOWS];
  }

  _saveWorkflows() {
    fs.writeFileSync(path.join(N8N_DIR, 'workflows.json'), JSON.stringify(this.workflows, null, 2));
  }

  _loadCredentials() {
    const file = path.join(N8N_DIR, 'credentials.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    return {};
  }

  _saveCredentials() {
    fs.writeFileSync(path.join(N8N_DIR, 'credentials.json'), JSON.stringify(this.credentials, null, 2));
  }
}

module.exports = { N8nIntegration, DEFAULT_WORKFLOWS };
