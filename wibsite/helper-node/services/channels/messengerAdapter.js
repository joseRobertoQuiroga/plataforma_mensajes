'use strict';
/**
 * messengerAdapter.js — Canal Messenger (Meta Graph API)
 * Listo para conectar: requiere página de Meta + token y verificación del webhook.
 *
 * Env requeridas:
 *  MESSENGER_PAGE_TOKEN   — token de página (Graph API)
 *  MESSENGER_VERIFY_TOKEN — token de verificación del webhook (Meta App Dashboard)
 */
const axios = require('axios');

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

function getPageToken() { return process.env.MESSENGER_PAGE_TOKEN || ''; }
function getVerifyToken() { return process.env.MESSENGER_VERIFY_TOKEN || ''; }

async function sendMessage({ to, text }) {
  const token = getPageToken();
  if (!token) throw new Error('MESSENGER_PAGE_TOKEN no configurado');
  const { data } = await axios.post(
    `${GRAPH_BASE}/me/messages?access_token=${token}`,
    {
      recipient: { id: to },
      message: { text: String(text).slice(0, 2000) },
    },
    { timeout: 15000 }
  );
  return data;
}

function isConfigured() {
  return !!getPageToken();
}

/**
 * Normaliza un webhook de Meta (messaging) al formato interno.
 * @param {object} body — payload completo del webhook de Meta
 */
async function normalizeUpdate(body) {
  const entry = body?.entry?.[0];
  const messaging = entry?.messaging?.[0] || entry?.standby?.[0];
  if (!messaging) return null;

  const senderId = String(messaging.sender?.id || '');
  const recipientId = String(messaging.recipient?.id || '');

  let text = messaging.message?.text || '';
  const media = [];

  if (messaging.message?.attachments) {
    for (const att of messaging.message.attachments) {
      const type = att.type || 'file';
      media.push({ type, url: att.payload?.url || null, mime_type: null });
      if (type === 'audio') text = text || '[Mensaje de voz recibido — transcribiendo…]';
      else if (type === 'image') text = text || '[Imagen recibida]';
      else if (type === 'video') text = text || '[Video recibido]';
      else text = text || `[Adjunto ${type} recibido]`;
    }
  }

  if (!text && messaging.postback?.title) text = `[Postback: ${messaging.postback.title}]`;

  return {
    channel: 'messenger',
    senderId,
    senderName: `Messenger_${senderId}`,
    text,
    chatId: senderId,
    conversationId: `messenger_${senderId}`,
    media,
    raw: body,
  };
}

module.exports = {
  channel: 'messenger',
  isConfigured,
  sendMessage,
  normalizeUpdate,
  get VERIFY_TOKEN() { return getVerifyToken(); },
};
