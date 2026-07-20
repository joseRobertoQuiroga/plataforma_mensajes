# Wibsite Business — Estado del Proyecto y Roadmap

> **Documento maestro**: visión general del proyecto, fases, estado actual y hoja de ruta.
> Versión: 2026-07-10 (v2.1.1)

---

## 1. Visión General del Proyecto

### Meta Final
Plataforma SaaS de mensajería omnicanal con IA que permita a negocios:
- **Gestionar múltiples cuentas** (WhatsApp Business, Facebook Messenger, TikTok, SMS, Email)
- **Operar múltiples usuarios** con roles y permisos
- **Agencia IA 24/7** que responda, clasifique, puntúe y dé seguimiento a leads
- **Campañas multi-canal** programadas con tracking en tiempo real
- **Dashboard de monitoreo** con indicadores de estado (LEDs)
- **Multi-dispositivo** vía web (responsive)

### Objetivo Inmediato (Plantilla Base)
Tener una **plantilla llave en mano** que:
- Se despliegue con un solo `docker compose up`
- Tenga toda la infraestructura lista
- Solo requiera: credenciales Meta, API key de LLM y personalización de prompts por cliente
- Sirva como base para probar con mi negocio antes de ofrecerlo como SaaS

---

## 2. Arquitectura del Sistema

```
                    ┌──────────────────────────────────────┐
                    │         Nginx :8080 (Hub)             │
                    │  Unifica: Dify, n8n, Chatwoot,       │
                    │  Twenty CRM, Helper Dashboard          │
                    └──────┬──────┬──────┬──────┬──────────┘
                           │      │      │      │
              ┌────────────┘      │      │      └────────────┐
              ▼                   ▼      ▼                   ▼
     ┌──────────────┐   ┌───────────┐ ┌────────┐   ┌──────────────┐
     │ Dify :5001   │   │ n8n :5679 │ │Twenty  │   │ Helper :3100 │
     │ API + Web    │   │ Workflows │ │CRM     │   │ Dashboard    │
     │ Plugin-Based │   │           │ │:3001   │   │ Campañas     │
     └──────┬───────┘   └─────┬─────┘ └────────┘   └──────┬───────┘
            │                │                            │
            ▼                ▼                            ▼
     ┌──────────┐    ┌──────────────┐           ┌──────────────┐
     │ Plugin   │    │ Chatwoot     │           │ PostgreSQL   │
     │ Daemon   │    │ :3002        │           │ + Redis      │
     │ :5002    │    │ Inbox        │           │ + Weaviate   │
     └────┬─────┘    └──────┬───────┘           └──────────────┘
          │                 │
          ▼                 ▼
     ┌──────────┐    ┌──────────────┐
     │ LLMs     │    │ Meta API     │
     │(xAI/     │    │ WhatsApp     │
     │ OpenAI)  │    │ Messenger    │
     └──────────┘    └──────────────┘
```

---

## 3. Fases del Proyecto

### Fase 0 — Fundación (✅ COMPLETADA)
| Componente | Estado | Detalle |
|-----------|--------|---------|
| Docker Compose (11 servicios) | ✅ | PostgreSQL, Redis, Weaviate, Chatwoot, Dify, n8n, Twenty, Helper, Nginx, Plugin Daemon |
| Bases de datos | ✅ | chatwoot, dify, n8n, twenty, wibsite, dify_plugin |
| Redes y comunicación interna | ✅ | Todos los servicios se ven por nombre de contenedor |
| Nginx reverse proxy | ✅ | Rutas unificadas en puerto 8080 |

### Fase 0.5 — Conectividad (🔄 EN PROGRESO — 95%)
| Componente | Estado | Detalle |
|-----------|--------|---------|
| Plugin openai_api_compatible | ✅ | Instalado desde marketplace |
| n8n login y owner | ✅ | admin@wibsite.com / Admin@123 |
| Workflows n8n importados | ✅ | 01-inbound-message + 02-campaign-broadcast |
| Twenty CRM + API key | ✅ | Conectado, JWT configurado |
| Helper-node v2 PostgreSQL | ✅ | CRUD campañas, leads, scoring, tracking |
| Dashboard monitoreo LEDs | ✅ | http://localhost:3100 |
| Documentación completa | ✅ | docs/ con índice, contexto por módulo, RAG, ADR, runbook, glosario |
| **Nginx hub + resolver Chatwoot** | ✅ | Nginx arranca sin Chatwoot. 7/8 rutas OK |
| **Excel/CSV upload** | ✅ | Endpoint + UI drag & drop + preview |
| **11 plantillas de mensajes** | ✅ | WhatsApp, Messenger, TikTok, SMS, Email |
| **Seed data + botones dashboard** | ✅ | Seed/Clear/Refresh/Sync CRM/Score All |
| **10 campos custom Twenty CRM** | ✅ | Creados en people con prefijo lead |
| **Twenty CRM sync endpoints** | ✅ | Sync individual + batch. Paginación corregida. |
| **Scoring engine rule-based** | ✅ | 5 factores + 8 reglas + umbrales. Refactorizado: función compartida evaluateLead() |
| **OpenRouter LLM** | ✅ | 3 endpoints: health, chat, evaluate-llm. Modelo gpt-4o-mini |
| **Legacy v1 endpoints restaurados** | ✅ | 7 rutas /campaigns/* para compatibilidad n8n |
| **Storage lock corregido (race condition)** | ✅ | storeLock promise chain en updateStore. Seed también protegido |
| **Twenty phone normalization** | ✅ | Empty phone → '' en vez de '+' (error 400) |
| **Duplicate campaign names** | ✅ | 409 Conflict si nombre ya existe |
| **Pruebas y verificaciones** | ✅ | Auditoría completa 14/14 issues + 2 nuevos bugs corregidos |
| **Chatwoot** | ⬜ En reinicio | 502 en nginx. Script diagnose-chatwoot.ps1 listo |
| **Meta/WhatsApp credentials** | ❌ **BLOQUEADO** | Requiere: META_APP_ID, WHATSAPP_PHONE_NUMBER_ID |
| **Helper Node authentication** | ❌ **BLOQUEADO PARCIAL** | Zero auth. Propuesto Gateway/SSO en ADR-016 |
| **Chatwoot → n8n webhook** | ❌ **BLOQUEADO** | Requiere Meta |

### Fase 1 — Hub Unificado (✅ COMPLETADA)
| Componente | Prioridad | Dependencia |
|-----------|-----------|-------------|
| Página hub con cards (tipo Odoo) | Alta | Ninguna |
| Reorganizar rutas nginx | Alta | Ninguna |
| Accesos directos a cada módulo | Alta | Ninguna |
| Estado en vivo en cada card | Media | Ninguna |
| Resolver Chatwoot nginx (resolver + variable) | Alta | Ninguna |

### Fase 2 — Carga Masiva y Gestión de Leads (✅ COMPLETADA)
| Componente | Prioridad | Dependencia |
|-----------|-----------|-------------|
| Endpoint upload Excel/CSV | Alta | Ninguna |
| Parseo y validación de columnas | Alta | Ninguna |
| UI de importación en dashboard | Alta | Ninguna |
| Reporte de errores por fila | Media | Ninguna |
| Templates de campaña por canal | Media | Ninguna |
| Scoring rule-based | Alta | Ninguna |
| Seed data + botones acción rápida | Media | Ninguna |

### Fase 3 — Agente IA 24/7 (⬜ BLOQUEADO PARCIAL)
| Componente | Prioridad | Dependencia |
|-----------|-----------|-------------|
| Dify Agent conversacional | Alta | LLM |
| Knowledge Base en Weaviate | Alta | LLM + documentos |
| Extracción de datos de dolor | Alta | LLM |
| Scoring post-conversación IA | Alta | LLM |
| **Scoring rule-based (alternativa)** | ✅ | Hecho — reemplazo de IA |
| **Campos custom Twenty CRM** | ✅ | Hecho — 10 campos en people |
| Webhook post-conversación Chatwoot | Media | Meta |

### Fase 4 — Campañas Multi-Canal (⬜ BLOQUEADO)
| Componente | Prioridad | Dependencia |
|-----------|-----------|-------------|
| Template WhatsApp con variables | Alta | Meta |
| Template Messenger | Media | Meta |
| Template TikTok | Baja | API TikTok |
| **Plantillas predefinidas por canal** | ✅ | Hecho — 11 plantillas seed |
| Programación de campañas | Alta | Ninguna (endpoints listos) |
| Tracking por canal | Alta | Ninguna (schema listo) |

### Fase 5 — SaaS Multi-Tenant (⬜ FUTURO)
| Componente | Prioridad | Dependencia |
|-----------|-----------|-------------|
| Autenticación multi-tenant | Alta | Todo lo anterior |
| Aislamiento de datos por tenant | Alta | Todo lo anterior |
| Panel de administración | Alta | Todo lo anterior |
| Facturación y suscripciones | Media | Todo lo anterior |
| Onboarding automatizado | Media | Todo lo anterior |

---

## 4. Estado Actual Detallado

### Lo que FUNCIONA (probado y verificado)

```
✅ docker-compose up -d              →  11 servicios levantados
✅ http://localhost:8080/hub/        →  Hub central con 8 cards
✅ http://localhost:8080/admin/      →  Dashboard vía nginx
✅ http://localhost:8080/api/health  →  Helper v2 vía nginx
✅ http://localhost:3100/health      →  Helper v2 (PostgreSQL conectado)
✅ http://localhost:5679             →  n8n login (admin@wibsite.com)
✅ http://localhost:3001             →  Twenty CRM (API key funcional)
✅ http://localhost:3003             →  Dify Web (plugin instalado)
✅ POST /api/campaigns               →  Crear campaña (+ validación nombre único)
✅ POST /campaigns                   →  Legacy v1 restaurado
✅ GET /campaigns                    →  Legacy v1 restaurado
✅ GET /campaigns/pending            →  Legacy v1 restaurado
✅ POST /campaigns/:id/schedule      →  Legacy v1 restaurado
✅ POST /campaigns/:id/complete      →  Legacy v1 restaurado
✅ POST /campaigns/track             →  Legacy v1 restaurado
✅ GET /campaigns/:id/stats          →  Legacy v1 restaurado
✅ POST /api/campaigns/:id/leads     →  Agregar leads
✅ POST /api/campaigns/track         →  Tracking de entregas
✅ GET /api/channels                 →  Estado de canales (5 canales)
✅ GET /api/dashboard/summary        →  Dashboard resumen
✅ GET /api/twenty/health            →  Twenty conectado
✅ POST /api/seed (con lock atómico) →  Seed data (3 campañas, 12 leads)
✅ DELETE /api/seed (con lock)       →  Limpieza total de datos
✅ POST /api/campaigns/:id/leads/upload → Excel/CSV upload
✅ GET /api/templates                →  11 plantillas predefinidas
✅ POST /api/scoring/evaluate        →  Scoring rule-based (evaluateLead compartida)
✅ POST /api/scoring/evaluate-all    →  Scoring batch (con hasClicked + score persistido)
✅ POST /api/twenty/sync             →  Sync Twenty individual (con paginación)
✅ POST /api/twenty/sync-all         →  Sync Twenty batch (con paginación)
✅ POST /api/llm/chat                →  OpenRouter chat (gpt-4o-mini)
✅ GET /api/llm/health               →  OpenRouter health check
✅ POST /api/scoring/evaluate-llm    →  Scoring con IA vía OpenRouter
✅ n8n workflows importados          →  2 workflows listos
✅ Documentación docs/               →  Índice, contexto, RAG, MEMORY, RUNBOOK
✅ PRUEBAS-Y-VERIFICACIONES.md       →  Checklist 96 ítems
✅ ESTADO-EJECUTIVO.md               →  Resumen ejecutivo no técnico
✅ Scripts: diagnose-chatwoot.ps1    →  Diagnóstico Chatwoot listo
✅ Scripts: configure-openrouter.js  →  Config OpenRouter en Dify listo
```

### Lo que NO funciona (requiere llaves externas)

```
❌ Envío real de WhatsApp          →  Necesita META_APP_ID + WHATSAPP_PHONE_NUMBER_ID
❌ Recepción de mensajes entrantes  →  Necesita Meta + Chatwoot inbox WhatsApp
❌ Agente IA conversacional         →  Necesita LLM (OpenAI o xAI con créditos)
❌ Clasificación de leads con IA    →  Necesita LLM
❌ Scoring con análisis profundo    →  Necesita LLM
❌ Webhook Chatwoot → n8n           →  Necesita Meta (inbox WhatsApp)
```

---

## 5. Roadmap — Pasos Siguientes

### Completado en Sesión 1 (v2.0.0 → v2.1.0, ~25h)
```
┌────────────────────────────────────────────────────────┐
│ 1. Hub Nginx unificado (cards tipo Odoo)        ✅ ~2h │
│ 2. Carga masiva Excel/CSV + UI                  ✅ ~5h │
│ 3. Templates campaña multi-canal                ✅ ~3h │
│ 4. Mock de datos para pruebas end-to-end        ✅ ~4h │
│ 5. Campos custom Twenty CRM                     ✅ ~2h │
│ 6. Twenty CRM sync endpoints                    ✅ ~3h │
│ 7. Scoring engine rule-based                    ✅ ~3h │
│ 8. Documentación + pruebas                      ✅ ~3h │
├────────────────────────────────────────────────────────┤
│ Total: ~25h — todo completado                         │
└────────────────────────────────────────────────────────┘
```

### Completado en Sesión 2 (v2.1.0 → v2.1.1, bugfixes)
```
┌────────────────────────────────────────────────────────┐
│ 1. OpenRouter LLM integrado                     ✅ ~3h │
│ 2. Legacy v1 endpoints restaurados              ✅ ~2h │
│ 3. Storage race condition corregido (lock)      ✅ ~1h │
│ 4. Scoring refactorizado (evaluateLead)         ✅ ~2h │
│ 5. Twenty phone normalization + paginación      ✅ ~1h │
│ 6. Auditoría 14 issues + fix existingPerson     ✅ ~3h │
│ 7. Race condition seed corregida                ✅ ~0.5h│
│ 8. Duplicate campaign names corregido           ✅ ~0.5h│
│ 9. Documentación actualizada (v2.1.1)           ✅ ~1h │
│ 10. Simulacros de prueba + backup               ✅ ~1h │
├────────────────────────────────────────────────────────┤
│ Total acumulado: ~40h                                  │
└────────────────────────────────────────────────────────┘
```

### Siguiente Prioridad (sin API keys)
```
┌────────────────────────────────────────────────────────┐
│ 1. Diagnosticar Chatwoot (logs)               ✅ script│
│ 2. Pruebas Excel (>1000)                      ✅ 0.13s │
│ 3. Verificar workflows n8n en UI                ~1h    │
│ 4. Landing page pública                         ~4h    │
│ 5. Documentación de onboarding para cliente     ~3h    │
├────────────────────────────────────────────────────────┤
│ Total: ~8h disponibles ahora                         │
└────────────────────────────────────────────────────────┘
```

### Dependencia Externa (necesita Meta + LLM)
```
┌────────────────────────────────────────────────────────┐
│ A. Configurar Meta WhatsApp API                  ~3h    │
│ B. Conectar LLM (OpenAI/xAI)                    ~2h    │
│ C. Activar Chatwoot inbox WhatsApp               ~3h    │
│ D. Probar flujo inbound completo                 ~4h    │
│ E. Probar campaña broadcast real                 ~3h    │
│ F. Activar agente IA + conocimiento              ~6h    │
├────────────────────────────────────────────────────────┤
│ Total con llaves: ~21h                                 │
└────────────────────────────────────────────────────────┘
```

---

## 6. Consideraciones Técnicas para SaaS Multi-Tenant

### Para tener en cuenta desde AHORA para no refactorizar después:

| Aspecto | Decisión Actual | Implicancia Futura |
|---------|----------------|-------------------|
| **Base de datos** | PostgreSQL con schemas por servicio | Para multi-tenant usar `schemas` por tenant o databases separadas |
| **Almacenamiento leads** | JSON en helper-node + PostgreSQL wibsite | Migrar a tabla `tenants` con `tenant_id` FK en todas las tablas |
| **Autenticación** | Cada servicio la suya | Evaluar Keycloak o Auth0 como SSO |
| **Despliegue** | Docker Compose single host | Migrar a Kubernetes or Docker Swarm |
| **Webhooks** | Chatwoot → n8n directo | Usar cola de mensajes (RabbitMQ/Redis) para escalar |
| **Archivos** | Almacenamiento local | Migrar a S3-compatible (MinIO) |
| **Logs** | stdout docker | Migrar a ELK o Grafana Loki |

### Recomendación
Para la plantilla base (mi negocio primero), mantener la arquitectura actual. Al escalar a SaaS multi-tenant, refactorizar en este orden:
1. **Implementar API Gateway con JWT** (ver ADR-016) — autenticación central, rate limiting, audit logging
2. Separar bases de datos por tenant o agregar `organization_id` en todas las tablas
3. Migrar JSON store a PostgreSQL con `tenant_id` FK
4. Migrar almacenamiento a MinIO (S3-compatible)
5. Orquestación a Docker Swarm (más simple que K8s, escalado horizontal)

### Análisis de Escalabilidad Vertical vs Horizontal
**Escenario actual (Vertical)**: Single host, todos los contenedores en una máquina. Límite: CPU/RAM del host. Si un servicio satura, afecta a todos.

**Escenario objetivo (Horizontal)**: Múltiples réplicas de cada servicio con balanceador. El Gateway es el primer paso natural:
- Gateway sin estado (stateless JWT) → múltiples réplicas
- Helper-node stateless (sin JSON store) → múltiples réplicas + PostgreSQL central
- n8n con cola Redis → workers paralelos
- Dify con celery → workers paralelos
- Chatwoot con Sidekiq → workers paralelos

---

## 7. Documentación del Proyecto

| Archivo | Propósito |
|---------|-----------|
| `wibsite/docs/INDEX.md` | Índice principal de documentación |
| `wibsite/docs/SOURCE_INDEX.md` | Mapa del código fuente |
| `wibsite/docs/GLOSSARY.md` | Glosario de términos |
| `wibsite/docs/MEMORY.md` | Decisiones arquitectónicas (ADR) |
| `wibsite/docs/CHANGELOG.md` | Historial de cambios |
| `wibsite/docs/RUNBOOK.md` | Operaciones y troubleshooting |
| `wibsite/docs/context/*` | Contexto por módulo |
| `wibsite/docs/rag/*` | Documentación para búsqueda semántica |
| `doc/ESTADO.md` | **Este archivo** — estado del proyecto y roadmap |

---

## 8. Resumen Ejecutivo

```
Estado actual:     Fase 0.5 (95%) — conectividad. Fases 1-2 completadas. v2.1.1
Bugs críticos:     Todos corregidos (14/14 issues + 2 nuevos encontrados en auditoría)
Siguiente hito:    Implementar API Gateway con SSO → Copia plantilla base → Onboarding docs
Dependencias críticas: Meta API key, LLM API key (OpenRouter $0.000004/llamada)
Próximos pasos:    Gateway SSO → Chatwoot diagnose → Landing page → Onboarding
Meta final:        SaaS multi-tenant omnicanal con IA 24/7
```
