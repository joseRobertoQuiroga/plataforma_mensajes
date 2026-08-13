const { projectCommercial, registerHook } = require('../services/agentCore/commercialState');
const conversationStore = require('../services/conversationStore');

describe('F-21 Sincronizacion maquina comercial ↔ tecnica', () => {
  test('mapeo de tabla CTX-07 §3: tecnicos → comerciales', () => {
    const casos = [
      ['greeting', 'nuevo'],
      ['discovery', 'calificando'],
      ['qualification', 'calificando'],
      ['proposal', 'propuesta_enviada'],
      ['objections', 'en_objeción'],
      ['closing', 'agendado/cerrado'],
      ['post_sale', 'agendado/cerrado'],
      ['support', 'reactivado'],
      ['escalated', 'derivado_a_humano'],
    ];
    for (const [tecnico, comercial] of casos) {
      expect(projectCommercial({ machineState: tecnico }).state).toBe(comercial);
    }
  });

  test('lost_threshold → perdido', () => {
    expect(projectCommercial({ machineState: 'post_sale', lost: true }).state).toBe('perdido');
  });

  test('seguimiento sin respuesta + temperatura baja → enfriándose', () => {
    const p = projectCommercial({ machineState: 'post_sale', followupAttempt: 3, score: 20, warmThreshold: 40 });
    expect(p.state).toBe('enfriándose');
  });

  test('seguimiento con respuesta caliente → reactivado', () => {
    const p = projectCommercial({ machineState: 'post_sale', followupAttempt: 2, score: 70, warmThreshold: 40 });
    expect(p.state).toBe('reactivado');
  });

  test('hook post-transicion: conversación técnica actualiza estado comercial por evento', async () => {
    const unregister = registerHook();
    const conv = await conversationStore.createConversationState('tenant-f21', 'conv-f21');
    expect(conv.metadata.commercial_state || conv.state === 'greeting').toBe(true);
    await conversationStore.transitionState('tenant-f21', 'conv-f21', 'discovery', 'test');
    const updated = await conversationStore.getConversationState('tenant-f21', 'conv-f21');
    expect(updated.state).toBe('discovery');
    expect(updated.metadata.commercial_state).toBe('calificando');
    unregister();
    await conversationStore.deleteConversationState('tenant-f21', 'conv-f21');
  });

  test('transiciones invalidas se rechazan y el hook no se dispara', async () => {
    const unregister = registerHook();
    const conv = await conversationStore.createConversationState('tenant-f21', 'conv-f21-invalid');
    const result = await conversationStore.transitionState('tenant-f21', 'conv-f21-invalid', 'closing', 'test');
    expect(result.error).toBe('Invalid transition');
    const updated = await conversationStore.getConversationState('tenant-f21', 'conv-f21-invalid');
    expect(updated.state).toBe('greeting');
    unregister();
    await conversationStore.deleteConversationState('tenant-f21', 'conv-f21-invalid');
  });
});