function buildLeadProfile(leadId, store) {
  const lead = store.leads.find(l => l.id === leadId);
  if (!lead) return null;

  const deliveries = store.deliveries.filter(d => d.contact_id === leadId || d.contact_id === lead.phone);
  const scores = store.scores.filter(s => s.lead_id === leadId);
  const campaign = lead.campaign_id ? store.campaigns.find(c => c.id === lead.campaign_id) : null;
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

  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    status: lead.status,
    score: lead.score,
    scoreCategory: lastScore?.category || (lead.score >= 70 ? 'hot' : lead.score >= 40 ? 'warm' : 'cold'),
    campaign: campaign ? { id: campaign.id, name: campaign.name, channel: campaign.channel } : null,
    customFields: lead.custom_fields,
    scoreData: lead.score_data,
    deliveryStats,
    scoreHistory,
    scoreHistoryCount: scoreHistory.length,
    twentyId: lead.contact_id || null,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    tags: buildTags(lead, deliveryStats, engagementScore, recencyScore),
    nextAction: suggestNextAction(lead, deliveryStats, engagementScore, recencyScore),
  };
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

function suggestNextAction(lead, deliveryStats, engagementScore, recencyScore) {
  if (lead.status === 'opted_out') return { action: 'remove_from_campaigns', reason: 'Lead opt-out' };
  if (deliveryStats.total === 0) return { action: 'send_first_message', reason: 'Lead sin contacto inicial' };
  if (deliveryStats.daysSinceContact !== null && deliveryStats.daysSinceContact > 14 && deliveryStats.replied === 0) {
    return { action: 'send_followup', reason: `Sin respuesta en ${deliveryStats.daysSinceContact} días` };
  }
  if (deliveryStats.replied > 0 && lead.score < 70) {
    return { action: 'try_to_close', reason: `Lead ha respondido, score ${lead.score}/100` };
  }
  if (lead.score >= 70 && !lead.contact_id) {
    return { action: 'sync_to_crm', reason: 'Lead caliente, sincronizar a CRM' };
  }
  if (deliveryStats.daysSinceContact !== null && deliveryStats.daysSinceContact < 3 && lead.score < 40) {
    return { action: 'send_nurturing', reason: 'Lead reciente pero frío, enviar contenido educativo' };
  }
  return { action: 'monitor', reason: 'Esperar interacción del lead' };
}

module.exports = { buildLeadProfile, buildTags, suggestNextAction };
