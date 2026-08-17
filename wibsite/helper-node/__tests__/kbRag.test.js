const templateEngine = require('../services/templateEngine');
const { executeCommercialGraph } = require('../services/agentCore');
const conversationStore = require('../services/conversationStore');
const { addInMemoryDocument } = require('../services/ragEngine');

const template = templateEngine.loadTemplate('consultora-software');

async function cleanup(conversationId) {
  await conversationStore.deleteConversationState('default', conversationId);
  await conversationStore.deleteCheckpoint('default', conversationId);
}

async function turn(message, conversationId) {
  return executeCommercialGraph({
    message,
    conversationId,
    tenantId: 'default',
    template,
    clientConfig: null,
  });
}

describe('R2 — RAG conectado al grafo (respuestas desde la base de conocimiento)', () => {
  const conversationId = 'conv-r2-kb';

  beforeAll(() => {
    addInMemoryDocument('default', 'FAQ servicios',
      'Ofrecemos desarrollo web, desarrollo movil, integracion de plataformas y consultoria tecnologica. La garantia es de 6 meses.',
      'faq.txt');
  });

  beforeEach(async () => { await cleanup(conversationId); });
  afterAll(async () => { await cleanup(conversationId); });

  test('pregunta de negocio responde desde la KB (sin mover la máquina de ventas)', async () => {
    const result = await turn('que servicios ofrecen?', conversationId);
    expect(result.response).toContain('desarrollo web');
    expect(result.response).toContain('consultoria');
  });

  test('mensaje de venta NO deriva a KB y sigue el flujo comercial', async () => {
    const result = await turn('hola, quiero cotizar una tienda en linea', conversationId);
    expect(result.response).not.toContain('Ofrecemos desarrollo web');
    expect(['calificacion', 'propuesta']).toContain(result.stage);
  });
});
