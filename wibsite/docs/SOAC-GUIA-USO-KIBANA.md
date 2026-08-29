# SOAC · Guía de uso del Monitoreo en Kibana

> Estándar implementado en la instancia `wibsite-kibana` (Elastic Stack 9.4.2, licencia free).
> Alcance: Discover (13 vistas), Dashboards (4 + 1 heredado), Reglas de alerta (8), Data Views y Cases.
> Verificación viva: 29/08/2026 · Datos: logs-doags.otel-production (3,111 eventos/14d, ~4,7K totales).

---

## 1. Regla de oro para leer los datos

**Rango temporal**: todas las vistas/dashboards usan `@timestamp` (campo de tiempo real y saneado).
- Rango recomendado al abrir: **Last 14 days** (hay datos desde 2026-08-15; los días 22/26/27/29 no registran actividad de negocio = normal).
- `now-15m` (rango por defecto) muestra **0 resultados** la mayoría del tiempo: no es un error, es que los eventos de negocio se generan bajo demanda (webhooks/campañas/grafos).

**Notación de trazabilidad** (quiénes participan en cada señal):
| Campo | Significado |
|---|---|
| `wibsite.module` | Módulo emisor: `agentCore` (agentes IA), `channels` (mensajería), `multimodal` (STT/visión), `chatGroups` (grupos), `ui-e2e` (pruebas UI), `observability` (SOAC), `infrastructure` (servicios), `leads` (campañas) |
| `wibsite.flow` | Pipeline funcional: `grafo.comercial`, `multicanal.inbound/outbound`, `llm.classify`, `rag.kb`, `media.stt/vision`, `guards.confidentiality`, `group.assign`, `e2e.playwright`, endpoints API (`GET /api/...`) |
| `wibsite.action` | Paso concreto dentro del flujo (`graph.stage`, `webhook_received`, …) |
| `event.type` | `state_transition`, `api_call`, `error`, `webhook_received`, `security_alert`, `campaign_sent`, `fallback_activated`, `e2e_ui`, `e2e_trace`, `lead_created` |
| `wibsite.severity` | `high`/`medium` (asignadas por el emisor) |
| `wibsite.latency_ms` | Latencia en **milisegundos** (en traces: `duration` en **nanosegundos**) |
| `trace_id`/`span_id` | Correlación con spans OTel (wibsite-helper exporta 11K+ spans) |

---

## 2. Discover — 13 vistas y su objetivo de monitoreo

| # | Vista (título) | Query KQL | Objetivo de monitoreo | Qué mirar / Acción |
|---|---|---|---|---|
| 1 | **SOAC · Todas las Señales** | `(vacío)` | Visión maestra de toda la actividad; base para cualquier análisis | Toda columna de trazabilidad + `latency_ms` + `severity`. Punto de partida de investigación |
| 2 | **SOAC · Errores de Negocio** | `event.type: error` | **Salud operativa**: detectar fallos y su origen | Módulo/flujo/acción del fallo → si se concentra en `grafo.comercial` o `agentCore`, revisar alertas y el stack |
| 3 | **SOAC · Seguridad y Vigilancia** | `event.type: security_alert` | **Control de seguridad**: inyecciones, accesos no autorizados, guardias | Todo `security_alert` = incidente; generar Case y comprobar `guards.confidentiality` |
| 4 | **SOAC · Webhooks Multicanal** | `event.type: webhook_received` | **Ingesta**: mensajes entrantes por canal (Telegram/Chatwoot/Messenger) | `conversation_id` nuevo o repetido; volumen por canal en `wibsite.flow` |
| 5 | **SOAC · Degradaciones y Fallbacks** | `fallback_activated or media_degraded or hallucination_blocked` | **Resiliencia preventiva**: dependencias en modo degradado | `wibsite.dependency` indica qué servicio falló (Dify/n8n/Postgres/Redis/OpenRouter) |
| 6 | **SOAC · Campañas Enviadas** | `event.type: campaign_sent` | **CRM/Campañas**: disparos de campañas | Campañas que más corren, destinos y conversaciones asociadas |
| 7 | **SOAC · Pipeline de Venta** | `wibsite.flow: grafo.comercial` | **Proceso comercial**: el pipeline de venta completo | Etapas del grafo (greeting→apertura→analyze→calificacion→canal) con latencia por paso |
| 8 | **SOAC · RAG y Conocimiento** | `rag.kb or llm.classify or llm.group.classify` | **IA**: clasificación de intentos y uso de la base de conocimiento | Intención detectada (`attributes.wibsite.intent`), consultas a KB y sus latencias |
| 9 | **SOAC · Multimodal** | `media.stt or media.vision` | **IA multimodal**: transcripciones de audio y descripciones de imagen | Parseo STT/visión exitoso o degradado; revisar `media_degraded` |
| 10 | **SOAC · Operaciones Lentas (>2000ms)** | `wibsite.latency_ms > 2000` | **Rendimiento preventivo**: detectar degradaciones antes de que fallen | Flujos con latencia alta; comparar contra el patrón P95 (3,7s) del SOAC-02 |
| 11 | **SOAC · Pruebas E2E UI** | `event.type: e2e_ui` | **Calidad**: resultados del runner Playwright | `test.finished/failed/skipped` por suite; cruzar con la fase B del plan E2E |
| 12 | **SOAC · Grupos de Chat** | `wibsite.module: chatGroups` | **Inbox**: agrupación y asignación de conversaciones | `group.assign` – a quién se asignó y con qué latencia |
| 13 | **SOAC · Multicanal Saliente** | `wibsite.flow: multicanal.outbound` | **Entrega**: réplicas enviadas a canales | Latencia de envío por conversación; `webhook_failed` dispara alerta |

**Cómo usar**: Discover → Tabs (≪New tab≫) o guarda más vistas diferentes; filtros globales KQL útiles:
`wibsite.tenant_id: default` · `wibsite.severity: high` · `event.type: security_alert and wibsite.module: agentCore`.

---

## 3. Dashboards — 4 SOAC activos + 1 heredado

### SOAC-00 · Pre-Deploy & TeVS (Gates de Validación) — `now-30d`
**Objetivo**: control **pre-despliegue**; el runner TeVS publica sus resultados a ES (tevs-results, 228 en 30d).
| Panel | Uso |
|---|---|
| Resultados/Test únicos/Ejecuciones | Volumen y cobertura del catálogo de gates |
| Estado de ejecución (pie) | passed/failed/error del runner |
| Política de despliegue (pie) | `blocking=true` = gate que EVITA el deploy |
| Tabla de referencia por test | Test → estado → si bloquea; el detalle verificable |
| Actividad del runner por día | Frecuencia de ejecución (automation) |
| Controles por categoría | monitoring/deviation/security/agent… |

**Acción**: antes de tocar el stack → si hay `failed` + `blocking=true`, arreglar antes de desplegar.

### SOAC-01 · Overwatch de Módulos y Consultas — `now-14d`
**Objetivo**: **monitoreo proactivo en vivo** (qué está pasando).
- KPIs: Total eventos · Módulos activos · Conversaciones únicas.
- Tabla de referencia de módulos (verificación de variables).
- Pie tipos de evento · Barras por módulo · Tráfico por hora · Top 12 flujos.

### SOAC-02 · Detalle: Estados, Variaciones y Latencias — `now-14d`
**Objetivo**: **control preventivo de rendimiento** (cómo está).
- KPIs: P95 (3,7s) · P99 (6,2s) · Promedio (0,9s).
- Barras promedio/P95/P99 por flujo (comparativo) · Transiciones de estado · Distribución por tipo · Fallbacks por dependencia · Tendencias · Spans por instrumentación (wibsite-helper 11K).

### SOAC-03 · Drill-down por Flujo y Contexto — `now-14d`
**Objetivo**: **análisis a detalle** de un flujo/conversación.
- Filtre arriba con `wibsite.flow: grafo.comercial` o `wibsite.conversation_id: <id>`.
- KPIs del contexto · Línea de tiempo 30m · Acciones · Errores por acción · P95 en tiempo · **Tabla pasos del flujo** · Módulos y dependencias del contexto.

### DOAG-S: Observabilidad de Agentes (heredado)
⚠️ Dashboard legado con `panelsJSON` corrupto (JSON inválido). **No renderiza** — en desuso; usar SOAC-01/02.

---

## 4. Reglas de alerta (8 · todas activas · observar en *Observability → Alerts*)

| Regla | Disparo | Gravedad práctica | Acción al disparar |
|---|---|---|---|
| SOAC · Evento de seguridad | 1 `security_alert` en 5m | **CRÍTICO** | Crear Case; revisar guards/inyecciones |
| SOAC · Incidente/falla crítica | 1 `incident_opened`/`unauthorized_access`/`injection_blocked` en 5m | **CRÍTICO** | Crear Case; revisar acceso/logs |
| SOAC · Errores > 5 en 15m | >5 `error` | Alta | Revisar vista Errores; priorizar por módulo |
| SOAC · Latencia >2000ms | ≥3 operaciones >2s en 15m | Media (preventiva) | Comparar con P95 por flujo (SOAC-02) |
| SOAC · Errores en grafo comercial | ≥3 errores del flujo venta en 15m | Alta | Revisar Pipeline de Venta; pipeline afectado |
| SOAC · Fallos de IA/LLM (agentCore) | ≥2 errores del módulo en 15m | Alta | Revisar RAG/Multimodal y el router de agentes |
| SOAC · Webhook/rate-limit | ≥3 `webhook_failed`/`rate_limit_exceeded` en 30m | Media | Revisar Webhooks Multicanal; presupuestos de API |
| SOAC · Degradación de dependencias | ≥3 `fallback_activated`/`media_degraded` en 30m | Media | Revisar Degradaciones; dependencia indicada |

> Connectors (Slack/Telegram/email): pendiente — requieren credenciales externas. Las alertas viven en la UI de Alerts.

---

## 5. Data Views (objetos de datos)

| Data view | Índices | Uso |
|---|---|---|
| `doags-logs` | `logs-doags.otel-*` | Eventos de negocio (vistas/dashboards SOAC) |
| `doags-traces` | `traces-doags.otel-*` | Spans OTel (SOAC-02; wibsite-helper + Dify) |
| `doags-metrics` | `metrics-doags.otel-*` | Métricas de sistema (dify/http) |
| `tevs-results` | `tevs-results-*` | Gates TeVS (SOAC-00); timeField `timing.started_at` |
| `logs-*` / `traces-*` / `metrics-*` | legacy | Duplicadas/deprecadas — **no usar** (sugerida purga) |

---

## 6. Casos (Incidentes) — *Observability → Cases*

- Flujo funcional: crear caso → severity → tags → descripción; seguimiento por filtros de estado.
- 1 caso de ejemplo creado (verificación de la instancia).
- Asignación a usuarios / connectors externos: **requieren licencia** (free limita la creación/edición interna, que sí funciona).

---

## 7. Rutina operativa recomendada (30''/día)

1. **SOAC-00**: ¿algún gate `failed` con `blocking=true`? → sí: no desplegar; revisar test.
2. **SOAC-01**: 3 KPIs (tendencia de señales) + pie de tipos → ¿pico de `error` o `security_alert`?
3. **Observability → Alerts**: ¿algún CRÍTICO activo (seguridad/incidente)?
4. **SOAC-02**: P95/P99 vs ayer → si P99 sube >20%, revisar operaciones lentas.
5. **Discover (Errores + Latencia alta)**: 2 clics → confirmar el flujo afectado.

---

## 8. Notas de licencia y pendientes

- **SLOs**: bloqueados en free (requieren Platinum). Alternativa en uso: reglas + TeVS (`TEST-DEV-002`) + % del pie de eventos.
- **Cases**: asignaciones externas bloqueadas en free.
- **Connectors** de alertas: pendientes (credenciales).
- Dashboard V2 heredado: corrupto; migrar/reemplazar definitivo.
- `observed_timestamp` saneado (0 docs en 1970) y doc de prueba purgado (agosto 2026).
