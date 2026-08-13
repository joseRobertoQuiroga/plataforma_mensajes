#!/usr/bin/env node
/**
 * verify-connectivity.js — FASE 3: Verificación de conectividad inter-servicios
 * 
 * Ejecutar desde el host: node scripts/verify/verify-connectivity.js
 * O desde dentro del contenedor helper: docker exec wibsite-helper node /app/scripts/verify-connectivity.js
 */

'use strict';

const http = require('http');
const https = require('https');
const net = require('net');

// ─── Configuración de servicios ──────────────────────────────────
const SERVICES = [
  // Internos Docker (para ejecutar dentro de contenedores)
  { name: 'Authelia',       type: 'http',  host: 'authelia',       port: 9091,  path: '/api/health',    internal: true },
  { name: 'n8n',            type: 'http',  host: 'n8n',            port: 5678,  path: '/healthz',       internal: true },
  { name: 'Chatwoot',       type: 'http',  host: 'chatwoot',       port: 3000,  path: '/auth/sign_in',  internal: true },
  { name: 'Dify API',       type: 'http',  host: 'dify-api',       port: 5001,  path: '/health',        internal: true },
  { name: 'Dify Web',       type: 'http',  host: 'dify-web',       port: 3000,  path: '/',              internal: true },
  { name: 'Twenty',         type: 'http',  host: 'twenty-server',  port: 3000,  path: '/health',        internal: true },
  { name: 'Weaviate',       type: 'http',  host: 'weaviate',       port: 8080,  path: '/v1/.well-known/ready', internal: true },
  { name: 'PostgreSQL',     type: 'tcp',   host: 'postgres',       port: 5432,                          internal: true },
  { name: 'Redis',          type: 'tcp',   host: 'redis',          port: 6379,                          internal: true },
  { name: 'MinIO API',      type: 'http',  host: 'minio',          port: 9000,  path: '/minio/health/live', internal: true },
  { name: 'MinIO Console',  type: 'tcp',   host: 'minio',          port: 9001,                          internal: true },
  { name: 'Plugin Daemon',  type: 'tcp',   host: 'plugin-daemon',  port: 5002,                          internal: true },
  { name: 'Grafana',        type: 'http',  host: 'grafana',        port: 3000,  path: '/api/health',    internal: true },
  // Externos via NGINX (para ejecutar desde el host)
  { name: 'Hub (público)',   type: 'https', host: 'localhost', port: 8080, path: '/hub/',                internal: false },
  { name: 'Authelia Portal', type: 'https', host: 'localhost', port: 8080, path: '/auth/',              internal: false },
  { name: 'Health check',    type: 'https', host: 'localhost', port: 8080, path: '/health',             internal: false },
  { name: 'n8n (sin auth)',  type: 'https', host: 'localhost', port: 8080, path: '/n8n/',               internal: false, expectRedirect: true },
  { name: 'Chatwoot (no auth)', type: 'https', host: 'localhost', port: 8080, path: '/chatwoot/',       internal: false, expectRedirect: true },
  { name: 'Grafana (no auth)',  type: 'https', host: 'localhost', port: 8080, path: '/grafana/',        internal: false, expectRedirect: true },
  { name: 'Dify (no auth)',     type: 'https', host: 'localhost', port: 8080, path: '/dify/',           internal: false, expectRedirect: true },
  { name: 'MinIO (no auth)',    type: 'https', host: 'localhost', port: 8080, path: '/minio-console/',  internal: false, expectRedirect: true },
];

const TIMEOUT_MS = 5000;

function checkTcp(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: TIMEOUT_MS });
    socket.on('connect', () => { socket.destroy(); resolve({ ok: true, status: 'TCP_OPEN' }); });
    socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, status: 'TIMEOUT' }); });
    socket.on('error', (e) => resolve({ ok: false, status: e.code || e.message }));
  });
}

function checkHttp(protocol, host, port, path) {
  return new Promise((resolve) => {
    const lib = protocol === 'https' ? https : http;
    const options = {
      hostname: host, port, path, method: 'GET',
      timeout: TIMEOUT_MS,
      rejectUnauthorized: false, // para certs auto-firmados en localhost
    };
    const req = lib.request(options, (res) => {
      resolve({ ok: res.statusCode < 500, status: res.statusCode });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 'TIMEOUT' }); });
    req.on('error', (e) => resolve({ ok: false, status: e.code || e.message }));
    req.end();
  });
}

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

async function main() {
  const isInternal = process.env.INSIDE_DOCKER === 'true' || process.argv.includes('--internal');
  const mode = isInternal ? 'INTERNAL (Docker network)' : 'EXTERNAL (host → Nginx :8080)';

  console.log(`\n${BOLD}═══ Wibsite Connectivity Check — ${mode} ═══${RESET}\n`);

  const results = [];
  for (const svc of SERVICES) {
    // Filtrar según el modo de ejecución
    if (isInternal && !svc.internal) continue;
    if (!isInternal && svc.internal) continue;

    let result;
    if (svc.type === 'tcp') {
      result = await checkTcp(svc.host, svc.port);
    } else {
      result = await checkHttp(svc.type, svc.host, svc.port, svc.path || '/');
    }

    const isOk = result.ok || (svc.expectRedirect && [301, 302].includes(result.status));
    const icon = isOk ? `${GREEN}✅${RESET}` : `${RED}❌${RESET}`;
    const statusStr = String(result.status);
    const statusColor = isOk ? GREEN : RED;

    console.log(`${icon}  ${svc.name.padEnd(25)} ${statusColor}${statusStr.padEnd(12)}${RESET} ${svc.host}:${svc.port}${svc.path || ''}`);
    results.push({ ...svc, result, isOk });
  }

  const failed = results.filter(r => !r.isOk);
  const passed = results.filter(r => r.isOk);

  console.log(`\n${BOLD}Summary:${RESET} ${GREEN}${passed.length} OK${RESET} | ${failed.length > 0 ? RED : GREEN}${failed.length} FAILED${RESET}\n`);

  if (failed.length > 0) {
    console.log(`${RED}${BOLD}Failed services:${RESET}`);
    failed.forEach(f => console.log(`  - ${f.name}: ${f.result.status}`));
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
