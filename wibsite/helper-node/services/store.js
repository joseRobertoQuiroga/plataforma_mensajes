const fs = require('fs');
const path = require('path');
const pgStore = require('./pgStore');
const { logEvent } = require('./auditLogger');

const STORE_MODE = (process.env.STORE_MODE || 'dual').toLowerCase();
const DB_PATH = process.env.STORE_PATH || path.join(__dirname, '..', 'wibsite-store.json');
let storeCache = null;
let storeCacheTime = 0;
const CACHE_TTL = 200;
const PG_SNAPSHOT_TTL = 5000;
let storeLock = Promise.resolve();

// Snapshot PG (modo pg): lectura unificada desde PostgreSQL con refresco por TTL
let pgSnapshot = { campaigns: [], deliveries: [], optOuts: [], leads: [], scores: [], companies: [], channels: [] };
let pgSnapshotTime = 0;
let pgSnapshotLoading = null;

async function loadPgSnapshot() {
  const now = Date.now();
  if (pgSnapshot && (now - pgSnapshotTime) < PG_SNAPSHOT_TTL) return pgSnapshot;
  if (pgSnapshotLoading) return pgSnapshotLoading;
  pgSnapshotLoading = (async () => {
    try {
      const [campaigns, leads, scores, optOuts, companies] = await Promise.all([
        pgStore.CampaignStore.findAll({ limit: 500 }),
        pgStore.LeadStore.findAll ? pgStore.LeadStore.findAll({ limit: 500 }) : Promise.resolve([]),
        pgStore.ScoreStore.findAll ? pgStore.ScoreStore.findAll({ limit: 500 }) : Promise.resolve([]),
        pgStore.OptOutStore.findAll ? pgStore.OptOutStore.findAll({ limit: 500 }) : Promise.resolve([]),
        pgStore.CompanyStore && pgStore.CompanyStore.findAll ? pgStore.CompanyStore.findAll({ limit: 500 }) : Promise.resolve([]),
      ]);
      pgSnapshot = {
        campaigns: campaigns || [],
        deliveries: [],
        optOuts: optOuts || [],
        leads: leads || [],
        scores: scores || [],
        companies: companies || [],
        channels: [],
      };
      pgSnapshotTime = now;
    } catch (e) {
      console.error('[store] PG snapshot error:', e.message);
    } finally {
      pgSnapshotLoading = null;
    }
    return pgSnapshot;
  })();
  return pgSnapshotLoading;
}

function refreshPgSnapshot() {
  pgSnapshotTime = 0;
  return loadPgSnapshot();
}

function loadJsonStore() {
  const now = Date.now();
  if (storeCache && (now - storeCacheTime) < CACHE_TTL) return storeCache;
  try {
    if (fs.existsSync(DB_PATH)) {
      storeCache = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      storeCacheTime = now;
      return storeCache;
    }
  } catch (e) { /* ignore */ }
  storeCache = { campaigns: [], deliveries: [], optOuts: [], leads: [], scores: [], companies: [], channels: [] };
  storeCacheTime = now;
  return storeCache;
}

function saveJsonStore(store) {
  storeCache = store;
  storeCacheTime = Date.now();
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function updateJsonStore(mutator) {
  storeLock = storeLock.then(() => {
    const store = loadJsonStore();
    mutator(store);
    saveJsonStore(store);
  }).catch(e => console.error('JSON store update error:', e.message));
  return storeLock;
}

async function writeToPg(storeType, operation, data) {
  try {
    switch (storeType) {
      case 'campaign':
        if (operation === 'create') await pgStore.CampaignStore.create(data);
        break;
      case 'lead':
        if (operation === 'create') {
          if (data.campaign_id) await pgStore.LeadStore.create(data.campaign_id, data);
        }
        break;
      case 'score':
        if (operation === 'create') await pgStore.ScoreStore.create(data);
        break;
      case 'optout':
        if (operation === 'create') await pgStore.OptOutStore.create(data);
        break;
      case 'company':
        if (operation === 'create') await pgStore.CompanyStore.create(data);
        break;
    }
  } catch (e) {
    console.error(`PG write failed (${storeType}/${operation}):`, e.message);
    logEvent('error', { message: `PG write failed: ${storeType}/${operation}`, error: e.message });
  }
}

module.exports = {
  getStore() {
    if (STORE_MODE === 'pg') {
      loadPgSnapshot().catch(() => {});
      return pgSnapshot;
    }
    return loadJsonStore();
  },
  updateStore(mutator) {
    if (STORE_MODE === 'pg') {
      storeLock = storeLock.then(() => {
        const store = pgSnapshot;
        mutator(store);
      }).catch(e => console.error('PG snapshot update error:', e.message));
      return storeLock;
    }
    return updateJsonStore(mutator);
  },
  async writeCampaign(data) {
    if (STORE_MODE !== 'json') await writeToPg('campaign', 'create', data);
    if (STORE_MODE !== 'pg') await updateJsonStore(store => store.campaigns.push(data));
  },
  async writeLead(campaignId, data) {
    if (STORE_MODE !== 'json') await writeToPg('lead', 'create', { campaign_id: campaignId, ...data });
    if (STORE_MODE !== 'pg') await updateJsonStore(store => store.leads.push(data));
  },
  async writeScore(data) {
    if (STORE_MODE !== 'json') await writeToPg('score', 'create', data);
    if (STORE_MODE !== 'pg') await updateJsonStore(store => store.scores.push(data));
  },
  async writeOptOut(data) {
    if (STORE_MODE !== 'json') await writeToPg('optout', 'create', data);
    if (STORE_MODE !== 'pg') await updateJsonStore(store => store.optOuts.push(data));
  },
  // Best-effort PG-only writes (el JSON ya fue actualizado por la ruta vÃ­a updateStore)
  async writeCampaignToPg(data) {
    if (STORE_MODE !== 'json') await writeToPg('campaign', 'create', data);
  },
  async writeLeadToPg(campaignId, data) {
    if (STORE_MODE !== 'json') await writeToPg('lead', 'create', { campaign_id: campaignId, ...data });
  },
  async writeScoreToPg(data) {
    if (STORE_MODE !== 'json') await writeToPg('score', 'create', data);
  },
  async writeOptOutToPg(data) {
    if (STORE_MODE !== 'json') await writeToPg('optout', 'create', data);
  },
  async writeCompany(data) {
    if (STORE_MODE !== 'json') await writeToPg('company', 'create', data);
    if (STORE_MODE !== 'pg') await updateJsonStore(store => store.companies.push(data));
  },
  async writeCompanyToPg(data) {
    if (STORE_MODE !== 'json') await writeToPg('company', 'create', data);
  },
  getStoreMode() { return STORE_MODE; },
  initPgStore(pool) {
    pgStore.initPgStore(pool);
    if (STORE_MODE === 'pg') loadPgSnapshot().catch(() => {});
  },
  refreshPgSnapshot,
  pgStore
};
