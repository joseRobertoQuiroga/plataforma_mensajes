const { getAgentConfig, updateAgentConfig, getBusinessTypeInfo, getPersonalityInfo, buildSystemPrompt, DEFAULT_AGENT_CONFIG, BUSINESS_TYPES, PERSONALITY_TYPES } = require('../services/agentConfig');

describe('Agent Config - MVP-04: Editor de contexto + Switcher', () => {
  test('getAgentConfig retorna config por defecto si no existe', () => {
    const store = {};
    const config = getAgentConfig('test-tenant', store);
    expect(config.business_name).toBe('Mi Negocio');
    expect(config.business_type).toBe('productos_fisicos');
    expect(config.tenantId).toBe('test-tenant');
  });

  test('getAgentConfig retorna config existente', () => {
    const store = {
      agentConfigs: {
        'test-tenant': { ...DEFAULT_AGENT_CONFIG, business_name: 'Mi Tienda', tenantId: 'test-tenant' },
      },
    };
    const config = getAgentConfig('test-tenant', store);
    expect(config.business_name).toBe('Mi Tienda');
  });

  test('updateAgentConfig guarda cambios', () => {
    const store = {};
    const updated = updateAgentConfig('test-tenant', { business_name: 'Nuevo Negocio', business_type: 'servicios_profesionales' }, store);
    expect(updated.business_name).toBe('Nuevo Negocio');
    expect(updated.business_type).toBe('servicios_profesionales');
    expect(store.agentConfigs['test-tenant'].business_name).toBe('Nuevo Negocio');
  });

  test('updateAgentConfig preserva campos no actualizados', () => {
    const store = {};
    const updated = updateAgentConfig('test-tenant', { business_name: 'Solo Nombre' }, store);
    expect(updated.business_name).toBe('Solo Nombre');
    expect(updated.business_type).toBe('productos_fisicos');
    expect(updated.personality).toBe('profesional_amigable');
  });

  test('BUSINESS_TYPES tiene todos los tipos de negocio', () => {
    expect(Object.keys(BUSINESS_TYPES)).toHaveLength(10);
    expect(BUSINESS_TYPES.productos_fisicos.label).toBe('Productos físicos');
    expect(BUSINESS_TYPES.servicios_profesionales.label).toBe('Servicios profesionales');
    expect(BUSINESS_TYPES.ecommerce.label).toBe('E-commerce');
  });

  test('getBusinessTypeInfo retorna info correcta', () => {
    const info = getBusinessTypeInfo('servicios_profesionales');
    expect(info.label).toBe('Servicios profesionales');
    expect(info.keywords).toContain('cotización');
  });

  test('getBusinessTypeInfo retorna default para tipo inválido', () => {
    const info = getBusinessTypeInfo('tipo_invalido');
    expect(info.label).toBe('Productos físicos');
  });

  test('PERSONALITY_TYPES tiene todas las personalidades', () => {
    expect(Object.keys(PERSONALITY_TYPES)).toHaveLength(5);
    expect(PERSONALITY_TYPES.profesional_amigable.label).toBe('Profesional amigable');
    expect(PERSONALITY_TYPES.ventas.label).toBe('Vendedor proactivo');
  });

  test('getPersonalityInfo retorna instrucciones correctas', () => {
    const info = getPersonalityInfo('ejecutivo');
    expect(info.tone).toBe('Serio y formal');
  });

  test('buildSystemPrompt genera prompt completo', () => {
    const config = {
      ...DEFAULT_AGENT_CONFIG,
      business_name: 'Test Store',
      business_type: 'ecommerce',
      products: [{ name: 'Zapatos', description: 'Zapatos deportivos', price: '$50' }],
      faqs: [{ question: '¿Cómo comprar?', answer: 'Agregar al carrito' }],
    };
    const prompt = buildSystemPrompt(config);
    expect(prompt).toContain('Test Store');
    expect(prompt).toContain('E-commerce');
    expect(prompt).toContain('Zapatos');
    expect(prompt).toContain('¿Cómo comprar?');
    expect(prompt).toContain('NO inventes productos');
  });

  test('buildSystemPrompt con config vacío no falla', () => {
    const prompt = buildSystemPrompt(DEFAULT_AGENT_CONFIG);
    expect(prompt).toContain('Mi Negocio');
    expect(prompt).toContain('Productos físicos');
  });

  test('DEFAULT_AGENT_CONFIG tiene todos los campos', () => {
    expect(DEFAULT_AGENT_CONFIG.business_name).toBeDefined();
    expect(DEFAULT_AGENT_CONFIG.business_type).toBeDefined();
    expect(DEFAULT_AGENT_CONFIG.personality).toBeDefined();
    expect(DEFAULT_AGENT_CONFIG.products).toBeDefined();
    expect(DEFAULT_AGENT_CONFIG.faqs).toBeDefined();
    expect(DEFAULT_AGENT_CONFIG.greeting).toBeDefined();
    expect(DEFAULT_AGENT_CONFIG.business_hours).toBeDefined();
    expect(DEFAULT_AGENT_CONFIG.scoring_thresholds).toBeDefined();
    expect(DEFAULT_AGENT_CONFIG.auto_reply_enabled).toBe(true);
  });
});
