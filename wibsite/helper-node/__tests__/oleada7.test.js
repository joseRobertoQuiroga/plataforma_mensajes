'use strict';

const { TenantHierarchy, tenantMiddleware, HIERARCHY, HIERARCHY_DEPTH } = require('../services/tenantHierarchy');
const planRegistry = require('../services/planRegistry');
const { OnboardingEngine } = require('../services/onboardingEngine');

describe('Oleada 7 — Multi-tenant + SaaS Ops', () => {
  let hierarchy;
  let onboarding;

  beforeEach(() => {
    hierarchy = new TenantHierarchy();
    onboarding = new OnboardingEngine();
  });

  afterEach(() => {
    planRegistry.clearData();
  });

  // ==========================================
  // G18-01: Jerarquía y modelo de tenants
  // ==========================================
  describe('G18-01: Jerarquía y modelo de tenants', () => {
    test('HIERARCHY has 4 levels: platform, tenant, branch, user', () => {
      expect(HIERARCHY).toEqual(['platform', 'tenant', 'branch', 'user']);
      expect(HIERARCHY_DEPTH).toBe(4);
    });

    test('createPlatform creates root entity', () => {
      const platform = hierarchy.createPlatform({ name: 'Test Platform' });
      expect(platform.id).toMatch(/^platform:/);
      expect(platform.type).toBe('platform');
      expect(platform.parent_id).toBeNull();
      expect(platform.name).toBe('Test Platform');
      expect(platform.limits.max_tenants).toBeGreaterThan(0);
    });

    test('createTenant creates child of platform', () => {
      const platform = hierarchy.createPlatform({ name: 'Platform' });
      const tenant = hierarchy.createTenant(platform.id, { name: 'Tenant A', slug: 'tenant-a' });
      expect(tenant.id).toMatch(/^tenant:/);
      expect(tenant.parent_id).toBe(platform.id);
      expect(tenant.children).toEqual([]);
    });

    test('createBranch creates child of tenant', () => {
      const platform = hierarchy.createPlatform({ name: 'Platform' });
      const tenant = hierarchy.createTenant(platform.id, { name: 'Tenant' });
      const branch = hierarchy.createBranch(tenant.id, { name: 'Branch HQ' });
      expect(branch.id).toMatch(/^branch:/);
      expect(branch.parent_id).toBe(tenant.id);
    });

    test('createUser creates child of branch', () => {
      const platform = hierarchy.createPlatform({ name: 'P' });
      const tenant = hierarchy.createTenant(platform.id, { name: 'T' });
      const branch = hierarchy.createBranch(tenant.id, { name: 'B' });
      const user = hierarchy.createUser(branch.id, { name: 'Agent 1', email: 'agent@test.com' });
      expect(user.id).toMatch(/^user:/);
      expect(user.parent_id).toBe(branch.id);
      expect(user.role).toBe('agent');
    });

    test('get retrieves entity by id', () => {
      const platform = hierarchy.createPlatform({ name: 'Platform' });
      const retrieved = hierarchy.get(platform.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved.id).toBe(platform.id);
    });

    test('getAncestors returns chain from entity to root', () => {
      const platform = hierarchy.createPlatform({ name: 'P' });
      const tenant = hierarchy.createTenant(platform.id, { name: 'T' });
      const branch = hierarchy.createBranch(tenant.id, { name: 'B' });
      const user = hierarchy.createUser(branch.id, { name: 'U' });
      const ancestors = hierarchy.getAncestors(user.id);
      expect(ancestors.length).toBe(3);
      expect(ancestors[0].id).toBe(platform.id);
      expect(ancestors[1].id).toBe(tenant.id);
      expect(ancestors[2].id).toBe(branch.id);
    });

    test('getDescendants returns all children recursively', () => {
      const platform = hierarchy.createPlatform({ name: 'P' });
      const tenant = hierarchy.createTenant(platform.id, { name: 'T' });
      const branch = hierarchy.createBranch(tenant.id, { name: 'B' });
      hierarchy.createUser(branch.id, { name: 'U1' });
      hierarchy.createUser(branch.id, { name: 'U2' });
      const descendants = hierarchy.getDescendants(platform.id);
      expect(descendants.length).toBeGreaterThanOrEqual(3);
    });

    test('getTenantForUser returns tenant ancestor', () => {
      const platform = hierarchy.createPlatform({ name: 'P' });
      const tenant = hierarchy.createTenant(platform.id, { name: 'T' });
      const branch = hierarchy.createBranch(tenant.id, { name: 'B' });
      const user = hierarchy.createUser(branch.id, { name: 'U' });
      const tenantFound = hierarchy.getTenantForUser(user.id);
      expect(tenantFound).not.toBeNull();
      expect(tenantFound.type).toBe('tenant');
    });

    test('delete removes entity and updates parent', () => {
      const platform = hierarchy.createPlatform({ name: 'P' });
      const tenant = hierarchy.createTenant(platform.id, { name: 'T' });
      const deleted = hierarchy.delete(tenant.id);
      expect(deleted).toBe(true);
      const retrieved = hierarchy.get(tenant.id);
      expect(retrieved).toBeNull();
    });

    test('createTenant throws when platform limit reached', () => {
      const platform = hierarchy.createPlatform({ name: 'P', limits: { max_tenants: 1 } });
      hierarchy.createTenant(platform.id, { name: 'T1' });
      expect(() => hierarchy.createTenant(platform.id, { name: 'T2' })).toThrow('Tenant limit reached');
    });
  });

  // ==========================================
  // G18-02: Tenant isolation middleware
  // ==========================================
  describe('G18-02: Tenant isolation middleware', () => {
    test('tenantMiddleware sets req.tenant when x-tenant-id header present', () => {
      const platform = hierarchy.createPlatform({ name: 'P' });
      const tenant = hierarchy.createTenant(platform.id, { name: 'T' });
      const req = { headers: { 'x-tenant-id': tenant.id }, query: {} };
      const res = { status: () => res, json: () => res };
      let nextCalled = false;
      tenantMiddleware(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(req.tenant).toBeDefined();
      expect(req.tenant_id).toBe(tenant.id);
      expect(req.tenant_path).toContain(tenant.id);
    });

    test('tenantMiddleware passes through without header', () => {
      const req = { headers: {}, query: {} };
      const res = { status: () => res, json: () => res };
      let nextCalled = false;
      tenantMiddleware(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(req.tenant).toBeUndefined();
    });

    test('tenantMiddleware returns 404 for invalid tenant', () => {
      const req = { headers: { 'x-tenant-id': 'tenant:nonexistent' }, query: {} };
      let statusCode = 0;
      let responseBody = null;
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (body) => { responseBody = body; return res; },
      };
      tenantMiddleware(req, res, () => {});
      expect(statusCode).toBe(404);
      expect(responseBody.error).toBe('Tenant not found');
    });
  });

  // ==========================================
  // G18-03: Planes y facturación
  // ==========================================
  describe('G18-03: Planes y facturación', () => {
    test('listPlans returns 4 plans', () => {
      const plans = planRegistry.listPlans();
      expect(plans.length).toBe(4);
      expect(plans.map(p => p.id)).toContain('demo');
      expect(plans.map(p => p.id)).toContain('blue');
      expect(plans.map(p => p.id)).toContain('promax');
      expect(plans.map(p => p.id)).toContain('enterprise');
    });

    test('getPlan returns specific plan', () => {
      const plan = planRegistry.getPlan('blue');
      expect(plan).not.toBeNull();
      expect(plan.name).toBe('Blue');
      expect(plan.monthly_price).toBe(99);
      expect(plan.limits.max_users).toBe(10);
    });

    test('getPlan returns null for unknown plan', () => {
      expect(planRegistry.getPlan('unknown')).toBeNull();
    });

    test('createSubscription creates active subscription', () => {
      const sub = planRegistry.createSubscription('tenant:test', 'blue', { skip_trial: true });
      expect(sub.id).toMatch(/^sub:/);
      expect(sub.tenant_id).toBe('tenant:test');
      expect(sub.plan_id).toBe('blue');
      expect(sub.status).toBe('active');
    });

    test('createSubscription creates trial by default', () => {
      const sub = planRegistry.createSubscription('tenant:test', 'demo');
      expect(sub.status).toBe('trialing');
      expect(sub.trial_end).toBeDefined();
    });

    test('getSubscriptionForTenant returns active subscription', () => {
      planRegistry.createSubscription('tenant:t1', 'promax', { skip_trial: true });
      const sub = planRegistry.getSubscriptionForTenant('tenant:t1');
      expect(sub).not.toBeNull();
      expect(sub.plan_id).toBe('promax');
    });

    test('updateSubscriptionStatus changes status', () => {
      const sub = planRegistry.createSubscription('tenant:t1', 'blue', { skip_trial: true });
      const updated = planRegistry.updateSubscriptionStatus(sub.id, 'past_due');
      expect(updated.status).toBe('past_due');
    });

    test('checkLimit returns allowed for within plan limits', () => {
      planRegistry.createSubscription('tenant:t1', 'blue', { skip_trial: true });
      const result = planRegistry.checkLimit('tenant:t1', 'max_users', 5);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
    });

    test('checkLimit returns not allowed for exceeded limits', () => {
      planRegistry.createSubscription('tenant:t1', 'demo', { skip_trial: true });
      const result = planRegistry.checkLimit('tenant:t1', 'max_users', 100);
      expect(result.allowed).toBe(false);
    });

    test('checkLimit returns no_subscription for unknown tenant', () => {
      const result = planRegistry.checkLimit('tenant:unknown', 'max_users');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no_subscription');
    });
  });

  // ==========================================
  // G16-03: Template salón de eventos
  // ==========================================
  describe('G16-03: Template salón de eventos', () => {
    let template;

    beforeAll(() => {
      const fs = require('fs');
      const path = require('path');
      const tplPath = path.join(__dirname, '..', 'templates', 'template-event-hall.json');
      let raw = fs.readFileSync(tplPath, 'utf8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      template = JSON.parse(raw);
    });

    test('template has correct id and sector', () => {
      expect(template.id).toBe('template-event-hall');
      expect(template.sector).toBe('event_hall');
    });

    test('template has fit_criteria with event_types', () => {
      expect(template.fit_criteria.event_types).toContain('boda');
      expect(template.fit_criteria.event_types).toContain('xv_anos');
      expect(template.fit_criteria.event_types).toContain('corporativo');
    });

    test('template has temperature_scoring with 3D weights', () => {
      expect(template.temperature_scoring.fit.weight).toBe(0.30);
      expect(template.temperature_scoring.engagement.weight).toBe(0.40);
      expect(template.temperature_scoring.intent.weight).toBe(0.30);
    });

    test('template has followup sequence with 6 steps', () => {
      expect(template.followup.sequence.length).toBe(6);
      expect(template.followup.sequence[0].type).toBe('confirmation');
    });

    test('template has 5 objections', () => {
      expect(template.objections.length).toBe(5);
    });

    test('template has autonomy zones (green/yellow/red)', () => {
      expect(template.autonomy.green).toContain('qualify');
      expect(template.autonomy.yellow).toContain('pricing');
      expect(template.autonomy.red).toContain('commit');
    });

    test('template has snippets with placeholders', () => {
      expect(template.snippets.pricing).toContain('{{min_ticket}}');
      expect(template.snippets.visit).toContain('visita');
    });

    test('template has handoff config with briefing_template', () => {
      expect(template.handoff.trigger_score).toBe(70);
      expect(template.handoff.briefing_template).toContain('EVENTO');
    });

    test('template has commercial_params with booking_deposit_pct', () => {
      expect(template.commercial_params.booking_deposit_pct).toBe(30);
      expect(template.commercial_params.currency).toBe('MXN');
    });
  });

  // ==========================================
  // F-53: Auto-onboarding (<5 min)
  // ==========================================
  describe('F-53: Auto-onboarding (<5 min)', () => {
    afterEach(() => {
      onboarding.cleanupOnboarding('tenant:demo-test');
    });

    test('createDemoTenant completes all required steps', () => {
      const result = onboarding.createDemoTenant('Demo Test', 'consultora');
      expect(result.completed).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.steps.length).toBe(8);
      expect(result.steps.filter(s => s.status === 'completed').length).toBe(5);
    });

    test('createDemoTenant creates correct entities', () => {
      const result = onboarding.createDemoTenant('Demo Test');
      expect(result.created_entities.platform).toBeDefined();
      expect(result.created_entities.tenant).toBeDefined();
      expect(result.created_entities.branch).toBeDefined();
      expect(result.created_entities.admin_user).toBeDefined();
    });

    test('createDemoTenant completes within 5 minutes', () => {
      const result = onboarding.createDemoTenant('Demo Test');
      expect(result.on_time).toBe(true);
      expect(result.duration_ms).toBeLessThan(5 * 60 * 1000);
    });

    test('createDemoTenant creates demo subscription', () => {
      const result = onboarding.createDemoTenant('Demo Test');
      expect(result.steps.find(s => s.id === 'select_plan').subscription).toBeDefined();
    });

    test('validateOnboarding returns valid for complete result', () => {
      const result = onboarding.createDemoTenant('Demo Test');
      const validation = onboarding.validateOnboarding(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('validateOnboarding returns invalid for incomplete result', () => {
      const incomplete = {
        steps: [
          { id: 'create_platform', status: 'completed' },
          { id: 'create_tenant', status: 'completed' },
        ],
      };
      const validation = onboarding.validateOnboarding(incomplete);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('cleanupOnboarding removes all created entities', () => {
      const result = onboarding.createDemoTenant('Demo Test');
      const deleted = onboarding.cleanupOnboarding(result.tenant_id);
      expect(deleted).toBe(true);
      expect(hierarchy.get(result.tenant_id)).toBeNull();
    });

    test('getDemoLimits returns demo plan', () => {
      const plan = onboarding.getDemoLimits();
      expect(plan.id).toBe('demo');
      expect(plan.limits.max_users).toBe(2);
    });
  });
});
