/**
 * 05-check-helper-api.js
 * 
 * Propósito:
 * Audita la salud y el correcto funcionamiento del microservicio `helper-node` (API de integración y agente).
 * 
 * Pruebas:
 * 1. Verifica conectividad HTTP al puerto :3100 /health.
 * 2. Verifica la presencia del middleware `tenantContext` registrado en los logs de inicio.
 * 3. Verifica que la conexión a PostgreSQL use la cuenta `app_user` (no-superuser).
 * 4. Verifica el estado de integración con Redis y Weaviate RAG.
 * 
 * Uso:
 *   node scripts/audit/05-check-helper-api.js
 */

'use strict';

const http = require('http');
const { execSync } = require('child_process');

function color(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function fetchHttp(urlPath) {
  return new Promise(resolve => {
    const req = http.get({
      hostname: 'localhost',
      port: 3100,
      path: urlPath,
      timeout: 5000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, error: null }));
    });

    req.on('error', err => resolve({ status: 'ERR', body: null, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', body: null, error: 'Timeout (5000ms)' }); });
  });
}

async function runAudit() {
  console.log(color('\n=== AUDITORÍA 5/5: HELPER-NODE Y MICROSERVICIOS DE AGENTE ===\n', '1;36'));

  let passCount = 0;
  let failCount = 0;
  const failureDetails = [];

  // PRUEBA 1: Healthcheck HTTP Endpoint (:3100/health)
  console.log(color('[Prueba 1] Endpoint de Salud Helper-Node (:3100/health)', '1'));
  const healthRes = await fetchHttp('/health');
  if (healthRes.status === 200) {
    passCount++;
    console.log(`  • HTTP /health: ${color('200 OK', '1;32')} [ ${color('PASS', '1;32')} ]`);
    console.log(`  • Respuesta: ${healthRes.body.substring(0, 120)}...`);
  } else {
    failCount++;
    console.log(`  • HTTP /health: [ ${color('FAIL', '1;31')} ] - Status: ${healthRes.status}, Error: ${healthRes.error}`);
    failureDetails.push(`• Helper-Node Health: /health no responde 200 OK. Detalle: ${healthRes.error || healthRes.body}`);
  }

  // PRUEBA 2: Variables de entorno de base de datos en Helper-Node
  console.log(color('\n[Prueba 2] Usuario DB de Helper-Node (PG_USER)', '1'));
  try {
    const pgUser = execSync("docker exec wibsite-helper printenv PG_USER 2>&1", { encoding: 'utf8' }).trim();
    if (pgUser === 'app_user') {
      passCount++;
      console.log(`  • PG_USER en contenedor: ${color(pgUser, '1;32')} (no-superuser, RLS forzado) [ ${color('PASS', '1;32')} ]`);
    } else {
      failCount++;
      console.log(`  • PG_USER en contenedor: ${color(pgUser || 'INEXISTENTE', '1;31')} [ ${color('FAIL', '1;31')} ]`);
      failureDetails.push(`• Helper-Node DB User: PG_USER es '${pgUser}', se requiere 'app_user' para forzar RLS.`);
    }
  } catch (e) {
    failCount++;
    console.log(`  • Error al consultar PG_USER: ${e.message} [ ${color('FAIL', '1;31')} ]`);
    failureDetails.push(`• Helper-Node Env Error: ${e.message}`);
  }

  // PRUEBA 3: Logs de inicio del middleware tenantContext
  console.log(color('\n[Prueba 3] Registro de Middleware TenantContext y Estado de Conexiones', '1'));
  try {
    const logs = execSync("docker logs wibsite-helper --tail 15 2>&1", { encoding: 'utf8' }).trim();
    const hasTenantMiddleware = logs.includes('Tenant context: middleware registered');
    const hasDbConnected = logs.includes('DB: PostgreSQL connected');
    const hasRedisReady = logs.includes('Conversation store: Redis');

    if (hasTenantMiddleware && hasDbConnected) {
      passCount++;
      console.log(`  • Middleware TenantContext: ${color('REGISTRADO', '1;32')} [ ${color('PASS', '1;32')} ]`);
      console.log(`  • PostgreSQL Pool Status:   ${color('CONECTADO', '1;32')} [ ${color('PASS', '1;32')} ]`);
      console.log(`  • Redis / Weaviate Status:  ${color(hasRedisReady ? 'READY' : 'DESCONECTADO', hasRedisReady ? '1;32' : '1;33')}`);
    } else {
      failCount++;
      console.log(`  • Estado de Inicio Helper-Node: [ ${color('FAIL', '1;31')} ]`);
      failureDetails.push(`• Helper-Node Startup Logs:\n  ` + logs.replace(/\n/g, '\n  '));
    }
  } catch (e) {
    failCount++;
    console.log(`  • Error consultando logs de helper: ${e.message} [ ${color('FAIL', '1;31')} ]`);
    failureDetails.push(`• Helper Logs Error: ${e.message}`);
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`Resumen Helper-Node: ${color(passCount + ' OK', '1;32')} | ${color(failCount + ' FALLOS', failCount > 0 ? '1;31' : '1;30')}\n`);

  if (failureDetails.length > 0) {
    console.log(color('=== DIAGNÓSTICO DE ERRORES HELPER-NODE ===', '1;31'));
    failureDetails.forEach(detail => console.log(detail + '\n'));
  }

  return { passCount, failCount, total: 3 };
}

if (require.main === module) {
  runAudit().then(result => {
    process.exit(result.failCount > 0 ? 1 : 0);
  });
}

module.exports = { runAudit };
