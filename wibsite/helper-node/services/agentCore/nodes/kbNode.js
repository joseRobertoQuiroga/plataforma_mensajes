'use strict';
const { sanitizeOutput } = require('../guards/confidentiality');
const { logEvent } = require('../../auditLogger');

/**
 * kbNode — responde preguntas de negocio desde la base de conocimiento (RAG).
 * Se activa cuando analyzeNode detecta un chunk relevante (state._kbChunk).
 * El turno termina aquí: la máquina de estados no se mueve (stage actual).
 */
function createKbNode() {
  return async (context) => {
    const state = context.state || {};
    const chunk = state._kbChunk || null;
    const template = context.template || {};

    let text = 'Déjame revisar esa información y te respondo a la brevedad.';
    if (chunk && chunk.content) {
      const leaked = sanitizeOutput(chunk.content, template, {
        tenantId: context.tenantId,
        conversationId: context.conversationId,
      });
      text = leaked.leaked ? leaked.text : chunk.content;
    }

    await logEvent('api_call', {
      level: 'info',
      message: `Respuesta desde base de conocimiento (${chunk?.title || 'kb'})`,
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      module: 'agentCore',
      flow: 'rag.kb',
      action: 'kb.answer',
      data: {
        title: chunk?.title || null,
        source: chunk?.source || null,
        relevance: chunk?.relevance || null,
      },
    });

    return {
      output: {
        stage: state._stage || 'apertura',
        text,
        kbAnswer: true,
        next_action: 'kb_resuelto',
      },
      state: { ...state, _kbMatch: false, _kbAnswered: true },
    };
  };
}

module.exports = { createKbNode };
