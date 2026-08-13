'use strict';
const { logEvent } = require('../auditLogger');

const MAP = {
  greeting: 'nuevo',
  discovery: 'calificando',
  qualification: 'calificando',
  proposal: 'propuesta_enviada',
  objections: 'en_objeción',
  closing: 'agendado/cerrado',
  post_sale: 'agendado/cerrado',
  support: 'reactivado',
  escalated: 'derivado_a_humano',
};

function projectCommercial({ machineState = 'greeting', lost = false, followupAttempt = 0, score = null, warmThreshold = 40 } = {}) {
  if (lost) return { state: 'perdido', reason: 'lost_threshold' };
  if (machineState === 'post_sale' && followupAttempt >= 1 && score != null && score < warmThreshold) {
    return { state: 'enfriándose', reason: 'low_temperature' };
  }
  if (machineState === 'post_sale' && followupAttempt >= 1 && score != null && score >= warmThreshold) {
    return { state: 'reactivado', reason: 'followup_response' };
  }
  const mapped = MAP[machineState] || 'nuevo';
  return { state: mapped, reason: 'machine_projection' };
}

function registerHook() {
  const { onTransition, updateConversationMetadata } = require('../conversationStore');
  return onTransition(async (conv, { from, to }) => {
    const projection = projectCommercial({
      machineState: to,
      lost: conv.metadata?.lost === true || false,
      followupAttempt: conv.messages?.filter(m => m.role === 'assistant' && /cadencia|seguimiento/i.test(m.content)).length || 0,
      score: conv.metadata?.score != null ? conv.metadata.score : null,
    });
    await updateConversationMetadata(conv.tenantId, conv.conversationId, { commercial_state: projection.state });
    await logEvent('state_transition', {
      level: 'info',
      message: `Estado comercial: ${from || '-'} → ${projection.state} (${projection.reason})`,
      tenantId: conv.tenantId,
      conversationId: conv.conversationId,
      module: 'agentCore',
      flow: 'commercialState.projection',
      action: 'commercial/projection',
      data: { from: from || null, to: projection.state, reason: projection.reason, machine_state: to },
    });
  });
}

module.exports = { MAP, projectCommercial, registerHook };