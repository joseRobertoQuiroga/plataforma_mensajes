'use strict';
/**
 * agentRegistry.js — Registro de agentes de venta (Wibsite 2.0)
 *
 * Soporta múltiples agentes activos (p.ej. "Wally" asesor de ventas, "Yimi"
 * asesora comercial), cada uno con nombre, personalidad, tono y tipo de negocio.
 * El agente activo determina el perfil que usa el pipeline comercial.
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

module.exports = {
  listAgents, getAgent, createAgent, updateAgent, deleteAgent, getActiveAgent, setActiveAgent,
};