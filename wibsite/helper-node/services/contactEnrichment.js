'use strict';

const fs = require('fs');
const path = require('path');

const ENRICHMENT_DIR = path.join(__dirname, '..', 'data', 'enrichment');
if (!fs.existsSync(ENRICHMENT_DIR)) fs.mkdirSync(ENRICHMENT_DIR, { recursive: true });

const ENRICHMENT_SOURCES = {
  phone_lookup: { name: 'Phone Lookup', type: 'api', reliability: 0.85, cost_per_query: 0.01 },
  email_validation: { name: 'Email Validation', type: 'api', reliability: 0.90, cost_per_query: 0.005 },
  social_profile: { name: 'Social Profile', type: 'scrape', reliability: 0.70, cost_per_query: 0 },
  company_db: { name: 'Company Database', type: 'api', reliability: 0.80, cost_per_query: 0.02 },
  domain_whois: { name: 'Domain WHOIS', type: 'api', reliability: 0.75, cost_per_query: 0.01 },
};

class ContactEnrichment {
  constructor() {
    this.sources = ENRICHMENT_SOURCES;
    this.cache = this._loadCache();
  }

  async enrichContact(leadId, contactData, sources = null) {
    const startTime = Date.now();
    const activeSources = sources || Object.keys(this.sources);
    const results = { lead_id: leadId, enrichments: [], enriched_fields: {}, cached: 0, api_calls: 0, cost: 0 };

    for (const sourceId of activeSources) {
      const source = this.sources[sourceId];
      if (!source) continue;

      const cacheKey = `${leadId}:${sourceId}`;
      if (this.cache[cacheKey]) {
        results.enrichments.push({ source: sourceId, status: 'cached', data: this.cache[cacheKey] });
        results.cached++;
        continue;
      }

      try {
        const enriched = await this._querySource(sourceId, contactData);
        this.cache[cacheKey] = enriched;
        results.enrichments.push({ source: sourceId, status: 'enriched', data: enriched });
        results.api_calls++;
        results.cost += source.cost_per_query;
        Object.assign(results.enriched_fields, enriched);
      } catch (e) {
        results.enrichments.push({ source: sourceId, status: 'error', error: e.message });
      }
    }

    results.duration_ms = Date.now() - startTime;
    this._saveCache();
    return results;
  }

  enrichBulk(leads, sources = null) {
    const results = [];
    for (const lead of leads) {
      results.push({ lead_id: lead.id, sync: this._enrichSync(lead, sources) });
    }
    return {
      total: leads.length,
      enriched: results.filter(r => r.sync.status === 'enriched').length,
      cached: results.filter(r => r.sync.status === 'cached').length,
      errors: results.filter(r => r.sync.status === 'error').length,
      total_cost: results.reduce((sum, r) => sum + (r.sync.cost || 0), 0),
      results,
    };
  }

  _enrichSync(lead, sources) {
    const activeSources = sources || Object.keys(this.sources);
    const enriched = {};
    let cost = 0;
    for (const sourceId of activeSources) {
      const source = this.sources[sourceId];
      if (!source) continue;
      const cacheKey = `${lead.id}:${sourceId}`;
      if (this.cache[cacheKey]) {
        Object.assign(enriched, this.cache[cacheKey]);
        continue;
      }
      try {
        const data = this._querySourceSync(sourceId, lead);
        this.cache[cacheKey] = data;
        Object.assign(enriched, data);
        cost += source.cost_per_query;
      } catch (e) { /* skip */ }
    }
    this._saveCache();
    return { status: Object.keys(enriched).length > 0 ? 'enriched' : 'no_data', enriched_fields: enriched, cost };
  }

  async _querySource(sourceId, contactData) {
    return this._querySourceSync(sourceId, contactData);
  }

  _querySourceSync(sourceId, contactData) {
    const enriched = {};
    switch (sourceId) {
      case 'phone_lookup':
        if (contactData.phone) {
          enriched.carrier = this._detectCarrier(contactData.phone);
          enriched.phone_type = 'mobile';
          enriched.phone_valid = true;
        }
        break;
      case 'email_validation':
        if (contactData.email) {
          enriched.email_valid = contactData.email.includes('@');
          enriched.email_domain = contactData.email.split('@')[1];
          enriched.email_disposable = this._isDisposableEmail(contactData.email);
        }
        break;
      case 'social_profile':
        enriched.social_profiles = [];
        break;
      case 'company_db':
        if (contactData.company || contactData.custom_fields?.company) {
          enriched.company_name = contactData.company || contactData.custom_fields.company;
          enriched.company_size = 'unknown';
          enriched.company_industry = 'unknown';
        }
        break;
      case 'domain_whois':
        if (contactData.email) {
          const domain = contactData.email.split('@')[1];
          enriched.domain = domain;
          enriched.domain_age_days = Math.floor(Math.random() * 3650) + 365;
        }
        break;
    }
    return enriched;
  }

  _detectCarrier(phone) {
    const carriers = ['Telcel', 'AT&T', 'Movistar', 'Nextel', 'Unefon'];
    return carriers[Math.floor(Math.random() * carriers.length)];
  }

  _isDisposableEmail(email) {
    const disposable = ['tempmail.com', 'throwaway.com', 'guerrillamail.com', 'mailinator.com'];
    const domain = email.split('@')[1];
    return disposable.includes(domain);
  }

  getEnrichmentSources() {
    return Object.entries(this.sources).map(([id, s]) => ({ id, ...s }));
  }

  getCacheStats() {
    const keys = Object.keys(this.cache);
    return { cached_entries: keys.length, sources_used: [...new Set(keys.map(k => k.split(':')[1]))] };
  }

  clearCache() {
    this.cache = {};
    this._saveCache();
  }

  _loadCache() {
    const file = path.join(ENRICHMENT_DIR, 'cache.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    return {};
  }

  _saveCache() {
    fs.writeFileSync(path.join(ENRICHMENT_DIR, 'cache.json'), JSON.stringify(this.cache, null, 2));
  }
}

module.exports = { ContactEnrichment, ENRICHMENT_SOURCES };
