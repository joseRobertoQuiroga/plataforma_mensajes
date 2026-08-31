const { getStore, updateStore, writeLeadToPg } = require('./store');

function deduplicateLeads(leads) {
  const mergedMap = new Map();
  let mergedCount = 0;

  for (const lead of leads) {
    // Normalizar llave primaria de duplicados
    const phoneKey = (lead.phone || '').trim();
    const emailKey = (lead.email || '').trim().toLowerCase();
    
    // Si no tiene teléfono ni email, usar el nombre (fallback extremo) o su ID
    const key = phoneKey || emailKey || lead.id;

    if (mergedMap.has(key)) {
      mergedCount++;
      const existing = mergedMap.get(key);
      
      // Reglas de fusión (Winner takes all o merge)
      // Nombre: el más largo o existente
      if (!existing.name || (lead.name && lead.name.length > existing.name.length)) existing.name = lead.name;
      
      // Email: el más reciente si el existente no tiene
      if (!existing.email) existing.email = lead.email;
      
      // Score: el mayor
      const eScore = Number(existing.score) || 0;
      const lScore = Number(lead.score) || 0;
      existing.score = Math.max(eScore, lScore);
      
      // Status: priorizar estados avanzados
      const statusWeight = { nuevo: 1, calificado: 2, oportunidad: 3, propuesta: 4, cerrado: 5 };
      const eWeight = statusWeight[existing.status] || 0;
      const lWeight = statusWeight[lead.status] || 0;
      if (lWeight > eWeight) existing.status = lead.status;
      
      // Notas / Source / Tags: concatenar/unir
      if (lead.source && !existing.source) existing.source = lead.source;
      
      const newNotes = Array.isArray(lead.notes) ? lead.notes : [];
      const oldNotes = Array.isArray(existing.notes) ? existing.notes : [];
      existing.notes = [...new Set([...oldNotes, ...newNotes])];

      const newTags = Array.isArray(lead.tags) ? lead.tags : [];
      const oldTags = Array.isArray(existing.tags) ? existing.tags : [];
      existing.tags = [...new Set([...oldTags, ...newTags])];
      
      // Company id 
      if (!existing.company_id && lead.company_id) existing.company_id = lead.company_id;

      existing.updated_at = new Date().toISOString();
      mergedMap.set(key, existing);
    } else {
      mergedMap.set(key, { ...lead }); // clone
    }
  }

  return { deduplicatedLeads: Array.from(mergedMap.values()), mergedCount };
}

async function runScheduledDeduplication() {
  const store = getStore();
  const { deduplicatedLeads, mergedCount } = deduplicateLeads(store.leads);
  
  if (mergedCount > 0) {
    console.log(`[Deduplicator] Se fusionaron ${mergedCount} duplicados.`);
    store.leads = deduplicatedLeads;
    updateStore();
    // En PG cada uno se actualiza o upsert
    for (const lead of deduplicatedLeads) {
      await writeLeadToPg(lead);
    }
  }
  return { mergedCount, totalLeads: deduplicatedLeads.length };
}

module.exports = {
  deduplicateLeads,
  runScheduledDeduplication
};