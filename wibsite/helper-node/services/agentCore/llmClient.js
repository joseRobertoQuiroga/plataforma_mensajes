'use strict';
const axios = require('axios');
const { logEvent } = require('../auditLogger');

const DIFY_API_URL = process.env.DIFY_API_URL || 'http://dify-api:5001/v1/workflows/run';
const DIFY_API_KEY = process.env.DIFY_API_KEY || '';
const DIFY_TIMEOUT_MS = 30000;
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

async function callDify(message, context) {
  const started = Date.now();
  const body = {
    inputs: {
      message,
      conversation_id: context.conversationId,
      tenant_id: context.tenantId,
      history: (context.history || []).slice(-8),
    },
    response_mode: 'blocking',
    user: context.tenantId || 'default',
  };
  const headers = { 'Content-Type': 'application/json' };
  if (DIFY_API_KEY) headers.Authorization = `Bearer ${DIFY_API_KEY}`;

  const resp = await axios.post(DIFY_API_URL, body, { timeout: DIFY_TIMEOUT_MS, headers });
  const payload = resp.data?.data || resp.data;
  const result = parseFinalResult(payload?.outputs?.final_result);
  const latencyMs = Date.now() - started;

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
    data: { mode: 'primary', provider: 'dify', tokens: payload?.usage || null, intent: result?.intent || null, score: result?.score ?? null },
  });
  registerSuccess();
  return { result, mode: 'primary', latencyMs };
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
  classify, callDify, callOpenRouter, normalizeClassification, parseFinalResult,
  isCircuitOpen, registerFailure, registerSuccess,
  FAIL_THRESHOLD, COOLDOWN_MS,
};