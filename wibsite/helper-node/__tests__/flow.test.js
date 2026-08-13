const request = require('supertest');
const { app } = require('../index');
const storeFacade = require('../services/storeFacade');
const { initRedis } = require('../services/conversationStore');

// Mocks
jest.mock('../services/ragEngine', () => ({
  queryRAG: jest.fn().mockResolvedValue([{ text: 'Contexto de KB', certainty: 0.9 }])
}));

describe('Flujos de Negocio (Business Flows)', () => {
  beforeAll(async () => {
    storeFacade.initPgStore(null); // Force in-memory for testing
    await initRedis();
  });

  afterEach(() => {
    // Reset in-memory store
    storeFacade.getStore().leads = [];
    storeFacade.getStore().campaigns = [];
    storeFacade.getStore().scores = [];
    jest.clearAllMocks();
  });

  test('Flujo Completo: Creación de Lead -> Scoring -> Campaign', async () => {
    // 1. Crear un lead simulando un webhook de Chatwoot
    const webhookPayload = {
      event: 'message_created',
      id: 101,
      sender: {
        id: 50,
        name: 'Carlos Perez',
        phone_number: '+59170000001'
      },
      content: 'Hola, quiero más información sobre los servicios'
    };

    const resWebhook = await request(app)
      .post('/api/webhooks/chatwoot')
      .set('x-api-key', 'test-key')
      .send(webhookPayload);

    expect(resWebhook.status).toBe(200);

    // 2. Verificar que el lead se guardó
    const store = storeFacade.getStore();
    expect(store.leads.length).toBeGreaterThan(0);
    const leadId = store.leads[0].id;
    
    // 3. Forzar el scoring de los leads
    const resScore = await request(app)
      .post('/api/leads/score-all')
      .set('x-api-key', 'test-key')
      .send({});
      
    expect(resScore.status).toBe(200);
    expect(resScore.body.processed).toBe(1);
    
    // 4. Crear una campaña para enviar un mensaje a los leads
    const resCampaign = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', 'test-key')
      .send({
        name: 'Promo Seguimiento',
        messageTemplate: 'Hola {{name}}, tenemos una promo para ti.',
        sendTo: 'all',
        scheduleTime: null // Send immediately
      });
      
    expect(resCampaign.status).toBe(200);
    expect(resCampaign.body.status).toBe('sending');
  });

  test('Flujo de Opt-Out (Unsubscribe)', async () => {
    // Crear un lead
    storeFacade.getStore().leads.push({ id: 'L-123', name: 'Ana', phone: 'whatsapp:+59160000002', status: 'active', opt_out: false });
    
    // Simular un mensaje de opt-out ("DETENER")
    const webhookPayload = {
      event: 'message_created',
      id: 102,
      sender: {
        id: 51,
        name: 'Ana',
        phone_number: '+59160000002'
      },
      content: 'DETENER'
    };

    const resWebhook = await request(app)
      .post('/api/webhooks/chatwoot')
      .set('x-api-key', 'test-key')
      .send(webhookPayload);

    expect(resWebhook.status).toBe(200);
    
    // Verificar que el estado del lead cambió a opt-out
    const lead = storeFacade.getStore().leads.find(l => l.phone === 'whatsapp:+59160000002');
    expect(lead).toBeDefined();
    expect(lead.opt_out).toBe(true);
  });
});
