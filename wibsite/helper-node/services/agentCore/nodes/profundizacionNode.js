'use strict';
const { extractLeadFields, missingFields } = require('../slotFilling');

function createProfundizacionNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};
    const message = context.message || '';

    const extracted = extractLeadFields(message, state, template);
    const mergedState = { ...state, ...extracted };
    const missing = missingFields(mergedState, template);
    const required = missingFields({}, template);
    const completeness = required.length === 0 ? 1 : Math.max(0, 1 - missing.length / required.length);

    let text;
    if (missing.length > 0) {
      const next = missing[0];
      const labels = {
        name: '¿puedes decirme tu nombre para la propuesta?',
        phone: '¿que telefono es el mejor para contactarte?',
        email: '¿cual es tu correo electronico?',
        service_type: 'contame un poco mas del servicio que necesitas',
        interest: '¿que problema estas queriendo resolver?',
        urgency: '¿para cuando lo estarias necesitando?',
      };
      text = labels[next] || `Me ayudaria saber ${next}.`;
    } else {
      text = 'Ya tengo todo el contexto. ¿Te quedo alguna duda sobre el alcance o la proxima propuesta?';
    }

    return {
      output: {
        stage: 'profundizacion',
        text,
        remainingFields: missing,
        extractedFields: Object.keys(extracted),
        completeness,
        next_action: missing.length > 0 ? 'completar_datos' : 'resolver_dudas',
      },
      state: {
        ...mergedState,
        _stage: 'profundizacion',
        _summary: buildSummary(mergedState),
      },
    };
  };
}

function buildSummary(state) {
  const bits = [];
  if (state.name) bits.push(`Lead: ${state.name}`);
  if (state.service_type) bits.push(`servicio: ${state.service_type}`);
  if (state.interest) bits.push(`interes: ${state.interest}`);
  if (state.urgency) bits.push(`urgencia: ${state.urgency}`);
  if (state._score != null) bits.push(`score intencion: ${state._score}`);
  return bits.join(' | ') || 'Sin datos suficientes';
}

module.exports = { createProfundizacionNode, buildSummary };