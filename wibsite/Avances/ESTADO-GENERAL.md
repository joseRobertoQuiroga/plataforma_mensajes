# Wibsite Business â€” Estado General del Proyecto

> Documento vivo de desarrollo â€” Refleja el estado actual del proyecto en tiempo real

---

## Ficha del Proyecto

| Campo | Valor |
|-------|-------|
| **Nombre** | Wibsite Business |
| **PropÃ³sito** | Plataforma de mensajerÃ­a omnicanal con IA para PYMEs (WhatsApp, Messenger, TikTok, SMS, Email, Telegram) |
| **Stack** | Chatwoot + Dify + n8n + Twenty CRM + Helper Node + PostgreSQL + Redis + Weaviate + Elastic Stack (Elasticsearch + Kibana + OTel Collector) + MinIO |
| **OrquestaciÃ³n** | Docker Compose (20 servicios) |
| **Estado General** | ðŸŸ¡ **Oleada 0 completada, iniciando Oleada 1 (Deduplicacin y Tags)
| **Ãšltima actualizaciÃ³n** | 2026-08-30 (verificacin en vivo: Oleada 0 completada. Cutover PG y normalizacin al 100%. Tests 83/83 en dev)
| **Helper Node** | v2.2.0 â€” ~130 rutas, 176 tests (22 suites) |

---

## Barra de Progreso por Ãrea

```
Infraestructura         â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  +Authelia, Elastic Stack, MinIO (compose 20 servicios)
Helper Node             â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  v2.2.0 + store facade dual-write + agentCore + templateEngine (~120 rutas)
Middleware Seguridad    â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Auth, Rate Limit, Sanitizer, HMAC + PII filter
Conversation Store      â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  State machine 9 estados + checkpointer (conversation_summaries migrada a PG 15/08)
Lead Profile Builder    â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Tags, next action, score history
Agent Config Editor     â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  10 tipos negocio, 5 personalidades
RAG Engine              â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Weaviate + fallback in-memory
Anti-Hallucination      â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Boundaries, triggers, unknown responses
SLI/SLO Monitoring      â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Health+, metrics, uptime tracking + prom-client
Template Engine         â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Load, validate, merge, 3 plantillas
Agent Graph Engine      â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Grafo 9 nodos (F-16) + checkpointer (F-14) + guards (F-17) + Dify/fallback (F-18) + sync comercial (F-21)
Audit Logging           â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  PII filter + 24 event types + PG + puente OTLP logs â†’ Elasticsearch (15/08)
Portal Shell            â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  9 mÃ³dulos, SSO, postMessage
CRM MetodolÃ³gico        â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Script SPICED/MEDDIC 13 campos
VerificaciÃ³n            â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  TeVS 11/11 + e2e-trace 10/10 + 169 tests Jest (19 suites)
Observabilidad          â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  ES 9.4.2 + Kibana + OTel: traces+metrics+logs con rollover diario (ILM 1d/30d, 15/08)
Dify (IA)               â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…
Twenty CRM              â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…
n8n Workflows           â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘  90%  âš ï¸  3 workflows activos en BD; falta toggle UI y credenciales
Multicanal              â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘  90%  âœ…  Pipeline unificado: Email+Telegram+WhatsApp+Messenger+TikTok + broadcast + pruebas por canal; falta conectar tokens
Multimodal              â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘  90%  âœ…  STT (audioâ†’texto) + visiÃ³n (imagenâ†’descripciÃ³n) + TTS (textoâ†’voz con reply_audio) vÃ­a OpenRouter
RAG de negocio          â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Conectado al grafo (nodo kb) + carga de kb-documents en arranque â€” verificado en runtime
Cotizaciones            â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Cuestionarios por servicio (8 servicios) + estimaciÃ³n por alcance + mini-cotizaciÃ³n (nodo cotizacion)
Portal Shell            â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘  90%  âœ…  8 mÃ³dulos SSO + Lead Panel + bÃºsqueda Ctrl+K + notificaciones; postMessage cross-module pendiente
Carga (F-51)            â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  k6 + simulador node: 8 conv p95 1177ms Â· 3.29 turnos/s
n8n Workflows           â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘  90%  âš ï¸  2/3 activos en runtime (01 inbound + 02 broadcast); tercero variante con credenciales pendientes
DocumentaciÃ³n           â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  100+ archivos tÃ©cnicos
Scripts/Automatiz.      â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  backup, migrate, verify, fields, orphan-check
Chatwoot Inbox          â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘  80%  âš ï¸  Inbox + puente Twilio configurado
Meta WhatsApp API       â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘  80%  âš ï¸  Webhook Meta listo (/webhooks/whatsapp); envÃ­o por Twilio hasta migraciÃ³n
SSO (Authelia)          â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Config compose + nginx auth_request (verificado 403 sin SSO)
Flujo Inbound Real      â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Twilioâ†’helperâ†’n8nâ†’Difyâ†’Twenty (F-05) + pipeline multicanal (15/08)
Flujo Campaign Real     â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  /api/twilio/send + StatusCallback (F-06)
Tests Unitarios         â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  176 tests (22 suites) â€” 15/08
TeVS (Elastic)            13/13 PASSED (15/08)
Dual-Write PG           â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ 100%  âœ…  Rutas conectadas al facade (F-08): campaÃ±as/leads/scores/opt-outs verificados en PG (15/08)
```

---

## Resumen de Estado por Componente

| Componente | Estado | Funcionalidad | Pendiente Clave |
|-----------|--------|--------------|-----------------|
| **PostgreSQL** | âœ… Operativo | 5 bases de datos activas | â€” |
| **Redis** | âœ… Operativo | CachÃ© y colas | â€” |
| **Weaviate** | âœ… Operativo | BÃºsqueda vectorial | â€” |
| **Nginx** | âœ… Operativo | Proxy reverso en :8080 | â€” |
| **Chatwoot** | âœ… Servicio OK + bridge Twilio | UI funcional, webhook n8n configurable, push inbound `/api/chatwoot/push` | Configurar inbox WhatsApp nativo (opcional) |
| **Dify** | âœ… Completo | Workflow clasificador funcional con OpenRouter | â€” |
| **n8n** | âœ… Servicio OK, âš ï¸ Config pendiente | Workflows importados, body parser bug conocido | Activar workflows UI, crear credenciales |
| **Twenty CRM** | âœ… Completo | API key JWT, 10 campos custom, sync funcional | â€” |
| **Helper Node** | âœ… Completo | ~108 rutas (~35+ grupos), dashboard SPA, PostgreSQL + JSON fallback | â€” |
| **Elasticsearch** | âœ… Operativo | Datastreams traces/metrics/logs con ILM rollover 1d + delete 30d (15/08) | â€” |
| **Kibana** | âœ… Operativo | UI observabilidad en :5601 | â€” |
| **OTel Collector** | âœ… Operativo | OTLP :4317/:4318 â†’ ES: traces + metrics + logs (helper emite logs 15/08) | â€” |
| **MinIO** | âœ… Operativo | Object storage :9000 + consola :9001 | â€” |
| **Meta API** | âš ï¸ Webhook listo | `/webhooks/whatsapp` (GET verify + POST) | EnvÃ­o por Twilio hasta migraciÃ³n |
| **Authelia** | âœ… Operativo | Gateway SSO con nginx auth_request â€” verificado 403 sin SSO (14/08) | â€” |
| **Telegram** | âœ… Adapter listo | Bot API sendMessage + webhook + normalizaciÃ³n (voz/foto/video) | Conectar TELEGRAM_BOT_TOKEN y probar con bot real |
| **Multimodal** | âœ… Bases | STT (OpenRouter transcripciones) + visiÃ³n (gpt-4o-mini) con degradaciÃ³n elegante | Configurar OPENROUTER_STT_MODEL |
| **Frappe/ERP** | â¬œ Diferido | Ruta nginx `/erp/` comentada; decisiÃ³n de negocio futura | F-28/F-29 |
| **Metabase/BI** | â¬œ Diferido | Ruta nginx `/reportes/` comentada | F-52 |

> **VerificaciÃ³n en vivo (2026-08-30 (verificacin en vivo: Oleada 0 completada. Cutover PG y normalizacin al 100%. Tests 83/83 en dev)

---

## Logros Clave (Resumen)

- 20 servicios Docker orquestados y comunicÃ¡ndose (incluye Elastic Stack + MinIO)
- Helper Node con CRUD completo de campaÃ±as multi-canal, scoring, templates, sync CRM
- Workflow Dify de 8 nodos LLM funcional clasificando leads vÃ­a OpenRouter
- 10 campos personalizados en Twenty CRM con sincronizaciÃ³n bidireccional
- 3 workflows n8n importados (inbound message + campaign broadcast + score & sync)
- Bridge Twilio real funcionando (inbound + broadcast con StatusCallback, F-03â€¦F-06)
- Elastic Stack + OpenTelemetry configurados (reemplazan Prometheus/Grafana/GlitchTip)
- Suite TeVS creada (11 tests integraciÃ³n con Elasticsearch) â€” pendiente de ejecuciÃ³n
- 100+ archivos de documentaciÃ³n tÃ©cnica
- Dashboard SPA con monitoreo en tiempo real + hub/control-center
- Upload Excel/CSV con auto-detecciÃ³n de columnas
- Motor agÃ©ntico ejecutable (Oleada C, 2026-08-12): grafo 9 nodos con aristas condicionales, checkpointer de memoria (Redis + PG `conversation_summaries`), guards de confidencialidad/autonomÃ­a (zonas green/yellow/red con PII assisted), Dify como nodo con fallback OpenRouter + circuit breaker, y sync mÃ¡quina comercialâ†”tÃ©cnica vÃ­a `commercialState`
- **Oleada multicanal + monitoreo (2026-08-30 (verificacin en vivo: Oleada 0 completada. Cutover PG y normalizacin al 100%. Tests 83/83 en dev)

â†’ Ver detalle completo en [`LOGROS.md`](./LOGROS.md)

---

## PrÃ³ximos Pasos Inmediatos (Top 5)

| Prioridad | AcciÃ³n | Requiere |
|-----------|--------|----------|
| 1 | ðŸ”‘ Conectar `TELEGRAM_BOT_TOKEN` (BotFather) y probar el bot real vÃ­a `/webhooks/telegram` o `/api/channels/test` | Token de bot |
| 2 | ðŸ”’ Resolver checklist de seguridad pre-deploy (`docs/SECURITY-GAPS-PRE-DEPLOY.md`: S1-S3) | Etapa deploy |
| 3 | âš™ï¸ Activar workflows n8n (01-inbound, 02-broadcast) con credenciales en UI (:5679) | UI n8n |
| 4 | ðŸ“Š Validar dashboards Kibana con los 3 datastreams (traces+metrics+logs) | Kibana :5601 |
| 5 | â–¶ï¸ F-09 cutover PG (feature flag STORE_MODE=pg cuando RLS tenant complete) + F-51 load test k6 | Ver TEC-06 |

â†’ Ver detalle completo en [`OBJETIVOS-PENDIENTES.md`](./OBJETIVOS-PENDIENTES.md)

---

## Estructura del Proyecto

```
wibsite/
â”œâ”€â”€ Avances/                  # â† ESTÃ AQUÃ â€” Documento vivo de estado
â”‚   â”œâ”€â”€ ESTADO-GENERAL.md     #   Este archivo â€” visiÃ³n general
â”‚   â”œâ”€â”€ LOGROS.md             #   Todo lo completado hasta ahora
â”‚   â”œâ”€â”€ OBJETIVOS-PENDIENTES.md  #   Pendientes priorizados
â”‚   â”œâ”€â”€ COMPONENTES.md        #   Matriz de salud de servicios
â”‚   â”œâ”€â”€ PROCEDIMIENTOS.md     #   Comandos y pasos operativos
â”‚   â””â”€â”€ ROADMAP.md            #   Hoja de ruta futura
â”œâ”€â”€ docs/                     # DocumentaciÃ³n detallada
â”œâ”€â”€ specs/                    # Especificaciones tÃ©cnicas
â”œâ”€â”€ scripts/                  # Scripts de automatizaciÃ³n
â”œâ”€â”€ helper-node/              # Servicio Express.js personalizado
â”œâ”€â”€ n8n/workflows/            # Workflows n8n
â”œâ”€â”€ dify/workflows/           # Workflows Dify
â”œâ”€â”€ authelia/                 # ConfiguraciÃ³n Authelia
â”œâ”€â”€ certs/                    # Certificados SSL
â”œâ”€â”€ docker-compose.yml        # OrquestaciÃ³n de servicios
â”œâ”€â”€ nginx.conf                # ConfiguraciÃ³n Nginx
â””â”€â”€ .env                      # Variables de entorno
```

---

## Comandos RÃ¡pidos

```bash
# Ver estado de servicios
docker compose ps

# Verificar health de helper-node
curl http://localhost:3100/health

# Ver salud Elastic Stack
curl http://localhost:9200/_cluster/health
# Kibana: http://localhost:5601

# Ejecutar suite TeVS (PowerShell)
./scripts/tevs/tevs-runner.ps1 -Environment local -ElasticUrl "http://localhost:9200"

# Ver dashboard de campaÃ±as
curl http://localhost:3100/api/dashboard/summary

# Poblar datos de prueba
curl -X POST http://localhost:3100/api/seed

# Verificar conexiÃ³n Twenty CRM
curl http://localhost:3100/api/twenty/health
```