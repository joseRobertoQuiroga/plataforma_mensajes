'use strict';
const { logEvent } = require('../auditLogger');

// Mapeo máquina → etapa F1
const MAP = {
  greeting: 'primer_contacto',
  discovery: 'primer_mensaje',
  qualification: 'interesado',
  proposal: 'cotizacion_pendiente',
  objections: 'cotizacion_pendiente',
  closing: 'posible_comprador',
  post_sale: 'comprador',
  support: 'interesado',
  escalated: 'interesado',
};

function projectCommercial({ machineState = 'greeting', lost = false, followupAttempt = 0, score = null, warmThreshold = 40 } = {}) {
  if (lost) return { state: 'descartado', reason: 'lost_threshold', leadStage: 'descartado' };
  if (machineState === 'post_sale' && followupAttempt >= 1 && score != null && score < warmThreshold) {
    return { state: 'enfriándose', reason: 'low_temperature', leadStage: 'interesado' };
  }
  if (machineState === 'post_sale' && followupAttempt >= 1 && score != null && score >= warmThreshold) {
    return { state: 'reactivado', reason: 'followup_response', leadStage: 'interesado' };
  }
  const mapped = MAP[machineState] || 'primer_contacto';
  return { state: mapped, reason: 'machine_projection', leadStage: mapped };
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

    // L4: Sincronizar etapa del lead si la conversación tiene un lead asociado
    const leadPhone = conv.metadata?.phone;
    if (leadPhone && projection.leadStage) {
      try {
        const { updateStore } = require('../store');
        const { normalizeStage, isValidTransition } = require('../leadStages');
        await updateStore(s => {
          const lead = s.leads.find(l => l.phone === leadPhone);
          if (!lead) return;
          const currentStage = normalizeStage(lead.status);
          const targetStage = normalizeStage(projection.leadStage);
          // Solo actualizar si la transición es válida (no retroceder)
          if (isValidTransition(currentStage, targetStage)) {
            lead.status = targetStage;
            lead.updated_at = new Date().toISOString();
          }
        });
      } catch (e) {
        console.error('[L4] Error syncing lead stage:', e.message);
      }
    }

    await logEvent('state_transition', {
      level: 'info',
      message: `Estado comercial: ${from || '-'} → ${projection.state} (${projection.reason})`,
      tenantId: conv.tenantId,
      conversationId: conv.conversationId,
      module: 'agentCore',
      flow: 'commercialState.projection',
      action: 'commercial/projection',
      data: { from: from || null, to: projection.state, reason: projection.reason, machine_state: to, lead_stage: projection.leadStage },
    });
  });
}

module.exports = { MAP, projectCommercial, registerHook };