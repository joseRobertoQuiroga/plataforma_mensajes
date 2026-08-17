// F-46 — Trazabilidad E2E sin pérdida (gate de unificación)
// Inyecta un mensaje con marker único → recorre el grafo → verifica en audit_logs (PG)
// y en Elastic (OTel spans) que quién/qué/cómo/módulo/proceso y los campos clave
// (intent, score, tokens) llegaron intactos. Exit 0 = traza completa, 1 = pérdida.
// Uso: node e2e-trace.js [--helper URL] [--key K] [--es URL] [--es-user U] [--es-pass P]
'use strict';

const crypto = require('crypto');

const args = {};
process.argv.slice(2).forEach((a, i) => {
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 3];
});

const HELPER = args.helper || process.env.HELPER_URL || 'http://localhost:3100';
const API_KEY = args.key || process.env.HELPER_API_KEY;
const ES = args.es || process.env.ELASTIC_URL || 'http://localhost:9200';
const ES_USER = args['es-user'] || process.env.ELASTIC_USER || 'elastic';
const ES_PASS = args['es-pass'] || process.env.ELASTIC_PASSWORD || 'wibsite_elastic_pass_2026';

if (!API_KEY) { console.error('Falta API key (--key o HELPER_API_KEY)'); process.exit(2); }

const marker = 'e2e-' + crypto.randomBytes(4).toString('hex');
const conversationId = 'e2e-trace-' + marker;
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  console.log(`== Traza E2E (F-46) marker=${marker} ==`);

  // 1. Inyectar mensaje con marker único
  const agentRes = await fetch(`${HELPER}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      message: `${marker}: hola quiero saber precios de integracion`,
      tenantId: 'default',
      conversationId,
      template_id: 'consultora-software',
    }),
  });
  const agent = await agentRes.json().catch(() => ({}));
  check('POST /api/agent/chat 200', agentRes.ok, `status=${agentRes.status}`);
  check('Agente responde con stage', agent.stage && agent.intent, `stage=${agent.stage} intent=${agent.intent} score=${agent.score}`);
  const expectedFields = ['stage', 'intent', 'score', 'autonomyZone', 'commercialState', 'nextAction', 'path'];
  const missing = expectedFields.filter((f) => agent[f] === undefined);
  check('Campos clave presentes en respuesta', missing.length === 0, missing.length ? `faltan: ${missing.join(',')}` : `score=${agent.score} zona=${agent.autonomyZone}`);

  // 2. Rastrear la conversación en audit_logs (PG) — quién/qué/cómo/módulo/proceso
  await new Promise((r) => setTimeout(r, 1200));
  const traceRes = await fetch(`${HELPER}/api/logs/trace/${conversationId}`, {
    headers: { 'x-api-key': API_KEY, 'x-tenant-id': 'default' },
  });
  const trace = await traceRes.json().catch(() => ({}));
  const events = (trace.trace || []).filter((e) => e.event_type !== 'e2e_trace');
  check('GET /api/logs/trace/:conversationId encontrado', traceRes.ok && trace.found, `eventos=${events.length}`);
  check('Timeline con campos de auditoría', events.length > 0 && events.every((e) => e.event_type && e.message && e.quien),
    events.length ? `quien=${events[0] && events[0].quien} queso=${events[0] && events[0].queso}` : 'sin eventos');

  // 3. Verificar los spans en Elastic (traza completa HTTP → graph → LLM)
  // El collector reencola batches cuando ES rechaza temporalmente uno mezclado con
  // spans ajenos (redis PUBLISH de otros servicios del stack): el arreglo puede
  // tardar hasta ~60s. Se consulta con polling en vez de una espera fija.
  const basic = 'Basic ' + Buffer.from(`${ES_USER}:${ES_PASS}`).toString('base64');
  const firstWithTrace = events.find((e) => e.trace_id);
  check('Eventos con trace_id/span_id (OTel)', !!firstWithTrace && events.some((e) => e.span_id),
    firstWithTrace ? `trace=${firstWithTrace.trace_id.slice(0, 12)}... span=${firstWithTrace.span_id}` : 'todos nulos');
  const esQuery = {
    query: {
      bool: { must: [{ term: { trace_id: firstWithTrace && firstWithTrace.trace_id } }] },
    },
    size: 10,
    _source: ['name', 'span_id', 'parent_span_id', 'attributes', 'status'],
  };
  const esSearch = () => fetch(`${ES}/traces-doags.otel-*/_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: basic },
    body: JSON.stringify(esQuery),
  });
  let spans = [];
  if (firstWithTrace) {
    for (let attempt = 1; attempt <= 8 && spans.length < 3; attempt++) {
      const esRes = await esSearch();
      const es = await esRes.json().catch(() => ({}));
      spans = es.hits ? es.hits.hits.map((h) => h._source) : [];
      if (spans.length < 3) await new Promise((r) => setTimeout(r, 10000));
    }
  }
  const names = spans.map((s) => s.name);
  check('Spans en Elastic con trace_id', spans.length >= 2, `spans=${spans.length}: ${names.join(' → ')}`);
  check('Cadena HTTP → graph → LLM', names.includes('agent.graph.run') && names.some((n) => n.startsWith('HTTP')), names.join(' → '));

  // El span LLM que produjo la respuesta final es el último llm.completion de la traza
  // (en modo primario+fallback pueden existir dos: el fallido de Dify y el efectivo de OpenRouter)
  const llmSpans = spans.filter((s) => s.name === 'llm.completion');
  const llmSpan = llmSpans[llmSpans.length - 1] || null;
  const rawAttrs = (llmSpan && llmSpan.attributes) || {};
  const attrs = Array.isArray(rawAttrs)
    ? rawAttrs.reduce((acc, x) => {
        const v = x.value && (x.value.stringValue !== undefined ? x.value.stringValue : x.value.intValue !== undefined ? x.value.intValue : x.value.doubleValue);
        acc[x.key] = v;
        return acc;
      }, {})
    : rawAttrs;
  const attr = (k) => attrs[k];
  const totalKey = (attr('llm.usage.total_tokens') !== undefined) ? 'llm.usage.total_tokens' : 'gen_ai.usage.total_tokens';
  // Provider-agnóstico: basta con el total de tokens (Dify reporta solo total; OpenRouter reporta in/out/total)
  const hasTokens = attr(totalKey) !== undefined;
  check('LLM span con usage tokens', hasTokens,
    hasTokens ? `in=${attr('gen_ai.usage.input_tokens') ?? 'n/d'} out=${attr('gen_ai.usage.output_tokens') ?? 'n/d'} total=${attr(totalKey)}` : 'sin atributos de usage');

  // 4. Pérdida de campos entre saltos (respuesta agente vs atributos OTel)
  const spanIntent = attr('wibsite.intent');
  const spanScore = attr('wibsite.score');
  const sameIntent = !spanIntent || String(spanIntent) === String(agent.intent);
  const sameScore = spanScore === undefined || Number(spanScore) === Number(agent.score);
  check('Sin pérdida: intent/score intactos entre saltos', sameIntent && sameScore,
    `respuesta intent=${agent.intent}/${agent.score} vs span intent=${spanIntent}/${spanScore}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n== Veredicto: ${results.length - failed}/${results.length} saltos completos ==`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(3); });
