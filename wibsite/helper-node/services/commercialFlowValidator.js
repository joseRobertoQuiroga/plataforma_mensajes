'use strict';

const FLOW_STAGES = [
  'apertura',
  'calificacion',
  'propuesta_valor',
  'profundizacion',
  'objeciones',
  'cierre',
  'derivacion',
  'handoff',
  'seguimiento',
];

const VALID_TRANSITIONS = {
  apertura: ['calificacion'],
  calificacion: ['propuesta_valor', 'objeciones'],
  propuesta_valor: ['profundizacion', 'objeciones'],
  profundizacion: ['objeciones', 'cierre'],
  objeciones: ['profundizacion', 'cierre', 'derivacion', 'handoff'],
  cierre: ['seguimiento'],
  derivacion: ['handoff', 'seguimiento'],
  handoff: ['seguimiento'],
  seguimiento: ['profundizacion', 'cierre'],
};

const STAGE_DESCRIPTIONS = {
  apertura: 'Saludo inicial y presentación',
  calificacion: 'Recopilar información del lead (budget, timeline, necesidad)',
  propuesta_valor: 'Presentar solución y beneficios',
  profundizacion: 'Detallar funcionalidades y caso de uso',
  objeciones: 'Manejar objeciones y dudas',
  cierre: 'Propuesta final y cierre',
  derivacion: 'Derivar a humano o especialista',
  handoff: 'Transferir a humano',
  seguimiento: 'Post-venta y nurturing',
};

const KEY_SIGNALS = {
  apertura: ['hola', 'buenos', 'buenas', 'que tal', 'como estas', 'saludos'],
  calificacion: ['presupuesto', 'budget', 'cuanto', 'costo', 'precio', 'necesito', 'quiero', 'busco'],
  propuesta_valor: ['solucion', 'beneficio', 'funcionalidad', 'puede hacer', 'como funciona'],
  profundizacion: ['detall', 'ejemplo', 'como se', 'cuando', 'donde', 'mas informacion'],
  objeciones: ['caro', 'no se', 'dudando', 'comparar', 'pensar', 'despues'],
  cierre: ['contrato', 'firmar', 'acepto', 'de acuerdo', 'continuar', 'avanzar'],
  derivacion: ['gerente', 'director', 'humano', 'persona', 'hablar con'],
  handoff: ['transferir', 'agente', 'especialista', 'representante'],
  seguimiento: ['gracias', 'perfecto', 'entendido', 'ok', 'listo'],
};

class CommercialFlowValidator {
  constructor() {
    this.stageIndex = {};
    FLOW_STAGES.forEach((stage, idx) => {
      this.stageIndex[stage] = idx;
    });
  }

  validateConversation(messages, template_id = 'template-consultora-software') {
    if (!messages || messages.length === 0) {
      return { valid: false, error: 'empty_conversation', stages_visited: [], compliance_score: 0 };
    }

    const stagesDetected = [];
    const stageMessages = {};
    const violations = [];

    for (const msg of messages) {
      if (msg.direction === 'outbound') {
        const detected = this.detectStage(msg.content);
        if (detected) {
          if (!stageMessages[detected]) stageMessages[detected] = [];
          stageMessages[detected].push(msg);
          if (!stagesDetected.includes(detected)) stagesDetected.push(detected);
        }
      }
    }

    for (let i = 1; i < stagesDetected.length; i++) {
      const prev = stagesDetected[i - 1];
      const curr = stagesDetected[i];
      const allowed = VALID_TRANSITIONS[prev] || [];
      if (!allowed.includes(curr)) {
        violations.push({ from: prev, to: curr, rule: 'invalid_transition' });
      }
    }

    const stagesCovered = stagesDetected.length / FLOW_STAGES.length;
    const transitionCompliance = violations.length === 0 ? 1.0 : Math.max(0, 1 - violations.length * 0.2);
    const compliance_score = Math.round((stagesCovered * 0.6 + transitionCompliance * 0.4) * 100);

    return {
      valid: violations.length === 0,
      stages_visited: stagesDetected,
      stages_count: stagesDetected.length,
      total_stages: FLOW_STAGES.length,
      compliance_score,
      violations,
      stage_messages: stageMessages,
      duration_messages: messages.length,
    };
  }

  detectStage(messageContent) {
    if (!messageContent) return null;
    const lower = messageContent.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [stage, signals] of Object.entries(KEY_SIGNALS)) {
      let score = 0;
      for (const signal of signals) {
        if (lower.includes(signal)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = stage;
      }
    }
    return bestScore > 0 ? bestMatch : null;
  }

  canTransition(from, to) {
    const allowed = VALID_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }

  getStageInfo(stage) {
    return {
      stage,
      description: STAGE_DESCRIPTIONS[stage] || 'Unknown',
      index: this.stageIndex[stage],
      valid_next: VALID_TRANSITIONS[stage] || [],
    };
  }

  getFlowDiagram() {
    return FLOW_STAGES.map(stage => ({
      stage,
      description: STAGE_DESCRIPTIONS[stage],
      next: VALID_TRANSITIONS[stage] || [],
    }));
  }

  suggestNextStage(currentStage, leadData = {}) {
    const validNext = VALID_TRANSITIONS[currentStage] || [];
    if (validNext.length === 0) return null;
    if (validNext.length === 1) return validNext[0];

    if (leadData.score >= 70 && validNext.includes('cierre')) return 'cierre';
    if (leadData.has_objections && validNext.includes('objeciones')) return 'objeciones';
    if (leadData.needs_human && validNext.includes('handoff')) return 'handoff';
    return validNext[0];
  }
}

module.exports = { CommercialFlowValidator, FLOW_STAGES, VALID_TRANSITIONS, STAGE_DESCRIPTIONS };
