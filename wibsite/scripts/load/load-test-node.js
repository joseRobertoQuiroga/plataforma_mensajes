// F-51 (simulador local) — Load test de conversaciones con Node (sin k6)
// Uso: node scripts/load/load-test-node.js [conversaciones=20] [concurrencia=5]
// Reporta: total, ok, errores, p50/p95, throughput y eventos emitidos al SOAC.
const axios = require('axios');

const HELPER_URL = process.env.HELPER_URL || 'http://localhost:3100';
const HELPER_KEY = process.env.HELPER_API_KEY || process.argv[4] || '';
const TOTAL = parseInt(process.argv[2] || '20', 10);
const CONCURRENCY = parseInt(process.argv[3] || '5', 10);

const GUION = [
  'Hola, me llamo {n} y quiero una tienda en linea',
  'una tienda en linea con pasarela de pagos',
  'si, con pasarela de pagos',
  'cuanto costaria aproximadamente?',
];

async function runConversation(index) {
  const convId = `load-${Date.now()}-${index}`;
  const durations = [];
  for (const line of GUION) {
    const message = line.replace('{n}', `Lead ${index}`);
    const t0 = Date.now();
    const res = await axios.post(
      `${HELPER_URL}/api/agent/chat`,
      { conversationId: convId, message },
      { headers: { 'Content-Type': 'application/json', 'x-api-key': HELPER_KEY }, timeout: 60000 }
    );
    durations.push(Date.now() - t0);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  }
  return durations;
}

async function main() {
  console.log(`=== F-51 Load test: ${TOTAL} conversaciones × ${GUION.length} turnos, concurrencia ${CONCURRENCY} ===\n`);
  const t0 = Date.now();
  const allDurations = [];
  let ok = 0;
  let failed = 0;
  let idx = 0;

  async function worker() {
    while (idx < TOTAL) {
      const i = idx++;
      try {
        const durations = await runConversation(i);
        allDurations.push(...durations);
        ok++;
      } catch (e) {
        failed++;
        console.error(`  conv ${i} ERROR: ${e.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, TOTAL) }, worker));

  const totalMs = Date.now() - t0;
  allDurations.sort((a, b) => a - b);
  const p50 = allDurations[Math.floor(allDurations.length * 0.5)] || 0;
  const p95 = allDurations[Math.floor(allDurations.length * 0.95)] || 0;

  console.log(`\nResultado:`);
  console.log(`  conversaciones: ${ok}/${TOTAL} ok (${failed} fallidas)`);
  console.log(`  turnos: ${allDurations.length}`);
  console.log(`  duración total: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  latencia turno: p50=${p50}ms p95=${p95}ms`);
  console.log(`  throughput: ${(allDurations.length / (totalMs / 1000)).toFixed(2)} turnos/s`);
  const pass = failed === 0 && p95 < 2000;
  console.log(`  UMBRALES (p95<2000ms, 0 fallos): ${pass ? 'PASS ✓' : 'FAIL ✗'}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
