'use strict';
/**
 * telegramAdapter.js — Canal Telegram (Bot API, HTTP JSON)
 * Implementación completa y lista para conectar:
 *  - sendMessage: envía texto vía https://api.telegram.org/bot<TOKEN>/sendMessage
 *  - getWebhookInfo/verify: verificación del webhook (token secreto)
 *  - normalizeUpdate: convierte un update de Telegram al formato interno estándar
 *    { channel, senderId, senderName, text, conversationId, media[] }
 *  - resolveMediaUrl: descarga de media (foto/voz/video) vía getFile → URL pública
 *
 * Env requeridas:
 *  TELEGRAM_BOT_TOKEN  — token del bot (BotFather)
 *  TELEGRAM_WEBHOOK_SECRET — token opcional para verificar el webhook
 */
const axios = require('axios');

const API_BASE = 'https://api.telegram.org';

function getToken() { return process.env.TELEGRAM_BOT_TOKEN || ''; }
function getWebhookSecret() { return process.env.TELEGRAM_WEBHOOK_SECRET || ''; }

const MEDIA_TYPES = ['photo', 'voice', 'video', 'document', 'audio', 'sticker', 'video_note'];

async function callBot(method, params = {}) {
  const token = getToken();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado');
  const { data } = await axios.post(`${API_BASE}/bot${token}/${method}`, params, { timeout: 15000 });
  if (!data.ok) throw new Error(`Telegram API error (${method}): ${data.description || 'unknown'}`);
  return data.result;
}

async function sendMessage({ to, text }) {
  if (!to || !text) throw new Error('sendMessage requiere to y text');
  return callBot('sendMessage', { chat_id: to, text: String(text).slice(0, 4096), parse_mode: '' });
}

/**
 * Envía una nota de voz (o audio) a Telegram (G-37 TTS).
 * @param {string} to chat_id
 * @param {Buffer} audioBuffer bytes del audio
 * @param {string} filename nombre (voice.ogg / reply.mp3)
 * @param {string} caption texto opcional adjunto
 */
async function sendVoice({ to, audioBuffer, filename = 'voice.ogg', caption = '' }) {
  if (!to || !audioBuffer || !audioBuffer.length) throw new Error('sendVoice requiere to y audioBuffer');
  const FormData = require('form-data');
  const form = new FormData();
  form.append('chat_id', to);
  form.append('voice', audioBuffer, { filename });
  if (caption) form.append('caption', String(caption).slice(0, 1024));
  const token = getToken();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado');
  const resp = await axios.post(`${API_BASE}/bot${token}/sendVoice`, form, {
    headers: { ...form.getHeaders() },
    timeout: 30000,
    maxContentLength: 50 * 1024 * 1024,
  });
  if (!resp.data?.ok) throw new Error(`Telegram sendVoice error: ${resp.data?.description || 'unknown'}`);
  return resp.data.result;
}

function isConfigured() {
  return !!getToken();
}

/**
 * Normaliza un update de Telegram (webhook) al formato interno estándar.
 */
async function normalizeUpdate(update) {
  const message = update?.message || update?.edited_message || update?.channel_post || null;
  if (!message) return null;

  const from = message.from || message.sender_chat || {};
  const senderId = String(from.id || message.chat?.id || '');
  const senderName = from.username || [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Telegram';
  const chatId = String(message.chat?.id || senderId);

  let text = message.text || message.caption || '';
  const media = [];

  for (const type of MEDIA_TYPES) {
    if (message[type]) {
      const item = Array.isArray(message[type]) ? message[type].slice(-1)[0] : message[type];
      media.push({ type, file_id: item.file_id, mime_type: message?.mime_type || item?.mime_type || null });
      if (type === 'voice' || type === 'audio' || type === 'video_note') {
        text = text || (type === 'voice' ? '[Mensaje de voz recibido — transcribiendo…]' : `[Adjunto ${type} recibido]`);
      } else if (!text) {
        text = `[Adjunto ${type} recibido]`;
      }
    }
  }

  return {
    channel: 'telegram',
    senderId,
    senderName,
    text,
    chatId,
    conversationId: `telegram_${chatId}`,
    media,
    raw: update,
  };
}

/**
 * Resuelve la URL pública de un adjunto (foto/voz/video) vía getFile.
 * Devuelve null si no hay token o el file_id no existe.
 */
async function resolveMediaUrl(fileId) {
  const token = getToken();
  if (!token || !fileId) return null;
  try {
    const file = await callBot('getFile', { file_id: fileId });
    return `${API_BASE}/file/bot${token}/${file.file_path}`;
  } catch (e) {
    return null;
  }
}

module.exports = {
  channel: 'telegram',
  isConfigured,
  sendMessage,
  sendVoice,
  normalizeUpdate,
  resolveMediaUrl,
  get WEBHOOK_SECRET() { return getWebhookSecret(); },
  MEDIA_TYPES,
};
