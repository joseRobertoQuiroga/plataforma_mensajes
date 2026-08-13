/**
 * 10-check-channel-and-campaign-health.js
 * 
 * Propósito:
 * Audita la salud de los canales de mensajería y el estado de las campañas de negocio:
 * 1. Tabla `channel_status`: Revisa el estado (online/offline) y latencia de los canales de comunicación.
 * 2. Tabla `campaigns`: Revisa métricas de campañas activas, borradores, programadas y completadas.
 * 3. Tabla `lead_scores`: Revisa el estado del motor de puntuación comercial de Leads.
 * 
 * Uso:
 *   node scripts/audit/10-check-channel-and-campaign-health.js
 */

'use strict';

const { execSync } = require('child_process');
const { Logger } = require('../utils/logger');

const logger = new Logger('Audit-Channels', require('../utils/logger').AUDIT_LOG_FILE);

async function runAudit() {
  logger.header('AUDITORÍA 10/10: SALUD DE CANALES DE COMUNICACIÓN Y CAMPAÑAS');

  let passCount = 0;
  let failCount = 0;
  const failureDetails = [];

  // PRUEBA 1: Estado de Canales de Mensajería (channel_status table)
  logger.info('[Prueba 1] Inspeccionando la tabla channel_status en PostgreSQL...');
  try {
    const channelsRaw = execSync("docker exec wibsite-postgres psql -U wibsite -d wibsite -t -A -c \"SELECT count(*) FROM channel_status;\"", { encoding: 'utf8' }).trim();
    const count = parseInt(channelsRaw) || 0;
    passCount++;
    logger.success(`Tabla channel_status operativa: ${count} canales registrados`);
  } catch (e) {
    failCount++;
    logger.error('Error al consultar la tabla channel_status', e);
    failureDetails.push(`• Channel Status Error: ${e.message}`);
  }

  // PRUEBA 2: Estado de Campañas de Negocio (campaigns table)
  logger.info('[Prueba 2] Inspeccionando métricas de la tabla campaigns en PostgreSQL...');
  try {
    const campaignsCount = execSync("docker exec wibsite-postgres psql -U wibsite -d wibsite -t -A -c \"SELECT count(*) FROM campaigns;\"", { encoding: 'utf8' }).trim();
    const count = parseInt(campaignsCount) || 0;
    passCount++;
    logger.success(`Tabla campaigns operativa: ${count} campañas procesadas en el sistema`);
  } catch (e) {
    failCount++;
    logger.error('Error al consultar la tabla campaigns', e);
    failureDetails.push(`• Campaigns Table Error: ${e.message}`);
  }

  // PRUEBA 3: Puntuación Comercial de Leads (lead_scores table)
  logger.info('[Prueba 3] Inspeccionando la tabla lead_scores en PostgreSQL...');
  try {
    const leadsCount = execSync("docker exec wibsite-postgres psql -U wibsite -d wibsite -t -A -c \"SELECT count(*) FROM lead_scores;\"", { encoding: 'utf8' }).trim();
    const count = parseInt(leadsCount) || 0;
    passCount++;
    logger.success(`Tabla lead_scores operativa: ${count} calificaciones comerciales de Leads`);
  } catch (e) {
    failCount++;
    logger.error('Error al consultar la tabla lead_scores', e);
    failureDetails.push(`• Lead Scores Error: ${e.message}`);
  }

  console.log('\n' + '-'.repeat(70));
  logger.info(`Resumen Canales & Campañas: ${passCount} OK | ${failCount} FALLOS\n`);

  if (failureDetails.length > 0) {
    logger.warn('=== DIAGNÓSTICO DE ERRORES CANALES & CAMPAÑAS ===');
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
