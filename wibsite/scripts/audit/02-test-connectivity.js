/**
 * 02-test-connectivity.js
 * 
 * Propósito:
 * Prueba la conectividad HTTP/HTTPS a través del Nginx Gateway (puerto 8080)
 * para los 8 servicios/módulos de la plataforma.
 * Verifica códigos HTTP esperados (200 OK / 302 SSO Redirect) y muestra diagnósticos en caso de fallos.
 * 
 * Uso:
 *   node scripts/audit/02-test-connectivity.js
 */

'use strict';

const https = require('https');

const ENDPOINTS = [
  { name: 'Hub Principal (público)', path: '/hub/', expectedStatus: [200] },
  { name: 'Authelia Portal SSO', path: '/auth/', expectedStatus: [200] },
  { name: 'Health Check Nginx', path: '/health', expectedStatus: [200] },
  { name: 'n8n (Protegido Authelia)', path: '/n8n/', expectedStatus: [302, 200] },
  { name: 'Chatwoot (Protegido)', path: '/chatwoot/', expectedStatus: [302, 200] },
  { name: 'Grafana (Protegido)', path: '/grafana/', expectedStatus: [302, 200] },
  { name: 'Dify UI (Protegido)', path: '/dify/', expectedStatus: [302, 200] },
  { name: 'MinIO Console (Protegido)', path: '/minio-console/', expectedStatus: [302, 200] }
];

function color(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function checkEndpoint(endpoint) {
  return new Promise(resolve => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: endpoint.path,
      method: 'GET',
      rejectUnauthorized: false,
      timeout: 5000
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const isOk = endpoint.expectedStatus.includes(res.statusCode);
        const location = res.headers.location || '';
        resolve({
          name: endpoint.name,
          path: endpoint.path,
          statusCode: res.statusCode,
          location,
          isOk,
          error: isOk ? null : `HTTP ${res.statusCode} recibido, esperado: ${endpoint.expectedStatus.join(' o ')}`
        });
      });
    });

    req.on('error', err => {
      resolve({
        name: endpoint.name,
        path: endpoint.path,
        statusCode: 'ERR',
        location: '',
        isOk: false,
        error: `Error de conexión TCP/TLS: ${err.message}`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: endpoint.name,
        path: endpoint.path,
        statusCode: 'TIMEOUT',
        location: '',
        isOk: false,
        error: 'Tiempo de espera agotado (5000ms)'
      });
    });

    req.end();
  });
}

async function runAudit() {
  console.log(color('\n=== AUDITORÍA 2/5: CONECTIVIDAD HTTP/HTTPS NGINX (PUERTO 8080) ===\n', '1;36'));
  console.log(`${color('Servicio / Endpoint', '1')} ${' '.repeat(10)} | ${color('Path', '1')} ${' '.repeat(12)} | ${color('HTTP', '1')} | ${color('Redirección Target', '1')} ${' '.repeat(12)} | ${color('Resultado', '1')}`);
  console.log('-'.repeat(95));

  let passCount = 0;
  let failCount = 0;
  const failureDetails = [];

  for (const endpoint of ENDPOINTS) {
    const res = await checkEndpoint(endpoint);
    const paddedName = res.name.padEnd(28, ' ');
    const paddedPath = res.path.padEnd(16, ' ');
    const statusStr = String(res.statusCode).padEnd(4, ' ');
    const locStr = res.location ? (res.location.length > 30 ? res.location.substring(0, 27) + '...' : res.location).padEnd(30, ' ') : '-'.padEnd(30, ' ');

    if (res.isOk) {
      passCount++;
      console.log(`${paddedName} | ${paddedPath} | ${statusStr} | ${locStr} | [ ${color('PASS', '1;32')} ]`);
    } else {
      failCount++;
      console.log(`${paddedName} | ${paddedPath} | ${color(statusStr, '1;31')} | ${locStr} | [ ${color('FAIL', '1;31')} ]`);
      failureDetails.push(`• ${res.name} (https://localhost:8080${res.path}):\n  ${res.error}`);
    }
  }

  console.log('-'.repeat(95));
  console.log(`Resumen Conectividad: ${color(passCount + ' OK', '1;32')} | ${color(failCount + ' FALLOS', failCount > 0 ? '1;31' : '1;30')}\n`);

  if (failureDetails.length > 0) {
    console.log(color('=== DIAGNÓSTICO DE ERRORES DE CONECTIVIDAD ===', '1;31'));
    failureDetails.forEach(detail => console.log(detail + '\n'));
  }

  return { passCount, failCount, total: ENDPOINTS.length };
}

if (require.main === module) {
  runAudit().then(result => {
    process.exit(result.failCount > 0 ? 1 : 0);
  });
}

module.exports = { runAudit };
