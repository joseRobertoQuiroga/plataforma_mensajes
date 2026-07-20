# LOGROS — Estado de Avance del Proyecto

> Documento vivo — Última actualización: 2026-07-18

---

## Resumen Ejecutivo

| Métrica | Valor |
|---------|-------|
| Servicios en Docker Compose | 11 (PostgreSQL, Redis, Weaviate, t2v-transformers, Chatwoot + worker, Dify API/Web/Worker, Plugin Daemon, n8n, Twenty CRM, Helper Node, Nginx, Authelia) |
| APIs implementadas (helper-node) | 50+ endpoints (v2.2.0) |
| Módulos de seguridad implementados | 4 (Auth API Key, Rate Limiter, Sanitizer, HMAC) |
| State machine conversacional | 9 estados con validación de transiciones |
| Lead Profile Builder | Score history, delivery stats, tags, next action sugerido |
| Agent Config Editor | 10 tipos de negocio, 5 personalidades, system prompt builder |
| RAG Engine | Weaviate + fallback in-memory |
| Anti-Hallucination | Detección de consultas fuera de conocimiento + boundaries |
| SLI/SLO Monitoring | Health+ endpoint, métricas de uptime, error rate, latencia |
| Workflows Dify funcionales | 1 (WhatsApp Lead Classifier — 8 nodos LLM) |
| Workflows n8n importados | 2 (Inbound Message + Campaign Broadcast) |
| Campos custom Twenty CRM | 10 en objeto `people` |
| Plantillas de mensajes | 11 predefinidas |
| Tests unitarios + integración | 112 tests (8 suites) — 100% passing |
| Documentación generada | 25+ archivos en docs/, specs/, docs/context/, docs/rag/ |

---

## 1. Infraestructura y Base

- [x] Docker Compose funcional con 11 servicios orquestados
- [x] PostgreSQL 15 con pgvector y bases de datos separadas (chatwoot, dify, n8n, twenty, wibsite)
- [x] Redis 7 Alpine como caché/queue
- [x] Weaviate 1.26.1 + Transformers (sentence-transformers-multi-qa-MiniLM-L6-cos-v1) para búsqueda vectorial
- [x] Nginx como proxy reverso unificado (puerto 8080)
- [x] Red interna Docker (`wibsite_default`) con comunicación por nombres de contenedor
- [x] Script `init-db.sql` para creación de bases de datos al iniciar PostgreSQL
- [x] Health checks configurados en todos los servicios críticos

## 2. Helper Node (Express.js v2 — ahora v2.2.0)

- [x] Servicio funcional con Node.js 20 Alpine + Express 5.x
- [x] PostgreSQL como almacenamiento primario con fallback automático a JSON file store
- [x] CRUD completo de campañas multi-canal con estados: draft → scheduled → sending → active ⇄ paused → completed / cancelled / failed
- [x] CRUD de leads por campaña con estados: pending → queued → sent → delivered → read → replied → failed / opted_out
- [x] Sistema de tracking de entregas con estadísticas auto-calculadas
- [x] Webhook para Meta WhatsApp (verificación + notificaciones)
- [x] Registro y verificación de opt-outs
- [x] Upload de Excel/CSV con auto-detección de columnas y validación
- [x] 11 plantillas de mensajes predefinidas con CRUD + previsualización
- [x] Motor de scoring rule-based (5 factores + 8 reglas + umbrales)
- [x] Sincronización con Twenty CRM (individual + batch)
- [x] Endpoints de seed data (poblar + limpiar) para pruebas
- [x] Dashboard SPA con 5 tabs (Dashboard, Campañas, Leads, Plantillas, Canales)
- [x] Modales drag & drop para importar Excel
- [x] LEDs de estado de canales en tiempo real
- [x] Auto-refresh cada 15s en dashboard
- [x] Endpoints de normalización de payloads Chatwoot

### Nuevos Módulos v2.2.0 (Julio 2026)

- [x] **Middleware de Seguridad**: Auth API Key (`X-API-Key`), Rate Limiting (30/60 req/min), Sanitizador de Prompts (23 patrones de inyección), validación HMAC para webhooks Meta y Chatwoot
- [x] **Conversation Store**: State machine con 9 estados (greeting → discovery → qualification → proposal → objections → closing → post_sale → support → escalated), validación de transiciones, Redis + fallback in-memory, TTL
- [x] **Lead Profile Builder**: Perfil completo por lead (delivery stats, score history, tags, next action sugerido), integración con Twenty CRM ID
- [x] **Agent Config Editor**: 10 tipos de negocio, 5 personalidades, productos/FAQs configurables, generación de system prompt dinámico
- [x] **RAG Engine**: Weaviate + fallback in-memory, chunking de documentos, query por tenant
- [x] **Anti-Hallucination**: Patrones de detección, respuestas predefinidas para consultas fuera de conocimiento, enforceKnowledgeBoundaries
- [x] **SLI/SLO Monitoring**: Endpoint /health mejorado con uptime, error rate, avg latency, delivery success rate 24h, health de dependencias
- [x] **112 Tests Automatizados**: 8 suites (security, conversation, leadProfile, agentConfig, ragEngine, antiHallucination, rateLimiter, integration), 100% passing

## 3. Dify (Plataforma IA)

- [x] Servicios funcionales: API (5001), Web (3003), Worker, Plugin Daemon (5002)
- [x] Plugin `langgenius/openai_api_compatible:0.0.55` instalado desde marketplace
- [x] Provider visible con modelos compatibles (LLM, rerank, embedding, speech2text, TTS)
- [x] OpenRouter configurado como proveedor LLM (reemplaza xAI Grok)
- [x] 7 modelos registrados en OpenRouter (GPT-4o-mini default, GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash, Llama 3.3 70B, Mistral Large, Command R7B)
- [x] Workflow **"WhatsApp Lead Classifier"** funcional con 8 nodos LLM:
  - Detecta idioma, clasifica intención, extrae datos de contacto, calcula score (0-100), genera respuesta sugerida, arma JSON final
- [x] Output unificado en un solo campo `response_text` (ADR-021)
- [x] Endpoint de scoring LLM en helper-node (`POST /api/scoring/evaluate-llm`)
- [x] Endpoint de chat completion (`POST /api/llm/chat`)
- [x] Pruebas exitosas: WARM 73/100 (product_inquiry), HOT 88/100 (meeting_request)
- [x] Marketplace redirect funcional para instalación de plugins
- [x] Dify Sandbox corriendo (no utilizado — Code nodes reemplazados por LLM nodes)

## 4. n8n (Orquestador)

- [x] Servicio funcional (puerto 5679 mapeado a 5678 interno)
- [x] Login funcional con cookie auth (campo `emailOrLdapLoginId`)
- [x] Owner confirmado en BD (admin@wibsite.com)
- [x] **Workflow 01 - Inbound WhatsApp → Dify → Twenty CRM**: Importado con webhook `/webhook/chatwoot-inbound`
- [x] **Workflow 02 - Campaign Broadcast WhatsApp**: Importado con schedule cada 30 min
- [x] **Workflow 03 - Helper Score & Sync**: Importado
- [x] Workflows activos en BD vía SQL directo

## 5. Twenty CRM

- [x] Servicio funcional (puerto 3001)
- [x] API key JWT generada, configurada y funcional
- [x] 10 campos custom creados en objeto `people`:
  - `painPoints`, `interests`, `scoreHistory`, `lastScore`, `leadSource`
  - `customFields`, `leadScoreHistory`, `leadLastScore`, `leadOrigin`, `leadCustomData`
- [x] Convención de prefijo `lead` para evitar conflictos de namespace global
- [x] Sync endpoints funcionales (individual + batch) — 12/12 leads sincronizados
- [x] Normalización de teléfonos con prefijo `+`

## 6. Documentación y Especificaciones

- [x] `docs/INDEX.md` — Índice maestro de documentación
- [x] `docs/SOURCE_INDEX.md` — Índice detallado de fuentes
- [x] `docs/CHANGELOG.md` — Historial de cambios (160 líneas)
- [x] `docs/MEMORY.md` — 21 ADRs documentados
- [x] `docs/RUTA-ACCIONES-PENDIENTES.md` — Ruta de acciones pendientes
- [x] `docs/TAREAS-FUNCIONALES.md` — Tareas funcionales detalladas
- [x] `docs/TAREAS-INTERFAZ.md` — Tareas de interfaz
- [x] `docs/PRUEBAS-Y-VERIFICACIONES.md` — Pruebas y verificaciones
- [x] `docs/CHECKLIST-MANTENIMIENTO.md` — Checklist de mantenimiento
- [x] `docs/CHECKLIST-SSO.md` — Checklist de SSO (Authelia)
- [x] `docs/GLOSSARY.md` — Glosario de términos
- [x] `docs/MANUAL-TECNICO.md` — Manual técnico (619 líneas)
- [x] `docs/MANUAL-USUARIO.md` — Manual de usuario (520 líneas)
- [x] `docs/SCALABILITY-ANALYSIS.md` — Análisis de escalabilidad
- [x] `docs/DATABASE-VALIDATION.md` — Validación de base de datos
- [x] `docs/RUNBOOK.md` — Runbook de operaciones
- [x] `docs/PLAYBOOK-CAMBIOS.md` — Playbook de cambios
- [x] `docs/context/ARCHITECTURE.md` — Arquitectura general
- [x] `docs/context/N8N.md` — Contexto n8n
- [x] `docs/context/DIFY.md` — Contexto Dify
- [x] `docs/context/CHATWOOT.md` — Contexto Chatwoot
- [x] `docs/context/TWENTY-CRM.md` — Contexto Twenty CRM
- [x] `docs/context/HELPER-NODE.md` — Contexto Helper Node
- [x] `docs/context/CAMPAIGNS.md` — Contexto sistema de campañas
- [x] `docs/rag/ARCHITECTURE-OVERVIEW.md` — Vista RAG arquitectura
- [x] `docs/rag/DATA-FLOW.md` — Flujos de datos
- [x] `docs/rag/ENDPOINTS.md` — Referencia de endpoints
- [x] `docs/rag/ENVIRONMENT-VARIABLES.md` — Variables de entorno
- [x] `docs/rag/DEPENDENCY-MATRIX.md` — Matriz de dependencias
- [x] `docs/rag/CREDENTIALS-REFERENCE.md` — Referencia de credenciales
- [x] `specs/ARCHITECTURE.md` — Especificación arquitectura
- [x] `specs/COMPLETE_ARCHITECTURE.md` — Arquitectura completa (1258 líneas)
- [x] `specs/SETUP_GUIDE.md` — Guía de configuración
- [x] `recovery-nginx.md` — Guía de recuperación Nginx

## 7. Scripts y Automatización

- [x] `scripts/init-wibsite.js` — Script de inicialización/verificación (572 líneas)
- [x] `scripts/init-db.sql` — Creación de bases de datos
- [x] `scripts/campaigns-schema.sql` — Schema de campañas
- [x] `scripts/fix-n8n-workflow.js` — Fix para workflows n8n
- [x] `scripts/configure-openrouter.js` — Configuración de OpenRouter
- [x] `scripts/diagnose-chatwoot.ps1` — Diagnóstico de Chatwoot
- [x] `scripts/package.json` — Dependencias de scripts
- [x] `helper-node/Dockerfile` — Dockerfile del helper-node
- [x] `helper-node/package.json` — Dependencias del helper-node
