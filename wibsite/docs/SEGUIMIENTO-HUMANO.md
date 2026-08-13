# Wibsite Business — Seguimiento Humano del Sistema

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Propósito:** Mapa completo de funcionalidades, ubicación en código, documentación cruzada y estado de implementación para seguimiento rápido.

---

## Índice de Módulos

1. [Helper Node - API Core](#1-helper-node)
2. [Seguridad y Autenticación](#2-seguridad)
3. [Campañas Multi-Canal](#3-campañas)
4. [Leads y Scoring](#4-leads)
5. [Plantillas de Mensajes](#5-plantillas)
6. [Motor Agéntico y Comercial](#6-motor-agentico)
7. [CRM Twenty](#7-crm-twenty)
8. [Chatwoot y Twilio Bridge](#8-chatwoot-twilio)
9. [n8n Automatizaciones](#9-n8n)
10. [Dify IA](#10-dify)
11. [Infraestructura y Orquestación](#11-infraestructura)
12. [Observabilidad](#12-observabilidad)
13. [Portal y UX](#13-portal)
14. [Base de Datos](#14-base-de-datos)

---

## 1. Helper Node — API Core

### 1.1 Servidor Express
| Campo | Detalle |
|-------|---------|
| Estado | ✅ Implementado |
| Archivo | `helper-node/index.js:21-27` |
| Puerto | 3100 |
| Dependencias | express 5.x, cors, pino, multer, pg, axios |

### 1.2 Endpoints de Health y Métricas

| Función | Endpoint | Archivo:Línea | Estado | Documentación |
|---------|----------|---------------|--------|---------------|
| Health check | `GET /health` | `index.js:2164-2204` | ✅ | `docs/context/HELPER-NODE.md` |
| SLI Metrics | `GET /api/sli/metrics` | `index.js:2206-2234` | ✅ | `docs/PRUEBAS-COMPLETAS.md §1.6` |
| Prometheus Metrics | `GET /metrics` | `index.js:54-57` | ✅ | `docs/tecnica/TEC-06.md F-37` |
| Dashboard Summary | `GET /api/dashboard/summary` | `index.js:1216-1233` | ✅ | `docs/TAREAS-FUNCIONALES.md §9` |

### 1.3 Middlewares Globales

| Middleware | Archivo:Línea | Función | Estado |
|------------|---------------|---------|--------|
| CORS | `index.js:24` | `cors()` sin restricciones | ✅ |
| JSON Parser | `index.js:25` | `express.json({limit:'50mb'})` | ✅ |
| Auth API Key | `middleware/auth.js:59` | `authMiddleware` valida X-API-Key | ✅ |
| Rate Limiter | `middleware/rateLimiter.js:56` | 30 req/min API, 5 req/min LLM | ✅ |
| Sanitizer | `middleware/sanitizer.js:71` | 23 patrones de inyección | ✅ |
| PII Filter | `services/piiFilter.js:66` | Redacta phone, email, keys en logs | ✅ |
| Audit Logger | `services/auditLogger.js:67` | 12 event types, persistencia PG | ✅ |
| HMAC Meta | `middleware/auth.js:27` | `verifyMetaWebhookSignature` | ✅ |
| HMAC Chatwoot | `middleware/auth.js:43` | `verifyChatwootWebhookSignature` | ✅ |

### 1.4 Store y Persistencia

| Componente | Archivo | Función | Estado |
|------------|---------|---------|--------|
| JSON Store | `index.js:72-110` | `loadStore()`, `saveStore()`, `updateStore()` | ✅ Legacy |
| Store Facade | `services/store.js` | `getStore()`, `updateStore()`, `getStoreMode()` | ✅ Dual mode |
| PG Store | `services/pgStore.js` | CampaignStore, LeadStore, ScoreStore, OptOutStore, ChannelStore | ✅ Implementado |
| Pool PG | `index.js:78-94` | `new Pool()` + `query()` function | ✅ PostgreSQL |

---

## 2. Seguridad y Autenticación

### 2.1 Authelia SSO

| Aspecto | Detalle | Archivo:Línea | Estado |
|---------|---------|---------------|--------|
| Configuración | Dominio localhost, sesión 8h, file auth | `authelia/configuration.yml` | ✅ |
| Usuarios | admin@wibsite.com, argon2id | `authelia/users.yml` | ✅ |
| Docker Service | authelia:4.37, puerto 9091 | `docker-compose.yml:435-451` | ✅ |
| nginx auth_request | Endpoint interno /auth | `nginx.conf:30-45` | ✅ |
| Rutas protegidas | /n8n/, /chatwoot/, /crm/, /admin/, /api/ | `nginx.conf` | ✅ |
| Rutas públicas | /hub/, /webhooks/, /health/, /storage/ | `nginx.conf` | ✅ |

**Documentación relacionada:** `docs/CHECKLIST-SSO.md`, `docs/MEMORY.md ADR-016`

### 2.2 API Key Authentication

| Aspecto | Detalle | Archivo:Línea |
|---------|---------|---------------|
| Header requerido | `X-API-Key` | `middleware/auth.js:7-24` |
| Rutas públicas | /health, /webhooks/whatsapp GET, /opt-outs/ | `middleware/auth.js:10-15` |
| Respuesta 401 | `{error: "API key required"}` | `middleware/auth.js:17` |

### 2.3 Rate Limiting

| Aspecto | Detalle | Archivo:Línea |
|---------|---------|---------------|
| API general | 30 req/min, burst 10 | `middleware/rateLimiter.js` |
| LLM endpoints | 5 req/min | `middleware/rateLimiter.js:40-48` |
| Almacenamiento | In-memory Map por IP | `middleware/rateLimiter.js:7` |
| Respuesta 429 | `{error: "Too many requests"}` | `middleware/rateLimiter.js:49` |

### 2.4 Sanitizador de Prompts

| Aspecto | Detalle | Archivo:Línea |
|---------|---------|---------------|
| Patrones | 23 patrones de inyección | `middleware/sanitizer.js:18-42` |
| Bloqueo | Reemplaza por "[Mensaje bloqueado por seguridad]" | `middleware/sanitizer.js:55-70` |
| Logging | Alerta de seguridad por cada bloqueo | `middleware/sanitizer.js:62` |

### 2.5 PII Filter

| Aspecto | Detalle | Archivo:Línea |
|---------|---------|---------------|
| Teléfonos | `\+?\d{7,15}` → `[PHONE_REDACTED]` | `services/piiFilter.js:5` |
| Emails | `[\w\.-]+@[\w\.-]+` → `[EMAIL_REDACTED]` | `services/piiFilter.js:6` |
| API Keys | `sk-|api-[a-zA-Z0-9]{20,}` → `[KEY_REDACTED]` | `services/piiFilter.js:7` |
| Whitelist | Campos técnicos (id, status, score, etc.) | `services/piiFilter.js:14-20` |

### 2.6 Audit Logger

| Aspecto | Detalle | Archivo:Línea |
|---------|---------|---------------|
| Event types | 12 tipos (security_alert, api_call, handoff, etc.) | `services/auditLogger.js:7-10` |
| Persistencia | Tabla `audit_logs` en PostgreSQL | `services/auditLogger.js:38-46` |
| Middleware | `createAuditMiddleware(eventType)` | `services/auditLogger.js:53-65` |
| Schema SQL | `scripts/audit-logs-schema.sql` | ✅ |

---

## 3. Campañas Multi-Canal

### 3.1 CRUD de Campañas

| Función | Endpoint | Archivo:Línea | Estado | Documentación |
|---------|----------|---------------|--------|---------------|
| Crear campaña | `POST /api/campaigns` | `index.js:115-135` | ✅ | `docs/context/CAMPAIGNS.md` |
| Listar campañas | `GET /api/campaigns` | `index.js:137-146` | ✅ | |
| Obtener campaña | `GET /api/campaigns/:id` | `index.js:158-164` | ✅ | |
| Actualizar campaña | `PATCH /api/campaigns/:id` | `index.js:205-220` | ✅ | |
| Eliminar campaña | `DELETE /api/campaigns/:id` | `index.js:275-283` | ✅ | |
| Campañas pendientes | `GET /api/campaigns/pending` | `index.js:148-156` | ✅ | |

### 3.2 Ciclo de Vida

| Función | Endpoint | Archivo:Línea | Descripción |
|---------|----------|---------------|-------------|
| Schedule | `POST /api/campaigns/:id/schedule` | `index.js:222-232` | draft → scheduled |
| Start | `POST /api/campaigns/:id/start` | `index.js:233-241` | scheduled → sending |
| Pause | `POST /api/campaigns/:id/pause` | `index.js:243-251` | sending → paused |
| Complete | `POST /api/campaigns/:id/complete` | `index.js:267-273` | → completed |

### 3.3 Tracking y Estadísticas

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Tracking envíos | `POST /api/campaigns/track` | `index.js:880-916` | ✅ |
| Stats campaña | `GET /api/campaigns/:id/stats` | `index.js:960-982` | ✅ |
| Export CSV | `GET /api/campaigns/:id/export` | `index.js:1274-1300` | ✅ |

### 3.4 Legacy v1 (compatibilidad n8n)

| Endpoint | Archivo:Línea | Propósito |
|----------|---------------|-----------|
| `POST /campaigns` | `index.js:985-1000` | Crear campaña (v1) |
| `GET /campaigns` | `index.js:1002-1015` | Listar (v1) |
| `GET /campaigns/pending` | `index.js:1017-1030` | Pendientes (v1) |
| `POST /campaigns/:id/schedule` | `index.js:1032-1043` | Schedule (v1) |
| `POST /campaigns/:id/complete` | `index.js:1045-1055` | Completar (v1) |
| `POST /campaigns/track` | `index.js:1057-1064` | Track (v1) |

**Archivos relacionados:** `helper-node/index.js`, `scripts/campaigns-schema.sql`, `docs/context/CAMPAIGNS.md`  
**Documentación:** `docs/TAREAS-FUNCIONALES.md §1`, `docs/PRUEBAS-COMPLETAS.md §3.1`

---

## 4. Leads y Scoring

### 4.1 CRUD de Leads

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Crear leads | `POST /api/campaigns/:id/leads` | `index.js:367-396` | ✅ |
| Listar leads | `GET /api/campaigns/:id/leads` | `index.js:398-406` | ✅ |
| Editar lead | `PATCH /api/leads/:id` | `index.js:1245-1260` | ✅ |
| Eliminar lead | `DELETE /api/leads/:id` | `index.js:1262-1273` | ✅ |
| Buscar leads | `GET /api/leads/search?q=` | `index.js:1235-1243` | ✅ |
| Top leads | `GET /api/leads/top` | `index.js:945-958` | ✅ |
| Historial scores | `GET /api/leads/:id/scores` | `index.js:935-943` | ✅ |

### 4.2 Importación Excel/CSV

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Upload archivo | `POST /api/campaigns/:id/leads/upload` | `index.js:412-460` | ✅ |
| Auto-detección columnas | phone/name/email | `index.js:436-440` | ✅ |
| Campos no mapeados | → custom_fields automáticos | `index.js:468-474` | ✅ |
| Duplicados | Detección dentro de misma campaña | `index.js:455-462` | ✅ |

### 4.3 Scoring Rule-Based

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Evaluar lead | `POST /api/scoring/evaluate` | `index.js:1118-1141` | ✅ |
| Evaluar todos | `POST /api/scoring/evaluate-all` | `index.js:1144-1164` | ✅ |
| Obtener reglas | `GET /api/scoring/rules` | `index.js:840-864` | ✅ |
| Actualizar reglas | `PUT /api/scoring/rules` | `index.js:866-878` | ✅ |
| Función compartida | `evaluateLead()` | `index.js:1067-1116` | ✅ |
| Comparativa scoring | `GET /api/scoring/compare/:leadId` | `index.js:1217-1242` | ✅ |

**Factores de scoring:** engagement (30%), recency (25%), channel_affinity (15%), profile_completeness (20%), interest_match (10%)  
**Reglas:** +20 reply, +10 open, +15 click, +10 both contact, +5 custom fields, +15 recent, +8 medium, -100 opt-out  
**Umbrales:** Hot ≥ 70, Warm ≥ 40, Cold < 40

### 4.4 Scoring con IA (LLM)

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Evaluar con LLM | `POST /api/scoring/evaluate-llm` | `index.js:1900-1920` | ✅ |
| Chat LLM | `POST /api/llm/chat` | `index.js:1922-1970` | ✅ |
| Health LLM | `GET /api/llm/health` | `index.js:1886-1898` | ✅ |
| Proveedor | OpenRouter (gpt-4o-mini) | `.env` | ✅ |

### 4.5 Lead Profile Builder

| Función | Archivo:Línea | Estado |
|---------|---------------|--------|
| `buildLeadProfile()` | `services/leadProfile.js:27-70` | ✅ |
| `buildTags()` | `services/leadProfile.js:72-86` | ✅ |
| `suggestNextAction()` | `services/leadProfile.js:88-91` | ✅ |
| Perfil incluye: campaign, deliveryStats, scoreHistory, tags, nextAction | `services/leadProfile.js` | ✅ |

**Archivos relacionados:** `helper-node/index.js`, `helper-node/services/leadProfile.js`, `scripts/campaigns-schema.sql`  
**Documentación:** `docs/TAREAS-FUNCIONALES.md §2-3`, `docs/context/HELPER-NODE.md`

---

## 5. Plantillas de Mensajes

### 5.1 Plantillas de Campaña

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Listar | `GET /api/templates` | `index.js:810-820` | ✅ |
| Crear | `POST /api/templates` | `index.js:822-830` | ✅ |
| Eliminar | `DELETE /api/templates/:id` | `index.js:832-838` | ✅ |
| Preview | `POST /api/templates/preview` | `index.js:795-808` | ✅ |

**11 plantillas predefinidas:** WhatsApp (Bienvenida, Promoción, Seguimiento), Messenger (Bienvenida, Oferta), TikTok (Promoción DM, Seguimiento), SMS (Notificación, Promoción), Email (Newsletter, Seguimiento)

### 5.2 Plantillas de Agente Comercial (Template Engine)

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Listar plantillas | `GET /api/agent/templates` | `index.js:299-303` | ✅ |
| Obtener plantilla | `GET /api/agent/templates/:id` | `index.js:315-320` | ✅ |
| Guardar plantilla | `PUT /api/agent/templates/:id` | `index.js:322-329` | ✅ |
| Validar todas | `GET /api/agent/templates/validate` | `index.js:305-313` | ✅ |
| Validar una | `GET /api/agent/templates/validate/:id` | `index.js:329-335` | ✅ |
| `loadTemplate()` | `services/templateEngine.js:21-28` | ✅ |
| `validate()` | `services/templateEngine.js:38-60` | ✅ |
| `merge()` | `services/templateEngine.js:63-73` | ✅ |
| `resolvePlaceholders()` | `services/templateEngine.js:76-83` | ✅ |

**Templates disponibles:**
| Template | Archivo | Objeciones | Productos | Estado |
|----------|---------|------------|-----------|--------|
| Default | `templates/template-default.json` | 8 | — | ✅ |
| Consultora Software | `templates/template-consultora-software.json` | 8 | 4 | ✅ |
| Salón de Eventos | `templates/template-salon-eventos.json` | 5 | 4 | ✅ |

**Documentación:** `docs/TAREAS-FUNCIONALES.md §8`, `docs/context/CAMPAIGNS.md`, `Organizar_Estructurar/esquema-config-plantilla.md`

---

## 6. Motor Agéntico y Comercial

### 6.1 Agent Core — Grafo Comercial

| Componente | Archivo | Estado |
|------------|---------|--------|
| `Graph` class | `services/agentCore/graph.js:1-50` | ✅ |
| `createCommercialGraph()` | `services/agentCore/index.js:12-31` | ✅ |
| `executeCommercialGraph()` | `services/agentCore/index.js:33-37` | ✅ |
| `executeTestGraph()` | `services/agentCore/testGraph.js` | ✅ |

### 6.2 Nodos del Grafo (7 etapas)

| Nodo | Archivo | Función | Estado |
|------|---------|---------|--------|
| entry | `services/agentCore/nodes/entryNode.js` | `createEntryNode()` → llama OpenRouter | ✅ |
| discovery | `services/agentCore/nodes/discoveryNode.js` | `createDiscoveryNode()` → cuenta campos | ✅ |
| qualification | `services/agentCore/nodes/qualificationNode.js` | `createQualificationNode()` → evalúa completitud | ✅ |
| proposal | `services/agentCore/nodes/proposalNode.js` | `createProposalNode()` → matching productos | ✅ |
| closing | `services/agentCore/nodes/closingNode.js` | `createClosingNode()` → decide cierre vs handoff | ✅ |
| handoff | `services/agentCore/nodes/handoffNode.js` | `createHandoffNode()` → genera briefing | ✅ |
| followup | `services/agentCore/nodes/followupNode.js` | `createFollowupNode()` → programa siguiente intento | ✅ |

### 6.3 Endpoints del Agente

| Endpoint | Archivo:Línea | Estado |
|----------|---------------|--------|
| `POST /api/agent/test-graph` | `index.js:289-294` | ✅ |
| `POST /api/agent/commercial-graph` | `index.js:296-303` | ✅ |
| `POST /api/agent/templates` (list) | `index.js:299-303` | ✅ |
| `GET /api/agent/templates/validate` | `index.js:305-313` | ✅ |

### 6.4 Anti-Hallucination

| Función | Archivo:Línea | Estado |
|---------|---------------|--------|
| `enforceKnowledgeBoundaries()` | `services/antiHallucination.js:10-30` | ✅ |
| Patrones de detección | `services/antiHallucination.js:20-28` | ✅ |
| Respuestas predefinidas | Consultas fuera de conocimiento | ✅ |

**Documentación:** `docs/GAPS-MINIFASES.md G-35`, `docs/contextual/CTX-04-LOGICA-VENDEDOR.md`, `docs/contextual/CTX-05-ABSTRACCION-AGENTE-PLANTILLAS-NEGOCIOS.md`

---

## 7. CRM Twenty

### 7.1 Conexión y Health

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Health Check | `GET /api/twenty/health` | `index.js:1854-1872` | ✅ |
| API Key JWT | JWT en .env | `.env:38-43` | ✅ |

### 7.2 Sincronización de Leads

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Sync individual | `POST /api/twenty/sync` | `index.js:1790-1835` | ✅ |
| Sync batch | `POST /api/twenty/sync-all` | `index.js:1839-1872` | ✅ |
| Normalización teléfono | prefijo + | `index.js:1810-1818` | ✅ |
| Paginación | Offset/limit para lotes grandes | `index.js:1848-1855` | ✅ |

### 7.3 Campos Metodológicos (SPICED/MEDDIC)

| Campo | Tipo | Archivo Script | Estado |
|-------|------|----------------|--------|
| leadSituation | TEXT | `scripts/twenty-spiced-meddic-fields.js` | ⬜ Pendiente ejecutar |
| leadPain | TEXT | 〃 | ⬜ |
| leadImpact | TEXT | 〃 | ⬜ |
| leadCriticalEvent | DATE | 〃 | ⬜ |
| leadDecisionRole | SELECT | 〃 | ⬜ |
| leadMetrics | TEXT | 〃 | ⬜ |
| leadEconomicBuyer | TEXT | 〃 | ⬜ |
| leadDecisionCriteria | TEXT | 〃 | ⬜ |
| leadProcess | TEXT | 〃 | ⬜ |
| leadFitScore | NUMBER | 〃 | ⬜ |
| leadQualificationStage | SELECT | 〃 | ⬜ |
| leadContactType | SELECT | 〃 | ⬜ |
| leadConversationMode | SELECT | 〃 | ⬜ |

**Documentación:** `docs/TAREAS-FUNCIONALES.md §4`, `docs/context/TWENTY-CRM.md`, `docs/GAPS-MINIFASES.md G-05..G-07`

---

## 8. Chatwoot y Twilio Bridge

### 8.1 Twilio Inbound Webhook

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Inbound | `POST /webhooks/twilio-inbound` | `index.js:2078-2128` | ✅ |
| Status callback | `POST /webhooks/twilio-status` | `index.js:2130-2150` | ✅ |
| Creación de lead | Automática desde From + Body | `index.js:2098-2115` | ✅ |
| Reenvío a n8n | Formato Chatwoot-compatible | `index.js:2117-2128` | ✅ |

### 8.2 Twilio Outbound Send

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Send message | `POST /api/twilio/send` | `index.js:2029-2091` | ✅ |
| StatusCallback | URL de callback automática | `index.js:2057-2070` | ✅ |
| Delivery tracking | Creación y actualización en store | `index.js:2044-2053, 2075-2082` | ✅ |
| Typing indicator | `POST /api/twilio/typing` | `index.js:2093-2098` | ✅ |

### 8.3 Chatwoot Bridge

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Push to Chatwoot | `POST /api/chatwoot/push` | `index.js:2156-2182` | ✅ |
| Función helper | `pushToChatwoot(phone, name, msg)` | `index.js:2136-2148` | ✅ |
| Outbound webhook | `POST /webhooks/chatwoot-outbound` | `index.js:2184-2220` | ✅ |
| Normalize payload | `POST /api/chatwoot/normalize` | `index.js:1882-1898` | ✅ |

**Configuración:** `.env` (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_SANDBOX_NUMBER)  
**Documentación:** `docs/GAPS-MINIFASES.md G-01..G-04`, `docs/RUTA-ACCIONES-PENDIENTES.md Tarea 4`

---

## 9. n8n Automatizaciones

### 9.1 Workflows Importados

| Workflow | Archivo | Estado | Descripción |
|----------|---------|--------|-------------|
| 01 - Inbound WhatsApp → Dify → Twenty | `n8n/workflows/01-inbound-message.json` | ⬜ Inactivo | Webhook Chatwoot → Dify → Twenty |
| 02 - Campaign Broadcast WhatsApp | `n8n/workflows/02-campaign-broadcast.json` | ⬜ Inactivo | Schedule → Helper → Meta/Twilio |
| 03 - Helper Score & Sync | `n8n/workflows/03-helper-score-sync.json` | ⬜ Inactivo | Scoring automático |

### 9.2 Activación

| Acción | Método | Estado |
|--------|--------|--------|
| Activar desde UI | n8n UI (workaround body parser bug) | ⬜ Pendiente |
| Activar vía SQL | `scripts/fix-n8n-workflow.js` | 🟡 Workaround |
| Script automatizado | `scripts/activate-n8n-workflows.js` | ⬜ Pendiente crear |

**Bug conocido:** n8n 2.23.4 body parser bug impide REST API. Usar UI.  
**Documentación:** `docs/context/N8N.md`, `docs/RUTA-ACCIONES-PENDIENTES.md Tarea 1`

---

## 10. Dify IA

### 10.1 Servicios Dify

| Servicio | Puerto | Docker | Estado |
|----------|--------|--------|--------|
| API | 5001 | `wibsite-dify-api` | ✅ |
| Web | 3003 | `wibsite-dify-web` | ✅ |
| Worker | — | `wibsite-dify-worker` | ✅ |
| Plugin Daemon | 5002 | `wibsite-plugin-daemon` | ✅ |
| Sandbox | 8194 | `wibsite-dify-sandbox` | ✅ |

### 10.2 Workflows Dify

| Workflow | Archivo | Estado |
|----------|---------|--------|
| WhatsApp Lead Classifier | `dify/workflows/whatsapp-lead-classifier.yml` | ✅ Importado |
| 8 nodos LLM | detect_language, classify_intent, extract_contact, calculate_score, generate_response, assemble_result | ✅ |
| Campaign Content Generator | `dify/workflows/campaign-content-generator.yml` | ⬜ Pendiente importar |

### 10.3 OpenRouter Integration

| Aspecto | Detalle | Estado |
|---------|---------|--------|
| Proveedor | OpenRouter API | ✅ |
| Modelo | openai/gpt-4o-mini (default) | ✅ |
| Plugin | langgenius/openai_api_compatible:0.0.55 | ✅ |
| Endpoint scoring | `POST /api/scoring/evaluate-llm` | ✅ |
| Endpoint chat | `POST /api/llm/chat` | ✅ |

**Documentación:** `docs/context/DIFY.md`, `docs/TAREAS-FUNCIONALES.md §6`

---

## 11. Infraestructura y Orquestación

### 11.1 Contenedores Docker

| Servicio | Imagen | Puerto | Estado |
|----------|--------|--------|--------|
| PostgreSQL | pgvector/pgvector:pg15 | 5432 | ✅ |
| Redis | redis:7-alpine | 6379 | ✅ |
| Weaviate | semitechnologies/weaviate:1.26.1 | — | ✅ |
| t2v-transformers | transformers-inference | — | ✅ |
| Chatwoot | chatwoot/chatwoot:latest | 3002 | ✅ |
| Dify API | langgenius/dify-api:latest | 5001 | ✅ |
| Dify Web | langgenius/dify-web:latest | 3003 | ✅ |
| Dify Worker | langgenius/dify-api | — | ✅ |
| Plugin Daemon | langgenius/dify-plugin-daemon | 5002 | ✅ |
| Dify Sandbox | langgenius/dify-sandbox | 8194 | ✅ |
| n8n | n8nio/n8n:latest | 5679 | ✅ |
| Twenty CRM | twentycrm/twenty:latest | 3001 | ✅ |
| Helper Node | local (build) | 3100 | ✅ |
| Authelia | authelia/authelia:4.37 | 9091 | ✅ |
| Nginx | nginx:1.27-alpine | 8080/3003 | ✅ |

### 11.2 Servicios de Observabilidad (en compose, pendientes de levantar)

| Servicio | Imagen | Puerto | Estado |
|----------|--------|--------|--------|
| cAdvisor | gcr.io/cadvisor/cadvisor | 8088 | ⬜ |
| Prometheus | prom/prometheus | 9090 | ⬜ |
| Grafana | grafana/grafana | 3004 | ⬜ |
| GlitchTip | glitchtip/glitchtip | 8282 | ⬜ |
| MinIO | minio/minio | 9000/9001 | ⬜ |

### 11.3 Nginx Reverse Proxy

| Ruta | Destino | Auth | Estado |
|------|---------|------|--------|
| `/hub/` | Hub estático | No | ✅ |
| `/webhooks/` | Helper:3100 | No | ✅ |
| `/webhook/` | n8n:5678 | No | ✅ |
| `/opt-outs/` | Helper:3100 | No | ✅ |
| `/health` | Helper:3100 | No | ✅ |
| `/api/` | Helper:3100 | Sí | ✅ |
| `/admin/` | Helper:3100 | Sí | ✅ |
| `/campaigns/` | Helper:3100 | Sí | ✅ |
| `/n8n/` | n8n:5678 | Sí | ✅ |
| `/chatwoot/` | Chatwoot:3000 | Sí | ✅ |
| `/crm/` | Twenty:3000 | Sí | ✅ |
| `/grafana/` | Grafana:3000 | Sí | 🟡 Pendiente servicio |
| `/glitchtip/` | GlitchTip:8282 | Sí | 🟡 Pendiente servicio |
| `/minio-console/` | MinIO:9001 | Sí | 🟡 Pendiente servicio |
| `/storage/` | MinIO:9000 | No | 🟡 Pendiente servicio |
| `/portal/` | Portal shell | Sí | ✅ |
| `/reportes/` | Metabase:3000 | Sí | 🟡 Pendiente servicio |
| `/erp/` | Frappe:8000 | Sí | 🟡 Pendiente servicio |

**Archivo:** `nginx.conf` (269 líneas, versión v4)  
**Documentación:** `docs/context/HELPER-NODE.md`, `specs/ARCHITECTURE.md`

---

## 12. Observabilidad

### 12.1 SLI/SLO Monitoring

| Función | Endpoint | Archivo:Línea | Estado |
|---------|----------|---------------|--------|
| Health+ endpoint | `GET /health` | `index.js:2164-2204` | ✅ |
| Métricas SLI | `GET /api/sli/metrics` | `index.js:2206-2234` | ✅ |
| Uptime tracking | Desde inicio del servicio | `index.js:2146-2149` | ✅ |
| Error rate | 24h rolling | `index.js:2169` | ✅ |
| Delivery success rate | 24h | `index.js:2171` | ✅ |
| Prometheus metrics | `GET /metrics` | `index.js:54-57` | ✅ (prom-client) |

**Métricas expuestas:** uptime, requestCount, errorRate, avgLatencyMs, deliverySuccessRate24h

### 12.2 Dashboards CLI

| Dashboard | Archivo | Propósito |
|-----------|---------|-----------|
| System | `scripts/monitor/dashboard-system.ps1` | Contenedores, health, módulos |
| Flows | `scripts/monitor/dashboard-flows.ps1` | Inbound, broadcast, scoring |
| Data | `scripts/monitor/dashboard-data.ps1` | Campañas, leads, distribución |
| API | `scripts/monitor/dashboard-api.ps1` | 15 endpoints, latencia |

**Documentación:** `docs/tecnica/TEC-06.md F-36..F-40`, `docs/GAPS-MINIFASES.md G-23..G-24`

---

## 13. Portal y UX

### 13.1 Hub Central

| Aspecto | Detalle | Archivo | Estado |
|---------|---------|---------|--------|
| Página principal | Mosaico con tarjetas de módulos | `hub/index.html` | ✅ |
| LEDs de estado | Por servicio | `hub/index.html` | ✅ |
| Redirección raíz | `/` → `/hub/` | `nginx.conf:38-40` | ✅ |

### 13.2 Portal Shell

| Componente | Detalle | Archivo | Estado |
|------------|---------|---------|--------|
| Sidebar | 9 módulos de navegación | `hub/portal/index.html:55-70` | ✅ |
| Iframe sandbox | Carga módulos | `hub/portal/index.html:93` | ✅ |
| postMessage | Protocolo wibsite-portal/wibsite-module | `hub/portal/index.html:120-128` | ✅ |
| Health checker | Status bar cada 30s | `hub/portal/index.html:132-140` | ✅ |
| Breadcrumb | Módulo activo | `hub/portal/index.html:84` | ✅ |
| Watermark | Versión del sistema | `hub/portal/index.html:96` | ✅ |

### 13.3 Dashboard SPA

| Tab | Archivo | Estado |
|-----|---------|--------|
| Dashboard (resumen) | `helper-node/public/index.html` | ✅ |
| Campañas | 〃 | ✅ |
| Leads | 〃 | ✅ |
| Plantillas | 〃 | ✅ |
| Canales | 〃 | ✅ |

**Funcionalidades del Dashboard SPA:**
- Cards KPI (campañas activas, leads, deliveries)
- LEDs de canales (5 canales)
- Barra de entregas (sent/delivered/read/replied/failed)
- Tabla de campañas con acciones (▶ ⏸ ✏ 🗑)
- Modal de importación Excel (drag & drop + preview)
- Tabla de leads con scores y colores
- Filtro por campaña y estado
- CRUD de plantillas con preview
- Botones de acción rápida (Seed, Clear, Sync, Score, LLM)
- Auto-refresh cada 15s

**Documentación:** `docs/TAREAS-INTERFAZ.md`, `docs/PRUEBAS-COMPLETAS.md §9`

---

## 14. Base de Datos

### 14.1 PostgreSQL — Tablas

| Tabla | Propósito | Archivo Schema | Registros | Estado |
|-------|-----------|----------------|-----------|--------|
| `campaigns` | Campañas multi-canal | `scripts/campaigns-schema.sql:6-29` | ~29 | ✅ |
| `campaign_leads` | Leads por campaña | `scripts/campaigns-schema.sql:32-60` | ~3072 | ✅ |
| `lead_scores` | Historial de scores | `scripts/campaigns-schema.sql:63-75` | ~73 | ✅ |
| `channel_status` | Estado de canales (LEDs) | `scripts/campaigns-schema.sql:78-92` | 5 | ✅ |
| `opt_outs` | Registro de bajas | `scripts/campaigns-schema.sql:95-106` | — | ✅ |
| `workflow_logs` | Logs de automatización | `scripts/campaigns-schema.sql:109-121` | — | ✅ |
| `audit_logs` | Logs de auditoría | `scripts/audit-logs-schema.sql` | — | ✅ |

### 14.2 Redis

| Uso | Archivo | Estado |
|-----|---------|--------|
| Conversation store (9 estados) | `services/conversationStore.js` | ✅ |
| Cache (futuro LLM cache) | Pendiente | ⬜ |

### 14.3 Weaviate

| Uso | Archivo | Estado |
|-----|---------|--------|
| RAG vector store | `services/ragEngine.js` | ✅ |
| Documentos cargados | 0 | ⬜ Pendiente |

**Documentación:** `docs/DATABASE-VALIDATION.md`, `scripts/campaigns-schema.sql`, `scripts/audit-logs-schema.sql`, `scripts/db/orphan-check.sql`

---

## 15. Scripts de Automatización

| Script | Propósito | Archivo | Estado |
|--------|-----------|---------|--------|
| migrate-json-to-pg.js | Migrar JSON store → PostgreSQL | `scripts/db/migrate-json-to-pg.js` | ✅ |
| twenty-spiced-meddic-fields.js | Crear campos SPICED/MEDDIC en Twenty | `scripts/twenty-spiced-meddic-fields.js` | ✅ |
| verify-fase.sh | Verificación por oleada | `scripts/verify/verify-fase.sh` | ✅ |
| contract-tests.js | Tests de contratos entre módulos | `scripts/verify/contract-tests.js` | ✅ |
| cli-validation.ps1 | Suite de validación CLI | `scripts/verify/cli-validation.ps1` | ✅ |
| backup.sh | Backup de BD + config | `scripts/backup.sh` | ✅ |
| generate-certs.sh | Generar certificados SSL | `scripts/generate-certs.sh` | ⬜ Pendiente |
| setup-pg-roles.js | Roles PostgreSQL por servicio | `scripts/setup-pg-roles.js` | ⬜ Pendiente |
| activate-n8n-workflows.js | Activar workflows n8n | `scripts/activate-n8n-workflows.js` | ⬜ Pendiente |
| verify-dify-workflow.js | Verificar workflow Dify | `scripts/verify-dify-workflow.js` | ⬜ Pendiente |
| load-kb-documents.js | Cargar documentos a KB | `scripts/load-kb-documents.js` | ⬜ Pendiente |
| dashboard-system.ps1 | Dashboard sistema | `scripts/monitor/dashboard-system.ps1` | ✅ |
| dashboard-flows.ps1 | Dashboard flujos | `scripts/monitor/dashboard-flows.ps1` | ✅ |
| dashboard-data.ps1 | Dashboard datos | `scripts/monitor/dashboard-data.ps1` | ✅ |
| dashboard-api.ps1 | Dashboard API | `scripts/monitor/dashboard-api.ps1` | ✅ |
| orphan-check.sql | Detectar huérfanos en BD | `scripts/db/orphan-check.sql` | ✅ |

---

## 16. Resumen de Estado por Funcionalidad

| # | Funcionalidad | Estado | Archivos Clave | Documentación |
|---|--------------|--------|----------------|---------------|
| 1 | CRUD Campañas | ✅ | `index.js:115-283` | `CAMPAIGNS.md`, `TAREAS-FUNC §1` |
| 2 | Importación Excel/CSV | ✅ | `index.js:412-490` | `TAREAS-FUNC §2` |
| 3 | Scoring Rule-Based | ✅ | `index.js:1067-1164` | `TAREAS-FUNC §3` |
| 4 | Scoring LLM | ✅ | `index.js:1900-1920` | `TAREAS-FUNC §3.2` |
| 5 | Twenty CRM Sync | ✅ | `index.js:1790-1872` | `TAREAS-FUNC §4` |
| 6 | Template Engine | ✅ | `services/templateEngine.js` | `CTX-05`, `GAPS G-15` |
| 7 | Grafo Comercial 7 etapas | ✅ | `services/agentCore/*.js` | `CTX-04`, `GAPS G-35` |
| 8 | Anti-Hallucination | ✅ | `services/antiHallucination.js` | — |
| 9 | PII Filter | ✅ | `services/piiFilter.js` | `TEC-06 F-33` |
| 10 | Audit Logger | ✅ | `services/auditLogger.js` | `TEC-06 F-33` |
| 11 | Authelia SSO | 🟡 Falta activación | `authelia/*.yml`, `nginx.conf` | `CHECKLIST-SSO.md` |
| 12 | Twilio Inbound/Outbound | ✅ | `index.js:2029-2220` | `GAPS G-01..G-04` |
| 13 | Chatwoot Bridge | ✅ | `index.js:2136-2220` | `GAPS G-02` |
| 14 | Portal Shell | ✅ | `hub/portal/index.html` | `TEC-06 F-43` |
| 15 | SPICED/MEDDIC Campos | ⬜ Pendiente ejecutar | `scripts/twenty-spiced-meddic-fields.js` | `TEC-06 F-25` |
| 16 | n8n Workflows | ⬜ Inactivos | `n8n/workflows/*.json` | `RUTA-ACCIONES` |
| 17 | Dify Workflow Publicado | ⬜ Pendiente | `dify/workflows/` | `TAREAS-FUNC §6` |
| 18 | Prometheus/Grafana | 🟡 En compose | `docker-compose.yml`, `monitoring/prometheus.yml` | `TEC-06 F-36` |
| 19 | GlitchTip | 🟡 En compose | `docker-compose.yml` | `TEC-06 F-38` |
| 20 | MinIO | 🟡 En compose | `docker-compose.yml` | `TEC-06 F-39` |
| 21 | RAG Documents | ⬜ Sin carga | `services/ragEngine.js` | `GAPS G-13` |
| 22 | Bidireccionalidad Twenty | ⬜ Pendiente | `index.js` (webhook receptor) | `GAPS G-05` |
| 23 | HTTPS/Certs | ⬜ Pendiente | `nginx.conf:443` | `GAPS G-20` |
| 24 | Roles PG | ⬜ Script listo | `scripts/setup-pg-roles.js` | `GAPS G-21` |
| 25 | Multi-tenant RLS | ⬜ Pendiente | `campaigns-schema.sql`, `tenantContext.js` | `GAPS G-25..G-26` |
| 26 | CI/CD Pipeline | ⬜ No iniciado | `.github/workflows/` | `GAPS G-33` |
| 27 | Frappe ERP | ⬜ No iniciado | `docker-compose.yml`, `nginx.conf` | `GAPS G-29..G-30` |
| 28 | Metabase BI | ⬜ Pendiente | `docker-compose.yml` | `GAPS G-28` |
| 29 | Unified Search | ⬜ Pendiente | `hub/portal/`, `index.js` | `GAPS G-31` |
| 30 | Load Test | ⬜ Pendiente | `scripts/load/k6-conversations.js` | `GAPS G-51` |

---

## 17. Mapa de Comunicación entre Módulos

```
Usuario/Cliente
    │
    ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Twilio  │────▶│  Helper  │◀────│   n8n    │
└──────────┘     │  Node    │     └──────────┘
    │            │  :3100   │         │
    ▼            └────┬─────┘         ▼
┌──────────┐          │         ┌──────────┐
│ Chatwoot │◀─────────┤────────▶│  Dify    │
└──────────┘          │         │  :5001   │
    │                 │         └──────────┘
    ▼                 │             │
┌──────────┐          │         ┌──────────┐
│  Twenty  │◀─────────┤────────▶│OpenRouter│
│  CRM     │          │         └──────────┘
└──────────┘          │
    │                 │
    ▼                 ▼
┌──────────┐     ┌──────────┐
│PostgreSQL│     │  Redis   │
└──────────┘     └──────────┘
    │
    ▼
┌──────────┐
│ Weaviate │
└──────────┘
```

**Flujo de datos:**
1. **Inbound:** Twilio → Helper (webhook) → n8n (webhook) → Dify (workflow) → Twenty (sync) → Chatwoot (push)
2. **Broadcast:** Helper (campaign) → n8n (schedule) → Helper (twilio send) → Twilio → Lead
3. **Scoring:** Helper (evaluate) → Store (JSON/PG) → Twenty (sync)
4. **Autenticación:** Usuario → Nginx → Authelia (verify) → Módulo destino
5. **Portal:** Usuario → Nginx → Portal shell → iframe → Módulo destino

---

## 18. Tests Existentes por Funcionalidad

| Suite | Archivo | Tests | Funcionalidades cubiertas |
|-------|---------|-------|--------------------------|
| Security | `__tests__/security.test.js` | 10 | Auth, rate limit, sanitizer, HMAC |
| Conversation | `__tests__/conversation.test.js` | 9 | State machine, transiciones |
| Lead Profile | `__tests__/leadProfile.test.js` | 8 | Profile builder, tags, next action |
| Agent Config | `__tests__/agentConfig.test.js` | 6 | Config, business types, personalities |
| RAG Engine | `__tests__/ragEngine.test.js` | 10 | Document add/query, fallback |
| AntiHallucination | `__tests__/antiHallucination.test.js` | 5 | Knowledge boundaries |
| Rate Limiter | `__tests__/rateLimiter.test.js` | 4 | Rate limit counts |
| Integration | `__tests__/integration.test.js` | 60 | E2E: health, campaigns, scoring, sync |
| **Total** | **8 suites** | **112 tests** | **100% passing** |

---

## 19. Acceso Rápido a Archivos por Función

```
helper-node/
├── index.js                 → TODOS los endpoints (2500 líneas)
├── middleware/
│   ├── auth.js              → API Key + HMAC Meta/Chatwoot
│   ├── rateLimiter.js       → Rate limiting 30/5 req/min
│   └── sanitizer.js         → 23 patrones anti-inyección
├── services/
│   ├── store.js             → Store facade (dual mode)
│   ├── pgStore.js           → PostgreSQL store
│   ├── piiFilter.js         → PII redaction
│   ├── auditLogger.js       → 12 event types
│   ├── conversationStore.js → State machine 9 estados
│   ├── leadProfile.js       → Perfil de lead
│   ├── agentConfig.js       → Config de agente
│   ├── ragEngine.js         → RAG Weaviate + in-memory
│   ├── antiHallucination.js → Anti-alucinación
│   ├── templateEngine.js    → Plantillas por rubro
│   └── agentCore/
│       ├── index.js         → Graph factory
│       ├── graph.js         → Clase Graph
│       ├── testGraph.js     → Test 2 nodos
│       └── nodes/
│           ├── entryNode.js       → Entry + OpenRouter
│           ├── discoveryNode.js   → Discovery
│           ├── qualificationNode.js → Qualification
│           ├── proposalNode.js    → Proposal
│           ├── closingNode.js     → Closing
│           ├── handoffNode.js     → Handoff
│           └── followupNode.js    → Followup
├── templates/
│   ├── template-default.json           → Default
│   ├── template-consultora-software.json → Consultora
│   └── template-salon-eventos.json     → Salón eventos
├── public/
│   └── index.html           → Dashboard SPA
├── __tests__/
│   ├── security.test.js     → 10 tests
│   ├── conversation.test.js → 9 tests
│   ├── leadProfile.test.js  → 8 tests
│   ├── agentConfig.test.js  → 6 tests
│   ├── ragEngine.test.js    → 10 tests
│   ├── antiHallucination.test.js → 5 tests
│   ├── rateLimiter.test.js  → 4 tests
│   └── integration.test.js  → 60 tests
└── Dockerfile               → Build del contenedor

scripts/
├── campaigns-schema.sql           → Schema tablas
├── audit-logs-schema.sql          → Tabla audit_logs
├── init-db.sql                    → Creación BDs
├── backup.sh                      → Backup script
├── twenty-spiced-meddic-fields.js → Campos CRM
├── db/
│   ├── migrate-json-to-pg.js      → Migración datos
│   └── orphan-check.sql           → Detectar huérfanos
├── verify/
│   ├── verify-fase.sh             → Verificación oleadas
│   ├── contract-tests.js          → Tests contratos
│   └── cli-validation.ps1         → Validación CLI
└── monitor/
    ├── dashboard-system.ps1       → Dashboard sistema
    ├── dashboard-flows.ps1        → Dashboard flujos
    ├── dashboard-data.ps1         → Dashboard datos
    └── dashboard-api.ps1          → Dashboard API

hub/
├── index.html              → Hub central
└── portal/
    └── index.html           → Portal shell

docs/
├── SEGUIMIENTO-HUMANO.md   ← Este archivo
├── PRUEBAS-COMPLETAS.md    → 174 tests documentados
├── PRUEBAS-VALIDACION-CLI.md → Validación por CLI
├── GAPS-MINIFASES.md       → 37 gaps detallados
├── ANALISIS-CRITICO-FINAL.md → Estado vs objetivos
├── DISENO-NAVEGACION-UNIFICADA.md → Portal navegación
├── CIERRE-SESION-OBJECTIVOS.md → Informe sesión
├── CHECKLIST-SSO.md        → SSO verification
├── TAREAS-FUNCIONALES.md   → Functional tasks
├── TAREAS-INTERFAZ.md      → Interface tasks
├── tecnicA/
│   ├── TEC-02-FUNCIONES-IMPLEMENTACION.md → Funciones
│   ├── TEC-03-OBJETIVOS-TECNICOS-FASES.md → Objetivos
│   └── TEC-06-FASES-IMPLEMENTACION.md    → 56 fases
├── contextual/
│   ├── CTX-01-INFRAESTRUCTURA.md → Infraestructura
│   ├── CTX-04-LOGICA-VENDEDOR.md → Lógica comercial
│   └── CTX-05-ABSTRACCION-AGENTE.md → Plantillas
├── context/
│   ├── HELPER-NODE.md     → Helper context
│   ├── CAMPAIGNS.md       → Campaigns context
│   └── TWENTY-CRM.md      → Twenty context
├── rag/
│   ├── ENDPOINTS.md       → Endpoints reference
│   ├── DATA-FLOW.md       → Data flows
│   └── CREDENTIALS-REFERENCE.md → Credenciales
└── maestro/
    └── MAESTRO-FUNCIONALIDADES-CORE.md → RAG funcionalidades

Organizar_Estructurar/
├── template-consultora-software.json  → Template original
└── client-config-acme-dev-studio.json → Config cliente

n8n/workflows/
├── 01-inbound-message.json       → Workflow inbound
└── 02-campaign-broadcast.json    → Workflow broadcast

dify/workflows/
├── whatsapp-lead-classifier.yml  → Workflow Dify
└── campaign-content-generator.yml → Workflow contenido
```
