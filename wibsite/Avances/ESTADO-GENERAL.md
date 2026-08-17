# Wibsite Business — Estado General del Proyecto

> Documento vivo de desarrollo — Refleja el estado actual del proyecto en tiempo real

---

## Ficha del Proyecto

| Campo | Valor |
|-------|-------|
| **Nombre** | Wibsite Business |
| **Propósito** | Plataforma de mensajería omnicanal con IA para PYMEs (WhatsApp, Messenger, TikTok, SMS, Email, Telegram) |
| **Stack** | Chatwoot + Dify + n8n + Twenty CRM + Helper Node + PostgreSQL + Redis + Weaviate + Elastic Stack (Elasticsearch + Kibana + OTel Collector) + MinIO |
| **Orquestación** | Docker Compose (20 servicios) |
| **Estado General** | 🟡 **Fase 1 en progreso — 40+/56 fases TEC-06 ✅** — Pendientes: secretos pre-deploy, cutover PG completo (lecturas), Frappe/ERP (diferido), SaaS/piloto |
| **Última actualización** | 2026-08-15 (verificación en vivo: stack 20 contenedores, gateway 200, tests 176/176 en 22 suites, TeVS 13/13, e2e-trace 10/10) |
| **Helper Node** | v2.2.0 — ~130 rutas, 176 tests (22 suites) |

---

## Barra de Progreso por Área

```
Infraestructura         ████████████████████ 100%  ✅  +Authelia, Elastic Stack, MinIO (compose 20 servicios)
Helper Node             ████████████████████ 100%  ✅  v2.2.0 + store facade dual-write + agentCore + templateEngine (~120 rutas)
Middleware Seguridad    ████████████████████ 100%  ✅  Auth, Rate Limit, Sanitizer, HMAC + PII filter
Conversation Store      ████████████████████ 100%  ✅  State machine 9 estados + checkpointer (conversation_summaries migrada a PG 15/08)
Lead Profile Builder    ████████████████████ 100%  ✅  Tags, next action, score history
Agent Config Editor     ████████████████████ 100%  ✅  10 tipos negocio, 5 personalidades
RAG Engine              ████████████████████ 100%  ✅  Weaviate + fallback in-memory
Anti-Hallucination      ████████████████████ 100%  ✅  Boundaries, triggers, unknown responses
SLI/SLO Monitoring      ████████████████████ 100%  ✅  Health+, metrics, uptime tracking + prom-client
Template Engine         ████████████████████ 100%  ✅  Load, validate, merge, 3 plantillas
Agent Graph Engine      ████████████████████ 100%  ✅  Grafo 9 nodos (F-16) + checkpointer (F-14) + guards (F-17) + Dify/fallback (F-18) + sync comercial (F-21)
Audit Logging           ████████████████████ 100%  ✅  PII filter + 24 event types + PG + puente OTLP logs → Elasticsearch (15/08)
Portal Shell            ████████████████████ 100%  ✅  9 módulos, SSO, postMessage
CRM Metodológico        ████████████████████ 100%  ✅  Script SPICED/MEDDIC 13 campos
Verificación            ████████████████████ 100%  ✅  TeVS 11/11 + e2e-trace 10/10 + 169 tests Jest (19 suites)
Observabilidad          ████████████████████ 100%  ✅  ES 9.4.2 + Kibana + OTel: traces+metrics+logs con rollover diario (ILM 1d/30d, 15/08)
Dify (IA)               ████████████████████ 100%  ✅
Twenty CRM              ████████████████████ 100%  ✅
n8n Workflows           ██████████████████░░  90%  ⚠️  3 workflows activos en BD; falta toggle UI y credenciales
Multicanal              ██████████████████░░  90%  ✅  Pipeline unificado: Email+Telegram+WhatsApp+Messenger+TikTok + broadcast + pruebas por canal; falta conectar tokens
Multimodal              ██████████████████░░  90%  ✅  STT (audio→texto) + visión (imagen→descripción) + TTS (texto→voz con reply_audio) vía OpenRouter
RAG de negocio          ████████████████████ 100%  ✅  Conectado al grafo (nodo kb) + carga de kb-documents en arranque — verificado en runtime
Cotizaciones            ████████████████████ 100%  ✅  Cuestionarios por servicio (8 servicios) + estimación por alcance + mini-cotización (nodo cotizacion)
Portal Shell            ██████████████████░░  90%  ✅  8 módulos SSO + Lead Panel + búsqueda Ctrl+K + notificaciones; postMessage cross-module pendiente
Carga (F-51)            ████████████████████ 100%  ✅  k6 + simulador node: 8 conv p95 1177ms · 3.29 turnos/s
n8n Workflows           ██████████████████░░  90%  ⚠️  2/3 activos en runtime (01 inbound + 02 broadcast); tercero variante con credenciales pendientes
Documentación           ████████████████████ 100%  ✅  100+ archivos técnicos
Scripts/Automatiz.      ████████████████████ 100%  ✅  backup, migrate, verify, fields, orphan-check
Chatwoot Inbox          ████████████████░░░░  80%  ⚠️  Inbox + puente Twilio configurado
Meta WhatsApp API       ████████████████░░░░  80%  ⚠️  Webhook Meta listo (/webhooks/whatsapp); envío por Twilio hasta migración
SSO (Authelia)          ████████████████████ 100%  ✅  Config compose + nginx auth_request (verificado 403 sin SSO)
Flujo Inbound Real      ████████████████████ 100%  ✅  Twilio→helper→n8n→Dify→Twenty (F-05) + pipeline multicanal (15/08)
Flujo Campaign Real     ████████████████████ 100%  ✅  /api/twilio/send + StatusCallback (F-06)
Tests Unitarios         ████████████████████ 100%  ✅  176 tests (22 suites) — 15/08
TeVS (Elastic)            13/13 PASSED (15/08)
Dual-Write PG           ████████████████████ 100%  ✅  Rutas conectadas al facade (F-08): campañas/leads/scores/opt-outs verificados en PG (15/08)
```

---

## Resumen de Estado por Componente

| Componente | Estado | Funcionalidad | Pendiente Clave |
|-----------|--------|--------------|-----------------|
| **PostgreSQL** | ✅ Operativo | 5 bases de datos activas | — |
| **Redis** | ✅ Operativo | Caché y colas | — |
| **Weaviate** | ✅ Operativo | Búsqueda vectorial | — |
| **Nginx** | ✅ Operativo | Proxy reverso en :8080 | — |
| **Chatwoot** | ✅ Servicio OK + bridge Twilio | UI funcional, webhook n8n configurable, push inbound `/api/chatwoot/push` | Configurar inbox WhatsApp nativo (opcional) |
| **Dify** | ✅ Completo | Workflow clasificador funcional con OpenRouter | — |
| **n8n** | ✅ Servicio OK, ⚠️ Config pendiente | Workflows importados, body parser bug conocido | Activar workflows UI, crear credenciales |
| **Twenty CRM** | ✅ Completo | API key JWT, 10 campos custom, sync funcional | — |
| **Helper Node** | ✅ Completo | ~108 rutas (~35+ grupos), dashboard SPA, PostgreSQL + JSON fallback | — |
| **Elasticsearch** | ✅ Operativo | Datastreams traces/metrics/logs con ILM rollover 1d + delete 30d (15/08) | — |
| **Kibana** | ✅ Operativo | UI observabilidad en :5601 | — |
| **OTel Collector** | ✅ Operativo | OTLP :4317/:4318 → ES: traces + metrics + logs (helper emite logs 15/08) | — |
| **MinIO** | ✅ Operativo | Object storage :9000 + consola :9001 | — |
| **Meta API** | ⚠️ Webhook listo | `/webhooks/whatsapp` (GET verify + POST) | Envío por Twilio hasta migración |
| **Authelia** | ✅ Operativo | Gateway SSO con nginx auth_request — verificado 403 sin SSO (14/08) | — |
| **Telegram** | ✅ Adapter listo | Bot API sendMessage + webhook + normalización (voz/foto/video) | Conectar TELEGRAM_BOT_TOKEN y probar con bot real |
| **Multimodal** | ✅ Bases | STT (OpenRouter transcripciones) + visión (gpt-4o-mini) con degradación elegante | Configurar OPENROUTER_STT_MODEL |
| **Frappe/ERP** | ⬜ Diferido | Ruta nginx `/erp/` comentada; decisión de negocio futura | F-28/F-29 |
| **Metabase/BI** | ⬜ Diferido | Ruta nginx `/reportes/` comentada | F-52 |

> **Verificación en vivo (2026-08-15):** Docker Desktop activo, 20 contenedores, gateway HTTPS 200 (/hub/, /api/health), 403 sin SSO (/api/campaigns), helper :3100 200, n8n :5679 200, Dify :5001 200. Dual-write PG verificado end-to-end (campaña→lead→score→opt-out). Pipeline multicanal verificado con webhook Telegram simulado (lead + grafo + LLM OpenRouter real + auditoría en PG y ES).

---

## Logros Clave (Resumen)

- 20 servicios Docker orquestados y comunicándose (incluye Elastic Stack + MinIO)
- Helper Node con CRUD completo de campañas multi-canal, scoring, templates, sync CRM
- Workflow Dify de 8 nodos LLM funcional clasificando leads vía OpenRouter
- 10 campos personalizados en Twenty CRM con sincronización bidireccional
- 3 workflows n8n importados (inbound message + campaign broadcast + score & sync)
- Bridge Twilio real funcionando (inbound + broadcast con StatusCallback, F-03…F-06)
- Elastic Stack + OpenTelemetry configurados (reemplazan Prometheus/Grafana/GlitchTip)
- Suite TeVS creada (11 tests integración con Elasticsearch) — pendiente de ejecución
- 100+ archivos de documentación técnica
- Dashboard SPA con monitoreo en tiempo real + hub/control-center
- Upload Excel/CSV con auto-detección de columnas
- Motor agéntico ejecutable (Oleada C, 2026-08-12): grafo 9 nodos con aristas condicionales, checkpointer de memoria (Redis + PG `conversation_summaries`), guards de confidencialidad/autonomía (zonas green/yellow/red con PII assisted), Dify como nodo con fallback OpenRouter + circuit breaker, y sync máquina comercial↔técnica vía `commercialState`
- **Oleada multicanal + monitoreo (2026-08-15):** dual-write PG conectado a las rutas de negocio (F-08) y verificado end-to-end en runtime; migración `conversation_summaries` aplicada (F-14); ILM rollover diario (1d/30d) en traces/logs/metrics; puente OTLP logs (helper → ES logs datastream, 109+ docs); pipeline multicanal unificado (Email · Telegram · WhatsApp · Messenger · TikTok) + bases multimodales (STT audio + visión de imágenes vía OpenRouter, degradación elegante); tests 169/169 en 19 suites; TeVS 11/11 y e2e-trace 10/10 re-ejecutados; residuos limpiados (monitoring/ prometheus-grafana, rutas nginx /erp/ y /reportes/ comentadas)

→ Ver detalle completo en [`LOGROS.md`](./LOGROS.md)

---

## Próximos Pasos Inmediatos (Top 5)

| Prioridad | Acción | Requiere |
|-----------|--------|----------|
| 1 | 🔑 Conectar `TELEGRAM_BOT_TOKEN` (BotFather) y probar el bot real vía `/webhooks/telegram` o `/api/channels/test` | Token de bot |
| 2 | 🔒 Resolver checklist de seguridad pre-deploy (`docs/SECURITY-GAPS-PRE-DEPLOY.md`: S1-S3) | Etapa deploy |
| 3 | ⚙️ Activar workflows n8n (01-inbound, 02-broadcast) con credenciales en UI (:5679) | UI n8n |
| 4 | 📊 Validar dashboards Kibana con los 3 datastreams (traces+metrics+logs) | Kibana :5601 |
| 5 | ▶️ F-09 cutover PG (feature flag STORE_MODE=pg cuando RLS tenant complete) + F-51 load test k6 | Ver TEC-06 |

→ Ver detalle completo en [`OBJETIVOS-PENDIENTES.md`](./OBJETIVOS-PENDIENTES.md)

---

## Estructura del Proyecto

```
wibsite/
├── Avances/                  # ← ESTÁ AQUÍ — Documento vivo de estado
│   ├── ESTADO-GENERAL.md     #   Este archivo — visión general
│   ├── LOGROS.md             #   Todo lo completado hasta ahora
│   ├── OBJETIVOS-PENDIENTES.md  #   Pendientes priorizados
│   ├── COMPONENTES.md        #   Matriz de salud de servicios
│   ├── PROCEDIMIENTOS.md     #   Comandos y pasos operativos
│   └── ROADMAP.md            #   Hoja de ruta futura
├── docs/                     # Documentación detallada
├── specs/                    # Especificaciones técnicas
├── scripts/                  # Scripts de automatización
├── helper-node/              # Servicio Express.js personalizado
├── n8n/workflows/            # Workflows n8n
├── dify/workflows/           # Workflows Dify
├── authelia/                 # Configuración Authelia
├── certs/                    # Certificados SSL
├── docker-compose.yml        # Orquestación de servicios
├── nginx.conf                # Configuración Nginx
└── .env                      # Variables de entorno
```

---

## Comandos Rápidos

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

# Ver dashboard de campañas
curl http://localhost:3100/api/dashboard/summary

# Poblar datos de prueba
curl -X POST http://localhost:3100/api/seed

# Verificar conexión Twenty CRM
curl http://localhost:3100/api/twenty/health
```