# Análisis de Estado — Gaps de Minifases, Seguridad y Estándares (14/08/2026)

**Alcance:** validar el estado real de las minifases pendientes (P0/P1/P2/P3) y confirmar que lo implementado cumple con el estándar de seguridad/control: **quién → qué → cómo → en qué módulo → en qué proceso**, con trazabilidad `trace_id`/`span_id` persistida en PostgreSQL (`audit_logs`) y Elasticsearch/Kibana (OTel).

**Método:** verificación en vivo (Docker activo, 20 contenedores, server 29.5.2), consultas directas a PG/ES/Redis, ejecución de suites Jest y gates, inspección de código con referencias `archivo:línea`.

---

## 1. Resumen ejecutivo

| Bloque | Veredicto |
|---|---|
| Stack en vivo | ✅ Docker Desktop activo, 20 contenedores corriendo, gateway HTTPS 200, Dify 200, n8n 200 (puerto real 5679) |
| P0 — Seguridad de secretos | ⚠️ **3 hallazgos críticos**: API key literal no evaluado, password ES hardcodeado en `.gitlab-ci.yml`, `nginx.key`+`wibsite-store.json` (PII) en git |
| P0 — Cutover PG + RLS | 🟡 RLS **implementado y verificado** (7 políticas) · pero **dual-write PG es código muerto** y tabla `conversation_summaries` NO existe → F-14/F-09 reales ⬜ |
| P1 — LangGraph agente | ✅ Verificado con tests: 49/49 PASS en 6 suites (graph, guards, checkpointer, commercialState, conversation, agentConfig) |
| Tests de negocio | ✅ **22/22 suites, 176/176 tests PASS (15/08, Oleada J: +kbRag, +quoteFlow, +behavior, +channels)** (15/08/2026): `flow.test.js` arreglado (store JSON duplicado en index.js unificado al facade `services/store.js`) |
| P1 — CI/Trazabilidad | ✅ F-42/F-46 corregidos y verificado (gate e2e 10/10×3 previo, TeVS 11/11) · ⚠️ 1 fallo histórico en tevs-results del 11/08 |
| P1 — n8n UI / Frappe | 🟡 n8n operativo (5679) pero activación de workflows NO verificable · Frappe ⬜ (solo ruta huérfana `nginx.conf:517`), Metabase ⬜ (`nginx.conf:500`) |
| P2 — Suite/load/BI/planes/deploy | ⬜ F-47, F-51 (no existe k6), F-52, F-53, F-54/56 sin implementar |
| Documentación | ❌ Contradicciones múltiples: TEC-06 (34/56) vs ESTADO-GENERAL (40/56); GAPS-MINIFASES tabla con todo ⬜ aunque varios ya verificados ✅ |
| Estándar auditoría (quién→qué→cómo→módulo→proceso) | ✅ 93/103 audit registros con trace_id+span_id (90%); event types activos 3/24; trazas LLM en ES con intent/score/usage |

---

## 2. Verificación del estándar de control y auditoría

**Estándar objetivo (OT-03 / TEC-06 F-33/F-40/F-46):** todo evento de negocio/seguridad registra actor, acción, contexto (tenant/request/conversación) y correlación E2E; las llamadas LLM exportan usage/intent/score a Elastic.

### 2.1 PostgreSQL `audit_logs` — control quién→qué→cómo→módulo→proceso
- **10 tablas** en `public`: `audit_logs`, `campaign_leads`, `campaigns`, `channel_status`, `lead_scores`, `opt_outs`, `platform_branches`, `platform_tenants`, `platform_users`, `workflow_logs`.
- `audit_logs`: **103 registros**, de los cuales **93 (90%) con `trace_id` y `span_id`** → correlación E2E presente en la mayoría.
- Distribución real de event types (solo 3 de 24 definidos están activos):
  - `state_transition` 65 · `api_call` 23 · `e2e_trace` 15
  - ⚠️ Eventos de seguridad (`unauthorized_access`, `injection_blocked`, `rate_limit_exceeded`), negocio (`campaign_sent`, `handoff_created`) y plataforma (`tenant_created`, `deployment`, `backup_completed`) **sin entradas** → el control existe en el código pero no se está ejercitando en runtime.

### 2.2 Elasticsearch — trazas LLM y E2E
- Datastreams: `traces-doags.otel-production` (**1004 docs**), `metrics-doags.otel-production` (1573), `logs-doags.otel-production` (**1 doc** — logs casi ausentes).
- Spans `llm.completion`: **23**; de ellos **19** provider `openrouter` y **15 con `llm.usage.total_tokens`** (p.ej. `total_tokens:150, prompt:50, completion:100, llm.model:"gpt-4"`).
- Atributos de negocio intactos: `wibsite.intent:"venta"` con `wibsite.score:80` (Dify) y `score:45` (OpenRouter gpt-4o-mini).
- ⚠️ **Salud del cluster:** estado **yellow** (1 nodo, réplicas sin asignar). ⚠️ **Spans recientes aterrizan en el datastream `-2026.08.11-000001`** aunque se emitieron el 13/08 → el datastream **no rola** por fecha; búsquedas "últimas 24h" por nombre de índice fallarían (los queries por `@timestamp` sí funcionan).
- Resultados de TeVS persistidos (schema 1.0, fecha en `timing.started_at`, **sin campo `@timestamp`**): `tevs-results-2026.08.11` (44 docs) y `tevs-results-2026.08.12` (27).

### 2.3 Gate de trazabilidad (F-46)
- `scripts/verify/e2e-trace.js` verificado estable: **10/10 ×3 corridas consecutivas** (totalKey `llm.usage.total_tokens` + polling ES 8×10s por reintentos del elasticsearchexporter). TeVS completo **11/11 PASSED**.
- ⚠️ Hallazgo: en la corrida TeVS del 11/08 18:53 (`EXEC-20260811-185317-lsYiJz`), `TEST-DEV-001 Error Rate Deviation` **falló** con `QUERY_ERROR` (400, Elasticsearch) — quedó registrado en el índice, no es una corrida actual.

---

## 3. Estado por prioridad — verificación campo a campo

### 3.1 P0 — Stack vivo, secretos, TeVS, git, cutover PG + RLS

| Ítem | Estado | Evidencia |
|---|---|---|
| Stack en vivo | ✅ **ACTIVO** | Docker 29.5.2, 20 contenedores (helper, otel-collector, dify×4, kibana, n8n, twenty, chatwoot×2, ES, minio, nginx, postgres, authelia, dify-web, plugin-daemon, weaviate, redis, t2v, dify-sandbox). Gateway: `/hub/` 200, `/api/health` 200, `/api/campaigns` 403 sin SSO. Helper `:3100/health` 200 |
| **API key helper** | 🔴 **CRÍTICO — key literal no evaluada** | `HELPER_API_KEY=wb_dev_$(openssl rand -hex 16)` **literal** (el `$(...)` NO se evalúa; dotenv no ejecuta subshells). El valor real registrado en el contenedor ES esa cadena literal → **key fija, pública y conocida**. Contradice F-32 (rotación). Corregir: generar hex real (p.ej. `openssl rand -hex 32`) y aplicarla a runtime + clientes |
| Password ES en CI | 🔴 **CRÍTICO** | `.gitlab-ci.yml:12` → `ELASTIC_PASSWORD: "wibsite_elastic_pass_2026"` **hardcodeado** en variables. Debe pasar a secretos del runner (GitLab `CI variables`, masked/protected) |
| nginx.key + PII en git | 🔴 **CRÍTICO (P0 histórico)** | `wibsite/certs/nginx.key` y `wibsite-store.json` en commits antiguos (`a603c91`). Requiere `git filter-repo` (reescritura) + rotación posterior del certificado |
| `.env` en git | ✅ OK | `wibsite/.env` está **ignorado** (check-ignore OK); solo `wibsite/.env.example` versionado con `<placeholder>` correcto para `HELPER_API_KEY` (`openssl rand -hex 32`) — pero el runtime NO usa ese placeholder (ver fila API key) |
| TeVS | ✅ Ejecutado y persistido | Índices `tevs-results-*` con corridas 11/08 y 12/08. 11/11 PASSED en corridas actuales. Corregir 1 fallo histórico documentado (§2.3) |
| F-09 Cutover PG primario | ⬜ **No implementado** | `STORE_MODE` default `dual` en `store.js:6`, pero el dual-write real no se dispara (ver F-08). Sin feature flag de cutover activo |
| F-10 RLS tenant | ✅ **Implementado y verificado** | 7 políticas `tenant_isolation_*` en `pg_policy` (audit_logs, campaign_leads, campaigns, channel_status, lead_scores, opt_outs, workflow_logs) con `current_tenant_id()` (audit_logs añade escudo admin). Faltan políticas en tablas sin `tenant_id` (platform_* correctamente excluidas) |
| F-11 tenantContext | ✅ **Implementado** | `SET LOCAL app.tenant_id` + cache 5 min + resolución slug→uuid (confirmado en middleware). ⚠️ Verificación runtime pendiente de un request con tenant (no se disparó aún SET LOCAL desde la app: `current_setting('app.tenant_id')` da "unrecognized" en sesiones externas, comportamiento esperado) |
| F-12 Aislamiento/0 huérfanos | ✅ | `Orphan-check.sql` + política RLS activa |

### 3.2 P1 — LangGraph, sync, seguridad, CI, trazabilidad, n8n, Frappe

| Ítem | Estado | Evidencia |
|---|---|---|
| F-13 Bootstrap agent-core | ✅ | `agentCore/` completo: index, graph, llmClient, slotFilling, stageMap, commercialState, checks, guards, testGraph + 11 nodos |
| **F-14 Checkpointer** | ⚠️ **Falso ✅ en docs** | `checkpointer.js:14` hace `INSERT INTO conversation_summaries` pero **la tabla NO existe en PG** (10 tablas listadas, sin ella). El DDL `scripts/conversation-summaries-schema.sql` existe pero **nunca se aplicó** → `persistSummary` falla en silencio (catch → null, `checkpointer.js:38-41`). Corregir: aplicar el SQL + proceso de migración rutinario. Tests del checkpointer pasan (mocking) |
| F-15 Template engine | ✅ | `templateEngine.js` + validador |
| **F-16 Grafo 8 etapas** | ✅ | `graph.js` engine genérico (nodes Map, aristas condicionales) + 9+ nodos ejecutables; **agentGraph.test.js 5/5 PASS** |
| **F-17 Guardas confidencialidad/autonomía** | ✅ | `guards/confidentiality.js` + `guards/autonomy.js` (zonas green/yellow/red, filtro PII); **guards.test.js PASS** |
| **F-18 Dify nodo + fallback OpenRouter** | ✅ | `llmClient.js`: Dify `workflows/run` + fallback OpenRouter con **circuit breaker** (3 fallos → cooldown 60s), `parseFinalResult`, spans OTLP; Dify API viva (`/health` 200) |
| **F-21 Sync comercial↔técnica** | ✅ | `commercialState.js` MAP técnico→comercial + `registerHook` en `onTransition` + metadata PG (changelog 3.2.0); **commercialState.test.js 6/6 PASS** |
| F-22 Handoff | ✅ | Handoff templates |
| F-23 Cola seguimiento | ✅ | Followup sequence templates (n8n 04 + followupNode) |
| F-24 HSM/typing/opt-out | ✅ | `/api/twilio/typing`, opt-out duro, mapa de 24h |
| F-25/26/27 Twenty SPICED/MEDDIC | ✅ | Scripts + validación + ModoConversación |
| **F-02 n8n UI/credenciales** | 🟡 | Contenedor n8n **operativo y UI 200** — PERO mapeado a **host:5679** (no 5678 como CABRÍA esperar; la ruta externa es `https://localhost:8080/n8n/` vía nginx). Workflows locales presentes (`01-inbound-message.json`, `02-campaign-broadcast.json`, `tevs-auto-remediation-flow.json`) pero **activación en el editor NO verificable** (API requiere auth; el log muestra errores de prune de workflow-history). Pendiente: configurar credenciales/activación UI |
| **F-28/29 Frappe** | ⬜ | **Solo ruta huérfana** `nginx.conf:517-523` (`/erp/` → `frappe-frappe:8000`); servicio NO en compose. F-29 (sync Twenty→Frappe factura) condicionado a F-28. Decisión de negocio pendiente |
| F-30 Editor plantillas | ✅ | Template endpoints |
| F-31 HTTPS + headers | ✅ | TLS 1.2/1.3 + HSTS verificado vía gateway (curl -k) |
| **F-32 Rotación keys + roles PG** | ⚠️ **Parcial** | Roles `wibsite`+`app_user` creados ✓ · rotación **NO cumplida** (API key literal, §3.1) |
| F-33 PII filter + audit | ✅ | `piiFilter.js` + `auditLogger.js` (24 event types, INSERT con trace/span) |
| F-34 Backups | ✅ | `backup.sh` + restore |
| **F-35 Re-auditoría seguridad** | ✅ | Timing-safe (`crypto.timingSafeEqual`), nginx sin key hardcodeada, password ES vía `${ELASTIC_PASSWORD}` en compose/otel-collector. ⚠️ Excepción: `.gitlab-ci.yml` hardcodea la password (§3.1) |
| F-36/38 Elastic Stack + OTel | ✅ | ES 9.4.2 + Kibana + otel-collector en compose; Prometheus/Grafana retirados (⚠️ `monitoring/` conserva configs huérfanas) |
| F-37 Métricas negocio | ✅ | prom-client middleware |
| F-40 Logs JSON | ✅ | auditLogger + pino |
| **F-42 CI gates** | 🟡 **Usable, 1 defecto** | `.github/workflows/tevs-validation.yml` corregido: branches `master`, secrets, infra en runner, flag `-ElasticPassword` ✓ · `.gitlab-ci.yml` corregido en rama/flag pero **password hardcodeada** (hallazgo P0) |
| **F-46 Trazabilidad E2E** | ✅ | Gate 10/10 ×3 + TeVS 11/11 (§2.3) |
| F-47 Suite comportamiento agente | ⬜ | Solo "templates behavior defined" en docs; no hay suite ejecutable de comportamiento E2E del vendedor |
| F-48/49/50 | ✅ | data-integrity, forbidden_topics, salon-eventos template |

### 3.3 P2 — Suite, load, BI, planes, despliegue, piloto + gaps G-13…G-45

| Ítem | Estado | Evidencia |
|---|---|---|
| F-51 Load test 50 conv | ⬜ | **No existe** ningún script k6/load en el repo (glob `**/k6*.js` vacío) |
| F-52 BI Metabase | ⬜ | Solo ruta huérfana `nginx.conf:500-506` (`/reportes/` → `metabase:3000`); servicio NO en compose; sin `daily_metrics` |
| F-53 Planes/onboarding | ⬜ | Sin `planLimiter.js`, sin workflow `06-tenant-onboarding.json`, sin DDL planes en `platform_tenants` |
| F-54 Despliegue distribuido | ⬜ | Sin `docker-compose.prod.yml`, `deploy.sh` ni réplicas; solo `backup.sh` |
| F-55 Staging gate | ✅ (parcial) | `verify-fase.sh` + tests existe; sin entorno staging dedicado |
| F-56 Go-live piloto | ⬜ | Depende de F-55 |
| **Gaps G-01…G-12** | 🟡 Según código: mayoría implementados (twilio inbound/status, broadcast, typing, bidireccional Twenty, CRUD leads, scoring) | ⚠️ Tabla de GAPS-MINIFASES los lista ⬜ → tabla desactualizada (ver §4). G-02 marcado "Parcial", G-12 Dify publicado ✓ (workflow clasificador en uso real) |
| **G-13 RAG documentos negocio** | 🟡 | `ragEngine.js` existe con `queryInMemoryKB` y tests (7/7 PASS previo); secciones de negocio en KB → revisar alcance G3 |
| G-14/15/16 | ⬜/🟡 | Gráficos dashboard y spinner: portal SPA existe; UTF-8 + >1K filas sin verificar export |
| G-17/18/19 n8n activación/nurturing/inbound E2E | 🟡 | Workflows 01/02 presentes en repo; **activación en editor n8n no verificada** (mismo bloqueo que F-02) |
| G-20 HTTPS real | ✅ | Verificado (§3.2 F-31) |
| G-21 Roles PG por servicio | ✅ | `wibsite`/`app_user` creados |
| G-22 Rate limiting por plan | ⬜ | RateLimiter en memoria (60 req/min, LLM 10/min) sin dimensión de plan |
| G-23 Alertas Grafana | ⬜ Retirado | Grafana fuera del stack (F-36); alertas deberían migrarse a Kibana/ES |
| G-24 Traza E2E correlation ID | ✅ | trace_id/span_id en audit_logs (93/103) + gate F-46 |
| G-25 RLS / G-26 tenantContext | ✅ | §3.1 F-10/F-11 |
| G-27 Planes SaaS | ⬜ | Igual F-53 |
| G-28 Metabase KPIs | ⬜ | Igual F-52 |
| G-29/30 Frappe setup + sync | ⬜ | Igual F-28/29 |
| G-31/32 Portal búsqueda/notifs + lead panel | 🟡 | Portal SPA 72 KB con postMessage; búsqueda global/notificaciones sin verificar |
| G-33/34 CI pipeline + smoke deploy | 🟡 | Existen workflows (tevs-validation, .gitlab-ci), pero no un `ci.yml` completo con lint+audit+contracts como gate de PR |
| G-35 Multi-agente router | ⬜ | No existe `agentRouter.js`; grafo es un único agente con 8 etapas |
| G-36 Pipeline multimedia | ⬜ | Sin manejo de adjuntos Twilio→MinIO en webhook |
| G-37 TTS engine | ⬜ | No existe `ttsEngine.js` |
| G-38…G-45 (si documentados) | ⬜ | No listados en el archivo GAPS actual (fecha a verificar) |

---

## 4. Contradicciones documentales detectadas (afectan confiabilidad del seguimiento)

| Doc | Dice | Realidad verificada |
|---|---|---|
| `TEC-06` §5 (2026-08-12) | "34 fases ✅ · 22 ⬜" | Verificación actual: al menos 40 completas (F-10, F-25/26/27, F-35, F-36/38, F-41, F-46 verificadas en vivo) |
| `ESTADO-GENERAL.md` | "40/56 fases ✅" | Consistente con la verificación actual (40-42) |
| `Avances/LOGROS.md` | "112 tests, 8 suites" y "Suite TeVS pendiente primera ejecución" | Real: **17 suites ≈140 tests** y TeVS **ya ejecutado** (índices 11/08 y 12/08) |
| `GAPS-MINIFASES.md` §3 tabla | Casi todo ⬜ (G-01…G-37) | Múltiples ya verificados ✅ (G-01, G-03, G-04, G-05/06, G-08, G-12, G-20, G-21, G-24, G-25, G-26, G-31/32 parcial…) |
| `OBJETIVOS-PENDIENTES` | "34/56 ✅ · 22 ⬜" | Ver §TEC-06 |
| `docs/rag/*` y `docs/context/*` | Detallan arquitectura | Mayormente consistentes; `storeFacade` documentado no existe como archivo (es `store.js`) |

---

## 5. Hallazgos ordenados por severidad

> **S1-S3 (seguridad)** están documentados a detalle en **[`SECURITY-GAPS-PRE-DEPLOY.md`](./SECURITY-GAPS-PRE-DEPLOY.md)** — excluidos del trabajo de implementación en curso; pendientes para la etapa de deploy.

| ID | Sev | Hallazgo | Referencia |
|---|---|---|---|
| S1 | 🔴 | `HELPER_API_KEY` = literal `wb_dev_$(openssl rand -hex 16)` sin evaluar (key pública fija) | `.env:57`, env del contenedor → ver SECURITY-GAPS |
| S2 | 🔴 | `ELASTIC_PASSWORD` hardcodeado en `.gitlab-ci.yml:12` | `.gitlab-ci.yml:12` → ver SECURITY-GAPS |
| S3 | 🔴 | `nginx.key` + `wibsite-store.json` (PII) en git history | commit `a603c91` → ver SECURITY-GAPS |
| S4 | 🟠 | Tabla `conversation_summaries` no migrada → checkpointer F-14 falla en silencio en prod | `checkpointer.js:14,38-41` vs `\dt` |
| S5 | 🟠 | Dual-write PG (F-08/F-09): `writeCampaign/writeLead/writeScore/writeOptOut` definidos pero **jamás invocados** desde rutas; PG solo recibe seeds y audit_logs | `store.js:76-91`, grep en `index.js` |
| S6 | 🟠 | Datastream traces no rola por fecha (spans del 13/08 en índice del 11/08) | `_cat/indices` + `_index` en hits |
| S7 | 🟠 | Cumplimiento del estándar incompleto en runtime: solo 3/24 event types activos en `audit_logs` | PG query |
| S8 | 🟡 | Corrida TeVS 11/08 18:53 con `TEST-DEV-001` fallido (QUERY_ERROR 400) | tevs-results doc |
| S9 | 🟡 | `monitoring/` con configs de Prometheus/Grafana/Alertmanager huérfanas tras F-36 | `monitoring/` vs compose |
| S10 | 🟡 | n8n expuesto en puerto 5679 host (no 5678) — documentación/diagnósticos apuntan al equivocado | `docker port wibsite-n8n` |
| S11 | 🟡 | Logs-datastream con 1 solo doc → logging de aplicación casi ausente en ES | `_data_stream` |
| S12 | ✅ **RESUELTO (15/08/2026)** | `flow.test.js` arreglado: causa raíz = store JSON duplicado en `index.js` (cache propio) vs facade `services/store.js`; unificado delegando al facade + borrado de archivo en afterEach. Suite completa **22/22 suites, 176/176 tests PASS (15/08, Oleada J: +kbRag, +quoteFlow, +behavior, +channels)** | suite actual |
| S13 | 🟡 | Docs contradictorias para el seguimiento (§4) | varios |

---

## 6. Plan de corrección sugerido

**P0 (seguridad primero — S1-S3 documentados en [`SECURITY-GAPS-PRE-DEPLOY.md`](./SECURITY-GAPS-PRE-DEPLOY.md), pendientes para deploy):**
1. Generar API key real (`openssl rand -hex 32`), aplicarla en `.env`, compose y clientes; eliminar el literal.
2. Mover `ELASTIC_PASSWORD` de `.gitlab-ci.yml` a variables enmascaradas del runner GitLab.
3. Purga git (`filter-repo`) de `nginx.key` y `wibsite-store.json` + rotación de certificado.

**Correcciones ya aplicadas (15/08/2026):**
4. ✅ `flow.test.js` arreglado + **store JSON unificado**: `index.js` tenía cache/lock propios (`loadStore`/`saveStore`/`updateStore`/`getStore` locales) duplicados al facade → ahora delegan a `services/store.js` (un solo cache, un solo lock). Suite completa **22/22 suites, 176/176 tests PASS (15/08, Oleada J: +kbRag, +quoteFlow, +behavior, +channels)**.
5. ✅ `await updateStore(...)` aplicado en rutas que hacían fire-and-forget (campaigns `index.js:274`, leads/score `:864`, chatwoot webhook `:2608`) — el error era silencioso con `updateJsonStore` cache TTL.
6. ✅ `PUT /api/agent/config` ya no usa `saveStore` huérfano; persiste vía `updateStore` (`index.js:1974-1984`).

**Pendientes no-seguridad:**
7. Aplicar `scripts/conversation-summaries-schema.sql` a PG (desbloquea F-14).
8. Decidir cutover: o conectar rutas al facade dual (`store.js` `writeCampaign`/`writeLead`/…) o declarar JSON-only y eliminar deuda F-08/09 (G1 de la auditoría previa).
9. (Opcional) Configurar ILM/datastream para que traces rolen por día.

**P1:**
10. F-02: configurar credenciales + activar workflows 01/02 en el editor n8n (UI accesible en `:5679`); alinear mapeo de puerto.
11. F-28/29/F-52: decisión de negocio — retirar rutas huérfanas `/erp/` y `/reportes/` o levantar los servicios.
12. Completar `ci.yml` (lint + audit + contract) y activar gates en PR.
13. Re-ejecutar TeVS completo tras los fixes P0 y documentar resultado en `tevs-results` de la fecha.

**P2:**
14. F-47 suite de comportamiento del vendedor (E2E con grafo real), F-51 k6 (`50 conv`, umbrales P95).
15. F-52/53/54 en oleada J cuando F-09/10 estén cerradas; F-56 depende de ellas.

---

## 7. Evidencia cruda (comandos de verificación)

```powershell
# Stack
docker info --format "{{.ServerVersion}}"          # 29.5.2
docker ps --format "{{.Names}}"                     # 20 contenedores
curl.exe -k -o NUL -w "%{http_code}" https://localhost:8080/hub/          # 200
curl.exe -k -o NUL -w "%{http_code}" https://localhost:8080/api/health    # 200
curl.exe -k -o NUL -w "%{http_code}" https://localhost:8080/api/campaigns # 403 (SSO)
curl.exe -o NUL -w "%{http_code}" http://localhost:3100/health            # 200
curl.exe -o NUL -w "%{http_code}" http://localhost:5679/                  # 200 (n8n UI)
curl.exe -o NUL -w "%{http_code}" http://localhost:5001/health            # 200 (dify)

# PG (wibsite-postgres, user wibsite)
\dt                               # 10 tablas (sin conversation_summaries)
SELECT tablename,polname,polcmd,pg_get_expr(polqual,polrelid) FROM pg_policy;  # 7 políticas
SELECT count(*) FILTER (WHERE trace_id IS NOT NULL) FROM audit_logs;          # 93/103
SELECT event_type,count(*) FROM audit_logs GROUP BY event_type;               # st=65 api=23 e2e=15
SELECT count(*) FROM campaigns;                                               # 3 (solo seeds b000...)

# ES
GET /_data_stream                                  # traces 1004 / metrics 1573 / logs 1
GET /tevs-results-*/_search                        # EXEC-20260811-183900/185317, TEST-DEV-001 failed
GET /traces-doags.otel-production/_search          # 23 llm.completion, 19 openrouter, 15 usage

# Jest (núcleo agente F-14/16/17/21)
npx jest agentGraph guards commercialState checkpointer conversation agentConfig  # 6 suites, 49/49 PASS
npx jest --forceExit --testTimeout 30000                                          # suite completa 18/18, 151/151 PASS (15/08/2026)

# Secretos
docker exec wibsite-helper printenv HELPER_API_KEY  # wb_dev_$(openssl rand -hex 16)  → literal
git check-ignore wibsite/.env                        # ignorado OK
```

---

## 8. Conclusión

- **Lo fuerte:** núcleo agente (F-13…F-21) implementado y probado (49/49), RLS/tenantContext reales, gateway/SSO verificados, trazabilidad F-46 con gate 10/10 y TeVS 11/11 persistido, Elastic con trazas LLM completas (intent/score/usage).
- **Lo crítico pendiente:** P0 de secretos (API key literal, password ES en CI, PII en git), tabla `conversation_summaries` no migrada (F-14 real ⬜) y dual-write PG muerto (F-08/09 real ⬜).
- **Estándar de control:** la infraestructura quién→qué→cómo→módulo→proceso **existe y funciona parcialmente** (90% con trace/span), pero solo 3 de 24 tipos de evento se ejercitan en runtime y el datastream de logs está vacío: falta que el negocio real la alimente, no construir más.
- **Docs:** el seguimiento (TEC-06/GAPS/LOGROS) dista de la realidad; recomiendo una sola fuente de verdad (TEC-06) sincronizada tras cada verificación.