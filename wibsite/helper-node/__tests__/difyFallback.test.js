process.env.DIFY_API_KEY = 'test-dify-key';
process.env.DIFY_API_URL = 'http://dify-test:5001/v1/workflows/run';
process.env.OPENROUTER_API_KEY = 'sk-or-test';
process.env.OPENROUTER_MODEL = 'openai/gpt-4o-mini';

jest.mock('axios');
const axios = require('axios');
const llmClient = require('../services/agentCore/llmClient');

const context = { tenantId: 'tenant-f18', conversationId: 'conv-f18' };

describe('F-18 Dify classifier como nodo + fallback OpenRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    llmClient.registerSuccess();
  });

  test('Dify up: score presente con modo primary (doble JSON en final_result)', async () => {
    axios.post.mockResolvedValueOnce({
      data: { data: { outputs: { final_result: JSON.stringify({ intent: 'venta', score: 72, confidence: 0.9 }) } } },
    });
    const result = await llmClient.classify('quiero cotizar un desarrollo', context);
    expect(result.mode).toBe('primary');
    expect(result.intent).toBe('venta');
    expect(result.score).toBe(72);
    expect(result.confidence).toBe(0.9);
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body] = axios.post.mock.calls[0];
    expect(url).toContain('/v1/workflows/run');
    expect(body.inputs.message).toBe('quiero cotizar un desarrollo');
    expect(body.inputs.tenant_id).toBe('tenant-f18');
  });

  test('Dify down (HTTP 500): fallback OpenRouter activo', async () => {
    axios.post
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({
        data: { choices: [{ message: { content: '{"intent":"venta","score":55,"confidence":0.6}' } }] },
      });
    const result = await llmClient.classify('hola', context);
    expect(result.mode).toBe('fallback');
    expect(result.score).toBe(55);
    expect(result.confidence).toBe(0.6);
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[1][0]).toContain('/chat/completions');
  });

  test('final_result anidado (string JSON dentro de objeto) se parsea', async () => {
    axios.post.mockResolvedValueOnce({
      data: { data: { outputs: { final_result: JSON.stringify({ final_result: { intent: 'soporte', score: 10, confidence: 0.4 }, extra: 1 }) } } },
    });
    const result = await llmClient.classify('mi sistema no funciona', context);
    expect(result.mode).toBe('primary');
    expect(result.intent).toBe('soporte');
    expect(result.score).toBe(10);
  });

  test('circuit breaker: tras 3 fallos Dify no se intenta (solo fallback)', async () => {
    for (let i = 0; i < 3; i++) {
      axios.post.mockRejectedValueOnce({ response: { status: 503 } });
      axios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: '{"intent":"venta","score":30}' } }] } });
      await llmClient.classify(`msg-${i}`, context);
    }
    expect(llmClient.isCircuitOpen()).toBe(true);

    axios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: '{"intent":"venta","score":40}' } }] } });
    const result = await llmClient.classify('msg-4', context);
    expect(result.mode).toBe('fallback');
    expect(axios.post).toHaveBeenCalledTimes(7);
    const callsToDify = axios.post.mock.calls.filter(c => c[0].includes('/workflows/run')).length;
    expect(callsToDify).toBe(3);

    llmClient.registerSuccess();
    axios.post.mockResolvedValueOnce({
      data: { data: { outputs: { final_result: '{"intent":"venta","score":60}' } } },
    });
    const recovered = await llmClient.classify('msg-5', context);
    expect(recovered.mode).toBe('primary');
  });
});