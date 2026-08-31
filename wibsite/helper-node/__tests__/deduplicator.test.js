const { deduplicateLeads } = require('../services/deduplicator');

describe('K1 - Deduplicación de Leads', () => {
  it('Debería fusionar leads con el mismo teléfono', () => {
    const input = [
      { id: '1', phone: '+123', name: 'Juan', score: 10, status: 'nuevo', notes: ['A'] },
      { id: '2', phone: '+123', email: 'juan@m.com', score: 20, status: 'oportunidad', notes: ['B'] },
    ];
    
    const { deduplicatedLeads, mergedCount } = deduplicateLeads(input);
    expect(mergedCount).toBe(1);
    expect(deduplicatedLeads).toHaveLength(1);
    
    const merged = deduplicatedLeads[0];
    expect(merged.name).toBe('Juan');
    expect(merged.email).toBe('juan@m.com');
    expect(merged.score).toBe(20);
    expect(merged.status).toBe('oportunidad');
    expect(merged.notes).toContain('A');
    expect(merged.notes).toContain('B');
  });

  it('Debería priorizar estados avanzados y nombre más largo', () => {
    const input = [
      { id: '1', email: 'a@a.com', name: 'Ale', status: 'propuesta' },
      { id: '2', email: 'a@a.com', name: 'Alejandro', status: 'nuevo' },
    ];
    
    const { deduplicatedLeads } = deduplicateLeads(input);
    expect(deduplicatedLeads).toHaveLength(1);
    expect(deduplicatedLeads[0].name).toBe('Alejandro');
    expect(deduplicatedLeads[0].status).toBe('propuesta');
  });
});