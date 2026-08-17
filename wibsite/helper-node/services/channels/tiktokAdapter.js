'use strict';
/**
 * tiktokAdapter.js — Canal TikTok (comentarios/DMs)
 * ESTADO: bases planteadas — TikTok no expone un webhook público de comentarios;
 * la integración requiere TikTok for Business (API de comentarios con revisión de app)
 * o un agregador intermedio (p.ej. SocialSnowball/EmbedSocial/Hootsuite).
 *
 * Este adaptador normaliza el payload de un agregador al formato interno y deja
 * el envío listo para el momento en que se apruebe la API oficial.
 *
 * Env requeridas (futuro):
 *  TIKTOK_API_URL   — endpoint del agregador/API
 *  TIKTOK_API_KEY   — credencial
 */
const axios = require('axios');

function getApiUrl() { return process.env.TIKTOK_API_URL || ''; }
function getApiKey() { return process.env.TIKTOK_API_KEY || ''; }

async function sendMessage({ to, text }) {
  const url = getApiUrl();
  if (!url) throw new Error('TIKTOK_API_URL no configurado (API/agregador pendiente de aprobación)');
  const { data } = await axios.post(
    url,
    { to, text: String(text || '').slice(0, 500) },
    { headers: { Authorization: `Bearer ${getApiKey()}` }, timeout: 15000 }
  );
  return data;
}

function isConfigured() {
  return !!getApiUrl();
}

/**
 * Normaliza un payload de comentario (formato interno o de agregador) al estándar.
 */
async function normalizeUpdate(body) {
  const comment = body?.comment || body; // formato interno estándar
  const senderId = comment?.author_id || comment?.user?.id || body?.user_id || '';
  if (!senderId) return null;

  const text = comment?.text || comment?.content || body?.content || '';
  return {
    channel: 'tiktok',
    senderId: String(senderId),
    senderName: comment?.author_name || comment?.user?.nickname || body?.user?.nickname || `TikTok_${senderId}`,
    text,
    chatId: String(senderId),
    conversationId: `tiktok_${senderId}`,
    media: [],
    raw: body,
  };
}

module.exports = {
  channel: 'tiktok',
  isConfigured,
  sendMessage,
  normalizeUpdate,
};
