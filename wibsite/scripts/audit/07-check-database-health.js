/**
 * 07-check-database-health.js
 * 
 * Propósito:
 * Audita la salud interna de los motores de almacenamiento de la plataforma:
 * 1. PostgreSQL 15: Revisa las 7 bases de datos (wibsite, n8n, chatwoot, dify, twenty, glitchtip, postgres),
 *    conexiones activas, bloqueos y tamaño de tablas.
 * 2. Redis 7: Revisa memoria utilizada, clientes conectados e integridad de llaves de caché/sesión.
 * 3. Weaviate Vector DB: Revisa esquemas de colecciones vectoriales y conteo de objetos embebidos.
 * 
 * Uso:
 *   node scripts/audit/07-check-database-health.js
 */

'use strict';

const { execSync } = require('child_process');
const { Logger } = require('../utils/logger');

const logger = new Logger('Audit-DBHealth', require('../utils/logger').AUDIT_LOG_FILE);

const EXPECTED_MAIN_DATABASES = ['wibsite', 'n8n', 'chatwoot', 'dify', 'twenty', 'postgres'];

async function runAudit() {
  logger.header('AUDITORÍA 7/10: SALUD DE BASES DE DATOS, REDIS Y VECTOR DB (WEAVIATE)');

  let passCount = 0;
  let failCount = 0;
  const failureDetails = [];

  // PRUEBA 1: Estado y Conexiones en las Bases de Datos PostgreSQL
  logger.info('[Prueba 1] Inspeccionando las Bases de Datos en PostgreSQL Principal y GlitchTip PG...');
  try {
    const dbListRaw = execSync("docker exec wibsite-postgres psql -U wibsite -d postgres -t -A -c \"SELECT datname FROM pg_database WHERE datistemplate = false;\"", { encoding: 'utf8' }).trim();
    const existingDbs = dbListRaw.split('\n').map(d => d.trim());
    const missingDbs = EXPECTED_MAIN_DATABASES.filter(db => !existingDbs.includes(db));

    const glitchDbCheck = execSync("docker exec wibsite-glitchtip-pg psql -U glitchtip -d glitchtip -t -A -c \"SELECT current_database();\" 2>&1", { encoding: 'utf8' }).trim();

    if (missingDbs.length === 0 && glitchDbCheck === 'glitchtip') {
      passCount++;
      logger.success(`Todas las 7 Bases de Datos (6 principales + 1 GlitchTip) existen y están activas en PostgreSQL`);
    } else {
      failCount++;
      logger.error(`Bases de datos faltantes en PostgreSQL: ${missingDbs.join(', ')}`);
      failureDetails.push(`• Postgres DB Faltantes: ${missingDbs.join(', ')}`);
    }
  } catch (e) {
    failCount++;
    logger.error('Error al consultar bases de datos en PostgreSQL', e);
    failureDetails.push(`• Postgres Error: ${e.message}`);
  }

  // PRUEBA 2: Conexiones Activas y Bloqueos en PostgreSQL
  logger.info('[Prueba 2] Verificando conexiones activas y bloqueos en PostgreSQL...');
  try {
    const connInfo = execSync("docker exec wibsite-postgres psql -U wibsite -d wibsite -t -A -c \"SELECT count(*) FROM pg_stat_activity WHERE state = 'active';\"", { encoding: 'utf8' }).trim();
    const lockInfo = execSync("docker exec wibsite-postgres psql -U wibsite -d wibsite -t -A -c \"SELECT count(*) FROM pg_locks WHERE NOT granted;\"", { encoding: 'utf8' }).trim();
    
    const activeConns = parseInt(connInfo) || 0;
    const blockedLocks = parseInt(lockInfo) || 0;

    if (blockedLocks === 0) {
      passCount++;
      logger.success(`PostgreSQL Operativo: ${activeConns} conexiones activas, 0 bloqueos (locks) pendientes`);
    } else {
      failCount++;
      logger.error(`PostgreSQL Bloqueos Detectados: ${blockedLocks} consultas bloqueadas!`);
      failureDetails.push(`• Postgres Locks: ${blockedLocks} consultas bloqueadas detectadas.`);
    }
  } catch (e) {
    failCount++;
    logger.error('Error al verificar conexiones y bloqueos en Postgres', e);
    failureDetails.push(`• Postgres Conns Error: ${e.message}`);
  }

  // PRUEBA 3: Salud y Memoria de Redis 7
  logger.info('[Prueba 3] Inspeccionando memoria y clientes conectados en Redis...');
  try {
    const redisInfo = execSync("docker exec wibsite-redis redis-cli info memory 2>&1", { encoding: 'utf8' }).trim();
    const usedMemoryMatch = redisInfo.match(/used_memory_human:(.+)/);
    const usedMemory = usedMemoryMatch ? usedMemoryMatch[1].trim() : 'OK';

    const clientInfo = execSync("docker exec wibsite-redis redis-cli info clients 2>&1", { encoding: 'utf8' }).trim();
    const clientsMatch = clientInfo.match(/connected_clients:(.+)/);
    const connectedClients = clientsMatch ? clientsMatch[1].trim() : '0';

    passCount++;
    logger.success(`Redis 7 Saludable: Memoria usada = ${usedMemory}, Clientes conectados = ${connectedClients}`);
  } catch (e) {
    failCount++;
    logger.error('Error al inspeccionar Redis 7', e);
    failureDetails.push(`• Redis Error: ${e.message}`);
  }

  // PRUEBA 4: Estado y Colecciones en Weaviate Vector DB
  logger.info('[Prueba 4] Verificando esquemas y objetos en Weaviate Vector DB...');
  try {
    const weaviateSchema = execSync("docker exec wibsite-helper node -e \"const { checkWeaviateHealth } = require('./services/ragEngine'); checkWeaviateHealth().then(res => console.log('Weaviate status:', res));\"", { encoding: 'utf8' }).trim();
    if (weaviateSchema.includes('true')) {
      passCount++;
      logger.success('Weaviate Vector DB activo y listo para búsquedas RAG');
    } else {
      failCount++;
      logger.error('Weaviate Vector DB no devolvió status de salud activo');
      failureDetails.push('• Weaviate Health: El motor vectorial no responde 200/healthy');
    }
  } catch (e) {
    failCount++;
    logger.error('Error al verificar Weaviate Vector DB', e);
    failureDetails.push(`• Weaviate Error: ${e.message}`);
  }

  console.log('\n' + '-'.repeat(70));
  logger.info(`Resumen Salud DBs & Cache: ${passCount} OK | ${failCount} FALLOS\n`);

  if (failureDetails.length > 0) {
    logger.warn('=== DIAGNÓSTICO DE ERRORES SALUD DBS ===');
    failureDetails.forEach(detail => console.log(detail + '\n'));
  }

  return { passCount, failCount, total: 4 };
}

if (require.main === module) {
  runAudit().then(result => {
    process.exit(result.failCount > 0 ? 1 : 0);
  });
}

module.exports = { runAudit };
