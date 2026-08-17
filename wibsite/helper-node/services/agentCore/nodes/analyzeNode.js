'use strict';
const llmClient = require('../llmClient');
const { queryInMemoryKB } = require('../../ragEngine');

function createAnalyzeNode() {
  return async (context) => {
    const { message = '', conversationId, tenantId = 'default' } = context;
    const checkpoint = context.checkpoint || {};
    const state = context.state || {};

    const classification = await llmClient.classify(message, {
      tenantId,
      conversationId,
      contactName: state.name || null,
      phone: state.phone || null,
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

    // RAG (F-13/G-13 + R2): consulta la base de conocimiento del negocio.
    // Si el mensaje matchea la KB, el grafo derivará al nodo kb y responderá desde ella.
    // Prioridad comercial: si el mensaje expresa intención de compra/requerimiento, no derivar a KB.
    let kbChunk = null;
    const hasCommercialIntent = /quiero|necesito|me interesa|busco|cotiz|comprar|deseo/.test(message.toLowerCase());
    if (!hasCommercialIntent) {
      try {
        const kbResults = queryInMemoryKB(tenantId, message, 3);
        kbChunk = kbResults.find(r => (r.relevance || 0) >= 0.25) || null;
        if (kbChunk) {
          nextState._kbChunk = kbChunk;
          nextState._kbMatch = true;
        }
      } catch (e) { /* KB best-effort */ }
    }

    return {
      output: {
        stage: 'analyze',
        intent,
        score: classification.score,
        confidence: classification.confidence,
        classifyMode: classification.mode,
        kbMatch: !!kbChunk,
        text: '',
      },
      state: nextState,
    };
  };
}

module.exports = { createAnalyzeNode };