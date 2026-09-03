const { normalizeStage } = require('./leadStages');

function buildLeadProfile(leadId, store) {
  const lead = store.leads.find(l => l.id === leadId);
  if (!lead) return null;

  const deliveries = store.deliveries.filter(d => d.contact_id === leadId || d.contact_id === lead.phone);
  const scores = store.scores.filter(s => s.lead_id === leadId);
  const campaign = lead.campaign_id ? store.campaigns.find(c => c.id === lead.campaign_id) : null;
  
  // K5: Todas las campaÃ±as donde participÃ³ (no solo la principal)
  const allCampaigns = store.campaigns ? store.campaigns.filter(c => {
    if (c.id === lead.campaign_id) return true;
    const hasDelivery = deliveries.some(d => d.campaign_id === c.id);
    return hasDelivery;
  }).map(c => ({ id: c.id, name: c.name, channel: c.channel, status: c.status, created_at: c.created_at })) : [];

  const lastDelivery = deliveries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const lastScore = scores.sort((a, b) => new Date(b.classified_at) - new Date(a.classified_at))[0];

  const daysSinceContact = lastDelivery
    ? Math.floor((Date.now() - new Date(lastDelivery.created_at).getTime()) / 86400000) : null;

  const deliveryStats = {
    total: deliveries.length,
    sent: deliveries.filter(d => d.status === 'sent').length,
    delivered: deliveries.filter(d => d.status === 'delivered').length,
    read: deliveries.filter(d => d.status === 'read').length,
    replied: deliveries.filter(d => d.status === 'replied').length,
    failed: deliveries.filter(d => d.status === 'failed').length,
    lastStatus: lastDelivery?.status || null,
    lastContact: lastDelivery?.created_at || null,
    daysSinceContact,
  };

  const scoreHistory = scores.map(s => ({
    score: s.score, category: s.category, model: s.score_model,
    factors: s.score_factors, classifiedAt: s.classified_at,
    llmReasoning: s.llm_reasoning || null,
  }));

  const engagementScore = lead.score_data?.engagement || 0;
  const recencyScore = lead.score_data?.recency || 0;

  // K7: Timeline unificada â€” mensajes + cambios de etapa + scores + notas
  const timeline = buildTimeline(lead, deliveries, scores);

  // A9: grupo/segmento del lead (K12 chatGroups)
  const groupNames = getLeadGroupNames(leadId);

  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    status: lead.status,
    stage: normalizeStage(lead.status),
    groups: groupNames,
    score: lead.score,
    is_favorite: !!lead.is_favorite, // K6
    company_id: lead.company_id || null,
    scoreCategory: lastScore?.category || (lead.score >= 70 ? 'hot' : lead.score >= 40 ? 'warm' : 'cold'),
    campaign: campaign ? { id: campaign.id, name: campaign.name, channel: campaign.channel } : null,
    campaigns: allCampaigns, // K5
    customFields: lead.custom_fields,
    scoreData: lead.score_data,
    deliveryStats,
    scoreHistory,
    scoreHistoryCount: scoreHistory.length,
    twentyId: lead.contact_id || null, // ADR-010: referencia generica de CRM (Twenty fuera de alcance)
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    tags: buildTags(lead, deliveryStats, engagementScore, recencyScore),
    nextAction: suggestNextAction(lead, deliveryStats, engagementScore, recencyScore, groupNames),
    notes: lead.notes || [],
    timeline, // K7
  };
}

// A9: nombres de los grupos manuales (K12) a los que pertenece el lead
function getLeadGroupNames(leadId) {
  try {
    const chatGroups = require('./chatGroups');
    const ids = chatGroups.getLeadGroups(leadId) || [];
    const groups = chatGroups.listGroups();
    return ids
      .map((id) => groups.find((g) => g.id === id))
      .filter(Boolean)
      .map((g) => g.name);
  } catch (e) {
    return [];
  }
}

function buildTags(lead, deliveryStats, engagementScore, recencyScore) {
  const tags = [];
  if (lead.score >= 70) tags.push('hot');
  else if (lead.score >= 40) tags.push('warm');
  else tags.push('cold');
  if (deliveryStats.replied > 0) tags.push('engaged');
  if (deliveryStats.replied === 0 && deliveryStats.delivered > 0) tags.push('pending_reply');
  if (deliveryStats.daysSinceContact !== null && deliveryStats.daysSinceContact > 30) tags.push('stale');
  if (deliveryStats.failed > 0) tags.push('has_errors');
  if (lead.status === 'opted_out') tags.push('opted_out');
  if (lead.contact_id) tags.push('synced_to_crm');
  if (lead.source) tags.push(`source:${lead.source}`);
  return tags;
}

function suggestNextAction(lead, deliveryStats, engagementScore, recencyScore, groupNames = []) {
  const stage = normalizeStage(lead.status);
  const groupHint = groupNames && groupNames.length ? ` | grupos: ${groupNames.join(', ')}` : '';

  if (lead.status === 'opted_out') return { action: 'remove_from_campaigns', reason: 'Lead opt-out' };
  if (deliveryStats.total === 0) return { action: 'send_first_message', reason: 'Lead sin contacto inicial' };
  if (deliveryStats.daysSinceContact !== null && deliveryStats.daysSinceContact > 14 && deliveryStats.replied === 0) {
    return { action: 'send_followup', reason: `Sin respuesta en ${deliveryStats.daysSinceContact} dÃ­as` };
  }
  // A9: reglas por etapa (pipeline comercial F1)
  if (stage === 'interesado' && deliveryStats.replied > 0) {
    return { action: 'send_offer', reason: `Lead interesado que respondiÃ³: enviar oferta/cotizaciÃ³n${groupHint}` };
  }
  if (stage === 'cotizacion_pendiente') {
    return { action: 'send_quote', reason: 'CotizaciÃ³n pendiente: confirmar propuesta y condiciones' };
  }
  if (stage === 'posible_comprador') {
    return { action: 'try_to_close', reason: 'Posible comprador: agendar cierre o llamada de confirmaciÃ³n' };
  }
  if (stage === 'comprador') {
    return { action: 'ask_for_referral', reason: 'Lead comprador: pedir referidos o venta cruzada' };
  }
  if (stage === 'descartado') {
    return { action: 'reactivate', reason: 'Lead descartado: intentar reactivaciÃ³n con nueva propuesta' };
  }
  if (deliveryStats.replied > 0 && lead.score < 70) {
    return { action: 'try_to_close', reason: `Lead ha respondido, score ${lead.score}/100` };
  }
  if (lead.score >= 70 && !lead.contact_id) {
    return { action: 'sync_to_crm', reason: 'Lead caliente (score alto) sin CRM: sincronizar con la fuente de verdad' };
  }
  if (deliveryStats.daysSinceContact !== null && deliveryStats.daysSinceContact < 3 && lead.score < 40) {
    return { action: 'send_nurturing', reason: 'Lead reciente pero frÃ­o, enviar contenido educativo' };
  }
  return { action: 'monitor', reason: 'Esperar interacciÃ³n del lead' };
}

// K7: Timeline unificada por contacto
function buildTimeline(lead, deliveries, scores) {
  const events = [];

  // Mensajes/entregas
  for (const d of deliveries) {
    events.push({
      type: 'message',
      at: d.created_at || d.sent_at,
      label: `Mensaje ${d.status}`,
      detail: d.status,
      channel: d.channel || 'whatsapp',
      icon: 'message',
    });
  }

  // Cambios de puntuaciÃ³n
  for (const s of scores) {
    events.push({
      type: 'score',
      at: s.classified_at,
      label: `Score: ${s.score} (${s.category || 'â€”'})`,
      detail: s.llm_reasoning || null,
      icon: 'score',
    });
  }

  // Notas del lead
  if (Array.isArray(lead.notes)) {
    for (const n of lead.notes) {
      const noteAt = typeof n === 'string' ? lead.updated_at : n.at;
      const noteText = typeof n === 'string' ? n : n.text;
      events.push({
        type: 'note',
        at: noteAt,
        label: `Nota: ${String(noteText).slice(0, 60)}${noteText?.length > 60 ? '...' : ''}`,
        detail: typeof n === 'string' ? n : n.text,
        by: typeof n === 'object' ? n.by : 'operador',
        icon: 'note',
      });
    }
  }

  // CreaciÃ³n del lead
  events.push({
    type: 'created',
    at: lead.created_at,
    label: `Lead creado (${lead.source || 'manual'})`,
    icon: 'created',
  });

  // Ordenar cronolÃ³gicamente descendente (mÃ¡s reciente primero)
  return events.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

module.exports = { buildLeadProfile, buildTags, suggestNextAction, buildTimeline, getLeadGroupNames };
