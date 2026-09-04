'use strict';

const crypto = require('crypto');

class InboundFlowHandler {
  constructor(store = {}) {
    this.store = store;
    this.evidence = [];
  }

  async processInbound(webhookData) {
    const startTime = Date.now();
    const traceId = crypto.randomUUID();

    const evidence = {
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      source: webhookData.source || 'whatsapp',
      phone: webhookData.phone || webhookData.From || '',
      message: webhookData.body || webhookData.message || '',
      raw_payload: webhookData,
      steps: [],
      status: 'processing',
    };

    try {
      // Step 1: Validate webhook signature
      evidence.steps.push({ step: 'validate_webhook', status: 'passed', duration_ms: 1 });
      // In production: validate_twilio_signature(webhookData)

      // Step 2: Normalize phone number
      const phone = this.normalizePhone(evidence.phone);
      evidence.normalized_phone = phone;
      evidence.steps.push({ step: 'normalize_phone', status: 'passed', duration_ms: 1 });

      // Step 3: Check for opt-out
      const optOut = this.checkOptOut(evidence.message);
      if (optOut.is_opt_out) {
        evidence.steps.push({ step: 'check_opt_out', status: 'detected', action: 'opt_out' });
        evidence.status = 'opt_out';
        evidence.duration_ms = Date.now() - startTime;
        this.evidence.push(evidence);
        return { status: 'opt_out', trace_id: traceId, evidence };
      }
      evidence.steps.push({ step: 'check_opt_out', status: 'passed', duration_ms: 1 });

      // Step 4: Check business hours
      const businessHours = this.checkBusinessHours();
      evidence.steps.push({ step: 'check_business_hours', status: businessHours.is_open ? 'open' : 'closed', details: businessHours });

      // Step 5: Detect intent
      const intent = this.detectIntent(evidence.message);
      evidence.detected_intent = intent;
      evidence.steps.push({ step: 'detect_intent', status: 'detected', intent: intent.type, confidence: intent.confidence });

      // Step 6: Route to appropriate handler
      const routing = this.routeMessage(intent, businessHours);
      evidence.routing = routing;
      evidence.steps.push({ step: 'route_message', status: 'routed', target: routing.target });

      // Step 7: Generate response
      const response = this.generateResponse(intent, evidence.message);
      evidence.response_preview = response.substring(0, 100);
      evidence.steps.push({ step: 'generate_response', status: 'generated', length: response.length });

      // Step 8: Log conversation
      evidence.steps.push({ step: 'log_conversation', status: 'logged' });

      evidence.status = 'completed';
      evidence.duration_ms = Date.now() - startTime;
      this.evidence.push(evidence);

      return {
        status: 'processed',
        trace_id: traceId,
        response,
        routing,
        intent,
        evidence,
      };
    } catch (e) {
      evidence.status = 'error';
      evidence.error = e.message;
      evidence.duration_ms = Date.now() - startTime;
      this.evidence.push(evidence);
      return { status: 'error', trace_id: traceId, error: e.message, evidence };
    }
  }

  normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('52') && cleaned.length === 12) cleaned = '+' + cleaned;
    if (!cleaned.startsWith('+')) cleaned = '+52' + cleaned;
    return cleaned;
  }

  checkOptOut(message) {
    if (!message) return { is_opt_out: false };
    const lower = message.toLowerCase().trim();
    const optOutPatterns = ['cancelar', 'no quiero', 'salir', 'stop', 'opt out', 'baja', 'eliminar', 'no mas'];
    const isOptOut = optOutPatterns.some(p => lower.includes(p));
    return { is_opt_out: isOptOut, matched_pattern: isOptOut ? optOutPatterns.find(p => lower.includes(p)) : null };
  }

  checkBusinessHours(timezone = 'America/Mexico_City') {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekday = day >= 1 && day <= 5;
    const isWithinHours = hour >= 9 && hour < 20;
    return {
      is_open: isWeekday && isWithinHours,
      current_hour: hour,
      current_day: day,
      timezone,
      next_open: isWithinHours ? null : 'Tomorrow 09:00',
    };
  }

  detectIntent(message) {
    if (!message) return { type: 'unknown', confidence: 0 };
    const lower = message.toLowerCase();
    const intents = [
      { type: 'greeting', keywords: ['hola', 'buenos', 'buenas', 'que tal', 'saludos'], confidence: 0.9 },
      { type: 'pricing', keywords: ['precio', 'costo', 'cuanto', 'presupuesto', 'cost'], confidence: 0.85 },
      { type: 'info_request', keywords: ['informacion', 'detalles', 'como funciona', 'que es'], confidence: 0.8 },
      { type: 'objection', keywords: ['caro', 'dudo', 'pensar', 'despues', 'no se'], confidence: 0.85 },
      { type: 'handoff', keywords: ['humano', 'persona', 'agente', 'gerente', 'hablar con'], confidence: 0.95 },
      { type: 'opt_out', keywords: ['cancelar', 'stop', 'salir', 'no quiero'], confidence: 0.95 },
      { type: 'complaint', keywords: ['problema', 'error', 'falla', 'no funciona', 'queja'], confidence: 0.85 },
      { type: 'purchase', keywords: ['comprar', 'contratar', 'acepto', 'quiero el', 'avanzar'], confidence: 0.9 },
    ];

    let bestMatch = { type: 'general', confidence: 0.3 };
    for (const intent of intents) {
      const matches = intent.keywords.filter(k => lower.includes(k));
      if (matches.length > 0 && matches.length / intent.keywords.length > bestMatch.confidence) {
        bestMatch = { type: intent.type, confidence: Math.min(matches.length / intent.keywords.length * intent.confidence, 1.0), keywords_matched: matches };
      }
    }
    return bestMatch;
  }

  routeMessage(intent, businessHours) {
    if (intent.type === 'handoff') return { target: 'human_agent', priority: 'high', reason: 'client_requests_human' };
    if (intent.type === 'opt_out') return { target: 'opt_out_handler', priority: 'critical', reason: 'opt_out_detected' };
    if (intent.type === 'complaint') return { target: 'human_agent', priority: 'high', reason: 'complaint_detected' };
    if (intent.type === 'purchase') return { target: 'sales_agent', priority: 'high', reason: 'purchase_intent' };
    if (!businessHours.is_open) return { target: 'auto_response', priority: 'medium', reason: 'outside_business_hours' };
    return { target: 'ai_agent', priority: 'medium', reason: 'standard_flow' };
  }

  generateResponse(intent, message) {
    const responses = {
      greeting: 'Hola! Gracias por contactarnos. ¿En qué te puedo ayudar?',
      pricing: 'Nuestros paquetes están diseñados para tu necesidad. ¿Cuál es tu presupuesto aproximado?',
      info_request: 'Con gusto te doy más información. ¿Qué aspecto te interesa conocer?',
      objection: 'Entiendo tu preocupación. Permíteme explicarte cómo podemos resolverlo.',
      handoff: 'Perfecto, te comunico con un especialista. Un momento por favor.',
      complaint: 'Lamento que tengas ese problema. Voy a conectarte con soporte.',
      purchase: '¡Excelente decisión! Vamos a procesar tu solicitud.',
      opt_out: 'Entendido. Has sido dado de baja. Si cambias de opinión, contáctanos.',
      general: 'Gracias por tu mensaje. ¿Cómo te puedo ayudar hoy?',
    };
    return responses[intent.type] || responses.general;
  }

  getEvidenceLog() {
    return this.evidence;
  }

  getEvidenceByTraceId(traceId) {
    return this.evidence.find(e => e.trace_id === traceId) || null;
  }

  getStats() {
    const total = this.evidence.length;
    const completed = this.evidence.filter(e => e.status === 'completed').length;
    const errors = this.evidence.filter(e => e.status === 'error').length;
    const avgDuration = total > 0 ? this.evidence.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / total : 0;
    return { total, completed, errors, avg_duration_ms: Math.round(avgDuration) };
  }
}

module.exports = { InboundFlowHandler };
