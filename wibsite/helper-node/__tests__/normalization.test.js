'use strict';
/**
 * @file normalization.test.js
 * D9: normalizePhone, normalizeEmail, normalizationMiddleware
 * B2B: Company context enrichment logic
 */

const { normalizePhone, normalizeEmail, normalizationMiddleware } = require('../middleware/sanitizer');

// ─── normalizePhone ───────────────────────────────────────────────────────────
describe('normalizePhone', () => {
  test('strips spaces', () => { expect(normalizePhone('+1 555 123 4567')).toBe('+15551234567'); });
  test('strips parentheses', () => { expect(normalizePhone('+1 (555) 1234567')).toBe('+15551234567'); });
  test('strips dashes', () => { expect(normalizePhone('+1-555-123-4567')).toBe('+15551234567'); });
  test('converts 00 prefix to +', () => { expect(normalizePhone('0015551234567')).toBe('+15551234567'); });
  test('preserves leading +', () => { expect(normalizePhone('+15551234567')).toBe('+15551234567'); });
  test('strips mixed separators', () => { expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567'); });
  test('handles local format no country code', () => { expect(normalizePhone('5551234567')).toBe('5551234567'); });
  test('handles pure digits', () => { expect(normalizePhone('12345678901')).toBe('12345678901'); });
  test('returns null for null', () => { expect(normalizePhone(null)).toBeNull(); });
  test('returns undefined for undefined', () => { expect(normalizePhone(undefined)).toBeUndefined(); });
});

// ─── normalizeEmail ───────────────────────────────────────────────────────────
describe('normalizeEmail', () => {
  test('lowercases uppercase', () => { expect(normalizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com'); });
  test('trims leading spaces', () => { expect(normalizeEmail('  test@example.com')).toBe('test@example.com'); });
  test('trims trailing spaces', () => { expect(normalizeEmail('test@example.com   ')).toBe('test@example.com'); });
  test('trims and lowercases', () => { expect(normalizeEmail('  ADMIN@WIBSITE.COM  ')).toBe('admin@wibsite.com'); });
  test('returns null for null', () => { expect(normalizeEmail(null)).toBeNull(); });
  test('returns undefined for undefined', () => { expect(normalizeEmail(undefined)).toBeUndefined(); });
  test('does not alter clean email', () => { expect(normalizeEmail('user@domain.co')).toBe('user@domain.co'); });
});

// ─── normalizationMiddleware ──────────────────────────────────────────────────
describe('normalizationMiddleware', () => {
  const mockNext = jest.fn();
  beforeEach(() => { mockNext.mockClear(); });
  function req(method, path, body) { return { method, path, body }; }

  test('normalizes on POST /api/leads', () => {
    const r = req('POST', '/api/leads', { phone: '+1 (555) 123-4567', email: 'USER@EXAMPLE.COM' });
    normalizationMiddleware(r, {}, mockNext);
    expect(r.body.phone).toBe('+15551234567');
    expect(r.body.email).toBe('user@example.com');
    expect(mockNext).toHaveBeenCalled();
  });

  test('normalizes on PATCH /api/leads/123', () => {
    const r = req('PATCH', '/api/leads/123', { phone: '0034-612-345-678', email: 'Admin@Test.IO' });
    normalizationMiddleware(r, {}, mockNext);
    expect(r.body.phone).toBe('+34612345678');
    expect(r.body.email).toBe('admin@test.io');
  });

  test('does NOT alter body on non-leads path', () => {
    const r = req('POST', '/api/campaigns', { phone: '+1 555 1234', email: 'TEST@X.COM' });
    normalizationMiddleware(r, {}, mockNext);
    expect(r.body.phone).toBe('+1 555 1234');
    expect(r.body.email).toBe('TEST@X.COM');
  });

  test('skips phone when absent', () => {
    const r = req('POST', '/api/leads', { email: 'TEST@X.COM' });
    normalizationMiddleware(r, {}, mockNext);
    expect(r.body.phone).toBeUndefined();
    expect(r.body.email).toBe('test@x.com');
  });
});

// ─── Company context enrichment (unit logic) ──────────────────────────────────
describe('Company context enrichment logic', () => {
  function buildEnriched(lead, store) {
    const cfg = {};
    if (lead && lead.company_id && store) {
      const company = (store.companies || []).find(c => c.id === lead.company_id);
      if (company) {
        const siblings = (store.leads || []).filter(l => l.company_id === lead.company_id && l.id !== lead.id);
        cfg.company = { id: company.id, name: company.name, domain: company.domain || null, industry: company.industry || null };
        cfg.companyContacts = siblings.map(l => ({ id: l.id, name: l.name, phone: l.phone || null, email: l.email || null, status: l.status || null }));
      }
    }
    return cfg;
  }

  const co = { id: 'co-1', name: 'Acme Corp', domain: 'acme.com', industry: 'Tech' };
  const l1 = { id: 'l-1', name: 'Alice', phone: '+1000', email: null, status: 'interesado', company_id: 'co-1' };
  const l2 = { id: 'l-2', name: 'Bob', phone: '+2000', email: 'bob@acme.com', status: 'nuevo', company_id: 'co-1' };
  const l3 = { id: 'l-3', name: 'Charlie', phone: '+3000', company_id: 'co-2' };
  const store = { companies: [co], leads: [l1, l2, l3] };

  test('enriches company info', () => {
    const cfg = buildEnriched(l1, store);
    expect(cfg.company.name).toBe('Acme Corp');
    expect(cfg.company.domain).toBe('acme.com');
  });

  test('lists siblings excluding self', () => {
    const cfg = buildEnriched(l1, store);
    expect(cfg.companyContacts).toHaveLength(1);
    expect(cfg.companyContacts[0].name).toBe('Bob');
  });

  test('no company when lead has no company_id', () => {
    const cfg = buildEnriched({ id: 'l-4', name: 'Dave', company_id: null }, store);
    expect(cfg.company).toBeUndefined();
  });

  test('no company when company_id not found', () => {
    const cfg = buildEnriched({ id: 'l-5', name: 'Eve', company_id: 'co-99' }, store);
    expect(cfg.company).toBeUndefined();
  });

  test('does not cross-pollinate other companies', () => {
    const cfg = buildEnriched(l2, store);
    expect(cfg.companyContacts.map(c => c.id)).not.toContain('l-3');
    expect(cfg.companyContacts.map(c => c.id)).toContain('l-1');
  });
});
