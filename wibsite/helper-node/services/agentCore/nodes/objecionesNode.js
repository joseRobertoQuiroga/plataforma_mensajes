'use strict';
const templateEngine = require('../../templateEngine');

function matchObjection(message = '', template = {}) {
  const objections = template.objections || [];
  const lower = message.toLowerCase();
  const hit = objections.find(o => (o.trigger_patterns || []).some(p => lower.includes(p.toLowerCase())));
  if (!hit) return null;
  return {
    objection: hit,
    pattern: hit.response_pattern || '',
    trigger: hit.trigger_patterns.find(p => lower.includes(p.toLowerCase())),
    triggersFollowup: !!hit.triggers_followup,
  };
}

function createObjecionesNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};
    const clientConfig = context.clientConfig || {};
    const message = context.message || '';

    const match = matchObjection(message, template);
    if (!match) {
      return {
        output: { stage: 'objeciones', matched: false, text: '', next_action: null },
        state: { ...state, _stage: 'objeciones' },
      };
    }

    const leadData = {
      name: state.name || '',
      service_type: state.service_type || '',
      interest: state.interest || '',
    };
    const responseText = templateEngine.resolvePlaceholders(match.pattern, leadData, clientConfig);

    const objectionsLog = [...(state._objections_log || []), {
      trigger: match.trigger,
      resolved: true,
      at: new Date().toISOString(),
      zone: 'green',
    }];

    return {
      output: {
        stage: 'objeciones',
        matched: true,
        text: responseText,
        next_action: match.triggersFollowup ? 'iniciar_seguimiento' : 'continuar_conversacion',
      },
      state: {
        ...state,
        _stage: 'objeciones',
        _objections_log: objectionsLog,
        _triggersFollowup: state._triggersFollowup || match.triggersFollowup,
        _lastObjection: match.trigger,
      },
    };
  };
}

module.exports = { createObjecionesNode, matchObjection };