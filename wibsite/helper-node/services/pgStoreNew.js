'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'pg_store');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

class PgStoreNew {
  constructor(config = {}) {
    this.mode = config.mode || process.env.STORE_MODE || 'json';
    this.tables = {};
    this._initTables();
  }

  _initTables() {
    const tableDefs = {
      leads: ['id', 'name', 'phone', 'email', 'score', 'status', 'tenant_id', 'branch_id', 'created_at', 'updated_at'],
      conversations: ['id', 'lead_id', 'phone', 'state', 'tenant_id', 'branch_id', 'agent_id', 'started_at', 'last_message_at'],
      messages: ['id', 'conversation_id', 'direction', 'content', 'status', 'sent_at', 'tenant_id'],
      campaigns: ['id', 'name', 'template_id', 'status', 'tenant_id', 'branch_id', 'scheduled_at', 'created_at'],
      campaign_recipients: ['id', 'campaign_id', 'lead_id', 'status', 'sent_at', 'delivered_at', 'tenant_id'],
      agents: ['id', 'name', 'email', 'role', 'tenant_id', 'branch_id', 'status', 'created_at'],
      audit_logs: ['id', 'event_type', 'actor', 'target', 'details', 'tenant_id', 'created_at'],
      templates: ['id', 'name', 'sector', 'content', 'tenant_id', 'created_at'],
      client_configs: ['id', 'client_id', 'name', 'config', 'tenant_id', 'created_at'],
      subscriptions: ['id', 'tenant_id', 'plan_id', 'status', 'current_period_start', 'current_period_end'],
    };

    for (const [table, columns] of Object.entries(tableDefs)) {
      const tableDir = path.join(DATA_DIR, table);
      if (!fs.existsSync(tableDir)) fs.mkdirSync(tableDir, { recursive: true });
      this.tables[table] = { columns, dir: tableDir };
    }
  }

  insert(table, record) {
    if (!this.tables[table]) throw new Error(`Table ${table} not found`);
    const id = record.id || `${table}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const fullRecord = { id, created_at: now, updated_at: now, ...record };
    const file = path.join(this.tables[table].dir, `${id.replace(/:/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(fullRecord, null, 2));
    return fullRecord;
  }

  findById(table, id) {
    if (!this.tables[table]) return null;
    const file = path.join(this.tables[table].dir, `${id.replace(/:/g, '-')}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  findAll(table, filter = {}) {
    if (!this.tables[table]) return [];
    const files = fs.readdirSync(this.tables[table].dir).filter(f => f.endsWith('.json'));
    let records = files.map(f => JSON.parse(fs.readFileSync(path.join(this.tables[table].dir, f), 'utf8')));
    for (const [key, value] of Object.entries(filter)) {
      records = records.filter(r => r[key] === value);
    }
    return records;
  }

  update(table, id, updates) {
    const record = this.findById(table, id);
    if (!record) return null;
    const updated = { ...record, ...updates, updated_at: new Date().toISOString() };
    const file = path.join(this.tables[table].dir, `${id.replace(/:/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(updated, null, 2));
    return updated;
  }

  delete(table, id) {
    const file = path.join(this.tables[table].dir, `${id.replace(/:/g, '-')}.json`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
    return false;
  }

  count(table, filter = {}) {
    return this.findAll(table, filter).length;
  }

  getStats() {
    const stats = {};
    for (const [table] of Object.entries(this.tables)) {
      stats[table] = this.count(table);
    }
    return stats;
  }
}

module.exports = { PgStoreNew };
