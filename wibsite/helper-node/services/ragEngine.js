const crypto = require('crypto');
const axios = require('axios');
const path = require('path');

const WEAVIATE_URL = process.env.WEAVIATE_URL || 'http://weaviate:8080';
const WEAVIATE_CLASS = 'KnowledgeBase';
const WEAVIATE_TIMEOUT_MS = parseInt(process.env.WEAVIATE_TIMEOUT_MS || '800', 10);

let weaviateAvailable = false;

async function checkWeaviateHealth() {
  try {
    const resp = await axios.get(`${WEAVIATE_URL}/v1/.well-known/ready`, { timeout: WEAVIATE_TIMEOUT_MS });
    weaviateAvailable = resp.status === 200;
  } catch (e) {
    weaviateAvailable = false;
  }
  return weaviateAvailable;
}

async function ensureWeaviateSchema() {
  if (!weaviateAvailable) return false;
  try {
    const resp = await axios.get(`${WEAVIATE_URL}/v1/schema`, { timeout: WEAVIATE_TIMEOUT_MS });
    const exists = resp.data?.classes?.some(c => c.class === WEAVIATE_CLASS);
    if (exists) return true;

    await axios.post(`${WEAVIATE_URL}/v1/schema`, {
      class: WEAVIATE_CLASS,
      description: 'Knowledge base documents for Wibsite Business RAG',
      properties: [
        { name: 'tenantId', dataType: ['string'], description: 'Tenant identifier' },
        { name: 'title', dataType: ['text'], description: 'Document title' },
        { name: 'content', dataType: ['text'], description: 'Document content' },
        { name: 'source', dataType: ['string'], description: 'Source filename' },
        { name: 'contentType', dataType: ['string'], description: 'MIME type' },
        { name: 'tags', dataType: ['string[]'], description: 'Search tags' },
        { name: 'chunkIndex', dataType: ['int'], description: 'Chunk number for large docs' },
        { name: 'createdAt', dataType: ['date'], description: 'Creation timestamp' },
      ],
      vectorizer: 'none',
    }, { timeout: WEAVIATE_TIMEOUT_MS });
    return true;
  } catch (e) {
    console.error('Weaviate schema error:', e.message);
    return false;
  }
}

function chunkDocument(text, maxChunkSize = 2000) {
  const chunks = [];
  const paragraphs = text.split('\n\n');
  let currentChunk = '';
  for (const para of paragraphs) {
    if ((currentChunk + '\n\n' + para).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

async function addDocument(tenantId, title, content, source, contentType, tags = []) {
  await checkWeaviateHealth();
  if (!weaviateAvailable) return { error: 'Weaviate not available', fallback: 'memory' };

  await ensureWeaviateSchema();
  const chunks = chunkDocument(content);
  const docIds = [];
  const errors = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const resp = await axios.post(`${WEAVIATE_URL}/v1/objects`, {
        class: WEAVIATE_CLASS,
        properties: {
          tenantId: tenantId || 'default',
          title: i === 0 ? title : `${title} (parte ${i + 1})`,
          content: chunks[i],
          source: source || '',
          contentType: contentType || 'text/plain',
          tags: tags || [],
          chunkIndex: i,
          createdAt: new Date().toISOString(),
        },
      }, { timeout: WEAVIATE_TIMEOUT_MS });
      docIds.push(resp.data?.id);
    } catch (e) {
      errors.push({ chunk: i, error: e.message });
    }
  }

  return { documentIds: docIds, chunks: chunks.length, errors };
}

async function queryKnowledgeBase(tenantId, queryText, limit = 5) {
  await checkWeaviateHealth();
  if (!weaviateAvailable) return { results: [], weaviateAvailable: false };

  let results;
  try {
    const nearTextResp = await axios.get(`${WEAVIATE_URL}/v1/objects`, {
      params: {
        class: WEAVIATE_CLASS,
        where: JSON.stringify({
          operator: 'Equal', path: ['tenantId'], valueString: tenantId || 'default',
        }),
        limit,
        sort: JSON.stringify([{ path: ['createdAt'], order: 'desc' }]),
      },
      timeout: WEAVIATE_TIMEOUT_MS,
    });
    results = nearTextResp.data?.objects || [];
  } catch (e) {
    return { results: [], error: e.message, weaviateAvailable: true };
  }

  const docs = results.map(obj => ({
    id: obj.id,
    title: obj.properties?.title || '',
    content: obj.properties?.content || '',
    source: obj.properties?.source || '',
    tags: obj.properties?.tags || [],
    chunkIndex: obj.properties?.chunkIndex,
    createdAt: obj.properties?.createdAt,
  }));

  return { results: docs, total: docs.length, query: queryText, weaviateAvailable: true };
}

async function deleteDocument(tenantId, documentId) {
  await checkWeaviateHealth();
  if (!weaviateAvailable) return { error: 'Weaviate not available' };

  try {
    await axios.delete(`${WEAVIATE_URL}/v1/objects/${WEAVIATE_CLASS}/${documentId}`, { timeout: WEAVIATE_TIMEOUT_MS });
    return { status: 'deleted', documentId };
  } catch (e) {
    return { error: e.message };
  }
}

async function listDocuments(tenantId) {
  await checkWeaviateHealth();
  if (!weaviateAvailable) return { documents: [], weaviateAvailable: false };

  try {
    const resp = await axios.get(`${WEAVIATE_URL}/v1/objects`, {
      params: {
        class: WEAVIATE_CLASS,
        where: JSON.stringify({
          operator: 'Equal', path: ['tenantId'], valueString: tenantId || 'default',
        }),
        limit: 100,
      },
      timeout: WEAVIATE_TIMEOUT_MS,
    });
    const docs = (resp.data?.objects || []).map(obj => ({
      id: obj.id,
      title: obj.properties?.title || '',
      source: obj.properties?.source || '',
      tags: obj.properties?.tags || [],
      chunkIndex: obj.properties?.chunkIndex,
      contentType: obj.properties?.contentType,
      createdAt: obj.properties?.createdAt,
    }));
    return { documents: docs, total: docs.length, weaviateAvailable: true };
  } catch (e) {
    return { documents: [], error: e.message, weaviateAvailable: true };
  }
}

const inMemoryKB = new Map();

function addInMemoryDocument(tenantId, title, content, source) {
  const docId = crypto.randomUUID();
  const doc = { id: docId, tenantId, title, content, source, createdAt: new Date().toISOString() };
  const key = `${tenantId}:${docId}`;
  inMemoryKB.set(key, doc);
  return { documentId: docId, fallback: true };
}

function queryInMemoryKB(tenantId, queryText, limit = 5) {
  const terms = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const results = [];
  for (const [key, doc] of inMemoryKB.entries()) {
    if (!key.startsWith(`${tenantId}:`)) continue;
    const content = doc.content.toLowerCase();
    const matchCount = terms.filter(t => content.includes(t)).length;
    if (matchCount > 0) {
      results.push({ ...doc, relevance: matchCount / terms.length });
    }
  }
  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, limit);
}

module.exports = {
  checkWeaviateHealth, ensureWeaviateSchema, addDocument, queryKnowledgeBase,
  deleteDocument, listDocuments, addInMemoryDocument, queryInMemoryKB,
  chunkDocument,
};
