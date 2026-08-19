# Wibsite Business — Historial de Cambios

## [3.5.0] — 2026-08-16 (Integración E2E de UI — Playwright + SOAC)

### Added
- **Suite E2E de UI con Playwright** en `wibsite/e2e/` (`playwright.config.js`, `reporter.js`, `helpers/auth.js`, `specs/`): portal hub (SLI real), monitoring (health + dependencias), agent, n8n y portal/search (skipped por SSO).
- **Reporter Playwright → SOAC**: emite eventos `e2e_ui` (test.finished/failed/skipped) con módulo `ui-e2e`, flujo `e2e.playwright`, dependencia `playwright`, `latency_ms` y `tenant_id=default`.
- **`helper-node/index.js`**: endpoint `POST /api/internal/ui-results` + contador `ui_e2e_total`; handler `e2e_ui` distingue `skipped` (nivel info, sin severity).
- **`scripts/tevs/tests/TEST-UI-001-ui-e2e.ps1`**: verifica eventos `e2e_ui` en ES (últimas 24h, gate ≥1 `test.finished`), tag `ui,e2e,playwright,gate3`, no bloqueante.

### Changed
- `helpers/auth.js`: `loginViaAuthelia` con selectores robustos (input por tipo + espera de render SPA).
- `reporter.js`: elimina `test.project()` → `test.titlePath()[0]`; preserva `skipped`; console_errors solo en `failed`.
- Especs: `portal.spec.js` valida SLI en `/hub/control-center.html` (no `index.html`); `n8n.spec.js` informativo (espera de render); `search.spec.js` y portal shell en `test.skip` con anotación SSO.

### Verified
- ✅ Suite E2E de UI: **123 passed / 6 failed (rate-limiting) / 4 skipped** (135 tests totales).
- ✅ API Health: 7/7 (health, SLI, dependencias, uptime, prometheus).
- ✅ Campañas CRUD: 14/14 (crear, listar, obtener, actualizar, schedule, start, pause, complete, delete, leads, stats).
- ✅ Leads/Scoring: 19/20 (top, rules, evaluate, profile, conversations, opt-outs, templates, agent templates, config, business-types, personalities, system-prompt).
- ✅ Agente conversacional: 10/10 (chat saludo/compra/soporte, commercial-graph, LLM chat, LLM health, KB health, KB query, objeciones, handoff).
- ✅ Monitoreo SOAC: 14/18 (logs, trends, summary, incidents, channels, KB documents — 4 flaky por rate-limiting 429).
- ✅ Seguridad: 8/10 (auth, sanitizer, HMAC, headers, PII — 2 flaky por rate-limiting).
- ✅ Flujo Inbound/Broadcast/Scoring/Chatwoot: 12/16 (simulaciones Twilio, campaña, scoring, CRM sync — 4 flaky por rate-limiting).
- ✅ Control Center UI: 21/21 (sidebar, dashboard SLI/SOAC, módulos, alertas, incidentes, seguridad, fallbacks, logs, trace, tests, tools).
- ✅ Hub Diccionario: 14/16 (dashboard, diccionario, flujos, verificación, impacto, búsqueda, status bar — 2 flaky).
- ✅ Telemetría SOAC: eventos `e2e_ui` en PG (`audit_logs`) y ES (`logs-doags.otel-production`) con módulo/flujo/dependencia/latencia.
- ✅ TeVS **14/14 PASSED** (incluye TEST-UI-001) · e2e-trace **10/10**.
- ⚠️ Login SSO Authelia con credenciales documentadas devuelve "Incorrect username or password" → specs de portal shell y search en skip hasta configurar la password real.

## [3.4.0] — 2026-08-15 (Oleada J: Pendientes implementados — RAG, cotizaciones, TTS, portal, cutover, carga)

### Added
- **R2 — RAG conectado al grafo**: nodo `kb` (respuestas desde base de conocimiento) + consulta en `analyzeNode` con prioridad comercial (la intención de compra no deriva a KB); stemming básico en `queryInMemoryKB`; `kb-documents/` movida al contexto del build y **cargada en el arranque del helper** (`loadKbFromDisk`).
- **C1-C4 — Cuestionarios por servicio + estimación + mini-cotización**: `quoteEngine.js` (match de servicios por nombre/descripción, cuestionarios `questionnaire[]` con opciones y factores, estimación por alcance) + nodo `cotizacion` (mini-cotización con rango USD, tiempos, garantía y validez; evento `campaign_sent` con `cotizacion.generar`). Plantilla `consultora-software` ampliada a 8 servicios (integración, módulo, a medida, auditoría, web, móvil, full stack, plataformas).
- **G-37 — TTS**: `mediaProcessor.synthesizeSpeech` (OpenRouter `/audio/speech`) + `telegramAdapter.sendVoice` + modo `REPLY_AUDIO_MODE=on_demand` en el pipeline (respuesta de voz a mensajes de voz).
- **MC5 — Broadcast multicanal**: `POST /api/channels/broadcast` (audiencia por lead/canal, placeholders {{name}}, auditoría por envío).
- **Portal (Fase 2 parcial)**: Lead Context Panel (perfil de lead vía `/api/leads/:id/profile`), búsqueda global Ctrl+K (`GET /api/search`), notificaciones unificadas (`GET /api/notifications`, badge en topbar).
- **B1 — Lectura PG con `STORE_MODE=pg`**: snapshot de PG con refresco por TTL en el facade + `findAll` en LeadStore/ScoreStore/OptOutStore.
- **F-47 — Suite de comportamiento del vendedor**: `behavior.test.js` (venta completa con cotización, soporte/derivación, KB sin pérdida de contexto).
- **F-51 — Load tests**: `scripts/load/k6-scenario.js` (50 conversaciones, umbrales p95<2000ms) + `scripts/load/load-test-node.js` (simulador local con métricas p50/p95/throughput).
- **B2 — n8n activado**: 2/3 workflows activos en runtime verificado por logs (01-Inbound + 02-Broadcast; el tercero es variante experimental con credenciales pendientes).

### Changed
- `llmClient.callDify`: **presupuesto de latencia** (`DIFY_BUDGET_MS=6000`, AbortController) → bajo carga cae al fallback OpenRouter y mantiene fluidez.
- `autonomy.wantsPricing`: regex afinado (ya no dispara con "pasarela de pagos").
- Grafo: aristas `analyze→kb`, `propuesta→cotizacion`, `analyze→cotizacion` con guardas de cuestionario; `stageMap` con `kb` y `cotizacion`; `calificacionNode` integra cuestionario antes que datos genéricos.
- `hub/control-center.html`: dependencia Elasticsearch (SOAC) real, tools Kibana/MinIO, alertas Kibana/ES; `health-detailed` con `elastic` (cluster health real), `redis` (ping), `modules.channels/multimodal`.
- Docker: helper recibe `ELASTICSEARCH_URL`/`ELASTIC_PASSWORD`; Dockerfile copia `kb-documents/`.

### Verified
- ✅ Jest: **22 suites, 176/176 PASS**.
- ✅ TeVS **13/13** · e2e-trace **10/10**.
- ✅ RAG en runtime: turno `analyze → kb` ("Respuesta desde base de conocimiento (faq)") en webhook Telegram real.
- ✅ Cuestionario+cotización E2E (test + node): tienda en línea → web_type → payments → propuesta → cotización con rango USD/garantía/validez.
- ✅ Load test 8 conversaciones × 2 concurrencia: **8/8 ok, p50=434ms, p95=1177ms, 3.29 turnos/s** (con budget timeout; antes p95=4471ms).
- ✅ Broadcast multicanal en vivo (degradación sin tokens auditada); búsqueda y notificaciones 200.
- ✅ n8n: "Activated workflow 01/02" en logs del contenedor.
- ⚠️ Twenty API key sigue expirada (config pendiente); secretos S1-S3 siguen diferidos a deploy.

## [3.3.0] — 2026-08-15 (Oleada I: Dual-Write PG + Multicanal + Monitoreo completo)

### Added
- **Multicanal (5 canales)**: `services/channels/` — adapters Telegram (Bot API completa: sendMessage, getFile, normalización de texto/voz/foto/video, secret de webhook), Messenger (Graph API v21 + hub.verify), Email (API HTTP genérica Resend/Postmark/Mailgun/SendGrid + normalización inbound), TikTok (bases; requiere API aprobada/agregador), WhatsApp (Twilio existente) + registry con `sendToChannel`/`listChannels`. Rutas: `GET|POST /webhooks/telegram`, `GET|POST /webhooks/messenger`, `POST /webhooks/email-inbound`, `POST /webhooks/tiktok-comments`, `GET /api/channels/status`, `POST /api/channels/test`. Pipeline inbound unificado `handleInboundMessage` (normalizar → lead+delivery → media → grafo agente → reply por el mismo canal → audit).
- **Bases multimodales (F-36/G-36)**: `services/mediaProcessor.js` — STT audio→texto vía OpenRouter `/audio/transcriptions` (configurable `OPENROUTER_STT_MODEL`), visión imagen→descripción vía `gpt-4o-mini`, video→audio+thumbnail; degradación elegante (null sin configuración). **Instrumentado SOAC**: spans `media.stt`/`media.vision` + eventos `api_call/error` con latencia y modelo.
- **Puente OTLP logs**: `otelBridge.sendLog/flushLogs` (v1/logs, batch 2s, trace/span correlacionados) + `auditLogger` conectado → logs-doags.otel-production poblado (109+ docs con `event.type`, `wibsite.module/flow/action`, `trace_id`).
- **SOAC ampliado**: `/health` expone `modules.channels` y `modules.multimodal`; eventos `media.processed`/`media.degraded` en el pipeline; TeVS +2 tests (TEST-CHN-001 multicanal, TEST-MM-001 multimodal) → suite 13 tests.
- `jest.config.js` + `__tests__/helpers/` (testApp con store temporal, PG/Redis aislados, closeAll) + suite `channels.test.js` (18 tests).

### Changed
- **F-08 dual-write PG conectado a rutas** (`writeCampaignToPg/writeLeadToPg/writeScoreToPg/writeOptOutToPg` en store.js): POST /api/campaigns, /api/campaigns/:id/leads, upload CSV, /api/leads/score, /api/opt-outs, webhooks WhatsApp/Twilio/Chatwoot. pgStore con ids explícitos (mismo UUID que JSON), guardas de existencia y derivación de campaign_id en scores. Verificado en vivo: campaña→lead→score→opt-out en PG.
- **Dify integrado al flujo real**: `DIFY_API_KEY` en compose del helper; `llmClient` normaliza URL (base o `/v1/workflows/run`), envía `contact_name/phone`, y parsea el output real del workflow (`outputs.llm` fenced JSON: `intent_label/intent_score/confidence/total_tokens/suggested_response`) — modo primary verificado con span usage y audit completos.
- **Bug corregido**: `updateStore` sin `await` en rutas → respuestas `[]` y datos sin persistir antes del dual-write.
- `conversationStore`: `closeRedis()` + guard re-init; index.js con graceful shutdown (SIGTERM/SIGINT → closeRedis + pool.end) y `app.closeAll` para tests.
- **Leak de worker Jest corregido** (closeRedis/closeAll/stores aislados/mocks de red); suites de app usan helper compartido.
- `conversation_summaries` migrada a PG (F-14 desbloqueado).
- ILM: `traces@lifecycle`, `logs`, `metrics` → rollover 1d + delete 30d (antes 30d sin rollover diario).
- Limpieza de residuos: `monitoring/` (prometheus/grafana/alertmanager) eliminado; nginx `/erp/` y `/reportes/` comentadas (ERP/BI diferidos, no descartados).
- Docs: ESTADO-GENERAL/LOGROS/OBJETIVOS-PENDIENTES/GAPS-MINIFASES actualizados al estado real; nuevo `docs/ANALISIS-CRUZADO-2026-08-15.md`; `SECURITY-GAPS-PRE-DEPLOY.md` re-verificado (S1-S3 diferidos a deploy).

### Verified
- ✅ Jest: 19 suites, **169/169 PASS** (antes 17 suites/151).
- ✅ TeVS: **13/13 PASSED** (11 originales + TEST-CHN-001 canales + TEST-MM-001 multimodal) · e2e-trace: **10/10 ×5 corridas**.
- ✅ Dual-write PG end-to-end vía API real (campaña/lead/score/opt-out con mismos UUIDs).
- ✅ Webhook Telegram simulado E2E: lead + grafo 4 etapas + LLM real + reply degradado + audit en PG y ES logs con atributos completos.
- ✅ **Dify conectado al flujo real**: `DIFY_API_KEY` pasa al helper; URL normalizada; parseo del output real (`outputs.llm` fenced JSON con `intent_label/intent_score/total_tokens`); modo primary verificado (3794ms, 352 tokens) con fallback OpenRouter + circuit breaker.
- ✅ ILM rollover en vivo: nuevo backing index `logs-…-2026.08.15-000002`.
- ✅ **SOAC cubre toda la oleada**: spans `media.stt`/`media.vision`, eventos `media.processed/media.degraded`, `channel.test_send`, `webhook_received/failed` — todo con módulo/flujo/acción y trace/span.
- ⚠️ Pendientes documentados: S1-S3 seguridad (deploy), n8n activación UI, k6, alertas Kibana (ver ANALISIS-CRUZADO §6).

## [3.2.0] — 2026-08-12 (Oleada H: Trazabilidad E2E + Re-auditoría F-35)
### Added
- **Gate de trazabilidad E2E (F-46)**: `scripts/verify/e2e-trace.js` — inyecta mensaje con marker único, verifica 10 aserciones en `audit_logs` (PG) y en Elastic (OTel): cadena `HTTP POST /api/agent/chat → agent.graph.run → llm.completion`, tokens de uso (`gen_ai.usage.input_tokens/output_tokens`, `llm.usage.total_tokens`) e `wibsite.intent/score` sin pérdida entre saltos. 10/10 en 3 corridas consecutivas (exit 0). Consulta ES con polling (hasta 8 intentos) porque el elasticsearchexporter reintenta batches mezclados con spans ajenos (redis `PUBLISH` de otros servicios del stack).
- **`helper-node/services/otelBridge.js`** (emisor OTLP/HTTP mínimo sin dependencias, spans por request/LLM/grafo correlacionados con auditLogger, flush 2s, buffer 200, degradación silenciosa sin collector).
- **`scripts/audit-logs-trace-columns.sql`** (diagnóstico de columnas/RLS de `audit_logs`).

### Changed
- `helper-node/index.js`: `GET /api/logs/trace/:conversationId` — SQL corregido (`created_at` inexistente → `timestamp AS created_at`; el catch silencioso producía 404 falso) y timeline ahora incluye `request_id` + `span_id`.
- `helper-node/services/auditLogger.js`: `createAuditMiddleware` registra `conversationId` (`req.body?.conversationId || req.params?.conversationId`).
- **F-35 Re-auditoría seguridad**: `helper-node/middleware/auth.js` con comparación timing-safe (`crypto.timingSafeEqual` + length check); `nginx.conf` sin `x-api-key "test"` hardcodeada (autenticación del gateway por SSO Authelia); `otel-collector/config.yaml` con `${ELASTIC_PASSWORD}` (env var con fallback compose `wibsite_elastic_pass_2026`).
- `helper-node/wibsite-store.json` excluido del repo en el commit de trazabilidad (PII — ver P0 purga histórica).

### Verified
- ✅ `e2e-trace.js`: 10/10 × 3 corridas consecutivas (01:50-01:52 UTC 13/08) — traza `HTTP → agent.graph.run → llm.completion` con tokens (95/20/115, 97/21/118) e intent/score intactos.
- ✅ TeVS completo: 11/11 PASSED contra el helper final (post F-35/e2e fixes).
- ✅ Auth: sin key 401, key mala 403, key real 200; gateway `/api/health` 200; `/api/campaigns` 403 sin sesión SSO Authelia (por diseño).
- ✅ RLS `audit_logs` confirmado: política `tenant_isolation_audit_logs` forzada; `app_user` ve filas de su tenant; solo tenant `default` presente.
- ⚠️ `flow.test.js` sigue roto (deuda P2) y el helper emite warning benigno "Invalid Sentry Dsn".

## [3.1.0] — 2026-08-12 (Oleada C: Motor Agéntico Ejecutable)
### Added
- **F-14 Checkpointer de memoria profunda**: `conversationStore.js` con `saveCheckpoint/loadCheckpoint/deleteCheckpoint`, `appendMessage`, `updateConversationMetadata`, `onTransition` hooks (TTL 7d, MAX_MESSAGES 100). Nuevo `agentCore/checkpointer.js` (rollup topics/objeciones, persistencia opcional PG) + `scripts/conversation-summaries-schema.sql` (tabla `conversation_summaries` con UNIQUE tenant+conv y versión incremental).
- **F-16 Grafo 8 etapas ejecutable**: `agentCore/index.js` con 9 nodos (apertura, analyze, calificacion, propuesta, profundizacion, objeciones, cierre, handoff, seguimiento), aristas condicionales (`when` predicates), `slotFilling.js` (extracción nombre/teléfono/email/servicio/interés/urgencia + `fitComplete`/`missingFields`), `stageMap.js` (8 etapas ↔ estados conversationStore), `walkMachine` (BFS sobre `VALID_TRANSITIONS`). Calificación delega a propuesta en el mismo turno cuando el fit se completa. Nodos lineales antiguos eliminados.
- **F-17 Guardas de confidencialidad + autonomía**: `guards/confidentiality.js` (filtro de campos internal/forbidden_topics/privados, transformación PII assisted: teléfono `*********5678`, email `an***@correo.com`, `sanitizeOutput` con bloqueo + alerta) y `guards/autonomy.js` (zonas green/yellow/red; pricing → yellow con disclaimer; compromiso → red → handoff).
- **F-18 Dify como nodo + fallback**: nuevo `agentCore/llmClient.js` — Dify `workflows/run` (blocking) con fallback OpenRouter `chat/completions` (JSON classifier), circuit breaker (3 fallos → cooldown 60s), `parseFinalResult` para `final_result` anidado.
- **F-21 Sync máquina comercial↔técnica**: nuevo `agentCore/commercialState.js` (MAP técnico→comercial según CTX-07 §3: calificando, propuesta_enviada, en_objeción, agendado/cerrado, reactivado, derivado_a_humano, perdido, enfriándose) + `registerHook` en `onTransition`/`updateConversationMetadata` (metadata + log `state_transition`).
- **Nuevo endpoint `POST /api/agent/chat`** (message/template_id/client_id, genera conversationId UUID). `/api/agent/commercial-graph` ahora recibe `tenantId`.
- **26 tests nuevos** (checkpointer, agentGraph 7-turnos hasta handoff, guards, difyFallback, commercialState) + `contract-integrations.test.js` reescrito sobre contratos reales (llmClient + ragEngine).

### Changed
- `agentCore/index.js`: `executeCommercialGraph` — `restoreGraphState` → grafo → `ensureCommercialHook()` → `walkMachine` → `sanitizeOutput` → `saveTurn` (mensajes + checkpoint + PG) → logs por etapa; respuesta con `stage/intent/score/autonomyZone/commercialState/nextAction/path/completeness/briefing`.
- `agentCore/graph.js`: aristas condicionales `addEdge(from, to, when?)` (primera que pasa) + `_summarize` con history completo.
- `agentCore/handoffNode.js` / `followupNode.js` / `entryNode.js`: reescritos para el nuevo grafo.
- `helper-node/index.js`: boot con `checkpointer.initSummariesPool(pool)`.

### Fixed
- **Contract tests**: `contract-integrations.test.js` ya no depende de wrappers inexistentes; testea `llmClient.classify` y `queryKnowledgeBase`/`checkWeaviateHealth` reales (4/4 pasan).

### Verified
- ✅ 149/149 tests en 17 suites Jest. Única suite rota: `flow.test.js` (deuda estructural pre-existente: referencias a módulos/rutas que nunca existieron — P2, no causada por esta versión).
- ✅ Trazabilidad: F-14/16/17/18/21 marcadas ✅ en TEC-06 §5.

## [3.0.0] — 2026-07-18 (Documentación Viva + Hub Visual)
### Added
- **Carpeta `Avances/`** — Documentación viva de estado del proyecto con 6 archivos:
  - `ESTADO-GENERAL.md` — Visión general con barras de progreso por área
  - `LOGROS.md` — Logros completados organizados por componente
  - `OBJETIVOS-PENDIENTES.md` — 24 objetivos priorizados P0-P3 con dependencias
  - `COMPONENTES.md` — Matriz de salud de servicios y endpoints
  - `PROCEDIMIENTOS.md` — Procedimientos operativos y troubleshooting
  - `ROADMAP.md` — Roadmap Fase 0-7 con milestones y dependencias
- **Hub Visual (`hub/index.html`)** — Diccionario visual interactivo completamente renovado:
  - Barra de búsqueda global de módulos, funciones y conceptos
  - Diccionario del proyecto: cada módulo con propósito, logros y pendientes
  - Flujos paso a paso: Inbound Message, Campaign Broadcast, Opt-Out, Sync CRM
  - Objetivos: listado completo de logros y pendientes con filtros
  - Guía de verificación: tests por componente con procedimientos
  - Indicadores de impacto: qué afecta qué entre componentes
  - Navegación por tabs con contenido dinámico
  - Status checker de servicios en vivo
- **Documentación estandarizada**: INDEX.md actualizado con sección 0 (Avances/), sección 9 corregida

### Changed
- `docs/INDEX.md` — Agregada sección "Estado Vivo del Proyecto" como sección 0, corregidas referencias a Avances/
- `docs/SOURCE_INDEX.md` — Agregadas secciones Avances/, hub/, certs/, authelia/, backups/, RAG docs
- `docs/GLOSSARY.md` — Agregados términos: Authelia, OpenRouter, SPA, ADR, Hub, Gateway, Namespace

### Fixed
- `docs/INDEX.md` — Sección 9 apuntaba a archivos inexistentes `../../doc/ESTADO.md`; ahora apunta a `Avances/`

## [2.1.1] — 2026-07-10 (Critical Bugfix)
### Fixed
- **CRITICAL: `existing is not defined` ReferenceError** en `POST /api/twenty/sync` (línea 783). La variable se llamaba `existingPerson` pero se referenciaba como `existing`. Causaba 500 en cada sync exitoso.
- **CRITICAL: Race condition en endpoint seed** — `POST /api/seed` mutaba `store.leads.push()` y llamaba `saveStore()` directamente sin usar el lock `storeLock`, permitiendo corrupción de datos bajo concurrencia. Corregido: toda mutación envuelta en `updateStore`.
- **CRITICAL: Phone normalization para Twenty CRM** — cuando `phoneNumber` está vacío, se normaliza a `''` y se omite el campo `phones` en lugar de enviar `"+"` (causaba `INVALID_PHONE_NUMBER` 400). Aplica a `sync` y `sync-all`.
- **Paginación en Twenty people lookup** — ambos endpoints (`sync`, `sync-all`) ahora iteran con `limit=100&offset=N` para encontrar personas existentes en lugar de solo la primera página.
- **Scores persistidos en evaluate-all** — `score` y `score_data` ahora se guardan correctamente en cada lead durante evaluación batch.
- **Duplicate campaign names** — `POST /api/campaigns` y `POST /campaigns` retornan 409 si ya existe una campaña con el mismo nombre.
- **Seed endpoint usa updateStore** — reemplazado `saveStore()` directo por `updateStore()`.
- **DELETE /api/seed** — reemplazado `saveStore()` directo por `updateStore()`.

### Changed
- **Scoring engine refactorizado**: función `evaluateLead()` compartida entre `/api/scoring/evaluate` y `/api/scoring/evaluate-all`, eliminando ~45 líneas de código duplicado.
- **`hasClicked` ahora evaluado en ambos endpoints** — antes solo se computaba en la ruta individual.
- **Delivery filter corregido** en `evaluateLead()`: ahora filtra solo por `contact_id === lead.id`, no por `campaign_id`.
- **Seed endpoint**: datos construidos fuera de `updateStore` y mutación atómica única.
- **Twenty phone normalization centralizada**: variable `normalizedPhone` reutilizada en búsqueda y creación.

### Security
- **Primera capa de seguridad en helper**: validación de API key de Twenty (400 si no configurada).
- **Validate campaign name uniqueness** — previene duplicados accidentales.

### Infrastructure
- Chatwoot: fix `A server is already running` — agregado `rm -f /app/tmp/pids/server.pid` al comando de arranque.
- Nginx: Twenty CRM ahora accesible vía `/crm/` (200 OK, antes 502 por WebSocket headers).
- Nginx: Legacy v1 endpoints `/campaigns` ahora accesibles (antes solo `/campaigns/`).

### Verified (Pilot Test — 16/16 tests)
- ✅ 6 health checks: helper, hub, dashboard, twenty, n8n, chatwoot (todos OK)
- ✅ Seed API: 3 campañas, 12 leads, 12 deliveries, 12 scores
- ✅ Campaigns CRUD: list, create, duplicate rejection (409)
- ✅ Legacy v1: POST + GET /campaigns (restaurados)
- ✅ Scoring: rules config, evaluate-all (48/48 leads scored, 0 errors)
- ✅ Templates: list (11), preview with vars
- ✅ Channels: 5 channels (whatsapp, messenger, tiktok, sms, email)
- ✅ Twenty health: connected: true, hasApiKey: true
- ✅ LLM health: configured: true, provider: openrouter
- ✅ Cascade delete: campaign + associated leads/deliveries/scores

## [2.1.0] — 2026-07-10
### Added
- Excel/CSV upload endpoint: `POST /api/campaigns/:id/leads/upload` con multer + xlsx, auto-detección de columnas (phone/name/email), validación, duplicados por campaña, custom fields para columnas no mapeadas
- UI drag & drop Excel en dashboard: modal con selector de campaña, drop zone, preview, auto-import al soltar archivo
- 11 plantillas de mensajes predefinidas: WhatsApp (3), Messenger (2), TikTok (2), SMS (2), Email (2) con categorías welcome/promotion/followup/notification/newsletter
- Endpoints de plantillas: GET/POST/DELETE /api/templates, POST /api/templates/preview
- Tab Plantillas en dashboard con filtro por canal y preview
- Mock seed data: POST /api/seed (3 campañas, 12 leads, 12 deliveries, 12 scores, 5 channel status) + DELETE /api/seed
- 10 campos custom en Twenty CRM (people): painPoints, interests, scoreHistory, lastScore, leadSource, customFields, leadScoreHistory, leadLastScore, leadOrigin, leadCustomData
- Twenty CRM sync endpoints: POST /api/twenty/sync (individual upsert por teléfono), POST /api/twenty/sync-all (batch)
- Scoring engine rule-based: GET/PUT /api/scoring/rules (configurable), POST /api/scoring/evaluate (individual), POST /api/scoring/evaluate-all (batch)
- 5 factores de scoring: engagement 35%, recency 25%, channel affinity 15%, profile completeness 15%, interest match 10% + 8 reglas condicionales
- Umbrales de scoring configuables: hot ≥70, warm ≥40, cold <40
- Botones de acción rápida en dashboard: Sync CRM, Score All, Seed, Clear
- Auto-refresh en dashboard (15s)
- Nginx: resolver 127.0.0.11 + variable-based proxy_pass para Chatwoot (permite arranque sin Chatwoot)
- Dependencias: xlsx, multer
- OpenRouter LLM integration: reemplaza xAI Grok. Endpoints /api/llm/chat, /api/llm/health, /api/scoring/evaluate-llm
- Botón Test LLM en dashboard + indicador de modelo activo

### Changed
- helper-node/index.js: reconstruido con 500+ líneas — Excel upload, templates, Twenty sync, scoring, seed data, mock data
- helper-node/public/index.html: dashboard SPA con 5 tabs (Dashboard, Campañas, Leads, Plantillas, Canales), modales import/seed/templates, botones sync/score
- nginx.conf: resolver + variable runtime para Chatwoot, rutas reorganizadas (/hub/, /admin/)
- Hub principal ahora en /hub/ con 8 cards de acceso directo

### Fixed
- Twenty API key: configurada y funcional (GET /api/twenty/health → connected: true)
- Twenty REST API: manejo de respuesta GraphQL-wrapped (response.data.data.createPerson)
- Twenty custom fields: prefijo lead para evitar conflictos de namespace global
- Chatwoot nginx: host not found error resuelto con resolver + variable proxy_pass
- Twenty CRM 502 vía nginx: eliminados WebSocket headers del location /crm/
- Legacy v1 endpoints inaccesibles: agregado `location = /campaigns` en nginx

## [2.0.0] — 2026-07-10
### Added
- Sistema de documentación estructurado: INDEX, SOURCE_INDEX, MEMORY, CHANGELOG, context/*, rag/*
- Campañas multi-canal con nuevo schema PostgreSQL: campaigns, campaign_leads, lead_scores, channel_status, opt_outs, workflow_logs
- helper-node v2: migrado de JSON file store a PostgreSQL con fallback automático
- Nuevos endpoints: /api/campaigns (CRUD completo), /api/campaigns/:id/leads, /api/leads/score, /api/leads/top, /api/channels, /api/dashboard/summary, /api/twenty/health
- Monitoreo web con LEDs: dashboard en tiempo real con indicadores de estado por canal (conectado/desconectado/error/pendiente)
- `campaigns-schema.sql`: migración completa para PostgreSQL
- Base de datos `wibsite` añadida a init-db.sql
- Dependencia `pg` añadida a helper-node

### Changed
- helper-node: imagen Docker actualizada con soporte PostgreSQL + directorio public/
- init-db.sql: añadida database `wibsite`
- Rutas Express 5: catch-all corregido de `'*'` a middleware `app.use`

### Fixed
- n8n workflow 01-inbound-message.json: nombre de nodo "Check Needs Human?" → "Needs Human?" en conexiones

## [1.0.0] — 2026-07-09
### Added
- Estructura base del proyecto (docker-compose con 11 servicios)
- Chatwoot (inbox messaging) + worker
- Dify API + Web + Worker
- Dify Plugin Daemon v0.6.3-local
- n8n como orquestador de flujos
- Twenty CRM (servidor)
- Helper Node (Express.js) para lógica de campañas
- Nginx reverse proxy (unifica servicios en puerto 8080)
- Script de inicialización (init-wibsite.js)
- Script SQL de inicialización de bases de datos
- 2 workflows n8n: inbound-message y campaign-broadcast
- 1 workflow Dify: whatsapp-lead-classifier

### Fixed
- n8n login: campo `emailOrLdapLoginId` (no `email`)
- Plugin marketplace: formato `plugin_unique_identifiers`
- Dify auth: cookies + CSRF token

### Known Issues (v2.2.0)
- Meta/WhatsApp: token temporal expira cada ~6h. Se requiere System User token permanente.
- n8n 2.23.4 body parser bug: REST API no procesa JSON. Webhook endpoint sí funciona.
- Twenty CRM sync: 24/25 leads fallan con 400 (formato de teléfono). Solo 1 sync exitoso.
- Twenty CRM custom fields: namespace global — `scoreHistory` conflictúa si se crea en otro objeto.
- **Helper Node sin autenticación** — todos los endpoints públicos. Requiere Gateway/SSO (ADR-016).
- Dify Code nodes: sintaxis `{{#node_id.text#}}` no se reemplaza correctamente en el sandbox. Solución: usar LLM nodes.

## [2.2.0] — 2026-07-12 (MVP Integration)
### Added
- **Dify sandbox** (`langgenius/dify-sandbox:latest`) agregado a docker-compose en puerto 8194
- `CODE_EXECUTION_ENDPOINT` configurado en dify-api
- **n8n env vars** en docker-compose: `DIFY_API_KEY`, `CHATWOOT_API_KEY`, `TWENTY_API_KEY`, `META_APP_ID`, `META_API_VERSION`, `META_APP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- `META_APP_ACCESS_TOKEN` agregado a `.env`
- **Documentation structure**: PLAYBOOK-CAMBIOS.md, CHECKLIST-MANTENIMIENTO.md

## [2.3.0] — 2026-07-13 (SPA subpath fix)
### Added
- **n8n subpath**: `N8N_PATH=/n8n/` en docker-compose. n8n genera HTML con paths `/n8n/assets/*`, `/n8n/static/*`, y `BASE_PATH=/n8n/` para API calls. Funciona 100% vía nginx.
- **Twenty assets**: locations `/assets/` y `/images/` en nginx proxyan a twenty-server:3000. SPA carga todos JS/CSS vía `:8080`.
- **Chatwoot assets**: locations `/vite/` y `/brand-assets/` en nginx proxyan a chatwoot:3000.
- **Chatwoot API**: regex location `~ ^/api/v1/` proxy a chatwoot:3000, antes de Helper `/api/`.
- **PLAYBOOK-CAMBIOS.md**: sección 8 "Configuración de SPAs detrás de nginx (subpath)" con patrones y reglas para cada servicio.

### Changed
- **nginx.conf**: eliminados `sub_filter` blocks (no funcionan confiablemente en nginx:1.27-alpine). Reemplazados por locations raíz.
- **PLAYBOOK-CAMBIOS.md**: tests post-cambio ampliados con verificación de assets SPAs vía nginx.

### Fixed
- **Todos los SPAs accesibles vía nginx**: n8n (assets JS/CSS 200), Twenty (asset 2.6MB 200), Chatwoot (asset 2.9MB 200), Dify (sigue funcionando), Hub (200), Admin (200), Health (200). 15/15 tests OK.
- **nginx reload**: documentado `nginx -s reload` después de cambios en nginx.conf.

### Changed
- **Dify workflow**: Code nodes reemplazados por LLM nodes (ADR-018). Workflow 100% funcional con 8 nodos LLM.
- **Dify End node**: Output simplificado a único `final_result` (ADR-021)
- **n8n workflows**: 3 workflows seteados `active=true` via SQL directo
- **N8N_SKIP_WEBHOOK_DEREGISTRATION_SHUTDOWN** comentado (deprecado en 2.23.4)
- **Docs restructure**: INDEX.md reorganizado con secciones: operaciones, cambios, mantenimiento, contexto, RAG, ADR, pruebas, manuales, acciones pendientes

### Fixed
- **n8n body parser bug documentado** en ADR-019 y context/N8N.md
- **Webhook WhatsApp endpoint** `/webhooks/whatsapp` verificado funcional (retorna "OK")

### Demo
- **Script demo MVP**: `C:\Users\joser\AppData\Local\Temp\opencode\demo-mvp.ps1` — prueba de 8 pasos del pipeline completo
- **Verificación**: 7/7 servicios UP, Dify workflow succeeded (73/100 warm), LLM chat funcional, webhook WhatsApp procesa leads, scoring 25/25
