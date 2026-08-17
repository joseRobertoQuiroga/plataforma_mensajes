'use strict';
const autonomy = require('../guards/autonomy');
const templateEngine = require('../../templateEngine');
const quoteEngine = require('../quoteEngine');

function createPropuestaNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};
    const clientConfig = context.clientConfig || {};
    const products = template.products || [];
    const interest = state.interest;
    const serviceType = state.service_type;

    const chosen = state._matchedProduct
      || (interest
        ? products.filter(p => p.name.toLowerCase().includes(interest.toLowerCase()) || interest.toLowerCase().includes(p.name.toLowerCase()))[0]
        : serviceType
          ? products.filter(p => p.name.toLowerCase().includes(serviceType.split(' ')[0]))[0]
          : null)
      || products.find(p => p.name.toLowerCase().includes('auditoria'))
      || null;

    const { zone, canSharePricing } = autonomy.evaluate(state, template);

    // Estimación por alcance (C3): rango ajustado por respuestas del cuestionario
    const answers = state.qAnswers || {};
    const estimate = chosen ? quoteEngine.estimateQuote(chosen, answers) : null;

    let text;
    if (!chosen) {
      text = 'Con lo que me contas, puedo armarte una propuesta inicial a medida. ¿Te sirve si te cuento como encarariamos el proyecto?';
    } else if (canSharePricing && estimate && estimate.min > 0) {
      text = `Para tu caso veo que encaja ${chosen.name.toLowerCase()} (rango de referencia $${estimate.min}-$${estimate.max}). ¿Queres que profundicemos en el alcance?`;
    } else {
      text = `Para tu caso veo que encaja ${chosen.name.toLowerCase()}. Puedo contarte el alcance y como lo resolveriamos en tu contexto.`;
    }
    text = autonomy.addDisclaimer(text, zone);

    return {
      output: {
        stage: 'propuesta',
        text,
        zone,
        productsInterest: chosen ? [chosen.name] : [],
        next_action: 'profundizar',
      },
      state: {
        ...state,
        _stage: 'propuesta',
        _autonomyZone: zone,
        _matchingProducts: chosen ? [chosen.name] : [],
        _matchedProduct: chosen,
        _proposalSent: true,
      },
    };
  };
}

module.exports = { createPropuestaNode };