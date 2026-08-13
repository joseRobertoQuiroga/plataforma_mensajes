'use strict';
const llmClient = require('../llmClient');

function createAnalyzeNode() {
  return async (context) => {
    const { message = '', conversationId, tenantId = 'default' } = context;
    const checkpoint = context.checkpoint || {};
    const state = context.state || {};

    const classification = await llmClient.classify(message, {
      tenantId,
      conversationId,
      history: (context.history || []).map(h => h.result?.output?.text || '').filter(Boolean),
    });

    const intent = classification.intent || 'venta';
    const nextState = {
      ...state,
      _intent: intent,
      _score: classification.score,
      _classifyMode: classification.mode,
      _lastMessage: message,
    };

    return {
      output: {
        stage: 'analyze',
        intent,
        score: classification.score,
        confidence: classification.confidence,
        classifyMode: classification.mode,
        text: '',
      },
      state: nextState,
    };
  };
}

module.exports = { createAnalyzeNode };