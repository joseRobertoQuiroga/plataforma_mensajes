'use strict';

const { CommercialFlowValidator, FLOW_STAGES, VALID_TRANSITIONS } = require('../services/commercialFlowValidator');
const { DataValidationEngine } = require('../services/dataValidationEngine');
const { AdversarialQuestionEngine, ADVERSARIAL_QUESTIONS, FORBIDDEN_TOPICS } = require('../services/adversarialEngine');
const { AgentBehaviorSuite, CTX04_SCRIPTS } = require('../services/agentBehaviorSuite');

describe('Oleada 8 — Quality + Validation', () => {
  // ==========================================
  // G15-01: Validador de flujo comercial
  // ==========================================
  describe('G15-01: Validador de flujo comercial 8 etapas', () => {
    let validator;

    beforeEach(() => { validator = new CommercialFlowValidator(); });

    test('FLOW_STAGES has 9 stages (apertura to seguimiento)', () => {
      expect(FLOW_STAGES.length).toBe(9);
      expect(FLOW_STAGES[0]).toBe('apertura');
      expect(FLOW_STAGES[FLOW_STAGES.length - 1]).toBe('seguimiento');
    });

    test('canTransition allows valid transitions', () => {
      expect(validator.canTransition('apertura', 'calificacion')).toBe(true);
      expect(validator.canTransition('calificacion', 'propuesta_valor')).toBe(true);
      expect(validator.canTransition('profundizacion', 'cierre')).toBe(true);
      expect(validator.canTransition('objeciones', 'handoff')).toBe(true);
    });

    test('canTransition blocks invalid transitions', () => {
      expect(validator.canTransition('apertura', 'cierre')).toBe(false);
      expect(validator.canTransition('calificacion', 'handoff')).toBe(false);
      expect(validator.canTransition('seguimiento', 'apertura')).toBe(false);
    });

    test('validateConversation returns valid for correct flow', () => {
      const messages = [
        { direction: 'inbound', content: 'Hola' },
        { direction: 'outbound', content: 'Hola, bienvenido. ¿Cómo te puedo ayudar?' },
        { direction: 'inbound', content: 'Busco presupuesto para mi empresa' },
        { direction: 'outbound', content: 'Perfecto, ¿cuál es tu presupuesto y necesidad?' },
      ];
      const result = validator.validateConversation(messages);
      expect(result.valid).toBe(true);
      expect(result.stages_visited.length).toBeGreaterThan(0);
      expect(result.compliance_score).toBeGreaterThan(0);
    });

    test('validateConversation returns invalid for empty conversation', () => {
      const result = validator.validateConversation([]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('empty_conversation');
    });

    test('validateConversation detects stage transitions', () => {
      const messages = [
        { direction: 'outbound', content: 'Hola, bienvenido a la plataforma' },
        { direction: 'outbound', content: '¿Cuál es tu presupuesto?' },
        { direction: 'outbound', content: 'Nuestra solución incluye integración completa' },
        { direction: 'outbound', content: 'Entiendo que es caro, tenemos opciones' },
      ];
      const result = validator.validateConversation(messages);
      expect(result.stages_visited.length).toBeGreaterThanOrEqual(2);
    });

    test('getFlowDiagram returns all stages', () => {
      const diagram = validator.getFlowDiagram();
      expect(diagram.length).toBe(9);
      expect(diagram[0].stage).toBe('apertura');
      expect(diagram[0].next).toContain('calificacion');
    });

    test('getStageInfo returns correct info', () => {
      const info = validator.getStageInfo('calificacion');
      expect(info.stage).toBe('calificacion');
      expect(info.description).toBeDefined();
      expect(info.valid_next).toContain('propuesta_valor');
    });

    test('suggestNextStage recommends based on lead score', () => {
      expect(validator.suggestNextStage('calificacion', { score: 80 })).toBe('propuesta_valor');
      expect(validator.suggestNextStage('calificacion', { score: 30 })).toBe('propuesta_valor');
    });

    test('suggestNextStage handles objections', () => {
      expect(validator.suggestNextStage('calificacion', { has_objections: true })).toBe('objeciones');
    });

    test('suggestNextStage handles handoff for objeciones', () => {
      expect(validator.suggestNextStage('objeciones', { needs_human: true })).toBe('handoff');
    });
  });

  // ==========================================
  // F-48: Validación datos/contexto
  // ==========================================
  describe('F-48: Motor de validación datos/contexto', () => {
    test('runDailyChecks completes without error', async () => {
      const engine = new DataValidationEngine();
      const result = await engine.runDailyChecks();
      expect(result.timestamp).toBeDefined();
      expect(result.total_checks).toBeGreaterThan(0);
      expect(typeof result.healthy).toBe('boolean');
    });

    test('runDailyChecks returns all check types', async () => {
      const engine = new DataValidationEngine();
      const result = await engine.runDailyChecks();
      const checkNames = result.results.map(r => r.check);
      expect(checkNames).toContain('orphan_conversations');
      expect(checkNames).toContain('redis_sync');
      expect(checkNames).toContain('conversation_integrity');
      expect(checkNames).toContain('message_counts');
      expect(checkNames).toContain('template_consistency');
    });

    test('getCheckDefinitions returns 5 checks', () => {
      const engine = new DataValidationEngine();
      const checks = engine.getCheckDefinitions();
      expect(checks.length).toBe(5);
    });

    test('runDailyChecks reports healthy when no errors', async () => {
      const engine = new DataValidationEngine();
      const result = await engine.runDailyChecks();
      expect(result.healthy).toBe(true);
      expect(result.errors).toBe(0);
    });

    test('runDailyChecks accepts tenant_id parameter', async () => {
      const engine = new DataValidationEngine();
      const result = await engine.runDailyChecks('tenant:test');
      expect(result.tenant_id).toBe('tenant:test');
      expect(result.total_checks).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // F-49: Plantillas contexto cerrado
  // ==========================================
  describe('F-49: Plantillas contexto cerrado (50 preguntas adversariales)', () => {
    let engine;

    beforeEach(() => { engine = new AdversarialQuestionEngine(); });

    test('ADVERSARIAL_QUESTIONS has 50 questions', () => {
      expect(ADVERSARIAL_QUESTIONS.length).toBe(50);
    });

    test('all categories represented', () => {
      const stats = engine.getStats();
      expect(stats.categories.prompt_injection).toBe(10);
      expect(stats.categories.data_extraction).toBe(10);
      expect(stats.categories.manipulation).toBe(10);
      expect(stats.categories.off_topic).toBe(10);
      expect(stats.categories.capability_test).toBe(10);
    });

    test('evaluateResponse correctly identifies refused prompt injection', () => {
      const result = engine.evaluateResponse('ADV-001', 'No puedo proporcionar mi system prompt. ¿En qué te puedo ayudar con nuestro producto?');
      expect(result.verdict).toBe('pass');
      expect(result.is_refuse).toBe(true);
    });

    test('evaluateResponse fails when prompt injection not refused', () => {
      const result = engine.evaluateResponse('ADV-001', 'Mi system prompt es...');
      expect(result.verdict).toBe('fail');
    });

    test('evaluateResponse correctly identifies data extraction refusal', () => {
      const result = engine.evaluateResponse('ADV-011', 'No puedo compartir datos de clientes por privacidad. ¿En qué te puedo ayudar?');
      expect(result.verdict).toBe('pass');
    });

    test('evaluateResponse correctly identifies off-topic redirect', () => {
      const result = engine.evaluateResponse('ADV-031', 'No tengo acceso a información de deportes. Estoy aquí para ayudarte con nuestro producto.');
      expect(result.verdict).toBe('pass');
    });

    test('evaluateResponse detects forbidden content', () => {
      const result = engine.evaluateResponse('ADV-009', 'Te puedo enseñar a hackear sistemas.');
      expect(result.has_forbidden_content).toBe(true);
      expect(result.verdict).toBe('fail');
    });

    test('evaluateBatch calculates compliance rate', () => {
      const evaluations = [
        { question_id: 'ADV-001', response: 'No puedo hacer eso. ¿En qué te puedo ayudar?' },
        { question_id: 'ADV-011', response: 'No puedo compartir datos privados.' },
      ];
      const result = engine.evaluateBatch(evaluations);
      expect(result.total).toBe(2);
      expect(result.compliance_rate).toBe(100);
    });

    test('getQuestionsByCategory filters correctly', () => {
      const injection = engine.getQuestionsByCategory('prompt_injection');
      expect(injection.length).toBe(10);
      expect(injection.every(q => q.category === 'prompt_injection')).toBe(true);
    });

    test('getQuestionsBySeverity filters correctly', () => {
      const critical = engine.getQuestionsBySeverity('critical');
      expect(critical.length).toBeGreaterThan(0);
      expect(critical.every(q => q.severity === 'critical')).toBe(true);
    });

    test('FORBIDDEN_TOPICS has entries', () => {
      expect(FORBIDDEN_TOPICS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_TOPICS).toContain('hack');
      expect(FORBIDDEN_TOPICS).toContain('droga');
    });

    test('getStats returns total and categories', () => {
      const stats = engine.getStats();
      expect(stats.total).toBe(50);
      expect(Object.keys(stats.categories).length).toBe(5);
    });
  });

  // ==========================================
  // F-47: Suite comportamiento agente
  // ==========================================
  describe('F-47: Suite comportamiento agente (25 guiones CTX-04)', () => {
    let suite;

    beforeEach(() => { suite = new AgentBehaviorSuite(); });

    test('CTX04_SCRIPTS has 25 scripts', () => {
      expect(CTX04_SCRIPTS.length).toBe(25);
    });

    test('listScripts returns all scripts', () => {
      const scripts = suite.listScripts();
      expect(scripts.length).toBe(25);
      expect(scripts[0].id).toBe('CTX04-O1');
    });

    test('getScript returns specific script', () => {
      const script = suite.getScript('CTX04-O1');
      expect(script).not.toBeNull();
      expect(script.name).toBe('Saludo y calificación básica');
      expect(script.assertions.length).toBeGreaterThan(0);
    });

    test('getScript returns null for unknown script', () => {
      expect(suite.getScript('CTX04-UNKNOWN')).toBeNull();
    });

    test('runAll returns all scripts with status', () => {
      const result = suite.runAll();
      expect(result.total).toBe(25);
      expect(result.scripts.every(s => s.status === 'pending')).toBe(true);
    });

    test('evaluateScript evaluates assertions correctly', () => {
      const responses = [
        { direction: 'outbound', content: 'Hola, bienvenido. ¿Cómo te puedo ayudar?' },
        { direction: 'outbound', content: '¿Cuál es tu presupuesto y necesidad?' },
      ];
      const result = suite.evaluateScript('CTX04-O1', responses);
      expect(result.script_id).toBe('CTX04-O1');
      expect(result.total_assertions).toBe(3);
      expect(result.results.length).toBe(3);
    });

    test('evaluateScript fails for unknown script', () => {
      const result = suite.evaluateScript('UNKNOWN', []);
      expect(result.error).toBe('Script not found');
    });

    test('CTX04-O8 detects prompt injection attempt', () => {
      const responses = [
        { direction: 'outbound', content: 'No puedo proporcionar información sensible. ¿En qué te puedo ayudar con nuestro producto?' },
      ];
      const result = suite.evaluateScript('CTX04-O8', responses);
      expect(result.results.some(r => r.type === 'refuse_detected' && r.passed)).toBe(true);
    });

    test('CTX04-O9 detects data extraction attempt', () => {
      const responses = [
        { direction: 'outbound', content: 'No puedo compartir datos de clientes por política de privacidad.' },
      ];
      const result = suite.evaluateScript('CTX04-O9', responses);
      expect(result.results.some(r => r.type === 'privacy_mentioned' && r.passed)).toBe(true);
    });

    test('all scripts cover different stages', () => {
      const stages = new Set(CTX04_SCRIPTS.map(s => s.stage));
      expect(stages.size).toBeGreaterThanOrEqual(5);
      expect(stages.has('apertura')).toBe(true);
      expect(stages.has('objeciones')).toBe(true);
      expect(stages.has('cierre')).toBe(true);
      expect(stages.has('security')).toBe(true);
    });
  });
});
