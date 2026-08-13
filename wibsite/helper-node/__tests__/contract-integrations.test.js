process.env.DIFY_API_KEY = 'test-dify-key';
process.env.DIFY_API_URL = 'http://dify-test:5001/v1/workflows/run';
process.env.OPENROUTER_API_KEY = 'sk-or-test';
process.env.OPENROUTER_MODEL = 'openai/gpt-4o-mini';

const axios = require('axios');
const llmClient = require('../services/agentCore/llmClient');
const { queryKnowledgeBase, checkWeaviateHealth } = require('../services/ragEngine');

jest.mock('axios');

describe('Pruebas de Contratos (External API Integrations)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    llmClient.registerSuccess();
  });

  describe('Dify / LLM API Contract (F-18)', () => {
    test('workflows/run cumple contrato: inputs con mensaje + parse de final_result', async () => {
      const mockResponse = {
        data: {
          data: {
            outputs: { final_result: JSON.stringify({ intent: 'venta', score: 80, confidence: 0.85 }) },
          },
        },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await llmClient.classify('Quiero un desarrollo a medida', {
        tenantId: 'user-123',
        conversationId: 'conv-123',
      });

      const payload = axios.post.mock.calls[0][1];
      expect(payload).toHaveProperty('inputs');
      expect(payload.inputs).toHaveProperty('message', 'Quiero un desarrollo a medida');
      expect(payload.inputs).toHaveProperty('conversation_id', 'conv-123');
      expect(payload.inputs).toHaveProperty('tenant_id', 'user-123');
      expect(payload).toHaveProperty('response_mode', 'blocking');
      expect(payload).toHaveProperty('user', 'user-123');

      expect(result.mode).toBe('primary');
      expect(result.intent).toBe('venta');
      expect(result.score).toBe(80);
      expect(result.confidence).toBe(0.85);
    });

    test('contrato de fallback OpenRouter: chat/completions con JSON de clasificacion', async () => {
      axios.post
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({
          data: { choices: [{ message: { content: '{"intent":"venta","score":45,"confidence":0.5}' } }] },
        });

      const result = await llmClient.classify('Hola', { tenantId: 'user-123', conversationId: 'conv-123' });
      expect(result.mode).toBe('fallback');
      expect(result.score).toBe(45);
      expect(axios.post.mock.calls[1][0]).toContain('/chat/completions');
      expect(axios.post.mock.calls[1][1]).toHaveProperty('model');
    });
  });

  describe('Weaviate RAG Contract', () => {
    test('queryKnowledgeBase transforma objetos REST al contrato local', async () => {
      const mockResponse = {
        status: 200,
        data: {
          objects: [
            { id: 'obj-1', properties: { title: 'Doc 1', content: 'Información relevante 1', tenantId: 'tenant-1' } },
            { id: 'obj-2', properties: { title: 'Doc 2', content: 'Información relevante 2', tenantId: 'tenant-1' } },
          ],
        },
      };
      axios.get.mockResolvedValue(mockResponse);

      const results = await queryKnowledgeBase('tenant-1', 'pregunta de prueba');
      const objectsCall = axios.get.mock.calls.find(c => c[0].includes('/v1/objects'));
      expect(objectsCall).toBeTruthy();
      const url = objectsCall[0];
      expect(url).toContain('/v1/objects');
      const params = objectsCall[1].params;
      expect(params.class).toBe('KnowledgeBase');
      expect(JSON.parse(params.where).path).toContain('tenantId');
      expect(results).toHaveProperty('results');
      expect(results.results).toHaveLength(2);
      expect(results.results[0]).toHaveProperty('content', 'Información relevante 1');
    });

    test('checkWeaviateHealth reporta disponibilidad (contrato booleano)', async () => {
      axios.get.mockResolvedValue({ status: 200, data: {} });
      const available = await checkWeaviateHealth();
      expect(typeof available).toBe('boolean');
      expect(available).toBe(true);
      expect(axios.get.mock.calls[0][0]).toContain('/v1/.well-known/ready');
    });
  });
});