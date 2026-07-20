const {
  isValidTransition, createConversationState, getConversationState,
  transitionState, deleteConversationState, CONVERSATION_STATES,
  VALID_TRANSITIONS, STATE_LABELS,
} = require('../services/conversationStore');

describe('Conversation Store - MVP-02: Memoria de conversación', () => {
  test('CONVERSATION_STATES tiene todos los estados', () => {
    expect(Object.keys(CONVERSATION_STATES)).toHaveLength(9);
    expect(CONVERSATION_STATES.GREETING).toBe('greeting');
    expect(CONVERSATION_STATES.DISCOVERY).toBe('discovery');
    expect(CONVERSATION_STATES.QUALIFICATION).toBe('qualification');
    expect(CONVERSATION_STATES.PROPOSAL).toBe('proposal');
    expect(CONVERSATION_STATES.OBJECTIONS).toBe('objections');
    expect(CONVERSATION_STATES.CLOSING).toBe('closing');
    expect(CONVERSATION_STATES.POST_SALE).toBe('post_sale');
    expect(CONVERSATION_STATES.SUPPORT).toBe('support');
    expect(CONVERSATION_STATES.ESCALATED).toBe('escalated');
  });

  test('isValidTransition: greeting → discovery es válido', () => {
    expect(isValidTransition('greeting', 'discovery')).toBe(true);
  });

  test('isValidTransition: greeting → closing es inválido', () => {
    expect(isValidTransition('greeting', 'closing')).toBe(false);
  });

  test('isValidTransition: qualification → proposal es válido', () => {
    expect(isValidTransition('qualification', 'proposal')).toBe(true);
  });

  test('isValidTransition: closing → greeting es válido (reinicio)', () => {
    expect(isValidTransition('closing', 'greeting')).toBe(true);
  });

  test('isValidTransition: mismo estado siempre es válido', () => {
    expect(isValidTransition('greeting', 'greeting')).toBe(true);
    expect(isValidTransition('closing', 'closing')).toBe(true);
  });

  test('createConversationState arranca en greeting', async () => {
    const conv = await createConversationState('test-tenant', 'test-conv-1');
    expect(conv.state).toBe('greeting');
    expect(conv.history).toHaveLength(1);
    expect(conv.tenantId).toBe('test-tenant');
    expect(conv.conversationId).toBe('test-conv-1');
  });

  test('getConversationState retorna la conversación', async () => {
    await createConversationState('test-tenant', 'test-conv-2');
    const conv = await getConversationState('test-tenant', 'test-conv-2');
    expect(conv).not.toBeNull();
    expect(conv.state).toBe('greeting');
  });

  test('getConversationState retorna null para conv inexistente', async () => {
    const conv = await getConversationState('test-tenant', 'nonexistent');
    expect(conv).toBeNull();
  });

  test('transitionState: greeting → discovery funciona', async () => {
    await createConversationState('test-tenant', 'test-conv-3');
    const result = await transitionState('test-tenant', 'test-conv-3', 'discovery', 'test');
    expect(result.state).toBe('discovery');
    expect(result.previousStates).toContain('greeting');
    expect(result.history).toHaveLength(2);
  });

  test('transitionState: transición inválida da error', async () => {
    await createConversationState('test-tenant', 'test-conv-4');
    const result = await transitionState('test-tenant', 'test-conv-4', 'closing');
    expect(result.error).toBe('Invalid transition');
    expect(result.from).toBe('greeting');
    expect(result.to).toBe('closing');
    expect(result.allowedTransitions).toEqual(['discovery', 'support']);
  });

  test('deleteConversationState limpia estado', async () => {
    await createConversationState('test-tenant', 'test-conv-5');
    await deleteConversationState('test-tenant', 'test-conv-5');
    const conv = await getConversationState('test-tenant', 'test-conv-5');
    expect(conv).toBeNull();
  });

  test('STATE_LABELS tiene labels para todos los estados', () => {
    Object.values(CONVERSATION_STATES).forEach(state => {
      expect(STATE_LABELS[state]).toBeDefined();
      expect(typeof STATE_LABELS[state]).toBe('string');
    });
  });

  test('VALID_TRANSITIONS cubre todos los estados', () => {
    Object.values(CONVERSATION_STATES).forEach(state => {
      expect(VALID_TRANSITIONS[state]).toBeDefined();
      expect(Array.isArray(VALID_TRANSITIONS[state])).toBe(true);
    });
  });

  describe('Flujo completo de venta', () => {
    test('transición completa greeting → closing', async () => {
      await createConversationState('test-tenant', 'full-flow');

      const steps = [
        { from: 'greeting', to: 'discovery' },
        { from: 'discovery', to: 'qualification' },
        { from: 'qualification', to: 'proposal' },
        { from: 'proposal', to: 'objections' },
        { from: 'objections', to: 'closing' },
      ];

      for (const step of steps) {
        const result = await transitionState('test-tenant', 'full-flow', step.to);
        expect(result.state).toBe(step.to);
      }

      const final = await getConversationState('test-tenant', 'full-flow');
      expect(final.state).toBe('closing');
      expect(final.history).toHaveLength(6);
      expect(final.previousStates).toHaveLength(5);
    });
  });
});
