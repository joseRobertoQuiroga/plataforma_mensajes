'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'tenants');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const HIERARCHY = ['platform', 'tenant', 'branch', 'user'];
const HIERARCHY_DEPTH = HIERARCHY.length;

class TenantHierarchy {
  constructor() {
    this._cache = new Map();
  }

  createPlatform(data) {
    return this._create('platform', null, {
      name: data.name || 'Wibsite Platform',
      plan_id: data.plan_id || 'enterprise',
      limits: data.limits || { max_tenants: 100, max_branches: 1000, max_users: 10000, max_leads: 100000, max_messages_day: 1000000 },
      settings: data.settings || {},
      created_at: new Date().toISOString(),
    });
  }

  createTenant(platformId, data) {
    const platform = this._load('platform', platformId);
    if (!platform) throw new Error(`Platform ${platformId} not found`);
    if (platform.children && platform.children.length >= (platform.limits?.max_tenants || 100)) {
      throw new Error('Tenant limit reached for this platform');
    }
    return this._create('tenant', platformId, {
      name: data.name || 'Tenant',
      slug: data.slug || data.name?.toLowerCase().replace(/\s+/g, '-') || 'tenant',
      plan_id: data.plan_id || 'blue',
      limits: data.limits || { max_branches: 10, max_users: 50, max_leads: 5000, max_messages_day: 50000 },
      settings: data.settings || {},
      created_at: new Date().toISOString(),
    });
  }

  createBranch(tenantId, data) {
    const tenant = this._load('tenant', tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    if (tenant.children && tenant.children.length >= (tenant.limits?.max_branches || 10)) {
      throw new Error('Branch limit reached for this tenant');
    }
    return this._create('branch', tenantId, {
      name: data.name || 'Branch',
      code: data.code || `BR-${Date.now()}`,
      address: data.address || '',
      timezone: data.timezone || 'America/Mexico_City',
      limits: data.limits || { max_users: 20, max_leads: 2000, max_messages_day: 20000 },
      settings: data.settings || {},
      created_at: new Date().toISOString(),
    });
  }

  createUser(branchId, data) {
    const branch = this._load('branch', branchId);
    if (!branch) throw new Error(`Branch ${branchId} not found`);
    if (branch.children && branch.children.length >= (branch.limits?.max_users || 20)) {
      throw new Error('User limit reached for this branch');
    }
    return this._create('user', branchId, {
      name: data.name || 'User',
      email: data.email,
      role: data.role || 'agent',
      limits: { max_leads: 500, max_messages_day: 2000 },
      created_at: new Date().toISOString(),
    });
  }

  get(id) {
    const parts = id.split(':');
    if (parts.length < 2) return null;
    const type = parts[0];
    if (!HIERARCHY.includes(type)) return null;
    return this._load(type, id);
  }

  getAncestors(id) {
    const ancestors = [];
    let current = this.get(id);
    while (current && current.parent_id) {
      const parent = this.get(current.parent_id);
      if (parent) {
        ancestors.unshift(parent);
        current = parent;
      } else break;
    }
    return ancestors;
  }

  getDescendants(id) {
    const entity = this.get(id);
    if (!entity) return [];
    const descendants = [];
    const stack = [entity];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current.children) {
        for (const childId of current.children) {
          const child = this.get(childId);
          if (child) {
            descendants.push(child);
            stack.push(child);
          }
        }
      }
    }
    return descendants;
  }

  getTenantForUser(userId) {
    const ancestors = this.getAncestors(userId);
    return ancestors.find(a => a.type === 'tenant');
  }

  getBranchForUser(userId) {
    const ancestors = this.getAncestors(userId);
    return ancestors.find(a => a.type === 'branch');
  }

  list(type) {
    if (!HIERARCHY.includes(type)) return [];
    const dir = path.join(DATA_DIR, type);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        return data;
      });
  }

  delete(id) {
    const entity = this.get(id);
    if (!entity) return false;
    const file = path.join(DATA_DIR, entity.type, `${entity.id.replace(/:/g, '-')}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    this._cache.delete(id);
    if (entity.parent_id) {
      const parent = this.get(entity.parent_id);
      if (parent && parent.children) {
        parent.children = parent.children.filter(c => c !== id);
        this._save(parent);
      }
    }
    return true;
  }

  _create(type, parentId, data) {
    const id = `${type}:${data.slug || Date.now()}`;
    const entity = {
      id,
      type,
      parent_id: parentId,
      children: [],
      ...data,
    };
    if (parentId) {
      const parent = this.get(parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(id);
        this._save(parent);
      }
    }
    this._save(entity);
    return entity;
  }

  _save(entity) {
    const dir = path.join(DATA_DIR, entity.type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${entity.id.replace(/:/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(entity, null, 2));
    this._cache.set(entity.id, entity);
  }

  _load(type, id) {
    if (this._cache.has(id)) return this._cache.get(id);
    const file = path.join(DATA_DIR, type, `${id.replace(/:/g, '-')}.json`);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    this._cache.set(id, data);
    return data;
  }
}

function tenantMiddleware(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id || null;
  if (tenantId) {
    const hierarchy = new TenantHierarchy();
    const entity = hierarchy.get(tenantId);
    if (!entity) return res.status(404).json({ error: 'Tenant not found' });
    req.tenant = entity;
    req.tenant_id = tenantId;
    const ancestors = hierarchy.getAncestors(tenantId);
    req.tenant_path = ancestors.map(a => a.id).concat([tenantId]);
  }
  next();
}

module.exports = {
  TenantHierarchy,
  tenantMiddleware,
  HIERARCHY,
  HIERARCHY_DEPTH,
};
