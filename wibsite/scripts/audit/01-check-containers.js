/**
 * 01-check-containers.js
 * 
 * Propósito:
 * Audita el estado de los 23 contenedores Docker de la plataforma Wibsite.
 * Verifica que todos estén en estado 'Up' (running) y 'healthy' si tienen healthcheck.
 * Muestra alertas detalladas y los últimos logs en caso de fallas o reinicios.
 * 
 * Uso:
 *   node scripts/audit/01-check-containers.js
 */

'use strict';

const { execSync } = require('child_process');

const EXPECTED_CONTAINERS = [
  'wibsite-authelia',
  'wibsite-cadvisor',
  'wibsite-chatwoot',
  'wibsite-chatwoot-worker',
  'wibsite-dify-api',
  'wibsite-dify-sandbox',
  'wibsite-dify-web',
  'wibsite-dify-worker',
  'wibsite-glitchtip',
  'wibsite-glitchtip-pg',
  'wibsite-glitchtip-redis',
  'wibsite-grafana',
  'wibsite-helper',
  'wibsite-minio',
  'wibsite-n8n',
  'wibsite-nginx',
  'wibsite-plugin-daemon',
  'wibsite-postgres',
  'wibsite-prometheus',
  'wibsite-redis',
  'wibsite-t2v',
  'wibsite-twenty-server',
  'wibsite-weaviate'
];

function color(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function runAudit() {
  console.log(color('\n=== AUDITORÍA 1/5: ESTADO Y SALUD DE CONTENEDORES ===\n', '1;36'));

  let rawJson = '';
  try {
    rawJson = execSync('docker ps -a --format "{{json .}}" --filter "name=wibsite"', { encoding: 'utf8' });
  } catch (e) {
    console.error(color('❌ FAIL: No se pudo comunicar con el daemon de Docker.', '1;31'));
    console.error(`   Error: ${e.message}`);
    process.exit(1);
  }

  const lines = rawJson.trim().split('\n').filter(Boolean);
  const containerMap = new Map();

  lines.forEach(line => {
    try {
      const parsed = JSON.parse(line);
      containerMap.set(parsed.Names, parsed);
    } catch (e) { /* ignore */ }
  });

  let passCount = 0;
  let failCount = 0;
  const failureDetails = [];

  console.log(`${color('Nombre del Contenedor', '1')} ${' '.repeat(10)} | ${color('Estado', '1')} ${' '.repeat(15)} | ${color('Resultado', '1')}`);
  console.log('-'.repeat(70));

  EXPECTED_CONTAINERS.forEach(name => {
    const info = containerMap.get(name);
    const paddedName = name.padEnd(30, ' ');

    if (!info) {
      failCount++;
      console.log(`${paddedName} | ${'NO EXISTE'.padEnd(21, ' ')} | [ ${color('FAIL: Faltante', '1;31')} ]`);
      failureDetails.push(`• ${name}: El contenedor no existe en Docker. Ejecuta 'docker compose up -d ${name}'`);
      return;
    }

    const statusStr = info.Status || '';
    const isRunning = statusStr.startsWith('Up');
    const isUnhealthy = statusStr.includes('(unhealthy)');

    let statusDisplay = statusStr.length > 21 ? statusStr.substring(0, 18) + '...' : statusStr.padEnd(21, ' ');

    if (isRunning && !isUnhealthy) {
      passCount++;
      console.log(`${paddedName} | ${statusDisplay} | [ ${color('PASS', '1;32')} ]`);
    } else {
      failCount++;
      const reason = !isRunning ? 'Detenido / Reiniciando' : 'Healthcheck Fallido (unhealthy)';
      console.log(`${paddedName} | ${statusDisplay} | [ ${color('FAIL: ' + reason, '1;31')} ]`);

      // Intentar obtener últimos logs del contenedor fallido
      let recentLogs = '';
      try {
        recentLogs = execSync(`docker logs ${name} --tail 5 2>&1`, { encoding: 'utf8' }).trim();
      } catch (e) {
        recentLogs = e.message;
      }
      failureDetails.push(
        `• ${name} (${reason})\n` +
        `  Status actual: ${statusStr}\n` +
        `  Últimos logs:\n  ` + recentLogs.replace(/\n/g, '\n  ')
      );
    }
  });

  console.log('-'.repeat(70));
  console.log(`Resumen Contenedores: ${color(passCount + ' OK', '1;32')} | ${color(failCount + ' FALLOS', failCount > 0 ? '1;31' : '1;30')}\n`);

  if (failureDetails.length > 0) {
    console.log(color('=== DIAGNÓSTICO DE ERRORES EN CONTENEDORES ===', '1;31'));
    failureDetails.forEach(detail => console.log(detail + '\n'));
  }

  return { passCount, failCount, total: EXPECTED_CONTAINERS.length };
}

if (require.main === module) {
  const result = runAudit();
  process.exit(result.failCount > 0 ? 1 : 0);
}

module.exports = { runAudit };
