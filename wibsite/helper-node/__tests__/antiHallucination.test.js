const { isUnknownQuery, shouldBlockResponse, getRandomUnknownResponse, enforceKnowledgeBoundaries, UNKNOWN_RESPONSES, HALLUCINATION_TRIGGERS } = require('../services/antiHallucination');

describe('Anti-Hallucination - MVP-07b: Anti-alucinaciones', () => {
  test('isUnknownQuery detecta consulta fuera de conocimiento', () => {
    expect(isUnknownQuery('¿Cuál es la capital de Marte?', { products: [] })).toBe(true);
  });

  test('isUnknownQuery NO detecta saludo como desconocido', () => {
    expect(isUnknownQuery('Hola, buenos días', { products: [] })).toBe(false);
  });

  test('isUnknownQuery detecta consulta con keyword de negocio como conocida', () => {
    const config = { products: [{ name: 'Zapatos', keywords: 'zapatos calzado' }], business_type: 'productos_fisicos' };
    expect(isUnknownQuery('¿Tienen zapatos?', config)).toBe(false);
  });

  test('isUnknownQuery detecta "quiero información" como conocida', () => {
    expect(isUnknownQuery('Quiero información', { products: [] })).toBe(false);
  });

  test('UNKNOWN_RESPONSES tiene respuestas definidas', () => {
    expect(UNKNOWN_RESPONSES.length).toBeGreaterThanOrEqual(5);
    UNKNOWN_RESPONSES.forEach(r => {
      expect(typeof r).toBe('string');
      expect(r.length).toBeGreaterThan(10);
    });
  });

  test('getRandomUnknownResponse retorna respuesta válida', () => {
    const response = getRandomUnknownResponse();
    expect(UNKNOWN_RESPONSES).toContain(response);
  });

  test('HALLUCINATION_TRIGGERS detecta patrones de alucinación', () => {
    const triggers = [
      'No tenemos información sobre eso',
      'No tengo datos sobre esa consulta',
      'No lo sé',
      'Consulta con un asesor humano',
    ];
    triggers.forEach(t => {
      const matched = HALLUCINATION_TRIGGERS.some(p => p.test(t));
      expect(matched).toBe(true);
    });
  });

  test('shouldBlockResponse detecta respuesta de "no tengo info"', () => {
    expect(shouldBlockResponse('No tenemos información sobre eso actualmente')).toBe(true);
  });

  test('shouldBlockResponse NO bloquea respuesta normal', () => {
    expect(shouldBlockResponse('Sí, tenemos zapatos deportivos desde $50')).toBe(false);
  });

  test('enforceKnowledgeBoundaries agrega reglas al prompt', () => {
    const prompt = 'Eres un asistente.';
    const docs = [{ title: 'Catálogo', content: 'Productos 2026' }];
    const result = enforceKnowledgeBoundaries(prompt, docs);
    expect(result).toContain('DOCUMENTOS DE CONOCIMIENTO DISPONIBLES');
    expect(result).toContain('Catálogo');
    expect(result).toContain('NO inventes precios');
  });

  test('enforceKnowledgeBoundaries maneja docs vacío', () => {
    const prompt = 'Eres un asistente.';
    const result = enforceKnowledgeBoundaries(prompt, []);
    expect(result).toContain('No hay documentos cargados');
  });

  test('isUnknownQuery: consulta sobre precio se considera conocida si hay productos', () => {
    const config = { products: [{ name: 'Zapatos', keywords: 'zapatos' }] };
    expect(isUnknownQuery('¿Cuánto cuestan los zapatos?', config)).toBe(false);
  });
});
