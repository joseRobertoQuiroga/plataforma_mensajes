'use strict';
const { detectLeak } = require('../guards/confidentiality');

function createHandoffNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};
    const handoffConfig = template.handoff || {};
    const requiredFields = handoffConfig.required_fields || ['name', 'phone'];
    const missingFields = requiredFields.filter(f => !state[f] && !['score', 'intent', 'objections_log', 'summary'].includes(f));

    const summary = (state._summary || '').length > 0 ? state._summary : 'Sin resumen previo';
    const safeSummary = detectLeak(summary, template).leaked ? '[resumen omitido por restriccion]' : summary;

    const briefing = {
      lead_name: state.name || 'Desconocido',
      phone: state.phone || 'No disponible',
      email: state.email || null,
      score: state._score != null ? state._score : (state.score || 0),
      intent: state._intent || 'venta',
      service_type: state.service_type || null,
      interest: state.interest || null,
      urgency: state.urgency || null,
      objections: state._objections_log || [],
      products_interest: state._matchingProducts || [],
      stage: state._stage || 'unknown',
      autonomy_zone: state._autonomyZone || 'green',
      summary: safeSummary,
      missing_fields: missingFields,
      next_action: handoffConfig.next_action || 'contact_inmediate',
    };

    return {
      output: {
        stage: 'handoff',
        text: 'Ya deje el resumen de nuestra conversacion listo para el equipo. En breve te contactan.',
        briefing,
        next_action: briefing.next_action,
      },
      state: {
        ...state,
        _stage: 'handoff',
        _briefing: briefing,
        _handoffReady: true,
      },
    };
  };
}

module.exports = { createHandoffNode };