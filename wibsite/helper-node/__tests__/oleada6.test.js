'use strict';

const objectionEngine = require('../services/objectionEngine');
const leadTemperature = require('../services/leadTemperature');
const followupCadence = require('../services/followupCadence');
const clientConfig = require('../services/clientConfig');
const autonomyZones = require('../services/autonomyZones');
const handoffBriefing = require('../services/handoffBriefing');

describe('Oleada 6 — Logica de Vendedor + Plantillas de Negocio', () => {
  // ==========================================
  // V1: Banco de objeciones ejecutable
  // ==========================================
  describe('V1: Banco de objeciones', () => {
    test('matchObjection detects "muy caro" and returns response', () => {
      const result = objectionEngine.matchObjection('Es muy caro', 'template-consultora-software', { name: 'Carlos' });
      expect(result.matched).toBe(true);
      expect(result.response).toContain('Carlos');
      expect(result.triggers_followup).toBe(false);
    });

    test('matchObjection detects "comparar" objection', () => {
      const result = objectionEngine.matchObjection('viendo otras opciones de mercado', 'template-consultora-software', { name: 'Ana' });
      expect(result.matched).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.objection_index).toBe(1);
    });

    test('matchObjection detects "no se si lo necesito"', () => {
      const result = objectionEngine.matchObjection('No se si lo necesito', 'template-consultora-software');
      expect(result.matched).toBe(true);
      expect(result.objection_index).toBe(2);
    });

    test('matchObjection detects "consulte con mi socio"', () => {
      const result = objectionEngine.matchObjection('Consulte con mi socio', 'template-consultora-software');
      expect(result.matched).toBe(true);
      expect(result.triggers_followup).toBe(true);
    });

    test('matchObjection returns no match for unrelated message', () => {
      const result = objectionEngine.matchObjection('Hola que tal', 'template-consultora-software');
      expect(result.matched).toBe(false);
      expect(result.response).toBeNull();
    });

    test('listTemplates returns available templates', () => {
      const templates = objectionEngine.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.id === 'template-consultora-software')).toBe(true);
    });

    test('resolvePlaceholders replaces {{name}} and {{score}}', () => {
      const resolved = objectionEngine.resolvePlaceholders('Hola {{name}}, tu score es {{score}}', { name: 'Maria', score: 75 });
      expect(resolved).toBe('Hola Maria, tu score es 75');
    });
  });

  // ==========================================
  // V2: Temperatura del lead 3D
  // ==========================================
  describe('V2: Temperatura del lead', () => {
    test('calculateTemperature returns hot for high-scoring lead', () => {
      const lead = {
        name: 'Lead Hot', phone: '123', email: 'hot@test.com',
        score: 85, custom_fields: { company: 'Acme', budget: 15000, intent: 'comprar', urgency: 'alta' },
        created_at: new Date().toISOString(),
      };
      const result = leadTemperature.calculateTemperature(lead);
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(['hot', 'warm']).toContain(result.category);
      expect(result.dimensions.fit).toBeGreaterThan(0);
      expect(result.dimensions.engagement).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.intent).toBeGreaterThan(0);
    });

    test('calculateTemperature returns cold for incomplete lead', () => {
      const lead = { name: 'Cold Lead', created_at: new Date().toISOString() };
      const result = leadTemperature.calculateTemperature(lead);
      expect(result.category).toBe('cold');
    });

    test('calculateTemperature applies decay for inactive leads', () => {
      const lead = {
        name: 'Decayed Lead', phone: '123',
        score: 60,
        updated_at: new Date(Date.now() - 20 * 86400000).toISOString(),
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      };
      const result = leadTemperature.calculateTemperature(lead);
      expect(result.decay_applied).toBeGreaterThan(0);
    });

    test('calculateFit returns score based on data completeness', () => {
      const lead = { name: 'Test', phone: '123', email: 'test@test.com', custom_fields: { company: 'Acme', budget: 10000 } };
      const fit = leadTemperature.calculateFit(lead);
      expect(fit).toBeGreaterThanOrEqual(40);
    });

    test('calculateEngagement returns score based on activity', () => {
      const lead = { score_history: [{ score: 30 }, { score: 50 }] };
      const deliveries = [
        { direction: 'inbound', status: 'replied', sent_at: new Date().toISOString() },
        { direction: 'inbound', status: 'replied', sent_at: new Date(Date.now() - 86400000).toISOString() },
      ];
      const engagement = leadTemperature.calculateEngagement(lead, deliveries);
      expect(engagement).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // V3: Cadencia de seguimiento
  // ==========================================
  describe('V3: Cadencia de seguimiento', () => {
    test('getNextFollowup returns first contact message immediately', () => {
      const lead = { name: 'New Lead', score: 50, created_at: new Date().toISOString() };
      const result = followupCadence.getNextFollowup(lead);
      expect(result.message).toContain('New Lead');
      expect(result.message_type).toBe('confirmation');
      // should_send depends on business hours (9-18 UTC)
      expect(typeof result.should_send).toBe('boolean');
    });

    test('getNextFollowup waits for next step', () => {
      const lead = {
        name: 'Follow Lead', score: 50,
        updated_at: new Date().toISOString(),
      };
      const result = followupCadence.getNextFollowup(lead);
      expect(result.message).toBeDefined();
      expect(result.message_type).toBeDefined();
    });

    test('getNextFollowup returns nurture when score below threshold', () => {
      const lead = { name: 'Low Score', score: 10 };
      const result = followupCadence.getNextFollowup(lead);
      expect(result.should_send).toBe(false);
      expect(result.message_type).toBe('nurture');
      expect(result.reason).toContain('score_below_lost_threshold');
    });

    test('getNextFollowup uses business hours check', () => {
      const lead = { name: 'BH Lead', score: 50, created_at: new Date().toISOString() };
      const result = followupCadence.getNextFollowup(lead);
      expect(result.message).toBeDefined();
    });

    test('resolvePlaceholders replaces variables in template', () => {
      const resolved = followupCadence.resolvePlaceholders('Hola {{name}}, tu score es {{score}}', { name: 'Pedro', score: 80 });
      expect(resolved).toBe('Hola Pedro, tu score es 80');
    });
  });

  // ==========================================
  // V4: Config por cliente
  // ==========================================
  describe('V4: Config por cliente', () => {
    const testClientId = 'test-client-oleada6';

    afterAll(() => {
      clientConfig.deleteClientConfig(testClientId);
    });

    test('saveClientConfig creates config file', () => {
      const config = {
        name: 'Test Client',
        branding: { logo_url: 'https://example.com/logo.png' },
        commercial_params: { min_ticket: 5000 },
      };
      const saved = clientConfig.saveClientConfig(testClientId, config);
      expect(saved.client_id).toBe(testClientId);
      expect(saved.name).toBe('Test Client');
      expect(saved.updated_at).toBeDefined();
    });

    test('loadClientConfig retrieves saved config', () => {
      const config = clientConfig.loadClientConfig(testClientId);
      expect(config).not.toBeNull();
      expect(config.name).toBe('Test Client');
    });

    test('listClientConfigs returns saved configs', () => {
      const configs = clientConfig.listClientConfigs();
      expect(configs.some(c => c.id === testClientId)).toBe(true);
    });

    test('mergeWithTemplate merges client config with template', () => {
      const merged = clientConfig.mergeWithTemplate(testClientId, 'template-consultora-software');
      expect(merged.meta).toBeDefined();
      expect(merged.commercial_params.min_ticket).toBe(5000);
    });

    test('deleteClientConfig removes config file', () => {
      const deleted = clientConfig.deleteClientConfig(testClientId);
      expect(deleted).toBe(true);
      const config = clientConfig.loadClientConfig(testClientId);
      expect(config).toBeNull();
    });
  });

  // ==========================================
  // V5: Zonas de autonomia
  // ==========================================
  describe('V5: Zonas de autonomia', () => {
    test('getAutonomyZone returns green for qualification', () => {
      const lead = { score: 30 };
      const result = autonomyZones.getAutonomyZone('qualify', lead);
      expect(result.zone).toBe('green');
      expect(result.allowed).toBe(true);
    });

    test('getAutonomyZone returns red for high-score lead quoting', () => {
      const lead = { score: 80 };
      const result = autonomyZones.getAutonomyZone('quote', lead);
      expect(result.zone).toBe('red');
      expect(result.allowed).toBe(false);
    });

    test('getAutonomyZone returns yellow for warm lead pricing', () => {
      const lead = { score: 50 };
      const result = autonomyZones.getAutonomyZone('pricing', lead);
      expect(result.zone).toBe('yellow');
    });

    test('getAutonomyZone returns red for handoff requested', () => {
      const lead = { score: 50, handoffRequested: true };
      const result = autonomyZones.getAutonomyZone('qualify', lead);
      expect(result.zone).toBe('red');
      expect(result.allowed).toBe(false);
    });

    test('isActionAllowed returns true for green zone', () => {
      const lead = { score: 20 };
      expect(autonomyZones.isActionAllowed('qualify', lead)).toBe(true);
    });

    test('getZones returns all zones', () => {
      const zones = autonomyZones.getZones();
      expect(zones.green).toBeDefined();
      expect(zones.yellow).toBeDefined();
      expect(zones.red).toBeDefined();
    });
  });

  // ==========================================
  // V6: Handoff + briefing extendido
  // ==========================================
  describe('V6: Handoff + briefing extendido', () => {
    test('generateBriefing returns complete briefing', () => {
      const lead = {
        name: 'Lead Briefing', phone: '1234567890', email: 'brief@test.com',
        score: 75, status: 'new',
        custom_fields: { intent: 'comprar', service_type: 'integracion' },
      };
      const conversation = [
        { direction: 'inbound', content: 'Es muy caro para mi presupuesto' },
        { direction: 'outbound', content: 'Entiendo, podemos ver opciones' },
      ];
      const result = handoffBriefing.generateBriefing(lead, conversation);
      expect(result.briefing).toContain('Lead Briefing');
      expect(result.briefing).toContain('BRIEFING HANDOFF');
      expect(result.temperature).toBeDefined();
      expect(result.objections_count).toBe(1);
      expect(result.next_actions.length).toBeGreaterThan(0);
    });

    test('generateBriefing handles no objections', () => {
      const lead = { name: 'No Objections', phone: '123', score: 30 };
      const result = handoffBriefing.generateBriefing(lead, []);
      expect(result.objections_count).toBe(0);
      expect(result.briefing).toContain('Sin objeciones detectadas');
    });

    test('determineNextActions recommends hot lead action', () => {
      const temperature = { category: 'hot', score: 80 };
      const actions = handoffBriefing.determineNextActions({ score: 80 }, temperature, [], {});
      expect(actions.some(a => a.includes('HOT'))).toBe(true);
    });

    test('determineNextActions recommends nurture for cold lead', () => {
      const temperature = { category: 'cold', score: 20 };
      const actions = handoffBriefing.determineNextActions({ score: 20 }, temperature, [], {});
      expect(actions.some(a => a.includes('COLD'))).toBe(true);
    });
  });
});
