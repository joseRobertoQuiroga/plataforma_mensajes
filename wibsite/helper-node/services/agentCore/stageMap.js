'use strict';
const STAGES = [
  'apertura', 'calificacion', 'propuesta', 'profundizacion',
  'objeciones', 'cierre', 'handoff', 'seguimiento', 'kb', 'cotizacion',
];

const STAGE_TO_CONVERSATION_STATE = {
  apertura: 'discovery',
  calificacion: 'qualification',
  propuesta: 'proposal',
  profundizacion: 'proposal',
  objeciones: 'objections',
  cierre: 'closing',
  handoff: 'escalated',
  seguimiento: 'post_sale',
  kb: 'discovery',
  cotizacion: 'proposal',
};

const STAGE_LABELS = {
  apertura: 'Apertura / encuadre',
  calificacion: 'Calificacion del lead',
  propuesta: 'Propuesta de valor situacional',
  profundizacion: 'Profundizacion',
  objeciones: 'Manejo de objeciones',
  cierre: 'Cierre preliminar o derivacion',
  handoff: 'Consolidacion (handoff)',
  seguimiento: 'Seguimiento',
  kb: 'Respuesta desde conocimiento de negocio',
  cotizacion: 'Mini-cotizacion estimada',
};

function conversationStateFor(stage) {
  return STAGE_TO_CONVERSATION_STATE[stage] || 'greeting';
}

module.exports = { STAGES, STAGE_TO_CONVERSATION_STATE, STAGE_LABELS, conversationStateFor };