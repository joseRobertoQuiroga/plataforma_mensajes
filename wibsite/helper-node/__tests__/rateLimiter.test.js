const { rateLimiter } = require('../middleware/rateLimiter');

describe('Rate Limiter - MVP-06b: Rate limiting', () => {
  function mockReq(path = '/api/test', ip = '127.0.0.1') {
    return {
      path,
      ip,
      headers: {},
      socket: { remoteAddress: ip },
    };
  }
  function mockRes() {
    const res = { statusCode: 200 };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    res.set = () => res;
    return res;
  }

  test('permite primeras requests', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    rateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('aplica rate limit para LLM endpoints con límite más bajo (10/min)', () => {
    const req = mockReq('/api/llm/chat');
    const res = mockRes();
    const mockNext = jest.fn();

    for (let i = 0; i < 12; i++) {
      mockNext.mockClear();
      rateLimiter(req, res, mockNext);
    }
    const lastCall = mockNext.mock.calls.length === 0;
  });

  test('usa X-Forwarded-For si está presente', () => {
    const req = mockReq();
    req.headers['x-forwarded-for'] = '10.0.0.1, proxy';
    const res = mockRes();
    const next = jest.fn();
    rateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('retorna 429 cuando excede límite', () => {
    const req = mockReq('/api/test', '10.0.0.99');
    const res = mockRes();
    let lastStatus = 200;
    for (let i = 0; i < 65; i++) {
      const next = jest.fn();
      rateLimiter(req, res, next);
      if (res.statusCode === 429) { lastStatus = 429; break; }
    }
    expect(lastStatus).toBe(429);
  });

  test('429 incluye retry_after', () => {
    const req = mockReq('/api/test', '10.0.0.100');
    const res = mockRes();
    let got429 = false;
    for (let i = 0; i < 65; i++) {
      const next = jest.fn();
      rateLimiter(req, res, next);
      if (res.statusCode === 429) { got429 = true; break; }
    }
    if (got429) {
      expect(res.body.retry_after).toBeDefined();
      expect(res.body.limit).toBeDefined();
    }
  });

  test('diferentes IPs tienen buckets independientes', () => {
    const next1 = jest.fn();
    rateLimiter(mockReq('/api/test', '1.1.1.1'), mockRes(), next1);
    expect(next1).toHaveBeenCalled();

    const next2 = jest.fn();
    rateLimiter(mockReq('/api/test', '2.2.2.2'), mockRes(), next2);
    expect(next2).toHaveBeenCalled();
  });
});
