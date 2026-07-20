const { chunkDocument, addInMemoryDocument, queryInMemoryKB } = require('../services/ragEngine');

describe('RAG Engine - MVP-05: RAG básico', () => {
  test('chunkDocument divide texto largo en chunks', () => {
    const text = 'Párrafo uno.\n\nPárrafo dos.\n\nPárrafo tres.\n\nPárrafo cuatro.';
    const chunks = chunkDocument(text, 20);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  test('chunkDocument retorna un chunk para texto corto', () => {
    const text = 'Texto corto.';
    const chunks = chunkDocument(text, 2000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Texto corto.');
  });

  test('addInMemoryDocument almacena documento en fallback', () => {
    const result = addInMemoryDocument('test-tenant', 'Test Doc', 'Contenido de prueba', 'manual');
    expect(result.documentId).toBeDefined();
    expect(result.fallback).toBe(true);
  });

  test('queryInMemoryKB encuentra documentos relevantes', () => {
    addInMemoryDocument('test-tenant', 'Precios', 'Nuestros precios son competitivos. Zapatos desde $50.', 'manual');
    const results = queryInMemoryKB('test-tenant', 'precios zapatos');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Precios');
  });

  test('queryInMemoryKB retorna vacío para tenant sin docs', () => {
    const results = queryInMemoryKB('other-tenant', 'test');
    expect(results).toHaveLength(0);
  });

  test('queryInMemoryKB filtra por tenant', () => {
    addInMemoryDocument('tenant-a', 'Doc A', 'Contenido A', 'web');
    addInMemoryDocument('tenant-b', 'Doc B', 'Contenido B', 'web');

    const resultsA = queryInMemoryKB('tenant-a', 'contenido');
    expect(resultsA.length).toBeGreaterThan(0);
    resultsA.forEach(r => expect(r.tenantId).toBe('tenant-a'));
  });

  test('addInMemoryDocument con múltiples documentos', () => {
    addInMemoryDocument('test-tenant', 'Producto 1', 'Descripción del producto 1', 'manual');
    addInMemoryDocument('test-tenant', 'Producto 2', 'Descripción del producto 2', 'manual');
    const results = queryInMemoryKB('test-tenant', 'producto');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});
