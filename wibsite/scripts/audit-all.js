/**
 * audit-all.js — SCRIPT MAESTRO DE AUDITORÍA, DIAGNÓSTICO Y SIMULACIÓN EN TIEMPO REAL
 * 
 * Propósito:
 * Ejecuta en secuencia los 10 módulos de auditoría y 3 simulaciones con datos mockup:
 * 1. Salud y estado de los 23 contenedores Docker.
 * 2. Conectividad HTTP/HTTPS en el Nginx Reverse Proxy (:8080).
 * 3. Integración de SSO Unificado y Authelia OIDC Discovery.
 * 4. Aislamiento Multi-Tenant y PostgreSQL 15 Row Level Security (RLS).
 * 5. Salud y configuración de Helper-Node y microservicios.
 * 6. Observabilidad y Monitoreo en tiempo real (Prometheus, Grafana, GlitchTip, cAdvisor).
 * 7. Salud de Bases de Datos (PostgreSQL 7 DBs, Redis 7 & Weaviate Vector DB).
 * 8. Trabajadores Asíncronos y Colas (Chatwoot Sidekiq, Dify Celery, GlitchTip Celery).
 * 9. Seguridad, Filtrado PII y Registro de Eventos (audit_logs, piiFilter, RateLimiter).
 * 10. Salud de Canales de Comunicación y Campañas (channel_status, campaigns, lead_scores).
 * 11. Simulaciones con datos mockup (Flujo Inbound, Flujo Outbound Broadcast, Análisis Agente IA/LangGraph).
 * 
 * Registra logs estructurados en `scripts/logs/audit.log` y `scripts/logs/simulation.log`.
 * 
 * Uso:
 *   node scripts/audit-all.js
 */

'use strict';

const { Logger } = require('./utils/logger');

const { runAudit: auditContainers } = require('./audit/01-check-containers');
const { runAudit: auditConnectivity } = require('./audit/02-test-connectivity');
const { runAudit: auditOidc } = require('./audit/03-test-oidc-sso');
const { runAudit: auditRls } = require('./audit/04-test-multi-tenant-rls');
const { runAudit: auditHelper } = require('./audit/05-check-helper-api');
const { runAudit: auditObservability } = require('./audit/06-check-observability');
const { runAudit: auditDbHealth } = require('./audit/07-check-database-health');
const { runAudit: auditWorkers } = require('./audit/08-check-background-workers');
const { runAudit: auditSecurityPII } = require('./audit/09-check-security-and-pii');
const { runAudit: auditChannels } = require('./audit/10-check-channel-and-campaign-health');

const { runSimulation: simInbound } = require('./simulations/01-simulate-inbound-flow');
const { runSimulation: simBroadcast } = require('./simulations/02-simulate-broadcast-flow');
const { runSimulation: simAgentCore } = require('./simulations/03-analyze-agent-conversations');

const logger = new Logger('MasterRunner', require('./utils/logger').AUDIT_LOG_FILE);

function color(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

async function runMasterAudit() {
  const startTime = Date.now();
  logger.header('AUDITORÍA MAESTRA (10 MÓDULOS), DIAGNÓSTICO INTEGRAL Y SIMULACIONES');

  const auditResults = [];
  const simResults = [];

  // Módulos de Auditoría (1 a 10)
  try { auditResults.push({ name: '1. Estado de Contenedores Docker (23)', res: auditContainers() }); }
  catch (e) { auditResults.push({ name: '1. Estado de Contenedores Docker (23)', res: { passCount: 0, failCount: 1, total: 23 } }); }

  try { auditResults.push({ name: '2. Conectividad Nginx Gateway (:8080)', res: await auditConnectivity() }); }
  catch (e) { auditResults.push({ name: '2. Conectividad Nginx Gateway (:8080)', res: { passCount: 0, failCount: 1, total: 8 } }); }

  try { auditResults.push({ name: '3. SSO Unificado & Authelia OIDC Discovery', res: await auditOidc() }); }
  catch (e) { auditResults.push({ name: '3. SSO Unificado & Authelia OIDC Discovery', res: { passCount: 0, failCount: 1, total: 4 } }); }

  try { auditResults.push({ name: '4. Aislamiento Multi-Tenant & PostgreSQL RLS', res: await auditRls() }); }
  catch (e) { auditResults.push({ name: '4. Aislamiento Multi-Tenant & PostgreSQL RLS', res: { passCount: 0, failCount: 1, total: 4 } }); }

  try { auditResults.push({ name: '5. Helper-Node & Microservicios de Agente', res: await auditHelper() }); }
  catch (e) { auditResults.push({ name: '5. Helper-Node & Microservicios de Agente', res: { passCount: 0, failCount: 1, total: 3 } }); }

  try { auditResults.push({ name: '6. Observabilidad, Prometheus & Grafana Dashboard', res: await auditObservability() }); }
  catch (e) { auditResults.push({ name: '6. Observabilidad, Prometheus & Grafana Dashboard', res: { passCount: 0, failCount: 1, total: 4 } }); }

  try { auditResults.push({ name: '7. Salud de Bases de Datos (Postgres 7 DBs, Redis & Weaviate)', res: await auditDbHealth() }); }
  catch (e) { auditResults.push({ name: '7. Salud de Bases de Datos (Postgres 7 DBs, Redis & Weaviate)', res: { passCount: 0, failCount: 1, total: 4 } }); }

  try { auditResults.push({ name: '8. Trabajadores Asíncronos & Colas (Sidekiq / Celery)', res: await auditWorkers() }); }
  catch (e) { auditResults.push({ name: '8. Trabajadores Asíncronos & Colas (Sidekiq / Celery)', res: { passCount: 0, failCount: 1, total: 6 } }); }

  try { auditResults.push({ name: '9. Seguridad, Filtrado PII & Auditoría de Eventos', res: await auditSecurityPII() }); }
  catch (e) { auditResults.push({ name: '9. Seguridad, Filtrado PII & Auditoría de Eventos', res: { passCount: 0, failCount: 1, total: 3 } }); }

  try { auditResults.push({ name: '10. Salud de Canales de Comunicación y Campañas', res: await auditChannels() }); }
  catch (e) { auditResults.push({ name: '10. Salud de Canales de Comunicación y Campañas', res: { passCount: 0, failCount: 1, total: 3 } }); }

  // Módulos de Simulación con Datos Mockup
  logger.header('SECCIÓN DE SIMULACIONES Y ANÁLISIS DE FLUJOS (DATOS MOCKUP)');

  try {
    const res1 = await simInbound();
    simResults.push({ name: '11. Simulación Flujo Entrante (Inbound WhatsApp / AI)', res: { passCount: res1.stepsPassed, failCount: res1.totalSteps - res1.stepsPassed, total: res1.totalSteps } });
  } catch (e) {
    simResults.push({ name: '11. Simulación Flujo Entrante (Inbound WhatsApp / AI)', res: { passCount: 0, failCount: 1, total: 5 } });
  }

  try {
    const res2 = await simBroadcast();
    simResults.push({ name: '12. Simulación Flujo Saliente (Broadcast Campaign)', res: { passCount: res2.stepsPassed, failCount: res2.totalSteps - res2.stepsPassed, total: res2.totalSteps } });
  } catch (e) {
    simResults.push({ name: '12. Simulación Flujo Saliente (Broadcast Campaign)', res: { passCount: 0, failCount: 1, total: 6 } });
  }

  try {
    const res3 = await simAgentCore();
    simResults.push({ name: '13. Análisis de Flujos y Grafos de Agentes IA (LangGraph)', res: { passCount: res3.stepsPassed, failCount: res3.totalSteps - res3.stepsPassed, total: res3.totalSteps } });
  } catch (e) {
    simResults.push({ name: '13. Análisis de Flujos y Grafos de Agentes IA (LangGraph)', res: { passCount: 0, failCount: 1, total: 5 } });
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  // DASHBOARD REPORTE CONSOLIDADO
  console.log(color('\n==========================================================================', '1;34'));
  console.log(color('              RESUMEN CONSOLIDADO DE AUDITORÍA Y SIMULACIONES             ', '1;34'));
  console.log(color('==========================================================================', '1;34'));

  let totalPass = 0;
  let totalFail = 0;

  const allResults = [...auditResults, ...simResults];

  allResults.forEach(r => {
    totalPass += r.res.passCount;
    totalFail += r.res.failCount;
    const paddedName = r.name.padEnd(56, ' ');
    const statusTag = r.res.failCount === 0 ? color('[  OK  ]', '1;32') : color('[ FALLO ]', '1;31');
    const counts = `${r.res.passCount}/${r.res.total} OK`.padEnd(10, ' ');
    console.log(`${paddedName} | ${counts} | ${statusTag}`);
  });

  console.log('-'.repeat(78));
  const grandTotal = totalPass + totalFail;
  const overallSuccess = totalFail === 0;

  logger.info(`Pruebas Totales Ejecutadas: ${grandTotal} en ${durationSec}s`);
  logger.info(`Estado General: ${overallSuccess ? '✅ PLATAFORMA 100% OPERATIVA, SALUDABLE Y SIMULADA' : '❌ SE DETECTARON ANOMALÍAS O ERRORES'}`);

  console.log(color(`\nLogs detallados guardados en:\n  - ${require('./utils/logger').AUDIT_LOG_FILE}\n  - ${require('./utils/logger').SIMULATION_LOG_FILE}\n`, '1;36'));

  process.exit(overallSuccess ? 0 : 1);
}

if (require.main === module) {
  runMasterAudit();
}
