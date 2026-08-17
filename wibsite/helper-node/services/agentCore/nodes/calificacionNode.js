'use strict';
const { extractLeadFields, fitComplete, missingFields } = require('../slotFilling');
const { createPropuestaNode } = require('./propuestaNode');
const quoteEngine = require('../quoteEngine');

function createCalificacionNode() {
  return async (context) => {
    const state = context.state || {};
    const template = context.template || {};
    const message = context.message || '';

    const extracted = extractLeadFields(message, state, template);
    let mergedState = { ...state, ...extracted };

    const product = quoteEngine.matchProduct(mergedState, template);
    if (product) mergedState._matchedProduct = product;

    // Cuestionario por servicio (C2): recoger respuestas antes que datos genéricos
    if (product && (product.questionnaire || []).length) {
      let answers = { ...(state.qAnswers || {}) };
      const askedField = state.pendingQuestion;
      if (askedField) {
        const asked = (product.questionnaire || []).find(q => q.field === askedField);
        if (asked) answers[askedField] = quoteEngine.answerQuestion(asked, message);
      }
      mergedState.qAnswers = answers;

      const pending = quoteEngine.pendingQuestion(product, answers);
      if (pending) {
        return {
          output: {
            stage: 'calificacion',
            text: pending.question,
            fit: false,
            extractedFields: Object.keys(extracted),
            next_action: 'cuestionario',
            questionnaire: true,
          },
          state: {
            ...mergedState,
            _stage: 'calificacion',
            _qualified: false,
            pendingQuestion: pending.field,
          },
        };
      }
    }

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
