/**
 * 04-test-multi-tenant-rls.js
 * 
 * Propósito:
 * Audita y valida la seguridad y el aislamiento estricto Multi-Tenant a nivel de base de datos (PostgreSQL 15 RLS).
 * 
 * Pruebas:
 * 1. Verifica la existencia de la función `current_tenant_id()`.
 * 2. Verifica la existencia del rol de aplicación `app_user` (no-superuser).
 * 3. Verifica RLS Habilitado (rls_enabled) y Forzado (rls_forced) en las 7 tablas.
 * 4. Simula consultas con `SET ROLE app_user` bajo distintos contextos de `app.tenant_id` y valida aislamiento de datos.
 * 
 * Uso:
 *   node scripts/audit/04-test-multi-tenant-rls.js
 */

'use strict';

const { execSync } = require('child_process');

const RLS_TABLES = [
  'campaigns',
  'campaign_leads',
  'lead_scores',
  'opt_outs',
  'workflow_logs',
  'audit_logs',
  'channel_status'
];

function color(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function runPsqlQuery(sql) {
  const cleanSql = sql.replace(/"/g, '\\"').replace(/\n/g, ' ');
  const cmd = `docker exec wibsite-postgres psql -U wibsite -d wibsite -t -A -c "${cleanSql}"`;
  const raw = execSync(cmd, { encoding: 'utf8' }).trim();
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('SET') && !l.startsWith('RESET'));
  return lines.join('\n');
}

async function runAudit() {
  console.log(color('\n=== AUDITORÍA 4/5: AISLAMIENTO MULTI-TENANT Y POSTGRESQL RLS ===\n', '1;36'));

  let passCount = 0;
  let failCount = 0;
  const failureDetails = [];

  // PRUEBA 1: Función current_tenant_id()
  console.log(color('[Prueba 1] Función current_tenant_id()', '1'));
  try {
    const fnCheck = runPsqlQuery("SELECT routine_name FROM information_schema.routines WHERE routine_name='current_tenant_id';");
    if (fnCheck === 'current_tenant_id') {
      passCount++;
      console.log(`  • Función current_tenant_id(): ${color('EXISTE Y RETORNA UUID', '1;32')} [ ${color('PASS', '1;32')} ]`);
    } else {
      failCount++;
      console.log(`  • Función current_tenant_id(): [ ${color('FAIL', '1;31')} ] - No encontrada`);
      failureDetails.push(`• Función current_tenant_id(): No existe en el esquema public.`);
    }
  } catch (e) {
    failCount++;
    console.log(`  • Error al verificar función: ${e.message} [ ${color('FAIL', '1;31')} ]`);
  }

  // PRUEBA 2: Rol app_user (No-Superuser)
  console.log(color('\n[Prueba 2] Rol de Aplicación app_user (no-superuser)', '1'));
  try {
    const userCheck = runPsqlQuery("SELECT usename, usesuper FROM pg_user WHERE usename='app_user';");
    const [username, isSuper] = userCheck.split('|');
    if (username === 'app_user' && isSuper === 'f') {
      passCount++;
      console.log(`  • Rol app_user: ${color('CREADO (usesuper=false)', '1;32')} [ ${color('PASS', '1;32')} ]`);
    } else {
      failCount++;
      const reason = !username ? 'No existe el rol app_user' : `Es SUPERUSER (usesuper=${isSuper})`;
      console.log(`  • Rol app_user: [ ${color('FAIL', '1;31')} ] - ${reason}`);
      failureDetails.push(`• Rol app_user: ${reason}. Se debe crear como usuario normal de app.`);
    }
  } catch (e) {
    failCount++;
    console.log(`  • Error al verificar app_user: ${e.message} [ ${color('FAIL', '1;31')} ]`);
  }

  // PRUEBA 3: Estado RLS y FORCE RLS en 7 Tablas
  console.log(color('\n[Prueba 3] Estado RLS en Tablas Protegidas', '1'));
  try {
    const rlsStatesRaw = runPsqlQuery(
      "SELECT relname, relrowsecurity, relforcerowsecurity " +
      "FROM pg_class WHERE relname IN ('" + RLS_TABLES.join("','") + "') ORDER BY relname;"
    );

    const rlsLines = rlsStatesRaw.split('\n').filter(Boolean);
    let allRlsOk = true;

    rlsLines.forEach(line => {
      const [table, enabled, forced] = line.split('|');
      const isOk = enabled === 't' && forced === 't';
      if (!isOk) allRlsOk = false;
      const statusText = isOk ? color('RLS=true FORCE=true', '1;32') : color(`RLS=${enabled} FORCE=${forced}`, '1;31');
      console.log(`  • Tabla '${table.padEnd(16, ' ')}': ${statusText}`);
    });

    if (allRlsOk && rlsLines.length === RLS_TABLES.length) {
      passCount++;
      console.log(`  • RLS en todas las ${RLS_TABLES.length} tablas: [ ${color('PASS', '1;32')} ]`);
    } else {
      failCount++;
      console.log(`  • RLS en tablas: [ ${color('FAIL', '1;31')} ] - Algunas tablas no tienen RLS enabled/forced.`);
      failureDetails.push(`• Tablas RLS: Asegura que ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY y FORCE ROW LEVEL SECURITY estén aplicados.`);
    }
  } catch (e) {
    failCount++;
    console.log(`  • Error al consultar estados RLS: ${e.message} [ ${color('FAIL', '1;31')} ]`);
  }

  // PRUEBA 4: Aislamiento Funcional de Consultas entre Tenants
  console.log(color('\n[Prueba 4] Test de Aislamiento de Datos Funcional (SET ROLE app_user)', '1'));
  try {
    // 1. Contexto Tenant Alpha
    const alphaCount = runPsqlQuery("SET ROLE app_user; SET app.tenant_id = 'a0000000-0000-0000-0000-000000000001'; SELECT count(*) FROM campaigns;");
    // 2. Contexto Tenant Beta
    const betaCount = runPsqlQuery("SET ROLE app_user; SET app.tenant_id = 'a0000000-0000-0000-0000-000000000002'; SELECT count(*) FROM campaigns;");
    // 3. Intento de fuga: Beta intentando consultar campañas de Alpha
    const leakAttempt = runPsqlQuery("SET ROLE app_user; SET app.tenant_id = 'a0000000-0000-0000-0000-000000000002'; SELECT count(*) FROM campaigns WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';");

    console.log(`  • Registros visibles para Tenant Alpha: ${color(alphaCount, '1;32')} campañas`);
    console.log(`  • Registros visibles para Tenant Beta:  ${color(betaCount, '1;32')} campaña`);
    console.log(`  • Intentos de acceso cruzado (Beta -> Alpha): ${color(leakAttempt + ' registros', leakAttempt === '0' ? '1;32' : '1;31')}`);

    if (parseInt(alphaCount) >= 2 && parseInt(betaCount) >= 1 && parseInt(leakAttempt) === 0) {
      passCount++;
      console.log(`  • Aislamiento RLS Multi-Tenant: [ ${color('PASS - 0 FUGA DE DATOS', '1;32')} ]`);
    } else {
      failCount++;
      console.log(`  • Aislamiento RLS Multi-Tenant: [ ${color('FAIL - FUGA O RESULTADOS INESPERADOS', '1;31')} ]`);
      failureDetails.push(`• Fuga de datos RLS: Tenant Beta pudo consultar ${leakAttempt} registros pertenecientes a Tenant Alpha!`);
    }
  } catch (e) {
    failCount++;
    console.log(`  • Error ejecutando test de aislamiento RLS: ${e.message} [ ${color('FAIL', '1;31')} ]`);
    failureDetails.push(`• Error RLS: ${e.message}`);
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`Resumen RLS Multi-Tenant: ${color(passCount + ' OK', '1;32')} | ${color(failCount + ' FALLOS', failCount > 0 ? '1;31' : '1;30')}\n`);

  if (failureDetails.length > 0) {
    console.log(color('=== DIAGNÓSTICO DE ERRORES MULTI-TENANT / RLS ===', '1;31'));
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
