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

/**
 * Envía un mensaje por el canal indicado. Nunca lanza: devuelve { ok, error }.
 */
async function sendToChannel(channel, to, text, extra = {}) {
  const adapter = getChannel(channel);
  if (!adapter) return { ok: false, error: `Canal no soportado: ${channel}` };
  try {
    const result = await adapter.sendMessage({ to, text, ...extra });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  getChannel,
  listChannels,
  sendToChannel,
  adapters,
};
