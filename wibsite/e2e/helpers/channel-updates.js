export function telegramTextUpdate({ userId = 555001, chatId = null, text = 'Hola, quiero información' } = {}) {
  const id = chatId ?? userId;
  return {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: Math.floor(Math.random() * 1e6),
      from: { id: userId, first_name: 'E2E', last_name: 'Cliente', username: `e2e_${userId}` },
      chat: { id, type: 'private' },
      text,
    },
  };
}

export function telegramVoiceUpdate({ userId = 555002, chatId = null } = {}) {
  const id = chatId ?? userId;
  return {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: Math.floor(Math.random() * 1e6),
      from: { id: userId, first_name: 'E2E', last_name: 'Voz' },
      chat: { id, type: 'private' },
      voice: { file_id: 'FILE_VOICE_E2E_1', duration: 4, mime_type: 'audio/ogg' },
    },
  };
}

export function telegramPhotoUpdate({ userId = 555003, chatId = null } = {}) {
  const id = chatId ?? userId;
  return {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: Math.floor(Math.random() * 1e6),
      from: { id: userId, first_name: 'E2E', last_name: 'Foto' },
      chat: { id, type: 'private' },
      photo: [
        { file_id: 'PHOTO_S_E2E', width: 90, height: 90 },
        { file_id: 'PHOTO_L_E2E', width: 640, height: 640 },
      ],
    },
  };
}

export function messengerTextPayload({ senderId = 'E2E_USER_1', pageId = 'E2E_PAGE_1', text = 'Quiero una demo' } = {}) {
  return {
    object: 'page',
    entry: [{
      id: pageId,
      time: Math.floor(Date.now() / 1000),
      messaging: [{
        sender: { id: senderId },
        recipient: { id: pageId },
        timestamp: Math.floor(Date.now() / 1000),
        message: { mid: `m_${Date.now()}`, text },
      }],
    }],
  };
}
