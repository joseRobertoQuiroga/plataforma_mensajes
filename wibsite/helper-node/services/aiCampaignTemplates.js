'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'data', 'campaign_templates');
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });

const AI_TEMPLATES = [
  {
    id: 'tmpl-welcome-series',
    name: 'Serie de Bienvenida',
    category: 'onboarding',
    sector: 'all',
    description: 'Secuencia de 3 mensajes para nuevos leads',
    messages: [
      { step: 1, delay_hours: 0, content: '¡Hola {{name}}! Gracias por tu interés en {{product}}. Estoy aquí para ayudarte.', type: 'greeting' },
      { step: 2, delay_hours: 24, content: '{{name}}, te comparto información clave sobre {{product}}: {{benefits}}', type: 'value_prop' },
      { step: 3, delay_hours: 72, content: '{{name}}, ¿te gustaría agendar una demo sin compromiso? Respondo tus dudas.', type: 'cta' },
    ],
    expected_conversion: 0.15,
    best_for: ['new_leads', 'low_engagement'],
  },
  {
    id: 'tmpl-reactivation',
    name: 'Reactivación de Lead Inactivo',
    category: 'reactivation',
    sector: 'all',
    description: 'Recuperar leads que no han respondido en 14+ días',
    messages: [
      { step: 1, delay_hours: 0, content: '{{name}}, hace tiempo que no hablamos. ¿Sigues interesado en {{product}}?', type: 'check_in' },
      { step: 2, delay_hours: 48, content: 'Tenemos una promo especial esta semana para ti, {{name}}: {{offer}}', type: 'offer' },
    ],
    expected_conversion: 0.08,
    best_for: ['inactive_14d', 'cold_leads'],
  },
  {
    id: 'tmpl-followup-proposal',
    name: 'Seguimiento de Propuesta',
    category: 'followup',
    sector: 'all',
    description: 'Seguimiento post-propuesta comercial',
    messages: [
      { step: 1, delay_hours: 2, content: '{{name}}, te envié la propuesta. ¿Tienes alguna duda sobre los precios o funcionalidades?', type: 'followup' },
      { step: 2, delay_hours: 72, content: 'Hola {{name}}, solo recordatorio de nuestra propuesta. ¿Qué te parece si agendamos una llamada de 15 min?', type: 'urgency' },
    ],
    expected_conversion: 0.25,
    best_for: ['proposal_sent', 'warm_leads'],
  },
  {
    id: 'tmpl-event-promo',
    name: 'Promoción de Evento',
    category: 'promotion',
    sector: 'event_hall',
    description: 'Promoción de eventos con urgencia',
    messages: [
      { step: 1, delay_hours: 0, content: '🎉 {{name}}, tenemos disponibilidad para {{event_type}} en {{venue}}. ¿Te interesa?', type: 'promo' },
      { step: 2, delay_hours: 24, content: 'Solo quedan {{spots}} fechas disponibles para {{month}}. ¿Apartamos una?', type: 'urgency' },
    ],
    expected_conversion: 0.12,
    best_for: ['event_inquiry', 'venue_interest'],
  },
  {
    id: 'tmpl-nurture',
    name: 'Nurture Educativo',
    category: 'nurture',
    sector: 'all',
    description: 'Contenido educativo para leads fríos',
    messages: [
      { step: 1, delay_hours: 0, content: '{{name}}, te comparto un caso de éxito de {{industry}}: {{case_study}}', type: 'content' },
      { step: 2, delay_hours: 168, content: '¿Sabías que {{stat}}? Esto es lo que {{product}} puede hacer por ti.', type: 'education' },
      { step: 3, delay_hours: 336, content: '{{name}}, cuando estés listo para hablar, aquí estoy. Sin presión.', type: 'soft_cta' },
    ],
    expected_conversion: 0.05,
    best_for: ['cold_leads', 'educating'],
  },
  {
    id: 'tmpl-closing',
    name: 'Cierre de Venta',
    category: 'closing',
    sector: 'all',
    description: 'Último paso para cerrar deals',
    messages: [
      { step: 1, delay_hours: 0, content: '{{name}}, ¿listo para avanzar? Puedo procesar tu solicitud ahora mismo.', type: 'closing' },
      { step: 2, delay_hours: 24, content: 'Última oportunidad, {{name}}: la promo de {{discount}}% vence mañana. ¿Aprovechamos?', type: 'final_offer' },
    ],
    expected_conversion: 0.35,
    best_for: ['hot_leads', 'decision_stage'],
  },
];

class AICampaignTemplates {
  constructor() {
    this.templates = AI_TEMPLATES;
  }

  recommend(leadData, campaignType = null) {
    const scored = this.templates.map(template => {
      let score = 0;
      if (campaignType && template.category === campaignType) score += 40;
      if (leadData.score >= 70 && template.best_for.includes('hot_leads')) score += 30;
      if (leadData.score < 30 && template.best_for.includes('cold_leads')) score += 30;
      if (leadData.status === 'new' && template.best_for.includes('new_leads')) score += 25;
      if (leadData.inactive_days >= 14 && template.best_for.includes('inactive_14d')) score += 35;
      if (leadData.has_proposal && template.best_for.includes('proposal_sent')) score += 40;
      score += template.expected_conversion * 100;
      return { template, score: Math.round(score) };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map(s => ({ ...s.template, recommendation_score: s.score }));
  }

  getTemplate(templateId) {
    return this.templates.find(t => t.id === templateId) || null;
  }

  listTemplates(category = null) {
    if (category) return this.templates.filter(t => t.category === category);
    return this.templates;
  }

  getTemplatesBySector(sector) {
    return this.templates.filter(t => t.sector === 'all' || t.sector === sector);
  }

  getStats() {
    const categories = {};
    this.templates.forEach(t => {
      if (!categories[t.category]) categories[t.category] = 0;
      categories[t.category]++;
    });
    return { total: this.templates.length, categories };
  }

  generatePersonalizedMessage(templateId, stepIndex, leadData) {
    const template = this.getTemplate(templateId);
    if (!template) return null;
    const step = template.messages[stepIndex];
    if (!step) return null;
    let message = step.content;
    message = message.replace(/\{\{name\}\}/g, leadData.name || ' Cliente');
    message = message.replace(/\{\{product\}\}/g, leadData.product || 'nuestro producto');
    message = message.replace(/\{\{benefits\}\}/g, leadData.benefits || 'beneficios clave');
    message = message.replace(/\{\{offer\}\}/g, leadData.offer || 'oferta especial');
    return message;
  }
}

module.exports = { AICampaignTemplates, AI_TEMPLATES };
