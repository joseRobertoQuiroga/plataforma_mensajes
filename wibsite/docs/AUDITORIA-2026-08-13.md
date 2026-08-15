# Auditoría integral — Wibsite Business (14/08/2026)

Cruce documentación ↔ código ↔ tests ↔ runtime. Objetivo: separar lo **implementado y verificado**, lo **pendiente** y lo **no implementado** con evidencia.

Método: inspección directa de código, ejecución de gates (e2e-trace, TeVS), consultas a PostgreSQL/Elasticsearch/Redis y curl contra el gateway. Sin subagentes (bloqueados por error genérico).

---

## 1. Implementado y verificado

### 1.1 Persistencia — dual store JSON + PG (F-07/F-08)
- `store.js` actúa de facade: `STORE_MODE` default `dual` (`store.js:6`), escrituras condicionales JSON y/o PG (`store.js:72-91`).
- `index.js:19` lo importa como `storeFacade` y `index.js:197` inicializa `initPgStore(pool)`.
- **Verificado en runtime:** gateway HTTPS responde 200 (`/hub/`, `/api/health`), 403 sin SSO (`/api/campaigns`); helper :3100 200.

### 1.2 Seguridad y aislamiento
- **RLS:** 7 tablas con políticas `tenant_isolation_*` verificadas en `pg_policy`:
  `audit_logs` (con `current_tenant_id()`), `campaign_leads`, `campaigns`, `channel_status`, `lead_scores`, `opt_outs`, `workflow_logs`. Rol `app_user` + `SET LOCAL app.tenant_id` en `tenantContext.js`.
- Auth timing-safe (401/403), rateLimiter en memoria (60 req/min, LLM 10/min), sanitizer 23 patrones + whitelist (código revisado).
- Nginx: TLS 1.2/1.3 + HSTS, limit_req (api 120r/m, llm 5r/m, webhooks 60r/m), auth_request Authelia (verificado: `/api/campaigns` → 403 sin SSO).

### 1.3 Observabilidad (F-46, F-35)
- Puente OTLP → Elasticsearch funcionando: 1004 docs en datastream `traces-doags.otel-production`, 1573 metrics, logs con attrs completos. Último llm.completion: openrouter/openai/gpt-4o, 95/20/115 tokens, intent=venta, score=85.
- Gate `e2e-trace.js` estable: 3 corridas consecutivas 10/10 (totalKey `llm.usage.total_tokens` + polling ES 8×10s).
- `audit_logs`: 103 registros — state_transition 65, api_call 23, e2e_trace 15.
- TeVS ejecutado y persistido en `tevs-results-*` (schema 1.0, sin `@timestamp`; fecha en `timing.started_at`): corridas del 11/08 (EXEC-20260811-183900, 185317) y 12/08. Suite actual 11/11 PASSED.

### 1.4 Inventario real
- 20 servicios compose (sin prometheus/grafana/alertmanager/frappe); healthchecks en postgres, redis, minio.
- 17 suites Jest (~140 tests) habilitadas.
- 12 servicios en `helper-node/services/` (incluye store.js, pgStore, otelBridge, auditLogger; **no existe `storeFacade.js`** — el facade ES `store.js`).

---

## 2. Hallazgos / gaps

| # | Severidad | Hallazgo | Evidencia |
|---|-----------|----------|-----------|
| G1 | **Alta** | **Dual-write PG nunca se dispara desde las rutas.** `writeCampaign/writeLead/writeScore/writeOptOut` de `store.js:76-91` no se llaman en `index.js` ni en ningún módulo; las rutas usan `updateStore` (solo JSON). Consecuencia: `campaign_leads=0`, `lead_scores=0`, `opt_outs=0`, `workflow_logs=0` en PG. Único contenido PG de negocio: 3 campañas seed (`b0000000-...`, 01/08) inyectadas por migración, no por flujo real. | grep `writeCampaign\|writeLead` = solo definiciones en store.js; conteos PG |
| G2 | **Media** | **Spans del 13/08 aterrizan en datastream `-2026.08.11-000001`** (no rola). Watch: si el datastream no hace rollover por fecha, búsquedas "últimas 24h" por nombre de índice fallan. Los 3 docs recientes consultados siguen en el índice del 11/08. | `_cat/indices/.ds-traces*` (1 backing index, creado 2026-08-11T02:02); hits recientes con `_index` = -2026.08.11-000001 |
| G3 | Media | Corrida TeVS del 11/08 18:53 registró **1 fallo**: TEST-DEV-001 "Error Rate Deviation Validation" (QUERY_ERROR 400 en ES). Corridas posteriores (12/08 y las 11/11 actuales) pasan. | doc tevs-results-2026.08.11: execution.status=failed, code=QUERY_ERROR |
| G4 | Media | **Datastream `logs` con 1 solo doc** y **`.workflows-events` (n8n) sin backing index listado** — logs de negocio casi ausentes; solo traces/metrics poblados. | `_data_stream` |
| G5 | Media | Docs desactualizadas: OBJETIVOS-PENDIENTES dice "34/56 fases ✅" y LOGROS "112 tests, 8 suites, TeVS pendiente 1ª ejecución" vs. realidad 40/56, 17 suites ~140 tests y TeVS ejecutado (índice 11/08). | Avances/OBJETIVOS-PENDIENTES.md vs ESTADO-GENERAL.md y changelog 3.1.0 |
| G6 | Media | `monitoring/` contiene configs prometheus.yml/alertmanager.yml/grafana sin servicios en compose (retirados sin limpiar docs). | docker-compose.yml (20 servicios) vs monitoring/ |
| G7 | Baja | `audit_logs.conversation_summaries` declarada en docs pero la tabla no existe en `public` (0 filas) → checkpointer PG sin tabla. | `\dt public` + query |
| G8 | Baja | Nginx expone rutas huérfanas/limit conflict: zonas de rate (webhooks 60r/m) no alineadas con MySQL del codebase. | nginx.conf vs middlewares |

---

## 3. Pendiente (P0/P1/P2)

- **P0 — Purga de secretos en git history:** `wibsite/certs/nginx.key` y `wibsite-store.json` (PII) figuran en commits antiguos (`a603c91`). Requiere `filter-repo` (reescritura de historia).
- **P1 — G1:** conectar rutas de negocio (`POST /api/campaigns`, leads inbound, opt-outs) al facade de doble escritura o declarar JSON-only y eliminar la deuda.
- **P2 — Tests:** `flow.test.js` roto (`checkWeaviateHealth is not a function`, index.js:184); leak de worker de Jest (warning al correr suites).

---

## 4. No implementado (verificado ausente)

- `helper-node/services/storeFacade.js` — no existe; la documentación de F-07/F-08 menciona un "store facade" que en realidad es `store.js`.
- Cambios DDL/RLS en `platform_*` (bien: son tablas de plataforma sin RLS de tenant) — sin hallazgo.
- Prometheus/Grafana/Alertmanager no despliegan (configs huérfanas, §G6).

---

## 5. Conclusión

Núcleo implementado y verificado en runtime: RLS tenant, auth/rate/sanitize, tracing F-46 (gate 10/10 estable), TeVS 11/11, Es con traces completas. El gap estructural principal es **G1**: el dual-write PG es código muerto — la app persiste en JSON y PG solo recibe seeds y audit_logs. Los demás hallazgos son deuda de documentación y retirada incompleta de herramientas.