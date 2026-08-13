'use strict';
function createFollowupNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};
    const sequence = template.followup?.sequence || [];
    const lostThreshold = template.followup?.lost_threshold || 8;

    const currentAttempt = state._followupAttempt || 0;
    const triggered = state._triggersFollowup || false;
    const nextStep = triggered
      ? sequence[Math.min(currentAttempt, sequence.length - 1)] || null
      : null;

    let text;
    if (!triggered) {
      text = 'Quedo registrado. Si surge algo mas, aca estoy.';
    } else if (!nextStep) {
      text = 'La secuencia de seguimiento quedo armada.';
    } else {
      const stepLabel = {
        confirmation: 'confirmacion de interes',
        value: 'un mensaje de valor',
        low_friction: 'una propuesta de llamada corta',
        summary: 'un resumen de lo conversado',
        content: 'un caso de exito',
        nurture: 'un mensaje de nurturing',
      }[nextStep.message_type] || nextStep.message_type;
      text = `Te ire escribiendo con novedades (${stepLabel} en ~${nextStep.delay_days}d).`;
    }

    const lost = currentAttempt >= lostThreshold && !state._reactivated;

    return {
      output: {
        stage: 'seguimiento',
        text,
        attempt: currentAttempt + (triggered ? 1 : 0),
        triggered,
        lost,
        next_action: triggered ? 'seguir_cadencia' : 'esperar_respuesta',
      },
      state: {
        ...state,
        _stage: 'seguimiento',
        _followupAttempt: currentAttempt + (triggered ? 1 : 0),
        _lost: lost,
      },
    };
  };
}

module.exports = { createFollowupNode };