'use strict';
/**
 * channels/index.js — Registry multicanal (Email · Telegram · WhatsApp · TikTok · Messenger)
 *
 * Objetivo: un punto único de entrada/salida para todos los canales. Cada adaptador
 * implementa el mismo contrato:
 *   isConfigured()  → bool
 *   sendMessage({to, text}) → Promise
 *   normalizeUpdate(payload) → { channel, senderId, senderName, text, chatId, conversationId, media[] } | null
 *
 * Webhooks inbound:
 *   POST /webhooks/telegram        (GET = verificación)
 *   POST /webhooks/messenger       (GET = verificación Meta)
 *   POST /webhooks/email-inbound
 *   POST /webhooks/tiktok-comments
 *   POST /webhooks/whatsapp        (existente, Meta Cloud API)
 *   POST /webhooks/twilio-inbound  (existente)
 */
const telegram = require('./telegramAdapter');
const messenger = require('./messengerAdapter');
const email = require('./emailAdapter');
const tiktok = require('./tiktokAdapter');
const whatsapp = require('./whatsappAdapter');

const adapters = {
  telegram,
  messenger,
  email,
  tiktok,
  whatsapp,
};

function getChannel(name) {
  return adapters[String(name || '').toLowerCase()] || null;
}

function listChannels() {
  return Object.values(adapters).map(a => ({
    channel: a.channel,
    configured: a.isConfigured(),
  }));
}

// C8: backoff exponencial por canal — respeta rate_limit_reset_at y reintenta
const CHANNEL_RATE = new Map(); // channel -> { remaining, resetAt }
const DEFAULT_MAX_RETRIES = Number(process.env.CHANNEL_MAX_RETRIES) || 3;
const BASE_BACKOFF_MS = Number(process.env.CHANNEL_BACKOFF_MS) || 2000;

function isRateLimitedError(msg) {
  const m = String(msg || '').toLowerCase();
  return m.includes('rate') || m.includes('429') || m.includes('limit') || m.includes('too many');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getChannelState(channel) {
  if (!CHANNEL_RATE.has(channel)) CHANNEL_RATE.set(channel, { remaining: null, resetAt: null });
  return CHANNEL_RATE.get(channel);
}

function updateChannelState(channel, result) {
  const state = getChannelState(channel);
  if (result && result.rateLimit) {
    state.remaining = result.rateLimit.remaining;
    state.resetAt = result.rateLimit.resetAt || null;
  }
  return state;
}

async function waitForResetIfNeeded(channel) {
  const state = getChannelState(channel);
  if (state.resetAt) {
    const waitMs = new Date(state.resetAt).getTime() - Date.now();
    if (waitMs > 0 && waitMs < 120000) {
      await sleep(waitMs);
      state.resetAt = null;
      state.remaining = null;
      return waitMs;
    }
  }
  return 0;
}

/**
 * Envía un mensaje por el canal indicado con reintentos y backoff exponencial.
 * Nunca lanza: devuelve { ok, error, attempts, backoffAppliedMs }.
 * C8: ante error de rate-limit (429/rate/limit), espera backoff exponencial y reintenta
 * hasta CHANNEL_MAX_RETRIES veces.
 */
async function sendToChannel(channel, to, text, extra = {}) {
  const adapter = getChannel(channel);
  if (!adapter) return { ok: false, error: `Canal no soportado: ${channel}` };

  const maxRetries = Number(extra.maxRetries) || DEFAULT_MAX_RETRIES;
  let attempts = 0;
  let lastError = null;
  let backoffAppliedMs = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;

    const waited = await waitForResetIfNeeded(channel);
    if (waited > 0) backoffAppliedMs += waited;

    try {
      const result = await adapter.sendMessage({ to, text, ...extra });
      updateChannelState(channel, result);
      return { ok: true, result, attempts, backoffAppliedMs };
    } catch (e) {
      lastError = e.message;
      updateChannelState(channel, e);
      if (isRateLimitedError(e.message) && attempt < maxRetries) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        backoffAppliedMs += backoff;
        await sleep(backoff);
        continue;
      }
      if (attempt >= maxRetries) break;
    }
  }

  return { ok: false, error: lastError || 'unknown error', attempts, backoffAppliedMs };
}

module.exports = {
  getChannel,
  listChannels,
  sendToChannel,
  adapters,
  isRateLimitedError,
  getChannelState,
  updateChannelState,
};
