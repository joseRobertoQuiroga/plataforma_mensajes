'use strict';

const fs = require('fs');
const path = require('path');

const QUEUE_DIR = path.join(__dirname, '..', 'data', 'campaign_queue');
if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });

const PLAN_PRIORITY = {
  enterprise: { priority: 1, max_concurrent: 100, rate_limit_per_min: 200 },
  promax: { priority: 2, max_concurrent: 50, rate_limit_per_min: 100 },
  blue: { priority: 3, max_concurrent: 20, rate_limit_per_min: 50 },
  demo: { priority: 4, max_concurrent: 5, rate_limit_per_min: 10 },
};

class CampaignQueue {
  constructor() {
    this.queue = this._loadQueue();
    this.processing = false;
  }

  enqueue(campaignId, recipients, tenantId, planId = 'demo') {
    const planConfig = PLAN_PRIORITY[planId] || PLAN_PRIORITY.demo;
    const batch = {
      id: `batch:${campaignId}:${Date.now()}`,
      campaign_id: campaignId,
      tenant_id: tenantId,
      plan_id: planId,
      priority: planConfig.priority,
      max_concurrent: planConfig.max_concurrent,
      rate_limit_per_min: planConfig.rate_limit_per_min,
      recipients: recipients.map(r => ({
        lead_id: r.lead_id || r.id,
        phone: r.phone,
        status: 'queued',
        queued_at: new Date().toISOString(),
      })),
      status: 'queued',
      created_at: new Date().toISOString(),
      processed_count: 0,
      sent_count: 0,
      failed_count: 0,
    };
    this.queue.push(batch);
    this._saveQueue();
    return batch;
  }

  dequeue() {
    const queued = this.queue.filter(b => b.status === 'queued');
    if (queued.length === 0) return null;
    queued.sort((a, b) => a.priority - b.priority || new Date(a.created_at) - new Date(b.created_at));
    const batch = queued[0];
    batch.status = 'processing';
    batch.started_at = new Date().toISOString();
    this._saveQueue();
    return batch;
  }

  processNext(batchId) {
    const batch = this.queue.find(b => b.id === batchId);
    if (!batch) return null;
    const pending = batch.recipients.filter(r => r.status === 'queued');
    if (pending.length === 0) {
      batch.status = 'completed';
      batch.completed_at = new Date().toISOString();
      this._saveQueue();
      return { batch, completed: true };
    }
    const toProcess = pending.slice(0, batch.max_concurrent);
    for (const r of toProcess) {
      r.status = 'processing';
      r.processed_at = new Date().toISOString();
    }
    batch.processed_count += toProcess.length;
    this._saveQueue();
    return { batch, processed: toProcess.length, remaining: pending.length - toProcess.length };
  }

  markSent(batchId, leadId) {
    const batch = this.queue.find(b => b.id === batchId);
    if (!batch) return false;
    const recipient = batch.recipients.find(r => r.lead_id === leadId);
    if (!recipient) return false;
    recipient.status = 'sent';
    recipient.sent_at = new Date().toISOString();
    batch.sent_count++;
    this._saveQueue();
    return true;
  }

  markFailed(batchId, leadId, reason) {
    const batch = this.queue.find(b => b.id === batchId);
    if (!batch) return false;
    const recipient = batch.recipients.find(r => r.lead_id === leadId);
    if (!recipient) return false;
    recipient.status = 'failed';
    recipient.failed_at = new Date().toISOString();
    recipient.failure_reason = reason;
    batch.failed_count++;
    this._saveQueue();
    return true;
  }

  getBatch(batchId) {
    return this.queue.find(b => b.id === batchId) || null;
  }

  getQueueByTenant(tenantId) {
    return this.queue.filter(b => b.tenant_id === tenantId);
  }

  getQueueByPriority() {
    return [...this.queue].sort((a, b) => a.priority - b.priority);
  }

  getStats() {
    const total = this.queue.length;
    const queued = this.queue.filter(b => b.status === 'queued').length;
    const processing = this.queue.filter(b => b.status === 'processing').length;
    const completed = this.queue.filter(b => b.status === 'completed').length;
    const totalRecipients = this.queue.reduce((sum, b) => sum + b.recipients.length, 0);
    const totalSent = this.queue.reduce((sum, b) => sum + b.sent_count, 0);
    const totalFailed = this.queue.reduce((sum, b) => sum + b.failed_count, 0);
    return { total_batches: total, queued, processing, completed, total_recipients: totalRecipients, total_sent: totalSent, total_failed: totalFailed };
  }

  getPlanConfig(planId) {
    return PLAN_PRIORITY[planId] || null;
  }

  getAllPlanConfigs() {
    return PLAN_PRIORITY;
  }

  _loadQueue() {
    const file = path.join(QUEUE_DIR, 'queue.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    return [];
  }

  _saveQueue() {
    fs.writeFileSync(path.join(QUEUE_DIR, 'queue.json'), JSON.stringify(this.queue, null, 2));
  }
}

module.exports = { CampaignQueue, PLAN_PRIORITY };
