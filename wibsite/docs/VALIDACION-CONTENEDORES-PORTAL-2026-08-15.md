# Validación de Contenedores y Vista Principal (Portal/Microfrontends) — 15/08/2026

> **Alcance:** inventario de los 20 contenedores con su propósito, validación de la vista principal (hub + portal shell con microfrontends) contra el estándar `docs/DISENO-NAVEGACION-UNIFICADA.md`, verificación de que cada módulo recibe/actualiza información en su base de datos, y comprobación SOAC (trazas/logs/audit) de la actividad del portal.
> **Método:** verificación en vivo (curl, psql, redis-cli, ES), sin cambios salvo correcciones precisas (§3).

---

## 1. Inventario de contenedores (20/20 UP) — propósito de cada uno

| Contenedor | Imagen | Propósito en el sistema |
|------------|--------|--------------------------|
| **wibsite-nginx** | nginx:1.27-alpine | Gateway único HTTPS :8080 — enruta `/hub/`, `/portal/`, `/admin/`, `/chatwoot/`, `/crm/`, `/n8n/`, `/dify/`, `/kibana/`, `/minio-console/`, `/api/`, `/webhooks/`; TLS + HSTS + rate limiting; SSO vía `auth_request` Authelia |
| **wibsite-authelia** | authelia:4.37 | SSO central — login único; protege todos los módulos del portal (verificado: 302 → `/auth/?rd=…`) |
| **wibsite-helper** | wibsite-helper (propio) | Núcleo de negocio (Express): ~120 rutas (campañas, leads, scoring, opt-outs, agente, multicanal, RAG, Twenty-sync), pipeline multicanal unificado, puente OTLP (traces+logs), métricas prom-client, dual-write JSON+PG |
| **wibsite-postgres** | pgvector/pgvector:pg15 | Base única con **5 BD**: `wibsite` (negocio+audit+RLS), `chatwoot`, `n8n`, `dify`, `twenty` |
| **wibsite-redis** | redis:7-alpine | Estado de conversación (39 keys `conv:*`), checkpoints (39 `ckpt:*`), caché n8n/chatwoot |
| **wibsite-elasticsearch** | elasticsearch:9.4.2 | **SOAC**: datastreams `traces` (3686 docs), `logs` (eventos de negocio), `metrics`; ILM rollover 1d/30d; tevs-results |
| **wibsite-kibana** | kibana:9.4.2 | UI de observabilidad (:5601, vía `/kibana/` SSO) — dashboards, reglas de alerta |
| **wibsite-otel-collector** | otel-collector-contrib | Recibe OTLP :4317/:4318 (spans+logs+metrics del helper, dify, chatwoot) → exporta a ES |
| **wibsite-dify-api** | dify-api | Motor de workflow IA (clasificador de leads 8 nodos) — primary del agente |
| **wibsite-dify-worker** | dify-api | Ejecuta las tareas asíncronas del workflow Dify |
| **wibsite-dify-web** | dify-web | Consola Dify (vía `/dify/` SSO) |
| **wibsite-plugin-daemon** | dify-plugin-daemon | Plugins de Dify |
| **wibsite-dify-sandbox** | dify-sandbox | Ejecución segura de código en workflows Dify |
| **wibsite-n8n** | n8n | Automatizaciones: 3 workflows en BD (01-inbound, 02-broadcast, tevs-remediation); UI en host :5679 (SSO `/n8n/`) |
| **wibsite-chatwoot** | chatwoot | Inbox omnicanal (1 account, 1 inbox, 4 contactos, 6 conversaciones en BD) |
| **wibsite-chatwoot-worker** | chatwoot | Procesamiento en segundo plano de Chatwoot |
| **wibsite-twenty-server** | twentycrm/twenty | CRM (1 workspace, 1 userWorkspace, 1 apiKey **expirada** — ver §4) |
| **wibsite-weaviate** | weaviate:1.26.1 | Base vectorial para RAG (KnowledgeBase) |
| **wibsite-t2v** | transformers-inference | Embeddings sentence-transformers para Weaviate |
| **wibsite-minio** | minio | Object storage (S3) — consola vía `/minio-console/` |

---

## 2. Vista principal — hub + portal shell (microfrontends)

### 2.1 Estado verificado en vivo

| Ruta | Respuesta | Interpretación |
|------|-----------|----------------|
| `/hub/` | **200** (control-center.html, 61 KB) | Página de aterrizaje con salud del sistema (SLI, dependencias, incidentes, alertas) |
| `/portal/` | **302 → `/auth/?rd=/portal/`** | Portal shell protegido por SSO ✓ (única URL, un solo login — según diseño) |
| `/admin/` `/chatwoot/` `/crm/` `/n8n/` `/dify/` `/kibana/` `/minio-console/` | **302 → Authelia** | Los 7 módulos detrás del guardián SSO ✓ |
| `/api/health` | **200** | Health checker del portal funciona (helper) |
| `/grafana/` `/glitchtip/` | 404 | Retirados del stack — **el portal aún los listaba** → corregido (§3) |

### 2.2 Cumplimiento del estándar (DISENO-NAVEGACION-UNIFICADA.md)

| Requisito del estándar | Estado | Nota |
|------------------------|--------|------|
| Portal shell con sidebar + iframe sandbox | ✅ | `hub/portal/index.html` — 8 módulos, iframe con sandbox, postMessage básico |
| Health checker integrado | ✅ | `setInterval` 30s → `GET /api/health` (dot verde/rojo) — verificado 200 |
| Watermark de versión | ✅ | v2.2.0 |
| SSO unificado (todos los módulos tras Authelia) | ✅ | verificado 302 → auth para los 7 módulos |
| Módulos alineados al stack real | ✅ **corregido hoy** | grafana/glitchtip fuera; kibana como Metrics |
| Lead Context Panel (Fase 2) | ⬜ | pendiente (3h según diseño) |
| Búsqueda global Ctrl+K (Fase 2) | ⬜ | pendiente |
| Notificaciones unificadas (Fase 2) | ⬜ | pendiente |
| Cross-module postMessage 4 escenarios (Fase 3) | ⬜ | básico implementado; escenarios pendientes |

### 2.3 Flujo de información portal → módulos → bases de datos

| Módulo | Base/almacén | Datos verificados hoy | Recibe/actualiza |
|--------|--------------|------------------------|-------------------|
| Helper/Admin | BD `wibsite` | 7 campañas, 1 lead PG, 1 score, 1 opt-out, **356 audit_logs**, 6 conversation_summaries | ✅ audit por request; dual-write |
| Chatwoot (Inbox) | BD `chatwoot` | 1 account, 1 inbox, 4 contactos, 6 conversaciones | ✅ (inbox activo) |
| n8n (Automations) | BD `n8n` | 3 workflows, 1 user, 2 executions | ✅ (workflows importados) |
| Dify (IA Studio) | BD `dify` | 2 workflows, **75 workflow_runs**, 1 app | ✅ cada turno del agente genera run |
| Twenty (CRM) | BD `twenty` | 1 workspace, 1 userWorkspace, 1 apiKey **expirada** | ⚠️ sync bloqueado por key vencida |
| Kibana/ES (Metrics) | ES datastreams | traces 3686, logs 200+, metrics | ✅ OTLP del helper/dify/chatwoot |
| MinIO (Storage) | MinIO | healthy | ✅ |
| Redis (estado conversacional) | redis | 39 conv + 39 ckpt | ✅ por conversación |
| Weaviate (RAG) | weaviate | disponible | ✅ |

---

## 3. Correcciones precisas aplicadas (para alinear el portal al estándar)

| # | Hallazgo | Corrección |
|---|----------|-----------|
| P1 | El portal listaba **Grafana y GlitchTip** (retirados; rutas 404) y no listaba Kibana | `hub/portal/index.html`: MODULES ahora = hub, admin, inbox, crm, ia-studio, automations, **kibana (Metrics)**, storage |
| P2 | El hub (control-center.html) mostraba dependencia **GlitchTip** y tools **Grafana/Prometheus/Alertmanager** (puertos 3004/9090/9093 muertos) | Fila de dependencia → **Elasticsearch (SOAC)**; tools → **Kibana/MinIO** + nota "retirados (F-36)"; iframe de monitoreo → `/kibana/`; menú "Alertas Prometheus" → "Alertas (Kibana/ES)" |
| P3 | `GET /api/internal/health-detailed` reportaba `glitchtip` y un redis falso (solo probaba el require) | Ahora: `dependencies.elastic` (cluster health real de ES: `connected-yellow`), `dependencies.redis` (ping real: `available/redis`), `modules.channels` + `modules.multimodal` añadidos |
| P4 | El helper no podía consultar ES (sin password) | compose helper: `ELASTICSEARCH_URL` + `ELASTIC_PASSWORD` pasadas desde `.env` |

---

## 4. Verificación SOAC de la actividad del portal

- Requests del portal (`GET /api/health`, `GET /api/internal/health-detailed`) → **spans HTTP en ES** con `http.route`, status y `wibsite.request_id` (verificado: spans 200 y 403 con request_id correlacionado).
- Respuesta en vivo de `health-detailed`: `postgresql: connected (10ms)`, `redis: available/redis`, `elastic: connected-yellow (cluster yellow)`, `llm: configured (openai/gpt-4o-mini)`, `weaviate: connected`.
- Gates finales: Jest **169/169**, e2e-trace **10/10**, TeVS **13/13 PASSED**.

---

## 5. Pendientes del portal (no bloqueantes)

1. **Regenerar API key de Twenty** (expira — 401) para que el CRM reciba leads.
2. Lead Context Panel + búsqueda Ctrl+K + notificaciones (Fase 2 del diseño, ~9h).
3. Cross-module postMessage 4 escenarios (Fase 3, ~4h).
4. Reglas de alerta en Kibana (sustituyen Alertmanager).
5. Dify en iframe: verificar comportamiento del sandbox (puede requerir `allow-popups`/`allow-downloads` en el sandbox del iframe del portal).
