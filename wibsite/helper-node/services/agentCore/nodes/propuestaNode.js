'use strict';
const autonomy = require('../guards/autonomy');
const templateEngine = require('../../templateEngine');

function createPropuestaNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};
    const clientConfig = context.clientConfig || {};
    const products = template.products || [];
    const interest = state.interest;
    const serviceType = state.service_type;

    const matched = interest
      ? products.filter(p => p.name.toLowerCase().includes(interest.toLowerCase()) || interest.toLowerCase().includes(p.name.toLowerCase()))
      : serviceType
        ? products.filter(p => p.name.toLowerCase().includes(serviceType.split(' ')[0]))
        : [];

    const chosen = matched[0] || products.find(p => p.name.toLowerCase().includes('auditoria')) || null;

    const { zone, canSharePricing } = autonomy.evaluate(state, template);

    let text;
    if (!chosen) {
      text = 'Con lo que me contas, puedo armarte una propuesta inicial a medida. ¿Te sirve si te cuento como encarariamos el proyecto?';
    } else if (canSharePricing) {
      const price = chosen.min_price && chosen.max_price
        ? `$${chosen.min_price}-$${chosen.max_price}`
        : (chosen.price ? `$${chosen.price}` : '');
      text = `Para tu caso veo que encaja ${chosen.name.toLowerCase()} ${price ? `(rango de referencia ${price})` : ''}. ¿Queres que profundicemos en el alcance?`;
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
        _proposalSent: true,
      },
    };
  };
}

module.exports = { createPropuestaNode };