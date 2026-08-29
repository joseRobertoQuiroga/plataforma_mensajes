'use strict';
/**
 * agentKnowledge.js — Lotes de conocimiento del agente (Wibsite 2.0)
 *
 * Permite cargar al agente información de negocio de forma ordenada y seccionada:
 * productos/actualizaciones, FAQs, contexto de negocio, estándares de seguimiento,
 * análisis de mercado y objetivos. Cada lote queda agrupado por fecha para auditoría.
 *
 * El conocimiento consolidado se inyecta al system prompt del agente (template
 * industry_knowledge + products) para que el vendedor IA opere con él.
 */

const crypto = require('crypto');

const KNOWLEDGE_TYPES = {
  producto: { label: 'Producto / Oferta', color: 'primary', icon: 'box' },
  faq: { label: 'Pregunta frecuente', color: 'secondary', icon: 'help' },
  contexto: { label: 'Contexto de negocio', color: 'tertiary', icon: 'briefcase' },
  estandar: { label: 'Estándar / Seguimiento', color: 'warning', icon: 'target' },
  analisis: { label: 'Análisis / Mercado', color: 'danger', icon: 'chart' },
  objetivo: { label: 'Objetivo / Expectativa', color: 'success', icon: 'flag' },
};

function listKnowledge(store) {
  const items = store.knowledgeBatches || [];
  return [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getKnowledge(id, store) {
  return (store.knowledgeBatches || []).find(k => k.id === id) || null;
}

function createKnowledge(data, store) {
  const { type, title, content, items } = data;
  if (!type || !KNOWLEDGE_TYPES[type]) throw new Error(`Tipo de conocimiento inválido: ${type}`);
  if (!title || !String(title).trim()) throw new Error('El título del lote es obligatorio');
  const batch = {
    id: crypto.randomUUID(),
    type,
    title: String(title).trim(),
    content: content ? String(content) : '',
    items: Array.isArray(items) ? items.filter(Boolean).map(i => String(i)).slice(0, 50) : [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!store.knowledgeBatches) store.knowledgeBatches = [];
  store.knowledgeBatches.push(batch);
  return batch;
}

function updateKnowledge(id, data, store) {
  const batch = getKnowledge(id, store);
  if (!batch) return null;
  const { type, title, content, items } = data;
  if (type !== undefined) {
    if (!KNOWLEDGE_TYPES[type]) throw new Error(`Tipo de conocimiento inválido: ${type}`);
    batch.type = type;
  }
  if (title !== undefined) batch.title = String(title).trim() || batch.title;
  if (content !== undefined) batch.content = String(content);
  if (items !== undefined) batch.items = Array.isArray(items) ? items.filter(Boolean).map(i => String(i)).slice(0, 50) : [];
  batch.updated_at = new Date().toISOString();
  return batch;
}

function deleteKnowledge(id, store) {
  if (!store.knowledgeBatches) return false;
  const before = store.knowledgeBatches.length;
  store.knowledgeBatches = store.knowledgeBatches.filter(k => k.id !== id);
  return store.knowledgeBatches.length < before;
}

/**
 * Consolidado legible para el prompt del agente.
 */
function buildKnowledgeContext(store) {
  const batches = listKnowledge(store);
  if (!batches.length) return null;
  const sections = batches.map(k => {
    const typeLabel = KNOWLEDGE_TYPES[k.type]?.label || k.type;
    const date = new Date(k.created_at).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    const items = k.items && k.items.length
      ? `\n  - ${k.items.join('\n  - ')}`
      : '';
    return `[${typeLabel} · cargado ${date}]\n${k.title}${k.content ? `: ${k.content}` : ''}${items}`;
  });
  return sections.join('\n\n');
}

/**
 * Agrupa los lotes por fecha (día) para la vista de auditoría del usuario.
 */
function groupByDay(store) {
  const groups = new Map();
  for (const batch of listKnowledge(store)) {
    const day = new Date(batch.created_at).toISOString().split('T')[0];
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(batch);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, batches]) => ({
      day,
      label: new Date(day + 'T12:00:00').toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }),
      total: batches.length,
      batches,
    }));
}

module.exports = {
  KNOWLEDGE_TYPES,
  listKnowledge, getKnowledge, createKnowledge, updateKnowledge, deleteKnowledge,
  buildKnowledgeContext, groupByDay,
};