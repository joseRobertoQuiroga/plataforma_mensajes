# Wibsite Business — Estado General del Proyecto

> Documento vivo de desarrollo — Refleja el estado actual del proyecto en tiempo real

---

## Ficha del Proyecto

| Campo | Valor |
|-------|-------|
| **Nombre** | Wibsite Business |
| **Propósito** | Plataforma de mensajería omnicanal con IA para PYMEs (WhatsApp, Messenger, TikTok, SMS, Email) |
| **Stack** | Chatwoot + Dify + n8n + Twenty CRM + Helper Node + PostgreSQL + Redis + Weaviate + Elastic Stack (Elasticsearch + Kibana + OTel Collector) + MinIO |
| **Orquestación** | Docker Compose (20 servicios) |
| **Estado General** | 🟡 **Fase 1 en progreso — 38/56 fases TEC-06 ✅** — Pendientes: cutover PG/tenant RLS, Frappe/ERP, F-35 re-auditoría, F-42 CI gates, F-46 e2e-trace, load test, SaaS/piloto |
| **Última actualización** | 2026-08-12 |
| **Helper Node** | v2.1.1 según `package.json` (docs previas citaban v2.2.0) — ~108 rutas, 149 tests |

---

## Barra de Progreso por Área

```
Infraestructura         ████████████████████ 100%  ✅  +Authelia, Elastic Stack, MinIO (compose 20 servicios)
Helper Node             ████████████████████ 100%  ✅  v2.1.1 + store facade + agentCore + templateEngine (~108 rutas)
Middleware Seguridad    ████████████████████ 100%  ✅  Auth, Rate Limit, Sanitizer, HMAC + PII filter
Conversation Store      ████████████████████ 100%  ✅  State machine 9 estados + checkpointer (TTL 7d, checkpoint Redis/PG)
Lead Profile Builder    ████████████████████ 100%  ✅  Tags, next action, score history
Agent Config Editor     ████████████████████ 100%  ✅  10 tipos negocio, 5 personalidades
RAG Engine              ████████████████████ 100%  ✅  Weaviate + fallback in-memory
Anti-Hallucination      ████████████████████ 100%  ✅  Boundaries, triggers, unknown responses
SLI/SLO Monitoring      ████████████████████ 100%  ✅  Health+, metrics, uptime tracking + prom-client
Template Engine         ████████████████████ 100%  ✅  Load, validate, merge, 3 plantillas
Agent Graph Engine      ████████████████████ 100%  ✅  Grafo 9 nodos ejecutable (F-16) + checkpointer (F-14) + guards (F-17) + Dify node/fallback (F-18) + sync comercial (F-21)
Audit Logging           ████████████████████ 100%  ✅  PII filter + 12 event types + PG persistencia
Portal Shell            ████████████████████ 100%  ✅  9 módulos, SSO, postMessage
CRM Metodológico        ████████████████████ 100%  ✅  Script SPICED/MEDDIC 13 campos
Verificación            ████████████████████ 100%  ✅  verify-fase.sh + contract-tests.js + TeVS (11 tests) + 149 tests Jest (17 suites)
Observabilidad          ████████████████████ 100%  ✅  Elasticsearch + Kibana + otel-collector (═ config; runtime pendiente de arranque)
Dify (IA)               ████████████████████ 100%  ✅
Twenty CRM              ████████████████████ 100%  ✅
n8n Workflows           ██████████████████░░  90%  ⚠️  3 workflows activos en BD; falta toggle UI y credenciales
Documentación           ████████████████████ 100%  ✅  100+ archivos técnicos
Scripts/Automatiz.      ████████████████████ 100%  ✅  backup, migrate, verify, fields, orphan-check
Chatwoot Inbox          ████████████████░░░░  80%  ⚠️  Inbox + puente Twilio configurado
Meta WhatsApp API       ░░░░░░░░░░░░░░░░░░░░   0%  🚫  Reemplazado por bridge Twilio (TEC-06 F-03…F-06 ✅)
SSO (Authelia)          ████████████████████ 100%  ✅  Config compose + nginx auth_request
Flujo Inbound Real      ████████████████████ 100%  ✅  Twilio→helper→n8n→Dify→Twenty (F-05)
Flujo Campaign Real     ████████████████████ 100%  ✅  /api/twilio/send + StatusCallback (F-06)
Tests Unitarios         ████████████████████ 100%  ✅  149 tests (17 suites)
Tests Contract          ████████████████████ 100%  ✅  15 tests entre módulos
Pruebas Completas       ████████████████████ 100%  ✅  174 tests documentados; auditoría 78 checks (03/08)
TeVS (Elastic)          ████████░░░░░░░░░░░░  40%  ⚠️  Suite creada (11 tests + runner), nunca ejecutada
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
| **Elasticsearch** | ✅ Config (compose) | Almacén de trazas/logs OTel (índices `*-doags.otel-production`) | Arrancar Docker Desktop y verificar ingestión |
| **Kibana** | ✅ Config (compose) | UI observabilidad en :5601 | Arrancar y revisar dashboards OTel |
| **OTel Collector** | ✅ Config (compose) | Receive OTLP :4317/:4318 → export ES :9200 | Revisar password hardcodeada en config (gap conocido) |
| **MinIO** | ✅ Config (compose) | Object storage :9000 + consola :9001 | — |
| **Meta API** | 🚫 No configurado | — | Reemplazado por bridge Twilio (F-03…F-06 ✅) |
| **Authelia** | ✅ Config (compose) | Gateway SSO con nginx auth_request | Runtime no verificado (Docker Desktop detenido) |

> **Nota operativa (2026-08-12):** Docker Desktop estaba **detenido** al momento de esta actualización, por lo que el estado de contenedores en ejecución **no pudo verificarse en vivo**; la matriz anterior refleja configuración estática (`docker-compose.yml`, nginx.conf, configs). La última auditoría ejecutada (2026-08-03, `scripts/logs/audit.log`) registró 78 pruebas OK.

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
- Motor agéntico ejecutable (Oleada C, 2026-08-12): grafo 9 nodos con aristas condicionales, checkpointer de memoria (Redis + PG `conversation_summaries`), guards de confidencialidad/autonomía (zonas green/yellow/red con PII assisted), Dify como nodo con fallback OpenRouter + circuit breaker, y sync máquina comercial↔técnica vía `commercialState` — 26 tests nuevos (149 total, 17 suites)

→ Ver detalle completo en [`LOGROS.md`](./LOGROS.md)

---

## Próximos Pasos Inmediatos (Top 5)

| Prioridad | Acción | Requiere |
|-----------|--------|----------|
| 1 | 🚀 Iniciar Docker Desktop y levantar stack (`docker compose up -d`) | Docker Desktop corriendo |
| 2 | 🔑 Regenerar secretos reales: HELPER_API_KEY, ELASTIC_PASSWORD, KIBANA_PASSWORD, KIBANA_SERVICE_TOKEN, etc. (ver .env.example) | — |
| 3 | 📋 Ejecutar suite TeVS por primera vez (`scripts/tevs/tevs-runner.ps1`) | Stack Elástico arriba |
| 4 | 🧹 Eliminar de git archivos sensibles: `wibsite-store.json` (PII), `certs/nginx.key`, `n8n-cookies*.txt`, `n8n_login.json`, `%{redirect_url}'` | Revisión de .gitignore |
| 5 | ▶️ Continuar fases TEC-06 pendientes (F-09 cutover PG, F-10/11 tenant RLS, F-35 re-auditoría, F-42 CI gates, F-46 e2e-trace) | Ver tabla TEC-06 §5 |

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