const crypto = require('crypto');

let redisClient = null;
let redisAvailable = false;

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CONV_TTL = 86400;
const MAX_RETRY = 3;

async function initRedis() {
  try {
    const Redis = require('ioredis');
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3, retryStrategy: (times) => Math.min(times * 50, 2000),
      lazyConnect: true,
    });
    await redisClient.connect();
    redisAvailable = true;
  } catch (e) {
    redisAvailable = false;
    console.warn('Redis unavailable, using in-memory store:', e.message);
  }
}

const memoryStore = new Map();

const CONVERSATION_STATES = {
  GREETING: 'greeting',
  DISCOVERY: 'discovery',
  QUALIFICATION: 'qualification',
  PROPOSAL: 'proposal',
  OBJECTIONS: 'objections',
  CLOSING: 'closing',
  POST_SALE: 'post_sale',
  SUPPORT: 'support',
  ESCALATED: 'escalated',
};

const VALID_TRANSITIONS = {
  [CONVERSATION_STATES.GREETING]: [CONVERSATION_STATES.DISCOVERY, CONVERSATION_STATES.SUPPORT],
  [CONVERSATION_STATES.DISCOVERY]: [CONVERSATION_STATES.QUALIFICATION, CONVERSATION_STATES.GREETING],
  [CONVERSATION_STATES.QUALIFICATION]: [CONVERSATION_STATES.PROPOSAL, CONVERSATION_STATES.DISCOVERY, CONVERSATION_STATES.ESCALATED],
  [CONVERSATION_STATES.PROPOSAL]: [CONVERSATION_STATES.OBJECTIONS, CONVERSATION_STATES.CLOSING, CONVERSATION_STATES.DISCOVERY],
  [CONVERSATION_STATES.OBJECTIONS]: [CONVERSATION_STATES.PROPOSAL, CONVERSATION_STATES.DISCOVERY, CONVERSATION_STATES.CLOSING],
  [CONVERSATION_STATES.CLOSING]: [CONVERSATION_STATES.POST_SALE, CONVERSATION_STATES.GREETING, CONVERSATION_STATES.SUPPORT],
  [CONVERSATION_STATES.POST_SALE]: [CONVERSATION_STATES.SUPPORT, CONVERSATION_STATES.GREETING],
  [CONVERSATION_STATES.SUPPORT]: [CONVERSATION_STATES.QUALIFICATION, CONVERSATION_STATES.CLOSING, CONVERSATION_STATES.ESCALATED],
  [CONVERSATION_STATES.ESCALATED]: [CONVERSATION_STATES.SUPPORT, CONVERSATION_STATES.CLOSING],
};

const STATE_LABELS = {
  [CONVERSATION_STATES.GREETING]: 'Saludo inicial',
  [CONVERSATION_STATES.DISCOVERY]: 'Descubrimiento de necesidades',
  [CONVERSATION_STATES.QUALIFICATION]: 'Cualificación del lead',
  [CONVERSATION_STATES.PROPOSAL]: 'Presentación de propuesta',
  [CONVERSATION_STATES.OBJECTIONS]: 'Manejo de objeciones',
  [CONVERSATION_STATES.CLOSING]: 'Cierre de venta',
  [CONVERSATION_STATES.POST_SALE]: 'Post-venta y seguimiento',
  [CONVERSATION_STATES.SUPPORT]: 'Soporte o consulta',
  [CONVERSATION_STATES.ESCALATED]: 'Escalado a humano',
};

function isValidTransition(from, to) {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

function getRedisKey(tenantId, conversationId) {
  return `conv:${tenantId}:${conversationId}`;
}

async function createConversationState(tenantId, conversationId, metadata = {}) {
  const state = {
    id: crypto.randomUUID(),
    tenantId, conversationId,
    state: CONVERSATION_STATES.GREETING,
    previousStates: [],
    history: [{ state: CONVERSATION_STATES.GREETING, enteredAt: new Date().toISOString() }],
    messageCount: 0,
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (redisAvailable) {
    try {
      await redisClient.set(getRedisKey(tenantId, conversationId), JSON.stringify(state), 'EX', CONV_TTL);
    } catch (e) {
      console.error('Redis set error:', e.message);
      memoryStore.set(getRedisKey(tenantId, conversationId), state);
    }
  } else {
    memoryStore.set(getRedisKey(tenantId, conversationId), state);
  }
  return state;
}

async function getConversationState(tenantId, conversationId) {
  const key = getRedisKey(tenantId, conversationId);
  if (redisAvailable) {
    try {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Redis get error:', e.message);
    }
  }
  return memoryStore.get(key) || null;
}

async function transitionState(tenantId, conversationId, newState, reason = '') {
  const conv = await getConversationState(tenantId, conversationId);
  if (!conv) return { error: 'Conversation not found' };

  if (!isValidTransition(conv.state, newState)) {
    return {
      error: 'Invalid transition',
      from: conv.state,
      to: newState,
      allowedTransitions: VALID_TRANSITIONS[conv.state] || [],
      message: `No se puede cambiar de '${STATE_LABELS[conv.state] || conv.state}' a '${STATE_LABELS[newState] || newState}'`,
    };
  }

  conv.previousStates.push(conv.state);
  conv.state = newState;
  conv.history.push({
    state: newState, reason, enteredAt: new Date().toISOString(),
  });
  conv.updatedAt = new Date().toISOString();

  const key = getRedisKey(tenantId, conversationId);
  if (redisAvailable) {
    try {
      await redisClient.set(key, JSON.stringify(conv), 'EX', CONV_TTL);
    } catch (e) {
      console.error('Redis set error:', e.message);
      memoryStore.set(key, conv);
    }
  } else {
    memoryStore.set(key, conv);
  }
  return conv;
}

async function incrementMessageCount(tenantId, conversationId) {
  const conv = await getConversationState(tenantId, conversationId);
  if (!conv) return { error: 'Conversation not found' };
  conv.messageCount++;
  conv.updatedAt = new Date().toISOString();
  const key = getRedisKey(tenantId, conversationId);
  if (redisAvailable) {
    try { await redisClient.set(key, JSON.stringify(conv), 'EX', CONV_TTL); } catch (e) { memoryStore.set(key, conv); }
  } else { memoryStore.set(key, conv); }
  return conv;
}

async function deleteConversationState(tenantId, conversationId) {
  const key = getRedisKey(tenantId, conversationId);
  if (redisAvailable) {
    try { await redisClient.del(key); } catch (e) { /* ignore */ }
  }
  memoryStore.delete(key);
  return { status: 'deleted' };
}

async function listActiveConversations(tenantId) {
  const prefix = `conv:${tenantId}:`;
  if (redisAvailable) {
    try {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length === 0) return [];
      const values = await redisClient.mget(keys);
      return values.filter(Boolean).map(v => JSON.parse(v));
    } catch (e) {
      console.error('Redis keys error:', e.message);
    }
  }
  const results = [];
  for (const [key, val] of memoryStore.entries()) {
    if (key.startsWith(prefix)) results.push(val);
  }
  return results;
}

module.exports = {
  initRedis, createConversationState, getConversationState, transitionState,
  incrementMessageCount, deleteConversationState, listActiveConversations,
  isValidTransition, CONVERSATION_STATES, VALID_TRANSITIONS, STATE_LABELS,
};
