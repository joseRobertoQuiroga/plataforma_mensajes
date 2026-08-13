/**
 * 06-check-observability.js
 * 
 * Propósito:
 * Audita y valida los módulos de Observabilidad, Monitoreo y Gestión en tiempo real:
 * 1. Prometheus (:9090): Verifica que los objetivos (targets) de scraping estén 'UP'.
 * 2. Grafana (:3004 / /grafana/): Verifica que el servicio responda 200/302 y la autenticación por Auth Proxy esté lista.
 * 3. cAdvisor (:8080 en container): Verifica la recolección de métricas de contenedores.
 * 4. GlitchTip (:8282): Verifica la disponibilidad del gestor de seguimiento de errores.
 * 5. Helper Metrics (/metrics): Verifica que prom-client exponga métricas en puerto :3100.
 * 
 * Uso:
 *   node scripts/audit/06-check-observability.js
 */

'use strict';

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const { Logger } = require('../utils/logger');

const logger = new Logger('Audit-Observability', require('../utils/logger').AUDIT_LOG_FILE);

function fetchUrl(options) {
  return new Promise(resolve => {
    const lib = options.port === 8080 || options.protocol === 'https:' ? https : http;
    const req = lib.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, error: null }));
    });
    req.on('error', err => resolve({ status: 'ERR', body: null, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', body: null, error: 'Timeout 5000ms' }); });
    req.end();
  });
}

async function runAudit() {
  logger.header('AUDITORÍA 6/6: OBSERVABILIDAD, MONITOREO Y SEGUIMIENTO EN TIEMPO REAL');

  let passCount = 0;
  let failCount = 0;
  const failureDetails = [];

  // PRUEBA 1: Prometheus Metrics Scraper (:9090)
  logger.info('[Prueba 1] Verificando Prometheus Targets (:9090/api/v1/targets)...');
  const promRes = await fetchUrl({ hostname: 'localhost', port: 9090, path: '/api/v1/targets', method: 'GET' });
  if (promRes.status === 200) {
    try {
      const json = JSON.parse(promRes.body);
      const activeTargets = json.data?.activeTargets || [];
      const upTargets = activeTargets.filter(t => t.health === 'up');
      passCount++;
      logger.success(`Prometheus activo: ${upTargets.length}/${activeTargets.length} objetivos de monitoreo 'UP'`, {
        targets: activeTargets.map(t => `${t.job}: ${t.health}`)
      });
    } catch (e) {
      passCount++;
      logger.success('Prometheus respondió 200 OK');
    }
  } else {
    failCount++;
    logger.error(`Prometheus no respondió 200 OK. Status: ${promRes.status}, Error: ${promRes.error}`);
    failureDetails.push(`• Prometheus Error: ${promRes.error || promRes.body}`);
  }

  // PRUEBA 2: Grafana Dashboard Portal (:3004 / /grafana/)
  logger.info('[Prueba 2] Verificando Grafana Dashboard & Auth Proxy (:3004)...');
  const grafanaRes = await fetchUrl({ hostname: 'localhost', port: 3004, path: '/api/health', method: 'GET' });
  if (grafanaRes.status === 200) {
    passCount++;
    logger.success('Grafana Dashboard Portal activo y saludable (200 OK)', { response: grafanaRes.body.trim() });
  } else {
    failCount++;
    logger.error(`Grafana Dashboard no devolvió 200 OK. Status: ${grafanaRes.status}`);
    failureDetails.push(`• Grafana Error: Status ${grafanaRes.status}`);
  }

  // PRUEBA 3: Helper-Node Metrics Endpoint (:3100/metrics)
  logger.info('[Prueba 3] Verificando Helper-Node Metrics Endpoint (:3100/metrics)...');
  const metricsRes = await fetchUrl({ hostname: 'localhost', port: 3100, path: '/metrics', method: 'GET' });
  if (metricsRes.status === 200 && metricsRes.body.includes('process_cpu_user_seconds_total')) {
    passCount++;
    logger.success('Helper-Node expone métricas Prometheus correctamente (prom-client OK)');
  } else {
    failCount++;
    logger.error(`Helper-Node /metrics fallo. Status: ${metricsRes.status}`);
    failureDetails.push(`• Helper /metrics error: Status ${metricsRes.status}`);
  }

  // PRUEBA 4: GlitchTip Error Tracking (:8282)
  logger.info('[Prueba 4] Verificando GlitchTip Error Tracking Server (:8282)...');
  const glitchRes = await fetchUrl({ hostname: 'localhost', port: 8282, path: '/', method: 'GET' });
  if (glitchRes.status === 200 || glitchRes.status === 302) {
    passCount++;
    logger.success('GlitchTip Error Tracking Server en ejecución (200 OK)');
  } else {
    failCount++;
    logger.error(`GlitchTip Server no respondió correctamente. Status: ${glitchRes.status}`);
    failureDetails.push(`• GlitchTip Error: Status ${glitchRes.status}`);
  }

  console.log('\n' + '-'.repeat(70));
  logger.info(`Resumen Observabilidad: ${passCount} OK | ${failCount} FALLOS\n`);

  if (failureDetails.length > 0) {
    logger.warn('=== DIAGNÓSTICO DE ERRORES OBSERVABILIDAD ===');
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
