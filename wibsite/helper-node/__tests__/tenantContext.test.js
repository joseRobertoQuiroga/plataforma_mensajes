const { createTenantContextMiddleware } = require('../middleware/tenantContext');

describe('tenantContext middleware', () => {
  test('falls back quickly when tenant lookup times out', async () => {
    jest.setTimeout(1500);

    const pool = {
      query: jest.fn().mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('DB timeout')), 4000);
      })),
    };

    const middleware = createTenantContextMiddleware(pool);
    const req = { headers: {}, path: '/api/campaigns' };
    const res = {};
    const next = jest.fn();

    const started = Date.now();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenantId).toBe('default');
    expect(req.tenantSource).toBe('default-fallback');
    expect(Date.now() - started).toBeLessThan(2500);
  });
});
