'use strict';
/**
 * agentRegistry.js — Registro de agentes de venta (Wibsite 2.0)
 *
 * Soporta múltiples agentes activos (p.ej. "Wally" asesor de ventas, "Yimi"
 * asesora comercial), cada uno con nombre, personalidad, tono y tipo de negocio.
 * El agente activo determina el perfil que usa el pipeline comercial.
 *
 * A6: Round-robin assignment distributes new conversations across available agents.
 * R5: routeByIntentention routes by keyword matching to the most suitable agent.
 */

const crypto = require('crypto');

let _assignmentIndex = 0;

function listAgents(store) {
  return store.agents || [];
}

function getAgent(id, store) {
  return (store.agents || []).find(a => a.id === id) || null;
}

function createAgent(data, store) {
  const { name, personality, tone, business_type, description } = data;
  if (!name || !String(name).trim()) throw new Error('El nombre del agente es obligatorio');
  const agent = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    personality: personality || 'profesional_amigable',
    tone: tone || 'formal',
    business_type: business_type || 'productos_fisicos',
    description: description || '',
    auto_reply_enabled: true,
    max_messages_per_day: 5,
    active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!store.agents) store.agents = [];
  store.agents.push(agent);
  return agent;
}

function updateAgent(id, patch, store) {
  const agent = getAgent(id, store);
  if (!agent) return null;
  const allowed = ['name', 'personality', 'tone', 'business_type', 'description', 'auto_reply_enabled', 'max_messages_per_day'];
  for (const k of allowed) {
    if (patch[k] !== undefined) agent[k] = patch[k];
  }
  agent.updated_at = new Date().toISOString();
  return agent;
}

function deleteAgent(id, store) {
  if (!store.agents) return false;
  const before = store.agents.length;
  store.agents = store.agents.filter(a => a.id !== id);
  return store.agents.length < before;
}

function getActiveAgent(store) {
  const agents = store.agents || [];
  return agents.find(a => a.active) || agents[0] || null;
}

function setActiveAgent(id, store) {
  const agent = getAgent(id, store);
  if (!agent) return null;
  for (const a of store.agents || []) a.active = a.id === id;
  return agent;
}

/**
 * A6: Round-robin assignment — distributes conversations evenly across available agents.
 * Returns the next agent in rotation (only agents with auto_reply_enabled=true and active=true).
 */
function roundRobinAssign(store) {
  const available = (store.agents || []).filter(a => a.active && a.auto_reply_enabled);
  if (available.length === 0) return getActiveAgent(store) || null;
  const idx = _assignmentIndex % available.length;
  _assignmentIndex = (idx + 1) % available.length;
  return available[idx];
}

/**
 * R5: Route by intention — matches keywords to the most suitable agent.
 * Returns { agent, fallback, intention }.
 */
function routeByIntentention(text, store) {
  const agents = (store.agents || []).filter(a => a.active);
  if (agents.length === 0) return { agent: null, fallback: true, intention: null };

  const lower = String(text).toLowerCase();

  const intentKeywords = {
    ventas: ['comprar', 'precio', 'costo', 'cotizar', 'presupuesto', 'oferta', 'descuento', 'producto'],
    soporte: ['ayuda', 'soporte', 'problema', 'error', 'no funciona', 'avería', 'reclamo'],
    general: ['hola', 'info', 'información', 'consulta', 'pregunta'],
  };

  let bestMatch = null;
  let bestScore = 0;
  let matchedIntention = null;

  for (const agent of agents) {
    const agentType = (agent.business_type || '').toLowerCase();
    let score = 0;
    for (const [intention, keywords] of Object.entries(intentKeywords)) {
      const matched = keywords.filter(k => lower.includes(k));
      if (matched.length > score) {
        score = matched.length;
        if (agentType.includes(intention) || agent.name.toLowerCase().includes(intention)) {
          score += 2;
        }
        matchedIntention = intention;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = agent;
    }
  }

  if (bestScore === 0) {
    return { agent: getActiveAgent(store), fallback: true, intention: null };
  }

  return { agent: bestMatch, fallback: false, intention: matchedIntention };
}

/**
 * L3: Route by score+canal - routes based on lead score and channel.
 * High-score leads get routed to more experienced agents.
 * Channel preference can be set per agent via metadata.preferred_channels.
 */
function routeByScoreAndChannel(leadScore, channel, store) {
  const agents = (store.agents || []).filter(a => a.active && a.auto_reply_enabled);
  if (agents.length === 0) return { agent: getActiveAgent(store), reason: 'no_available_agents' };

  const scored = agents.map(agent => {
    let score = 0;
    const prefChannels = agent.metadata?.preferred_channels || ['whatsapp', 'email', 'sms'];
    if (prefChannels.includes(channel)) score += 3;
    const maxMsg = agent.max_messages_per_day || 5;
    if (leadScore >= 70 && maxMsg >= 10) score += 5;
    else if (leadScore >= 40 && maxMsg >= 5) score += 3;
    else if (leadScore < 40) score += 1;
    score += Math.random() * 0.1;
    return { agent, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return { agent: scored[0].agent, reason: 'score_channel_routing', score: scored[0].score };
}

module.exports = {
  listAgents, getAgent, createAgent, updateAgent, deleteAgent, getActiveAgent, setActiveAgent,
  roundRobinAssign, routeByIntentention, routeByScoreAndChannel,
};