const UNKNOWN_RESPONSES = [
  'No tengo información sobre eso. ¿Puedo ayudarte con otra cosa?',
  'No tengo datos sobre esa consulta en mi base de conocimiento. ¿Te gustaría preguntar algo más?',
  'Esa información no está disponible en mi base de conocimiento. ¿Hay algo más en lo que pueda ayudarte?',
  'Lo siento, no tengo información al respecto. ¿Quieres consultar sobre nuestros productos o servicios?',
  'No puedo responder esa pregunta con la información actual. Por favor, consulta con un asesor humano para más detalles.',
];

const HALLUCINATION_TRIGGERS = [
  /no\s+tenemos\s+(información|datos|registros)/i,
  /no\s+(está|se\s+encuentra|existe)\s+(disponible|listado|registrado)/i,
  /no\s+(tengo|poseo|dispongo)\s+(información|datos|conocimiento)/i,
  /no\s+lo\s+sé/i,
  /no\s+puedo\s+(responder|contestar|decir)/i,
  /consulta\s+con\s+un\s+(asesor|agente|humano|vendedor)/i,
  /consultar\s+(con|a)\s+un\s+(asesor|agente|humano)/i,
];

const FORBIDDEN_KNOWLEDGE_PATTERNS = [
  /precio\s+de\s+(?!.*(?:nuestro|mi|listado|catalogo))(?:\w+\s+){0,3}(?!(?:no|sin|fuera))/i,
  /cuánto\s+cuesta/i,
  /qué\s+productos\s+tienen/i,
  /tienen\s+.*\?$/i,
];

function isUnknownQuery(query, config) {
  if (!query || typeof query !== 'string') return true;

  const lower = query.toLowerCase();
  const hasProductKeywords = config?.products?.length > 0 &&
    config.products.some(p =>
      lower.includes(p.name?.toLowerCase()) ||
      lower.includes(p.keywords?.join(' ')?.toLowerCase())
    );

  if (hasProductKeywords) return false;

  const bizType = require('./agentConfig').getBusinessTypeInfo(config?.business_type);
  const hasBizKeywords = bizType?.keywords?.some(k => lower.includes(k));
  if (hasBizKeywords) return false;

  const hasKnownTerms = /(hola|buenas|gracias|quiero|necesito|información|ayuda|precio|producto|servicio|comprar|contacto|horario|dirección|teléfono|whatsapp|demo|cotización)/i.test(lower);
  return !hasKnownTerms;
}

function shouldBlockResponse(responseText) {
  if (!responseText || typeof responseText !== 'string') return false;
  return HALLUCINATION_TRIGGERS.some(p => p.test(responseText));
}

function getRandomUnknownResponse() {
  return UNKNOWN_RESPONSES[Math.floor(Math.random() * UNKNOWN_RESPONSES.length)];
}

function enforceKnowledgeBoundaries(systemPrompt, knowledgeDocs) {
  const boundaries = [
    `\n\nDOCUMENTOS DE CONOCIMIENTO DISPONIBLES:\n${knowledgeDocs.length > 0 ? knowledgeDocs.map((d, i) => `${i + 1}. ${d.title}: ${d.content.substring(0, 200)}...`).join('\n') : 'No hay documentos cargados.'}`,
    '\n\nREGLAS ESTRICTAS:\n- SOLO responde con información de los documentos listados arriba.\n- Si la pregunta NO está cubierta por ningún documento, responde: "' + getRandomUnknownResponse() + '"\n- NO inventes precios, características, fechas o cualquier información.\n- NO especules sobre productos, servicios o políticas.',
  ];
  return systemPrompt + boundaries.join('\n');
}

module.exports = {
  isUnknownQuery, shouldBlockResponse, getRandomUnknownResponse,
  enforceKnowledgeBoundaries, UNKNOWN_RESPONSES, HALLUCINATION_TRIGGERS,
};
