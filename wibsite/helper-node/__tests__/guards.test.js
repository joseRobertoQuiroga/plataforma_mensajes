const confidentiality = require('../services/agentCore/guards/confidentiality');
const autonomy = require('../services/agentCore/guards/autonomy');
const templateEngine = require('../services/templateEngine');
const { createPropuestaNode } = require('../services/agentCore/nodes/propuestaNode');
const { createCierreNode } = require('../services/agentCore/nodes/cierreNode');
const { createObjecionesNode } = require('../services/agentCore/nodes/objecionesNode');

const template = templateEngine.loadTemplate('consultora-software');

describe('F-17 Guardas: confidencialidad y zonas de autonomia', () => {
  test('0 datos internal en 20 respuestas generadas', async () => {
    const nodos = [createPropuestaNode(), createCierreNode(), createObjecionesNode()];
    const mensajes = [
      'hola', 'quiero integracion de plataformas', 'es muy caro', 'cuanto cuesta?',
      'quiero cotizacion', 'no tengo presupuesto ahora', 'contame mas', 'quienes son?',
      'quiero agendar', 'hola buenos dias', 'que precios manejan', 'manda la cotizacion',
      'por que ustedes?', 'cuanto tarda?', 'lo consulto con mi socio', 'ok gracias',
      'me interesa el modulo nuevo', 'auditoria cuanto sale', 'soy Ana, mi telefono es 5491112345678',
      'hasta luego',
    ];
    for (const mensaje of mensajes) {
      const state = { name: 'Ana', interest: 'integracion de plataformas', _lastMessage: mensaje, _score: 40 };
      for (const nodo of nodos) {
        const res = await nodo({ state, template, clientConfig: null, message: mensaje });
        const text = res.output.text || '';
        const leak = confidentiality.detectLeak(text, template);
        expect(leak.leaked).toBe(false);
      }
    }
  });

  test('filtro de contexto quita campos internal (forbidden_topics y _privados)', () => {
    const raw = {
      name: 'Ana', phone: '5491112345678', internal_cost_structure: { secret: true },
      profit_margins: 40, _llmContext: { x: 1 }, email: 'ana@correo.com',
    };
    const { cleanState, removed } = confidentiality.filterContext(raw, template);
    expect(removed).toEqual(expect.arrayContaining(['internal_cost_structure', 'profit_margins', '_llmContext']));
    expect(cleanState.internal_cost_structure).toBeUndefined();
    expect(cleanState.profit_margins).toBeUndefined();
    expect(cleanState.phone).toBe('*********5678');
    expect(cleanState.email).toBe('an***@correo.com');
  });

  test('test de fuga: intento de citar internal_cost_structure → bloqueado y security_alert', async () => {
    const result = confidentiality.sanitizeOutput(
      'El costo interno es internal_cost_structure: 50000 usd al mes.',
      template, { conversationId: 'conv-leak' }
    );
    expect(result.leaked).toBe(true);
    expect(result.text).not.toContain('50000');
    expect(result.text).toContain('No puedo compartir');
  });

  test('yellow: pricing compartido con disclaimer; green: sin numeros', async () => {
    const green = await createPropuestaNode()({
      state: { _lastMessage: 'contame mas del alcance', interest: 'integracion de plataformas' },
      template, clientConfig: null,
    });
    expect(green.output.zone).toBe('green');
    expect(green.output.text).not.toMatch(/\$\d/);

    const yellow = await createPropuestaNode()({
      state: { _lastMessage: 'cuanto cuesta la integracion?', interest: 'integracion de plataformas' },
      template, clientConfig: null,
    });
    expect(yellow.output.zone).toBe('yellow');
    expect(yellow.output.text).toMatch(/\$\d/);
    expect(yellow.output.text).toContain('Precios referenciales');
  });

  test('red: siempre deriva a humano', async () => {
    const compromiso = await createCierreNode()({
      state: { _lastMessage: 'quiero firmar ya', _qualified: true },
      template,
    });
    expect(compromiso.output.zone).toBe('red');
    expect(compromiso.output.derive).toBe(true);

    const noFit = await createCierreNode()({
      state: { _lastMessage: 'hola', _qualified: false },
      template,
    });
    expect(noFit.output.derive).toBe(true);
  });

  test('pareo de objeciones con banco de la plantilla', async () => {
    const res = await createObjecionesNode()({
      state: { name: 'Ana' }, template, clientConfig: null, message: 'es muy caro'
    });
    expect(res.output.matched).toBe(true);
    expect(res.output.text).toContain('Ana');
    expect(res.output.next_action).toBe('continuar_conversacion');
    expect(res.state._objections_log).toHaveLength(1);
  });
});