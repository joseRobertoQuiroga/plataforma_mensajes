'use strict';
const autonomy = require('../guards/autonomy');

function createCierreNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};

    const { zone, canSharePricing } = autonomy.evaluate(state, template);
    const derive = autonomy.deriveToHuman(state, template);

    let text;
    let nextAction;
    if (derive) {
      text = 'Tu caso amerita una revision personalizada. Te dejo en contacto con una persona del equipo para avanzar.';
      nextAction = 'derivar_humano';
    } else {
      text = 'Perfecto. ¿Te parece si agendamos una llamada corta para cerrar el detalle de la propuesta?';
      nextAction = 'agendar_llamada';
    }

    return {
      output: {
        stage: 'cierre',
        text,
        zone,
        canClose: !derive,
        derive,
        next_action: nextAction,
      },
      state: {
        ...state,
        _stage: 'cierre',
        _autonomyZone: zone,
        _canClose: !derive,
        _needsHuman: state._needsHuman || derive,
      },
    };
  };
}

module.exports = { createCierreNode };