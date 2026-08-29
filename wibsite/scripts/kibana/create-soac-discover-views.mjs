'use strict';
/**
 * create-soac-discover-views.mjs — Crea/actualiza las vistas guardadas (saved
 * searches) de Discover del sistema SOAC. Idempotente (overwrite por id).
 *
 * Uso:  node scripts/kibana/create-soac-discover-views.mjs
 */

const KIBANA_BASE = process.env.KIBANA_URL || 'http://localhost:5601/kibana';
const USER = process.env.ES_USER || 'elastic';
const PASS = process.env.ES_PASSWORD;
if (!PASS) throw new Error('ES_PASSWORD de entorno es obligatorio: set ES_PASSWORD=<elastic password>');
const DV = process.env.SOAC_DATA_VIEW || 'doags-logs';

const auth = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const headers = { 'Content-Type': 'application/json', 'kbn-xsrf': 'true', Authorization: auth };

const TS_COLS = ['@timestamp', 'event.type', 'wibsite.module', 'wibsite.flow', 'wibsite.action', 'wibsite.latency_ms', 'wibsite.severity', 'body.text'];

const views = [
  {
    id: 'soac-search-errores', title: 'SOAC · Errores de Negocio',
    desc: 'Todos los fallos del sistema (event.type=error): módulo, flujo, acción, severidad y mensaje. Verificación de la salud operativa.',
    query: 'event.type: error',
    columns: ['@timestamp', 'wibsite.module', 'wibsite.flow', 'wibsite.action', 'wibsite.severity', 'body.text'],
  },
  {
    id: 'soac-search-seguridad', title: 'SOAC · Seguridad y Vigilancia',
    desc: 'Alertas de seguridad/vigilancia (event.type=security_alert): inyecciones, accesos no autorizados y eventos de guardias (guards.confidentiality).',
    query: 'event.type: security_alert',
    columns: ['@timestamp', 'wibsite.module', 'wibsite.flow', 'wibsite.action', 'wibsite.severity', 'body.text'],
  },
  {
    id: 'soac-search-webhooks-multicanal', title: 'SOAC · Webhooks Multicanal',
    desc: 'Mensajes entrantes por canal (webhook_received): Telegram, Chatwoot, Messenger, SMS. Consulte el canal en wibsite.flow (multicanal.inbound).',
    query: 'event.type: webhook_received',
    columns: ['@timestamp', 'wibsite.flow', 'wibsite.conversation_id', 'wibsite.request_id', 'body.text'],
  },
  {
    id: 'soac-search-degradaciones', title: 'SOAC · Degradaciones y Fallbacks',
    desc: 'Dependencias en modo degradado (fallback_activated) y alucinaciones bloqueadas. Control preventivo de la resiliencia del stack.',
    query: 'event.type: fallback_activated or event.type: media_degraded or event.type: hallucination_blocked',
    columns: ['@timestamp', 'wibsite.dependency', 'wibsite.module', 'wibsite.severity', 'body.text'],
  },
  {
    id: 'soac-search-campanas', title: 'SOAC · Campañas Enviadas',
    desc: 'Disparos de campañas de mensajería (campaign_sent): volumen y destinos por campaña.',
    query: 'event.type: campaign_sent',
    columns: ['@timestamp', 'wibsite.flow', 'wibsite.conversation_id', 'body.text'],
  },
  {
    id: 'soac-search-todas-senales', title: 'SOAC · Todas las Señales',
    desc: 'Todos los eventos de negocio (transiciones de estado, llamadas API, webhooks, errores, seguridad): columna por columna con la trazabilidad quién→qué→cómo→módulo→proceso.',
    query: '',
    columns: TS_COLS,
  },
  {
    id: 'soac-search-grafo-comercial', title: 'SOAC · Pipeline de Venta (grafo.comercial)',
    desc: 'Flujo comercial completo: desde webhook entrante hasta transiciones de etapa (greeting→apertura→analyze→calificacion→canal) con latencia por paso.',
    query: 'wibsite.flow: grafo.comercial',
    columns: TS_COLS,
  },
  {
    id: 'soac-search-rag-conocimiento', title: 'SOAC · RAG y Conocimiento (rag.kb / llm.classify)',
    desc: 'Clasificación de intentos (llm.classify) y consultas a la base de conocimiento (rag.kb): qué intención se detectó y si el conocimiento respondió.',
    query: 'wibsite.flow: rag.kb or wibsite.flow: llm.classify or wibsite.flow: llm.group.classify',
    columns: TS_COLS,
  },
  {
    id: 'soac-search-multimodal', title: 'SOAC · Multimodal (STT / Visión)',
    desc: 'Procesamiento de audio (media.stt) e imágenes (media.vision): transcripciones, descripciones, degradaciones y latencias.',
    query: 'wibsite.flow: media.stt or wibsite.flow: media.vision',
    columns: TS_COLS,
  },
  {
    id: 'soac-search-latencia-alta', title: 'SOAC · Operaciones Lentas (>2000ms)',
    desc: 'Todas las operaciones de negocio con latencia superior a 2 segundos. Control preventivo: identifique flujos que se degradan antes de que fallen.',
    query: 'wibsite.latency_ms > 2000',
    columns: ['@timestamp', 'wibsite.module', 'wibsite.flow', 'wibsite.action', 'wibsite.latency_ms', 'body.text'],
  },
  {
    id: 'soac-search-e2e-ui', title: 'SOAC · Pruebas E2E de Interfaz (e2e_ui)',
    desc: 'Resultados del runner Playwright (e2e_ui): test.finished/failed/skipped por suite; cruce con el reporter SOAC de UI.',
    query: 'event.type: e2e_ui',
    columns: TS_COLS,
  },
  {
    id: 'soac-search-grupos-chat', title: 'SOAC · Grupos de Chat (chatGroups)',
    desc: 'Asignación de conversaciones a grupos (group.assign) y otras señales del módulo de grupos de chat.',
    query: 'wibsite.module: chatGroups',
    columns: TS_COLS,
  },
  {
    id: 'soac-search-multicanal-salida', title: 'SOAC · Multicanal Saliente (multicanal.outbound)',
    desc: 'Respuestas y réplicas enviadas a canales (multicanal.outbound): latencia de envío por canal y conversación.',
    query: 'wibsite.flow: multicanal.outbound',
    columns: ['@timestamp', 'wibsite.flow', 'wibsite.conversation_id', 'wibsite.latency_ms', 'body.text'],
  },
];

async function run() {
  console.log('→ Creando/actualizando vistas de Discover (saved searches)...');
  for (const v of views) {
    const attrs = {
      title: v.title,
      description: v.desc,
      hits: 0,
      columns: v.columns,
      sort: [['@timestamp', 'desc']],
      version: 1,
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          query: { query: v.query, language: 'kuery' },
          filter: [],
          indexRefName: 'kibanaSavedObjectMeta.searchSourceJSON.index',
        }),
      },
    };
    const r = await fetch(`${KIBANA_BASE}/api/saved_objects/search/${v.id}?overwrite=true`, {
      method: 'POST', headers,
      body: JSON.stringify({ attributes: attrs, references: [{ type: 'index-pattern', id: DV, name: 'kibanaSavedObjectMeta.searchSourceJSON.index' }] }),
    });
    const t = await r.text();
    if (r.ok) console.log(`  ✅ ${v.id}`);
    else console.log(`  ❌ ${v.id} → ${t.slice(0, 150)}`);
  }
  console.log('OK');
}

run().catch((e) => { console.error('❌', e.message); process.exit(1); });
