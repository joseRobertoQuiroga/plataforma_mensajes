'use strict';
/**
 * emailAdapter.js — Canal Email (API HTTP genérica: Resend/Postmark/Mailgun/SendGrid…)
 * Implementación lista para conectar: el transporte es una API HTTP configurable,
 * lo que permite usar cualquier proveedor sin añadir dependencias.
 *
 * Env requeridas:
 *  EMAIL_API_URL   — endpoint de envío del proveedor (p.ej. https://api.resend.com/emails)
 *  EMAIL_API_KEY   — clave del proveedor
 *  EMAIL_FROM      — remitente verificado (p.ej. ventas@dominio.com)
 */
const axios = require('axios');

function getApiUrl() { return process.env.EMAIL_API_URL || ''; }
function getApiKey() { return process.env.EMAIL_API_KEY || ''; }
function getFrom() { return process.env.EMAIL_FROM || 'ventas@wibsite.local'; }

async function sendMessage({ to, text, subject = 'Wibsite Business' }) {
  const url = getApiUrl();
  const key = getApiKey();
  if (!url || !key) throw new Error('EMAIL_API_URL/EMAIL_API_KEY no configurados');
  const { data } = await axios.post(
    url,
    {
      from: getFrom(),
      to: [to],
      subject,
      text: String(text || '').slice(0, 10000),
    },
    {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );
  return data;
}

function isConfigured() {
  return !!(getApiUrl() && getApiKey());
}

/**
 * Normaliza un webhook de entrada (proveedor-agnóstico).
 * Los proveedores (SendGrid/Postmark/Resend) tienen formatos distintos; este
 * adaptador acepta el formato estándar interno o el de Postmark/SendGrid básico.
 */
async function normalizeUpdate(body) {
  const inbound = body?.inbound || body; // formato interno estándar
  const from = inbound?.from || inbound?.FromFull || body?.FromFull || {};
  const senderEmail = inbound?.from_email || from?.Email || body?.From || '';
  if (!senderEmail) return null;

  let text = inbound?.text || body?.TextBody || body?.StrippedTextReply || '';
  let subject = inbound?.subject || body?.Subject || '';
  if (subject && text) text = `[Asunto: ${subject}] ${text}`;

  const media = [];
  if (Array.isArray(inbound?.attachments) && inbound.attachments.length) {
    for (const att of inbound.attachments) {
      media.push({ type: 'file', url: att.url || null, name: att.name || null, mime_type: att.mime_type || null });
    }
    if (!text) text = '[Correo con adjuntos recibido]';
  }

  return {
    channel: 'email',
    senderId: senderEmail,
    senderName: inbound?.from_name || from?.Name || senderEmail,
    text,
    chatId: senderEmail,
    conversationId: `email_${senderEmail.toLowerCase()}`,
    media,
    raw: body,
  };
}

module.exports = {
  channel: 'email',
  isConfigured,
  sendMessage,
  normalizeUpdate,
};
