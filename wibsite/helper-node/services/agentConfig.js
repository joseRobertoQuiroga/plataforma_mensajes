const crypto = require('crypto');

const DEFAULT_AGENT_CONFIG = {
  business_name: 'Mi Negocio',
  business_type: 'productos_fisicos',
  description: 'Venta de productos físicos por WhatsApp',
  personality: 'profesional_amigable',
  tone: 'formal',
  language: 'es',
  products: [],
  faqs: [],
  greeting: '¡Hola {{name}}! Gracias por contactar a {{business}}. Soy el asistente virtual. ¿En qué puedo ayudarte hoy?',
  disclaimers: ['Los precios y disponibilidad están sujetos a cambios sin previo aviso.'],
  business_hours: { monday: { start: '09:00', end: '18:00' }, tuesday: { start: '09:00', end: '18:00' }, wednesday: { start: '09:00', end: '18:00' }, thursday: { start: '09:00', end: '18:00' }, friday: { start: '09:00', end: '18:00' }, saturday: { start: '10:00', end: '14:00' }, sunday: null },
  whatsapp_templates: ['welcome-whatsapp', 'promo-whatsapp'],
  scoring_thresholds: { hot: 70, warm: 40, cold: 0 },
  auto_reply_enabled: true,
  max_messages_per_day: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const BUSINESS_TYPES = {
  productos_fisicos: { label: 'Productos físicos', description: 'Venta de productos tangibles', greeting: 'productos', keywords: ['comprar', 'producto', 'precio', 'envío', 'catálogo'] },
  servicios_profesionales: { label: 'Servicios profesionales', description: 'Consultoría, asesoría, servicios B2B', greeting: 'servicios', keywords: ['consultoría', 'asesoría', 'servicio', 'cotización', 'proyecto'] },
  educacion: { label: 'Educación y cursos', description: 'Cursos, talleres, capacitaciones', greeting: 'educación', keywords: ['curso', 'taller', 'clase', 'capacitación', 'aprender'] },
  salud_y_bienestar: { label: 'Salud y bienestar', description: 'Clínicas, spas, gimnasios', greeting: 'salud', keywords: ['cita', 'consulta', 'tratamiento', 'terapia', 'salud'] },
  alimentos: { label: 'Alimentos y bebidas', description: 'Restaurantes, delivery, catering', greeting: 'alimentos', keywords: ['menú', 'delivery', 'pedido', 'comida', 'reserva'] },
  tecnologia: { label: 'Tecnología y SaaS', description: 'Software, apps, soluciones digitales', greeting: 'tecnología', keywords: ['software', 'app', 'suscripción', 'demo', 'licencia'] },
  inmobiliario: { label: 'Inmobiliario', description: 'Venta y alquiler de propiedades', greeting: 'propiedades', keywords: ['propiedad', 'departamento', 'alquiler', 'venta', 'inmueble'] },
  finanzas: { label: 'Finanzas y seguros', description: 'Servicios financieros, seguros, inversiones', greeting: 'financieros', keywords: ['seguro', 'préstamo', 'inversión', 'financiamiento', 'tarjeta'] },
  turismo: { label: 'Turismo y hotelería', description: 'Hoteles, agencias de viaje, tours', greeting: 'turismo', keywords: ['hotel', 'viaje', 'reserva', 'tour', 'destino'] },
  ecommerce: { label: 'E-commerce', description: 'Tienda online, marketplace', greeting: 'tienda', keywords: ['pedido', 'compra', 'devolución', 'seguimiento', 'pago'] },
};

const PERSONALITY_TYPES = {
  profesional_amigable: { label: 'Profesional amigable', tone: 'Cálido pero profesional', instructions: 'Sé servicial y accesible, manteniendo un tono profesional.' },
  ejecutivo: { label: 'Ejecutivo formal', tone: 'Serio y formal', instructions: 'Sé directo, formal y eficiente. Evita lenguaje casual.' },
  creativo: { label: 'Creativo y cercano', tone: 'Casual y entusiasta', instructions: 'Sé cercano, usa emojis con moderación, muestra entusiasmo.' },
  tecnico: { label: 'Técnico detallado', tone: 'Preciso y detallado', instructions: 'Proporciona información técnica detallada cuando sea necesario.' },
  ventas: { label: 'Vendedor proactivo', tone: 'Persuasivo y orientado a conversión', instructions: 'Identifica oportunidades de venta y haz upsell/crosssell cuando sea natural.' },
};

function getAgentConfig(tenantId, store) {
  const configs = store.agentConfigs || {};
  let config = configs[tenantId || 'default'];
  if (!config) {
    config = { ...DEFAULT_AGENT_CONFIG, tenantId: tenantId || 'default' };
    config.created_at = new Date().toISOString();
    config.updated_at = new Date().toISOString();
  }
  return config;
}

function updateAgentConfig(tenantId, updates, store) {
  const configs = store.agentConfigs || {};
  const existing = configs[tenantId || 'default'] || { ...DEFAULT_AGENT_CONFIG, tenantId: tenantId || 'default' };
  const updatableFields = [
    'business_name', 'business_type', 'description', 'personality', 'tone', 'language',
    'products', 'faqs', 'greeting', 'disclaimers', 'business_hours', 'whatsapp_templates',
    'scoring_thresholds', 'auto_reply_enabled', 'max_messages_per_day', 'custom_fields', // K10
  ];
  for (const field of updatableFields) {
    if (updates[field] !== undefined) existing[field] = updates[field];
  }
  existing.updated_at = new Date().toISOString();
  if (!existing.created_at) existing.created_at = existing.updated_at;

  if (!store.agentConfigs) store.agentConfigs = {};
  store.agentConfigs[tenantId || 'default'] = existing;
  return existing;
}

function getBusinessTypeInfo(businessType) {
  return BUSINESS_TYPES[businessType] || BUSINESS_TYPES.productos_fisicos;
}

function getPersonalityInfo(personalityType) {
  return PERSONALITY_TYPES[personalityType] || PERSONALITY_TYPES.profesional_amigable;
}

function buildSystemPrompt(config) {
  const bizType = getBusinessTypeInfo(config.business_type);
  const persType = getPersonalityInfo(config.personality);

  const productList = config.products?.length > 0
    ? config.products.map(p => `- ${p.name}: ${p.description} (${p.price || 'consultar precio'})`).join('\n')
    : 'No hay productos configurados. Responde que consulten por lista de productos.';

  const faqList = config.faqs?.length > 0
    ? config.faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n')
    : 'No hay FAQs configuradas.';

  const hoursStr = Object.entries(config.business_hours || {})
    .filter(([_, v]) => v)
    .map(([day, v]) => `  ${day}: ${v.start} - ${v.end}`)
    .join('\n');

  return `Eres un asistente de ventas para "${config.business_name}".

INFORMACIÓN DEL NEGOCIO:
- Tipo: ${bizType.label} - ${bizType.description}
- Descripción: ${config.description}
- Idioma: ${config.language === 'es' ? 'Español' : config.language}

PERSONALIDAD:
- Estilo: ${persType.label} (${persType.tone})
- Instrucciones: ${persType.instructions}

PRODUCTOS/SERVICIOS:
${productList}

PREGUNTAS FRECUENTES:
${faqList}

HORARIO DE ATENCIÓN:
${hoursStr || 'No especificado'}

REGLAS IMPORTANTES:
1. ${config.disclaimers?.join('\n2. ') || 'Sé honesto sobre lo que no sabes.'}
2. NO inventes productos, precios o información que no esté en los datos proporcionados.
3. Si no tienes información sobre algo, di "No tengo información sobre eso, ¿puedo ayudarte con otra cosa?"
4. Sé respetuoso y útil en todo momento.
5. Identifica si el lead quiere comprar, tiene duda o necesita soporte.
6. Si la consulta es compleja o requiere un humano, ofrece escalar.`;
}

module.exports = {
  getAgentConfig, updateAgentConfig, getBusinessTypeInfo, getPersonalityInfo, buildSystemPrompt,
  DEFAULT_AGENT_CONFIG, BUSINESS_TYPES, PERSONALITY_TYPES,
};
