/**
 * F-47 — Suite de comportamiento del agente vendedor (guiones E2E con grafo real)
 * Escenarios de negocio clave validados turno a turno con la plantilla
 * consultora-software (sin red: el clasificador cae a heurísticas).
 */
const templateEngine = require('../services/templateEngine');
const { executeCommercialGraph } = require('../services/agentCore');
const conversationStore = require('../services/conversationStore');

const template = templateEngine.loadTemplate('consultora-software');

async function runScript(conversationId, guion) {
  const results = [];
  for (const line of guion) {
    const result = await executeCommercialGraph({
      message: line.msg,
      conversationId,
      tenantId: 'default',
      template,
      clientConfig: null,
    });
    results.push(result);
  }
  return results;
}

async function cleanup(conversationId) {
  await conversationStore.deleteConversationState('default', conversationId);
  await conversationStore.deleteCheckpoint('default', conversationId);
}

describe('F-47 — Comportamiento del vendedor (guiones de negocio)', () => {
  afterAll(async () => {
    for (const id of ['beh-venta', 'beh-soporte', 'beh-kb']) await cleanup(id);
  });

  test('Escenario VENTA COMPLETA: interés → cuestionario → propuesta → cotización', async () => {
    const id = 'beh-venta';
    await cleanup(id);
    const r = await runScript(id, [
      { msg: 'Hola, busco una app para mi negocio' },
      { msg: 'Me llamo Roberto Sanchez, quiero una app movil' },
      { msg: 'Para Android y iOS' },
      { msg: 'Si, necesito backend con usuarios' },
      { msg: 'cuanto saldria el desarrollo?' },
    ]);

    expect(r[1].stage).toBe('calificacion');        // detecta servicio + pregunta plataforma
    expect(r[1].response).toContain('plataformas');
    expect(r[2].stage).toBe('calificacion');        // siguiente pregunta del cuestionario
    expect(r[3].stage).toBe('propuesta');           // fit completo → propuesta
    expect(r[4].stage).toBe('cotizacion');          // pricing → mini-cotización
    expect(r[4].response).toContain('USD');
    expect(r[4].response).toContain('Garantía');
  });

  test('Escenario SOPORTE: problema técnico → conversación asistida y derivación a humano', async () => {
    const id = 'beh-soporte';
    await cleanup(id);
    const r = await runScript(id, [
      { msg: 'mi sistema no funciona, necesito ayuda urgente' },
      { msg: 'soy Luisa y quiero auditoria de seguridad' },
      { msg: 'quiero hablar con un humano por favor' },
      { msg: 'si, por favor' },
    ]);
    expect(r[0].stage).toBe('calificacion');
    expect(r[1].stage).toBe('calificacion');        // cuestionario de auditoría (audit_type)
    expect(r[2].stage).toBe('propuesta');           // fit completo → propuesta
    expect(['objeciones', 'cierre', 'handoff', 'profundizacion']).toContain(r[3].stage); // derivación/humano
  });

  test('Escenario PREGUNTA DE NEGOCIO: responde desde KB y no pierde el contexto de venta', async () => {
    const id = 'beh-kb';
    await cleanup(id);
    const { addInMemoryDocument } = require('../services/ragEngine');
    addInMemoryDocument('default', 'FAQ servicios',
      'Ofrecemos desarrollo web, desarrollo movil, integracion de plataformas y consultoria. Garantia de 6 meses en todos los desarrollos.',
      'faq.txt');

    const r1 = await executeCommercialGraph({
      message: 'que servicios ofrecen exactamente?',
      conversationId: id, tenantId: 'default', template, clientConfig: null,
    });
    expect(r1.response).toContain('desarrollo web');

    const r2 = await executeCommercialGraph({
      message: 'me interesa el desarrollo web entonces',
      conversationId: id, tenantId: 'default', template, clientConfig: null,
    });
    expect(r2.stage).toBe('calificacion');
    expect(r2.response).toContain('landing');
  });
});
