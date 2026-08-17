const telegram = require('../services/channels/telegramAdapter');
const messenger = require('../services/channels/messengerAdapter');
const email = require('../services/channels/emailAdapter');
const tiktok = require('../services/channels/tiktokAdapter');
const whatsapp = require('../services/channels/whatsappAdapter');
const channels = require('../services/channels');
const mediaProcessor = require('../services/mediaProcessor');

jest.mock('axios');

describe('Multicanal — Registro de canales', () => {
  test('lista los 5 canales del alcance', () => {
    const list = channels.listChannels();
    const names = list.map(c => c.channel).sort();
    expect(names).toEqual(['email', 'messenger', 'telegram', 'tiktok', 'whatsapp']);
  });

  test('sendToChannel con canal desconocido devuelve error sin lanzar', async () => {
    const res = await channels.sendToChannel('discord', 'x', 'hola');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('no soportado');
  });

  test('sendToChannel sin configurar devuelve error controlado', async () => {
    const res = await channels.sendToChannel('telegram', '123', 'hola');
    expect(res.ok).toBe(false);
  });
});

describe('Multicanal — Telegram (canal de pruebas principal)', () => {
  test('normaliza un update de texto al formato interno', async () => {
    const update = {
      update_id: 1,
      message: {
        message_id: 10,
        from: { id: 555, first_name: 'Luis', last_name: 'Perez', username: 'luisp' },
        chat: { id: 555, type: 'private' },
        text: 'Hola, quiero información',
      },
    };
    const n = await telegram.normalizeUpdate(update);
    expect(n.channel).toBe('telegram');
    expect(n.senderId).toBe('555');
    expect(n.senderName).toBe('luisp');
    expect(n.text).toBe('Hola, quiero información');
    expect(n.conversationId).toBe('telegram_555');
    expect(n.media).toEqual([]);
  });

  test('normaliza un mensaje de voz (prepara transcripción)', async () => {
    const update = {
      update_id: 2,
      message: {
        message_id: 11,
        from: { id: 556, first_name: 'Ana' },
        chat: { id: 556, type: 'private' },
        voice: { file_id: 'FILE_VOICE_1', duration: 4, mime_type: 'audio/ogg' },
      },
    };
    const n = await telegram.normalizeUpdate(update);
    expect(n.media.length).toBe(1);
    expect(n.media[0]).toEqual({ type: 'voice', file_id: 'FILE_VOICE_1', mime_type: 'audio/ogg' });
    expect(n.text).toContain('voz');
  });

  test('normaliza una foto (prepara descripción)', async () => {
    const update = {
      update_id: 3,
      message: {
        message_id: 12,
        from: { id: 557, first_name: 'Beto' },
        chat: { id: 557, type: 'private' },
        photo: [{ file_id: 'PHOTO_S', width: 90, height: 90 }, { file_id: 'PHOTO_L', width: 640, height: 640 }],
      },
    };
    const n = await telegram.normalizeUpdate(update);
    expect(n.media.length).toBe(1);
    expect(n.media[0].file_id).toBe('PHOTO_L');
  });

  test('sendMessage usa la Bot API correctamente', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok123';
    const axios = require('axios');
    axios.post.mockResolvedValue({ data: { ok: true, result: { message_id: 42 } } });
    const res = await telegram.sendMessage({ to: '555', text: 'hola' });
    expect(res.message_id).toBe(42);
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.telegram.org/bottok123/sendMessage',
      expect.objectContaining({ chat_id: '555', text: 'hola' }),
      expect.any(Object)
    );
    delete process.env.TELEGRAM_BOT_TOKEN;
  });
});

describe('Multicanal — Messenger (Meta Graph API)', () => {
  test('normaliza mensaje de texto de Meta', async () => {
    const body = {
      object: 'page',
      entry: [{
        messaging: [{
          sender: { id: 'USR1' },
          recipient: { id: 'PAGE1' },
          message: { mid: 'm1', text: 'Quiero una demo' },
        }],
      }],
    };
    const n = await messenger.normalizeUpdate(body);
    expect(n.channel).toBe('messenger');
    expect(n.senderId).toBe('USR1');
    expect(n.text).toBe('Quiero una demo');
    expect(n.conversationId).toBe('messenger_USR1');
  });

  test('normaliza adjunto de audio', async () => {
    const body = {
      object: 'page',
      entry: [{
        messaging: [{
          sender: { id: 'USR2' },
          recipient: { id: 'PAGE1' },
          message: {
            mid: 'm2',
            attachments: [{ type: 'audio', payload: { url: 'https://cdn.meta/a.ogg' } }],
          },
        }],
      }],
    };
    const n = await messenger.normalizeUpdate(body);
    expect(n.media.length).toBe(1);
    expect(n.media[0].url).toContain('cdn.meta');
    expect(n.text).toContain('voz');
  });
});

describe('Multicanal — Email (API HTTP genérica)', () => {
  test('normaliza un inbound email estándar', async () => {
    const body = {
      inbound: {
        from_email: 'cliente@correo.com',
        from_name: 'Cliente X',
        subject: 'Cotización',
        text: 'Necesito una cotización de sus servicios',
      },
    };
    const n = await email.normalizeUpdate(body);
    expect(n.channel).toBe('email');
    expect(n.senderId).toBe('cliente@correo.com');
    expect(n.text).toContain('Cotización');
    expect(n.conversationId).toBe('email_cliente@correo.com');
  });

  test('normaliza un inbound email estilo Postmark', async () => {
    const body = {
      FromFull: { Email: 'cliente2@correo.com', Name: 'Cliente 2' },
      Subject: 'Hola',
      TextBody: 'Mensaje simple',
    };
    const n = await email.normalizeUpdate(body);
    expect(n.senderId).toBe('cliente2@correo.com');
    expect(n.text).toBe('[Asunto: Hola] Mensaje simple');
  });
});

describe('Multicanal — TikTok (comentarios)', () => {
  test('normaliza un payload de comentario', async () => {
    const n = await tiktok.normalizeUpdate({
      comment: { author_id: 'TT1', author_name: '@creador', text: 'Me interesa el producto' },
    });
    expect(n.channel).toBe('tiktok');
    expect(n.senderId).toBe('TT1');
    expect(n.conversationId).toBe('tiktok_TT1');
  });
});

describe('Multicanal — WhatsApp (puente Twilio existente)', () => {
  test('normaliza payload interno', async () => {
    const n = await whatsapp.normalizeUpdate({ senderId: 'whatsapp:+59170000123', text: 'hola' });
    expect(n.senderId).toBe('+59170000123');
    expect(n.conversationId).toBe('whatsapp_+59170000123');
  });
});

describe('Multimodal — mediaProcessor (OpenRouter free tier)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_STT_MODEL;
  });

  test('STT sin configuración devuelve null (degradación elegante)', async () => {
    const res = await mediaProcessor.transcribeAudio({ url: 'https://x/a.ogg' });
    expect(res).toBeNull();
  });

  test('STT con configuración usa el endpoint de transcripciones', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    process.env.OPENROUTER_STT_MODEL = 'openai/whisper-large-v3';
    const axios = require('axios');
    axios.get.mockResolvedValue({ data: Buffer.from('audio') });
    axios.post.mockResolvedValue({ data: { text: 'Quiero información de precios' } });
    const res = await mediaProcessor.transcribeAudio({ url: 'https://x/a.ogg' });
    expect(res).toBe('Quiero información de precios');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/audio/transcriptions'),
      expect.any(FormData),
      expect.any(Object)
    );
  });

  test('describeImage sin key devuelve null', async () => {
    const res = await mediaProcessor.describeImage({ url: 'https://x/i.jpg' });
    expect(res).toBeNull();
  });

  test('describeImage usa visión gpt-4o-mini', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    const axios = require('axios');
    axios.post.mockResolvedValue({ data: { choices: [{ message: { content: 'Imagen de un volante promocional' } }] } });
    const res = await mediaProcessor.describeImage({ url: 'https://x/i.jpg' });
    expect(res).toContain('volante');
    const call = axios.post.mock.calls[0];
    expect(call[1].model).toBe('openai/gpt-4o-mini');
    expect(call[1].messages[0].content[1].image_url.url).toBe('https://x/i.jpg');
  });

  test('processMedia produce piezas de texto para el agente', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    process.env.OPENROUTER_STT_MODEL = 'openai/whisper-large-v3';
    const axios = require('axios');
    axios.get.mockResolvedValue({ data: Buffer.from('audio') });
    axios.post.mockImplementation((url) => {
      if (url.includes('/audio/transcriptions')) {
        return Promise.resolve({ data: { text: 'Quiero una demo' } });
      }
      return Promise.resolve({ data: { choices: [{ message: { content: 'Descripción de imagen' } }] } });
    });
    const pieces = await mediaProcessor.processMedia([
      { type: 'voice', url: 'https://x/v.ogg' },
      { type: 'photo', url: 'https://x/p.jpg' },
    ]);
    expect(pieces.length).toBe(2);
    expect(pieces[0]).toContain('[Transcripción de audio]');
    expect(pieces[1]).toContain('[Descripción de imagen]');
  });
});
