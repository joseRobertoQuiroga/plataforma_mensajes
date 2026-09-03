'use strict';

const fs = require('fs');
const path = require('path');

const PLANS_DIR = path.join(__dirname, '..', 'data', 'plans');
const SUBS_DIR = path.join(__dirname, '..', 'data', 'subscriptions');
if (!fs.existsSync(PLANS_DIR)) fs.mkdirSync(PLANS_DIR, { recursive: true });
if (!fs.existsSync(SUBS_DIR)) fs.mkdirSync(SUBS_DIR, { recursive: true });

const PLANS = {
  demo: {
    id: 'demo',
    name: 'Demo',
    tier: 0,
    monthly_price: 0,
    annual_price: 0,
    currency: 'USD',
    limits: { max_branches: 1, max_users: 2, max_leads: 100, max_messages_day: 500, max_templates: 3, max_copilot_queries_day: 50 },
    features: ['basic_chat', 'basic_templates'],
    trial_days: 14,
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    tier: 1,
    monthly_price: 99,
    annual_price: 990,
    currency: 'USD',
    limits: { max_branches: 3, max_users: 10, max_leads: 2000, max_messages_day: 10000, max_templates: 10, max_copilot_queries_day: 200 },
    features: ['basic_chat', 'basic_templates', 'copilot', 'followup_cadence', 'lead_temperature'],
  },
  promax: {
    id: 'promax',
    name: 'ProMax',
    tier: 2,
    monthly_price: 299,
    annual_price: 2990,
    currency: 'USD',
    limits: { max_branches: 10, max_users: 50, max_leads: 20000, max_messages_day: 100000, max_templates: 50, max_copilot_queries_day: 1000 },
    features: ['basic_chat', 'basic_templates', 'copilot', 'followup_cadence', 'lead_temperature', 'objection_engine', 'autonomy_zones', 'handoff_briefing', 'multi_branch'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 3,
    monthly_price: 999,
    annual_price: 9990,
    currency: 'USD',
    limits: { max_branches: 100, max_users: 500, max_leads: 200000, max_messages_day: 1000000, max_templates: 200, max_copilot_queries_day: 10000 },
    features: ['basic_chat', 'basic_templates', 'copilot', 'followup_cadence', 'lead_temperature', 'objection_engine', 'autonomy_zones', 'handoff_briefing', 'multi_branch', 'custom_branding', 'api_access', 'priority_support'],
  },
};

function listPlans() {
  return Object.values(PLANS);
}

function getPlan(planId) {
  return PLANS[planId] || null;
}

function createSubscription(tenantId, planId, billing = {}) {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Plan ${planId} not found`);
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + (plan.trial_days || 0));
  const sub = {
    id: `sub:${tenantId}:${Date.now()}`,
    tenant_id: tenantId,
    plan_id: planId,
    status: billing.skip_trial === true ? 'active' : 'trialing',
    billing_cycle: billing.billing_cycle || 'monthly',
    billing_provider: billing.provider || 'manual',
    current_period_start: now.toISOString(),
    current_period_end: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString(),
    trial_end: trialEnd.toISOString(),
    created_at: now.toISOString(),
  };
  const file = path.join(SUBS_DIR, `${sub.id.replace(/:/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(sub, null, 2));
  return sub;
}

function getSubscription(subId) {
  const file = path.join(SUBS_DIR, `${subId.replace(/:/g, '-')}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getSubscriptionForTenant(tenantId) {
  if (!fs.existsSync(SUBS_DIR)) return null;
  const files = fs.readdirSync(SUBS_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const sub = JSON.parse(fs.readFileSync(path.join(SUBS_DIR, f), 'utf8'));
    if (sub.tenant_id === tenantId && (sub.status === 'active' || sub.status === 'trialing')) {
      return sub;
    }
  }
  return null;
}

function updateSubscriptionStatus(subId, status) {
  const sub = getSubscription(subId);
  if (!sub) return null;
  sub.status = status;
  sub.updated_at = new Date().toISOString();
  const file = path.join(SUBS_DIR, `${subId.replace(/:/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(sub, null, 2));
  return sub;
}

function checkLimit(tenantId, metric, amount = 1) {
  const sub = getSubscriptionForTenant(tenantId);
  if (!sub) return { allowed: false, reason: 'no_subscription', usage: 0, limit: 0 };
  const plan = PLANS[sub.plan_id];
  if (!plan) return { allowed: false, reason: 'plan_not_found', usage: 0, limit: 0 };
  const limit = plan.limits[metric] || 0;
  return { allowed: amount <= limit, usage: amount, limit, plan: plan.id, metric };
}

function clearData() {
  if (fs.existsSync(SUBS_DIR)) {
    fs.readdirSync(SUBS_DIR).forEach(f => fs.unlinkSync(path.join(SUBS_DIR, f)));
  }
}

module.exports = {
  PLANS,
  listPlans,
  getPlan,
  createSubscription,
  getSubscription,
  getSubscriptionForTenant,
  updateSubscriptionStatus,
  checkLimit,
  clearData,
};
