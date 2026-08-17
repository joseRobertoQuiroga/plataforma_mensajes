'use strict';
/**
 * whatsappAdapter.js — Canal WhatsApp (Meta Cloud API / Twilio ya existentes)
 * WhatsApp ya está implementado en index.js (rutas /webhooks/whatsapp y
 * /webhooks/twilio-inbound). Este adaptador unifica el acceso desde el registry
 * de canales y documenta el estado.
 *
 * Env requeridas (ya existentes):
 *  META_WEBHOOK_VERIFY_TOKEN / TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN
 */
const axios = require('axios');

function getSid() { return process.env.TWILIO_ACCOUNT_SID || ''; }
function getAuthToken() { return process.env.TWILIO_AUTH_TOKEN || ''; }
function getPhone() { return process.env.TWILIO_PHONE_NUMBER || ''; }

async function sendMessage({ to, text }) {
  const sid = getSid();
  const auth = getAuthToken();
  if (!sid || !auth) {
    throw new Error('TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN no configurados');
  }
  const phone = getPhone();
  const from = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  const target = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const { data } = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    new URLSearchParams({ From: from, To: target, Body: String(text).slice(0, 1600) }).toString(),
    {
      auth: { username: sid, password: auth },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );
  return data;
}

function isConfigured() {
  return !!(getSid() && getAuthToken());
}

/**
 * Normaliza el payload estándar interno producido por las rutas existentes
 * (/webhooks/whatsapp, /webhooks/twilio-inbound) al formato del registry.
 */
async function normalizeUpdate(body) {
  const senderId = body?.senderId || body?.from || body?.sender?.phone_number || null;
  if (!senderId) return null;
  const text = body?.text || body?.content || body?.Body || '';
  return {
    channel: 'whatsapp',
    senderId: String(senderId).replace(/^whatsapp:/, ''),
    senderName: body?.senderName || body?.sender?.name || body?.ProfileName || 'WhatsApp',
    text,
    chatId: String(senderId).replace(/^whatsapp:/, ''),
    conversationId: `whatsapp_${String(senderId).replace(/^whatsapp:/, '')}`,
    media: body?.media || [],
    raw: body,
  };
}

module.exports = {
  channel: 'whatsapp',
  isConfigured,
  sendMessage,
  normalizeUpdate,
};
