'use strict';

const { SecretManager } = require('../services/secretManager');
const { PgStoreNew: PgStore } = require('../services/pgStoreNew');
const { N8nIntegration } = require('../services/n8nIntegration');
const { InboundFlowHandler } = require('../services/inboundFlowHandler');
const { ContactEnrichment } = require('../services/contactEnrichment');
const { CampaignQueue, PLAN_PRIORITY } = require('../services/campaignQueue');
const { AICampaignTemplates } = require('../services/aiCampaignTemplates');
const { AgentSegmentation } = require('../services/agentSegmentation');
const { ContactGroups } = require('../services/contactGroups');

describe('Oleada 9 — Remaining Issues + Security', () => {

  // ==========================================
  // #15 F6 + #10 T1: Security & Secrets
  // ==========================================
  describe('#15/#10: Security & Secret Management', () => {
    let mgr;
    beforeEach(() => { mgr = new SecretManager('test-master-key-32chars-long!!'); });

    test('encrypt and decrypt roundtrip', () => {
      const original = 'my-secret-api-key-12345';
      const encrypted = mgr.encrypt(original);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      const decrypted = mgr.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    test('storeSecret and getSecret', () => {
      const result = mgr.storeSecret('test-key', 'secret-value-123');
      expect(result.stored).toBe(true);
      const value = mgr.getSecret('test-key');
      expect(value).toBe('secret-value-123');
    });

    test('deleteSecret removes secret', () => {
      mgr.storeSecret('to-delete', 'value');
      const deleted = mgr.deleteSecret('to-delete');
      expect(deleted).toBe(true);
      expect(mgr.getSecret('to-delete')).toBeNull();
    });

    test('listSecrets returns stored secrets', () => {
      mgr.storeSecret('key1', 'v1');
      mgr.storeSecret('key2', 'v2');
      const list = mgr.listSecrets();
      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    test('validateKeyStrength validates strong keys', () => {
      const result = mgr.validateKeyStrength('MyStr0ng!Key#2024');
      expect(result.valid).toBe(true);
      expect(result.score).toBe(100);
    });

    test('validateKeyStrength rejects weak keys', () => {
      const result = mgr.validateKeyStrength('weak');
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('rotateSecret generates new value', () => {
      mgr.storeSecret('rotate-me', 'old-value');
      const rotated = mgr.rotateSecret('rotate-me');
      expect(rotated.rotated).toBe(true);
      expect(rotated.old_preview).toContain('***');
    });
  });

  // ==========================================
  // #5 P1: PostgreSQL Store
  // ==========================================
  describe('#5 P1: PostgreSQL Store', () => {
    let store;
    beforeEach(() => { store = new PgStore(); });

    test('insert creates record with id', () => {
      const record = store.insert('leads', { name: 'Test Lead', phone: '123' });
      expect(record.id).toBeDefined();
      expect(record.name).toBe('Test Lead');
      expect(record.created_at).toBeDefined();
    });

    test('findById retrieves record', () => {
      const inserted = store.insert('leads', { name: 'Find Me' });
      const found = store.findById('leads', inserted.id);
      expect(found).not.toBeNull();
      expect(found.name).toBe('Find Me');
    });

    test('findAll with filter', () => {
      store.insert('leads', { name: 'A', status: 'active' });
      store.insert('leads', { name: 'B', status: 'inactive' });
      const active = store.findAll('leads', { status: 'active' });
      expect(active.length).toBeGreaterThanOrEqual(1);
      expect(active.every(r => r.status === 'active')).toBe(true);
    });

    test('update modifies record', () => {
      const inserted = store.insert('leads', { name: 'Original' });
      const updated = store.update('leads', inserted.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');
      expect(updated.updated_at).not.toBe(inserted.created_at);
    });

    test('delete removes record', () => {
      const inserted = store.insert('leads', { name: 'Delete Me' });
      const deleted = store.delete('leads', inserted.id);
      expect(deleted).toBe(true);
      expect(store.findById('leads', inserted.id)).toBeNull();
    });

    test('count returns correct count', () => {
      const before = store.count('leads');
      store.insert('leads', { name: 'CountMe' });
      expect(store.count('leads')).toBe(before + 1);
    });

    test('getStats returns counts for all tables', () => {
      const stats = store.getStats();
      expect(stats.leads).toBeDefined();
      expect(stats.conversations).toBeDefined();
      expect(stats.messages).toBeDefined();
    });
  });

  // ==========================================
  // #6 P3: n8n Integration
  // ==========================================
  describe('#6 P3: n8n Integration', () => {
    let n8n;
    beforeEach(() => { n8n = new N8nIntegration(); });

    test('listWorkflows returns default workflows', () => {
      const wfs = n8n.listWorkflows();
      expect(wfs.length).toBeGreaterThanOrEqual(5);
    });

    test('getWorkflow returns specific workflow', () => {
      const wf = n8n.getWorkflow('wf-inbound-whatsapp');
      expect(wf).not.toBeNull();
      expect(wf.name).toBe('Inbound WhatsApp Processing');
    });

    test('createWorkflow adds new workflow', () => {
      const wf = n8n.createWorkflow({ name: 'Test Workflow', trigger: 'webhook' });
      expect(wf.id).toBeDefined();
      expect(wf.status).toBe('inactive');
    });

    test('activateWorkflow changes status', () => {
      const wf = n8n.createWorkflow({ name: 'To Activate' });
      const activated = n8n.activateWorkflow(wf.id);
      expect(activated.status).toBe('active');
    });

    test('deactivateWorkflow changes status', () => {
      const wf = n8n.createWorkflow({ name: 'To Deactivate' });
      n8n.activateWorkflow(wf.id);
      const deactivated = n8n.deactivateWorkflow(wf.id);
      expect(deactivated.status).toBe('inactive');
    });

    test('getWebhookRoutes returns active webhook workflows', () => {
      const routes = n8n.getWebhookRoutes();
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].path).toBeDefined();
    });

    test('storeCredential and getCredential', () => {
      n8n.storeCredential('twilio', { type: 'api_key', data: { key: 'abc123' } });
      const cred = n8n.getCredential('twilio');
      expect(cred).not.toBeNull();
      expect(cred.type).toBe('api_key');
    });

    test('getHealthStatus returns health info', () => {
      const health = n8n.getHealthStatus();
      expect(health.status).toBeDefined();
      expect(health.active_workflows).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // #14 V6: Flujo inbound real
  // ==========================================
  describe('#14 V6: Flujo inbound real', () => {
    let handler;
    beforeEach(() => { handler = new InboundFlowHandler(); });

    test('processInbound returns trace_id and evidence', async () => {
      const result = await handler.processInbound({ phone: '+521234567890', body: 'Hola' });
      expect(result.trace_id).toBeDefined();
      expect(result.evidence).toBeDefined();
      expect(result.evidence.trace_id).toBe(result.trace_id);
    });

    test('processInbound detects greeting intent', async () => {
      const result = await handler.processInbound({ phone: '+521234567890', body: 'Hola buenas tardes' });
      expect(result.intent.type).toBe('greeting');
      expect(result.intent.confidence).toBeGreaterThan(0.3);
    });

    test('processInbound detects handoff request', async () => {
      const result = await handler.processInbound({ phone: '+521234567890', body: 'Quiero hablar con un humano' });
      expect(result.intent.type).toBe('handoff');
      expect(result.routing.target).toBe('human_agent');
    });

    test('processInbound detects opt-out', async () => {
      const result = await handler.processInbound({ phone: '+521234567890', body: 'Cancelar' });
      expect(result.status).toBe('opt_out');
    });

    test('normalizePhone formats correctly', () => {
      expect(handler.normalizePhone('1234567890')).toBe('+521234567890');
      expect(handler.normalizePhone('+521234567890')).toBe('+521234567890');
    });

    test('checkOptOut detects opt-out keywords', () => {
      expect(handler.checkOptOut('Cancelar').is_opt_out).toBe(true);
      expect(handler.checkOptOut('STOP').is_opt_out).toBe(true);
      expect(handler.checkOptOut('Hola').is_opt_out).toBe(false);
    });

    test('getStats returns correct counts', async () => {
      await handler.processInbound({ phone: '+521234567890', body: 'Test' });
      const stats = handler.getStats();
      expect(stats.total).toBe(1);
    });
  });

  // ==========================================
  // #93 K3: Enriquecimiento de datos
  // ==========================================
  describe('#93 K3: Enriquecimiento de datos', () => {
    let enrichment;
    beforeEach(() => { enrichment = new ContactEnrichment(); });

    test('enrichContact returns enriched fields', async () => {
      const result = await enrichment.enrichContact('lead:1', { phone: '+521234567890', email: 'test@company.com' });
      expect(result.enriched_fields).toBeDefined();
      expect(result.enrichments.length).toBeGreaterThan(0);
    });

    test('enrichBulk processes multiple leads', () => {
      const leads = [
        { id: 'lead:1', phone: '+521234567890', email: 'a@test.com' },
        { id: 'lead:2', phone: '+520987654321', email: 'b@test.com' },
      ];
      const result = enrichment.enrichBulk(leads);
      expect(result.total).toBe(2);
      expect(result.enriched).toBeGreaterThanOrEqual(0);
    });

    test('getEnrichmentSources returns available sources', () => {
      const sources = enrichment.getEnrichmentSources();
      expect(sources.length).toBe(5);
      expect(sources.some(s => s.id === 'phone_lookup')).toBe(true);
    });

    test('getCacheStats returns cache info', () => {
      const stats = enrichment.getCacheStats();
      expect(stats.cached_entries).toBeDefined();
    });
  });

  // ==========================================
  // #91 C13: Colas campaña multi-tenant
  // ==========================================
  describe('#91 C13: Colas campaña multi-tenant', () => {
    let queue;
    beforeEach(() => { queue = new CampaignQueue(); });

    test('enqueue creates batch with plan priority', () => {
      const batch = queue.enqueue('camp:1', [{ lead_id: 'l1', phone: '123' }], 'tenant:1', 'enterprise');
      expect(batch.priority).toBe(1);
      expect(batch.plan_id).toBe('enterprise');
      expect(batch.recipients.length).toBe(1);
    });

    test('dequeue returns highest priority batch', () => {
      queue.enqueue('camp:1', [{ lead_id: 'l1', phone: '123' }], 'tenant:1', 'demo');
      queue.enqueue('camp:2', [{ lead_id: 'l2', phone: '456' }], 'tenant:1', 'enterprise');
      const batch = queue.dequeue();
      expect(batch.plan_id).toBe('enterprise');
    });

    test('processNext processes batch', () => {
      const batch = queue.enqueue('camp:1', [{ lead_id: 'l1', phone: '123' }], 'tenant:1', 'blue');
      const result = queue.processNext(batch.id);
      expect(result.processed).toBe(1);
    });

    test('getStats returns queue stats', () => {
      const before = queue.getStats().total_batches;
      queue.enqueue('camp:1', [{ lead_id: 'l1', phone: '123' }], 'tenant:1', 'blue');
      const stats = queue.getStats();
      expect(stats.total_batches).toBe(before + 1);
    });

    test('PLAN_PRIORITY has correct order', () => {
      expect(PLAN_PRIORITY.enterprise.priority).toBe(1);
      expect(PLAN_PRIORITY.promax.priority).toBe(2);
      expect(PLAN_PRIORITY.blue.priority).toBe(3);
      expect(PLAN_PRIORITY.demo.priority).toBe(4);
    });
  });

  // ==========================================
  // #88 F5: Plantillas campaña por IA
  // ==========================================
  describe('#88 F5: Plantillas campaña por IA', () => {
    let engine;
    beforeEach(() => { engine = new AICampaignTemplates(); });

    test('listTemplates returns all templates', () => {
      const templates = engine.listTemplates();
      expect(templates.length).toBe(6);
    });

    test('getTemplate returns specific template', () => {
      const tmpl = engine.getTemplate('tmpl-welcome-series');
      expect(tmpl).not.toBeNull();
      expect(tmpl.messages.length).toBe(3);
    });

    test('recommend returns top templates for lead', () => {
      const recs = engine.recommend({ score: 80, status: 'new' });
      expect(recs.length).toBe(3);
      expect(recs[0].recommendation_score).toBeGreaterThan(0);
    });

    test('recommend favors hot lead templates for high scores', () => {
      const recs = engine.recommend({ score: 90 });
      expect(recs.some(r => r.best_for.includes('hot_leads'))).toBe(true);
    });

    test('recommend favors reactivation for inactive leads', () => {
      const recs = engine.recommend({ score: 30, inactive_days: 20 });
      expect(recs.some(r => r.id === 'tmpl-reactivation')).toBe(true);
    });

    test('generatePersonalizedMessage replaces placeholders', () => {
      const msg = engine.generatePersonalizedMessage('tmpl-welcome-series', 0, { name: 'Carlos', product: 'Wibsite' });
      expect(msg).toContain('Carlos');
      expect(msg).toContain('Wibsite');
    });

    test('getStats returns category counts', () => {
      const stats = engine.getStats();
      expect(stats.total).toBe(6);
      expect(stats.categories.onboarding).toBe(1);
    });
  });

  // ==========================================
  // #35 F3: Segmentación activa por agente
  // ==========================================
  describe('#35 F3: Segmentación activa por agente', () => {
    let seg;
    beforeEach(() => { seg = new AgentSegmentation(); });

    test('listSegments returns default segments', () => {
      const segments = seg.listSegments();
      expect(segments.length).toBeGreaterThanOrEqual(5);
    });

    test('createSegment adds new segment', () => {
      const s = seg.createSegment({ name: 'VIP Leads', filters: { score_min: 90 } });
      expect(s.id).toBeDefined();
      expect(s.name).toBe('VIP Leads');
    });

    test('filterLeads applies score filter', () => {
      const leads = [{ id: 'l1', score: 80 }, { id: 'l2', score: 30 }];
      const filtered = seg.filterLeads(leads, { score_min: 50 });
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('l1');
    });

    test('filterLeads applies status filter', () => {
      const leads = [{ id: 'l1', status: 'active' }, { id: 'l2', status: 'inactive' }];
      const filtered = seg.filterLeads(leads, { status: 'active' });
      expect(filtered.length).toBe(1);
    });

    test('assignLeadsToSegment returns matching leads', () => {
      const leads = [{ id: 'l1', score: 80 }, { id: 'l2', score: 30 }];
      const result = seg.assignLeadsToSegment('seg-hot-leads', leads);
      expect(result.matching).toBe(1);
    });

    test('getSegmentsForLead returns matching segments', () => {
      const lead = { score: 80 };
      const segments = seg.getSegmentsForLead(lead);
      expect(segments.length).toBeGreaterThan(0);
    });

    test('getAutoAssignSegments returns auto-assign segments', () => {
      const auto = seg.getAutoAssignSegments();
      expect(auto.length).toBeGreaterThan(0);
      expect(auto.every(s => s.auto_assign)).toBe(true);
    });
  });

  // ==========================================
  // #34 F2: Grupos contactos + agrupador IA
  // ==========================================
  describe('#34 F2: Grupos contactos + agrupador IA', () => {
    let groups;
    beforeEach(() => { groups = new ContactGroups(); });

    test('createGroup creates new group', () => {
      const g = groups.createGroup({ name: 'VIP', type: 'manual' });
      expect(g.id).toBeDefined();
      expect(g.name).toBe('VIP');
    });

    test('addMembers adds leads to group', () => {
      const g = groups.createGroup({ name: 'Test' });
      const result = groups.addMembers(g.id, ['lead:1', 'lead:2']);
      expect(result.added).toBe(2);
      expect(result.total).toBe(2);
    });

    test('removeMembers removes leads from group', () => {
      const g = groups.createGroup({ name: 'Test' });
      groups.addMembers(g.id, ['lead:1', 'lead:2', 'lead:3']);
      const result = groups.removeMembers(g.id, ['lead:2']);
      expect(result.removed).toBe(1);
    });

    test('getGroupsForLead returns groups containing lead', () => {
      const before = groups.getGroupsForLead('lead:1').length;
      const g = groups.createGroup({ name: 'Test' });
      groups.addMembers(g.id, ['lead:1']);
      const result = groups.getGroupsForLead('lead:1');
      expect(result.length).toBe(before + 1);
    });

    test('aiGroupleads groups by score', () => {
      const leads = [
        { id: 'l1', score: 80 },
        { id: 'l2', score: 30 },
        { id: 'l3', score: 60 },
      ];
      const result = groups.aiGroupleads(leads, { by_score: true });
      expect(result.length).toBe(3);
      expect(result.some(g => g.name === 'hot')).toBe(true);
      expect(result.some(g => g.name === 'cold')).toBe(true);
    });

    test('aiGroupleads groups by status', () => {
      const leads = [
        { id: 'l1', status: 'active' },
        { id: 'l2', status: 'inactive' },
      ];
      const result = groups.aiGroupleads(leads, { by_status: true });
      expect(result.length).toBe(2);
    });

    test('mergeGroups combines members', () => {
      const g1 = groups.createGroup({ name: 'G1' });
      const g2 = groups.createGroup({ name: 'G2' });
      groups.addMembers(g1.id, ['lead:1']);
      groups.addMembers(g2.id, ['lead:2']);
      const merged = groups.mergeGroups([g1.id, g2.id], 'Merged');
      expect(merged.member_ids.length).toBe(2);
    });

    test('getStats returns group stats', () => {
      const stats = groups.getStats();
      expect(stats.total_groups).toBeDefined();
    });
  });
});
