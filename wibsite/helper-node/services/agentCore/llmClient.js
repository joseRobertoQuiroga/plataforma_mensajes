'use strict';
const axios = require('axios');
const { logEvent } = require('../auditLogger');
const { startSpan, endSpan } = require('../otelBridge');

const DIFY_API_URL = (() => {
  const base = process.env.DIFY_API_URL || 'http://dify-api:5001/v1/workflows/run';
  return base.includes('/workflows/run') ? base : `${base.replace(/\/+$/, '')}/v1/workflows/run`;
})();
const DIFY_API_KEY = process.env.DIFY_API_KEY || '';
const DIFY_TIMEOUT_MS = 30000;
const DIFY_BUDGET_MS = parseInt(process.env.DIFY_BUDGET_MS || '6000', 10);
const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const FALLBACK_TIMEOUT_MS = 15000;

const FAIL_THRESHOLD = 3;
const COOLDOWN_MS = 60000;

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function isCircuitOpen() {
  return consecutiveFailures >= FAIL_THRESHOLD && Date.now() < circuitOpenUntil;
}

function registerFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAIL_THRESHOLD) {
    circuitOpenUntil = Date.now() + COOLDOWN_MS;
  }
}

function registerSuccess() {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

function parseFinalResult(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.final_result) {
        const inner = typeof parsed.final_result === 'string' && parsed.final_result.trim().startsWith('{')
          ? JSON.parse(parsed.final_result)
          : parsed.final_result;
        return typeof inner === 'object' ? inner : { text: inner };
      }
      return parsed;
    } catch (e) {
      return { text: trimmed };
    }
  }
  return { text: trimmed };
}

/**
 * Parsea el output real del workflow Dify (outputs.llm = JSON en fenced markdown)
 * con campos intent_label/intent_score/confidence/captured_data/suggested_response.
 */
function parseDifyWorkflowOutput(payload) {
  const outputs = payload?.outputs || {};
  let raw = outputs.llm ?? outputs.final_result ?? null;
  if (!raw) return {};
  let obj = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenced ? fenced[1].trim() : trimmed;
    try { obj = JSON.parse(jsonStr); } catch (e) { return {}; }
  }
  if (obj && typeof obj === 'object' && obj.final_result) {
    let inner = obj.final_result;
    if (typeof inner === 'string') {
      try { inner = JSON.parse(inner); } catch (e) { inner = null; }
    }
    if (inner && typeof inner === 'object') obj = { ...obj, ...inner };
  }
  const label = String(obj.intent_label || '').toLowerCase();
  const intent = ['compra', 'venta', 'lead', 'interes'].includes(label) ? 'venta'
    : (label === 'soporte' || label === 'support' ? 'soporte'
      : (obj.intent || null));
  return {
    intent,
    score: typeof obj.intent_score === 'number' ? obj.intent_score : (typeof obj.score === 'number' ? obj.score : null),
    confidence: typeof obj.confidence === 'number' ? obj.confidence : null,
    suggestedResponse: obj.suggested_response || obj.response_text || null,
    capturedData: obj.captured_data || null,
    needsHuman: !!obj.needs_human,
    shouldAutoReply: !!obj.should_auto_reply,
  };
}

async function callDify(message, context) {
  const started = Date.now();
  const span = startSpan({
    name: 'llm.completion',
    kind: 3,
    attributes: { 'gen_ai.provider': 'dify', 'gen_ai.request.model': 'dify-workflow-lead-classifier' },
  });
  const body = {
    inputs: {
      message,
      conversation_id: context.conversationId,
      tenant_id: context.tenantId,
      history: (context.history || []).slice(-8),
      contact_name: context.contactName || context.name || 'Lead',
      phone: context.phone || '',
    },
    response_mode: 'blocking',
    user: context.tenantId || 'default',
  };
  const headers = { 'Content-Type': 'application/json' };
  if (DIFY_API_KEY) headers.Authorization = `Bearer ${DIFY_API_KEY}`;

  // Presupuesto de latencia: si Dify excede el budget, se aborta y cae al fallback
  // OpenRouter (~1.5-2.5s) para mantener fluidez de conversación.
  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort(), DIFY_BUDGET_MS);
  let payload;
  try {
    const resp = await axios.post(DIFY_API_URL, body, { timeout: DIFY_TIMEOUT_MS, headers, signal: controller.signal });
    payload = resp.data?.data || resp.data;
  } finally {
    clearTimeout(budgetTimer);
  }

  const difyParsed = parseDifyWorkflowOutput(payload);
  const normalized = normalizeClassification(
    { intent: difyParsed.intent, score: difyParsed.score, confidence: difyParsed.confidence, text: difyParsed.suggestedResponse || '' },
    message
  );
  const latencyMs = Date.now() - started;

  const usage = payload?.usage || null;
  const tokens = usage
    ? { total: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0), input: usage.prompt_tokens ?? null, output: usage.completion_tokens ?? null }
    : (typeof payload?.total_tokens === 'number' ? { total: payload.total_tokens, input: null, output: null } : null);
  endSpan(span, {
    status: 'OK',
    attributes: {
      'gen_ai.usage.input_tokens': tokens?.input ?? null,
      'gen_ai.usage.output_tokens': tokens?.output ?? null,
      'llm.usage.total_tokens': tokens?.total ?? null,
      'wibsite.intent': normalized.intent,
      'wibsite.score': typeof normalized.score === 'number' ? normalized.score : null,
    },
  });

  await logEvent('api_call', {
    level: 'info',
    message: `Dify classify ok (${latencyMs}ms)`,
    tenantId: context.tenantId,
    conversationId: context.conversationId,
    module: 'agentCore',
    flow: 'llm.classify',
    action: 'dify.workflows.run',
    dependency: 'dify-llm',
    latencyMs,
    data: { mode: 'primary', provider: 'dify', tokens, intent: normalized.intent, score: normalized.score },
  });
  registerSuccess();
  return { result: normalized, mode: 'primary', latencyMs };
}

function normalizeClassification(result, message) {
  const text = (result?.text || '').toLowerCase();
  const intent = result?.intent
    || (text.includes('soporte') || text.includes('problema con') || text.includes('no funciona') ? 'soporte' : 'venta');
  const score = typeof result?.score === 'number'
    ? result.score
    : (text.includes('compra') || text.includes('cot') || text.includes('interes') ? 60 : 20);
  return {
    intent: intent === 'support' ? 'soporte' : intent,
    score: Math.max(0, Math.min(100, Number(score || 0))),
    confidence: typeof result?.confidence === 'number' ? result.confidence : null,
  };
}

async function callOpenRouter(message, context) {
  const started = Date.now();
  const span = startSpan({
    name: 'llm.completion',
    kind: 3,
    attributes: { 'gen_ai.provider': 'openrouter', 'gen_ai.request.model': OPENROUTER_MODEL },
  });
  const systemPrompt =
    'Eres un clasificador de intencion de ventas B2B. Responde SOLO con JSON valido: ' +
    '{"intent": "venta"|"soporte", "score": <numero 0-100>, "confidence": <numero 0-1>}. ' +
    'Clasifica por el contenido del mensaje del lead. No agregues texto adicional.';
  const resp = await axios.post(`${OPENROUTER_BASE}/chat/completions`, {
    model: OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message.substring(0, 1500) },
    ],
    temperature: 0,
    max_tokens: 80,
  }, {
    timeout: FALLBACK_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_API_KEY}` },
  });
  const latencyMs = Date.now() - started;
  const content = resp.data?.choices?.[0]?.message?.content || '';
  const parsed = parseFinalResult(content);
  const usage = resp.data?.usage || null;
  endSpan(span, {
    status: 'OK',
    attributes: {
      'gen_ai.usage.input_tokens': usage?.prompt_tokens ?? null,
      'gen_ai.usage.output_tokens': usage?.completion_tokens ?? null,
      'llm.usage.total_tokens': usage?.total_tokens ?? null,
      'wibsite.intent': parsed?.intent || null,
      'wibsite.score': typeof parsed?.score === 'number' ? parsed.score : null,
    },
  });
  await logEvent('api_call', {
    level: 'info',
    message: `OpenRouter classify fallback ok (${latencyMs}ms)`,
    tenantId: context.tenantId,
    conversationId: context.conversationId,
    module: 'agentCore',
    flow: 'llm.classify',
    action: 'chat.completions',
    dependency: 'openrouter-llm',
    latencyMs,
    data: { mode: 'fallback', provider: 'openrouter', model: OPENROUTER_MODEL, intent: parsed?.intent || null, score: parsed?.score ?? null },
  });
  return { result: parsed, mode: 'fallback', latencyMs };
}

function normalizeGroupScore(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(1, v));
}

function heuristicClassifyIntoGroup(text, groups) {
  if (!groups || groups.length === 0) return { groupId: null, confidence: 0, reasoning: 'No hay grupos configurados para clasificar.' };
  const hay = String(text || '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const g of groups) {
    const haystack = `${g.name || ''} ${g.description || ''} ${g.criteria || ''}`.toLowerCase();
    const keywords = haystack.match(/[a-záéíóúüñ0-9]{3,}/g) || [];
    const unique = [...new Set(keywords)].filter((k) => k.length > 2 && !['para', 'que', 'con', 'los', 'las', 'una', 'unos', 'unas', 'del', 'por'].includes(k));
    if (unique.length === 0) continue;
    let hits = 0;
    for (const k of unique) {
      if (hay.includes(k)) hits += 1;
    }
    const score = unique.length ? hits / unique.length : 0;
    if (score > bestScore) { bestScore = score; best = g; }
  }
  if (!best || bestScore <= 0) {
    return { groupId: null, confidence: 0, reasoning: 'No se encontró coincidencia clara con ningún grupo configurado.' };
  }
  return { groupId: best.id, confidence: Math.min(1, 0.4 + bestScore), reasoning: `Coincidencia heurística con "${best.name}" (${Math.round(bestScore * 100)}%).` };
}

/**
 * Clasifica una conversación dentro de los grupos configurados.
 * Usa OpenRouter con prompt dinámico; si no hay API key o falla, usa heurística.
 * Retorna { groupId, confidence, reasoning, mode }.
 */
async function classifyIntoGroup(text, groups, context = {}) {
  const fallback = heuristicClassifyIntoGroup(text, groups);
  if (!OPENROUTER_API_KEY) return { ...fallback, mode: 'heuristic' };

  const groupLines = (groups || []).map((g, i) =>
    `${i + 1}. id=${g.id} | nombre=${g.name} | descripcion=${g.description || '—'} | criterio=${g.criteria || '—'}`
  ).join('\n');
  const systemPrompt =
    'Eres un agente clasificador de conversaciones de un inbox omnicanal. ' +
    'Analiza la conversación y elige el grupo más adecuado entre los disponibles. ' +
    'Responde SOLO con JSON válido: {"groupId": "<id del grupo>", "confidence": <0-1>, "reasoning": "<explicación breve en español>"}. ' +
    'Si ninguna conversación encaja claramente, usa "groupId": null con confidence bajo. No agregues texto adicional.';
  const userPrompt =
    `Grupos disponibles:\n${groupLines}\n\n` +
    `Conversación:\n${String(text || '').substring(0, 4000)}`;

  const started = Date.now();
  try {
    const resp = await axios.post(`${OPENROUTER_BASE}/chat/completions`, {
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 200,
    }, {
      timeout: FALLBACK_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_API_KEY}` },
    });
    const content = resp.data?.choices?.[0]?.message?.content || '';
    const parsed = parseFinalResult(content);
    const latencyMs = Date.now() - started;
    const validGroup = groups && groups.some((g) => g.id === parsed?.groupId);
    const result = {
      groupId: validGroup ? parsed.groupId : (fallback.groupId || null),
      confidence: normalizeGroupScore(parsed?.confidence) ?? (validGroup ? 0.7 : fallback.confidence),
      reasoning: parsed?.reasoning || (validGroup ? 'Clasificado por el agente IA.' : fallback.reasoning),
      mode: validGroup ? 'llm' : (fallback.groupId ? 'llm-fallback' : 'llm-nomatch'),
    };
    await logEvent('api_call', {
      level: 'info',
      message: `OpenRouter group classify ok (${latencyMs}ms)`,
      tenantId: context.tenantId, conversationId: context.conversationId,
      module: 'agentCore', flow: 'llm.group.classify',
      action: 'chat.completions', dependency: 'openrouter-llm', latencyMs,
      data: { groupId: result.groupId, confidence: result.confidence, mode: result.mode },
    });
    return result;
  } catch (e) {
    await logEvent('error', {
      level: 'warn',
      message: `OpenRouter group classify failed — ${e?.response?.status ? `http_${e.response.status}` : 'network_error'}`,
      tenantId: context.tenantId, conversationId: context.conversationId,
      module: 'agentCore', flow: 'llm.group.classify', action: 'chat.completions',
      dependency: 'openrouter-llm',
      data: { reason: e?.response?.status ? `http_${e.response.status}` : 'network_error' },
    });
    return { ...fallback, mode: 'heuristic' };
  }
}

async function classify(message, context = {}) {
  const result = {
    intent: 'venta',
    score: 0,
    confidence: null,
    mode: 'none',
    latencyMs: 0,
  };

  if (DIFY_API_KEY && !isCircuitOpen()) {
    try {
      const primary = await callDify(message, context);
      const normalized = normalizeClassification(primary.result, message);
      Object.assign(result, normalized, { mode: 'primary', latencyMs: primary.latencyMs });
      return result;
    } catch (e) {
      registerFailure();
      const reason = isCircuitOpen()
        ? `circuit_open (${consecutiveFailures} fallos consecutivos)`
        : (e?.response?.status ? `http_${e.response.status}` : 'network_error');
      await logEvent('error', {
        level: 'warn',
        message: `Dify classify failed — ${reason}`,
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        module: 'agentCore',
        flow: 'llm.classify',
        action: 'dify.workflows.run',
        dependency: 'dify-llm',
        severity: reason === 'circuit_open' ? 'high' : 'medium',
        data: { mode: 'primary', reason, consecutive_failures: consecutiveFailures },
      });
    }
  }

  if (!OPENROUTER_API_KEY) {
    result.mode = 'none';
    return result;
  }

  try {
    const fallback = await callOpenRouter(message, context);
    const normalized = normalizeClassification(fallback.result, message);
    Object.assign(result, normalized, { mode: 'fallback', latencyMs: fallback.latencyMs });
    return result;
  } catch (e) {
    await logEvent('error', {
      level: 'error',
      message: `OpenRouter classify failed — ${e?.response?.status ? `http_${e.response.status}` : 'network_error'}`,
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      module: 'agentCore',
      flow: 'llm.classify',
      action: 'chat.completions',
      dependency: 'openrouter-llm',
      severity: 'high',
      data: { mode: 'fallback', reason: e?.response?.status ? `http_${e.response.status}` : 'network_error' },
    });
    return result;
  }
}

module.exports = {
  classify, classifyIntoGroup, heuristicClassifyIntoGroup, normalizeGroupScore,
  callDify, callOpenRouter, normalizeClassification, parseFinalResult, parseDifyWorkflowOutput,
  isCircuitOpen, registerFailure, registerSuccess,
  FAIL_THRESHOLD, COOLDOWN_MS,
};