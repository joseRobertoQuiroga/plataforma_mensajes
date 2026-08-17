const templateEngine = require('../services/templateEngine');
const { executeCommercialGraph } = require('../services/agentCore');
const conversationStore = require('../services/conversationStore');

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

describe('C2-C4 — Cuestionarios por servicio + estimación + mini-cotización', () => {
  const conversationId = 'conv-c4-quote';

  beforeEach(async () => { await cleanup(conversationId); });
  afterAll(async () => { await cleanup(conversationId); });

  test('cuestionario de desarrollo web guía la estimación y genera mini-cotización', async () => {
    const t1 = await turn('soy Maria Gomez y quiero una tienda en linea', conversationId);
    expect(t1.stage).toBe('calificacion');
    expect(t1.response).toContain('tienda');
    expect(t1.response).toContain('landing');

    const t2 = await turn('una tienda en linea', conversationId);
    expect(t2.stage).toBe('calificacion');
    expect(t2.response).toContain('pasarela de pagos');

    const t3 = await turn('si, con pasarela de pagos', conversationId);
    expect(t3.stage).toBe('propuesta');
    expect(t3.response).toContain('desarrollo web');

    const t4 = await turn('cuanto costaria exactamente?', conversationId);
    expect(t4.stage).toBe('cotizacion');
    expect(t4.response).toContain('estimación inicial');
    expect(t4.response).toContain('USD');
    expect(t4.response).toContain('Garantía');
    expect(t4.response).toContain('Validez');
  });

  test('pregunta de precios sin producto detectado no genera cotización', async () => {
    const t1 = await turn('cuanto cuesta todo?', conversationId);
    expect(t1.stage).not.toBe('cotizacion');
  });
});
