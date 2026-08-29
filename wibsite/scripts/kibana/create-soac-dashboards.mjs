'use strict';
/**
 * create-soac-dashboards.mjs — Crea los dashboards SOAC-00/01/02/03 y las reglas
 * de alerta del sistema SOAC (DOAG-S). Modelo canónico Kibana 9.4 (type "vis" +
 * attributes.version 2, grid de 48 columnas). Todas las estructuras fueron
 * validadas contra objetos creados por la propia UI (metric/line/bar/area/pie/
 * datatable/percentile/average/unique_count).
 *
 * Uso:  node scripts/kibana/create-soac-dashboards.mjs
 */

const KIBANA_BASE = process.env.KIBANA_URL || 'http://localhost:5601/kibana';
const USER = process.env.ES_USER || 'elastic';
const PASS = process.env.ES_PASSWORD;
if (!PASS) throw new Error('ES_PASSWORD de entorno es obligatorio: set ES_PASSWORD=<elastic password>');

const auth = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const headers = { 'Content-Type': 'application/json', 'kbn-xsrf': 'true', Authorization: auth };

async function kbn(path, method = 'GET', body) {
  const res = await fetch(KIBANA_BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`KIBANA ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const DV_LOGS = 'doags-logs';
const DV_TRACES = 'doags-traces';
const DV_TEVS = 'tevs-results';

// ─── Columnas Lens (formato canónico 9.x) ───────────────────────────────────
const countCol = (id, label) => ({
  [id]: { label, dataType: 'number', operationType: 'count', sourceField: '___records___', isBucketed: false, params: { emptyAsNull: true } },
});

const termsCol = (id, field, label, orderByCol, size = 10) => ({
  [id]: {
    label, dataType: 'string', operationType: 'terms', sourceField: field, isBucketed: true,
    params: { size, orderBy: { columnId: orderByCol, type: 'column' }, orderDirection: 'desc', otherBucket: true, missingBucket: false },
  },
});

const dateHistCol = (id, label, interval = 'auto', field = '@timestamp') => ({
  [id]: {
    label, dataType: 'date', operationType: 'date_histogram', sourceField: field,
    isBucketed: true, params: { interval, includeEmptyRows: true, dropPartials: false },
  },
});

const pctCol = (id, field, label, p) => ({
  [id]: {
    label, dataType: 'number', operationType: 'percentile', sourceField: field, isBucketed: false,
    params: { percentile: p, isApproximate: true },
  },
});

const uniqueCol = (id, field, label) => ({
  [id]: { label, dataType: 'number', operationType: 'unique_count', sourceField: field, isBucketed: false, params: { emptyAsNull: true } },
});

const avgCol = (id, field, label) => ({
  [id]: { label, dataType: 'number', operationType: 'average', sourceField: field, isBucketed: false, params: { emptyAsNull: true } },
});

// ─── Panel canónico "vis" (grid 48: x/w se duplican) ────────────────────────
let seed = 0;
const uid = () => `p-${++seed}-${Math.random().toString(36).slice(2, 10)}`;

function visPanel(dv, vizType, visualization, columns, columnOrder, { title, panelIndex, x = 0, y = 0, w = 24, h = 12, layer, panelQuery = '' } = {}) {
  const layerId = layer || uid();
  const viz = Array.isArray(visualization.layers)
    ? { ...visualization, layers: visualization.layers.map((l) => ({ ...l, layerId, layerType: 'data' })) }
    : { ...visualization, layerId, layerType: 'data' };
  return {
    type: 'vis',
    panelIndex,
    gridData: { x, y, w, h, i: panelIndex },
    embeddableConfig: {
      attributes: {
        title: title || '',
        visualizationType: vizType,
        references: [{ type: 'index-pattern', id: dv, name: `indexpattern-datasource-layer-${layerId}` }],
        state: {
          visualization: viz,
          query: { query: panelQuery, language: 'kuery' },
          filters: [],
          datasourceStates: {
            formBased: {
              layers: {
                [layerId]: {
                  indexPatternId: dv, columns, columnOrder,
                  incompleteColumns: {}, sampling: 1,
                },
              },
            },
            indexpattern: { layers: {} },
            textBased: { layers: {} },
          },
          internalReferences: [],
          adHocDataViews: {},
        },
        version: 2,
      },
      drilldowns: [],
    },
  };
}

const metricPanel = (dv, colObj, title, color, opts = {}) =>
  visPanel(dv, 'lnsMetric', { metricAccessor: 'm', color }, colObj, ['m'],
    { panelIndex: uid(), title, w: 16, h: 7, ...opts });

const xyPanel = (dv, seriesType, xCol, accs, columns, columnOrder, title, opts = {}) => {
  const v = {
    legend: { isVisible: true, position: 'bottom', layout: 'list' },
    valueLabels: 'hide', fittingFunction: 'None',
    axisTitlesVisibilitySettings: { x: false, yLeft: true, yRight: true },
    tickLabelsVisibilitySettings: { x: true, yLeft: true, yRight: true },
    labelsOrientation: { x: 0, yLeft: 0, yRight: 0 },
    gridlinesVisibilitySettings: { x: true, yLeft: true, yRight: true },
    preferredSeriesType: seriesType,
    layers: [{
      accessors: accs, seriesType, position: 'top', showGridlines: false,
      colorMapping: { assignments: [], specialAssignments: [{ rules: [{ type: 'other' }], color: { type: 'loop' }, touched: false }], paletteId: 'elastic_line_optimized', colorMode: { type: 'categorical' } },
      xAccessor: xCol,
    }],
  };
  return visPanel(dv, 'lnsXY', v, columns, columnOrder, { panelIndex: uid(), title, ...opts });
};

const piePanel = (dv, groups, metrics, columns, columnOrder, title, opts = {}) => {
  const v = {
    shape: 'pie',
    layers: [{
      primaryGroups: groups, metrics,
      numberDisplay: 'percent', categoryDisplay: 'default', legendDisplay: 'default', nestedLegend: false,
      colorMapping: { assignments: [], specialAssignments: [{ rules: [{ type: 'other' }], color: { type: 'loop' }, touched: false }], paletteId: 'elastic_line_optimized', colorMode: { type: 'categorical' } },
    }],
  };
  return visPanel(dv, 'lnsPie', v, columns, columnOrder, { panelIndex: uid(), title, ...opts });
};

const tablePanel = (dv, columns, columnOrder, title, colsW, opts = {}) => {
  const v = {
    columns: colsW,
    rowHeight: 26, headerRowHeight: 28, fontSize: 14, hide: [], flattenRow: false,
  };
  return visPanel(dv, 'lnsDatatable', v, columns, columnOrder, { panelIndex: uid(), title, ...opts });
};

// ─── SOAC-00 · Pre-Deploy / TeVS (validación previa al despliegue) ──────────
const soac00 = [];
soac00.push(
  metricPanel(DV_TEVS, countCol('m', 'Resultados registrados'), 'Resultados TeVS registrados (30d)', '#6DCCB1', { x: 0, y: 0 }),
  metricPanel(DV_TEVS, uniqueCol('m', 'test.test_id', 'Tests evaluados'), 'Tests únicos del catálogo', '#F1D86F', { x: 16, y: 0 }),
  metricPanel(DV_TEVS, uniqueCol('m', 'execution.execution_id', 'Ejecuciones'), 'Ejecuciones del runner', '#FF9966', { x: 32, y: 0 }),
  piePanel(DV_TEVS, ['b'], ['m'],
    { ...termsCol('b', 'execution.status', 'Estado de ejecución', 'm', 6), ...countCol('m', 'Resultados') }, ['b', 'm'],
    'Estado de ejecución (passed/failed/error)', { w: 16, h: 14, x: 0, y: 7 }),
  piePanel(DV_TEVS, ['d'], ['c'],
    { ...termsCol('d', 'deployment_policy.blocking', 'Bloqueo de deploy', 'c', 4), ...countCol('c', 'Resultados') }, ['d', 'c'],
    'Política de despliegue (blocking=true evita deploy)', { w: 16, h: 14, x: 16, y: 7 }),
  tablePanel(DV_TEVS,
    { ...termsCol('t', 'test.test_id', 'Test (código)', 'c', 15), ...termsCol('s', 'execution.status', 'Estado', 'c', 4), ...termsCol('b', 'deployment_policy.blocking', 'Bloquea deploy', 'c', 2), ...countCol('c', 'Resultados') },
    ['t', 's', 'b', 'c'],
    'Tabla de referencia: resultado por test del catálogo TeVS',
    [{ columnId: 't', width: 180 }, { columnId: 's', width: 110 }, { columnId: 'b', width: 130 }, { columnId: 'c', width: 110 }],
    { w: 24, h: 14, x: 32, y: 7, layer: 'tevs-tabla' }),
  xyPanel(DV_TEVS, 'bar_stacked', 't', ['m'],
    { ...dateHistCol('t', 'Día', '1d', 'timing.started_at'), ...countCol('m', 'Resultados') }, ['t', 'm'],
    'Actividad del runner TeVS por día (campo de tiempo: timing.started_at)', { w: 24, h: 13, x: 0, y: 21 }),
  xyPanel(DV_TEVS, 'bar_horizontal', 'b', ['m'],
    { ...termsCol('b', 'test.category', 'Categoría de control', 'm', 8), ...countCol('m', 'Resultados') }, ['b', 'm'],
    'Controles ejecutados por categoría (monitoring/deviation/security/agent/...)', { w: 24, h: 13, x: 24, y: 21 }),
);

// ─── SOAC-01 · Overwatch (simple: módulos, consultas, flujos) ───────────────
const soac01 = [];
soac01.push(
  metricPanel(DV_LOGS, countCol('m', 'Eventos'), 'Total de Eventos del sistema (14d) · Todas las señales de negocio: transiciones de estado, llamadas API, webhooks, errores y seguridad', '#6DCCB1', { x: 0, y: 0 }),
  metricPanel(DV_LOGS, uniqueCol('m', 'wibsite.module', 'Módulos activos'), 'Módulos activos · agentCore, channels, multimodal, chatGroups, ui-e2e, observability, infrastructure, leads', '#F1D86F', { x: 16, y: 0 }),
  metricPanel(DV_LOGS, uniqueCol('m', 'wibsite.conversation_id', 'Conversaciones'), 'Conversaciones únicas · Sesiones de diálogo (Canal ↔ Agente IA) que generaron señales', '#FF9966', { x: 32, y: 0 }),
  tablePanel(DV_LOGS,
    { ...termsCol('m', 'wibsite.module', 'Módulo', 'c', 10), ...countCol('c', 'Eventos') },
    ['m', 'c'],
    'Tabla de referencia: actividad por Módulo · Verifique aquí qué valor representa cada variable',
    [{ columnId: 'm', width: 220 }, { columnId: 'c', width: 130 }],
    { w: 24, h: 14, x: 0, y: 7 }),
  piePanel(DV_LOGS, ['b'], ['m'],
    { ...termsCol('b', 'event.type', 'Tipo de evento', 'm', 12), ...countCol('m', 'Eventos') }, ['b', 'm'],
    'Distribución por Tipo de Evento · state_transition=<cambio de etapa del flujo> · api_call=<llamada REST> · error=<fallo> · webhook_received=<mensaje entrante> · security_alert=<vigilancia> · campaign_sent=<campaña> · fallback_activated=<degradación de dependencia>',
    { w: 24, h: 14, x: 24, y: 7 }),
  xyPanel(DV_LOGS, 'bar_stacked', 't', ['m'],
    { ...dateHistCol('t', 'Hora', '1h'), ...countCol('m', 'Eventos') }, ['t', 'm'],
    'Tráfico por hora (14d) · Detecte caídas o picos de actividad del stack',
    { w: 24, h: 13, x: 0, y: 21 }),
  xyPanel(DV_LOGS, 'bar_horizontal', 'b', ['m'],
    { ...termsCol('b', 'wibsite.flow', 'Flujo', 'm', 12), ...countCol('m', 'Eventos') }, ['b', 'm'],
    'Top 12 Flujos de Negocio · grafo.comercial=<pipeline venta> · multicanal.inbound/outbound=<mensajería> · llm.classify=<clasificación IA> · rag.kb=<conocimiento> · media.stt/vision=<multimodal> · guards.confidentiality=<seguridad> · e2e.playwright=<pruebas UI>',
    { w: 24, h: 13, x: 24, y: 21 }),
);

// ─── SOAC-02 · Detalle (estados, variaciones, latencias) ────────────────────
const soac02 = [];
soac02.push(
  metricPanel(DV_LOGS, pctCol('m', 'wibsite.latency_ms', 'P95'), 'P95 de latencia (ms) · El 95% de las operaciones tardaron menos que este valor', '#6DCCB1', { x: 0, y: 0 }),
  metricPanel(DV_LOGS, pctCol('m', 'wibsite.latency_ms', 'P99'), 'P99 de latencia (ms) · Peor caso excluyendo el 1% más extremo', '#F1D86F', { x: 16, y: 0 }),
  metricPanel(DV_LOGS, avgCol('m', 'wibsite.latency_ms', 'Promedio'), 'Latencia promedio (ms) · Valor típico por operación de negocio', '#8ABF4D', { x: 32, y: 0 }),
  xyPanel(DV_LOGS, 'bar_horizontal', 'b', ['a', 'p95', 'p99'],
    {
      ...termsCol('b', 'wibsite.flow', 'Flujo de negocio', 'p95', 12),
      ...avgCol('a', 'wibsite.latency_ms', 'Promedio (ms)'),
      ...pctCol('p95', 'wibsite.latency_ms', 'P95 (ms)', 95),
      ...pctCol('p99', 'wibsite.latency_ms', 'P99 (ms)', 99),
    },
    ['b', 'a', 'p95', 'p99'],
    'Latencia promedio / P95 / P99 por Flujo (ms) · Comparativo del rendimiento entre pipelines',
    { w: 48, h: 14, x: 0, y: 7 }),
  xyPanel(DV_LOGS, 'bar_horizontal', 'b', ['m'],
    { ...termsCol('b', 'wibsite.action', 'Etapa', 'm', 12), ...countCol('m', 'Transiciones') }, ['b', 'm'],
    'Etapas de transición de estado (event.type=state_transition) · Etapas reales que recorre el grafo comercial',
    { w: 24, h: 13, x: 0, y: 21 }),
  piePanel(DV_LOGS, ['d'], ['c'],
    { ...termsCol('d', 'event.type', 'Tipo', 'c', 12), ...countCol('c', 'Eventos') }, ['d', 'c'],
    'Distribución por tipo (relacionada con estados y variaciones)',
    { w: 24, h: 13, x: 24, y: 21 }),
  xyPanel(DV_LOGS, 'bar_horizontal', 'b', ['m'],
    { ...termsCol('b', 'wibsite.dependency', 'Dependencia', 'm', 8), ...countCol('m', 'Fallbacks') }, ['b', 'm'],
    'Fallbacks por dependencia (event.type=fallback_activated) · Degradaciones de Dify/n8n/Postgres/Redis/OpenRouter y demás servicios',
    { w: 24, h: 13, x: 0, y: 34 }),
  xyPanel(DV_LOGS, 'area', 't', ['m'],
    { ...dateHistCol('t', 'Hora', '1h'), ...countCol('m', 'Eventos') }, ['t', 'm'],
    'Tendencia general de eventos (area) · Referencia de la variación de actividad',
    { w: 24, h: 13, x: 24, y: 34 }),
  xyPanel(DV_TRACES, 'bar_horizontal', 'b', ['m'],
    { ...termsCol('b', 'scope.name', 'Instrumentación (scope)', 'm', 10), ...countCol('m', 'Spans') }, ['b', 'm'],
    'Spans por instrumentación (scope.name) · wibsite-helper=flujos del helper, redis/sqlalchemy=Dify, etc.', { w: 32, h: 12, x: 0, y: 47 }),
  metricPanel(DV_TRACES, pctCol('m', 'duration', 'P95 span'), 'P95 duración de span (ns) · 1.000.000 ns = 1 ms', '#6DCCB1', { w: 16, h: 12, x: 32, y: 47 }),
);

// ─── SOAC-03 · Drill-down por flujo/contexto ────────────────────────────────
const soac03 = [];
soac03.push(
  metricPanel(DV_LOGS, countCol('m', 'Eventos'), 'Eventos del flujo · Filtre arribe con wibsite.flow=grafo.comercial o multicanal.inbound', '#6DCCB1', { x: 0, y: 0 }),
  metricPanel(DV_LOGS, uniqueCol('m', 'wibsite.conversation_id', 'Conversaciones'), 'Conversaciones únicas del contexto filtrado', '#F1D86F', { x: 16, y: 0 }),
  metricPanel(DV_LOGS, pctCol('m', 'wibsite.latency_ms', 'P95'), 'P95 de latencia (ms) del contexto filtrado', '#EF8C8C', { x: 32, y: 0 }),
  xyPanel(DV_LOGS, 'bar_stacked', 't', ['m'],
    { ...dateHistCol('t', 'Hora', '30m'), ...countCol('m', 'Eventos') }, ['t', 'm'],
    'Línea de tiempo (buckets de 30m) · Secuencia temporal del flujo',
    { w: 24, h: 13, x: 0, y: 7 }),
  piePanel(DV_LOGS, ['a'], ['c'],
    { ...termsCol('a', 'wibsite.action', 'Acción', 'c', 12), ...countCol('c', 'Eventos') }, ['a', 'c'],
    'Acciones del flujo · Ver el pipeline lógico en vivo (webhook_received ⇒ graph.stage ⇒ channel.reply)',
    { w: 24, h: 13, x: 24, y: 7 }),
  xyPanel(DV_LOGS, 'bar_horizontal', 'b', ['m'],
    { ...termsCol('b', 'wibsite.action', 'Acción', 'm', 12), ...countCol('m', 'Errores') }, ['b', 'm'],
    'Errores por acción (event.type=error) · Localice qué paso del flujo está fallando',
    { w: 24, h: 13, x: 0, y: 20 }),
  xyPanel(DV_LOGS, 'line', 't', ['q'],
    { ...dateHistCol('t', 'Hora', '30m'), ...pctCol('q', 'wibsite.latency_ms', 'P95', 95) }, ['t', 'q'],
    'P95 de latencia en el tiempo · Detecte degradaciones progresivas del flujo',
    { w: 24, h: 13, x: 24, y: 20 }),
  tablePanel(DV_LOGS,
    { ...termsCol('a', 'wibsite.action', 'Acción (paso)', 'c', 15), ...termsCol('m', 'wibsite.module', 'Módulo', 'c', 10), ...countCol('c', 'Eventos') },
    ['a', 'm', 'c'],
    'Tabla de referencia: pasos del flujo agrupados · Verificación detallada de la secuencia',
    [{ columnId: 'a', width: 200 }, { columnId: 'm', width: 180 }, { columnId: 'c', width: 120 }],
    { w: 48, h: 14, x: 0, y: 33 }),
  xyPanel(DV_LOGS, 'bar_horizontal', 'b', ['m'],
    { ...termsCol('b', 'wibsite.module', 'Módulo', 'm', 10), ...countCol('m', 'Eventos') }, ['b', 'm'],
    'Módulos involucrados en el flujo',
    { w: 24, h: 12, x: 0, y: 47 }),
  xyPanel(DV_LOGS, 'bar_horizontal', 'b', ['m'],
    { ...termsCol('b', 'wibsite.dependency', 'Dependencia', 'm', 10), ...countCol('m', 'Eventos') }, ['b', 'm'],
    'Dependencias consumidas por el flujo · Identifique qué servicios externos toca',
    { w: 24, h: 12, x: 24, y: 47 }),
);

const dashboards = [
  {
    id: 'soac-00-predeploy-tevs', title: 'SOAC-00 · Pre-Deploy & TeVS (Gates de Validación)',
    description: 'Monitoreo preventivo y de pre-despliegue: resultados del runner TeVS (13+ tests de SOAC: salud de ES/Kibana, agentes LLM, multicanal, correlación trace-logs, error-rate, presupuestos, alucinación, seguridad y retención). Cada corrida publica resultados a ES (tevs-results). Verifique el estado de los gates antes de tocar el stack.',
    timeFrom: 'now-30d', panels: soac00,
  },
  {
    id: 'soac-01-modulos-overwatch', title: 'SOAC-01 · Overwatch de Módulos y Consultas',
    description: 'Vista simple (proactiva): total de señales, módulos activos, conversaciones y distribución por tipo de evento. Tabla de referencia para verificar el valor de cada variable. Guía de módulos: agentCore=Core de Agentes IA, ui-e2e=pruebas de interfaz, channels=mensajería multicanal, multimodal=STT/visión, chatGroups=grupos de chat, observability=SOAC, infrastructure=servicios, leads=campañas.',
    timeFrom: 'now-14d', panels: soac01,
  },
  {
    id: 'soac-02-detalle-estados-latencia', title: 'SOAC-02 · Detalle: Estados, Variaciones y Latencias',
    description: 'Vista detallada: latencia promedio/P95/P99 por flujo, etapas de transición de estado, fallbacks por dependencia, tendencias y spans por servicio. Las unidades de latencia registradas en logs son milisegundos (wibsite.latency_ms); en spans, nanosegundos (duration).',
    timeFrom: 'now-14d', panels: soac02,
  },
  {
    id: 'soac-03-drilldown-flujo-contexto', title: 'SOAC-03 · Drill-down por Flujo y Contexto',
    description: 'Análisis a detalle por flujo/conversación: filtre arriba con wibsite.flow (ej. grafo.comercial, multicanal.inbound, llm.classify, rag.kb, media.stt, media.vision, guards.confidentiality) o wibsite.conversation_id. Muestra la secuencia de pasos, errores y latencias del contexto elegido.',
    timeFrom: 'now-14d', panels: soac03,
  },
];

const alertRules = [
  {
    name: 'SOAC · Errores > 5 en 15m',
    rule_type_id: '.es-query', consumer: 'alerts', tags: ['soac', 'monitoring'], schedule: { interval: '5m' },
    actions: [], notify_when: 'onActionGroupChange',
    params: {
      index: ['logs-doags.otel-production'], timeField: '@timestamp', searchType: 'esQuery',
      esQuery: JSON.stringify({ query: { term: { 'event.type': 'error' } } }),
      threshold: [5], thresholdComparator: '>', timeWindowSize: 15, timeWindowUnit: 'm', size: 100,
    },
  },
  {
    name: 'SOAC · Evento de seguridad (CRITICO)',
    rule_type_id: '.es-query', consumer: 'alerts', tags: ['soac', 'security'], schedule: { interval: '5m' },
    actions: [], notify_when: 'onActionGroupChange',
    params: {
      index: ['logs-doags.otel-production'], timeField: '@timestamp', searchType: 'esQuery',
      esQuery: JSON.stringify({ query: { term: { 'event.type': 'security_alert' } } }),
      threshold: [1], thresholdComparator: '>=', timeWindowSize: 5, timeWindowUnit: 'm', size: 10,
    },
  },
  {
    name: 'SOAC · Webhook fallido / rate-limit >= 3 en 30m',
    rule_type_id: '.es-query', consumer: 'alerts', tags: ['soac', 'channels'], schedule: { interval: '5m' },
    actions: [], notify_when: 'onActionGroupChange',
    params: {
      index: ['logs-doags.otel-production'], timeField: '@timestamp', searchType: 'esQuery',
      esQuery: JSON.stringify({ query: { bool: { filter: [{ terms: { 'event.type': ['webhook_failed', 'rate_limit_exceeded', 'webhook_rejected'] } }] } } }),
      threshold: [3], thresholdComparator: '>=', timeWindowSize: 30, timeWindowUnit: 'm', size: 10,
    },
  },
  {
    name: 'SOAC · Incidente/falla crítica (CRITICO)',
    rule_type_id: '.es-query', consumer: 'alerts', tags: ['soac', 'incident'], schedule: { interval: '5m' },
    actions: [], notify_when: 'onActionGroupChange',
    params: {
      index: ['logs-doags.otel-production'], timeField: '@timestamp', searchType: 'esQuery',
      esQuery: JSON.stringify({ query: { bool: { filter: [{ terms: { 'event.type': ['incident_opened', 'unauthorized_access', 'injection_blocked'] } }] } } }),
      threshold: [1], thresholdComparator: '>=', timeWindowSize: 5, timeWindowUnit: 'm', size: 10,
    },
  },
  {
    name: 'SOAC · Latencia de negocio > 2000ms (>=3 en 15m)',
    rule_type_id: '.es-query', consumer: 'alerts', tags: ['soac', 'performance'], schedule: { interval: '5m' },
    actions: [], notify_when: 'onActionGroupChange',
    params: {
      index: ['logs-doags.otel-production'], timeField: '@timestamp', searchType: 'esQuery',
      esQuery: JSON.stringify({ query: { bool: { filter: [{ exists: { field: 'wibsite.latency_ms' } }, { range: { 'wibsite.latency_ms': { gt: 2000 } } }] } } }),
      threshold: [3], thresholdComparator: '>=', timeWindowSize: 15, timeWindowUnit: 'm', size: 50,
    },
  },
  {
    name: 'SOAC · Errores en grafo comercial (>=3 en 15m)',
    rule_type_id: '.es-query', consumer: 'alerts', tags: ['soac', 'sales', 'flows'], schedule: { interval: '5m' },
    actions: [], notify_when: 'onActionGroupChange',
    params: {
      index: ['logs-doags.otel-production'], timeField: '@timestamp', searchType: 'esQuery',
      esQuery: JSON.stringify({ query: { bool: { filter: [{ term: { 'event.type': 'error' } }, { term: { 'wibsite.flow': 'grafo.comercial' } }] } } }),
      threshold: [3], thresholdComparator: '>=', timeWindowSize: 15, timeWindowUnit: 'm', size: 50,
    },
  },
  {
    name: 'SOAC · Fallos de IA/LLM (agentCore) >=2 en 15m',
    rule_type_id: '.es-query', consumer: 'alerts', tags: ['soac', 'ai', 'llm'], schedule: { interval: '5m' },
    actions: [], notify_when: 'onActionGroupChange',
    params: {
      index: ['logs-doags.otel-production'], timeField: '@timestamp', searchType: 'esQuery',
      esQuery: JSON.stringify({ query: { bool: { filter: [{ term: { 'event.type': 'error' } }, { term: { 'wibsite.module': 'agentCore' } }] } } }),
      threshold: [2], thresholdComparator: '>=', timeWindowSize: 15, timeWindowUnit: 'm', size: 50,
    },
  },
  {
    name: 'SOAC · Degradacion de dependencias (fallback/media_degraded)',
    rule_type_id: '.es-query', consumer: 'alerts', tags: ['soac', 'ai'], schedule: { interval: '5m' },
    actions: [], notify_when: 'onActionGroupChange',
    params: {
      index: ['logs-doags.otel-production'], timeField: '@timestamp', searchType: 'esQuery',
      esQuery: JSON.stringify({ query: { bool: { filter: [{ terms: { 'event.type': ['fallback_activated', 'media_degraded', 'hallucination_blocked'] } }] } } }),
      threshold: [3], thresholdComparator: '>=', timeWindowSize: 30, timeWindowUnit: 'm', size: 10,
    },
  },
];

const dashPayload = (d) => ({
  title: d.title,
  description: d.description,
  timeRestore: true,
  timeTo: 'now',
  timeFrom: d.timeFrom,
  refreshInterval: { pause: false, value: 30000 },
  kibanaSavedObjectMeta: { searchSourceJSON: JSON.stringify({ query: { language: 'kuery', query: '' }, filter: [] }) },
  optionsJSON: JSON.stringify({ useMargins: true, syncColors: true, syncCursor: true, syncTooltips: true, hidePanelTitles: false }),
  panelsJSON: JSON.stringify(d.panels),
});

async function apiDelete(id) {
  await fetch(`${KIBANA_BASE}/api/saved_objects/dashboard/${id}`, { method: 'DELETE', headers });
}

async function main() {
  console.log('→ Creando dashboards SOAC (formato canónico vis/v2, grid 48)...');
  for (const d of dashboards) {
    await apiDelete(d.id).catch(() => {});
    await kbn(`/api/saved_objects/dashboard/${d.id}?overwrite=true`, 'POST', { attributes: dashPayload(d) });
    console.log(`  ✅ ${d.id}`);
  }
  console.log('→ Reglas de alerta (idempotente)...');
  const existing = await kbn('/api/alerting/rules/_find?per_page=100');
  const names = new Set((existing?.data || []).map((r) => r.name));
  for (const r of alertRules) {
    if (names.has(r.name)) { console.log(`  ⏭ ${r.name} (ya existe)`); continue; }
    await kbn('/api/alerting/rule', 'POST', r);
    console.log(`  ✅ ${r.name}`);
  }
  console.log('OK');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
