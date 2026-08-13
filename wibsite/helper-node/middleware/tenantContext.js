/**
 * tenantContext.js — Multi-Tenant Context Middleware
 * 
 * Detecta el tenant actual del request basándose en:
 * 1. Header X-Tenant-ID (para APIs internas)
 * 2. Header X-Remote-User (inyectado por Authelia/Nginx SSO)
 * 3. JWT de Authelia (si se proporciona Bearer token)
 * 4. Fallback al tenant 'default' para compatibilidad
 * 
 * Una vez detectado el tenant, configura SET LOCAL app.tenant_id en PostgreSQL
 * para que las políticas RLS filtren automáticamente.
 */

'use strict';

// Cache de slug→uuid para evitar queries repetidas
const tenantCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Resuelve el UUID del tenant desde su slug usando la DB.
 * Usa un cache en memoria para reducir queries.
 */
function withTimeout(promiseFactory, timeoutMs) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), timeoutMs);
    promiseFactory().then((value) => {
      clearTimeout(timeout);
      resolve(value);
    }).catch(() => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

async function resolveTenantId(pool, slugOrEmail) {
  if (!pool || !slugOrEmail) return null;
  if (slugOrEmail === 'default') return 'default';

  const cacheKey = slugOrEmail.toLowerCase();
  const cached = tenantCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    return cached.id;
  }

  try {
    // Buscar por slug directo
    let result = await withTimeout(() => pool.query(
      'SELECT id FROM platform_tenants WHERE slug = $1 AND is_active = true LIMIT 1',
      [cacheKey]
    ), 750);

    if (!result) return null;

    // Si no encontró por slug, buscar por email de usuario
    if (!result.rows.length && cacheKey.includes('@')) {
      result = await withTimeout(() => pool.query(
        `SELECT pt.id 
         FROM platform_tenants pt
         JOIN platform_users pu ON pu.tenant_id = pt.id
         WHERE LOWER(pu.email) = $1 AND pt.is_active = true AND pu.is_active = true
         LIMIT 1`,
        [cacheKey]
      ), 750);
    }

    if (!result) return null;

    if (result.rows.length) {
      const id = result.rows[0].id;
      tenantCache.set(cacheKey, { id, ts: Date.now() });
      return id;
    }
  } catch (e) {
    console.warn('[tenantContext] DB lookup failed:', e.message);
  }
  return null;
}

/**
 * Obtiene el tenant 'default' (siempre disponible como fallback).
 */
async function getDefaultTenantId(pool) {
  return process.env.DEFAULT_TENANT_ID || 'default';
}

/**
 * Middleware principal de contexto de tenant.
 * 
 * Adjunta req.tenantId y (si hay pool) configura app.tenant_id en la sesión PG.
 */
function createTenantContextMiddleware(pool) {
  return async function tenantContextMiddleware(req, res, next) {
    let tenantId = null;
    let tenantSource = 'none';

    try {
      // 1. Header X-Tenant-ID (APIs internas, n8n, etc.)
      const headerTenantId = req.headers['x-tenant-id'];
      if (headerTenantId) {
        // Puede ser un UUID directo o un slug
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerTenantId);
        if (isUuid) {
          tenantId = headerTenantId;
          tenantSource = 'x-tenant-id-uuid';
        } else {
          tenantId = await resolveTenantId(pool, headerTenantId);
          tenantSource = 'x-tenant-id-slug';
        }
      }

      // 2. Header X-Remote-User inyectado por Authelia (email del usuario SSO)
      if (!tenantId) {
        const remoteUser = req.headers['x-remote-user'] || req.headers['x-forwarded-user'];
        if (remoteUser) {
          tenantId = await resolveTenantId(pool, remoteUser);
          tenantSource = 'authelia-remote-user';
        }
      }

      // 3. Fallback al tenant 'default'
      if (!tenantId) {
        tenantId = await getDefaultTenantId(pool);
        tenantSource = 'default-fallback';
      }

    } catch (e) {
      console.warn('[tenantContext] Error resolving tenant:', e.message);
    }

    // Adjuntar al request para uso en los handlers
    req.tenantId = tenantId || null;
    req.tenantSource = tenantSource;

    // Limpiar cache periódicamente (cada 1000 requests)
    if (Math.random() < 0.001) {
      const now = Date.now();
      for (const [key, val] of tenantCache.entries()) {
        if (now - val.ts > CACHE_TTL_MS) tenantCache.delete(key);
      }
    }

    next();
  };
}

/**
 * Helper para ejecutar una query con contexto de tenant usando SET LOCAL.
 * Usar dentro de una transacción para que SET LOCAL tenga efecto.
 * 
 * @param {pg.Pool} pool - Pool de PostgreSQL
 * @param {string} tenantId - UUID del tenant
 * @param {string} sql - Query SQL
 * @param {Array} params - Parámetros de la query
 */
async function queryWithTenant(pool, tenantId, sql, params = []) {
  if (!pool) return { rows: [], rowCount: 0 };
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (tenantId) {
      await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
    }
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Helper para obtener el tenant_id del request (con fallback a null).
 */
function getTenantId(req) {
  return req.tenantId || null;
}

/**
 * Invalida la cache para un tenant o usuario específico.
 */
function invalidateTenantCache(slugOrEmail) {
  if (slugOrEmail) {
    tenantCache.delete(slugOrEmail.toLowerCase());
  } else {
    tenantCache.clear();
  }
}

module.exports = {
  createTenantContextMiddleware,
  queryWithTenant,
  getTenantId,
  invalidateTenantCache,
};
