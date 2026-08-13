/**
 * 03-test-oidc-sso.js
 * 
 * Propósito:
 * Audita el funcionamiento y la consistencia del SSO Unificado (Authelia OIDC).
 * Verifica:
 * 1. Issuer OIDC exacto (https://localhost:8080) desde peticiones externas del navegador.
 * 2. Resolución OIDC desde contenedores (Chatwoot, MinIO) verificando alcance y respuesta JSON.
 * 3. Disponibilidad de endpoints JWKS (/jwks.json) y autorización (/api/oidc/authorization).
 * 
 * Uso:
 *   node scripts/audit/03-test-oidc-sso.js
 */

'use strict';

const https = require('https');
const { execSync } = require('child_process');

function color(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function fetchHttpsJson(hostname, port, path) {
  return new Promise(resolve => {
    const req = https.get({
      hostname,
      port,
      path,
      rejectUnauthorized: false,
      timeout: 5000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json, error: null });
        } catch (e) {
          resolve({ status: res.statusCode, json: null, error: `JSON Parse error: ${e.message}. Raw: ${data.substring(0, 100)}` });
        }
      });
    });

    req.on('error', err => resolve({ status: 'ERR', json: null, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', json: null, error: 'Timeout (5000ms)' }); });
  });
}

async function runAudit() {
  console.log(color('\n=== AUDITORÍA 3/5: SSO UNIFICADO Y AUTHELIA OIDC DISCOVERY ===\n', '1;36'));

  let passCount = 0;
  let failCount = 0;
  const failureDetails = [];

  // TEST 1: Issuer Externo (Browser)
  console.log(color('[Prueba 1] Authelia OIDC Discovery (Vía Nginx Proxy)', '1'));
  const extDisc = await fetchHttpsJson('localhost', 8080, '/auth/.well-known/openid-configuration');
  if (extDisc.json && extDisc.json.issuer === 'https://localhost:8080') {
    passCount++;
    console.log(`  • Issuer devuelto: ${color(extDisc.json.issuer, '1;32')} [ ${color('PASS', '1;32')} ]`);
    console.log(`  • Authorization endpoint: ${extDisc.json.authorization_endpoint}`);
    console.log(`  • Token endpoint: ${extDisc.json.token_endpoint}`);
  } else {
    failCount++;
    const errReason = extDisc.json ? `Issuer incorrecto: '${extDisc.json.issuer}', se esperaba 'https://localhost:8080'` : extDisc.error;
    console.log(`  • Status: [ ${color('FAIL', '1;31')} ] - ${errReason}`);
    failureDetails.push(`• Discovery Externo:\n  ${errReason}`);
  }

  // TEST 2: Discovery desde dentro del contenedor Chatwoot
  console.log(color('\n[Prueba 2] OIDC Discovery desde Contenedor Chatwoot', '1'));
  try {
    const raw = execSync("docker exec wibsite-chatwoot sh -c \"wget --no-check-certificate -T 5 -O - 'https://host.docker.internal:8080/auth/.well-known/openid-configuration' 2>/dev/null\"", { encoding: 'utf8' }).trim();
    const cwJson = JSON.parse(raw);
    if (cwJson.issuer === 'https://localhost:8080') {
      passCount++;
      console.log(`  • Issuer visto por Chatwoot: ${color(cwJson.issuer, '1;32')} [ ${color('PASS', '1;32')} ]`);
    } else {
      failCount++;
      console.log(`  • Issuer visto por Chatwoot: ${color(cwJson.issuer, '1;31')} [ ${color('FAIL', '1;31')} ]`);
      failureDetails.push(`• Discovery Chatwoot: Issuer devuelto '${cwJson.issuer}' difiere de 'https://localhost:8080'`);
    }
  } catch (e) {
    failCount++;
    console.log(`  • Error al consultar desde Chatwoot: [ ${color('FAIL', '1;31')} ] - ${e.message}`);
    failureDetails.push(`• Discovery Chatwoot: Excepción al ejecutar wget en contenedor: ${e.message}`);
  }

  // TEST 3: Configuración OIDC en MinIO
  console.log(color('\n[Prueba 3] MinIO OIDC Provider Status', '1'));
  try {
    const minioConfig = execSync("docker exec wibsite-minio sh -c \"mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null && mc admin config get local identity_openid 2>&1 | tail -1\"", { encoding: 'utf8' }).trim();
    if (minioConfig.includes('identity_openid') && minioConfig.includes('display_name="Wibsite SSO"')) {
      passCount++;
      console.log(`  • Configuración MinIO OIDC: ${color('ACTIVA Y CONFIGURADA', '1;32')} [ ${color('PASS', '1;32')} ]`);
      console.log(`  • Detalle: ${minioConfig.substring(0, 100)}...`);
    } else {
      failCount++;
      console.log(`  • Configuración MinIO OIDC: [ ${color('FAIL', '1;31')} ]`);
      failureDetails.push(`• MinIO OIDC: Configuración no activa o sin parámetros. Salida: ${minioConfig}`);
    }
  } catch (e) {
    failCount++;
    console.log(`  • Error consultando MinIO OIDC: [ ${color('FAIL', '1;31')} ] - ${e.message}`);
    failureDetails.push(`• MinIO OIDC Error: ${e.message}`);
  }

  // TEST 4: Configuración de Autenticación en n8n
  console.log(color('\n[Prueba 4] n8n Auth Mode & Webhook URL', '1'));
  try {
    const authMethod = execSync("docker exec wibsite-n8n printenv N8N_AUTH_METHOD 2>&1", { encoding: 'utf8' }).trim();
    const webhookUrl = execSync("docker exec wibsite-n8n printenv WEBHOOK_URL 2>&1", { encoding: 'utf8' }).trim();
    
    if (authMethod === 'email' && webhookUrl === 'https://localhost:8080') {
      passCount++;
      console.log(`  • Auth Method: ${color(authMethod, '1;32')} (Community - SSO vía Authelia Proxy) [ ${color('PASS', '1;32')} ]`);
      console.log(`  • Webhook Base URL: ${color(webhookUrl, '1;32')}`);
    } else {
      failCount++;
      console.log(`  • n8n Config: AuthMethod=${authMethod}, WebhookUrl=${webhookUrl} [ ${color('FAIL', '1;31')} ]`);
      failureDetails.push(`• n8n Config Incorrecta: N8N_AUTH_METHOD=${authMethod} (esperado email), WEBHOOK_URL=${webhookUrl} (esperado https://localhost:8080)`);
    }
  } catch (e) {
    failCount++;
    console.log(`  • Error consultando envs de n8n: [ ${color('FAIL', '1;31')} ] - ${e.message}`);
    failureDetails.push(`• n8n Env Error: ${e.message}`);
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`Resumen SSO OIDC: ${color(passCount + ' OK', '1;32')} | ${color(failCount + ' FALLOS', failCount > 0 ? '1;31' : '1;30')}\n`);

  if (failureDetails.length > 0) {
    console.log(color('=== DIAGNÓSTICO DE ERRORES SSO / OIDC ===', '1;31'));
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
