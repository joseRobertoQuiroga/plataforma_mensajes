'use strict';
/**
 * mediaProcessor.js — Bases multimodales (audio → texto, imagen → descripción)
 *
 * Estrategia con la capa gratuita de OpenRouter:
 *  - Audio/voz: transcripción vía un modelo STT de OpenRouter (configurable).
 *    P.ej. OPENROUTER_STT_MODEL="openai/whisper-large-v3" usando el endpoint
 *    /api/v1/audio/transcriptions (OpenRouter expone transcripciones compatibles OpenAI).
 *  - Imagen: descripción vía modelo de visión (gpt-4o-mini acepta imágenes en free tier)
 *    usando chat completions con content de tipo image_url.
 *  - Video: se degrada a (a) transcripción de audio si el canal lo expone, o
 *    (b) descripción del thumbnail. La extracción de frames queda documentada como
 *    evolución futura (FFmpeg en worker).
 *
 * Degradación elegante: si no hay API key/modelo configurado o el proveedor falla,
 * devuelve null y el pipeline sigue con el texto del canal (o el placeholder).
 */
const axios = require('axios');
const { logEvent } = require('./auditLogger');
const { startSpan, endSpan } = require('./otelBridge');

function getBaseUrl() { return process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'; }
function getApiKey() { return process.env.OPENROUTER_API_KEY || ''; }
function getSttModel() { return process.env.OPENROUTER_STT_MODEL || ''; }
function getVisionModel() { return process.env.OPENROUTER_VISION_MODEL || 'openai/gpt-4o-mini'; }
function getTtsModel() { return process.env.OPENROUTER_TTS_MODEL || ''; }

function headers() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  };
}

function auditMedia({ flow, action, ok, message, latencyMs, conversationId = null, data = {} }) {
  logEvent(ok ? 'api_call' : 'error', {
    level: ok ? 'info' : 'warn',
    message,
    tenantId: 'default',
    conversationId,
    module: 'multimodal',
    flow,
    action,
    severity: ok ? null : 'medium',
    dependency: flow === 'media.stt' ? 'openrouter-stt' : 'openrouter-vision',
    latencyMs,
    data,
  }).catch(() => {});
}

/**
 * Transcribe un audio (URL pública o buffer) a texto.
 * Devuelve null si no está configurado o falla.
 */
async function transcribeAudio({ url, buffer, filename = 'audio.ogg', language = 'es', conversationId = null } = {}) {
  const key = getApiKey();
  const model = getSttModel();
  if (!key || !model) return null;
  const started = Date.now();
  const span = startSpan({
    name: 'media.stt',
    kind: 3,
    attributes: { 'gen_ai.provider': 'openrouter', 'gen_ai.request.model': model, 'wibsite.conversation_id': conversationId },
  });
  try {
    const form = new FormData();
    if (buffer) {
      form.append('file', new Blob([buffer]), filename);
    } else if (url) {
      const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
      form.append('file', new Blob([resp.data]), filename);
    } else {
      endSpan(span, { status: 'ERROR', attributes: { 'wibsite.error': 'no_source' } });
      return null;
    }
    form.append('model', model);
    form.append('language', language);
    form.append('response_format', 'json');
    const { data } = await axios.post(`${getBaseUrl()}/audio/transcriptions`, form, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    const text = data?.text || null;
    endSpan(span, { status: 'OK', attributes: { 'wibsite.stt_chars': text ? text.length : 0 } });
    auditMedia({
      flow: 'media.stt', action: 'stt.transcribe', ok: !!text,
      message: text ? `STT ok (${text.length} chars)` : 'STT sin texto',
      latencyMs: Date.now() - started, conversationId, data: { model, chars: text ? text.length : 0 },
    });
    return text;
  } catch (e) {
    endSpan(span, { status: 'ERROR', attributes: { 'wibsite.error': e.message } });
    auditMedia({
      flow: 'media.stt', action: 'stt.transcribe', ok: false,
      message: `STT falló: ${e.message}`,
      latencyMs: Date.now() - started, conversationId, data: { model, error: e.message },
    });
    console.warn('[mediaProcessor] STT falló:', e.message);
    return null;
  }
}

/**
 * Describe una imagen (URL pública) vía modelo de visión.
 * Devuelve null si no está configurado o falla.
 */
async function describeImage({ url, prompt = 'Describe brevemente esta imagen para entender el contexto de una conversación de ventas.', conversationId = null } = {}) {
  const key = getApiKey();
  if (!key || !url) return null;
  const started = Date.now();
  const model = getVisionModel();
  const span = startSpan({
    name: 'media.vision',
    kind: 3,
    attributes: { 'gen_ai.provider': 'openrouter', 'gen_ai.request.model': model, 'wibsite.conversation_id': conversationId },
  });
  try {
    const { data } = await axios.post(
      `${getBaseUrl()}/chat/completions`,
      {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url } },
            ],
          },
        ],
        max_tokens: 300,
      },
      { headers: headers(), timeout: 60000 }
    );
    const caption = data?.choices?.[0]?.message?.content || null;
    endSpan(span, { status: 'OK', attributes: { 'wibsite.caption_chars': caption ? caption.length : 0 } });
    auditMedia({
      flow: 'media.vision', action: 'vision.describe', ok: !!caption,
      message: caption ? `Vision ok (${caption.length} chars)` : 'Vision sin descripción',
      latencyMs: Date.now() - started, conversationId, data: { model, chars: caption ? caption.length : 0 },
    });
    return caption;
  } catch (e) {
    endSpan(span, { status: 'ERROR', attributes: { 'wibsite.error': e.message } });
    auditMedia({
      flow: 'media.vision', action: 'vision.describe', ok: false,
      message: `Vision falló: ${e.message}`,
      latencyMs: Date.now() - started, conversationId, data: { model, error: e.message },
    });
    console.warn('[mediaProcessor] Vision falló:', e.message);
    return null;
  }
}

/**
 * Sintetiza voz (TTS) desde texto vía OpenRouter /audio/speech (G-37).
 * Devuelve { buffer, format, model } o null si no está configurado o falla.
 */
async function synthesizeSpeech({ text, format = 'mp3', conversationId = null } = {}) {
  const key = getApiKey();
  const model = getTtsModel();
  if (!key || !model || !text) return null;
  const started = Date.now();
  const span = startSpan({
    name: 'media.tts',
    kind: 3,
    attributes: { 'gen_ai.provider': 'openrouter', 'gen_ai.request.model': model, 'wibsite.conversation_id': conversationId },
  });
  try {
    const resp = await axios.post(
      `${getBaseUrl()}/audio/speech`,
      { model, input: String(text).slice(0, 4000), voice: process.env.OPENROUTER_TTS_VOICE || 'alloy', response_format: format },
      { headers: headers(), timeout: 60000, responseType: 'arraybuffer' }
    );
    const buffer = Buffer.isBuffer(resp.data) ? resp.data : Buffer.from(resp.data || '');
    endSpan(span, { status: 'OK', attributes: { 'wibsite.audio_bytes': buffer.length } });
    auditMedia({
      flow: 'media.tts', action: 'tts.synthesize', ok: buffer.length > 0,
      message: `TTS ok (${buffer.length} bytes)`,
      latencyMs: Date.now() - started, conversationId, data: { model, bytes: buffer.length, format },
    });
    return buffer.length > 0 ? { buffer, format, model } : null;
  } catch (e) {
    endSpan(span, { status: 'ERROR', attributes: { 'wibsite.error': e.message } });
    auditMedia({
      flow: 'media.tts', action: 'tts.synthesize', ok: false,
      message: `TTS falló: ${e.message}`,
      latencyMs: Date.now() - started, conversationId, data: { model, error: e.message },
    });
    console.warn('[mediaProcessor] TTS falló:', e.message);
    return null;
  }
}

/**
 * Procesa los adjuntos normalizados de un mensaje entrante y devuelve texto
 * adicional para el agente. Nunca lanza.
 */
async function processMedia(media = [], { resolveMediaUrl = null, conversationId = null } = {}) {
  const pieces = [];
  for (const item of media || []) {
    try {
      if (['voice', 'audio', 'video_note'].includes(item.type)) {
        let url = item.url || null;
        if (!url && resolveMediaUrl && item.file_id) url = await resolveMediaUrl(item.file_id);
        const transcript = await transcribeAudio({ url, filename: item.file_id ? `${item.file_id}.ogg` : 'audio.ogg', conversationId });
        if (transcript) pieces.push(`[Transcripción de audio]: ${transcript}`);
      } else if (['photo', 'image'].includes(item.type)) {
        let url = item.url || null;
        if (!url && resolveMediaUrl && item.file_id) url = await resolveMediaUrl(item.file_id);
        const caption = await describeImage({ url, conversationId });
        if (caption) pieces.push(`[Descripción de imagen]: ${caption}`);
      } else if (item.type === 'video') {
        let url = item.url || null;
        if (!url && resolveMediaUrl && item.file_id) url = await resolveMediaUrl(item.file_id);
        const caption = await describeImage({ url, prompt: 'Describe el primer fotograma visible de este video.', conversationId });
        if (caption) pieces.push(`[Video — contexto visual]: ${caption}`);
      }
    } catch (e) {
      console.warn('[mediaProcessor] media item falló:', e.message);
    }
  }
  return pieces;
}

module.exports = {
  transcribeAudio,
  describeImage,
  synthesizeSpeech,
  processMedia,
  isSttConfigured: () => !!(getApiKey() && getSttModel()),
  isVisionConfigured: () => !!getApiKey(),
  isTtsConfigured: () => !!(getApiKey() && getTtsModel()),
};
