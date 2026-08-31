# Archivo Maestro — Funcionalidades Core de la Plataforma (Mapa RAG)

> **Versión:** 1.1 | **Fecha:** Agosto 2026 | **Tipo:** Índice maestro de seguimiento técnico rápido
> **Uso:** cada funcionalidad core tiene un **ID RAG-GX-YY**, su **path**, las **funciones/endpoints** que la componen, **cómo se abarca la solución**, su **estado** y sus **referencias**. Buscar por ID o por grupo. Detalle de implementación en [TEC-02](../tecnica/TEC-02-FUNCIONES-IMPLEMENTACION.md); contexto en CTX-0X.
> **Leyenda de estado:** ✅ implementado · 🟡 parcial/activación · 🔴 diseñado/no iniciado

---

## Índice de grupos técnicos

| Grupo | Dominio | Entradas | Contexto | Técnica |
|---|---|---|---|---|
| G1 | Infraestructura base | 5 | CTX-01 | TEC-01 |
| G2 | Helper Node — núcleo | 4 | CTX-02 M2 | TEC-02 §G2 |
| G3 | Campañas multi-canal | 5 | CTX-02 | TEC-02 §G3 |
| G4 | Leads y scoring | 4 | CTX-04 §6 | TEC-02 §G4 |
| G5 | IA y agentes (Dify) | 4 | CTX-04 §11 | TEC-02 §G5 |
| G6 | Automatización (n8n) | 4 | CTX-02 M5 | TEC-02 §G6 |
| G7 | CRM (Twenty) — **cancelado ADR-010** | 0 | ADR-010 | TEC-02 §G7 (histórico) |
| G8 | Canales y webhooks | 4 | CTX-04 §10 | TEC-02 §G8 |
| G9 | Seguridad | 4 | CTX-01 §5.3 | TEC-02 §G9 |
| G10 | Memoria y contexto | 2 | CTX-07 §3 | TEC-02 §G10 |
| G11 | RAG / Knowledge Base | 2 | CTX-02 M7 | TEC-02 §G11 |
| G12 | Configuración de agente | 2 | CTX-05 §5 | TEC-02 §G12 |
| G13 | UX / Dashboard / Portal | 3 | CTX-02 M1 | TEC-02 §G13 |
| G14 | Observabilidad | 3 | CTX-01 §6 | TEC-02 §G14 |
| G15 | Lógica de vendedor | 6 | CTX-04 | TEC-02 §G15 |
| G16 | Plantillas de negocio | 3 | CTX-05 | TEC-02 §G16 |
| G17 | ERP y Copilot (futuro) | 2 | CTX-03 §5 | TEC-02 §G17 |
| G18 | Multi-tenant / SaaS Ops | 3 | CTX-06 §8 | TEC-02 §G18 |

---

## G1 — Infraestructura base

| ID | Funcionalidad | Path | Funciones/Componentes | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G1-01 | Reverse proxy + Frontend unificado | `nginx.conf`, `frontend/` | 2 servers (:8080, :3003), rate zones api/llm/webhooks, security headers, resolver DNS runtime | Nginx como única puerta; el frontend Next.js (vista unificada) es el centro de control; hub estático eliminado | ✅ | ADR-014, TEC-01 §2 |
| RAG-G1-02 | Orquestación de contenedores | `docker-compose.yml` | 20 servicios, healthchecks, volúmenes, red `wibsite_default` | Compose hoy; Swarm/K8s según umbrales (5-10/10-100/100+ tenants) | ✅ | CTX-01 §4, OPS §3 |
| RAG-G1-03 | Persistencia relacional | `scripts/init-db.sql`, `scripts/campaigns-schema.sql` | 5 BD (chatwoot, dify, n8n, twenty, wibsite), 6 tablas campañas con FK/índices/triggers, pgvector | PG compartido; schema campañas creado pero no cableado al helper (deuda D1) | ⚠️ | TEC-01 §3, TEC-04 D1 |
| RAG-G1-04 | Schema multi-tenant Lumi | `lumi/backend/src/config/migrations/` (referencia), diseño en DATA-MASTER §2 | 16-19 tablas UUID, FKs CASCADE, CHECKs, UNIQUE compuestos, RLS 10-12 tablas | Modelo Pool (compartido + `organization_id` + RLS); migración 3 fases | 🔴 | CTX-06 §8, OT-02 |
| RAG-G1-05 | Cache y colas | Redis 7 (compose) | Colas Chatwoot/Dify/Twenty, sesiones Authelia, conversation store helper | Redis ya desplegado; falta uso como cache real de lecturas | 🟡 | CTX-01 §3 |

## G2 — Helper Node (núcleo de integración)

| ID | Funcionalidad | Path | Funciones/Componentes | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G2-01 | API de integración | `helper-node/index.js` (2138 líneas, v2.2.0) | Express 5, ~60 endpoints `/api/*` + legacy v1, `updateStore()` atómico con lock, caché 200ms | Servicio central que conecta campañas, leads, scoring, CRM, webhooks, LLM, RAG | ✅ | ADR-009/017, TEC-02 §G2 |
| RAG-G2-02 | Middleware de seguridad | `helper-node/middleware/` | `authMiddleware` (X-API-Key), `rateLimiter` 30/60 rpm, `sanitizerMiddleware` (23 patrones inyección), HMAC Meta/Chatwoot | Defensa en capa de aplicación complementaria al borde (Authelia/Nginx) | ✅ | ROAD 0.1, SEC C-01/C-03/C-04 |
| RAG-G2-03 | Servicios internos | `helper-node/services/` | `leadProfile`, `agentConfig`, `ragEngine`, `conversationStore` (ver G10-G12) | Lógica desacoplada en módulos importados por index.js | ✅ | LOGROS v2.2.0 |
| RAG-G2-04 | Suite de tests | `helper-node` (tests) | 176 tests, 22 suites (unitarias + agente + integración + multicanal + comportamiento) | Gate de regresión en cada iteración | ✅ | TEC-04 §3 |

## G3 — Campañas multi-canal

| ID | Funcionalidad | Path | Funciones/Endpoints | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G3-01 | CRUD y ciclo de vida | `helper-node/index.js` | `POST/GET/PATCH/DELETE /api/campaigns[/:id]`, `POST .../schedule\|start\|pause\|complete`, 409 duplicados, `GET /pending` | Estados draft→scheduled→sending→active⇄paused→completed/cancelled/failed; legacy v1 para n8n | ✅ | ADR-009/017 |
| RAG-G3-02 | Gestión de leads de campaña | `helper-node/index.js` | `POST/GET /api/campaigns/:id/leads`, `POST .../leads/upload` (multer+xlsx, autodetección, dedup, custom_fields) | Carga masiva Excel/CSV sin SQL; probado >1000 filas 0.13s | ✅ | ADR-010 |
| RAG-G3-03 | Tracking de entregas | `helper-node/index.js` | `POST /api/campaigns/track` (upsert delivery, recalcula contadores, +10 score si replied), `GET /:id/stats` | Estados sent/delivered/read/replied/failed | ✅ | TEC-02 §G3 |
| RAG-G3-04 | Plantillas de mensaje | `helper-node/index.js` | `GET/POST/DELETE /api/templates[/:id]`, `POST /preview` (variables `{{name}}`, validación max_length), 11 defaults × 5 canales | Plantillas multi-canal reutilizables; candidatas a banco de objeciones/reactivación (CTX-04) | ✅ | ADR-011 |
| RAG-G3-05 | Opt-out | `helper-node/index.js` | `POST /api/opt-outs`, `GET /api/opt-outs/check` (público), detección "STOP" en webhook Meta | Cumplimiento anti-spam (Meta ToS); falta bloqueo automático de envíos | 🟡 | CTX-04 §10.2, TAREAS §8 |

## G4 — Leads y scoring

| ID | Funcionalidad | Path | Funciones/Endpoints | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G4-01 | Motor de scoring rule-based | `helper-node/index.js` → `evaluateLead()` | 8 reglas (replied+20, opened+10, clicked+15, datos+10/+5, recency+15/+8, opt-out−100) + 5 factores ponderados; umbrales hot≥70/warm≥40 | Scoring funcional sin LLM; reemplazable/complementable por IA y por temperatura conversacional (G15-04) | ✅ | ADR-013 |
| RAG-G4-02 | Configuración de reglas | `helper-node/index.js` | `GET/PUT /api/scoring/rules`, `DEFAULT_SCORING_RULES` | Umbrales y pesos configurables vía API | ✅ | MANUAL-TECNICO §9 |
| RAG-G4-03 | Scoring con LLM | `helper-node/index.js` | `POST /api/scoring/evaluate-llm` → OpenRouter → `{score, reason, category}` | Scoring cualitativo con razonamiento; falta comparación de precisión y cache | 🟡 | ADR-015 |
| RAG-G4-04 | Perfil unificado de lead | `helper-node/services/leadProfile.js` | `buildLeadProfile`; `GET /api/leads/:id/profile` (+`?summary=true` diseñado) | Consolida store+Twenty+Redis+Chatwoot en una ficha | ✅ básico | ROAD 1.2, MVP-03 |

## G5 — IA y agentes (Dify)

| ID | Funcionalidad | Path | Funciones/Nodos | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G5-01 | Workflow lead classifier | `dify/workflows/whatsapp-lead-classifier.yml` | 8 nodos: detect_language → classify_intent (9 categorías) → extract_contact_data (10 campos) → calculate_score → generate_response → assemble_result; output unificado `final_result` | Back-office de análisis: intención, score 0-100, datos capturados, respuesta sugerida, needs_human | ✅ | ADR-018/021 |
| RAG-G5-02 | Workflow content generator | `dify/workflows/campaign-content-generator.yml` | personalize_message → select_template → assemble_output | Personalización de campañas por destinatario (≤300 chars) | ✅ | TEC-02 §G5 |
| RAG-G5-03 | Topología multi-agente | Diseño: CTX-04 §11, ROAD 5.2 | Front-office conversacional + Back-office (Router/Extractor/Scoring) → 6 agentes (Qualifier/Sales/Support/Nurturing/Post-Sale/Voice) | Separación diálogo/análisis para respuestas breves y CRM estructurado | 🔴 | CTX-04 §11, OT-10 |
| RAG-G5-04 | Proveedor LLM | Dify plugin `openai_api_compatible:0.0.55` + helper axios | OpenRouter, 7 modelos, default `openai/gpt-4o-mini` (~$0.000004/llamada) | Provider universal; xAI deprecado | ✅ | ADR-004/015 |

## G6 — Automatización (n8n)

| ID | Funcionalidad | Path | Nodos clave | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G6-01 | Workflow inbound | `n8n/workflows/01-inbound-message.json` | webhook chatwoot-inbound → filtro → Build Dify Payload → workflows/run → Parse → needs_human? → reply Chatwoot/escalado → upsert Twenty | Flujo de atención automática con escalado a humano | 🟡 activo, sin credenciales reales | ADR-019, OT-01 |
| RAG-G6-02 | Workflow broadcast | `n8n/workflows/02-campaign-broadcast.json` | schedule 1min/webhook → campaigns/pending → audiencia Twenty → Dify content → Meta API → track | Envío programado de campañas | 🔴 inactivo | OT-01 |
| RAG-G6-03 | Nurturing automático | Diseño: ROAD 5.1 | schedule 6h + reglas JSON (`nurturing-rules.js`) | Ejecutor de la cadencia de seguimiento (G15-05) | 🔴 | CTX-04 §4 |
| RAG-G6-04 | Onboarding de clientes | Diseño: CTX-01 §5.3 | workflow "un botón, nuevo cliente" (org + workspace Dify + inbox Chatwoot + plantillas) | Automatización del alta SaaS | 🔴 | CTX01 §5.3 |

## G7 — CRM (Twenty) — **FUERA DE ALCANCE (ADR-010, 31/08)**

> **Decisión técnica (31/08):** Twenty CRM ya NO se usa en este proyecto. La frontera única es el frontend unificado (`wibsite/frontend/`), y los contenedores restantes operan únicamente como motores de backend. El perfil de lead propio del helper (`leadProfile.js`) es la fuente de verdad del CRM interno. `contact_id` en leads queda como referencia genérica de CRM. Verificado: Twenty ausente de `docker-compose.yml` (18 servicios), sin rutas `/api/twenty/*` en `index.js` (404 en runtime con API key válida). Issue V2 cerrado; issues pospuestos K2/K3 no dependen más de Twenty.

| ID | Funcionalidad | Path | Funciones/Endpoints | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G7-01 | Sync helper→Twenty | `helper-node/index.js` | `POST /api/twenty/sync` (upsert por phone/email, paginación), `POST /sync-all`, `GET /health` | Person con datos + campos custom; `contact_id` guardado | ❌ **Cancelado (ADR-010)** — rutas nunca existieron en el estado actual; no se implementarán | ADR-010 |
| RAG-G7-02 | Campos custom | Twenty metadata API | 10 campos en `people` (painPoints, interests, leadSource… + prefijo `lead` por namespace global) | Persistencia de señales de calificación | ❌ **Cancelado (ADR-010)** — el perfil de lead en `leadProfile.js` + `custom_fields` es la fuente de verdad | ADR-010 |
| RAG-G7-03 | Bidireccionalidad y eventos | — | Webhook Twenty→helper; sync por evento (`temperature_change`, `handoff`); `Modo_Conversación` | CRM como registro vivo (línea de tiempo única) | ❌ **Cancelado (ADR-010)** — timeline unificada nativa en `leadProfile.buildTimeline` (K7) | ADR-010 |
| RAG-G7-04 | Modelo metodológico | — | Campos SPICED/MEDDIC/`lead_fit_score`/`qualification_stage`; 3 pipelines por `ContactType` | El CRM ordena y califica según metodología de venta | 🟡 Sustituido por el pipeline F1 propio (6+2 etapas, `leadStages.js`) + score del helper | ADR-010, CTX-03 |

## G8 — Canales y webhooks

| ID | Funcionalidad | Path | Funciones/Endpoints | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G8-01 | WhatsApp vía Meta | `helper-node/index.js` | `GET/POST /webhooks/whatsapp` (verify token, statuses→deliveries, mensajes→lead+forward n8n, STOP→opt-out) | Canal principal; HSM obligatorio >24h (ventana Meta), typing indicator pendiente | 🟡 código listo, sin credenciales | CTX-04 §10.2, OT-01 |
| RAG-G8-02 | Estado de canales (LEDs) | `helper-node/index.js` | `GET /api/channels`, `PATCH /:channel` (5 canales, error_count, rate-limit info) | Salud visible por canal en dashboard | ✅ | TEC-02 §G8 |
| RAG-G8-03 | Bridge Chatwoot | `helper-node/index.js` | `POST /api/chatwoot/normalize`, `POST /api/chatwoot/push` | Inbound hacia inbox Chatwoot | ✅ | TEC-02 §G8 |
| RAG-G8-04 | Canal Twilio | `helper-node/index.js` | `POST /webhooks/chatwoot-outbound` → Twilio; `POST /api/twilio/send` (proxy, normaliza `whatsapp:`), status callback + typing (F-24) | Canal real vigente (reemplaza Meta): inbound F-05 + broadcast F-06 verificados | ✅ | TEC-02 §G8, TEC-06 F-03…F-06 |

## G9 — Seguridad

| ID | Funcionalidad | Path | Componentes | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G9-01 | SSO de borde | `authelia/` + `nginx.conf` | Authelia 4.37 (argon2id, sesión 8h Redis), `auth_request`, rutas públicas explícitas | Un solo login para todos los módulos | 🟡 implementado, activación pendiente | ADR-016, CTX01-O1 |
| RAG-G9-02 | Sanitización anti-inyección | `helper-node/middleware/` | 23 patrones, severidades low→critical, acciones redactar/bloquear/loguear | Defensa de prompts antes de Dify | ✅ | ROAD 0.1, SEC §10 |
| RAG-G9-03 | HMAC webhooks | `helper-node/middleware/` | Verificación firma Meta y Chatwoot | Webhooks auténticos, sin payloads falsificados | ✅ | SEC C-03 |
| RAG-G9-04 | Hardening pendiente | — | HTTPS, CORS, rotación keys, RLS, PII filter logs, segmentación redes | Roadmap SEC F0-F5 | 🟡 | OT-05, SECURITY-MASTER |

## G10 — Memoria y contexto

| ID | Funcionalidad | Path | Funciones | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G10-01 | State machine de conversación | `helper-node/services/conversationStore.js` | 9 estados, `VALID_TRANSITIONS`, `transitionState`, TTL 7d, fallback in-memory; endpoints `/api/conversations/*` | Memoria técnica del diálogo; base de la máquina comercial (mapeo CTX-07 §3) | ✅ | MVP-02 |
| RAG-G10-02 | Eventos y cola de conversación | Diseño: ROAD 1.1 | EventEmitter 4 eventos WebSocket, Bull queue | Tiempo real para dashboard vivo | 🔴 | ROAD 1.1 |

## G11 — RAG / Knowledge Base

| ID | Funcionalidad | Path | Funciones | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G11-01 | Motor RAG | `helper-node/services/ragEngine.js` | `addDocument`, `queryKnowledgeBase`, `listDocuments`, `deleteDocument`, health Weaviate, fallback in-memory | KB por tenant con degradación graceful | ✅ básico | MVP-05 |
| RAG-G11-02 | Procesamiento documental completo | Diseño: ROAD 1.3 | chunking 500/50, formatos pdf/csv/txt/xlsx/md/json ≤20MB, sync externa productos/precios | Documentos del negocio consultables por el agente (y lookup determinista de precios, guardrail CTX-04 §10.1) | 🔴 | ROAD 1.3 |

## G12 — Configuración de agente

| ID | Funcionalidad | Path | Funciones/Endpoints | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G12-01 | Agent Config Editor (backend) | `helper-node/services/agentConfig.js` | `BUSINESS_TYPES` (10), `PERSONALITY_TYPES` (5), `buildSystemPrompt`; `GET/PUT /api/agent/config`, `/system-prompt`, `/business-types`, `/personalities` | Switcher de contexto v1: tipo de negocio + personalidad → system prompt dinámico, multi-tenant por header | ✅ | MVP-04, BUS §4 |
| RAG-G12-02 | Motor de plantillas por rubro | Diseño: CTX-05, `Organizar_Estructurar/*.json` | `templateEngine` (loader+merge template/client-config, validación de esquema) | Núcleo lee plantilla genérica; rubros y clientes son JSON | 🔴 | OT-08, CTX05-O3 |

## G13 — UX / Dashboard / Portal

> **Actualización 30/08/2026:** decisión técnica — el frontend se consolidó en **una sola vista unificada Next.js**
> (`frontend/`), reemplazando al hub estático y al Dashboard SPA embebido. Los módulos externos (n8n, Dify, Chatwoot,
> Twenty) se usan como **motores** (solo sus APIs/backends), sin exponer sus interfaces gráficas como frontera.

| ID | Funcionalidad | Path | Componentes | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G13-01 | Frontend unificado Next.js (vista única) | `frontend/src/app/` (15 páginas) | dashboard, chat (inbox), leads, pipeline, campaigns, templates, reports, automation, settings, sidebar+statusbar+theme, ui/ (shadcn) | La UI consolida todos los módulos; llama al helper vía proxy `/api/*` (next.config) | ✅ | TEC-02 §G13, ADR-008 |
| RAG-G13-02 | Frontend de prueba/legacy | `frontend/e2e/` | specs Playwright por vista (capture_all_views, dashboard, pipeline, verify_all_routes) | Validación visual y de rutas del frontend | ✅ | e2e/frontend |
| RAG-G13-03 | (legacy) Hub estático | `hub/index.html`, `hub/portal/index.html`, `hub/control-center.html` | **ELIMINADO** en commit `d17b09c` — sustituido por el frontend Next.js | ❌ removido | ❌ | ADR-008, CTX-02 M1 |

## G14 — Observabilidad

| ID | Funcionalidad | Path | Componentes | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G14-01 | Health + SLI | `helper-node/index.js` | `GET /health` (uptime, módulos, dependencias db/llm/weaviate/redis), `GET /api/sli/metrics`, middleware contadores | SLI/SLO básico integrado al núcleo | ✅ | LOGROS v2.2.0 |
| RAG-G14-02 | Stack de métricas/trazas | `docker-compose.yml`, `otel-collector/config.yaml` | **Elasticsearch 9.4.2 + Kibana + OTel Collector** (reemplazan cAdvisor → Prometheus → Grafana); `prom-client` en helper | Trazas OTLP → ES (índices `*-doags.otel-production`); config completa, runtime pendiente de arranque; ⚠️ password hardcodeada en config | ✅ config | OT-03, TEC-06 F-36 |
| RAG-G14-03 | Captura de errores | `otel-collector/config.yaml` | OTLP logs → Elasticsearch (sustituye GlitchTip/Sentry) + `auditLogger` evento `error` | Errores con contexto en ES | ✅ config | OT-03, TEC-06 F-38 |

## G15 — Lógica de vendedor (capa comercial del agente)

| ID | Funcionalidad | Path | Componentes | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G15-01 | Flujo comercial de 8 etapas | Diseño: CTX-04 §3 | apertura→calificación→propuesta valor→profundización→objeciones→cierre/derivación→handoff→seguimiento | Grafo genérico sobre la state machine (G10-01); contenidos por plantilla | 🔴 | OT-08 paso 2 |
| RAG-G15-02 | Zonas de autonomía | `template-consultora-software.json` → `autonomy_levels`, `fields[].autonomy_zone` | green/yellow/red leídas como config por el nodo de decisión | El punto de flexión es regla, no inferencia del modelo | 🔴 JSON listo | CTX-04 §2 |
| RAG-G15-03 | Banco de objeciones | `template-consultora-software.json` → `objections[]` (8) | trigger_patterns → response_pattern con `{{placeholders}}`, overrides por cliente | El agente elige y adapta de un set curado | 🔴 JSON listo | CTX-04 §5 |
| RAG-G15-04 | Temperatura del lead | `template-consultora-software.json` → `lead_temperature` | 3 dimensiones (fit 30/engagement 40/intent 30), 11 señales con `condition` evaluable, umbrales 70/40, decay −20%/5d | Score calculable desde estado, complementa G4-01 | 🔴 JSON listo | CTX-04 §6 |
| RAG-G15-05 | Cadencia de seguimiento | `template-consultora-software.json` → `followup` | 8 intentos (delays 0/1/3/6/10/20/30/45d), lost_threshold→nurture, reentry score cero; HSM si >24h | Ejecutor: G6-03; regla ventana Meta: G8-01 | 🔴 JSON listo | CTX-04 §7 |
| RAG-G15-06 | Handoff al humano | `template-consultora-software.json` → `handoff` | 12 required_fields + 3 next_action_options; briefing a Twenty/Chatwoot/Slack; triggers A/B/C (score≥70, intención explícita, failsafe) | Paquete único e invariable para el vendedor | 🔴 JSON listo | CTX-04 §7.3/§9 |

## G16 — Plantillas de negocio

| ID | Funcionalidad | Path | Componentes | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G16-01 | Esquema de plantilla por rubro | `Organizar_Estructurar/esquema-config-plantilla.md` | meta/autonomy_levels/fields/objections/lead_temperature/followup/handoff | Contrato estable que lee el núcleo (G12-02) | ✅ definido v1.0.0 | CTX-05 §3 |
| RAG-G16-02 | Config por cliente | `Organizar_Estructurar/client-config-acme-dev-studio.json` | branding, commercial_params (min_ticket, rangos con disclaimer), objection_overrides, followup_overrides, handoff_routing | Cliente nuevo = JSON pequeño, sin tocar plantilla ni código | ✅ ejemplo listo | CTX-05 §7 |
| RAG-G16-03 | Segundo rubro piloto | — | Plantilla salón de eventos (cadencias cortas por fecha fija, fit por paquete cerrado) | Validación del patrón multi-rubro | 🔴 | CTX05-O4 |

## G17 — ERP y Copilot (fases futuras)

| ID | Funcionalidad | Path | Componentes | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G17-01 | ERP Frappe/ERPNext | — (compose futuro) | setup, modelo órdenes/facturas, sync Twenty→Frappe vía n8n | Transacción post-cierre: lead ganado → factura | 🔴 U-F2 (gate OT-01) | CTX-03 §5, OT-07 |
| RAG-G17-02 | Lumi Sales Copilot | `lumi/` (proyecto hermano: backend hexagonal, RAG pgvector, IA multi-proveedor failover, frontend React) | asistente del vendedor: recomendaciones, seguimiento, insights en vivo | Reutilización de base técnica existente | 🔴 U-F3 | CTX-02 M12 |

## G18 — Multi-tenant / SaaS Ops

| ID | Funcionalidad | Path | Componentes | Cómo se abarca | Estado | Refs |
|---|---|---|---|---|---|---|
| RAG-G18-01 | Jerarquía y modelo de tenants | Diseño: OPS §1-2 | PLATFORM→TENANT→BRANCH→USER; DDL `platform_tenants/branches/users` con plan_id y límites | 4 niveles; leads/campañas en branch, config en tenant | 🔴 | CTX-06 §8, OT-09 |
| RAG-G18-02 | Aislamiento por servicio | Diseño: OPS §1.3, SEC §9 | PG schema+RLS, Redis prefijos, Weaviate clase/tenant, workspaces (Dify/Twenty/n8n), cuentas Chatwoot, storage por tenant | Aislamiento nativo de cada módulo | 🟡 helper usa header `x-tenant-id` (app-level) | OT-02 |
| RAG-G18-03 | Planes y facturación | Diseño: BUS §1, OPS §2 | 4 planes (Demo/Blue/ProMax/Enterprise), `subscriptions`/`billing_events` Stripe | Cobro manual en pilotos → Stripe | 🔴 | CTX-06 §1, OT-09 |

---

## 🗺️ Mapa de implementación: Fases → RAG (ejecución agéntica)

> **Propósito:** este cruce conecta cada micro-fase F-XX del plan de implementación ([`TEC-06`](../tecnica/TEC-06-FASES-IMPLEMENTACION.md)) con las entradas RAG que actualiza, las pruebas que la validan, las verificaciones que la cierran y el contexto documental necesario. **Para ejecutar una fase:** leer solo la fila correspondiente + sus referencias directas (CTX/ADR/TEC).

### Oleada A — Acceso y canal real

| Fase | Objetivo (4 palabras) | RAGs que actualiza | Pruebas clave | Verif. funcionamiento | Gate |
|---|---|---|---|---|---|
| F-01 | Authelia SSO activo | G9-01 | 5 flujos CHECKLIST-SSO | Un login para todos | Prod: sesión 8h renueva |
| F-02 | Credenciales n8n + workflows | G6-01, G6-02 | Ejecución manual workflow 01 | Active=true + sin error creds | Prod: webhook n8n 200 |
| F-03 | Meta token + webhook | G8-01 | Verify webhook `hub.challenge` | Meta Dashboard verde | Prod: token sin expiración 60d |
| F-04 | Inbox Chatwoot WhatsApp | G8-03 | WhatsApp real → inbox | Conversación visible <5s | Prod: humano responde y llega |
| F-05 | E2E inbound real | G6-01, G5-01, G7-01, G8-01 | Checklist E2E PRUEBAS-Y-VERIF. | 6 verificaciones; latencia <10s | Prod: 24h estable sin incidencia |
| F-06 | E2E broadcast real | G6-02, G3-01, G3-03 | Campaña 2 leads HSM | sent=2, delivered≥1 | Prod: 50 sin rate limit error |

### Oleada B — Datos multi-tenant

| Fase | Objetivo (4 palabras) | RAGs que actualiza | Pruebas clave | Verif. funcionamiento | Gate |
|---|---|---|---|---|---|
| F-07 | DUMP JSON→PG | G1-03 | Conteos JSON == PG | Script idempotente con backup previo | Prod: ejecutado con store respaldo |
| F-08 | DUAL WRITE PG+JSON | G1-03 | 176 tests + dual-write verificado en vivo | CRUD OK con flag `dual` + rutas conectadas | Prod: 48h sin divergencias |
| F-09 | CUTOVER PG primario | G1-03 | Suite + restart | Endpoints OK tras reinicio; `/health` db OK | Prod: rollback testado en <10 min |
| F-10 | tenant_id + RLS | G18-02 | SQL: tenant A no ve B | Endpoints solo datos del tenant | Prod: 7 días sin violaciones |
| F-11 | Middleware tenantContext | G18-02 | Tests cross-tenant | API 403/404 correctos | Prod: pentest cross-tenant = 0 |
| F-12 | Aislamiento + 0 huérfanos | G1-04, G18-02 | orphan-check 5 queries | orphan-check = 0 filas | Prod: cron diario + alerta |

### Oleada C — Motor agéntico LangChain

| Fase | Objetivo (4 palabras) | RAGs que actualiza | Pruebas clave | Verif. funcionamiento | Gate |
|---|---|---|---|---|---|
| F-13 | Bootstrap agent-core LangChain | G15-01 | POC mini-grafo 2 nodos | Latencia <5s; output correcto | Prod: decisión documentada (go/fallback) |
| F-14 | Checkpointer memoria profunda | G10-01, G10-02 | 5 turnos + restart → contexto intacto | Estado reanudable idéntico | Prod: TTL y limpieza 7d OK |
| F-15 | Template engine + validador | G16-01, G16-02, G12-02 | Carga JSONs + merge + inválido→error | Validación consultora+acme OK | Prod: versionadas en BD/git |
| F-16 | Grafo 8 etapas LangGraph | G15-01 | 5 guiones de prueba | Chat completa ≤8 turnos, p95 <5s | ✅ IMPLEMENTADO — 11 nodos (apertura, analyze, calificacion, propuesta, profundizacion, objeciones, cierre, handoff, seguimiento, kb, cotizacion); tests agentGraph 5/5 alineados a F1 (31/08) |
| F-17 | Guardas confidencialidad+autonomía | G15-02 | 0 datos internal en 20 respuestas | Cotiz final jamás emitida; red deriva | Prod: monitoreo semanal fugas = 0 |
| F-18 | Dify nodo + fallback OpenRouter | G5-01, G5-04 | Dify up/down → ambos modos | Failover <1s; clasificación OK | Prod: failover ejercido sin incidencia |

### Oleada D — Comportamiento comercial

| Fase | Objetivo (4 palabras) | RAGs que actualiza | Pruebas clave | Verif. funcionamiento | Gate |
|---|---|---|---|---|---|
| F-19 | Banco objeciones ejecutable | G15-03 | 8/8 patrones OK + log | "Es muy caro" → reencuadre con nombre | Prod: rate resolución medible |
| F-20 | Motor temperatura + decay | G15-04 | sim hot/warm/cold + decay | Temperatura visible con motivo en perfil | Prod: decay diario sin errores |
| F-21 | Sync máquinas comercial↔técnica | G10-01, G15-01 | Mapeo 100% cubierto | Perfil refleja estado comercial | ✅ Verificado 31/08 — proyección a etapas F1 (primer_contacto…comprador/descartado); commercialState.test 5/5 + agentGraph alineados |
| F-22 | Handoff + briefing automático | G15-06 | trigger score≥70 + "hablar persona" | Briefing en Chatwoot con score+objec.+acción | Prod: humano cierra sin repetir |
| F-23 | Cola seguimiento con cadencia | G15-05 | intento 2 a +1d; respuesta cancela | Cadencia en horario y canal correcto | Prod: 0 envíos fuera de horario 7d |
| F-24 | HSM 24h + typing + opt-out | G8-01, G3-05 | ventana cerrada→HSM; baja→opt-out+stop | 0 rechazos Meta; typing visible | Prod: 0 violaciones política 30d |

### Oleada E — CRM metodológico y ERP

| Fase | Objetivo (4 palabras) | RAGs que actualiza | Pruebas clave | Verif. funcionamiento | Gate |
|---|---|---|---|---|---|
| F-25 | Campos SPICED/MEDDIC Twenty | G7-04 | 9 campos existen + aceptan | Upsert escribe campos metodológicos | Prod: backup metadata exportado |
| F-26 | ContactType + pipelines | G7-04 | 3 rutas + multi-contacto vinculación | Opp creada en pipeline correcto | Prod: 0 leads duplicados 7d |
| F-27 | Bidireccionalidad + Modo_Conversación | G7-03 | update CRM→helper; devolución→reenganche | IA→Humano→IA ciclo completo | Prod: sync por evento sin duplicados 7d |
| F-28 | Frappe en compose | G17-01 | Login + crear cliente | UI accesible tras SSO | Prod: backup incluido en backup.sh |
| F-29 | Sync Twenty→Frappe factura | G17-01 | Lead→opp ganada→invoice en ERPNext | Factura con datos correctos | Prod: reconciliación semanal sin diff |
| F-30 | Editor visual plantillas | G12-01, G12-02 | Alta cliente nuevo desde UI + prueba | Cliente sin editar JSON (CTX05-O2) | Prod: permisos por rol OK |

### Oleada F — Seguridad y hardening

| Fase | Objetivo (4 palabras) | RAGs que actualiza | Pruebas clave | Verif. funcionamiento | Gate |
|---|---|---|---|---|---|
| F-31 | HTTPS + CORS + headers | G9-04 | curl HTTPS 200 + headers | Módulos por HTTPS; 0 mixed content | Prod: certificados sin expiración |
| F-32 | Rotación keys + roles PG | G9-04 | Cada servicio solo su BD | Stack OK tras rotación | Prod: rotación probada en vivo 1 vez |
| F-33 | PII filter + audit logger | G9-04 | 0 PII en logs; eventos persistidos | Filtro activo en todos los servicios helper | Prod: auditoría consultable con filtros |
| F-34 | Backups + restore + archivo | G9-04 | Restauración real en limpio + conteos | Sistema operativo desde backup | Prod: restauración probada mensual |
| F-35 | Re-auditoría seguridad | G9-04 | 43 vulns re-evaluadas con evidencia | 0 críticas + 0 altas abiertas | Prod: auditoría trimestral programada |

### Oleada G — Observabilidad

| Fase | Objetivo (4 palabras) | RAGs que actualiza | Pruebas clave | Verif. funcionamiento | Gate |
|---|---|---|---|---|---|
| F-36 | Elastic Stack + OTel (reemplaza P+G) | G14-02 | ES/Kibana/OTel healthy; traza visible en Kibana | Métricas CPU/RAM de todos los contenedores | Prod: retención 15d (ILM) |
| F-37 | Métricas negocio + alertas | G14-01, G14-02 | P0/P1 simulacro gatillan | Alerta llega a Telegram | Prod: runbook de respuesta por alerta |
| F-38 | Logs OTel→ES (sustituye GlitchTip) | G14-03 | Error forzado → log en índice ES | Contexto completo (endpoint, payload) | Prod: notif error nuevo al canal |
| F-39 | MinIO storage | G14 (implícito) | Upload → bucket accesible | Excel usa MinIO no disco local | Prod: backup de bucket programado |
| F-40 | Logs JSON unificados | G9-04, G14 | Trace E2E correlada por conversation_id | Traza completa helper+n8n+Dify | Prod: usada en 1 incidente |

### Oleada H — Verificación unificada y portal

| Fase | Objetivo (4 palabras) | RAGs que actualiza | Pruebas clave | Verif. funcionamiento | Gate |
|---|---|---|---|---|---|
| F-41 | Verificación unificada módulos | G14-01 (extendido) | contract tests por frontera | `verify-fase.sh A` pasa; salud conjunta ok | Obligatorio antes de cada oleada nueva |
| F-42 | CI con gates | (nuevo CI RAG) | PR roto bloqueado; verde merge | Pipeline ejecuta en cada push | Tag solo desde main verde |
| F-43 | Portal shell UX-1 | G13-03 | 5 módulos embebidos sin salir | Una URL, un login, nav siempre visible | Prod: sesión única 8h sostenida |
| F-44 | postMessage + lead panel | G13-03, G4-04 | 2 escenarios cruzados OK | Contexto entre navegaciones; panel activo | Prod: panel usado en handoff real |
| F-45 | Búsqueda + notificaciones | G13-03 | Ctrl+K <500ms, notif handoff visible | Búsqueda devuelve por tenant | Prod: notificaciones P0 distinguibles |
| F-46 | Trazabilidad E2E sin pérdida | G14-01, RAGs validados | 10 mensajes sintéticos con marker | 10/10 trazas completas + 0 campos perdidos | Prod: ejecución diaria programada |

### Oleada I — Validación agente, datos, plantillas

| Fase | Objetivo (4 palabras) | RAGs que actualiza | Pruebas clave | Verif. funcionamiento | Gate |
|---|---|---|---|---|---|
| F-47 | Suite comportamiento agente | G15-01…06 | 20+ guiones CTX-04 con aserciones | Cada CTX04-OX con ≥1 test verde | Prod: suite en cada despliegue |
| F-48 | Validación datos/contexto | G1-04, G18-02 | Checks diarios: huérfanos, diff Redis/PG, sin sync | 7 días en 0 errores | Prod: alerta en simulacro mensual |
| F-49 | Plantillas contexto cerrado | G16-01, G12-02 | 50 preguntas adversariales | 0 respuestas no verificadas; forbidden bloqueado | Prod: rate bloqueo monitoreado |
| F-50 | Segundo rubro piloto | G16-03 | Comportamiento salón 0 cambios núcleo | Reserva completa con paquete y fecha | Prod: decisión rubro siguiente |
| F-51 | Load test 50 conversaciones | G14-01, G14-02 | 50 × 5 turnos sin >5% errores | p95 dentro de SLI; carga visible en Kibana | Prod: baseline para comparar |

### Oleada J — SaaS y despliegue

| Fase | Objetivo (4 palabras) | RAGs que actualiza | Pruebas clave | Verif. funcionamiento | Gate |
|---|---|---|---|---|---|
| F-52 | BI Metabase + KPIs | (nuevo BI RAG) | Dashboard con datos reales + KPI-4 <$0.01 | Conexión con rol reader; sandboxing activo | Prod: dashboard mostrado a piloto |
| F-53 | Planes + onboarding automático | G18-01, G18-03 | Alta tenant demo → límites + onboarding <5 min | Botón "nuevo cliente" sin pasos manuales | Prod: piloto dado de alta por flujo |
| F-54 | Despliegue distribuido prod | G1-01, G1-02, G18 | deploy→smoke→deploy→rollback | Nginx balancea; containers non-root, cap_drop | Prod: procedimiento usado en go-live |
| F-55 | Staging + gate pre-producción | Todos los RAGs | run-all.sh: tests ✅ contratos ✅ comportamiento ✅ traza ✅ integridad ✅ seguridad ✅ carga ✅ restore ✅ | Checklist go/no-go firmado | **Gate del proyecto completo** |
| F-56 | Go-live piloto | Todos los RAGs | Smoke diario auto en prod | Piloto real; KPI-3 >50%, KPI-4 <$0.01, 0 incidentes | Prod: 30 días → decisión con números (CTX-07 §5) |

### Instrucciones de ejecución por fase (agente/desarrollador)

1. **Seleccionar** la primera fila con ⬜ en la tabla de TEC-06 §5 cuyas dependencias estén ✅.
2. **Leer solo:** esta tabla (fila de arriba) + la fase completa en TEC-06 + referencias directas (CTX/ADR/TEC).
3. **Implementar** siguiendo los pasos numerados de TEC-06 (nada fuera del alcance).
4. **Ejecutar** las pruebas de la columna "Pruebas clave" + las suites de test existentes (176 tests base).
5. **Cerrar** si verificaciones pasan → marcar ✅ en TEC-06 §5 + actualizar esta tabla (cambiar estado de los RAGs de la columna "RAGs que actualiza") + CHANGELOG. Si falla, no avanzar (regla de oro).

---

## Estadísticas del mapa

| Estado | Cantidad | % |
|---|---|---|
| ✅ Implementado | 33 | ~49% |
| 🟡 Parcial/activación | 9 | ~13% |
| ⚠️ Implementado con riesgo/deuda | 1 | ~2% |
| 🔴 Diseñado/no iniciado | 25 | ~37% |
| **Total entradas RAG** | **68** | 100% |

> Desglose ✅: G1×2, G2×4, G3×4, G4×3, G5×3, G7×2, G8×3, G9×2, G10×1, G11×1, G12×1, G13×2, G14×3, G16×2.

## Mantenimiento de este archivo

1. Toda feature nueva recibe ID `RAG-GX-YY` secuencial dentro de su grupo (regla: primero se registra aquí, luego se implementa — o en el mismo PR).
2. Cambio de estado → actualizar la entrada + TEC-03 tabla §3 + CHANGELOG (checklist TEC-04 §7).
3. Este archivo es el **punto de entrada recomendado para agentes IA**: leer el índice de grupos → saltar a la entrada → seguir sus referencias (TEC-02 para detalle, CTX para contexto).

---

## Referencias cruzadas
- → [Índice contextual](../contextual/00-INDICE-CONTEXTUAL.md) · [Índice técnico](../tecnica/00-INDICE-TECNICO.md)
- → [TEC-02](../tecnica/TEC-02-FUNCIONES-IMPLEMENTACION.md) (detalle por grupo) · [TEC-05](../tecnica/TEC-05-GUIA-CONTEXTO-RAG.md) (rutas de lectura)
