const request = require('supertest');

jest.setTimeout(25000);

describe('Contract Tests - helper API surface', () => {
  let app;

  beforeAll(async () => {
    process.env.HELPER_API_KEY = 'test-api-key-123';
    app = require('../index.js');
  });

  const API_KEY = 'test-api-key-123';
  const auth = { 'x-api-key': API_KEY };

  test('GET /health returns the expected contract shape', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      service: expect.any(String),
      status: expect.any(String),
      version: expect.any(String),
      timestamp: expect.any(String),
      modules: expect.any(Object),
      sli: expect.any(Object),
    }));
  });

  test('GET /api/scoring/rules returns the expected contract shape', async () => {
    const res = await request(app).get('/api/scoring/rules').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      weights: expect.any(Object),
      thresholds: expect.any(Object),
      rules: expect.any(Array),
    }));
  });
});
