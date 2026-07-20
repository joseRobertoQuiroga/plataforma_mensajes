# ESTADO DE COMPONENTES — Matriz de Salud

> Estado actual de cada componente del sistema — Última actualización: 2026-07-18

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
| n8n | 5679 | ✅ OK | /healthz | ✅ UI funcional, ⚠️ body parser bug, ⚠️ workflows en BD pero requiere toggle UI | n8n |
| Twenty CRM | 3001 | ✅ OK | /healthz | ✅ UI funcional, API key JWT configurada, 10 campos custom | twenty |
| Helper Node | 3100 | ✅ OK | /health | ✅ 35+ endpoints funcionales, dashboard SPA, PostgreSQL con fallback JSON | wibsite |

## Autenticación

| Componente | Puerto | Estado | Notas |
|-----------|--------|--------|-------|
| Authelia | 9091 | ⚠️ Pendiente | Configuración documentada en CHECKLIST-SSO.md, no implementada como gateway |
| Authelia DB | — | ⚠️ Pendiente | users.yml y configuration.yml preparados |

## Servicios Auxiliares

| Componente | Estado | Notas |
|-----------|--------|-------|
| Dify Sandbox | ✅ OK | Puerto 8194, no utilizado (Code nodes reemplazados por LLM nodes) |
| N8N Workflows en BD | ✅ 3 activos | Seteados vía SQL directo, requieren toggle UI |
| Certificados SSL | ✅ OK | nginx.crt + nginx.key generados en certs/ |

---

## APIs y Endpoints

### Helper Node v2 (35+ endpoints)

| Grupo | Endpoints | Estado |
|-------|----------|--------|
| Dashboard | `/api/dashboard/summary` | ✅ |
| Campañas CRUD | POST/GET/PATCH/DELETE + schedule/start/pause/complete | ✅ |
| Campañas Leads | POST/GET leads + upload Excel/CSV + track + stats | ✅ |
| Plantillas | GET/POST/DELETE + preview | ✅ |
| Scoring | GET/PUT rules + evaluate + evaluate-all | ✅ |
| Twenty CRM | health + sync + sync-all | ✅ |
| Canales | GET list + PATCH channel + opt-outs | ✅ |
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
| Meta WhatsApp API | ❌ No configurado | Faltan META_APP_ID, META_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID |
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
