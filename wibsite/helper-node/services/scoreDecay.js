const { getStore, updateStore, writeLeadToPg } = require('./store');
const { STAGES, isValidTransition } = require('./leadStages');

// Configuración default por tenant (idealmente vendría de DB platform_tenants)
const DEFAULT_DECAY_CONFIG = {
  gracePeriodDays: 7,
  decayPerDay: 2,
  minScore: 0,
  autoDiscardDays: 30, // Si pasa esto, pasa a DESCARTADO
};

function applyDecayToLead(lead, config = DEFAULT_DECAY_CONFIG, now = new Date()) {
  const lastContact = new Date(lead.replied_at || lead.updated_at || lead.created_at);
  const diffTime = Math.abs(now - lastContact);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let modified = false;
  let newScore = Number(lead.score) || 0;
  let newStatus = lead.status;

  // No aplicar decay a ganados o ya perdidos terminales
  if ([STAGES.COMPRADOR, STAGES.DESCARTADO, STAGES.OPT_OUT].includes(lead.status)) {
    return { lead, modified: false };
  }

  // Descarte automático
  if (diffDays >= config.autoDiscardDays) {
    if (isValidTransition(lead.status, STAGES.DESCARTADO)) {
      newStatus = STAGES.DESCARTADO;
      newScore = config.minScore;
      modified = true;
    }
  } else if (diffDays > config.gracePeriodDays) {
    // Calculamos decay
    const daysToPenalize = diffDays - config.gracePeriodDays;
    const penalty = daysToPenalize * config.decayPerDay;
    
    if (penalty > 0) {
      // Necesitamos guardar el last_decay_days para no sobre-penalizar
      const lastDecay = lead.score_data?.last_decay_days || 0;
      const unappliedDays = daysToPenalize - lastDecay;
      
      if (unappliedDays > 0) {
        newScore = Math.max(config.minScore, newScore - (unappliedDays * config.decayPerDay));
        lead.score_data = { ...(lead.score_data || {}), last_decay_days: daysToPenalize };
        modified = true;
      }
    }
  }

  if (modified) {
    lead.score = newScore;
    lead.status = newStatus;
    lead.updated_at = now.toISOString();
  }

  return { lead, modified };
}

async function runScheduledScoreDecay() {
  const store = getStore();
  let modifiedCount = 0;
  
  await updateStore(s => {
    for (let i = 0; i < s.leads.length; i++) {
      const { modified } = applyDecayToLead(s.leads[i]);
      if (modified) modifiedCount++;
    }
  });

  if (modifiedCount > 0) {
    console.log(`[ScoreDecay] Se aplicó decay a ${modifiedCount} leads.`);
    // Opcional: Escribir a PG masivamente, en la vida real usar bulk update
    for (const lead of store.leads) {
      // una heurística simple para sincronizar: (la lógica real en prod guardaría cuáles se tocaron)
      // para simplificar el MVP, se confía en el dual-write de las siguientes operaciones o bulk 
    }
  }

  return { modifiedCount };
}

module.exports = {
  applyDecayToLead,
  runScheduledScoreDecay,
  DEFAULT_DECAY_CONFIG
};