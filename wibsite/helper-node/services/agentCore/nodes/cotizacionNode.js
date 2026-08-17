'use strict';
const quoteEngine = require('../quoteEngine');
const { logEvent } = require('../../auditLogger');

/**
 * cotizacionNode (C4) — genera una mini-cotización estimada cuando el lead
 * pidió precios y la zona de autonomía lo permite (yellow, can_share_pricing).
 */
function createCotizacionNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};
    const product = state._matchedProduct || quoteEngine.matchProduct(state, template);
    const answers = state.qAnswers || {};

    const quote = product
      ? quoteEngine.buildQuote({ product, answers, template })
      : null;

    const text = quote
      ? quoteEngine.quoteToText(quote)
      : 'Para darte una estimación necesito conocer un poco más tu proyecto. ¿Me cuentas qué necesitas?';

    await logEvent('campaign_sent', {
      level: 'info',
      message: quote
        ? `Mini-cotización generada: ${quote.service} ($${quote.range_usd[0]}–$${quote.range_usd[1]})`
        : 'Mini-cotización solicitada sin producto detectado',
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      module: 'agentCore',
      flow: 'cotizacion.generar',
      action: 'quote.generated',
      data: quote ? { service: quote.service, range_usd: quote.range_usd, factor: quote.factor } : {},
    });

    return {
      output: {
        stage: 'cotizacion',
        text,
        quote,
        next_action: 'profundizar',
      },
      state: {
        ...state,
        _quote: quote,
        _stage: 'cotizacion',
      },
    };
  };
}

module.exports = { createCotizacionNode };
