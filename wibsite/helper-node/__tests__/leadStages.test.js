const { STAGES, normalizeStage, isValidTransition } = require('../services/leadStages');

describe('F1 - Ciclo de Vida del Lead', () => {
  it('Debería mapear estados legados al nuevo formato', () => {
    expect(normalizeStage('nuevo')).toBe(STAGES.PRIMER_CONTACTO);
    expect(normalizeStage('calificado')).toBe(STAGES.INTERESADO);
    expect(normalizeStage('cerrado')).toBe(STAGES.COMPRADOR);
    expect(normalizeStage('desconocido_rnd')).toBe(STAGES.PRIMER_CONTACTO);
  });

  it('Debería validar transiciones correctamente', () => {
    expect(isValidTransition(STAGES.PRIMER_CONTACTO, STAGES.PRIMER_MENSAJE)).toBe(true);
    expect(isValidTransition(STAGES.PRIMER_MENSAJE, STAGES.COMPRADOR)).toBe(false); // salto inválido
    expect(isValidTransition(STAGES.POSIBLE_COMPRADOR, STAGES.DESCARTADO)).toBe(true);
  });
});