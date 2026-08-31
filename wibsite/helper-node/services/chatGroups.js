'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { getConversationState, updateConversationMetadata } = require('./conversationStore');
const { classifyIntoGroup } = require('./agentCore/llmClient');
const { logEvent } = require('./auditLogger');

const PENDING_GROUP_ID = 'pending-review';
const STORE_PATH = process.env.CHAT_GROUPS_PATH || path.join(__dirname, '..', 'chat-groups.json');
const MAX_REVIEW_PARALLEL = Number(process.env.CHAT_GROUPS_PARALLEL) || 5;

const GROUP_COLORS = ['primary', 'success', 'warning', 'danger', 'secondary', 'tertiary'];

let memory = null;
let saveLock = Promise.resolve();

function now() {
  return new Date().toISOString();
}

function load() {
  if (memory) return memory;
  memory = { groups: [], conversations: {}, leads: {} };
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
      memory.groups = Array.isArray(data.groups) ? data.groups : [];
      memory.conversations = (data.conversations && typeof data.conversations === 'object') ? data.conversations : {};
      memory.leads = (data.leads && typeof data.leads === 'object') ? data.leads : {};
    }
  } catch (e) {
    logEvent('error', { message: `chatGroups load error: ${e.message}` });
  }
  ensureSystemGroup();
  persist();
  return memory;
}

function persist() {
  saveLock = saveLock.then(() => {
    try {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      fs.writeFileSync(STORE_PATH, JSON.stringify(memory, null, 2), 'utf-8');
    } catch (e) {
      logEvent('error', { message: `chatGroups save error: ${e.message}` });
    }
  });
  return saveLock;
}

function ensureSystemGroup() {
  if (!memory.groups.some((g) => g.id === PENDING_GROUP_ID)) {
    memory.groups.unshift({
      id: PENDING_GROUP_ID,
      name: 'Pendiente de revisiÃ³n',
      description: 'Conversaciones que aÃºn no se asignaron a un grupo y esperan el anÃ¡lisis del agente IA.',
      criteria: 'Conversaciones sin grupo asignado que requieren clasificaciÃ³n automÃ¡tica por el agente.',
      color: 'warning',
      isSystem: true,
      createdAt: now(),
      updatedAt: now(),
    });
  }
}

function keyOf(tenantId, conversationId) {
  return `${tenantId}:${conversationId}`;
}

function listGroups() {
  return load().groups.map((g) => ({ ...g }));
}

function getGroup(groupId) {
  return listGroups().find((g) => g.id === groupId) || null;
}

function createGroup({ name, description = '', criteria = '', color = 'primary' }) {
  const store = load();
  if (!name || !String(name).trim()) {
    const error = new Error('name is required');
    error.status = 400;
    throw error;
  }
  const group = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    description: String(description).trim(),
    criteria: String(criteria).trim(),
    color: GROUP_COLORS.includes(color) ? color : 'primary',
    isSystem: false,
    createdAt: now(),
    updatedAt: now(),
  };
  store.groups.push(group);
  return persist().then(() => ({ ...group }));
}

async function updateGroup(groupId, patch = {}) {
  const store = load();
  const group = store.groups.find((g) => g.id === groupId);
  if (!group) {
    const error = new Error('Group not found');
    error.status = 404;
    throw error;
  }
  if (group.isSystem && patch.name !== undefined) {
    const error = new Error('System group name cannot be changed');
    error.status = 400;
    throw error;
  }
  if (patch.name !== undefined) group.name = String(patch.name).trim();
  if (patch.description !== undefined) group.description = String(patch.description).trim();
  if (patch.criteria !== undefined) group.criteria = String(patch.criteria).trim();
  if (patch.color !== undefined && GROUP_COLORS.includes(patch.color)) group.color = patch.color;
  group.updatedAt = now();
  await persist();
  return { ...group };
}

async function deleteGroup(groupId) {
  const store = load();
  const idx = store.groups.findIndex((g) => g.id === groupId);
  if (idx === -1) {
    const error = new Error('Group not found');
    error.status = 404;
    throw error;
  }
  if (store.groups[idx].isSystem) {
    const error = new Error('System group cannot be deleted');
    error.status = 400;
    throw error;
  }
  store.groups.splice(idx, 1);
  for (const k of Object.keys(store.conversations)) {
    if (store.conversations[k].groupId === groupId) {
      store.conversations[k] = {
        groupId: PENDING_GROUP_ID,
        status: 'pending',
        source: 'auto-pending',
        assignedAt: now(),
        aiAnalysis: store.conversations[k].aiAnalysis || null,
      };
    }
  }
  await persist();
  return { status: 'deleted', id: groupId };
}

function getConversationGroup(tenantId, conversationId) {
  const store = load();
  const record = store.conversations[keyOf(tenantId, conversationId)];
  return record || null;
}

function buildConversationRecord(conversation) {
  const conv = conversation || {};
  const meta = conv.metadata || {};
  const name = meta.customerName || meta.name || meta.phone || meta.senderId || conv.conversationId || 'Desconocido';
  const messages = Array.isArray(conv.messages) ? conv.messages : [];
  const text = messages.map((m) => `${m.role || '?'}: ${m.content || ''}`).join('\n');
  return { name, text, messageCount: conv.messageCount || messages.length };
}

async function assignConversation(tenantId, conversationId, groupId, { source = 'manual', aiAnalysis = null } = {}) {
  const store = load();
  const isPending = groupId === PENDING_GROUP_ID;
  const group = isPending ? getGroup(PENDING_GROUP_ID) : getGroup(groupId);
  if (!group) {
    const error = new Error('Group not found');
    error.status = 404;
    throw error;
  }
  const record = {
    groupId,
    status: isPending ? 'pending' : 'assigned',
    source,
    assignedAt: now(),
    aiAnalysis: aiAnalysis || null,
  };
  store.conversations[keyOf(tenantId, conversationId)] = record;
  await persist();
  await updateConversationMetadata(tenantId, conversationId, {
    chatGroup: { groupId, status: record.status, source, assignedAt: record.assignedAt, aiAnalysis: record.aiAnalysis },
  }).catch(() => {});
  await logEvent('api_call', {
    level: 'info',
    message: isPending ? 'ConversaciÃ³n enviada a revisiÃ³n' : 'ConversaciÃ³n asignada a grupo',
    tenantId, conversationId, module: 'chatGroups', flow: 'group.assign',
    data: { groupId, source },
  });
  return { ...record, group: { ...group } };
}

async function reviewConversation(tenantId, conversationId) {
  const conv = await getConversationState(tenantId, conversationId);
  if (!conv) {
    const error = new Error('Conversation not found');
    error.status = 404;
    throw error;
  }
  const info = buildConversationRecord(conv);
  const groups = listGroups().filter((g) => !g.isSystem);
  const ai = await classifyIntoGroup(info.text, groups, { tenantId, conversationId, name: info.name });
  const targetGroupId = (ai.groupId && groups.some((g) => g.id === ai.groupId)) ? ai.groupId : null;
  const aiAnalysis = {
    suggestedGroupId: targetGroupId,
    confidence: typeof ai.confidence === 'number' ? ai.confidence : null,
    reasoning: ai.reasoning || '',
    mode: ai.mode || 'heuristic',
    reviewedAt: now(),
  };
  const result = await assignConversation(tenantId, conversationId, targetGroupId || PENDING_GROUP_ID, {
    source: 'ai',
    aiAnalysis,
  });
  return { ...result, analysis: aiAnalysis, summary: info };
}

async function reviewPending({ tenantId } = {}) {
  const store = load();
  const pending = Object.entries(store.conversations)
    .filter(([key, rec]) => rec.status === 'pending' && (!tenantId || key.startsWith(`${tenantId}:`)))
    .map(([key]) => {
      const [t, ...rest] = key.split(':');
      return { tenantId: t, conversationId: rest.join(':') };
    });
  const results = [];
  const concurrency = Math.max(1, MAX_REVIEW_PARALLEL);
  const queue = [...pending];
  const workers = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try {
        const r = await reviewConversation(item.tenantId, item.conversationId);
        results.push({ ...item, ok: true, groupId: r.groupId, confidence: r.analysis?.confidence, mode: r.analysis?.mode });
      } catch (e) {
        results.push({ ...item, ok: false, error: e.message });
      }
    }
  });
  await Promise.all(workers);
  return { total: pending.length, reviewed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
}


// K12: Assign a lead to a manual group
function assignLead(leadId, groupId) {
  load();
  if (!memory.leads[leadId]) memory.leads[leadId] = [];
  
  if (groupId && !memory.leads[leadId].includes(groupId)) {
    memory.leads[leadId].push(groupId);
  }
  
  persist();
  return memory.leads[leadId];
}

function removeLeadFromGroup(leadId, groupId) {
  load();
  if (!memory.leads[leadId]) return [];
  memory.leads[leadId] = memory.leads[leadId].filter(id => id !== groupId);
  persist();
  return memory.leads[leadId];
}

function getLeadGroups(leadId) {
  load();
  return memory.leads[leadId] || [];
}

function getGroupLeads(groupId) {
  load();
  return Object.keys(memory.leads).filter(leadId => memory.leads[leadId].includes(groupId));
}
module.exports = {
  PENDING_GROUP_ID,
  GROUP_COLORS,
  listGroups, getGroup, createGroup, updateGroup, deleteGroup,
  getConversationGroup, assignConversation, reviewConversation, reviewPending, assignLead, removeLeadFromGroup, getLeadGroups, getGroupLeads,
};
