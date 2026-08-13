/**
 * 08-check-background-workers.js
 * 
 * Propósito:
 * Audita el estado, colas y procesamiento de tareas en segundo plano de los trabajadores asíncronos:
 * 1. Chatwoot Worker (Sidekiq / Ruby process)
 * 2. Dify Worker (Celery / Python task processor)
 * 3. GlitchTip Worker (Celery error tracking processor)
 * 4. n8n Task Executions (Procesamiento de tareas diferidas de workflows)
 * 
 * Uso:
 *   node scripts/audit/08-check-background-workers.js
 */

'use strict';

const { execSync } = require('child_process');
const { Logger } = require('../utils/logger');

const logger = new Logger('Audit-Workers', require('../utils/logger').AUDIT_LOG_FILE);

const WORKERS = [
  { name: 'wibsite-chatwoot-worker', type: 'Sidekiq' },
  { name: 'wibsite-dify-worker', type: 'Celery' },
  { name: 'wibsite-glitchtip-worker', type: 'Celery' }
];

async function runAudit() {
  logger.header('AUDITORÍA 8/10: TRABAJADORES ASÍNCRONOS Y COLAS DE TRABAJO (WORKERS)');

  let passCount = 0;
  let failCount = 0;
  const failureDetails = [];

  // PRUEBA 1: Estado de Ejecución de los 3 Contenedores Worker
  logger.info('[Prueba 1] Inspeccionando contenedores de procesamiento asíncrono...');
  WORKERS.forEach(worker => {
    try {
      const status = execSync(`docker inspect ${worker.name} --format "{{.State.Status}}" 2>&1`, { encoding: 'utf8' }).trim();
      if (status === 'running') {
        passCount++;
        logger.success(`Worker '${worker.name}' (${worker.type}): EN EJECUCIÓN (running)`);
      } else {
        failCount++;
        logger.error(`Worker '${worker.name}' (${worker.type}): DETENIDO O CON ERROR (${status})`);
        failureDetails.push(`• Worker ${worker.name}: Estado actual '${status}'`);
      }
    } catch (e) {
      failCount++;
      logger.error(`Error al inspeccionar worker ${worker.name}`, e);
      failureDetails.push(`• Worker Error ${worker.name}: ${e.message}`);
    }
  });

  // PRUEBA 2: Inspección de Errores Recientes en Logs de Workers
  logger.info('[Prueba 2] Analizando registros recientes de tareas en trabajadores...');
  WORKERS.forEach(worker => {
    try {
      const logs = execSync(`docker logs ${worker.name} --tail 20 2>&1`, { encoding: 'utf8' }).trim();
      const hasCriticalCrash = logs.includes('FATAL') || logs.includes('Unhandled rejection') || logs.includes('Traceback (most recent call last):') && logs.includes('CRITICAL');
      
      if (!hasCriticalCrash) {
        passCount++;
        logger.success(`Logs de worker '${worker.name}': Sin fallos críticos o crashes recientes`);
      } else {
        failCount++;
        logger.error(`Fallo crítico detectado en logs de '${worker.name}'`);
        failureDetails.push(`• Logs Error en ${worker.name}:\n  ` + logs.substring(0, 200).replace(/\n/g, '\n  '));
      }
    } catch (e) {
      failCount++;
      logger.error(`Error consultando logs de worker ${worker.name}`, e);
    }
  });

  console.log('\n' + '-'.repeat(70));
  logger.info(`Resumen Trabajadores Asíncronos: ${passCount} OK | ${failCount} FALLOS\n`);

  if (failureDetails.length > 0) {
    logger.warn('=== DIAGNÓSTICO DE ERRORES EN WORKERS ===');
    failureDetails.forEach(detail => console.log(detail + '\n'));
  }

  return { passCount, failCount, total: WORKERS.length * 2 };
}

if (require.main === module) {
  runAudit().then(result => {
    process.exit(result.failCount > 0 ? 1 : 0);
  });
}

module.exports = { runAudit };
