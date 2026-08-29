# TEC-01 — Arquitectura e Infraestructura Técnica (Estado Real)

> **Versión:** 1.1 | **Fecha:** Agosto 2026 | **Tipo:** Técnica (CÓMO/ESTADO)
> **Fuentes:** `docker-compose.yml`, `nginx.conf`, `scripts/init-db.sql`, `scripts/campaigns-schema.sql`, `docs/context/ARCHITECTURE.md`, `docs/rag/*`, `Avances/COMPONENTES.md`.
> **Contexto (QUÉ/POR QUÉ):** [CTX-01](../contextual/CTX-01-INFRAESTRUCTURA.md) | Verificación: `docs/PRUEBAS-Y-VERIFICACIONES.md`

---

## 1. Inventario de servicios (docker-compose, 20 servicios)

| Servicio | Imagen | Puerto host→interno | Propósito | Estado |
|---|---|---|---|---|
| `frontend` | node:20-alpine (Next.js) | **4000** | Frontend SPA unificado (Wibsite 2.0) | ✅ |
| `nginx` | nginx:1.27-alpine | **8080**→443, 80→80, 3003→3003 | Reverse proxy + hub estático | ✅ |
| `postgres` | pgvector/pgvector:pg15 | interno 5432 | 5 BD + pgvector | ✅ |
| `redis` | redis:7-alpine | interno 6379 | Cache/colas (Chatwoot, Dify, Twenty, helper, Authelia) | ✅ |
| `weaviate` | semitechnologies/weaviate:1.26.1 | interno 8080 | Vector store RAG | ✅ |
| `t2v-transformers` | transformers-inference (multi-qa-MiniLM-L6-cos-v1) | interno | Embeddings para Weaviate | ✅ |
| `chatwoot` | chatwoot/chatwoot:latest ⚠️ | **3002**→3000 | Bandeja omnicanal (Rails) | ✅ inbox + bridge Twilio |
| `chatwoot-worker` | chatwoot/chatwoot:latest | — | Sidekiq | ✅ |
| `dify-api` | langgenius/dify-api:latest | **5001**→5001 | API Dify | ✅ |
| `dify-worker` | langgenius/dify-api:latest | — | Celery worker | ✅ |
| `dify-web` | langgenius/dify-web:latest | vía Nginx 3003 | Frontend Next.js | ✅ |
| `plugin-daemon` | dify-plugin-daemon:0.6.3-local | **5002** | Plugins Dify (ADR-002) | ✅ |
| `dify-sandbox` | langgenius/dify-sandbox:latest | **8194** | Ejecución de código (sin uso, ADR-020) | ⚠️ idle |
| `n8n` | n8nio/n8n:latest (fijada, ADR-019) | **5679**→5678 | Automatización | 🟡 bug body parser |
| `twenty-server` | twentycrm/twenty:latest | **3001**→3000 | CRM | ✅ |
| `helper` | build `./helper-node` (Node 20, Express 5) | **3100** | API de integración **v2.1.1** | ✅ |
| `authelia` | authelia/authelia:4.37 | interno 9091 | SSO de borde (ADR-016) | ✅ config (runtime por verificar) |
| `elasticsearch` | docker.elastic.co/elasticsearch:${STACK_VERSION:-9.4.2} | **9200** | Trazas y logs OTel | ✅ config |
| `kibana` | docker.elastic.co/kibana:${STACK_VERSION:-9.4.2} | **5601** | UI observabilidad | ✅ config |
| `otel-collector` | otel/opentelemetry-collector-contrib:latest | **4317** gRPC / **4318** HTTP | OTLP → ES (índices `*-doags.otel-production`) | ✅ config ⚠️ password hardcodeada |
| `minio` | minio/minio:latest | **9000** API / **9001** consola | Object storage (ADR: MinIO) | ✅ config |

> Estado `config` = presente en `docker-compose.yml` con configuración; runtime no verificado el 2026-08-12 (Docker Desktop detenido).

Volúmenes: `postgres_data`, `redis_data`, `weaviate_data`, `chatwoot_data`, `dify_storage`, `n8n_data`, `twenty_data`, `plugin_daemon_data`, `elasticsearch_data`, `minio_data`. Red: `wibsite_default`.

## 2. Mapa de acceso (Nginx, 2 servidores)

### Servidor principal (`:8080`)
| Location | Destino | Notas |
|---|---|---|
| `/` | frontend:4000 | Frontend UI Unificado (Glacier UI) |
| `/api/`, `/admin/`, `/campaigns*` | helper:3100 | rate-limit zona `api` 30r/m |
| `/webhooks/`, `/opt-outs/` | helper:3100 | públicos (Meta) |
| `/webhook/`, `/webhook-test/`, `/webhook-waiting/`, `/rest/`, `/static/` | n8n:5678 | webhooks y REST n8n |
| `/n8n/` | n8n:5678 (rewrite) | UI |
| `/chatwoot/` | chatwoot:3000 | con resolver DNS runtime (ADR-014) |
| `/crm/` | twenty-server:3000 | |
| `/dify/` | 301→`:3003/` | compatibilidad |
| `= /health`, `= /api/health` | helper:3100/health | |

### Servidor Dify (`:3003`)
`/console/` `/api/` `/files/` → dify-api:5001 · `/plugins/` → plugin-daemon:5002 · `/marketplace/` → marketplace.dify.ai (proxy CORS) · `/` → dify-web:3000.

**Rate limiting:** zonas `api` 30 r/m, `llm` 5 r/m, `webhooks` 60 r/m → 429. **Security headers:** X-Content-Type-Options, X-Frame-Options SAMEORIGIN, X-XSS-Protection, Referrer-Policy, Permissions-Policy, `server_tokens off`.

## 3. Capa de datos (estado real)

| Store | Uso actual | Detalle |
|---|---|---|
| PostgreSQL `wibsite` | 🟡 Dual write (F-07/F-08) | 6 tablas de `campaigns-schema.sql` (campaigns, campaign_leads, lead_scores, channel_status, opt_outs, workflow_logs) con FKs, índices y triggers `updated_at`; store facade (JSON + PG) implementada; **cutover PG primario pendiente (F-09)** |
| PostgreSQL `chatwoot/dify/n8n/twenty` | ✅ | Propias de cada módulo (init-db.sql) |
| JSON store `helper-node/wibsite-store.json` | ✅ dual (fallback) | 8 colecciones: campaigns, leads, deliveries, scores, channels, optOuts, templates, scoringRules; `updateStore()` atómico con lock (ADR-017); caché TTL 200ms |
| Redis | ✅ | conversationStore (TTL 7d) + colas de módulos; fallback in-memory en helper |
| Weaviate | ✅ | RAG helper (clase por tenant diseñada) + Dify |
| Elasticsearch | ✅ config | Índices `*-doags.otel-production` (trazas/logs OTel) |

**Deuda estructural registrada (DATABASE-VALIDATION):** sin FKs efectivas (huérfanos al borrar campañas/leads), sin RLS, persistencia en archivo plano. Migración planeada DATA §10 (3 fases). Schema multi-tenant objetivo: **Lumi** (16-19 tablas, RLS, UNIQUE compuestos) — ver CTX-06 §8.

## 4. Integraciones externas

| Integración | Configuración | Estado |
|---|---|---|
| OpenRouter (LLM) | `OPENROUTER_API_KEY/BASE_URL/MODEL` (default `openai/gpt-4o-mini`); Dify plugin `openai_api_compatible:0.0.55` | ✅ 7 modelos |
| Meta WhatsApp API | App ID/Phone Number ID/WABA documentados; verify token `wibsite_verify_2026` | 🔴 token permanente pendiente (P0-01) — **reemplazado por Twilio** |
| Twilio | Credenciales en `.env`; proxy en helper | ✅ bridge real: inbound (F-05), broadcast + StatusCallback (F-06), typing + opt-out (F-24) |
| Twenty REST/GraphQL | `TWENTY_URL` + `TWENTY_API_KEY` (JWT ES256) | ✅ |

## 5. Seguridad de borde y de servicio

- **Authelia** (ADR-016): usuarios file-based argon2id, sesión 8h en Redis, `auth_request` a `http://authelia:9091/api/authz/auth-request`. Rutas públicas: `/hub/`, `/webhooks/`, `/opt-outs/`, `/health`, `/api/health`. Kibana y MinIO consola también detrás de auth (`/kibana/`, `/minio-console/`).
- **Helper middleware** (`helper-node/middleware/`): API Key (`X-API-Key`), rate limiting 30/60 req-min, sanitizador (23 patrones de inyección), HMAC para webhooks Meta y Chatwoot.
- ⚠️ **Gaps conocidos (re-auditoría F-35):** `x-api-key "test"` hardcodeada en `nginx.conf:214`; comparación de API key sin timing-safe (`!==`); `certs/nginx.key` y `wibsite-store.json` (PII) commiteados en git; password ES hardcodeada en `otel-collector/config.yaml`; rutas huérfanas `/reportes/`→metabase y `/erp/`→frappe (servicios no desplegados).
- **Pendientes (SECURITY-MASTER):** HTTPS real (certs generados, no aplicados), CORS restrictivo, secrets rotation, RLS — ver TEC-03 OT-05.

## 6. Flujos de datos implementados (mapa)

**Inbound WhatsApp (Twilio, implementado F-05):** Twilio → `POST /webhooks/whatsapp` (helper) → lead+delivery en store → forward n8n `/webhook/chatwoot-inbound` → Dify lead-classifier → respuesta vía Twilio / escalado → upsert Twenty.

**Outbound campañas (broadcast Twilio, implementado F-06):** n8n schedule → `GET /campaigns/pending` → `/api/twilio/send` con StatusCallback → delivery tracking → `POST /campaigns/track`.

**Bridge Twilio↔Chatwoot (implementado):** `/api/chatwoot/push` (inbound a Chatwoot), `/webhooks/chatwoot-outbound` → Twilio WhatsApp.

**Ruta Meta:** documentada (webhook + verify token en helper), **sin activar** — Twilio es el canal real vigente.

## 7. Expansión de infraestructura (estado)

| Componente | Estado |
|---|---|
| Elastic Stack (ES+Kibana+OTel) | ✅ implementado (compose/config) — sustituye Prometheus+cAdvisor+Grafana y GlitchTip |
| MinIO | ✅ implementado (compose) |
| Metabase BI | ⬜ pendiente (solo ruta huérfana en nginx; requiere migración PG F-09) |
| Frappe ERP | ⬜ pendiente (solo ruta huérfana en nginx) |
| Flowbite | ⬜ pendiente (paralelo) |

Cada UI detrás de Authelia; API S3 de MinIO **sin** `auth_request` (firma S3, previsto).

## 8. Verificación rápida

```bash
docker compose ps                                    # 20 servicios
curl http://localhost:8080/health                    # helper: uptime, módulos, SLI, dependencias
curl http://localhost:8080/api/health                # alias
curl http://localhost:9200/_cluster/health           # Elasticsearch
# Kibana: http://localhost:5601
# TeVS:  PowerShell -ExecutionPolicy Bypass -File scripts/tevs/tevs-runner.ps1 (ver PROCEDIMIENTOS §9)
```
Checklist completo: `docs/PRUEBAS-Y-VERIFICACIONES.md` · Matriz de salud: `Avances/COMPONENTES.md`.

---

## Referencias cruzadas
- → [TEC-02 Funciones e implementación](TEC-02-FUNCIONES-IMPLEMENTACION.md)
- → [TEC-03 Objetivos técnicos](TEC-03-OBJETIVOS-TECNICOS-FASES.md) (expansión §7 como OT-03/04)
- → [CTX-01](../contextual/CTX-01-INFRAESTRUCTURA.md) (rutas de escalado A/B/C)
- → `docs/rag/ENDPOINTS.md`, `docs/rag/ENVIRONMENT-VARIABLES.md`, `docs/rag/DEPENDENCY-MATRIX.md`
