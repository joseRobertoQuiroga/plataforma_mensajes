'use strict';
/**
 * agentRegistry.js — Registro de agentes de venta (Wibsite 2.0)
 *
 * Soporta múltiples agentes activos (p.ej. "Wally" asesor de ventas, "Yimi"
 * asesora comercial), cada uno con nombre, personalidad, tono y tipo de negocio.
 * El agente activo determina el perfil que usa el pipeline comercial.
 *
 * R5: Router por intención y fallback
 * - Cada agente puede tener intenciones asociadas que mapean a nodos del grafo
 * - Fallback al agente activo cuando no hay coincidencia
 * - Métricas de routing por agente
 */

const crypto = require('crypto');

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
    intentions: [], // R5: lista de intenciones -> {name, node_path, fallback}
    metrics: { messages_routed: 0, messages_fallback: 0, last_routing_at: null },
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
  const allowed = ['name', 'personality', 'tone', 'business_type', 'description', 'auto_reply_enabled', 'max_messages_per_day', 'intentions'];
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

// R5: Router por intención - determina qué agente/nodo manejar un mensaje
function routeByIntentention(text, store) {
  const activeAgent = getActiveAgent(store);
  if (!activeAgent) return { agent: null, fallback: true };

  const textLower = (text || '').trim().toLowerCase();

  // Buscar intención coincidente en el agente activo
  const intentions = activeAgent.intentions || [];
  for (const intent of intentions) {
    const patterns = intent.patterns || [];
    for (const pattern of patterns) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
      if (regex && regex.test(textLower)) {
        // R5: Incrementar métricas de routing
        agent.metrics.messages_routed = (agent.metrics.messages_routed || 0) + 1;
        agent.metrics.last_routing_at = new Date().toISOString();
        if (intent.updateMetrics !== false) {
          try { store.agents = store.agents.map(a => a.id === activeAgent.id ? agent : a); } catch {}
        }
        return { agent: activeAgent, fallback: false, intention: intent.name };
      }
    }
  }

  // R5: Fallback - ningún patrón coincidió
  agent.metrics.messages_fallback = (agent.metrics.messages_fallback || 0) + 1;
  agent.metrics.last_routing_at = new Date().toISOString();
  try { store.agents = store.agents.map(a => a.id === activeAgent.id ? agent : a); } catch {}
  return { agent: activeAgent, fallback: true, intention: null };
}

module.exports = {
  listAgents, getAgent, createAgent, updateAgent, deleteAgent, getActiveAgent, setActiveAgent,
  routeByIntentention,
};