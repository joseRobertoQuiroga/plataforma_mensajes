'use strict';
const { filterContext } = require('../guards/confidentiality');

function createEntryNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};
    const fresh = !state._entered;
    const meta = template.meta || {};

    const { cleanState, removed } = filterContext(state, template);

    let text = '';
    if (fresh && (context.machineStage == null || context.machineStage === 'greeting')) {
      const reason = meta.description
        ? `Hola, soy el asesor digital de ${meta.name || 'nuestro equipo'}. ${meta.description}. `
        : `Hola, soy el asesor digital de ${meta.name || 'nuestro equipo'}. `;
      text = `${reason}¿En que puedo ayudarte hoy?`;
    }

    return {
      output: {
        stage: 'apertura',
        text,
        fresh,
        greeting: fresh && context.machineStage === 'greeting',
      },
      state: {
        ...state,
        _entered: true,
        _llmContext: cleanState,
        _removedInternalFields: removed,
      },
    };
  };
}

module.exports = { createEntryNode };