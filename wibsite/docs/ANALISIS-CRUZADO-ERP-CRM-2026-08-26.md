# ANÁLISIS CRUZADO: ERPs/CRMs de la Industria vs Plataforma Wibsite

> **Tipo:** Investigación + Análisis cruzado + Recomendaciones | **Fecha:** 26/08/2026
> **Alcance:** 13 ERPs/CRMs investigados (fuentes oficiales) × estado real del sistema Wibsite
> **Objetivo:** Identificar cómo gestionan los ERPs/CRMs contactos, clientes, seguimientos, campañas y mensajes; detectar lo que Wibsite ya tiene de destacado (que la industria no hace); y generar recomendaciones accionables por área (15+ por área).

---

## ÍNDICE

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Metodología y fuentes](#2-metodología-y-fuentes)
3. [Cómo gestionan los ERPs/CRMs (hallazgos por área temática)](#3-cómo-gestionan-los-erpscrms)
4. [Fichas por ERP/CRM investigado](#4-fichas-por-erpcrm-investigado)
5. [Estado real del sistema Wibsite (validado contra documentación y código)](#5-estado-real-del-sistema-wibsite)
6. [Análisis cruzado: matriz industria vs Wibsite](#6-análisis-cruzado)
7. [Funcionalidades DESTACADAS de Wibsite que la industria NO ofrece](#7-funcionalidades-destacadas-de-wibsite)
8. [Gaps detectados vs industria (candidatas a incorporar)](#8-gaps-detectados)
9. [Recomendaciones por área (15+ por área)](#9-recomendaciones-por-área)
10. [Roadmap de implementación priorizado](#10-roadmap-priorizado)
11. [Consideraciones de integración: Twenty CRM y Frappe/ERPNext](#11-consideraciones-de-integración)
12. [Lista consolidada de fuentes y URLs](#12-fuentes-y-urls)
13. [Notas sobre la investigación web (problemas y pendientes)](#13-notas-sobre-la-investigación-web)

---

## 1. Resumen ejecutivo

- Se investigaron **13 ERPs/CRMs** con fuentes oficiales (sitios web y documentación oficial): HubSpot, Salesforce, Zoho CRM, Pipedrive, Frappe CRM, Twenty CRM, Freshsales, Bitrix24, SuiteCRM, Kommo, GoHighLevel (HighLevel), Keap y EspoCRM. Odoo quedó **pendiente** (errores de transporte en la consulta; ver §13).
- **Hallazgo central:** la industria converge en 8 pilares: perfil 360° del cliente, pipelines visuales, scoring (reglas + IA), automatización de flujos (journeys/cadences), campañas masivas multi-canal, plantillas/mensajes predeterminados, agentes IA conversacionales y capa de datos/integraciones (API, webhooks, marketplaces).
- **Wibsite ya cubre una parte importante de esos pilares con un enfoque diferencial:** messaging nativo (WhatsApp/chat) + IA orquestada (Dify) + state machine conversacional + RAG + doble motor de scoring (reglas y LLM con razonamiento explicado). Ninguno de los 13 CRMs investigados combina estas cuatro capacidades de forma nativa y extensible por API.
- **Lo que la industria hace y Wibsite no (todavía):** deduplicación/merge avanzada, segmentos dinámicos, cadencias de follow-up ejecutables, tareas/calendario para agentes humanos, A/B testing en campañas, journeys de ciclo de vida, enriquecimiento de datos, BI/forecast, pagos/cotizaciones y app móvil.
- Se entregan **más de 100 recomendaciones** distribuidas en 7 áreas (campañas, contactos, leads, respuestas automáticas, agentes de ventas, datos/organización e integraciones), priorizadas P0–P3 y alineadas a las fases existentes (TEC-06, FASES-CRUZADAS).

---

## 2. Metodología y fuentes

- **Método:** revisión de sitios oficiales de producto, documentación oficial y páginas de funcionalidades de cada vendor (agosto 2026). Solo fuentes oficiales (dominios propios de cada producto). Se evitó contenido de terceros/bloggers.
- **Criterio de selección:** mezcla de CRMs de área de **tecnología/servicios** (Salesforce, HubSpot, Zoho, Twenty, Frappe) y de **ventas/mensajería** (Pipedrive, Kommo, GoHighLevel, Keap, Freshsales), más open source relevantes al stack actual (SuiteCRM, EspoCRM, Twenty, Frappe) — elegidos por compatibilidad con el stack self-hosted de Wibsite (PostgreSQL, Docker, API REST).
- **Áreas analizadas por CRM:** gestión de contactos/clientes; seguimientos y organización; campañas; mensajes predeterminados/plantillas; calificación de leads; respuestas automáticas/bots; agentes de ventas (sales engagement); datos e integraciones.
- **Cruce:** cada hallazgo se contrastó contra el estado real de Wibsite documentado en `wibsite/docs/tecnica/TEC-02-FUNCIONES-IMPLEMENTACION.md`, `wibsite/docs/context/*`, `wibsite/DATA-MASTER.md`, `wibsite/INDEX.md` y el frontend unificado (`wibsite/frontend/src/app/*`).

---

## 3. Cómo gestionan los ERPs/CRMs

### 3.1 Gestión de contactos y clientes

| Práctica de la industria | Ejemplos | Wibsite hoy |
|---|---|---|
| Perfil 360° (contacto + empresa + historial de interacciones) | HubSpot, Salesforce, Zoho, Twenty, EspoCRM | ✅ `buildLeadProfile` consolida store + Twenty + Redis + Chatwoot (G4) |
| Campos personalizados ilimitados / objetos custom | Twenty (Apps framework), EspoCRM (Entity Manager), Zoho (Module 360) | ✅ 10 campos custom en Twenty `people`; JSONB `custom_fields` |
| Import masivo CSV/Excel con mapeo de columnas | HubSpot, Zoho, Bitrix24, EspoCRM | ✅ Upload Excel/CSV con autodetección y dedup por teléfono (G3, probado >1000 filas) |
| Deduplicación/merge de duplicados | HubSpot (duplicate management), Pipedrive, Zoho | 🟡 Solo dedup por teléfono al importar; **no hay merge ni limpieza programada** |
| Segmentos/audiencias dinámicas (smart lists) | GoHighLevel (Smart Lists), Pipedrive (segmentación), HubSpot (lists) | 🟡 `audience_filter` JSONB estático; no hay listas calculadas en tiempo real |
| Enriquecimiento de datos (firma, industria, tamaño) | HubSpot Data Sync, Salesforce Data Cloud, Kommo | ❌ No existe |
| Empresas/accounts como entidad de primer nivel | Salesforce, HubSpot, Twenty (Companies), EspoCRM (Accounts) | ❌ Leads sueltos; Twenty `people` solo. Falta jerarquía contactos→empresas |
| Etiquetas/tags y grupos | Todos (Bitrix24, Keap, Kommo) | 🟡 `status`/`source` por lead; sin tags multi-etiqueta |

### 3.2 Seguimientos y organización

| Práctica de la industria | Ejemplos | Wibsite hoy |
|---|---|---|
| Pipelines kanban por etapa con drag & drop | Pipedrive (pionero), HubSpot, Freshsales, Bitrix24 | 🟡 Pipeline en frontend (`/pipeline`); motor de etapas ligado a scoring, sin pipelines múltiples por tipo de cliente |
| Tareas/actividades por contacto (llamada, email, nota) | HubSpot (Tasks & activities), Pipedrive (activity-based selling), EspoCRM | ❌ No existe módulo de tareas para agentes humanos |
| Cadencias de seguimiento (secuencias con pausas) | Zoho (cadences), Pipedrive, Freshsales, Keap (automation) | 🔴 Diseñado en CTX-04 (8 intentos, 6h-72h) pero sin motor ejecutable |
| Calendario/agenda integrado + reuniones | HubSpot (meeting scheduler), Bitrix24, Kommo (AI booking), EspoCRM (calendar) | ❌ No existe |
| Recordatorios y SLAs de respuesta | HubSpot, Freshsales, Kommo (auto-create follow-ups con deadline) | ❌ No existe (los follow-ups los genera el agente IA, no el sistema) |
| Vistas guardadas/filtros compartidos por equipo | Pipedrive, Frappe CRM (saved/public/pinned views), Twenty | 🟡 Filtros básicos en listas del frontend |
| Notas y stream de actividad por contacto | EspoCRM (Stream), HubSpot, Twenty (Notes) | 🟡 `audit_logs` + historial de scores; sin stream social por lead en UI |

### 3.3 Campañas

| Práctica de la industria | Ejemplos | Wibsite hoy |
|---|---|---|
| Broadcast multi-canal con estados de entrega | GoHighLevel (email/SMS/WhatsApp/Messenger), Kommo (WhatsApp broadcasting), Bitrix24 | ✅ Sistema completo: 5 canales, estados pending→replied/failed, tracking por webhook Meta (G3) |
| Campañas automatizadas por evento/condición (birthday, seasonal, reactivation) | GoHighLevel (birthday/seasonal campaigns), Keap (lifecycle) | 🟡 Programación por fecha (`scheduled_at`); **sin triggers por evento** |
| Segmentación de audiencia por reglas | Pipedrive, GoHighLevel, HubSpot | 🟡 `audience_filter` básico |
| A/B testing de mensajes | HubSpot, Pipedrive (email), Bitrix24 | ❌ No existe |
| Analytics de campaña (open/click/reply/ROI) | Pipedrive (email analytics), HubSpot, Bitrix24 | ✅ Stats auto-calculados (sent/delivered/read/replied/failed/opt_out) |
| Supresión/opt-out integrado y cumplimiento | Todos (CAN-SPAM/GDPR) | ✅ Opt-out + detección "STOP" en webhook (G3, con pendiente: bloqueo automático de envíos) |
| Campañas con contenido personalizado por lead | Dify `campaign-content-generator` (Wibsite) vs HubSpot (personalization tokens), Kommo | ✅ Personalización por lead vía LLM (máx 300 chars) + plantillas `{{variables}}` |
| HSM/templates aprobados por Meta | Kommo, Bitrix24 (integración WhatsApp) | 🟡 `template_name` en campañas + 11 plantillas default; **sin conexión Meta real** |
| Múltiples campañas concurrentes con colas/rate-limit | GoHighLevel, Kommo | 🟡 `channel_status` con rate-limit info; envío serial vía n8n (02) inactivo |

### 3.4 Mensajes predeterminados / plantillas

| Práctica de la industria | Ejemplos | Wibsite hoy |
|---|---|---|
| Biblioteca de plantillas por canal con variables | HubSpot (email templates), Pipedrive (Smart Docs), EspoCRM (email templates), Keap | ✅ 11 plantillas default en 5 canales + CRUD + preview con `{{variables}}` (G3) |
| Snippets/textos rápidos en el inbox | GoHighLevel (text snippets), Kommo (quick replies) | ❌ No hay snippets en el chat del frontend |
| Plantillas IA (generadas/curadas por AI) | HubSpot (AI content writer), Pipedrive (AI email writer), Keap (Keap AI) | 🟡 Dify `campaign-content-generator` genera contenido; sin "reescribir con IA" en editor |
| Mensajes de bienvenida/fuera de horario | Kommo, Bitrix24 (auto-reply), Freshsales | ❌ No configurado aún (diseño en CTX-04 §10) |
| Validación de longitud/cumplimiento por canal | Wibsite (max_length por canal) vs Kommo/Meta | ✅ Validación max_length por canal (G3) |

### 3.5 Calificación de leads

| Práctica de la industria | Ejemplos | Wibsite hoy |
|---|---|---|
| Scoring por reglas (puntos por atributo/acción) | HubSpot (contact scoring), Freshsales, Bitrix24 | ✅ Motor rule-based: 8 reglas + 5 factores, umbrales hot≥70/warm≥40 (G4) |
| Scoring predictivo/IA | Zoho (Zia), Salesforce (Einstein/Agentforce), Freshsales (Freddy intent scores), Bitrix24 (AI scoring) | 🟡 Scoring LLM vía OpenRouter con `{score, reason, category}`; falta comparación de precisión vs reglas y cache |
| Historial de score por lead (trazabilidad) | HubSpot, Freshsales | ✅ `lead_scores` con factores, modelo y reasoning (G4) |
| Routing/asignación automática por score o territorio | HubSpot, Freshsales, Bitrix24 (triggers), Kommo | 🔴 Diseñado (handoff HITL, triage CTX-03/04) sin motor de asignación |
| Definición de etapas de calificación (MQL/SQL/… | Todos | 🟡 Estados derivados del scoring; sin workflow explícito lead→oportunidad→deals |
| Recalificación automática por comportamiento | HubSpot, Freshsales | 🟡 `trigger-from-chatwoot` (+15 por reply del agente) y track de campaña (+10 si replied) |

### 3.6 Respuestas automáticas / bots

| Práctica de la industria | Ejemplos | Wibsite hoy |
|---|---|---|
| Chatbots de reglas (FAQ, captura de datos, reservas) | HubSpot (chatbot builder), Kommo (Salesbot), Bitrix24 (chat bots) | ✅ Classifier Dify 8 nodos LLM (idioma→intención→extracción→score→respuesta) — superior en IA, sin UI no-code |
| Agentes IA conversacionales (24/7, handoff humano) | Salesforce (Agentforce), HubSpot (Breeze/Agent Hub), Kommo (AI agent), HighLevel (Conversation AI) | 🟡 Estado actual: classifier + state machine 9 estados; **grafo comercial 8 etapas y multi-agente diseñados (CTX-04/05) sin implementar** |
| Respuestas con base de conocimiento (RAG) | Salesforce (Agentforce + Data Cloud), Intercom-style en GoHighLevel | ✅ RAG/Weaviate con fallback in-memory (G11); falta sincronización externa de productos/precios |
| Auto-respuesta fuera de horario | Kommo, Bitrix24 | ❌ No configurado |
| Detección de intención + extracción de datos estructurados | Kommo (AI), Freshsales (Freddy), Wibsite | ✅ 9 categorías de intención + 10 campos extraídos (G5) |
| Anti-alucinación / validación de respuestas IA | Salesforce (Trust Layer), Wibsite (módulo anti-hallucination) | ✅ Básico (validación post-respuesta); verificación contra KB pendiente |

### 3.7 Agentes de ventas (sales engagement)

| Práctica de la industria | Ejemplos | Wibsite hoy |
|---|---|---|
| Copiloto IA para el vendedor (resúmenes, próximos pasos, recomendaciones) | HubSpot Breeze, Pipedrive AI assistant, Kommo Copilot, Freshsales Freddy | 🟡 `GET /api/llm/chat` + lead profile; sin copiloto embebido en el chat |
| Propuestas/cotizaciones y documentos rastreables | Pipedrive (Smart Docs), Keap (invoices), GoHighLevel (estimates) | 🔴 Frappe/ERPNext lo traerá (G17, fase F2) |
| Pagos integrados (links, Text2Pay, facturación) | GoHighLevel (Text-2-Pay, invoicing), Keap (invoices/payments), Stripe en EspoCRM | 🔴 Diseñado (CTX-06, plan SaaS) sin implementar |
| Vistas de día/foco para el vendedor (qué hacer hoy) | Pipedrive (Focus View), Kommo (Copilot prioriza hot leads) | ❌ No existe |
| Métricas del agente humano (conversión, velocidad, actividades) | Pipedrive (Insights), Freshsales (deal recommendations), Bitrix24 (employee performance) | ❌ Solo KPIs de sistema (`/api/dashboard/summary`); sin métricas por vendedor |
| Multi-agente con roles (SDR/AE/CS) | Salesforce (Sales Engagement), HubSpot | 🔴 Topología multi-agente diseñada (CTX-04 §11) sin implementar |

### 3.8 Datos, organización e integraciones

| Práctica de la industria | Ejemplos | Wibsite hoy |
|---|---|---|
| API REST + webhooks abiertos | Todas (Pipedrive API, Twenty REST/GraphQL, EspoCRM API, SuiteCRM REST) | ✅ ~108 rutas en helper-node + webhooks Meta/Chatwoot/Twilio (G2/G8) |
| Marketplace de integraciones (500–5000 apps) | HubSpot (2000+), Pipedrive (500+), Zoho (1000+), Keap (5000+) | ❌ No hay marketplace; integraciones propias (Twenty, Dify, n8n, Chatwoot, Twilio) |
| Sincronización bidireccional con ERP/CRM externos | HubSpot Data Sync, Salesforce MuleSoft, Zoho | 🟡 Sync Twenty one-way (helper→Twenty); **bidireccionalidad y oportunidades pendientes** |
| BI/dashboards personalizados y forecast | Salesforce (Analytics), Bitrix24 (BI Builder), Pipedrive (forecasting), Zoho (Zia + BI) | 🟡 Dashboard KPIs + LEDs; sin BI avanzado (Metabase en roadmap SAAS_PLAN) |
| Permisos por rol/equipo/campo | Pipedrive (visibility), HubSpot (permission sets), Bitrix24, Salesforce | 🟡 Authelia SSO de borde + `x-tenant-id`; sin RBAC granular por registro |
| Multi-tenant y planes SaaS | — (solo Salesforce/HubSpot a nivel enterprise) | ✅ Diseño completo platform_tenants/branches/plans (DATA-MASTER) sin migración real |
| Auditoría y cumplimiento (logs, GDPR, retención) | Salesforce (Audit), EspoCRM (data privacy), Bitrix24 | ✅ `audit_logs` + security_rules (23 patrones sanitizer) + retención diseñada |
| Migración desde otros CRMs | Todos (importadores y servicios) | 🟡 Import CSV/Excel; sin mapeo desde CRMs externos |

---

## 4. Fichas por ERP/CRM investigado

### 4.1 HubSpot CRM — `hubspot.com/products/crm`
- **Tipo:** SaaS propietario (gratis + 3 tiers). 306.000+ clientes.
- **Puntos fuertes:** CRM gratis robusto (contactos, deals, tareas, pipeline, reporting); Breeze Assistant (IA); AI customer agent; chatbot builder; shared inbox; contact scoring (Professional+); duplicate management; 2.000+ integraciones; data sync bidireccional; forms/landing pages/email marketing incluidos.
- **Relevante para Wibsite:** modelo "free tier que escala", scoring estándar, duplicate management, AI content writer, email templates con IA, meeting scheduler.

### 4.2 Salesforce (Sales Cloud) — `salesforce.com/crm`
- **Tipo:** SaaS propietario enterprise. Líder Gartner.
- **Puntos fuertes:** plataforma integrada (Sales/Service/Marketing/Commerce/Data), Agentforce (agentes IA), 360° del cliente, CRM+Slack, analytics y forecasting, MuleSoft para integraciones, AgentExchange, industrializaciones por vertical.
- **Relevante para Wibsite:** "CRM como plataforma" (objetos custom, permission sets, fields-level security), agentic AI con handoff humano, forecast, SSO/enterprise features.

### 4.3 Zoho CRM — `zoho.com/crm`
- **Tipo:** SaaS propietario (gratis 3 usuarios + ediciones). 300.000+ empresas.
- **Puntos fuertes:** Zia (IA predictiva: scoring, anomalías, reescritura), agentes IA multi-rol, blueprints de proceso, cadences, journey orchestration, CPQ, Canvas (diseño por IA), Module 360, 1.000+ integraciones, BI predictiva, Bigin para pymes.
- **Relevante para Wibsite:** blueprints de proceso (equivalente a state machine de negocio), cadences, CPQ, agente IA de ventas.

### 4.4 Pipedrive — `pipedrive.com`
- **Tipo:** SaaS propietario. Activity-based selling (pionero de pipelines).
- **Puntos fuertes:** pipeline visual simple y adoptable, leads inbox, automatización de actividades, AI sales assistant y AI email writer, Smart Docs (propuestas rastreables), email marketing add-on con analytics/segmentación, Web Visitors, 500+ integraciones, Focus View, mobile app.
- **Relevante para Wibsite:** simplicidad de pipeline, "actividades como unidad de venta" (idea para tareas), Focus View, smart docs.

### 4.5 Frappe CRM (ecosistema Frappe/ERPNext) — `frappe.io/crm`
- **Tipo:** Open source (AGPL) sobre Frappe Framework; hosting desde $5/mes usuarios ilimitados.
- **Puntos fuertes:** leads, contactos, deals y organizaciones; integración WhatsApp nativa; sync automático de leads de Facebook/Instagram (Meta); workflow automation (asignación de leads, follow-ups); vistas guardadas/públicas; framework con data models extensibles por código; misma base para ERPNext (facturación, inventario, órdenes).
- **Relevante para Wibsite:** es la pieza ERP objetivo (G17): sync Twenty→Frappe, verificación de facturas, plantillas de negocio; su WhatsApp integration es prueba de mercado para la propuesta Wibsite.

### 4.6 Twenty CRM — `twenty.com`
- **Tipo:** Open source (self-hosted o cloud $9–19/user/mes). #1 open source CRM en GitHub.
- **Puntos fuertes:** objetos/views/fields custom sin límites desde Settings; Apps framework (TypeScript: objects, server logic, React components, AI skills) con `npx create-twenty-app`; workflows no-code; MCP server nativo (IA puede leer/escribir el CRM); 50.000+ registros vía API; migración desde Salesforce/HubSpot.
- **Relevante para Wibsite:** **CRM objetivo ya operativo en el stack** (sync implementado, 10 campos custom en `people`); sus workflows/MCP son la vía para cerrar la bidireccionalidad (G7) sin código propio.

### 4.7 Freshsales (Freshworks) — `freshworks.com/crm/sales`
- **Tipo:** SaaS propietario. 74.000+ negocios.
- **Puntos fuertes:** Freddy AI (intent scores, deal recommendations, AI email), kanban drag & drop, 360° view multi-canal, campañas de venta con captura/calificación/routing, automatización de tareas repetitivas, suite integrada con soporte.
- **Relevante para Wibsite:** intent scores (equivalente a nuestro classifier), routing de leads por calificación, deal recommendations.

### 4.8 Bitrix24 — `bitrix24.com`
- **Tipo:** SaaS + on-premise (freemium fuerte). Más de 15M de usuarios.
- **Puntos fuertes:** CRM + colaboración (chat, videollamadas, tareas, calendarios, documentos), contact center omnicanal (forms, widget, WhatsApp/Instagram, telefonía), reglas/triggers para mover leads/deals, funnels automatizados, BI Builder, CoPilot IA (transcripción de llamadas, autocompletado de campos, scoring), market 770+ apps.
- **Relevante para Wibsite:** contact center omnicanal → lead automático; triggers por estado; CoPilot (transcripción llamadas → campos); BI builder.

### 4.9 SuiteCRM — `suitecrm.com`
- **Tipo:** Open source (GPL, fork de SugarCRM). #1 open source según Forbes.
- **Puntos fuertes:** 360° del cliente, leads/oportunidades/cotizaciones, email marketing con segmentación automatizada, casos/portal/soporte, knowledge base, workflow, REST API abierta, plugins (Outlook, Xero, WhatsApp, Mautic, DocuSign…), SuiteAssured (garantías enterprise).
- **Relevante para Wibsite:** modelo open source con soporte comercial; Mautic (marketing automation OSS) como referencia para jornadas.

### 4.10 Kommo — `kommo.com`
- **Tipo:** SaaS propietario (ex-amoCRM). **CRM nativo de WhatsApp/mensajeros** (partner Meta). 100.000+ clientes.
- **Puntos fuertes:** pipeline en vista de tablero, unified inbox de chats (WhatsApp, Instagram, TikTok, Telegram, FB), Salesbot (chatbots sin código), AI agent (califica y responde 24/7), AI booking (citas con IA), Copilot (prioriza hot leads, crea follow-ups con deadline desde chats), broadcast WhatsApp, QR/link generators, detección de anuncios que convierten.
- **Relevante para Wibsite:** **competidor directo más cercano.** Su flujo chat→lead→pipeline→booking→pago valida el modelo de Wibsite; su "auto-create follow-up tasks desde chat" es una función a replicar.

### 4.11 GoHighLevel / HighLevel — `gohighlevel.com`
- **Tipo:** SaaS propietario orientado a agencias (multi-tenant por sub-cuentas).
- **Puntos fuertes:** sistema operativo de negocio: CRM + funnel/landing pages + forms/quizzes + webinars; consolidated conversation stream (SMS, Messenger, IG DM, WhatsApp, livechat); workflows/automations; Conversation AI; Voice AI (llamadas IA); Smart Lists/segmentación; broadcast campaigns (email/SMS/WhatsApp/Messenger) con birthday/seasonal automáticas; lead scoring; estimates/invoicing/payments (Text2Pay); reputation management; 7,3B+ leads generados.
- **Relevante para Wibsite:** **referencia de producto para campañas + seguimiento + pagos en una sola plataforma**; sus "campaigns reactivation templates" y "automated birthday/seasonal campaigns" son features claras a añadir.

### 4.12 Keap — `keap.com`
- **Tipo:** SaaS propietario (ex-Infusionsoft, hoy Thryv). 200.000+ pymes.
- **Puntos fuertes:** marketing automation "when→then" drag & drop, lifecycle automation, lead capture/cualificación, email + text marketing en automatizaciones, sales pipeline, appointments, invoices/payments, Proven Automation Templates, Keap AI, 5.000+ integraciones.
- **Relevante para Wibsite:** modelo "when/then" para el motor de automatización (simple y potente); Proven Automation Templates (plantillas de campaña listas); lifecycle stages.

### 4.13 EspoCRM — `espocrm.com/features`
- **Tipo:** Open source (AGPL, self-hosted/cloud).
- **Puntos fuertes:** leads/oportunidades/accounts/contactos; email sync + templates + mass email; web-to-lead; campaigns; BPM visual + workflows; Entity Manager (entidades custom); dynamic logic; formulas; roles/teams; VoIP; portal de cliente; KB; Stripe; reports (extensiones).
- **Relevante para Wibsite:** BPM visual (orquestación de procesos) y Portal de cliente (autoservicio) como features candidatas; similitud con Dify para flujos.

### 4.14 Odoo CRM — `odoo.com/app/crm` (PENDIENTE)
- **Estado:** 3 intentos de consulta fallidos por error de transporte (bloqueo temporal del sitio). Pendiente de investigación formal; ver §13.

---

## 5. Estado real del sistema Wibsite

> Validado contra: `docs/tecnica/TEC-02-FUNCIONES-IMPLEMENTACION.md`, `docs/context/*.md`, `docs/maestro/MAESTRO-FUNCIONALIDADES-CORE.md`, `DATA-MASTER.md`, `INDEX.md` y el frontend unificado `frontend/src/app/*` (Next.js).

### 5.1 Arquitectura (20 servicios)
helper-node (núcleo de integración, ~108 rutas) · n8n (orquestación) · Chatwoot (inbox omnicanal) · Dify 1.15 (IA, solo plugins, OpenRouter) · Twenty CRM (3001) · Authelia (SSO) · Nginx (proxy + auth) · PostgreSQL · Redis · Weaviate (RAG) · Elasticsearch + Kibana + OTel Collector (observabilidad) · MinIO · Twilio bridge · plugin-daemon · frontend Next.js unificado.

### 5.2 Frontend unificado (Next.js) — páginas activas
`/dashboard` (KPIs + LEDs de canales) · `/chat` (inbox) · `/campaigns` · `/leads` · `/pipeline` · `/automation` · `/reports` · `/templates` · `/settings`. **Confirmación del enunciado del usuario:** el chatbot y Dify (como módulos independientes) se consolidaron en este frontend unificado; el chat es el módulo activo central.

### 5.3 Funcionalidades activas y validadas (resumen G1–G18)
| Grupo | Estado | Detalle clave |
|---|---|---|
| G1 Infraestructura | ✅ | 20 servicios con health checks |
| G2 Helper-node | ✅ | auth X-API-Key, rate-limit, sanitizer 23 patrones, HMAC, SLI; 112 tests |
| G3 Campañas | ✅ (mayoría) | CRUD, ciclo draft→scheduled→sending→active⇄paused→completed/cancelled/failed; tracking por webhook; upload Excel; plantillas; opt-out 🟡 |
| G4 Leads/scoring | ✅ | 8 reglas + 5 factores; hot≥70/warm≥40; scoring LLM 🟡; perfil unificado; trigger Chatwoot |
| G5 IA/Dify | ✅ classifier | 8 nodos LLM; 9 intenciones; 10 campos extraídos; OpenRouter 7 modelos; multi-agente 🔴 |
| G6 n8n | 🟡 | Inbound activo vía SQL sin credenciales; Broadcast 🔴 inactivo; nurturing 🔴 |
| G7 Twenty | ✅ sync one-way | 10 campos custom; sync individual + masivo (12/12); bidireccional 🔴 |
| G8 Canales/webhooks | 🟡 | Meta/Twilio código listo sin credenciales reales; LEDs de canales ✅ |
| G9 Seguridad | 🟡 | Authelia borde; hardening pendiente |
| G10 Memoria | ✅ | State machine 9 estados en Redis (TTL 7d) con transiciones validadas |
| G11 RAG | ✅ básico | Weaviate + fallback in-memory; multi-tenant por header |
| G12 Config agente | ✅ v1 | business types (10), personalidades (5), system prompt |
| G13 UX/Dashboard | ✅ | SPA 5 tabs + frontend Next.js unificado |
| G14 Observabilidad | ✅ básico | /health enriquecido, SLI, dashboard summary; Prometheus/Grafana pendiente |
| G15 Vendedor IA | 🔴 | Diseño completo (8 etapas, objeciones, temperatura, handoff, SPICED/MEDDIC) |
| G16 Plantillas negocio | 🔴 | Esquema 3 capas + 1 plantilla poblada; motor pendiente |
| G17 ERP/Copilot | 🔴 | Frappe/ERPNext fase F2; Lumi Copilot fase F3 |
| G18 Multi-tenant | 🔴 | Diseño 4 niveles + DDL; migración JSON→PG pendiente |

### 5.4 Modelo de datos actual (DATA-MASTER §2)
Entidades: `platform_tenants`, `platform_branches`, `platform_users`, `platform_plans`, `campaigns`, `deliveries`, `leads`, `lead_scores`, `conversations` (state machine), `messages`, `kb_documents`, `opt_outs`, `audit_logs`, `agent_configs`, `security_rules`. Almacenamiento: PostgreSQL primario con **fallback JSON store** en helper (deuda conocida: migración JSON→PG es OT-02/OT-10 en TEC-03).

### 5.5 Integraciones pendientes (según el enunciado del usuario)
- **Twenty CRM:** hay sync unidireccional (helper→Twenty) con API key JWT funcional, PERO no hay integración completa: sin webhook Twenty→helper, sin sync de oportunidades/deals, sin pipelines por tipo de cliente.
- **Frappe/ERPNext:** sin integración alguna (solo diseño CTX-03 y scripts de prueba en la raíz del repo: `twenty-*.js`, `import_n8n_workflows.py`, etc.). No cuenta como funcionalidad actual.

---

## 6. Análisis cruzado

### 6.1 Matriz de cobertura: industria estándar vs Wibsite actual

| Capacidad | HubSpot | Salesforce | Zoho | Pipedrive | Frappe | Twenty | Freshsales | Bitrix24 | SuiteCRM | Kommo | GHL | Keap | EspoCRM | **Wibsite hoy** |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Perfil 360° contacto | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 (lead profile, sin empresa) |
| Pipeline kanban | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 |
| Tareas/actividades | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Cadences/follow-up | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔴 (diseño) |
| Campañas masivas | ✅ | ✅ | ✅ | ✅ | 🟡 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (5 canales) |
| Mensajería/chat nativo | ✅ | ✅ | 🟡 | 🟡 | ✅ | ❌ | ✅ | ✅ | 🟡 | ✅ | ✅ | 🟡 | 🟡 | ✅ (Chatwoot) |
| WhatsApp Business | 🟡 | 🟡 | 🟡 | ❌ | ✅ | ❌ | 🟡 | ✅ | 🟡 | ✅ | ✅ | 🟡 | 🟡 | 🟡 (código, sin Meta) |
| Scoring reglas | ✅ | ✅ | ✅ | 🟡 | 🟡 | ❌ | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 | 🟡 | ✅ |
| Scoring IA | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | 🟡 | ❌ | 🟡 (LLM sin comparar) |
| Bot/agente IA chat | ✅ | ✅ | ✅ | 🟡 | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | 🟡 | ❌ | ✅ (classifier) + 🔴 (grafo) |
| RAG/KB en chat | 🟡 | ✅ | 🟡 | ❌ | ❌ | ❌ | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | ✅ (KB) | ✅ (Weaviate) |
| State machine conversacional | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (9 estados) |
| Automatización no-code | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | 🟡 (n8n manual) |
| Dedup/merge | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | ❌ |
| Segmentos dinámicos | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | 🟡 | ❌ |
| BI/forecast | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | 🟡 (básico) |
| Pagos/cotizaciones | ✅ | ✅ | ✅ | ✅ | ✅(ERP) | ❌ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ❌ (F2) |
| Multi-tenant SaaS | 🟡 | ✅ | 🟡 | ❌ | 🟡 | 🟡 | ❌ | 🟡 | ❌ | ❌ | ✅ | ❌ | ❌ | 🔴 (diseño) |
| API/webhooks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Integraciones externas | 2000+ | MuleSoft | 1000+ | 500+ | (framework) | MCP | ✅ | 770+ | ✅ | ✅ | ✅ | 5000+ | ✅ | Twenty/Dify/n8n/Cha |

**Lectura de la matriz:** Wibsite no compite como "CRM generalista" (le faltan tareas, dedup, BI, pagos) pero **supera a los 13 en lo conversacional**: state machine, classifier integrado al inbound, RAG y doble scoring. Es un **CRM conversacional/messaging-first**, donde Kommo es el único competidor directo y GoHighLevel el referente de producto completo.

### 6.2 Posicionamiento recomendado
- **Corto plazo (hoy):** consolidar messaging-first + campañas WhatsApp como diferencial ("CRM conversacional para venta por WhatsApp con IA").
- **Medio plazo:** cerrar los pilares que la industria da por hecho (dedup, segmentos, tareas, cadences, BI) para no perder adopción.
- **Largo plazo:** convertir el stack en plataforma (Twenty como CRM operativo, Frappe como ERP, agentes IA propios) replicando el modelo "HubSpot de WhatsApp" con self-hosting (control de datos) como ventaja frente a Kommo/GHL.

---

## 7. Funcionalidades DESTACADAS de Wibsite que la industria NO hace

> Respuesta directa a: "¿cuáles son las que tenemos destacadas que no hacen dichos [CRMs]?"

1. **State machine conversacional de 9 estados con transiciones validadas** (Redis, TTL 7d, catálogo API). Ningún CRM investigado expone una máquina de estados de conversación configurable y auditable: ellos usan pipelines de deals, no estados de conversación.
2. **Doble motor de scoring con razonamiento explicado:** reglas (8+5) Y LLM con `{score, reason, category}`. HubSpot/Zoho dan scoring IA, pero sin "por qué" exportable por API; Freshsales da intent scores sin trazabilidad de factores.
3. **Classifier de leads multi-nodo integrado al inbound en tiempo real** (8 nodos LLM: idioma→intención→extracción 10 campos→score→respuesta) que alimenta el perfil unificado. Kommo tiene AI agent, pero no expone la extracción estructurada ni la cadena de nodos.
4. **RAG/Knowledge Base propia (Weaviate) acoplada al agente** con chunking y multi-tenant por header — la mayoría usa KB propietaria cerrada (Salesforce) o no la tiene (Pipedrive, Twenty, Frappe).
5. **Arquitectura de plantillas por rubro/negocio en 3 capas** (núcleo/plantilla/config por cliente) con switcher de contexto (CTX-05): "un agente por vertical" — ningún CRM investigado ofrece esto (los CRMs son genéricos).
6. **Lógica de vendedor IA formalizada** (8 etapas, 8 objeciones, temperatura por señales, cadencia de 8 intentos, handoff HITL con 12 campos, SPICED/MEDDIC/PIPC/Bowtie/KAM): diseño de dominio profundo, ausente en la industria (sus "agents" son genéricos).
7. **Opt-out "STOP" automático + capa de seguridad en mensajes** (sanitizer 23 patrones, HMAC Meta/Chatwoot, anti-inyección) — los CRMs comerciales delegan esto al canal.
8. **Observabilidad de canales en vivo (LEDs de estado + rate-limit) y SLI internos** expuestos en dashboard — solo Bitrix24/Salesforce tienen algo parecido, y cerrado.
9. **Stack 100% self-hosted con SSO unificado (Authelia)** y 20 servicios propios: soberanía de datos total (ventaja vs Kommo/GHL/Keap SaaS).
10. **Dashboard unificado que cruza campañas + scoring + canales + Twenty sync** en una SPA — la mayoría separa CRM y marketing.
11. **Sync a Twenty con campos metodológicos** (painPoints, interests, scoreHistory, leadOrigin) — aproximación a un "CRM del vendedor IA" que la industria no tiene.
12. **Motor de campañas con personalización LLM por lead** (Dify content-generator, máx 300 chars) en el canal WhatsApp con tracking end-to-end de entrega (pending→replied) — Kommo broadcasta sin scoring previo por lead.

---

## 8. Gaps detectados

> Funcionalidades estándar en los 13 CRMs que Wibsite aún no tiene (candidatas a incorporar).

1. Deduplicación y merge de contactos (con programación y reglas).
2. Segmentos/audiencias dinámicas (smart lists) para campañas.
3. Tareas/actividades + calendario + recordatorios para agentes humanos.
4. Motor de cadencias de follow-up ejecutable (el diseño CTX-04 existe).
5. A/B testing en campañas.
6. Journeys/lifecycle automation (when→then tipo Keap/GoHighLevel).
7. Enriquecimiento de datos de contacto (firma, industria, redes).
8. BI/reporting avanzado + forecast + dashboards por vendedor.
9. Pagos/cotizaciones/CPQ (viene con Frappe, G17).
10. App móvil / PWA.
11. Reservas/agendamiento con IA (Kommo AI booking).
12. Vistas por vendedor ("qué hacer hoy" / Focus View).
13. Copiloto IA embebido en el chat (resúmenes, próximos pasos, reescritura).
14. Portal de autoservicio del cliente (EspoCRM Portal, SuiteCRM portal).
15. Marketplace de integraciones / plantillas de campaña pre-hechas (Keap Proven Templates).
16. Reputation/reviews management (GoHighLevel) — relevante para el rubro local.

---

## 9. Recomendaciones por área

> Cada área contiene 15 recomendaciones. Prioridad sugerida: P0 = base para las demás; P1 = alto impacto; P2 = mejora; P3 = diferenciador.

### 9.1 Campañas (15)

| # | Recomendación | Detalle / referencia de industria | Prioridad |
|---|---|---|---|
| C1 | **Bloquear envíos a leads opt-out de forma automática** (hoy solo marca `opted_out`) | Requisito de cumplimiento; GoHighLevel/Bitrix24 lo hacen a nivel de motor | **P0** |
| C2 | **Conectar Meta WhatsApp real** (META_APP_ID + PHONE_ID) y activar workflow 02 de n8n para envío automático de programadas | Cierre del flujo broadcast (CAMPAIGNS.md ❌ actual) | **P0** |
| C3 | **Segmentos dinámicos como fuente de audiencia** (listas calculadas por reglas: score≥X, último contacto >Y días, canal preferido) | GoHighLevel Smart Lists, HubSpot lists | **P0** |
| C4 | **Campañas reactivación/abandono automáticas** (leads con score≥warm que no respondieron en N días) | GoHighLevel database reactivation templates | P1 |
| C5 | **A/B testing de plantilla/CTA por segmento de la audiencia** | HubSpot/Pipedrive email A/B | P1 |
| C6 | **Campañas por evento (birthday, aniversario de compra, post-compra N días)** | GoHighLevel automated birthday/seasonal campaigns | P1 |
| C7 | **Plantillas de campaña pre-armadas por rubro (vendedor de pollo/avícola, retail, servicios)** | Keap Proven Automation Templates + arquitectura CTX-05 | P1 |
| C8 | **Rate-limit inteligente por canal con backoff y re-intentos** (hoy solo informa) | Kommo/Bitrix24 envíos escalonados | P1 |
| C9 | **Cancelación/programación de campaña con confirmación visual y dry-run** (simular audiencia y costo antes de enviar) | Bitrix24 funnels, Frappe CRM | P2 |
| C10 | **Reporte por campaña con ROI/atribución** (campaña→leads→oportunidades→ventas) enlazado a Twenty/Frappe | Pipedrive email analytics, Salesforce | P2 |
| C11 | **Zonas horarias por lead** (enviar a la hora local de cada contacto) | Estándar en email marketing; clave en WhatsApp | P2 |
| C12 | **Plantillas por canal con variables validadas por el canal** (WhatsApp HSM aprobado vs session) | Meta Business Platform + 11 plantillas actuales | P2 |
| C13 | **Colas de campaña multi-tenant con prioridad por plan** | Diseño OPS (plans en DDL) | P3 |
| C14 | **Webhook de eventos de campaña hacia el cliente** (estado, entrega, reply) | Twenty webhooks, Frappe events | P3 |
| C15 | **Auditoría completa de campaña** (quién creó, modificó, envió, costos por mensaje) | Salesforce audit trail, `audit_logs` existente | P3 |

### 9.2 Gestión de contactos (15)

| # | Recomendación | Detalle / referencia | Prioridad |
|---|---|---|---|
| K1 | **Deduplicación con merge programada** (por teléfono+email+nombre, con reglas de ganador de campos) | HubSpot duplicate management | **P0** |
| K2 | **Entidad `companies`/empresas de primer nivel** (lead→contacto→empresa) y relación en Twenty | Salesforce/EspoCRM Accounts; Twenty Companies ya existe | **P0** |
| K3 | **Enriquecimiento de datos opcional** (industria, tamaño, redes vía API externa; con permiso) | HubSpot Data Sync, Salesforce Data Cloud | P1 |
| K4 | **Tags/etiquetas multi-valor + colores por lead** | Bitrix24, Keap | P1 |
| K5 | **Perfil 360° en UI del frontend** (unificar lead + conversación + scores + Twenty en una sola vista; hoy está en API `buildLeadProfile`) | HubSpot/EspoCRM record view | P1 |
| K6 | **Favoritos y notas rápidas por contacto** | Pipedrive, Twenty Notes | P1 |
| K7 | **Historial de interacciones en línea de tiempo por contacto** (mensajes, campañas, scores, cambios de estado) | EspoCRM Stream, HubSpot timeline | P1 |
| K8 | **Import/export CSV/Excel bidireccional con mapeo guardado** (perfiles de import reutilizables) | HubSpot import, Zoho migration | P2 |
| K9 | **Normalización de teléfonos a nivel de base** (hoy solo en sync a Twenty) | Estándar | P2 |
| K10 | **Campos custom por tenant desde UI** (admin configura sus propios campos; hoy JSONB en código) | EspoCRM Entity Manager, Zoho Module 360 | P2 |
| K11 | **Vistas guardadas/compartidas por equipo** | Frappe CRM saved views, Twenty views | P2 |
| K12 | **Segmentos manuales (listas fijas) además de dinámicos** | HubSpot static lists | P2 |
| K13 | **Contactos duplicados detectados en vivo al escribir** (sugerencia al agente) | Pipedrive, HubSpot | P3 |
| K14 | **Asignación de propietario/responsable a cada contacto** y filtros por propietario | Estándar CRM | P3 |
| K15 | **Borrado lógico con retención y GDPR** (right-to-be-forgotten) | EspoCRM data privacy | P3 |

### 9.3 Calificación de leads (15)

| # | Recomendación | Detalle / referencia | Prioridad |
|---|---|---|---|
| L1 | **Comparar precisión del scoring LLM vs reglas y crear caché de resultados** (hoy sin validación) | TEC-02 G4 pendiente explícito | **P0** |
| L2 | **Recalificación automática periódica** (job diario que re-evalúa todos los leads con reglas nuevas) | HubSpot recency scoring | **P0** |
| L3 | **Routing/asignación automática por score y canal** (hot→agente X, warm→cola, cold→nurturing) | Freshsales routing, Bitrix24 triggers | **P0** |
| L4 | **Workflow explícito lead→oportunidad→deals** con conversión (en Twenty) y campos SPICED/MEDDIC | CTX-03 ya diseñado; Salesforce opportunity | P1 |
| L5 | **Score decay (decadencia) por inactividad** | HubSpot time-decay | P1 |
| L6 | **Ponderación de intención de compra específica por rubro** (plantilla de negocio define reglas; CTX-05) | Diferenciador propio | P1 |
| L7 | **Fuentes de lead con atribución** (campaña, canal, QR, referencia) y reporte de mejores fuentes | Pipedrive lead generation, Kommo ad attribution | P1 |
| L8 | **Explicación del score visible al agente en UI** (factores desglosados) | Freshsales intent scores explicados | P1 |
| L9 | **Alertas de lead caliente en tiempo real** (webhook/notificación al agente al cruzar umbral) | Kommo Copilot hot leads | P2 |
| L10 | **SLA de respuesta por categoría de lead** (hot: <5 min; warm: <2h) y alerta por incumplimiento | Estándar sales ops | P2 |
| L11 | **Pruebas A/B del modelo de scoring** (reglas vs LLM en cohortes) | Zoho Zia evaluación | P2 |
| L12 | **Inclusión de señales de campaña en el score** (click en enlace +15 ya existe; añadir apertura de catálogo, tiempo de lectura) | GoHighLevel lead scoring | P2 |
| L13 | **Umbrales configurables por tenant/plan** | HubSpot properties | P2 |
| L14 | **Feedback del agente sobre la calidad del score** (thumbs up/down → reentrenamiento) | Freshsales Freddy feedback | P3 |
| L15 | **Predicción de conversión (probabilidad %) con historial** | Salesforce Einstein, Zia predictive | P3 |

### 9.4 Respuestas automáticas (15)

| # | Recomendación | Detalle / referencia | Prioridad |
|---|---|---|---|
| R1 | **Mensaje de bienvenida + fuera de horario configurable por tenant** | Kommo, Bitrix24 auto-reply | **P0** |
| R2 | **Implementar grafo comercial de 8 etapas** (G15) sobre la state machine existente | Diseño CTX-04 §4-6, ROAD 5.2 | **P0** |
| R3 | **Verificación anti-alucinación contra KB** (validar respuesta con Weaviate antes de enviar) | TEC-02 G5 pendiente | **P0** |
| R4 | **Respuestas rápidas/snippets del agente humano en el chat** | GoHighLevel text snippets, Kommo quick replies | P1 |
| R5 | **Agentes múltiples por rol (router→extractor→scoring→conversacional)** con fallback | Topología CTX-04 §11 | P1 |
| R6 | **Regla de "si el cliente pide humano → handoff inmediato"** configurable y medible | Kommo/Salesforce human handoff | P1 |
| R7 | **Sincronización externa de la KB** (productos, precios, horarios desde fuente del negocio) | TEC-02 G11 pendiente; GoHighLevel KB | P1 |
| R8 | **Límites de intentos y escalamiento de canal** (WhatsApp→llamada) | CTX-04 cadencia 8 intentos | P1 |
| R9 | **Mensajes con plantillas dinámicas por estado de la conversación** (estado X → plantilla Y) | EspoCRM workflows, Dify | P2 |
| R10 | **Detección de idioma y respuesta en el idioma del cliente** (ya existe en classifier; exponer como feature) | Dify detect_language | P2 |
| R11 | **Análisis de sentimiento por conversación y tendencia** (campo `sentiment_trajectory` ya existe en el modelo) | HubSpot sentiment, modelo Wibsite | P2 |
| R12 | **Autorespuestas a comandos** (STOP, MENU, HORARIOS, PRECIO) con plantillas rápidas | Estándar WhatsApp Business | P2 |
| R13 | **Contenido multimedia en respuestas automáticas** (catálogo, imágenes de producto) | WhatsApp Business catalogs | P2 |
| R14 | **Consentimiento explícito y registro de opt-in por lead** (doble registro para campañas) | GoHighLevel/GDPR | P3 |
| R15 | **Pruebas de conversación (simulador de cliente) antes de publicar un agente** | Dify playground + e2e existentes | P3 |

### 9.5 Agentes de ventas (15)

| # | Recomendación | Detalle / referencia | Prioridad |
|---|---|---|---|
| A1 | **Copiloto IA en el chat del agente humano** (resumen de conversación, sugerencia de respuesta, datos del perfil) | HubSpot Breeze, Kommo Copilot | **P0** |
| A2 | **Motor de cadencias ejecutable** (secuencia de follow-ups con pausas, plantillas y escalación) sobre n8n/helper | CTX-04 §6 + Zoho cadences | **P0** |
| A3 | **Tareas y "qué hacer hoy" por vendedor** (colas de follow-up por lead y deadline) | Pipedrive Focus View | **P0** |
| A4 | **Métricas por agente humano** (conversaciones, respuestas, conversión, tiempo de primera respuesta) | Bitrix24 employee performance | P1 |
| A5 | **Handoff HITL con contexto completo** (12 campos del diseño; nota IA incluida) | CTX-04 §7 | P1 |
| A6 | **Asignación round-robin / por habilidad / por score** de conversaciones nuevas | Freshsales routing | P1 |
| A7 | **Resúmenes post-conversación automáticos** (para CRM y para el siguiente agente) | Salesforce Agentforce, Dify | P1 |
| A8 | **Agendamiento de citas con IA** (links de reserva en el chat) | Kommo AI booking, HubSpot scheduler | P1 |
| A9 | **Recomendación de próximo mejor paso** (based on estado + score + historia) | Pipedrive AI assistant, Freddy | P2 |
| A10 | **Guiado de metodología de venta en el chat** (checklist SPICED/MEDDIC según etapa) | CTX-04 §8 | P2 |
| A11 | **Propuestas/cotizaciones desde el chat** (cuando Frappe esté: generar cotización y enviar link) | G17 F2, Pipedrive Smart Docs | P2 |
| A12 | **Entrenamiento del agente IA por conversaciones exitosas** (dataset de wins para prompt) | Kommo AI learning | P2 |
| A13 | **Panel de rendimiento comparativo entre vendedores** (leaderboard) | Bitrix24 BI | P3 |
| A14 | **Grabación y análisis de llamadas** (si se integra voz) | Bitrix24 CoPilot transcription | P3 |
| A15 | **Gamificación** (metas semanales, badges por conversión) | Pipedrive goals | P3 |

### 9.6 Organización, optimización y gestión de datos (15)

| # | Recomendación | Detalle / referencia | Prioridad |
|---|---|---|---|
| D1 | **Migración completa JSON→PostgreSQL** (OT-02) y eliminación del fallback JSON store | DATA-MASTER §10, TEC-03 | **P0** |
| D2 | **Índices y PK/FK reales en tablas de campañas** (hoy JSON store) + revisiones DATABASE-VALIDATION | DATABASE-VALIDATION.md | **P0** |
| D3 | **Pipeline múltiple por tipo de cliente** (B2C WhatsApp / B2B / retail) en Twenty y en el frontend | CTX-03 §4, Pipedrive | **P0** |
| D4 | **RBAC granular** (roles por tenant: admin, agente, lector; permisos por registro y campo) | Pipedrive visibility, HubSpot permission sets | P1 |
| D5 | **Data warehouse ligero + BI** (Metabase según roadmap SAAS_PLAN; modelos desde `deliveries`, `lead_scores`, `messages`) | Bitrix24 BI Builder | P1 |
| D6 | **Retención y archivado automático** (TTL por tipo de dato, particionado por fecha) | DATA-MASTER §7 | P1 |
| D7 | **Backup automatizado con pruebas de restauración** (pg_dump + Weaviate + Redis RDB, ya definido) | CHECKLIST-MANTENIMIENTO | P1 |
| D8 | **Reporte de salud de datos** (huérfanos, duplicados, campos vacíos, opt-outs sin canal) | Salesforce data quality | P1 |
| D9 | **Normalización de datos en ingreso** (teléfono, email, mayúsculas, espacios) vía sanitizer | Extender sanitizer 23 patrones | P2 |
| D10 | **Métricas y SLIs de datos** (volumen por tenant, crecimiento, latencia de sync) | G14 + OTel | P2 |
| D11 | **Diseño de esquema para `conversations` en PG** (hoy Redis con TTL; archivar a PG con particionado) | DATA-MASTER §4 | P2 |
| D12 | **Anonimización/pseudonimización por tenant para pruebas y demo** | EspoCRM privacy, plan Demo | P2 |
| D13 | **Import/export masivo con jobs asíncronos y notificación** (cola Bull) | HubSpot import jobs | P3 |
| D14 | **Catálogo de datos (data dictionary) navegable en el hub** | Buenas prácticas | P3 |
| D15 | **Particionado y archivado de `audit_logs` con retención configurable por plan** | Salesforce audit | P3 |

### 9.7 Integraciones (15)

| # | Recomendación | Detalle / referencia | Prioridad |
|---|---|---|---|
| I1 | **Cerrar integración funcional Twenty** (webhook Twenty→helper, sync de oportunidades, pipelines por cliente) | TEC-02 G7 🔴 | **P0** |
| I2 | **Contrato de integración Frappe/ERPNext** (órdenes, facturas, clientes; sync Twenty→Frappe; verificación automática de factura) | CTX-03, G17 F2 | **P0** (cuando se inicie F2) |
| I3 | **Capa de abstracción CRM/ERP** (interfaces para Twenty y Frappe intercambiables) | CTX-03 §2 — ya diseñada, formalizar en código | **P0** |
| I4 | **Webhooks salientes estándar** (eventos de leads, conversaciones, campañas → sistema del cliente) | Twenty webhooks, Frappe events | P1 |
| I5 | **Conector Meta completo** (WhatsApp Cloud API + Instagram/Facebook leads) | Frappe ya sincroniza leads de Meta; referencia | P1 |
| I6 | **Gateway de pagos** (Stripe; links de pago en chat y campañas) | GoHighLevel Text2Pay, Keap, EspoCRM Stripe | P1 |
| I7 | **Integración Twilio SMS funcional** (hoy código sin uso real; canal SMS de campañas) | G8 | P1 |
| I8 | **SSO empresarial (OIDC/SAML) para clientes** (Authelia ya da SSO interno; exponer a tenants) | HubSpot enterprise SSO | P1 |
| I9 | **Marketplace de integraciones propio** (registro de conectores con OAuth) | HubSpot marketplace | P2 |
| I10 | **Webhooks entrantes para crear leads desde terceros** (forms externos, Zapier/Make-compatible) | Web-to-lead EspoCRM | P2 |
| I11 | **Sincronización de calendario (Google/Outlook)** para citas y recordatorios | HubSpot, Bitrix24 | P2 |
| I12 | **Integración con herramientas de soporte/tickets** (Chatwoot ya es inbox; exponer a Slack/Teams) | Bitrix24, Freshworks | P2 |
| I13 | **MCP server para IA externa** (que agentes externos lean/escriban datos de Wibsite) | Twenty MCP (nativo) — replicar | P3 |
| I14 | **Exportación a DW (BigQuery/ClickHouse) o SQL externo** | Salesforce Data Cloud | P3 |
| I15 | **Registro de integraciones con health check y logs por conector** (estado por API) | Dep. matrix existente | P3 |

---

## 10. Roadmap priorizado

> Alineado con TEC-06 (56 micro-fases) y FASES-CRUZADAS.

| Fase | Foco | Recomendaciones que desbloquea |
|---|---|---|
| **Ahora (F1)** | Cerrar el anillo funcional actual | C1, C2, L1, R1, R3, A1, D1, D2, I1 (P0 de todo) |
| **F1.5** | Módulo de tareas + cadences mínimas | A2, A3, L3 (sobre n8n existente) |
| **F2 (Frappe)** | Integración ERP | I2, I3, A11, pagos (I6) |
| **F3+** | Vendedor IA completo (G15/G16) | R2, R5, A5, A10, plantillas por rubro |
| **F4+** | SaaS multi-tenant real | D4, C13, I8 (RBAC, planes, SSO clientes) |
| **F5+** | BI y datos | D5, D6, D8, C10 |

**Regla de oro:** no iniciar un área nueva sin cerrar los P0 de la fase actual (mantener "todas las funcionalidades principales activas y validadas" antes de expandir, según la estrategia del proyecto).

---

## 11. Consideraciones de integración: Twenty CRM y Frappe/ERPNext

### 11.1 Twenty CRM (integración NO completada — no contar como funcionalidad actual)
- **Estado:** sync unidireccional (helper→Twenty) funcional; API key JWT; 10 campos custom en `people` (painPoints, interests, scoreHistory, lastScore, leadSource, customFields + variantes `lead*`).
- **Pendientes para considerarla "integrada":**
  1. Webhook Twenty→helper (bidireccionalidad) para eventos de people/opportunities.
  2. Sync de oportunidades/deals (hoy solo `people`).
  3. Pipelines por tipo de cliente (CTX-03 §4).
  4. Mapeo metodológico SPICED/MEDDIC en campos custom de opportunities.
  5. Resolver el conflicto de namespace global (ADR-012) con prefijos consistentes.
- **Ventaja aprovechable:** Twenty expone MCP server nativo y Apps framework (TypeScript) — permite que el agente IA y futuros clientes lean/escriban el CRM sin acoplar Wibsite.

### 11.2 Frappe/ERPNext (sin integrar — fase F2)
- **Modelo objetivo (CTX-03):** sync Twenty→Frappe (clientes y oportunidades), órdenes de venta, facturas, inventario; verificación automática de facturas; el agente consulta precios/stock vía Frappe REST API.
- **Recomendaciones:** definir contrato de API (I2), implementar bajo la capa de abstracción CRM/ERP (I3) para que Twenty y Frappe sean intercambiables, y usar el framework Frappe (data models custom, hooks) como Frappe CRM lo demuestra.
- **Recordatorio:** los scripts `twenty-*.js` en la raíz del repo son pruebas de integración, no integración funcional.

---

## 12. Fuentes y URLs

### 12.1 Fuentes consultadas (13/13 ok)
| # | Producto | URL oficial | Fecha |
|---|---|---|---|
| 1 | HubSpot CRM | https://www.hubspot.com/products/crm | 26/08/2026 |
| 2 | Salesforce CRM | https://www.salesforce.com/crm/ | 26/08/2026 |
| 3 | Zoho CRM | https://www.zoho.com/crm/ | 26/08/2026 |
| 4 | Pipedrive | https://www.pipedrive.com/en/features | 26/08/2026 |
| 5 | Frappe CRM | https://frappe.io/crm | 26/08/2026 |
| 6 | Twenty CRM | https://twenty.com/ | 26/08/2026 |
| 7 | Freshsales | https://www.freshworks.com/freshsales-crm/ | 26/08/2026 |
| 8 | Bitrix24 | https://www.bitrix24.com/features/crm.php | 26/08/2026 |
| 9 | SuiteCRM | https://suitecrm.com/ | 26/08/2026 |
| 10 | Kommo | https://www.kommo.com/ | 26/08/2026 |
| 11 | GoHighLevel | https://www.gohighlevel.com/ | 26/08/2026 |
| 12 | Keap | https://keap.com/ | 26/08/2026 |
| 13 | EspoCRM | https://www.espocrm.com/features/ | 26/08/2026 |
| 14 | Odoo CRM | https://www.odoo.com/app/crm | ❌ pendiente (error de transporte) |

### 12.2 Fuentes internas del proyecto (estado real)
- `wibsite/INDEX.md` — mapa documental completo.
- `wibsite/docs/tecnica/TEC-02-FUNCIONES-IMPLEMENTACION.md` — estado por grupo G1–G18.
- `wibsite/docs/tecnica/TEC-01-ARQUITECTURA-INFRAESTRUCTURA.md` — 20 servicios.
- `wibsite/docs/maestro/MAESTRO-FUNCIONALIDADES-CORE.md` — 68 funcionalidades core con estado.
- `wibsite/docs/context/*` — fichas CHATWOOT, DIFY, N8N, TWENTY-CRM, CAMPAIGNS, HELPER-NODE, ARCHITECTURE.
- `wibsite/docs/contextual/CTX-03…CTX-07` — abstracción CRM/ERP, lógica vendedor, plantillas, negocio.
- `wibsite/DATA-MASTER.md` — modelo de datos (15 entidades) y estrategia de almacenamiento.
- `wibsite/frontend/src/app/*` — páginas del frontend unificado (Next.js).

---

## 13. Notas sobre la investigación web

> El usuario indicó que hay problemas con las búsquedas en Internet. Registro de lo ocurrido y recomendaciones.

### 13.1 Incidencias detectadas durante esta investigación
1. **Bloqueo temporal de odoo.com** — 3 intentos consecutivos fallaron con `Transport error` (GET /app/crm, /es_ES/app/crm, /app/crm-0, documentation/17.0, documentation/18.0). Probable: protección anti-bot o caída temporal del CDN. **Reintentar** en otro momento y con las URLs: `https://www.odoo.com/app/crm/features`, `https://www.odoo.com/documentation/18.0/applications/sales/crm.html`.
2. **URLs obsoletas (404) — actualizadas:** Salesforce `/salescloud/` → `/crm/`; Kommo `/features/` → `/` (las features están en `/crm-pipeline/`, `/unified-inbox/`, `/salesbot/`); Twenty `/features` → `/`; GoHighLevel `/features` → `/`; Keap `/product/keap` → `/`; ERPNext `/crm` → `frappe.io/crm` (Frappe CRM es el producto actual).
3. **Sitios con render JS pesado** (Kommo, GoHighLevel): el contenido principal llegó completo solo al segundo intento; si se automatiza, usar esperas o versiones locales/es.
4. **Páginas larguísimas** (HubSpot, Bitrix24): el HTML superó los 50 KB y el exceso se truncó; para research automatizada conviene extraer solo secciones (features list, FAQ) y guardar el dump en archivo.

### 13.2 Recomendaciones para futuras búsquedas
- Preferir **documentación oficial** (`docs.*`, `/documentation/`, `helpdesk.*`) sobre páginas de marketing (menos JS, contenido más estable).
- Guardar cada fetch en un archivo (`tool-output/`) y hacer grep sobre él en lugar de re-leer.
- Usar versiones regionales (`.es`, `.mx`) solo si la EN falla; el contenido canónico está en inglés.
- Para CRMs open source, consultar además el **repo GitHub** (README/features) como fuente primaria estable: `github.com/twentyhq/twenty`, `github.com/frappe/crm`, `github.com/salesagility/SuiteCRM`, `github.com/espocrm/espocrm`, `github.com/odoo/odoo`.
- Si se automatiza con un scraper: rotar user-agents y respetar robots.txt; odoo.com parece el más sensible a bloqueos.
- Programar la verificación periódica de los 14 links de §12.1 (algunos vendors cambian URLs frecuentemente — 4 de 14 ya estaban desactualizadas).

---

## Apéndice A — Estado de cumplimiento de la solicitud

- ✅ Investigación de 10–15 ERPs/CRMs (13 completos + 1 pendiente) en tecnología y ventas.
- ✅ Validación de flujos con fuentes oficiales actualizadas (agosto 2026).
- ✅ Análisis cruzado industria × estado real del sistema (validado contra docs y código).
- ✅ Funcionalidades destacadas de Wibsite que la industria no hace (§7).
- ✅ Gaps y funcionalidades a considerar (§8).
- ✅ 15+ recomendaciones por área (7 áreas, 105 recomendaciones totales) (§9).
- ✅ Consideraciones de integración Twenty/Frappe (no cuentan como funcionalidades actuales) (§11).
- ✅ Lista consolidada de fuentes y URLs (§12).
- ✅ Notas sobre búsquedas web e incidencias (§13).

---

*Documento generado el 26/08/2026. Estado del sistema verificado contra la documentación vigente de Wibsite (v3.0.0, docs/tecnica, DATA-MASTER).*