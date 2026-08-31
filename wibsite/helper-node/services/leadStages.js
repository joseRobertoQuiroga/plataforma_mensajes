const STAGES = {
  PRIMER_CONTACTO: 'primer_contacto',
  PRIMER_MENSAJE: 'primer_mensaje',
  INTERESADO: 'interesado',
  COTIZACION_PENDIENTE: 'cotizacion_pendiente',
  POSIBLE_COMPRADOR: 'posible_comprador',
  COMPRADOR: 'comprador',
  DESCARTADO: 'descartado',
  OPT_OUT: 'opt_out'
};

const VALID_TRANSITIONS = {
  [STAGES.PRIMER_CONTACTO]: [STAGES.PRIMER_MENSAJE, STAGES.DESCARTADO, STAGES.OPT_OUT],
  [STAGES.PRIMER_MENSAJE]: [STAGES.INTERESADO, STAGES.DESCARTADO, STAGES.OPT_OUT],
  [STAGES.INTERESADO]: [STAGES.COTIZACION_PENDIENTE, STAGES.POSIBLE_COMPRADOR, STAGES.DESCARTADO, STAGES.OPT_OUT],
  [STAGES.COTIZACION_PENDIENTE]: [STAGES.POSIBLE_COMPRADOR, STAGES.DESCARTADO, STAGES.OPT_OUT],
  [STAGES.POSIBLE_COMPRADOR]: [STAGES.COMPRADOR, STAGES.DESCARTADO, STAGES.OPT_OUT],
  [STAGES.COMPRADOR]: [STAGES.OPT_OUT], // Quizás vuelva a comprar, pero para F1 se queda así.
  [STAGES.DESCARTADO]: [STAGES.PRIMER_CONTACTO, STAGES.OPT_OUT], // Reactivación
  [STAGES.OPT_OUT]: []
};

// Mapeo legado para mantener compatibilidad con leads creados antes
const LEGACY_MAPPING = {
  'nuevo': STAGES.PRIMER_CONTACTO,
  'pending': STAGES.PRIMER_CONTACTO,
  'calificado': STAGES.INTERESADO,
  'oportunidad': STAGES.POSIBLE_COMPRADOR,
  'propuesta': STAGES.COTIZACION_PENDIENTE,
  'cerrado': STAGES.COMPRADOR,
  'won': STAGES.COMPRADOR,
  'failed': STAGES.DESCARTADO
};

function normalizeStage(stage) {
  if (!stage) return STAGES.PRIMER_CONTACTO;
  const s = String(stage).toLowerCase().trim();
  if (Object.values(STAGES).includes(s)) return s;
  return LEGACY_MAPPING[s] || STAGES.PRIMER_CONTACTO;
}

function isValidTransition(from, to) {
  const normFrom = normalizeStage(from);
  const normTo = normalizeStage(to);
  if (normFrom === normTo) return true;
  
  // Excepción: Forzar transición manual (admin override) siempre es true si se salta reglas,
  // pero el engine estándar usará esto:
  const allowed = VALID_TRANSITIONS[normFrom];
  return allowed && allowed.includes(normTo);
}

module.exports = {
  STAGES,
  VALID_TRANSITIONS,
  LEGACY_MAPPING,
  normalizeStage,
  isValidTransition
};