const { buildLeadProfile, buildTags, suggestNextAction } = require('../services/leadProfile');

function createMockStore(overrides = {}) {
  const base = {
    leads: [
      { id: 'lead-1', name: 'María García', phone: '+59175488354', email: 'maria@example.com', source: 'web', status: 'pending', score: 85, custom_fields: { interest: 'marketing', pain_point: 'poco tráfico', segment: 'premium' }, score_data: { engagement: 80, recency: 70 }, contact_id: 'twenty-123', campaign_id: 'camp-1', created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-18T10:00:00Z' },
      { id: 'lead-2', name: 'Carlos López', phone: '+59175488355', email: '', source: 'facebook', status: 'pending', score: 25, custom_fields: { interest: '', segment: 'standard' }, score_data: { engagement: 10, recency: 5 }, contact_id: null, campaign_id: 'camp-1', created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z' },
      { id: 'lead-3', name: 'Ana Martínez', phone: '+59175488356', email: 'ana@example.com', source: 'referral', status: 'opted_out', score: 0, custom_fields: {}, score_data: {}, contact_id: null, campaign_id: 'camp-2', created_at: '2026-07-10T10:00:00Z', updated_at: '2026-07-10T10:00:00Z' },
    ],
    deliveries: [
      { id: 'del-1', contact_id: 'lead-1', campaign_id: 'camp-1', status: 'replied', created_at: '2026-07-17T10:00:00Z' },
      { id: 'del-2', contact_id: 'lead-1', campaign_id: 'camp-1', status: 'delivered', created_at: '2026-07-16T10:00:00Z' },
      { id: 'del-3', contact_id: 'lead-2', campaign_id: 'camp-1', status: 'failed', created_at: '2026-06-01T10:00:00Z' },
    ],
    scores: [
      { id: 'score-1', lead_id: 'lead-1', score: 85, category: 'hot', score_model: 'rule-based-v1', score_factors: { engagement: 80 }, classified_at: '2026-07-18T09:00:00Z' },
      { id: 'score-2', lead_id: 'lead-1', score: 70, category: 'hot', score_model: 'llm-openrouter-v1', score_factors: {}, llm_reasoning: 'Lead engaged', classified_at: '2026-07-17T09:00:00Z' },
      { id: 'score-3', lead_id: 'lead-2', score: 25, category: 'cold', score_model: 'rule-based-v1', score_factors: { engagement: 10 }, classified_at: '2026-07-15T09:00:00Z' },
    ],
    campaigns: [
      { id: 'camp-1', name: 'Lanzamiento WhatsApp', channel: 'whatsapp' },
      { id: 'camp-2', name: 'Campaña Messenger', channel: 'messenger' },
    ],
    ...overrides,
  };
  return base;
}

describe('Lead Profile - MVP-03: Extracción y actualización de leads', () => {
  const fixedNow = new Date('2026-08-08T00:00:00Z').getTime();
  beforeAll(() => {
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
  });
  afterAll(() => {
    Date.now.mockRestore();
  });

  test('buildLeadProfile retorna perfil completo para lead existente', () => {
    const store = createMockStore();
    const profile = buildLeadProfile('lead-1', store);

    expect(profile).not.toBeNull();
    expect(profile.id).toBe('lead-1');
    expect(profile.name).toBe('María García');
    expect(profile.score).toBe(85);
    expect(profile.scoreCategory).toBe('hot');
    expect(profile.twentyId).toBe('twenty-123');

    expect(profile.campaign).toEqual({ id: 'camp-1', name: 'Lanzamiento WhatsApp', channel: 'whatsapp' });
    expect(profile.deliveryStats.total).toBe(2);
    expect(profile.deliveryStats.replied).toBe(1);
    expect(profile.deliveryStats.lastStatus).toBe('replied');
    expect(profile.deliveryStats.daysSinceContact).toBe(21);

    expect(profile.scoreHistory).toHaveLength(2);
    expect(profile.scoreHistory[0].score).toBe(85);
    expect(profile.scoreHistory[0].category).toBe('hot');
    expect(profile.scoreHistoryCount).toBe(2);
  });

  test('buildLeadProfile retorna tags correctos para lead hot', () => {
    const store = createMockStore();
    const profile = buildLeadProfile('lead-1', store);
    expect(profile.tags).toContain('hot');
    expect(profile.tags).toContain('engaged');
    expect(profile.tags).toContain('synced_to_crm');
    expect(profile.tags).toContain('source:web');
  });

  test('buildLeadProfile retorna null para lead inexistente', () => {
    const store = createMockStore();
    const profile = buildLeadProfile('lead-nonexistent', store);
    expect(profile).toBeNull();
  });

  test('buildTags: lead frío sin actividad', () => {
    const store = createMockStore();
    const profile = buildLeadProfile('lead-2', store);
    expect(profile.tags).toContain('cold');
    expect(profile.tags).toContain('has_errors');
  });

  test('suggestNextAction: lead opted_out sugiere remove', () => {
    const store = createMockStore();
    const profile = buildLeadProfile('lead-3', store);
    expect(profile.nextAction.action).toBe('remove_from_campaigns');
  });

  test('suggestNextAction: lead hot sin CRM sync sugiere sync', () => {
    const store = createMockStore();
    store.leads[0].contact_id = null;
    const profile = buildLeadProfile('lead-1', store);
    expect(profile.nextAction.action).toBe('sync_to_crm');
  });

  test('buildLeadProfile: score history incluye LLM reasoning', () => {
    const store = createMockStore();
    const profile = buildLeadProfile('lead-1', store);
    const llmScore = profile.scoreHistory.find(s => s.model === 'llm-openrouter-v1');
    expect(llmScore).toBeDefined();
    expect(llmScore.llmReasoning).toBe('Lead engaged');
  });

  test('buildLeadProfile maneja lead sin entregas', () => {
    const store = createMockStore();
    const noDeliveryLead = {
      id: 'lead-4', name: 'Nuevo Lead', phone: '+59170000000', email: '', source: 'web', status: 'new', score: 0, custom_fields: {}, score_data: {}, contact_id: null, campaign_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    store.leads.push(noDeliveryLead);
    const profile = buildLeadProfile('lead-4', store);
    expect(profile.deliveryStats.total).toBe(0);
    expect(profile.deliveryStats.lastStatus).toBeNull();
    expect(profile.nextAction.action).toBe('send_first_message');
  });

  // A9: nextAction enriquecido con etapa + grupo/segmento
  test('A9: nextAction cambia segun etapa interesado -> send_offer', () => {
    const store = createMockStore();
    store.leads[0].status = 'interesado';
    const profile = buildLeadProfile('lead-1', store);
    expect(profile.stage).toBe('interesado');
    expect(profile.nextAction.action).toBe('send_offer');
  });

  test('A9: nextAction cambia segun etapa posible_comprador -> try_to_close', () => {
    const store = createMockStore();
    store.leads[0].status = 'posible_comprador';
    const profile = buildLeadProfile('lead-1', store);
    expect(profile.stage).toBe('posible_comprador');
    expect(profile.nextAction.action).toBe('try_to_close');
  });

  test('A9: nextAction cambia segun etapa comprador -> ask_for_referral', () => {
    const store = createMockStore();
    store.leads[0].status = 'comprador';
    const profile = buildLeadProfile('lead-1', store);
    expect(profile.stage).toBe('comprador');
    expect(profile.nextAction.action).toBe('ask_for_referral');
  });

  test('A9: nextAction incluye grupos del lead en la razon', () => {
    const store = createMockStore();
    const profile = buildLeadProfile('lead-1', store);
    expect(Array.isArray(profile.groups)).toBe(true);
  });

  test('A9: suggestNextAction con grupos agrega hint al reason', () => {
    const lead = { id: 'lead-9', status: 'interesado', score: 60, contact_id: 'twenty-1' };
    const deliveryStats = { total: 2, replied: 1, delivered: 1, read: 1, failed: 0, daysSinceContact: 3, lastStatus: 'replied' };
    const action = suggestNextAction(lead, deliveryStats, 70, 50, ['Compradores', 'Premium']);
    expect(action.action).toBe('send_offer');
    expect(action.reason).toContain('Compradores');
  });
});
