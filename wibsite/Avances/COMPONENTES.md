# ESTADO DE COMPONENTES — Matriz de Salud

> Estado actual de cada componente del sistema — Última actualización: 2026-08-12
> Estado basado en configuración estática (`docker-compose.yml`); Docker Desktop estaba detenido al momento de la revisión → runtime no verificado en vivo.

---

## Servicios Core

| Componente | Puerto | Estado | Health Check | Versión | DB |
|-----------|--------|--------|-------------|---------|----|
| PostgreSQL | — | ✅ OK | pg_isready | 15 + pgvector | — |
| Redis | — | ✅ OK | redis-cli ping | 7 Alpine | — |
| Weaviate | — | ✅ OK | — | 1.26.1 | — |
| t2v-transformers | — | ✅ OK | — | sentence-transformers-multi-qa-MiniLM-L6-cos-v1 | — |
| Nginx | 8080 | ✅ OK | — | 1.27 | — |

## Plataforma

| Componente | Puerto | Estado | Health Check | Funcionalidad Core | DB |
|-----------|--------|--------|-------------|-------------------|----|
| Chatwoot | 3002 | ✅ OK | — | ✅ UI funcional, ⚠️ inbox WhatsApp pendiente | chatwoot |
| Chatwoot Worker | — | ✅ OK | — | Sidekiq activo | chatwoot |
| Dify API | 5001 | ✅ OK | — | ✅ API funcional, workflow clasificador operativo | dify |
| Dify Web | 3003 | ✅ OK | — | ✅ UI funcional | dify |
| Dify Worker | — | ✅ OK | — | Procesamiento asíncrono activo | dify |
| Plugin Daemon | 5002 | ✅ OK | — | ✅ Plugin openai_api_compatible instalado | — |
| n8n | 5679 | ✅ OK | /healthz | ✅ UI funcional, ⚠️ body parser bug, ⚠️ 3 workflows activos en BD vía SQL (requiere toggle UI) | n8n |
| Twenty CRM | 3001 | ✅ OK | /healthz | ✅ UI funcional, API key JWT configurada, 10 campos custom | twenty |
| Helper Node | 3100 | ✅ OK | /health | ✅ ~108 rutas funcionales (~35+ grupos), dashboard SPA, PostgreSQL con fallback JSON | wibsite |

## Observabilidad (Elastic Stack — reemplaza Prometheus/Grafana/cAdvisor/GlitchTip)

| Componente | Puerto | Estado | Health Check | Notas |
|-----------|--------|--------|-------------|-------|
| Elasticsearch | 9200 | ✅ Config (compose) | /_cluster/health | v9.4.2 (STACK_VERSION), credencial ELASTIC_PASSWORD desde `.env` |
| Kibana | 5601 | ✅ Config (compose) | /api/status | UI de trazas/logs/dashboards |
| OTel Collector | 4317/4318 | ✅ Config (compose) | /healthz | OTLP gRPC+HTTP → export a elasticsearch:9200; `otel-collector/config.yaml` |
| MinIO | 9000/9001 | ✅ Config (compose) | /minio/health/live | Object storage + consola web |

> ⚠️ Gap conocido: `otel-collector/config.yaml` usa password hardcodeada (`wibsite_elastic_pass_2026`); si `ELASTIC_PASSWORD` en `.env` difiere, la exportación a ES falla silenciosamente. Corregir en F-35/re-auditoría.

## Autenticación

| Componente | Puerto | Estado | Notas |
|-----------|--------|--------|-------|
| Authelia | 9091 | ✅ Config (compose) | Servicio en compose (imagen `authelia/authelia:4.37`) + nginx auth_request. Runtime no verificado (Docker Desktop detenido) |
| Authelia DB | — | ✅ Config | users.yml y configuration.yml preparados |

## Servicios Auxiliares

| Componente | Estado | Notas |
|-----------|--------|-------|
| Dify Sandbox | ✅ OK | Puerto 8194, no utilizado (Code nodes reemplazados por LLM nodes) |
| N8N Workflows en BD | ✅ 3 activos | Seteados vía SQL directo, requieren toggle UI |
| Certificados SSL | ⚠️ Revisar | nginx.crt + nginx.key en certs/; **nginx.key (clave privada) está commiteada en git — mover fuera del repo** |

---

## APIs y Endpoints

### Helper Node (~108 rutas; v2.1.1 según package.json)

| Grupo | Endpoints | Estado |
|-------|----------|--------|
| Dashboard | `/api/dashboard/summary` | ✅ |
| Campañas CRUD | POST/GET/PATCH/DELETE + schedule/start/pause/complete | ✅ |
| Campañas Leads | POST/GET leads + upload Excel/CSV + track + stats | ✅ |
| Plantillas | GET/POST/DELETE + preview | ✅ |
| Scoring | GET/PUT rules + evaluate + evaluate-all | ✅ |
| Twenty CRM | health + sync + sync-all | ✅ |
| Canales | GET list + PATCH channel + opt-outs | ✅ |
| Twilio | send + status callback + typing (F-06/F-24) | ✅ |
| Conversación/Agente | conversationStore, agentCore POC, chat LLM | ✅ |
| Seed | POST seed + DELETE clear | ✅ |
| Legacy v1 | /campaigns, /webhooks/whatsapp, /opt-outs, /chatwoot/normalize | ✅ |

### Dify

| Endpoint | Estado |
|----------|--------|
| `POST /console/api/login` | ✅ Login funcional (email + password Base64) |
| `POST /v1/workflows/run` | ✅ Workflow ejecutable (blocking mode) |
| `POST /console/api/workspaces/current/plugin/install/marketplace` | ✅ Marketplace funcional |
| Resto de Console API | ✅ Con cookie + CSRF token |

### n8n

| Endpoint | Estado |
|----------|--------|
| `POST /rest/login` | ✅ Funcional (usar `emailOrLdapLoginId`) |
| `POST /webhook/chatwoot-inbound` | ✅ Webhook endpoint procesa JSON correctamente |
| `POST /rest/workflows` | ❌ Body parser bug (no acepta JSON) |
| `POST /rest/credentials` | ❌ Body parser bug (no acepta JSON) |
| `GET /rest/workflows` | ✅ Listar workflows |
| `GET /healthz` | ✅ Health check |

### Twenty CRM

| Endpoint | Estado |
|----------|--------|
| `GET /rest/people` | ✅ Listar personas (GraphQL-wrapped) |
| `POST /rest/metadata/fields` | ✅ Crear campos custom |
| GraphQL API | ✅ Funcional |

---

## Conexiones Externas

| Proveedor | Estado | Detalle |
|-----------|--------|---------|
| OpenRouter | ✅ Configurado | API key en `.env`, 7 modelos registrados, endpoint `https://openrouter.ai/api/v1` |
| Twilio | ✅ Configurado | Bridge WhatsApp/SMS activo (TEC-06 F-03…F-06): inbound webhook + status callback + typing + opt-out |
| Meta WhatsApp API | ❌ No configurado | Faltan META_APP_ID, META_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID — reemplazado por Twilio |
| xAI (Grok) | ❌ Deprecado | Sin créditos, reemplazado por OpenRouter |
| Plugin Marketplace Dify | ✅ Funcional | `https://marketplace.dify.ai/api` |

---

## Almacenamiento

| Base de Datos | Estado | Esquemas |
|--------------|--------|----------|
| PostgreSQL `chatwoot` | ✅ OK | Schema Rails estándar |
| PostgreSQL `dify` | ✅ OK | Schema Dify estándar |
| PostgreSQL `n8n` | ✅ OK | Schema n8n estándar |
| PostgreSQL `twenty` | ✅ OK | Schema Twenty estándar |
| PostgreSQL `wibsite` | ✅ OK | campaigns, campaign_leads, lead_scores, channel_status, opt_outs, workflow_logs |
| JSON file store | ✅ Fallback | `helper-node/wibsite-store.json` — se activa si PostgreSQL no responde |
| Weaviate | ✅ OK | Vectores para Dify RAG |
