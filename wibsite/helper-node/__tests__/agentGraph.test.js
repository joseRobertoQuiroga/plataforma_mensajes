const templateEngine = require('../services/templateEngine');
const { executeCommercialGraph } = require('../services/agentCore');
const conversationStore = require('../services/conversationStore');

const template = templateEngine.loadTemplate('consultora-software');

async function cleanup(conversationId) {
  await conversationStore.deleteConversationState('default', conversationId);
  await conversationStore.deleteCheckpoint('default', conversationId);
}

async function turn(message, conversationId, overrides = {}) {
  return executeCommercialGraph({
    message,
    conversationId,
    tenantId: 'default',
    template,
    clientConfig: null,
    ...overrides,
  });
}

describe('F-16 Grafo de 8 etapas comerciales', () => {
  const conversationId = 'conv-f16-script';

  beforeEach(async () => { await cleanup(conversationId); });
  afterAll(async () => { await cleanup(conversationId); });

  test('guion: lead curioso → handoff en ≤8 turnos con campos minimos', async () => {
    const guion = [
      { msg: 'Hola', expectStage: 'calificacion' },
      { msg: 'Soy Ana Lopez, busco integracion de plataformas', expectStage: 'propuesta' },
      { msg: 'contame mas del alcance', expectStage: 'profundizacion' },
      { msg: 'esta muy caro eso', expectStage: 'objeciones' },
      { msg: 'ok, entiendo', expectStage: 'cierre' },
      { msg: 'listo, gracias', expectStage: 'handoff' },
      { msg: 'nos vemos', expectStage: 'seguimiento' },
    ];

    let handoffAt = -1;
    for (let i = 0; i < guion.length; i++) {
      const result = await turn(guion[i].msg, conversationId);
      expect(result.stage).toBe(guion[i].expectStage);
      expect(result.nextAction).toBeTruthy();
      expect(result.response).toBeTruthy();
      if (result.stage === 'handoff' && handoffAt === -1) handoffAt = i + 1;
    }

    expect(handoffAt).toBeGreaterThan(0);
    expect(handoffAt).toBeLessThanOrEqual(8);

    const finalResult = await turn('nose, segui escribiendome', conversationId);
    expect(finalResult.stage).toBe('seguimiento');

    const conv = await conversationStore.getConversationState('default', conversationId);
    expect(conv.state).toBe('post_sale');
    expect(conv.metadata.commercial_state).toBe('agendado/cerrado');
  });

  test('camino sin objecion: propuesta → profundizacion (completa campos) → cierre', async () => {
    const conversationId2 = 'conv-f16-no-objection';
    await cleanup(conversationId2);
    const t1 = await turn('hola', conversationId2);
    expect(t1.stage).toBe('calificacion');
    const t2 = await turn('soy Pedro, desarrollo a medida', conversationId2);
    expect(t2.stage).toBe('propuesta');
    const t3 = await turn('si, contame', conversationId2);
    expect(t3.stage).toBe('profundizacion');
    const t4 = await turn('genial, mi telefono es 5491112345678, lo necesito urgente', conversationId2);
    expect(t4.stage).toBe('profundizacion');
    expect(t4.completeness).not.toBeNull();
    const t5 = await turn('seguimos', conversationId2);
    expect(t5.stage).toBe('cierre');
    expect(t5.autonomyZone).toBe('green');
    await cleanup(conversationId2);
  });

  test('zona red: siempre deriva a humano (briefing en handoff)', async () => {
    const conversationId3 = 'conv-f16-red';
    await cleanup(conversationId3);
    await turn('hola', conversationId3);
    await turn('soy Carla, quiero integracion de plataformas', conversationId3);
    const t3 = await turn('quiero firmar el contrato ya mismo', conversationId3);
    expect(t3.stage).toBe('cierre');
    expect(t3.autonomyZone).toBe('red');
    const t4 = await turn('ok', conversationId3);
    expect(t4.stage).toBe('handoff');
    expect(t4.briefing).toBeTruthy();
    expect(t4.briefing.lead_name).toContain('Carla');
    expect(t4.commercialState).toBe('derivado_a_humano');
    await cleanup(conversationId3);
  });

  test('memoria entre turnos: campos extraidos persisten y no se piden repetidos', async () => {
    const conversationId4 = 'conv-f16-mem';
    await cleanup(conversationId4);
    const t2 = await turn('soy Juan Perez, me interesa auditoria', conversationId4);
    expect(t2.stage).toBe('propuesta');
    expect(t2.response).not.toContain('nombre');
    await cleanup(conversationId4);
  });

  test('estado visible en Redis (conversationStore) por etapa', async () => {
    const conversationId5 = 'conv-f16-redis';
    await cleanup(conversationId5);
    await turn('hola', conversationId5);
    await turn('soy Ana, quiero una auditoria', conversationId5);
    const conv = await conversationStore.getConversationState('default', conversationId5);
    expect(conv).not.toBeNull();
    expect(conv.state).toBe('proposal');
    await cleanup(conversationId5);
  });
});