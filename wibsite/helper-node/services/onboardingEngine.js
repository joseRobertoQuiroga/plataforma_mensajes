'use strict';

const { TenantHierarchy } = require('./tenantHierarchy');
const planRegistry = require('./planRegistry');

class OnboardingEngine {
  constructor() {
    this.hierarchy = new TenantHierarchy();
    this.STEPS = [
      { id: 'create_platform', name: 'Crear plataforma', required: true },
      { id: 'create_tenant', name: 'Crear tenant', required: true },
      { id: 'select_plan', name: 'Seleccionar plan', required: true },
      { id: 'create_branch', name: 'Crear sucursal', required: true },
      { id: 'create_admin_user', name: 'Crear usuario admin', required: true },
      { id: 'configure_branding', name: 'Configurar branding', required: false },
      { id: 'configure_greeting', name: 'Configurar saludo', required: false },
      { id: 'configure_templates', name: 'Configurar plantillas', required: false },
    ];
    this.MAX_DURATION_MS = 5 * 60 * 1000;
  }

  createDemoTenant(name, sector = 'consultora') {
    const start = Date.now();
    const results = { steps: [], errors: [], created_entities: {} };

    try {
      const platform = this.hierarchy.createPlatform({
        name: `${name} Platform`,
        plan_id: 'enterprise',
      });
      results.steps.push({ id: 'create_platform', status: 'completed', entity_id: platform.id });
      results.created_entities.platform = platform;

      const tenant = this.hierarchy.createTenant(platform.id, {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        plan_id: 'demo',
      });
      results.steps.push({ id: 'create_tenant', status: 'completed', entity_id: tenant.id });
      results.created_entities.tenant = tenant;

      const sub = planRegistry.createSubscription(tenant.id, 'demo', { skip_trial: false });
      results.steps.push({ id: 'select_plan', status: 'completed', subscription: sub });

      const branch = this.hierarchy.createBranch(tenant.id, {
        name: `${name} - Sede Principal`,
        code: 'HQ',
        timezone: 'America/Mexico_City',
      });
      results.steps.push({ id: 'create_branch', status: 'completed', entity_id: branch.id });
      results.created_entities.branch = branch;

      const adminUser = this.hierarchy.createUser(branch.id, {
        name: `${name} Admin`,
        email: `admin@${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
        role: 'admin',
      });
      results.steps.push({ id: 'create_admin_user', status: 'completed', entity_id: adminUser.id });
      results.created_entities.admin_user = adminUser;

      results.steps.push({ id: 'configure_branding', status: 'skipped', reason: 'use defaults' });
      results.steps.push({ id: 'configure_greeting', status: 'skipped', reason: 'use defaults' });
      results.steps.push({ id: 'configure_templates', status: 'skipped', reason: 'use defaults' });

      const duration = Date.now() - start;
      results.completed = true;
      results.duration_ms = duration;
      results.on_time = duration <= this.MAX_DURATION_MS;
      results.tenant_id = tenant.id;
      results.branch_id = branch.id;
      results.platform_id = platform.id;
      results.admin_user_id = adminUser.id;
    } catch (e) {
      results.errors.push(e.message);
      results.completed = false;
      results.duration_ms = Date.now() - start;
    }

    return results;
  }

  getStepStatus(onboardingResult, stepId) {
    if (!onboardingResult || !onboardingResult.steps) return null;
    return onboardingResult.steps.find(s => s.id === stepId) || null;
  }

  validateOnboarding(result) {
    const required = this.STEPS.filter(s => s.required);
    const errors = [];
    for (const step of required) {
      const status = this.getStepStatus(result, step.id);
      if (!status || status.status !== 'completed') {
        errors.push(`Required step '${step.id}' not completed`);
      }
    }
    return { valid: errors.length === 0, errors, total_steps: this.STEPS.length, completed_steps: result?.steps?.filter(s => s.status === 'completed').length || 0 };
  }

  getDemoLimits() {
    return planRegistry.getPlan('demo');
  }

  cleanupOnboarding(tenantId) {
    const entity = this.hierarchy.get(tenantId);
    if (!entity) return false;
    const descendants = this.hierarchy.getDescendants(tenantId);
    for (const d of descendants) {
      this.hierarchy.delete(d.id);
    }
    this.hierarchy.delete(tenantId);
    return true;
  }
}

module.exports = { OnboardingEngine };
