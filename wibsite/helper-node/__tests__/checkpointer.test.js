const conversationStore = require('../services/conversationStore');
const checkpointer = require('../services/agentCore/checkpointer');

describe('F-14 Checkpointer: memoria profunda Redis + PG', () => {
  const tenantId = 'tenant-f14';
  const conversationId = 'conv-f14';

  beforeEach(async () => {
    await conversationStore.deleteConversationState(tenantId, conversationId);
    await conversationStore.deleteCheckpoint(tenantId, conversationId);
    checkpointer.initSummariesPool(null);
  });

  test('CONV_TTL es 7 dias (604800s)', () => {
    expect(conversationStore.CONV_TTL).toBe(604800);
  });

  test('historico de mensajes limitado a 100 registros', async () => {
    await conversationStore.createConversationState(tenantId, conversationId);
    for (let i = 0; i < 110; i++) {
      await conversationStore.appendMessage(tenantId, conversationId, { role: 'user', content: `msg-${i}` });
    }
    const conv = await conversationStore.getConversationState(tenantId, conversationId);
    expect(conv.messages).toHaveLength(100);
    expect(conv.messages[0].content).toBe('msg-10');
    expect(conv.messages[99].content).toBe('msg-109');
  });

  test('5 turnos + restart → turno 6 conserva contexto (checkpoint + resumen PG)', async () => {
    const summariesByConv = {};
    const mockPool = {
      query: jest.fn(async (sql, params) => {
        if (sql.includes('INSERT INTO conversation_summaries')) {
          summariesByConv[params[1]] = {
            tenant_id: params[0], conversation_id: params[1], template_id: params[2],
            machine_state: params[3], commercial_state: params[4], score: params[5],
            autonomy_zone: params[6], lead_extract: params[7], topics: params[8],
            objections_log: params[9], turn_count: params[10], summary: params[11],
          };
          return { rows: [{ id: 1 }] };
        }
        if (sql.includes('SELECT * FROM conversation_summaries')) {
          const row = summariesByConv[params[1]];
          return { rows: row ? [row] : [] };
        }
        return { rows: [] };
      }),
    };
    checkpointer.initSummariesPool(mockPool);

    for (let i = 1; i <= 5; i++) {
      await checkpointer.saveTurn({
        tenantId, conversationId, templateId: 'consultora-software',
        machineState: `etapa-${i}`, commercialState: 'calificando',
        score: 30 + i, autonomyZone: 'green',
        leadExtract: { name: 'Ana', phone: '5491112345678', turn: i },
        objections: [], topics: ['integracion'], path: ['apertura', 'analyze', 'calificacion'],
        userMessage: `mensaje ${i}`, agentMessage: `respuesta ${i}`,
      });
    }

    const upsertCalls = mockPool.query.mock.calls.filter(c => c[0].includes('INSERT INTO conversation_summaries'));
    expect(upsertCalls.length).toBe(5);
    expect(upsertCalls[0][0]).toContain('ON CONFLICT (tenant_id, conversation_id)');
    expect(upsertCalls[upsertCalls.length - 1][1][10]).toBe(5);

    const restored = await checkpointer.restoreGraphState({ tenantId, conversationId });
    expect(restored.fresh).toBe(false);
    expect(restored.state.name).toBe('Ana');
    expect(restored.state.turn).toBe(5);
    expect(restored.machineStage).toBe('etapa-5');

    const { conversation } = await checkpointer.loadTurn({ tenantId, conversationId });
    expect(conversation.messages).toHaveLength(10);
    expect(conversation.messageCount).toBe(10);

    await checkpointer.saveTurn({
      tenantId, conversationId, templateId: 'consultora-software',
      machineState: 'etapa-6', commercialState: 'calificando',
      score: 36, autonomyZone: 'green',
      leadExtract: { name: 'Ana', phone: '5491112345678', turn: 6 },
      objections: [], topics: ['integracion'], path: ['apertura', 'analyze', 'calificacion'],
      userMessage: 'mensaje 6', agentMessage: 'respuesta 6',
    });
    const restoredAfter = await checkpointer.restoreGraphState({ tenantId, conversationId });
    expect(restoredAfter.machineStage).toBe('etapa-6');
    expect(restoredAfter.state.turn).toBe(6);
    expect(mockPool.query.mock.calls.filter(c => c[0].includes('INSERT INTO conversation_summaries'))).toHaveLength(6);
  });

  test('rollup de resumen: topics deduplicados y objections acumuladas', () => {
    const previous = { topics: ['integracion'], objections_log: [{ trigger: 'muy caro' }], turn_count: 2, lead_extract: { name: 'Ana' } };
    const rolled = checkpointer.rollupSummary(previous, {
      leadExtract: { phone: '5491112345678' },
      objections: [{ trigger: 'fuera de presupuesto' }],
      topics: ['integracion', 'presupuesto'],
    });
    expect(rolled.turnCount).toBe(3);
    expect(rolled.topics).toEqual(['integracion', 'presupuesto']);
    expect(rolled.objectionsLog).toHaveLength(2);
    expect(rolled.leadExtract).toEqual({ name: 'Ana', phone: '5491112345678' });
  });

  test('claves de checkpoint prefijadas por tenant (F-11)', async () => {
    await checkpointer.saveTurn({
      tenantId: 'tenant-a', conversationId: 'conv-x', machineState: 'proposal',
      leadExtract: { name: 'Uno' }, path: ['x'], userMessage: 'hola', agentMessage: 'hola',
    });
    await checkpointer.saveTurn({
      tenantId: 'tenant-b', conversationId: 'conv-x', machineState: 'greeting',
      leadExtract: { name: 'Dos' }, path: ['x'], userMessage: 'hola', agentMessage: 'hola',
    });
    const a = await checkpointer.restoreGraphState({ tenantId: 'tenant-a', conversationId: 'conv-x' });
    const b = await checkpointer.restoreGraphState({ tenantId: 'tenant-b', conversationId: 'conv-x' });
    expect(a.state.name).toBe('Uno');
    expect(b.state.name).toBe('Dos');
  });
});