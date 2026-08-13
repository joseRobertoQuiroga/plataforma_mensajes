# Wibsite Business — Gaps del Sistema y Minifases de Cierre

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Propósito:** Inventario completo de todos los gaps identificados en documentación, código y planificación, organizados como minifases ejecutables.
> **Fuentes:** TAREAS-FUNCIONALES.md, TAREAS-INTERFAZ.md, TEC-06, CTX-01..07, PRUEBAS-Y-VERIFICACIONES.md, RUTA-ACCIONES-PENDIENTES.md, código fuente.

---

## 1. Mapa de Gaps por Origen

| Origen | Gaps identificados | Prioridad media |
|--------|-------------------|-----------------|
| TAREAS-FUNCIONALES.md | 37 funcionalidades faltantes | Alta |
| TAREAS-INTERFAZ.md | 21 validaciones visuales faltantes | Media |
| CTX-07 Brechas | 5 brechas críticas (B1-B5) | Crítica |
| TEC-06 Pendientes | 20 fases pendientes de ejecución | Alta |
| Código fuente | 14 deudas técnicas | Alta |
| **Total** | **~97 gaps consolidados** | |

---

## 2. Minifases de Implementación (G-01 a G-45)

### OLEADA G1 — CANAL TWILIO (reemplazo Meta hasta migración)

### G-01 — Twilio Inbound Webhook + Lead Creation
| Campo | Contenido |
|---|---|
| Objetivo | Recibir mensajes entrantes de Twilio y crear leads automáticamente |
| Archivos | `helper-node/index.js` (POST /webhooks/twilio-inbound), `.env` (TWILIO_WEBHOOK_PATH) |
| Implementación | 1. Agregar endpoint POST /webhooks/twilio-inbound 2. Parsear payload Twilio (From, Body) 3. Normalizar teléfono 4. Crear lead + delivery 5. Reenviar a n8n webhook en formato Chatwoot |
| Pruebas | `curl -X POST http://localhost:3100/webhooks/twilio-inbound -d "From=+59175488354&Body=Hola"` |
| Verif. | Lead creado en helper + delivery registrado + callback a n8n |

### G-02 — Twilio → Chatwoot Bridge Completo
| Campo | Contenido |
|---|---|
| Objetivo | Mensajes de Twilio aparecen en Chatwoot como conversaciones |
| Archivos | `helper-node/index.js` (puente existente mejorado), `.env` (CHATWOOT_INBOX_IDENTIFIER) |
| Implementación | 1. Mejorar endpoint /api/chatwoot/push (actualmente crea contacto + conversación) 2. Agregar manejo de respuestas del agente humano 3. Sincronizar IDs de conversación Twilio ↔ Chatwoot 4. Manejar delivery receipts |
| Pruebas | Enviar mensaje desde Twilio sandbox → visible en Chatwoot |
| Verif. | Conversación creada con nombre, teléfono, mensaje; respuesta de agente llega al usuario |

### G-03 — Twilio Campaign Broadcast Real
| Campo | Contenido |
|---|---|
| Objetivo | Campañas broadcast se envían por Twilio en vez de Meta |
| Archivos | `helper-node/index.js` (endpoint /api/twilio/send existe), n8n workflow 02 (cambiar nodo Meta por helper) |
| Implementación | 1. Workflow n8n 02 obtiene leads pendientes 2. Por cada lead, llama POST /api/twilio/send 3. Tracking de estado en helper 4. Manejar rate limits de Twilio (1 msg/seg) |
| Pruebas | Crear campaña → schedule → verificar envíos en Twilio logs |
| Verif. | Campaign stats muestran sent=N en helper; mensajes recibidos en teléfono destino |

### G-04 — Twilio Typing Indicator + Status Callbacks
| Campo | Contenido |
|---|---|
| Objetivo | Feedback visual: typing indicator + delivery receipts |
| Archivos | `helper-node/index.js` (webhook status callback) |
| Implementación | 1. Configurar StatusCallback en llamada a Twilio API 2. Endpoint POST /webhooks/twilio-status para recibir deliveries/reads 3. Actualizar delivery tracking en helper |
| Pruebas | Enviar mensaje → verificar status_callback recibido |
| Verif. | Delivery status updated en helper dashboard |

### OLEADA G2 — CRM Y DATOS COMPLETOS

### G-05 — Twenty: Sincronización Bidireccional con Webhook
| Campo | Contenido |
|---|---|
| Objetivo | Cambios en Twenty CRM se reflejan en helper automáticamente |
| Archivos | `helper-node/index.js` (POST /webhooks/twenty), Twenty Admin UI (webhook config), `helper-node/services/twentyWebhook.js` |
| Implementación | 1. Configurar webhook en Twenty (Settings → Webhooks → Events) 2. Endpoint receptor en helper 3. Mapear cambio de persona → actualizar lead en store 4. Sincronización automática post-handoff |
| Pruebas | Cambiar score en Twenty → helper actualiza lead |
| Verif. | Cambio visible en Dashboard SPA sin intervención manual |

### G-06 — Twenty: Oportunidades y Pipelines Funcionales
| Campo | Contenido |
|---|---|
| Objetivo | Oportunidades en Twenty conectadas con campañas de helper |
| Archivos | `scripts/twenty-spiced-meddic-fields.js` (mejorar), `helper-node/index.js` (POST /api/twenty/opportunity) |
| Implementación | 1. Crear campo opportunityId en campaigns 2. Lead calificado como hot → crear Opportunity en Twenty 3. Pipeline por contactType (enterprise/wholesale/b2c) 4. Vincular opportunity con persona existente |
| Pruebas | Lead hot → opportunity creada en Twenty con pipeline correcto |
| Verif. | Opportunity visible en Twenty CRM con campos SPICED/MEDDIC |

### G-07 — Twenty: Campos Calculados y Dashboard
| Campo | Contenido |
|---|---|
| Objetivo | Última interacción, tendencia de score visibles en Twenty |
| Archivos | Twenty metadata (campos calculados vía API) |
| Implementación | 1. Campo `leadLastInteraction` (fecha) 2. Campo `leadScoreTrend` (up/down/stable) 3. Campo `leadDaysSinceLastContact` (número) 4. Actualizar en cada sync |
| Pruebas | Múltiples syncs → ver tendencia cambia |
| Verif. | Campos calculados visibles en Twenty People |

### G-08 — Editar/Eliminar Lead Individual vía API
| Campo | Contenido |
|---|---|
| Objetivo | CRUD completo de leads individuales |
| Archivos | `helper-node/index.js` (PATCH /api/leads/:id, DELETE /api/leads/:id) |
| Implementación | 1. PATCH: actualizar nombre, teléfono, email, custom_fields 2. DELETE: eliminar lead + scores relacionados 3. Validar existencia antes de operar |
| Pruebas | Crear → editar → eliminar lead |
| Verif. | Lead desaparece de listados y scores asociados eliminados |

### G-09 — Búsqueda Global de Leads
| Campo | Contenido |
|---|---|
| Objetivo | Buscar leads por nombre/teléfono/email en toda la plataforma |
| Archivos | `helper-node/index.js` (GET /api/leads/search?q=), Dashboard SPA |
| Implementación | 1. Endpoint de búsqueda con LIKE en phone, name, email 2. Índice en BD para búsqueda rápida 3. Integrar en Dashboard SPA con campo de búsqueda |
| Pruebas | Buscar por nombre parcial → resultados filtrados |
| Verif. | Todos los matches relevantes retornados en <500ms |

### OLEADA G3 — SCORING E IA

### G-10 — Comparativa Rule-Based vs LLM Scoring
| Campo | Contenido |
|---|---|
| Objetivo | Dashboard comparativo entre métodos de scoring |
| Archivos | `helper-node/index.js` (GET /api/scoring/compare), Dashboard SPA |
| Implementación | 1. Endpoint compara scores rule-based vs LLM para mismo lead 2. Muestra diferencias y precisión 3. Tabla en Dashboard: lead, rule-score, llm-score, diff |
| Pruebas | Evaluar lead con ambos métodos → comparar |
| Verif. | Diferencias visibles y documentadas |

### G-11 — Cache de Resultados LLM
| Campo | Contenido |
|---|---|
| Objetivo | Evitar llamadas repetidas a OpenRouter para mismo mensaje |
| Archivos | `helper-node/index.js`, `helper-node/services/cacheStore.js` (Redis) |
| Implementación | 1. Hash del mensaje de entrada como key 2. TTL de 24h en Redis 3. Cache hit → devolver resultado 4. Cache miss → llamar LLM y almacenar |
| Pruebas | Misma consulta 2 veces → segunda sin llamada LLM |
| Verif. | Latencia segunda llamada <5ms, cache hit incrementa |

### G-12 — Dify Workflow Publicado y Operativo
| Campo | Contenido |
|---|---|
| Objetivo | Workflow WhatsApp Lead Classifier visible y funcional en Dify |
| Archivos | `dify/workflows/whatsapp-lead-classifier.yml`, Dify API |
| Implementación | 1. Importar workflow en Dify Studio 2. Publicar 3. Obtener API key 4. Probar con payload de prueba 5. Conectar con n8n |
| Pruebas | `curl -X POST http://localhost:5001/v1/workflows/run` con mensaje de prueba |
| Verif. | Workflow retorna score, intención, datos extraídos |

### G-13 — RAG con Documentos del Negocio
| Campo | Contenido |
|---|---|
| Objetivo | Knowledge Base poblada con documentos reales del negocio |
| Archivos | `helper-node/services/ragEngine.js`, scripts de carga |
| Implementación | 1. Script de carga de documentos a Weaviate 2. Documentos: FAQ, productos, políticas 3. Consultas RAG desde agente 4. Fallback in-memory como backup |
| Pruebas | Pregunta sobre política de devolución → respuesta desde KB |
| Verif. | Respuesta corresponde al documento cargado |

### OLEADA G4 — DASHBOARD Y UX

### G-14 — Dashboard: Gráficos de Tendencia y Distribución
| Campo | Contenido |
|---|---|
| Objetivo | Visualización avanzada en Dashboard |
| Archivos | `helper-node/public/index.html` (SPA) |
| Implementación | 1. Gráfico de tendencia de leads/día (últimos 30 días) 2. Distribución de scores (histograma) 3. Timeline de score por lead (evolución) 4. Tasa de conversión (replied/sent) por campaña |
| Pruebas | Seed data → ver gráficos |
| Verif. | Gráficos renderizados con datos reales |

### G-15 — Dashboard: Spinner y Feedback Visual
| Campo | Contenido |
|---|---|
| Objetivo | Feedback visual en acciones asíncronas |
| Archivos | `helper-node/public/index.html` (SPA) |
| Implementación | 1. Spinner en botones Seed, Sync, Score All 2. Resultado visible: "12 leads synced, 0 errors" 3. Notificación toast para operaciones completadas 4. Deshabilitar botón durante operación |
| Pruebas | Click Sync CRM → ver spinner + resultado |
| Verif. | Usuario ve estado de operación sin ambigüedad |

### G-16 — Modal de Importación: UTF-8 + >1000 Filas
| Campo | Contenido */
|---|---|
| Objetivo | Manejo correcto de caracteres especiales y archivos grandes */
| Archivos | `helper-node/index.js` (upload endpoint) |
| Implementación | 1. Forzar encoding UTF-8 en parseo CSV 2. Stream processing para >1000 filas (batch insert) 3. Timeout extendido para archivos grandes (60s) 4. Progreso parcial |
| Pruebas | Archivo con 5000 filas y caracteres especiales → todo OK |
| Verif. | 5000 leads creados en <30s, ñ y tildes correctos |

### OLEADA G5 — N8N Y AUTOMATIZACIONES

### G-17 — Workflow n8n: Activación y Verificación Completa
| Campo | Contenido |
|---|---|
| Objetivo | Los 3 workflows de n8n activos y probados |
| Archivos | n8n UI (manual), `n8n/workflows/*.json` |
| Implementación | 1. Login n8n 2. Importar workflows 01, 02, 03 3. Crear credenciales: Dify API Key, Chatwoot API, Twenty Bearer, Twilio 4. Activar toggles 5. Ejecutar pruebas |
| Pruebas | POST a webhook de cada workflow → ejecución exitosa |
| Verif. | 3 workflows activos (verde) en n8n UI |

### G-18 — Workflow n8n: Nurturing y Followup Automático
| Campo | Contenido */
|---|---|
| Objetivo | Secuencia de followup automatizada vía n8n */
| Archivos | CREAR `n8n/workflows/04-nurturing-followup.json` |
| Implementación | 1. Schedule diario 2. Obtener leads warm (score 40-69) sin actividad >3 días 3. Enviar mensaje de seguimiento vía Twilio 4. Tracking de intentos 5. Escalar a handoff si responde |
| Pruebas | Lead warm simulado → recibe followup |
| Verif. | Followup enviado + tracking actualizado |

### G-19 — Workflow n8n: Chatwoot → Dify → Twenty (Completo)
| Campo | Contenido */
|---|---|
| Objetivo | Flujo inbound E2E por n8n */
| Archivos | `n8n/workflows/01-inbound-message.json` (actualizar) |
| Implementación | 1. Webhook Chatwoot → helper normaliza 2. Helper scoring rule-based 3. n8n llama Dify para clasificación IA 4. Resultado a Twenty CRM 5. Respuesta automática vía Twilio |
| Pruebas | POST /webhook/chatwoot-inbound simulado → flujo completo |
| Verif. | Lead en Twenty con score + IA analysis + respuesta automática */

### OLEADA G6 — SEGURIDAD Y HARDENING

### G-20 — HTTPS con Certificados Reales
| Campo | Contenido */
|---|---|
| Objetivo | Tránsito cifrado entre todos los servicios */
| Archivos | `nginx.conf` (server 443), `certs/` (certificados), `.env` */
| Implementación | 1. Generar certificados autofirmados para dev 2. Configurar server 443 con SSL 3. Redirect 301 de 80 → 443 4. HSTS header 5. Verificar SSL Labs grade ≥ B */
| Pruebas | `curl -I https://localhost:8080` → 200 + HSTS header */
| Verif. | Sin contenido mixto (mixed content warnings) */

### G-21 — Roles de PostgreSQL por Servicio
| Campo | Contenido */
|---|---|
| Objetivo | Cada servicio conecta solo a su BD con su propio rol */
| Archivos | `scripts/init-db.sql` (roles PG), `.env` */
| Implementación | 1. Crear rol chatwoot (BD chatwoot) 2. Rol dify (BD dify, dify_plugin) 3. Rol n8n (BD n8n) 4. Rol twenty (BD twenty) 5. Rol wibsite (BD wibsite) 6. GRANT solo a BD correspondiente */
| Pruebas | Rol wibsite no puede leer BD twenty y viceversa */
| Verif. | Stack completo operativo tras migración */

### G-22 — Rate Limiting por Tenant y Plan
| Campo | Contenido */
|---|---|
| Objetivo | Límites configurables por plan (Demo/Blue/ProMax) */
| Archivos | `helper-node/middleware/planLimiter.js`, `.env` */
| Implementación | 1. Middleware que lee `x-tenant-plan` header 2. Límites: Demo 10 req/min, Blue 30, ProMax 100 3. 429 con mensaje de upgrade 4. Config sincronizada con BD */
| Pruebas | Request con plan Demo excede límite → 429 */
| Verif. | Cada plan respeta su cuota */

### OLEADA G7 — OBSERVABILIDAD COMPLETA

### G-23 — Alertas Configuradas en Grafana
| Campo | Contenido */
|---|---|
| Objetivo | Notificaciones P0/P1 funcionando */
| Archivos | Grafana UI, `monitoring/grafana-dashboards/` */
| Implementación | 1. Dashboard de infra en Grafana 2. Alertas: ServiceDown 30s (P0), p95>5s (P1), error rate >5% (P2) 3. Contact point a Telegram/email 4. Probar alertas simulando fallo */
| Pruebas | Bajar helper → alerta P0 recibida */
| Verif. | Alarma llega al canal configurado en <1min */

### G-24 — Logs Unificados: Traza E2E por conversation_id
| Campo | Contenido */
|---|---|
| Objetivo | Rastrear un mensaje completo por todos los módulos */
| Archivos | `helper-node/services/auditLogger.js`, N8N env vars, Dify config */
| Implementación | 1. Propagar `x-request-id` / `x-conversation-id` entre servicios 2. Helper escribe correlation ID en cada log 3. n8n configurado para incluir correlation ID 4. Endpoint GET /api/logs/trace/:conversationId devuelve traza completa */
| Pruebas | Flujo inbound → consultar traza → todos los saltos visibles */
| Verif. | Misma conversation_id en helper, n8n, Dify */

### OLEADA G8 — SAAS Y MULTI-TENANT

### G-25 — tenant_id + RLS en Tablas Wibsite
| Campo | Contenido */
|---|---|
| Objetivo | Aislamiento a nivel BD con Row Level Security */
| Archivos | Migración SQL en `scripts/campaigns-schema.sql` */
| Implementación | 1. ALTER TABLE campaigns/campaign_leads/lead_scores/opt_outs/workflow_logs ADD tenant_id UUID 2. ENABLE ROW LEVEL SECURITY en cada tabla 3. Policies: tenant_id = current_setting('app.tenant_id') 4. Índices por tenant */
| Pruebas | SET app.tenant_id='A' → no se ven filas de 'B' */
| Verif. | Endpoints devuelven solo datos del tenant activo */

### G-26 — Middleware tenantContext + Prefijos Redis
| Campo | Contenido */
|---|---|
| Objetivo | Resolución de tenant por request propagada a PG y Redis */
| Archivos | CREAR `helper-node/middleware/tenantContext.js` */
| Implementación | 1. Tenant por header x-tenant-id > API key > payload webhook 2. SET app.tenant_id por request (transacción) 3. Prefijos Redis: `{tenant}:conv:convId` 4. 403/404 cross-tenant */
| Pruebas | Request sin tenant → default; con tenant B no ve datos de A */
| Verif. | Aislamiento completo de datos entre tenants */

### G-27 — Planes SaaS: Demo/Blue/ProMax/Enterprise
| Campo | Contenido */
|---|---|
| Objetivo | Límites por plan aplicados al runtime */
| Archivos | `helper-node/middleware/planLimiter.js`, migración SQL platform_tenants */
| Implementación | 1. DDL con plan_id y límites denormalizados 2. Límites: leads/mes, campañas/mes, usuarios, storage 3. planLimiter rechaza al superar límite 4. Respuesta 403 con upgrade link */
| Pruebas | Demo crea 11ª campaña → rechazada */
| Verif. | Límite correspondiente al plan aplicado correctamente */

### G-28 — Metabase: Dashboard de KPIs de Negocio
| Campo | Contenido */
|---|---|
| Objetivo | Reportes de negocio sobre datos reales */
| Archivos | `docker-compose.yml` (metabase servicio), `scripts/init-db.sql` (rol metabase_reader) */
| Implementación | 1. Agregar servicio Metabase 2. Rol solo-lectura metabase_reader 3. Dashboard: campañas activas, leads por banda, tasa respuesta 4. Sandboxing por tenant */
| Pruebas | Metabase conecta con metabase_reader (no admin) */
| Verif. | Dashboard con datos del tenant de prueba */

### OLEADA G9 — ERP Y EXPANSIÓN

### G-29 — Frappe/ERPNext: Setup en Docker Compose
| Campo | Contenido */
|---|---|
| Objetivo | ERPNext operativo como servicio del stack */
| Archivos | `docker-compose.yml` (frappe + mariadb + redis), `nginx.conf` (/erp/), `.env` */
| Implementación | 1. Agregar servicios frappe/erpnext 2. Ruta Nginx protegida 3. Setup inicial (site, empresa de prueba) 4. Health check */
| Pruebas | Login ERPNext + creación de cliente de prueba */
| Verif. | UI accesible vía /erp/ tras SSO */

### G-30 — Sync Twenty→Frappe: Lead a Factura Automática
| Campo | Contenido */
|---|---|
| Objetivo | Lead cerrado genera factura en ERPNext */
| Archivos | CREAR `n8n/workflows/05-twenty-frappe-sync.json` */
| Implementación | 1. Trigger: oportunidad pasa a "ganada" en Twenty 2. Upsert Customer en ERPNext 3. Crear Sales Invoice con monto acordado 4. Enlace de retorno (invoice id en Twenty) */
| Pruebas | Cambiar oportunidad a ganada → factura visible en ERPNext */
| Verif. | Invoice creada con datos correctos del lead */

### OLEADA G10 — PORTAL Y EXPERIENCIA

### G-31 — Portal: Notificaciones Unificadas + Ctrl+K
| Campo | Contenido */
|---|---|
| Objetivo | Búsqueda global y centro de notificaciones */
| Archivos | `hub/portal/index.html`, `helper-node/index.js` (GET /api/search) */
| Implementación | 1. Endpoint GET /api/search?q= (busca en leads, campañas, conversaciones) 2. Portal: Ctrl+K abre buscador 3. Resultados por módulo con salto 4. Centro de notificaciones (handoffs, alertas) */
| Pruebas | Ctrl+K + buscar teléfono → salto al lead */
| Verif. | Búsqueda <500ms; notificación de handoff visible */

### G-32 — Portal: Lead Context Panel (Split View)
| Campo | Contenido */
|---|---|
| Objetivo | Panel lateral con perfil del lead mientras se navega */
| Archivos | `hub/portal/index.html`, `hub/portal/js/leadPanel.js` */
| Implementación | 1. Panel derecho colapsable 2. Muestra: score, temperatura, última interacción, etapa SPICED/MEDDIC 3. Se abre desde postMessage (click en lead) 4. Persiste entre navegaciones */
| Pruebas | Click en lead en Twenty → panel muestra su perfil */
| Verif. | Contexto persiste sin recargar */

### OLEADA G11 — CI/CD Y DESPLIEGUE

### G-33 — GitHub Actions CI Pipeline
| Campo | Contenido */
|---|---|
| Objetivo | Tests automatizados en cada push */
| Archivos | CREAR `.github/workflows/ci.yml` */
| Implementación | 1. Trigger: push a main + PR 2. Jobs: lint, test (112 tests), contract tests, npm audit 3. Gate: PR solo mergeable en verde */
| Pruebas | PR con test roto → bloqueado */
| Verif. | Pipeline ejecuta en cada push; 0 críticos en audit */

### G-34 — Smoke Test Post-Despliegue Automatizado
| Campo | Contenido */
|---|---|
| Objetivo | Verificación automática tras cada despliegue */
| Archivos | `.github/workflows/deploy.yml`, `scripts/verify/smoke-test.sh` */
| Implementación | 1. Smoke test: health endpoints, contract tests, seed/clear cycle 2. Rollback automático si smoke falla 3. Notificación a Telegram */
| Pruebas | Deploy intencionalmente roto → smoke detecta y revierte */
| Verif. | Smoke pasa antes de marcar despliegue como exitoso */

### OLEADA G12 — MULTI-AGENTE Y VOZ

### G-35 — Topología Multi-Agente (Router→Qualifier→Sales→Support→Nurturing→PostSale→Voice)
| Campo | Contenido */
|---|---|
| Objetivo | 6 agentes especializados con prompts propios */
| Archivos | `helper-node/services/agentCore/graph.js` (extender), `helper-node/services/agentRouter.js` */
| Implementación | 1. Router por intent_label + conversation_state 2. Qualifier: califica leads fríos 3. Sales: maneja objeciones y cierre 4. Support: resuelve dudas técnicas 5. Nurturing: reactivación pasiva 6. PostSale: seguimiento post-venta */
| Pruebas | Mensaje de soporte → enrutado a Support Agent */
| Verif. | Cada agente usa su prompt y temperatura específicos */

### OLEADA G13 — MULTI-MODAL

### G-36 — Pipeline Multimedia: Imagen, Audio, Video, Documentos
| Campo | Contenido */
|---|---|
| Objetivo | Manejo de mensajes con adjuntos en todos los canales */
| Archivos | `helper-node/index.js`, MinIO storage, n8n workflow */
| Implementación | 1. Recepción de mensajes multimedia en webhook 2. Subida a MinIO 3. Almacenamiento en lead profile 4. Reenvío a Chatwoot con URL firmada */
| Pruebas | Enviar imagen por Twilio → visible en Chatwoot */
| Verif. | Archivo almacenado en MinIO, accesible, visible en conversación */

### G-37 — TTS (Text-to-Speech) con Fallback 4 Proveedores
| Campo | Contenido */
|---|---|
| Objetivo | Respuesta de voz sintética con respaldo */
| Archivos | `helper-node/services/ttsEngine.js` */
| Implementación | 1. Proveedor primario: OpenRouter TTS 2. Fallback 1: Google TTS 3. Fallback 2: ElevenLabs 4. Fallback 3: edge-tts local 5. Cache de audio generado */
| Pruebas | Texto → archivo de audio generado */
| Verif. | Audio se reproduce correctamente */

---

## 3. Tabla de Seguimiento de Gaps

| Gap | Objetivo | Oleada | Archivos | Estado | Prioridad |
|-----|----------|--------|----------|--------|-----------|
| G-01 | Twilio inbound webhook | G1 | index.js | ⬜ | 🔴 Alta |
| G-02 | Twilio ↔ Chatwoot bridge | G1 | index.js, .env | 🟡 Parcial | 🔴 Alta |
| G-03 | Campaign broadcast Twilio | G1 | index.js, n8n 02 | ⬜ | 🔴 Alta |
| G-04 | Typing + status callbacks | G1 | index.js | ⬜ | 🟡 Media |
| G-05 | Twenty bidireccional | G2 | index.js, twentyWebhook.js | ⬜ | 🔴 Alta |
| G-06 | Oportunidades Twenty | G2 | twenty-fields.js, index.js | ⬜ | 🟡 Media |
| G-07 | Campos calculados Twenty | G2 | twenty-fields.js | ⬜ | 🟢 Baja |
| G-08 | CRUD leads individual | G2 | index.js | ⬜ | 🟡 Media |
| G-09 | Búsqueda global leads | G2 | index.js, Dashboard | ⬜ | 🟡 Media |
| G-10 | Comparativa scoring | G3 | index.js, Dashboard | ⬜ | 🟢 Baja |
| G-11 | Cache LLM | G3 | cacheStore.js | ⬜ | 🟡 Media |
| G-12 | Dify workflow publicado | G3 | dify/workflows/ | ⬜ | 🔴 Alta |
| G-13 | RAG documentos negocio | G3 | ragEngine.js | ⬜ | 🟡 Media |
| G-14 | Gráficos Dashboard | G4 | public/index.html | ⬜ | 🟡 Media |
| G-15 | Spinner + feedback | G4 | public/index.html | ⬜ | 🟢 Baja |
| G-16 | UTF-8 + >1K filas | G4 | index.js | ⬜ | 🟡 Media |
| G-17 | n8n activación completa | G5 | n8n workflows | ⬜ | 🔴 Alta |
| G-18 | n8n nurturing workflow | G5 | n8n 04 | ⬜ | 🟡 Media |
| G-19 | n8n inbound E2E | G5 | n8n 01 | ⬜ | 🔴 Alta |
| G-20 | HTTPS real | G6 | nginx.conf, certs | ⬜ | 🔴 Alta |
| G-21 | Roles PG por servicio | G6 | init-db.sql | ⬜ | 🟡 Media |
| G-22 | Rate limiting por plan | G6 | planLimiter.js | ⬜ | 🟡 Media |
| G-23 | Alertas Grafana | G7 | grafana dashboards | ⬜ | 🟡 Media |
| G-24 | Traza E2E correlation ID | G7 | auditLogger.js | ⬜ | 🟡 Media |
| G-25 | tenant_id + RLS | G8 | campaigns-schema.sql | ⬜ | 🔴 Alta |
| G-26 | Middleware tenantContext | G8 | tenantContext.js | ⬜ | 🔴 Alta |
| G-27 | Planes SaaS | G8 | planLimiter.js | ⬜ | 🟡 Media |
| G-28 | Metabase KPIs | G8 | docker-compose.yml | ⬜ | 🟡 Media |
| G-29 | Frappe ERP setup | G9 | docker-compose.yml | ⬜ | 🟡 Media |
| G-30 | Sync Twenty→Frappe | G9 | n8n 05 | ⬜ | 🟡 Media |
| G-31 | Búsqueda + notifs portal | G10 | portal/index.html | ⬜ | 🟡 Media |
| G-32 | Lead Panel portal | G10 | portal/index.html | ⬜ | 🟡 Media |
| G-33 | CI pipeline | G11 | .github/workflows | ⬜ | 🟡 Media |
| G-34 | Smoke test deploy | G11 | deploy.yml, smoke-test.sh | ⬜ | 🟡 Media |
| G-35 | Multi-agente | G12 | agentCore/graph.js | ⬜ | 🟡 Media |
| G-36 | Pipeline multimedia | G13 | index.js, MinIO | ⬜ | 🟢 Baja |
| G-37 | TTS engine | G13 | ttsEngine.js | ⬜ | 🟢 Baja |

---

## 4. Correspondencia con TEC-06 y Objetivos Técnicos

| Gap | Fase TEC-06 relacionada | OT relacionado | Brecha CTX-07 |
|-----|------------------------|----------------|---------------|
| G-01 | F-03 (Twilio bridge) | OT-01 | B1 |
| G-02 | F-04 (Chatwoot inbox) | OT-01 | B1 |
| G-03 | F-06 (Broadcast) | OT-01 | B1 |
| G-04 | F-24 (Typing) | OT-01 | B1 |
| G-05 | F-27 (Bidireccionalidad) | OT-06 | — |
| G-06 | F-26 (Pipelines) | OT-06 | — |
| G-07 | — (Nuevo) | OT-06 | — |
| G-08 | — (Nuevo) | — | — |
| G-09 | F-45 (Búsqueda) | — | — |
| G-10 | — (Nuevo) | OT-12 | — |
| G-11 | — (Nuevo) | — | — |
| G-12 | F-02 (Workflows) | OT-01 | B3 |
| G-13 | — (Nuevo) | OT-08 | — |
| G-14 | — (Nuevo) | OT-12 | — |
| G-15 | — (Nuevo) | — | — |
| G-16 | — (Nuevo) | — | — |
| G-17 | F-02 (n8n activación) | OT-01 | B3 |
| G-18 | F-23 (Followup) | OT-08 | — |
| G-19 | F-05 (Inbound) | OT-01 | B1 |
| G-20 | F-31 (HTTPS) | OT-05 | — |
| G-21 | F-32 (Roles PG) | OT-05 | — |
| G-22 | F-53 (Planes) | OT-09 | — |
| G-23 | F-37 (Alertas) | OT-03 | B5 |
| G-24 | F-40 (Logs unificados) | OT-03 | — |
| G-25 | F-10 (RLS) | OT-02 | B2 |
| G-26 | F-11 (tenantContext) | OT-02 | B2 |
| G-27 | F-53 (Planes) | OT-09 | — |
| G-28 | F-52 (Metabase) | OT-04 | — |
| G-29 | F-28 (Frappe) | OT-07 | — |
| G-30 | F-29 (Sync Frappe) | OT-07 | — |
| G-31 | F-45 (Búsqueda) | — | — |
| G-32 | F-44 (Lead panel) | — | — |
| G-33 | F-42 (CI) | OT-12 | — |
| G-34 | F-55 (Staging) | OT-12 | — |
| G-35 | — (Nuevo) | OT-10 | — |
| G-36 | — (Nuevo) | OT-11 | — |
| G-37 | — (Nuevo) | OT-11 | — |

---

## 5. Ruta de Implementación Recomendada

```
DÍA 1-2 (Semana 1): Canal Twilio Activo
├── G-01 Twilio inbound webhook
├── G-02 Twilio ↔ Chatwoot bridge mejorado
├── G-17 n8n activación completa
└── G-19 n8n inbound E2E (Twilio)

DÍA 3-4 (Semana 1): CRM y Datos
├── G-05 Twenty bidireccional
├── G-06 Oportunidades Twenty
├── G-08 CRUD leads individual
└── G-09 Búsqueda global

DÍA 5-7 (Semana 2): Seguridad e Infra
├── G-20 HTTPS real
├── G-21 Roles PG
├── G-25 tenant_id + RLS
└── G-26 Middleware tenantContext

DÍA 8-10 (Semana 2-3): Automatización
├── G-03 Campaign broadcast Twilio
├── G-18 n8n nurturing
├── G-12 Dify workflow publicado
└── G-24 Traza E2E

DÍA 11-14 (Semana 3): Dashboard y UX
├── G-14 Gráficos Dashboard
├── G-15 Spinner + feedback
├── G-31 Portal búsqueda
└── G-32 Lead panel

DÍA 15-21 (Semana 3-4): SaaS y Producción
├── G-27 Planes SaaS
├── G-28 Metabase
├── G-33 CI pipeline
├── G-34 Smoke test
└── G-22 Rate limiting por plan
```
