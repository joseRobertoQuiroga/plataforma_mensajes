const fs = require('fs');
const path = require('path');
const pgStore = require('./pgStore');
const { logEvent } = require('./auditLogger');

const STORE_MODE = (process.env.STORE_MODE || 'dual').toLowerCase();
const DB_PATH = path.join(__dirname, '..', 'wibsite-store.json');
let storeCache = null;
let storeCacheTime = 0;
const CACHE_TTL = 200;
let storeLock = Promise.resolve();

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
  storeCache = { campaigns: [], deliveries: [], optOuts: [], leads: [], scores: [], channels: [] };
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
    }
  } catch (e) {
    console.error(`PG write failed (${storeType}/${operation}):`, e.message);
    logEvent('error', { message: `PG write failed: ${storeType}/${operation}`, error: e.message });
  }
}

module.exports = {
  getStore() {
    if (STORE_MODE === 'pg') return { campaigns: [], deliveries: [], optOuts: [], leads: [], scores: [], channels: [] };
    return loadJsonStore();
  },
  updateStore(mutator) {
    if (STORE_MODE === 'pg') return Promise.resolve();
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
  getStoreMode() { return STORE_MODE; },
  initPgStore(pool) { pgStore.initPgStore(pool); },
  pgStore
};
