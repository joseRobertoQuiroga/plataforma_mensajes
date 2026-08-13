'use strict';
const { extractLeadFields, fitComplete, missingFields } = require('../slotFilling');
const { createPropuestaNode } = require('./propuestaNode');

function createCalificacionNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};
    const message = context.message || '';

    const extracted = extractLeadFields(message, state, template);
    const mergedState = { ...state, ...extracted };

    const fit = fitComplete(mergedState);

    if (fit) {
      const propuesta = await createPropuestaNode()({ ...context, state: mergedState });
      return {
        ...propuesta,
        output: { ...propuesta.output, stage: 'propuesta', fit },
      };
    }

    const missing = missingFields(mergedState, template);
    const next = missing[0] || 'name';
    const labels = {
      name: '¿puedes decirme tu nombre?',
      phone: '¿un telefono de contacto?',
      email: '¿tu correo?',
      service_type: '¿que tipo de servicio estas buscando?',
      interest: '¿que te trae por aca hoy?',
      urgency: '¿tenes alguna fecha limite en mente?',
    };

    return {
      output: {
        stage: 'calificacion',
        text: `Para armarte una propuesta acorde, ${labels[next] || `¿podrias indicarme ${next}?`}`,
        fit: false,
        extractedFields: Object.keys(extracted),
        missing,
        next_action: 'completar_datos',
      },
      state: {
        ...mergedState,
        _stage: 'calificacion',
        _qualified: false,
      },
    };
  };
}

module.exports = { createCalificacionNode };