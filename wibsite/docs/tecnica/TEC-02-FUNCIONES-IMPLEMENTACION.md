# TEC-02 — Funciones e Implementación (Estado Real por Grupo Funcional)

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Técnica (CÓMO/ESTADO)
> **Fuentes:** `helper-node/index.js` (2138 líneas, v2.2.0), `helper-node/public/index.html`, `n8n/workflows/*.json`, `dify/workflows/*.yml`, `Avances/LOGROS.md`, `docs/TAREAS-FUNCIONALES.md`, `docs/MEMORY.md` (ADRs).
> **Numeración:** los grupos G1-G18 son los mismos del [archivo maestro RAG](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md) — aquí se detalla la implementación; allí se indexa para búsqueda rápida.

---

## G1 — Infraestructura base
Ver [TEC-01](TEC-01-ARQUITECTURA-INFRAESTRUCTURA.md) (inventario completo). Estado: ✅ con deuda en almacenamiento (JSON primario).

## G2 — Helper Node: núcleo de integración (`helper-node/index.js`)

**Patrón de almacenamiento actual:** doble modo declarado (PG pool + JSON), en la práctica **todo JSON store** con `updateStore()` atómico (lock de promesas) y caché 200ms. Redis activo para conversation store.

**Middleware activo (v2.2.0):** `authMiddleware` (X-API-Key), `rateLimiter` (30/60 req-min), `sanitizerMiddleware` (23 patrones, severidades low→critical), HMAC Meta/Chatwoot en `/webhooks/*`, SLI interno (contadores request/error/latency).

**Servicios internos (`helper-node/services/`):**
| Módulo | Funciones exportadas clave | Estado |
|---|---|---|
| `leadProfile` | `buildLeadProfile` (consolida store + Twenty + Redis + Chatwoot) | ✅ |
| `agentConfig` | `getAgentConfig`, `updateAgentConfig`, `buildSystemPrompt`, `BUSINESS_TYPES` (10), `PERSONALITY_TYPES` (5) | ✅ |
| `ragEngine` | `addDocument`, `queryKnowledgeBase`, `deleteDocument`, `listDocuments`, `checkWeaviateHealth`, fallback in-memory | ✅ |
| `conversationStore` | `initRedis`, `create/getConversationState`, `transitionState`, `isValidTransition`, `VALID_TRANSITIONS`, `CONVERSATION_STATES` (9), `STATE_LABELS` | ✅ |

**Tests:** 112 tests en 8 suites (security, conversation, leadProfile, agentConfig, ragEngine, antiHallucination, rateLimiter, integration) — 100% passing.

## G3 — Campañas multi-canal

| Función | Implementación | Estado |
|---|---|---|
| CRUD campañas | `POST/GET /api/campaigns`, `GET/PATCH/DELETE /api/campaigns/:id`; 409 duplicados (ADR-017) | ✅ |
| Ciclo de vida | `POST .../schedule|start|pause|complete`; estados draft→scheduled→sending→active⇄paused→completed/cancelled/failed | ✅ (activación automática de programadas vía n8n pendiente) |
| Pendientes para broadcast | `GET /api/campaigns/pending` (consumido por n8n workflow 02) | ✅ |
| Leads de campaña | `POST/GET /api/campaigns/:id/leads`; upload Excel/CSV (multer+xlsx, autodetección columnas, dedup por teléfono, custom_fields) | ✅ (probado >1000 filas 0.13s) |
| Tracking | `POST /api/campaigns/track` (upsert delivery, recalcula contadores, +10 score si replied) | ✅ |
| Stats | `GET /api/campaigns/:id/stats` | ✅ |
| Legacy v1 (compat n8n) | `/campaigns*` sin prefijo `/api` (ADR-009) | ✅ |
| Plantillas | `GET/POST /api/templates`, `DELETE /:id`, `POST /preview` con `{{variables}}` y validación max_length; 11 DEFAULT_TEMPLATES en 5 canales | ✅ |
| Opt-out | `POST /api/opt-outs` (marca leads opted_out), `GET /api/opt-outs/check` (público); detección "STOP" en webhook | 🟡 falta bloqueo automático de envíos y reporte por campaña |

## G4 — Leads y scoring

| Función | Implementación | Estado |
|---|---|---|
| Scoring rule-based | `evaluateLead(lead, config, store)`: 8 reglas (replied +20, opened +10, clicked +15, phone+email +10, ≥2 custom +5, recency ≤7d +15 / 8-30d +8, opt-out −100) + 5 factores (engagement 35%, recency 25%, channel_affinity 15%, completeness 15%, interest 10%); umbrales hot≥70/warm≥40 | ✅ |
| Config de reglas | `GET/PUT /api/scoring/rules` (DEFAULT_SCORING_RULES) | ✅ |
| Evaluación | `POST /api/scoring/evaluate` (1 lead), `POST /evaluate-all` (conteos hot/warm/cold) | ✅ |
| Scoring LLM | `POST /api/scoring/evaluate-llm` → OpenRouter, JSON `{score, reason, category}` | 🟡 falta comparación de precisión vs reglas y cache |
| Historial/registro | `POST /api/leads/score`, `GET /api/leads/:id/scores`, `GET /api/leads/top` | ✅ |
| Perfil unificado | `GET /api/leads/:id/profile` → `buildLeadProfile` (MVP-03) | ✅ |
| Trigger desde Chatwoot | `POST /api/scoring/trigger-from-chatwoot` (boost +15 reply agente) | ✅ |

## G5 — IA y agentes (Dify)

| Función | Implementación | Estado |
|---|---|---|
| Lead classifier | `dify/workflows/whatsapp-lead-classifier.yml`: 8 nodos (detect_language → classify_intent 9 categorías → extract_contact_data 10 campos → score 0-100 → generate_response → assemble_result). Output unificado `final_result`/`response_text` (ADR-021). Code nodes reemplazados por LLM nodes (ADR-018). Probado: WARM 73, HOT 88 | ✅ |
| Content generator | `campaign-content-generator.yml`: personalize_message (máx 300 chars) → select_template → assemble_output | ✅ |
| Provider LLM | OpenRouter vía plugin `openai_api_compatible:0.0.55`; 7 modelos (default gpt-4o-mini) | ✅ |
| Auth Dify | Console API cookie+CSRF (ADR-006); Public API key `app-…` | ✅ |
| Topología multi-agente (Router/Extractor/Scoring/Conversacional, 6 agentes especializados) | Diseño CTX-04 §11 / ROAD 5.2 | 🔴 |
| Grafo comercial 8 etapas + plantillas por rubro | Diseño CTX-04/CTX-05 (JSON listo) | 🔴 |
| Anti-alucinación | Módulo helper (validación post-respuesta) | ✅ básico; verificación contra KB pendiente (ROAD 7.2) |

## G6 — Automatización (n8n)

| Workflow | Archivo | Qué hace | Estado |
|---|---|---|---|
| 01 Inbound | `n8n/workflows/01-inbound-message.json` | webhook `chatwoot-inbound` → filtro incoming/text → payload Dify → `/v1/workflows/run` → parse `final_result` → ¿needs_human? → reply Chatwoot + nota IA / escalado → upsert Twenty | 🟡 activado vía SQL (ADR-019); sin credenciales reales |
| 02 Broadcast | `n8n/workflows/02-campaign-broadcast.json` | schedule 1min / webhook `campaign-trigger` → `/campaigns/pending` → audiencia Twenty → Dify content → Meta API template → track | 🔴 inactivo |
| 03 Score & Sync | en BD | Helper score & sync | 🟡 en BD |
| Nurturing | ROAD 5.1 (diseño) | schedule 6h + reglas JSON | 🔴 |
| Onboarding de cliente | CTX-01 §5.3 (diseño) | "un botón, nuevo cliente" | 🔴 |

**Bug conocido (ADR-019):** body parser de n8n 2.23.4 rompe `POST /rest/workflows` y `/rest/credentials` → usar UI + SQL directo; versión pineada; login con `emailOrLdapLoginId`.

## G7 — CRM (Twenty)

| Función | Implementación | Estado |
|---|---|---|
| Health | `GET /api/twenty/health` | ✅ |
| Sync individual | `POST /api/twenty/sync`: upsert Person por teléfono/email (paginación), mapea painPoints/interests/leadOrigin/leadScoreHistory/leadLastScore/leadCustomData, guarda `contact_id`; bug `existing`→`existingPerson` corregido (ADR-017) | ✅ |
| Sync masivo | `POST /api/twenty/sync-all` (12/12 leads) | ✅ |
| Campos custom | 10 en `people` vía `POST /rest/metadata/fields`; prefijo `lead` por namespace global (ADR-012) | ✅ |
| Bidireccionalidad (webhook Twenty→helper, sync oportunidades) | — | 🔴 |
| Campos metodológicos SPICED/MEDDIC + pipelines por tipo de cliente | Diseño CTX-03 §3-4 | 🔴 |

## G8 — Canales y webhooks

| Función | Implementación | Estado |
|---|---|---|
| Webhook Meta | `GET /webhooks/whatsapp` (verify `hub.challenge`), `POST` (statuses→deliveries; mensajes→lead inbound+delivery+forward n8n; "STOP"→opt-out) | ✅ código; 🔴 sin Meta real (token permanente P0-01) |
| Estado de canales (LEDs) | `GET /api/channels`, `PATCH /api/channels/:channel` (5 canales, contador errores, rate-limit info) | ✅ |
| Bridge Chatwoot | `POST /api/chatwoot/normalize`, `POST /api/chatwoot/push` (contacto+conversación vía API pública inbox) | ✅ |
| Bridge Twilio | `POST /webhooks/chatwoot-outbound` → envío WhatsApp Twilio; `POST /api/twilio/send` (proxy, normaliza `whatsapp:`) | ✅ código; sin uso real |
| Ventana 24h / HSM / typing indicator | Diseño CTX-04 §10.2 | 🔴 |

## G9 — Seguridad

Implementado v2.2.0: middleware auth/rate-limit/sanitizer/HMAC (G2), Authelia de borde (🟡 activación), Nginx rate zones + security headers. Pendiente: HTTPS, CORS restrictivo, rotación de keys, RLS, PII filter en logs, segmentación de redes — roadmap SEC F0-F5 en TEC-03 OT-05.

## G10 — Memoria y contexto

State machine 9 estados en Redis (TTL 7d, fallback in-memory, transiciones validadas, catálogo `GET /api/conversations/states`, endpoints CRUD por `:tenantId/:conversationId`). ✅. Eventos WebSocket y cola Bull: 🔴 (ROAD 1.1 completo).

## G11 — RAG / Knowledge Base

Endpoints `/api/knowledge-base/*` (health, documents CRUD, query) sobre Weaviate con fallback in-memory; chunking; multi-tenant por header. ✅ básico. Pendiente: sync externa de productos/precios, procesamiento de archivos (PDF/Excel) como documentos (ROAD 1.3 completo).

## G12 — Configuración de agente

`GET/PUT /api/agent/config`, `GET /api/agent/config/system-prompt`, `GET /api/agent/business-types`, `GET /api/agent/personalities` — multi-tenant por `x-tenant-id`. ✅ v1. Evolución a esquema de plantilla completo (CTX-05 §3): 🔴 OT-08.

## G13 — UX / Dashboard / Portal

- Dashboard SPA `helper-node/public/index.html` (718 líneas): 5 tabs (Dashboard KPIs+LEDs, Campañas+import drag&drop, Leads con scores, Plantillas CRUD+preview, Canales), 6 acciones globales (Sync CRM, Score All, Seed, Clear, Test LLM, Refresh), auto-refresh 15s. ✅
- Hub `hub/index.html`: portal visual de módulos y documentación. ✅
- Portal Shell unificado (iframes+postMessage, búsqueda global, lead context panel): 🔴 diseño UI-UX-MASTER (UX-1..UX-4).

## G14 — Observabilidad

Implementado: `/health` enriquecido (uptime, módulos, SLI, dependencias db/llm/weaviate/redis), `/api/sli/metrics`, `GET /api/dashboard/summary`. ✅ básico. Pendiente: Prometheus+cAdvisor+Grafana, GlitchTip, alertas P0/P1 (OT-03).

## G15 — Lógica de vendedor (diseño completo, implementación pendiente)

Documentación: CTX-04. Artefactos listos: `template-consultora-software.json` (9 fields, 8 objections, temperatura 11 señales, followup 8 intentos, handoff 12 campos), `client-config-acme-dev-studio.json`. Implementación en núcleo: 🔴 OT-08. Piezas ya existentes a reutilizar: state machine (G10), scoring rule-based (G4), opt-out (G3), lead profile (G4).

## G16 — Plantillas de negocio

Esquema definido (CTX-05 §3) + 1 plantilla poblada + 1 client-config de ejemplo. Pendiente: motor que combine plantilla+cliente en runtime, segundo rubro (salón de eventos), editor visual completo (ROAD 4.1).

## G17 — ERP / Copilot (fases futuras)

Frappe/ERPNext: 🔴 F2 (setup, modelo órdenes/facturas, sync Twenty→Frappe, verificación factura automática). Lumi Sales Copilot: 🔴 F3 (hereda base técnica del proyecto hermano `lumi/` — backend hexagonal con RAG pgvector, multi-proveedor IA con failover, campañas, frontend React).

## G18 — Multi-tenant / SaaS Ops

Diseñado: jerarquía 4 niveles, DDL platform_tenants/branches/users, RLS, planes en DDL (OPS §2), migración JSON→PG 3 fases (DATA §10). Implementado: aislamiento lógico por header `x-tenant-id` en agent config y conversation store (nivel aplicación, tenant "default"). 🔴 pendiente migración real (OT-02).

---

## Resumen de cobertura

| Estado | Grupos |
|---|---|
| ✅ Completo/básico funcional | G1, G2, G3 (mayoría), G4, G5 (classifier), G7 (sync), G10, G11, G12 (v1), G13 (actual), G14 (básico) |
| 🟡 Parcial/activación | G6 (credenciales), G8 (Meta), G9 (hardening) |
| 🔴 Diseñado, falta implementar | G15, G16 (motor), G17, G18, topología multi-agente (G5), grafo comercial |

---

## Referencias cruzadas
- → [TEC-01 Infraestructura](TEC-01-ARQUITECTURA-INFRAESTRUCTURA.md) | [TEC-03 Objetivos](TEC-03-OBJETIVOS-TECNICOS-FASES.md)
- → [CTX-04](../contextual/CTX-04-LOGICA-VENDEDOR.md) y [CTX-05](../contextual/CTX-05-ABSTRACCION-AGENTE-PLANTILLAS-NEGOCIOS.md) (qué falta implementar de G15/G16)
- → `docs/MANUAL-TECNICO.md` (comandos de prueba por módulo), `docs/TAREAS-FUNCIONALES.md` (checklist granular)
