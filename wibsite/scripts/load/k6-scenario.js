// F-51 — Load test 50 conversaciones (k6)
// Uso: k6 run scripts/load/k6-scenario.js -e HELPER_URL=http://localhost:3100 -e HELPER_KEY=...
// Umbrales: p95 http_req_duration < 2000ms · error rate < 5%
import http from 'k6/http';
import { check, sleep } from 'k6';

const HELPER_URL = __ENV.HELPER_URL || 'http://localhost:3100';
const HELPER_KEY = __ENV.HELPER_KEY || 'wb_dev_test';
const CONVERSATIONS = Number(__ENV.CONVERSATIONS || 50);

const GUION = [
  'Hola, me llamo {{name}} y quiero una tienda en linea para mi negocio',
  'una tienda en linea con pasarela de pagos',
  'si, con pasarela de pagos',
  'cuanto costaria aproximadamente?',
];

export const options = {
  scenarios: {
    conversations: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: CONVERSATIONS,
      maxDuration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const convId = `k6-${__VU}-${__ITER}`;
  for (let i = 0; i < GUION.length; i++) {
    const message = GUION[i].replace('{{name}}', `Lead ${__VU}-${__ITER}`);
    const res = http.post(`${HELPER_URL}/api/agent/chat`, JSON.stringify({ conversationId: convId, message }), {
      headers: { 'Content-Type': 'application/json', 'x-api-key': HELPER_KEY },
    });
    check(res, { 'status 200': (r) => r.status === 200 });
    sleep(1);
  }
}
