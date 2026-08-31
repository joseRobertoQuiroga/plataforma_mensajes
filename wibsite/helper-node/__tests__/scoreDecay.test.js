const { applyDecayToLead, DEFAULT_DECAY_CONFIG } = require('../services/scoreDecay');
const { STAGES } = require('../services/leadStages');

describe('L5 - Score Decay', () => {
  it('No penaliza dentro del grace period', () => {
    const lead = { score: 100, updated_at: new Date(Date.now() - 3 * 86400000).toISOString(), status: STAGES.INTERESADO };
    const { modified, lead: result } = applyDecayToLead(lead, DEFAULT_DECAY_CONFIG, new Date());
    expect(modified).toBe(false);
    expect(result.score).toBe(100);
  });

  it('Penaliza despues del grace period', () => {
    // 10 dias inactivo -> grace 7 -> penaliza 3 dias * 2 = 6 puntos
    const lead = { score: 100, updated_at: new Date(Date.now() - 10 * 86400000).toISOString(), status: STAGES.INTERESADO };
    const { modified, lead: result } = applyDecayToLead(lead, DEFAULT_DECAY_CONFIG, new Date());
    expect(modified).toBe(true);
    expect(result.score).toBe(94);
    expect(result.score_data.last_decay_days).toBe(3);
  });

  it('Descartado despues del umbral autoDiscardDays', () => {
    // 31 dias inactivo
    const lead = { score: 50, updated_at: new Date(Date.now() - 31 * 86400000).toISOString(), status: STAGES.INTERESADO };
    const { modified, lead: result } = applyDecayToLead(lead, DEFAULT_DECAY_CONFIG, new Date());
    expect(modified).toBe(true);
    expect(result.status).toBe(STAGES.DESCARTADO);
    expect(result.score).toBe(0); // minScore
  });

  it('No toca leads que ya estan ganados o descartados', () => {
    const lead = { score: 100, updated_at: new Date(Date.now() - 40 * 86400000).toISOString(), status: STAGES.COMPRADOR };
    const { modified, lead: result } = applyDecayToLead(lead, DEFAULT_DECAY_CONFIG, new Date());
    expect(modified).toBe(false);
    expect(result.status).toBe(STAGES.COMPRADOR);
  });
});