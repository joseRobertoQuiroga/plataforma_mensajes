'use strict';
const conversationStore = require('../conversationStore');

let summariesPool = null;

function initSummariesPool(pgPool) {
  summariesPool = pgPool;
}

async function persistSummary({ tenantId, conversationId, templateId, machineState, commercialState, score, autonomyZone, leadExtract, objectionsLog, turnCount, topics, summary }) {
  if (!summariesPool) return null;
  try {
    const result = await summariesPool.query(
      `INSERT INTO conversation_summaries
        (tenant_id, conversation_id, template_id, machine_state, commercial_state, score,
         autonomy_zone, lead_extract, topics, objections_log, turn_count, summary, version, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, NOW())
       ON CONFLICT (tenant_id, conversation_id)
       DO UPDATE SET
         template_id = EXCLUDED.template_id,
         machine_state = EXCLUDED.machine_state,
         commercial_state = EXCLUDED.commercial_state,
         score = EXCLUDED.score,
         autonomy_zone = EXCLUDED.autonomy_zone,
         lead_extract = EXCLUDED.lead_extract,
         topics = EXCLUDED.topics,
         objections_log = EXCLUDED.objections_log,
         turn_count = EXCLUDED.turn_count,
         summary = EXCLUDED.summary,
         version = conversation_summaries.version + 1,
         updated_at = NOW()`,
      [tenantId, conversationId, templateId || null, machineState || 'greeting', commercialState || null,
        score != null ? Number(score) : null, autonomyZone || 'green',
        JSON.stringify(leadExtract || {}), topics || [], JSON.stringify(objectionsLog || []),
        turnCount || 0, summary || null]
    );
    return result.rows[0] || { status: 'upserted' };
  } catch (e) {
    console.error('[Checkpointer] conversation_summaries upsert failed:', e.message);
    return null;
  }
}

async function loadSummary({ tenantId, conversationId }) {
  if (!summariesPool) return null;
  try {
    const result = await summariesPool.query(
      'SELECT * FROM conversation_summaries WHERE tenant_id = $1 AND conversation_id = $2',
      [tenantId, conversationId]
    );
    return result.rows[0] || null;
  } catch (e) {
    console.error('[Checkpointer] conversation_summaries load failed:', e.message);
    return null;
  }
}

function rollupSummary(previous, turn) {
  const topics = new Set(previous?.topics || []);
  (turn.topics || []).forEach(t => topics.add(t));
  const objectionsLog = [...(previous?.objections_log || []), ...(turn.objections || [])];
  return {
    leadExtract: { ...(previous?.lead_extract || {}), ...(turn.leadExtract || {}) },
    topics: [...topics].slice(-20),
    objectionsLog: objectionsLog.slice(-30),
    turnCount: (previous?.turn_count || 0) + 1,
    summary: turn.summary || previous?.summary || null,
  };
}

async function saveTurn({ tenantId, conversationId, templateId, machineState, commercialState, score, autonomyZone, leadExtract, objections, topics, path, userMessage, agentMessage, summary }) {
  let conversation = await conversationStore.getConversationState(tenantId, conversationId);
  if (!conversation) {
    conversation = await conversationStore.createConversationState(tenantId, conversationId, { template_id: templateId || null });
  }
  await conversationStore.appendMessage(tenantId, conversationId, { role: 'user', content: userMessage });
  await conversationStore.appendMessage(tenantId, conversationId, { role: 'assistant', content: agentMessage });

  const previous = await loadSummary({ tenantId, conversationId });
  const rolled = rollupSummary(previous, { leadExtract, objections, topics, summary });

  await conversationStore.saveCheckpoint(tenantId, conversationId, {
    machineState,
    commercialState,
    score,
    autonomyZone,
    leadExtract: rolled.leadExtract,
    objectionsLog: rolled.objectionsLog,
    topics: rolled.topics,
    turnCount: rolled.turnCount,
    path,
    templateId,
  });

  return persistSummary({
    tenantId, conversationId, templateId, machineState, commercialState, score,
    autonomyZone, leadExtract: rolled.leadExtract, objectionsLog: rolled.objectionsLog,
    topics: rolled.topics, turnCount: rolled.turnCount, summary: rolled.summary || summary || null,
  });
}

async function loadTurn({ tenantId, conversationId }) {
  const [checkpoint, conversation] = await Promise.all([
    conversationStore.loadCheckpoint(tenantId, conversationId),
    conversationStore.getConversationState(tenantId, conversationId),
  ]);
  return { checkpoint, conversation };
}

async function restoreGraphState({ tenantId, conversationId }) {
  const { checkpoint } = await loadTurn({ tenantId, conversationId });
  if (!checkpoint) return { state: {}, fresh: true, machineStage: 'greeting', turnCount: 0 };
  return {
    state: checkpoint.leadExtract || {},
    machineStage: checkpoint.machineState || 'greeting',
    commercialState: checkpoint.commercialState || null,
    turnCount: checkpoint.turnCount || 0,
    topics: checkpoint.topics || [],
    objectionsLog: checkpoint.objectionsLog || [],
    fresh: false,
  };
}

module.exports = {
  initSummariesPool, saveTurn, loadTurn, loadSummary, restoreGraphState,
  rollupSummary, persistSummary,
};