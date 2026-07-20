# Wibsite Business — Estado General del Proyecto

> Documento vivo de desarrollo — Refleja el estado actual del proyecto en tiempo real

---

## Ficha del Proyecto

| Campo | Valor |
|-------|-------|
| **Nombre** | Wibsite Business |
| **Propósito** | Plataforma de mensajería omnicanal con IA para PYMEs (WhatsApp, Messenger, TikTok, SMS, Email) |
| **Stack** | Chatwoot + Dify + n8n + Twenty CRM + Helper Node + PostgreSQL + Redis + Weaviate |
| **Orquestación** | Docker Compose (11 servicios) |
| **Estado General** | 🟡 **Fase 1 en progreso (~75%)** — Nuevos módulos: seguridad, state machine, RAG, agente config, SLI |
| **Última actualización** | 2026-07-19 |
| **Helper Node** | v2.2.0 — 112 tests unitarios + integración pasando |

---

## Barra de Progreso por Área

```
Infraestructura      ████████████████████ 100%  ✅
Helper Node          ████████████████████ 100%  ✅  v2.2.0
Middleware Seguridad ████████████████████ 100%  ✅  Auth, Rate Limit, Sanitizer, HMAC
Conversation Store   ████████████████████ 100%  ✅  State machine 9 estados (Redis + in-memory)
Lead Profile Builder ████████████████████ 100%  ✅  Tags, next action, score history
Agent Config Editor  ████████████████████ 100%  ✅  10 tipos negocio, 5 personalidades
RAG Engine           ████████████████████ 100%  ✅  Weaviate + fallback in-memory
Anti-Hallucination   ████████████████████ 100%  ✅  Boundaries, triggers, unknown responses
SLI/SLO Monitoring   ████████████████████ 100%  ✅  Health+, metrics, uptime tracking
Dify (IA)            ████████████████████ 100%  ✅
Twenty CRM           ████████████████████ 100%  ✅
n8n Workflows        ██████████████████░░  90%  ⚠️  Falta toggle UI y credenciales
Documentación        ████████████████████ 100%  ✅
Scripts/Automatiz.   ████████████████████ 100%  ✅
Chatwoot Inbox       ████░░░░░░░░░░░░░░░░  20%  ⚠️  Falta Meta App
Meta WhatsApp API    ░░░░░░░░░░░░░░░░░░░░   0%  🚫
SSO (Authelia)       ░░░░░░░░░░░░░░░░░░░░   0%  🚫
Flujo Inbound Real   ░░░░░░░░░░░░░░░░░░░░   0%  🚫
Flujo Campaign Real  ░░░░░░░░░░░░░░░░░░░░   0%  🚫
Tests Unitarios      ████████████████████ 100%  ✅  112 tests (8 suites) pasando
```

---

## Resumen de Estado por Componente

| Componente | Estado | Funcionalidad | Pendiente Clave |
|-----------|--------|--------------|-----------------|
| **PostgreSQL** | ✅ Operativo | 5 bases de datos activas | — |
| **Redis** | ✅ Operativo | Caché y colas | — |
| **Weaviate** | ✅ Operativo | Búsqueda vectorial | — |
| **Nginx** | ✅ Operativo | Proxy reverso en :8080 | — |
| **Chatwoot** | ✅ Servicio OK, ⚠️ Inbox pendiente | UI funcional, webhook n8n configurable | Configurar inbox WhatsApp + webhook |
| **Dify** | ✅ Completo | Workflow clasificador funcional con OpenRouter | — |
| **n8n** | ✅ Servicio OK, ⚠️ Config pendiente | Workflows importados, body parser bug conocido | Activar workflows UI, crear credenciales |
| **Twenty CRM** | ✅ Completo | API key JWT, 10 campos custom, sync funcional | — |
| **Helper Node** | ✅ Completo | 35+ endpoints, dashboard SPA, PostgreSQL + JSON fallback | — |
| **Meta API** | 🚫 No configurado | — | Crear Meta App, obtener credenciales |
| **Authelia** | 🚫 No configurado | Configuración preparada | Implementar como gateway SSO |

---

## Logros Clave (Resumen)

- 11 servicios Docker orquestados y comunicándose
- Helper Node con CRUD completo de campañas multi-canal, scoring, templates, sync CRM
- Workflow Dify de 8 nodos LLM funcional clasificando leads vía OpenRouter
- 10 campos personalizados en Twenty CRM con sincronización bidireccional
- 2 workflows n8n importados (inbound message + campaign broadcast)
- 25+ archivos de documentación técnica
- Dashboard SPA con monitoreo en tiempo real
- Upload Excel/CSV con auto-detección de columnas

→ Ver detalle completo en [`LOGROS.md`](./LOGROS.md)

---

## Próximos Pasos Inmediatos (Top 5)

| Prioridad | Acción | Requiere |
|-----------|--------|----------|
| 1 | 🚀 Iniciar Docker Desktop + `docker compose up -d` | Docker Desktop instalado |
| 2 | 🌐 Configurar Meta App Business (rellenar META_APP_SECRET en .env) | Cuenta Facebook Business + Meta Developers |
| 3 | 🔑 Generar HELPER_API_KEY y agregar al .env (openssl rand -hex 32) | — |
| 4 | 📡 Configurar webhooks Meta → helper (usar ngrok para URL pública) | Meta App funcionando |
| 5 | ✅ Activar workflows n8n desde UI + configurar credenciales | n8n accesible en :5679 |

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

# Ver dashboard de campañas
curl http://localhost:3100/api/dashboard/summary

# Poblar datos de prueba
curl -X POST http://localhost:3100/api/seed

# Verificar conexión Twenty CRM
curl http://localhost:3100/api/twenty/health
```
