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

function termMatches(content, term) {
  if (content.includes(term)) return true;
  if (term.length > 5 && content.includes(term.slice(0, -2))) return true;
  if (term.length > 4 && content.includes(term.slice(0, -1))) return true;
  return false;
}

function queryInMemoryKB(tenantId, queryText, limit = 5) {
  const terms = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const results = [];
  for (const [key, doc] of inMemoryKB.entries()) {
    if (!key.startsWith(`${tenantId}:`)) continue;
    const content = doc.content.toLowerCase();
    const matchCount = terms.filter(t => termMatches(content, t)).length;
    if (matchCount > 0) {
      results.push({ ...doc, relevance: matchCount / terms.length });
    }
  }
  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, limit);
}

async function syncDocuments(tenantId, source, options = {}) {
  /**
   * Sync knowledge base documents from an external source.
   * 
   * Supported sources:
   * - 'file': sync from local kb-documents folder
   * - 'api': sync from external API endpoint
   * 
   * Options:
   * - path: local file path (for 'file' source)
   * - url: API endpoint URL (for 'api' source)
   * - limit: max documents to sync
   * - verbose: log detailed information
   */
  const verbose = options.verbose !== false;
  const results = { synced: 0, failed: 0, updated: 0, errors: [] };
  let fallback = 'weaviate';

  try {
    fallback = 'memory';
    let documents = [];

    if (source === 'file') {
      const filePath = options.path || path.join(__dirname, '..', 'kb-documents');
      // Read all .txt files from the kb-documents directory
      const fs = require('fs');
      const files = fs.readdirSync(filePath).filter(f => f.endsWith('.txt'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(filePath, file), 'utf-8');
          const title = file.replace('.txt', '');
          const docResult = await addDocument(tenantId, title, content, file, 'text/plain', ['synced', source]);
          if (docResult.error) {
            results.failed++;
            results.errors.push({ file, error: docResult.error });
          } else {
            results.synced++;
            results.updated++;
          }
        } catch (e) {
          results.failed++;
          results.errors.push({ file, error: e.message });
        }
      }
    } else if (source === 'api') {
      const url = options.url;
      if (!url) {
        results.errors.push({ error: 'API URL is required for source=api' });
        return results;
      }
      try {
        const resp = await axios.get(url, { timeout: 30000 });
        const data = resp.data;
        // Support both array and object with documents property
        const docs = Array.isArray(data) ? data : (data.documents || []);
        for (const doc of docs) {
          try {
            const title = doc.title || 'Untitled';
            const content = doc.content || '';
            const sourceName = doc.source || url;
            const docResult = await addDocument(tenantId, title, content, sourceName, doc.contentType || 'text/plain', ['synced', source, ...(doc.tags || [])]);
            if (docResult.error) {
              results.failed++;
              results.errors.push({ doc: title, error: docResult.error });
            } else {
              results.synced++;
              results.updated++;
            }
          } catch (e) {
            results.failed++;
            results.errors.push({ doc: doc.title || 'unknown', error: e.message });
          }
        }
      } catch (e) {
        results.errors.push({ error: e.message });
        results.failed++;
      }
    } else {
      results.errors.push({ error: `Unknown source: ${source}. Supported: 'file', 'api'` });
    }

    // Audit log
    await logEvent('kb_sync', {
      level: 'info',
      message: `KB sync completed: ${results.synced} synced, ${results.failed} failed`,
      tenantId,
      module: 'knowledge-base',
      action: 'sync',
      data: { source, results, fallback },
    });

    if (verbose) {
      console.log(`[KB Sync] Source: ${source}, Synced: ${results.synced}, Failed: ${results.failed}, Updated: ${results.updated}`);
    }

    return results;
  } catch (e) {
    results.errors.push({ error: e.message });
    results.failed++;
    await logEvent('kb_sync', {
      level: 'error',
      message: `KB sync failed: ${e.message}`,
      tenantId,
      module: 'knowledge-base',
      action: 'sync',
      data: { source, error: e.message, fallback },
    });
    return results;
  }
}

module.exports = {
  checkWeaviateHealth, ensureWeaviateSchema, addDocument, queryKnowledgeBase,
  deleteDocument, listDocuments, syncDocuments, addInMemoryDocument, queryInMemoryKB,
  chunkDocument,
};
