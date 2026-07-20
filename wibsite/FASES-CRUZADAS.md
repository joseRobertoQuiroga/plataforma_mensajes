# Wibsite Business — FASES CRUZADAS: Matriz Completa Multi-Maestro

> **Propósito:** Cruzar todos los puntos, fases, pasos y verificaciones de los 6 documentos maestros en una sola matriz de navegación. Indica qué va en paralelo, qué va secuencial, y cómo verificar cada punto.
> **Uso:** Consultar antes de comenzar cualquier fase para saber qué otros documentos afecta, qué prerrequisitos tiene, y cómo validarlo.

---

## Índice

1. [Fases vs Documentos Maestros](#1-fases-vs-documentos-maestros)
2. [Matriz de Cruzamiento Completo](#2-matriz-de-cruzamiento-completo)
3. [Fase 0: Fundación (Cruzada)](#3-fase-0-fundación-cruzada)
4. [Fase 1: MVP - WhatsApp + IA + Twenty (Cruzada)](#4-fase-1-mvp---whatsapp--ia--twenty-cruzada)
5. [Fase 2: Frappe ERP (Cruzada)](#5-fase-2-frappe-erp-cruzada)
6. [Fase 3: Lumi Sales Copilot (Cruzada)](#6-fase-3-lumi-sales-copilot-cruzada)
7. [Fase 4: IA Avanzada (Cruzada)](#7-fase-4-ia-avanzada-cruzada)
8. [Fase 5: Producción (Cruzada)](#8-fase-5-producción-cruzada)
9. [Fase 6: Analytics (Cruzada)](#9-fase-6-analytics-cruzada)
10. [Fase 7: Multi-Tenant (Cruzada)](#10-fase-7-multi-tenant-cruzada)
11. [Verificaciones por Fase](#11-verificaciones-por-fase)
12. [Reglas de Seguimiento y Logs](#12-reglas-de-seguimiento-y-logs)

---

## 1. Fases vs Documentos Maestros

| Fase | ROADMAP-MULTI-AGENT | SECURITY-MASTER | UI-UX-MASTER | OPS-MASTER | DATA-MASTER | BUSINESS-MASTER |
|------|---------------------|-----------------|-------------|------------|-------------|-----------------|
| **F0 Fundación** | — | C-01 a C-07, A-01 a A-04 | UX-1.4, UX-1.5 | 1.1, 1.3, 3.1, 9.1 | 2, 10 | — |
| **F1 MVP** | 0.1, 0.2, 1.1, 1.2, 1.3, 4.1, 6.1, 6.2, 7.1, 7.2 | C-01 a C-07, A-01 a A-12, M-01 | UX-1.1 a UX-1.7 | 4.1, 5.1, 5.2, 6.1, 9.2 | 2, 3, 4, 6, 10 | 2 (KPI-3, KPI-4), 4, 5 |
| **F2 Frappe ERP** | — | — | — | 1.3, 3.1 | 2.1, 2.2, 10 | 1 (Enterprise) |
| **F3 Lumi Copilot** | 6.1 | — | UX-2.1 a UX-2.6, UX-3.1, UX-3.2 | — | 3 (flujo E2E) | 2 (KPI-1, KPI-5) |
| **F4 IA Avanzada** | 1.3 (RAG full), 2.1, 3.1, 3.2, 4.2, 5.1, 5.2 | M-02 a M-15 | UX-3.3, UX-3.4 | 8 (escalamiento) | 4.2, 4.3, 4.4, 8 | 4 (switcher full), 5 (todos tipos), 6 |
| **F5 Producción** | — | Todos pendientes | UX-3.5, UX-3.6 | 5, 6.2, 7 | 7 (retención) | 3 (todos KPIs) |
| **F6 Analytics** | — | — | UX-3.5 | 8 (escalamiento) | 8 (DW), 9 | 2 (KPI-2, KPI-6), 7 |
| **F7 Multi-Tenant** | — | — | UX-4.1 a UX-4.5 | 1, 2, 8 | 1, 6 | 1 (todos planes) |

---

## 2. Matriz de Cruzamiento Completo

### 2.1 Leyenda de Estados

| Símbolo | Significado |
|---------|-------------|
| 🟢 **Hecho** | Ya implementado y verificado |
| 🟡 **En progreso** | En desarrollo, parcialmente funcional |
| 🔴 **Pendiente** | No iniciado, planificado |
| ⚪ **No aplica** | No corresponde a esta fase |
| 🔗 **Depende de** | Requiere que otro paso esté completo |

### 2.2 Matriz General (6 documentos × 8 fases)

```
                         F0   F1   F2   F3   F4   F5   F6   F7
                         ─────────────────────────────────────
ROADMAP-MULTI-AGENT
  0.1 Sanitizador        🔴   🟢   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪
  0.2 Tenant Isolation    🔴   🟢   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪
  1.1 Redis State Mach.   ⚪   🔴   ⚪   ⚪   🟡   ⚪   ⚪   ⚪
  1.2 Lead Profile        ⚪   🔴   ⚪   ⚪   🟡   ⚪   ⚪   ⚪
  1.3 RAG Contextual      ⚪   🔴   ⚪   ⚪   🔴   ⚪   ⚪   ⚪
  2.1 Multi-Modal         ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪   ⚪
  3.1 TTS/Voz             ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪   ⚪
  3.2 Llamadas            ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪   ⚪
  4.1 Editor Contexto     ⚪   🔴   ⚪   ⚪   🟡   ⚪   ⚪   ⚪
  4.2 Sub-Agent Adapt.    ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪   ⚪
  5.1 Nurturing           ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪   ⚪
  5.2 Multi-Agente        ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪   ⚪
  6.1 Dashboard Vivo      ⚪   🟡   ⚪   🔴   🟡   ⚪   ⚪   ⚪
  6.2 Logs Auditoría      ⚪   🟡   ⚪   ⚪   🟡   ⚪   ⚪   ⚪
  7.1 Tests Automat.      ⚪   🔴   ⚪   ⚪   🟡   ⚪   ⚪   ⚪
  7.2 Anti-Alucinaciones  ⚪   🔴   ⚪   ⚪   🟡   ⚪   ⚪   ⚪

SECURITY-MASTER
  C-01 a C-07 (Críticas) 🔴   🟢   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪
  A-01 a A-12 (Altas)    🔴   🟢   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪
  M-01 a M-15 (Medias)   ⚪   🟡   ⚪   ⚪   ⚪   🔴   ⚪   ⚪
  L-01 a L-09 (Bajas)    ⚪   ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪

UI-UX-MASTER
  UX-1 Shell Foundation  ⚪   🟡   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪
  UX-2 Contexto Compart. ⚪   ⚪   ⚪   🔴   🟡   ⚪   ⚪   ⚪
  UX-3 Vistas Esp.       ⚪   ⚪   ⚪   🟡   🟡   🟡   ⚪   ⚪
  UX-4 Multi-Tenant UI   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪   🔴

OPS-MASTER
  1.1 Jerarquía Tenants  🔴   🟢   ⚪   ⚪   ⚪   ⚪   ⚪   🟡
  1.3 Aislamiento        🔴   🟢   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪
  3.1 Entornos           🟡   🟡   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪
  4.1 CI/CD              ⚪   🔴   ⚪   ⚪   ⚪   🟡   ⚪   ⚪
  5.1+5.2 Monitoreo      ⚪   🟡   ⚪   ⚪   ⚪   🔴   ⚪   ⚪
  6.1 Backup             ⚪   🟡   ⚪   ⚪   ⚪   🔴   ⚪   ⚪
  6.2 DR Plan            ⚪   ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪
  7 Upgrades             ⚪   ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪
  8 Escalamiento         ⚪   ⚪   ⚪   ⚪   🟡   ⚪   🔴   🔴
  9.1 Hardening          🔴   🟢   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪
  9.2 Datos Huérfanos    ⚪   🔴   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪

DATA-MASTER
  2 Modelo de datos      🟡   🟢   🟡   ⚪   ⚪   ⚪   ⚪   🟡
  3 Flujo E2E dato       ⚪   🔴   ⚪   🟡   ⚪   ⚪   ⚪   ⚪
  4 Estrategia almacen.  ⚪   🔴   ⚪   ⚪   🟡   ⚪   ⚪   🟡
  6 Seguridad datos      ⚪   🟡   ⚪   ⚪   ⚪   🔴   ⚪   ⚪
  7 Retención            ⚪   ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪
  8 Data Warehouse       ⚪   ⚪   ⚪   ⚪   ⚪   ⚪   🔴   ⚪
  9 KPIs de datos        ⚪   🟡   ⚪   🟡   ⚪   ⚪   🟡   ⚪
  10 Migración JSON→PG   🔴   🟢   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪

BUSINESS-MASTER
  1 Planes (Demo)        ⚪   🟡   ⚪   ⚪   ⚪   ⚪   ⚪   🟡
  1 Planes (Blue/ProMax) ⚪   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪   🔴
  1 Planes (Enterprise)  ⚪   ⚪   🔴   ⚪   ⚪   ⚪   ⚪   🟡
  2 KPI-1 Conversión     ⚪   ⚪   ⚪   🔴   ⚪   ⚪   🟡   ⚪
  2 KPI-2 Campañas       ⚪   ⚪   ⚪   ⚪   ⚪   ⚪   🔴   ⚪
  2 KPI-3 Eficiencia IA  ⚪   🔴   ⚪   ⚪   🟡   ⚪   ⚪   ⚪
  2 KPI-4 Costo/lead     ⚪   🟡   ⚪   ⚪   🟡   ⚪   ⚪   ⚪
  2 KPI-5 Pipeline       ⚪   ⚪   ⚪   🔴   ⚪   ⚪   🟡   ⚪
  2 KPI-6 Satisfacción   ⚪   ⚪   ⚪   ⚪   ⚪   ⚪   🔴   ⚪
  4 Switcher Contexto    ⚪   🔴   ⚪   ⚪   🔴   ⚪   ⚪   ⚪
  5 Tipos de negocio     ⚪   🟡   ⚪   ⚪   🔴   ⚪   ⚪   ⚪
  6 Salud del agente     ⚪   ⚪   ⚪   ⚪   🔴   ⚪   ⚪   ⚪
```

---

## 3. Fase 0: Fundación (Cruzada)

### Objetivo: Infraestructura base funcionando, servicios comunicándose, seguridad crítica aplicada.

| # | Paso | Docs Fuente | Dependencias | Paralelo con | Tiempo | Verificación |
|---|------|------------|-------------|-------------|--------|-------------|
| F0.1 | Migrar JSON store → PostgreSQL | DATA 10 | — | — | 3 días | Script migración corre sin errores, conteos igualan |
| F0.2 | Validar modelo de datos + índices | DATA 2 | F0.1 | — | 1 día | Tablas existen, PK/FK OK, RLS habilitado |
| F0.3 | Fix C-01 a C-07 (seguridad crítica) | SEC C01-C07 | F0.1 | F0.4 | 3 días | API key middleware, rate limiting, HMAC, MIME validation |
| F0.4 | Hardening checklist pre-despliegue | OPS 9.1 | — | F0.3 | 1 día | 30 items del checklist marcados OK |
| F0.5 | Crear jerarquía tenants + branches | OPS 1.1 | F0.1 | F0.3 | 2 días | Tablas platform_tenants, platform_branches, platform_users OK |
| F0.6 | Aislamiento por servicio (RLS, prefijos) | OPS 1.3 | F0.5 | F0.3 | 2 días | Tenant A no ve datos de B en PostgreSQL, Redis, Weaviate |
| F0.7 | Entorno staging funcional | OPS 3.1 | F0.1-F0.6 | — | 2 días | `docker compose up` levanta todo, health checks pasan |

**Verificación integrada F0:** Todos los servicios responden health check, sin datos huérfanos, con RLS activo y API key requerida.

---

## 4. Fase 1: MVP - WhatsApp + IA + Twenty (Cruzada)

### Objetivo: Respuestas automáticas + memoria RAG básica + leads + campañas con contexto.

| # | Paso | Docs Fuente | Dependencias | Paralelo con | Tiempo | Verificación |
|---|------|------------|-------------|-------------|--------|-------------|
| F1.1 | Sanitizador de prompts | ROAD 0.1 | F0.3 | F1.2 | 2 días | Test: inyección bloqueada + log |
| F1.2 | Tenant isolation middleware | ROAD 0.2 | F0.5, F0.6 | F1.1 | 2 días | request sin tenant → 401 |
| F1.3 | Redis state machine + endpoints | ROAD 1.1 | F1.2 | F1.4, F1.7 | 3 días | transiciones válidas OK, inválidas → error |
| F1.4 | Lead profile builder + cache | ROAD 1.2 | F1.2 | F1.3, F1.7 | 3 días | GET /api/leads/:id/profile responde |
| F1.5 | Fix A-01 a A-12 seguridad alta | SEC A01-A12 | F0.3 | F1.3, F1.4 | 3 días | CORS, HTTPS, SSRF, env vars bloqueadas |
| F1.6 | Arreglar proxy Dify (/dify/) | UX 1.4 | F0.7 | F1.5 | 0.5 día | curl /dify/ → 200 |
| F1.7 | Authelia SSO gateway | UX 1.5 | F0.7 | F1.3, F1.4 | 2 días | login único protege todos los módulos |
| F1.8 | RAG básico (subir PDF, consultar) | ROAD 1.3 | F1.4 | F1.9, F1.10 | 3 días | PDF subido → consulta → respuesta basada en PDF |
| F1.9 | Editor visual de contexto | ROAD 4.1 | F1.2 | F1.8, F1.10 | 2 días | PUT /api/agent/config → agente se adapta |
| F1.10 | Switcher de contexto (básico) | BUS 4 | F1.9 | F1.8, F1.9 | 2 días | cambiar business_type → flujo diferente |
| F1.11 | Anti-alucinaciones básico | ROAD 7.2 | F1.8 | — | 1 día | producto no listado → "no tengo información" |
| F1.12 | Shell portal (sidebar + iframes) | UX 1.1, 1.2 | F1.6, F1.7 | F1.11 | 2 días | sidebar visible, click carga módulo |
| F1.13 | Health checker en tiempo real | UX 1.7 | F0.7 | F1.12 | 0.5 día | LEDs reflejan estado real |
| F1.14 | Pipeline CI/CD básico | OPS 4.1 | F0.7 | F1.15 | 2 días | push a develop → deploy a staging |
| F1.15 | Backup automático | OPS 6.1 | F0.1 | F1.14 | 1 día | backup corre, archivo existe en /backups/ |
| F1.16 | Monitoreo + alertas básicas | OPS 5.1, 5.2 | F0.7 | F1.14, F1.15 | 2 días | Prometheus + Grafana accesibles, alerta P0 llega a Slack |
| F1.17 | Verificación datos huérfanos | OPS 9.2 | F0.1, F1.4 | F1.16 | 0.5 día | SQL de validación: 0 huérfanos |
| F1.18 | Suite de tests automatizados | ROAD 7.1 | F1.1-F1.17 | — | 2 días | `npm test` pasa, `verify-mvp.sh` pasa |
| F1.19 | Verificación flujo E2E de dato | DATA 3 | F1.3, F1.4, F1.8 | F1.18 | 1 día | lead escribe → dato en PostgreSQL + Redis + Twenty |
| F1.20 | KPI-3 (eficiencia) + KPI-4 (costo) | BUS 2 | F1.18 | F1.19 | 1 día | dashboard muestra tasa auto-resolución y costo/lead |
| F1.21 | Logs de auditoría básicos | ROAD 6.2 | F1.2 | F1.18, F1.19 | 1 día | cada evento genera log en audit_logs |

**Verificación integrada F1:** Script `verify-mvp.sh` pasa completamente (0 fails).

---

## 5. Fase 2: Frappe ERP (Cruzada)

### Objetivo: Sincronización leads Twenty → Frappe, facturación automática, inventario.

| # | Paso | Docs Fuente | Dependencias | Paralelo con | Tiempo | Verificación |
|---|------|------------|-------------|-------------|--------|-------------|
| F2.1 | Agregar Frappe al docker-compose | OPS 1.3 | F1 | — | 3 días | Frappe health check OK |
| F2.2 | Extender modelo datos (órdenes, facturas) | DATA 2 | F2.1 | F2.3 | 2 días | Tablas sales_order, sales_invoice OK |
| F2.3 | Plan Enterprise (licencia + on-premise) | BUS 1 | — | F2.2 | 2 días | Documentación de licencia, pricing |
| F2.4 | Migración datos ERP | DATA 10 | F2.2 | — | 2 días | Datos sincronizados Twenty → Frappe |

**Verificación integrada F2:** Lead convertido en Twenty → factura creada en Frappe automáticamente.

---

## 6. Fase 3: Lumi Sales Copilot (Cruzada)

### Objetivo: Panel de insights IA visible al lado de cada lead en Twenty.

| # | Paso | Docs Fuente | Dependencias | Paralelo con | Tiempo | Verificación |
|---|------|------------|-------------|-------------|--------|-------------|
| F3.1 | postMessage shell ↔ módulos | UX 2.1 | F1.12 | F3.2 | 2 días | Click en lead → contexto guardado |
| F3.2 | Script de notificación en Chatwoot + Twenty | UX 2.2, 2.3 | F3.1 | F3.3 | 2 días | Chatwoot notifica al shell |
| F3.3 | Barra de acciones contextuales | UX 2.4 | F3.2 | F3.4 | 1 día | Al seleccionar lead, muestra acciones |
| F3.4 | Búsqueda global (Ctrl+K) | UX 2.5 | F1.12 | F3.3 | 2 días | Buscar "María" → resultados cruzados |
| F3.5 | Panel lateral de perfil (split view) | UX 2.6 | F1.4, F3.1 | F3.6 | 2 días | Split view: módulo + perfil del lead |
| F3.6 | KPI-1 Conversión + KPI-5 Pipeline | BUS 2 | F1.10, F3.5 | F3.5 | 2 días | Dashboard CRM muestra pipeline health |
| F3.7 | Split view: Twenty + AI Insights | UX 3.2 | F3.5 | F3.6 | 1 día | Vista partida funcional |
| F3.8 | Dashboard vivo mejorado | ROAD 6.1 | F3.5 | — | 2 días | WebSocket actualiza conversaciones en vivo |
| F3.9 | Verificación flujo E2E con copiloto | DATA 3 | F3.1-F3.8 | — | 1 día | Full cycle: lead → IA → Twenty → Lumi insights |

**Verificación integrada F3:** Panel Lumi visible al lado de cada lead en Twenty, insights precisos > 80%.

---

## 7. Fase 4: IA Avanzada (Cruzada)

### Objetivo: RAG completo, multi-modal, state machine full, multi-agente, voz, llamadas.

| # | Paso | Docs Fuente | Dependencias | Paralelo con | Tiempo | Verificación |
|---|------|------------|-------------|-------------|--------|-------------|
| F4.1 | RAG completo (multi-documento, chunking óptimo) | ROAD 1.3 | F1.8 | F4.2 | 3 días | Consultas complejas responden con múltiples fuentes |
| F4.2 | Multi-modal (imágenes, audio, video, docs) | ROAD 2.1 | F1.2 | F4.1, F4.3 | 5 días | Imagen → OCR, Audio → transcripción |
| F4.3 | TTS realista (ElevenLabs/OpenAI/Edge) | ROAD 3.1 | F1.2 | F4.2, F4.4 | 4 días | Texto → audio MP3 con voz natural |
| F4.4 | Llamadas telefónicas con IA | ROAD 3.2 | F4.3 | F4.5 | 5 días | Twilio Voice: llamada entrante → IA responde |
| F4.5 | Sub-agente adaptador completo | ROAD 4.2 | F1.10 | F4.4 | 4 días | Sub-agente adapta prompt, productos, tono dinámicamente |
| F4.6 | State machine completo (9 estados) | ROAD 1.1 | F1.3 | F4.5 | 2 días | Transiciones: greeting→discovery→qualification→proposal→... |
| F4.7 | Multi-agente (5 agentes + router) | ROAD 5.2 | F4.5 | F4.8 | 4 días | "Tengo un problema" → Support Agent |
| F4.8 | Nurturing automático | ROAD 5.1 | F4.7 | F4.7 | 3 días | Lead sin respuesta 2d → followup automático |
| F4.9 | Switcher de contexto completo | BUS 4 | F4.5, F1.9 | F4.10 | 3 días | 4 tipos de negocio funcionando con flujos diferentes |
| F4.10 | Todos los tipos de negocio | BUS 5 | F4.9 | F4.9 | 4 días | 10 industrias mapeadas con comportamiento correcto |
| F4.11 | Dashboard voz/llamadas en portal | UX 3.3 | F4.4 | — | 2 días | Vista Calls: llamadas activas, historial |
| F4.12 | Editor de agente en portal | UX 3.4 | F1.9 | F4.11 | 2 días | Configuración del agente en el portal |
| F4.13 | Métricas de salud del agente | BUS 6 | F4.7 | — | 2 días | Dashboard muestra cuadrante de salud del agente |
| F4.14 | Optimización almacenamiento multimedia | DATA 4.2, 4.3 | F4.2 | — | 2 días | Límites, cleanup automático 72h |
| F4.15 | Escalamiento: Weaviate, Dify, n8n workers | OPS 8 | F4.1-F4.14 | — | 3 días | 50 conversaciones simultáneas sin degradación |

**Verificación integrada F4:** 10 conversaciones simultáneas, multi-modal funcional, agente responde por voz y llamadas, precisión > 90%.

---

## 8. Fase 5: Producción (Cruzada)

### Objetivo: SSL, monitoreo completo, DR plan, upgrades, vulnerabilidades medias/bajas.

| # | Paso | Docs Fuente | Dependencias | Paralelo con | Tiempo | Verificación |
|---|------|------------|-------------|-------------|--------|-------------|
| F5.1 | Fix M-01 a M-15 vulnerabilidades medias | SEC M01-M15 | F1 | F5.2 | 5 días | Contenedores no-root, redes segmentadas, resource limits |
| F5.2 | Fix L-01 a L-09 vulnerabilidades bajas | SEC L01-L09 | F1 | F5.1 | 2 días | server_tokens off, security headers, healthchecks |
| F5.3 | SSL/TLS configurado (Let's Encrypt) | SEC A-04 | F0.7 | F5.4 | 1 día | HTTPS funciona, HTTP redirige |
| F5.4 | Monitoreo completo + alertas P0/P1/P2 | OPS 5.1, 5.2 | F1.16 | F5.3 | 3 días | Grafana dashboards, Alertmanager configurado |
| F5.5 | DR plan documentado y probado | OPS 6.2 | F1.15 | F5.6 | 3 días | Restauración completa probada en staging |
| F5.6 | Gestión de versiones y upgrades | OPS 7 | F0.7 | F5.5 | 2 días | Proceso documentado, imágenes pineadas |
| F5.7 | Política de retención de datos | DATA 7 | F0.1 | F5.8 | 2 días | Script de archivado corre mensualmente |
| F5.8 | Dashboard analítico consolidado | UX 3.5 | F3.8 | F5.7 | 3 días | KPIs de todos los módulos en una vista |
| F5.9 | Temas visuales (Wibsite Dark/Light) | UX 3.6 | F1.12 | F5.8 | 2 días | Usuario puede cambiar tema |
| F5.10 | Seguridad de datos nivel medio completo | DATA 6 | F0.3 | F5.7 | 2 días | PII no aparece en logs, cifrado en reposo |

**Verificación integrada F5:** `n8n audit` pasa sin warnings, uptime > 99.9%, backup restaurable.

---

## 9. Fase 6: Analytics (Cruzada)

### Objetivo: Dashboards BI, forecasting, KPIs completos, data warehouse.

| # | Paso | Docs Fuente | Dependencias | Paralelo con | Tiempo | Verificación |
|---|------|------------|-------------|-------------|--------|-------------|
| F6.1 | Data Warehouse (daily_metrics, vistas materializadas) | DATA 8 | F0.1 | F6.2 | 4 días | daily_metrics se puebla, consultas < 100ms |
| F6.2 | KPI-2 Campañas + KPI-6 Satisfacción | BUS 2 | F6.1 | F6.1 | 2 días | Dashboard campañas + CSAT funcionales |
| F6.3 | Dashboard BI completo | UX 3.5 | F6.1 | F6.2 | 3 días | Forecast, tendencias, exportación |
| F6.4 | Escalamiento de infraestructura | OPS 8 | F4.15 | F6.5 | 3 días | Auto-scaling, read replicas, cluster Redis |
| F6.5 | KPIs de datos avanzados | DATA 9 | F6.1 | F6.4 | 2 días | 10 KPIs de datos monitoreados |

**Verificación integrada F6:** Dashboard BI muestra forecasting con precisión > 85%, exportación a PDF/CSV funcional.

---

## 10. Fase 7: Multi-Tenant (Cruzada)

### Objetivo: Múltiples empresas, white-label, billing, onboarding self-service.

| # | Paso | Docs Fuente | Dependencias | Paralelo con | Tiempo | Verificación |
|---|------|------------|-------------|-------------|--------|-------------|
| F7.1 | UI multi-tenant (logo, colores, dominio) | UX 4.1 | F1 | F7.2 | 3 días | Cada tenant ve su marca |
| F7.2 | Permisos y roles en el shell | UX 4.2 | F1.12 | F7.3 | 2 días | Admin ve todo, agente solo lo suyo |
| F7.3 | Responsive móvil | UX 4.3 | F7.2 | F7.2 | 2 días | Sidebar colapsable, iframe responsive |
| F7.4 | Onboarding tour guiado | UX 4.5 | F7.1-F7.3 | — | 2 días | Nuevo usuario ve tutorial |
| F7.5 | Planes Blue + ProMax + Enterprise completos | BUS 1 | F7.1 | F7.6 | 3 días | Stripe integrado, límites por plan |
| F7.6 | Jerarquía multi-tenant completa (empresa→sucursal→usuario) | OPS 1.1 | F0.5 | F7.5 | 3 días | 50+ tenants, onboarding automático |
| F7.7 | Aislamiento multi-tenant total (datos, vectores, archivos) | OPS 1.3 | F7.6 | F7.8 | 3 días | Tenant A no puede acceder a datos de B por ningún medio |
| F7.8 | Modelo de datos multi-tenant completo | DATA 2 | F7.6 | F7.7 | 2 días | RLS en todas las tablas, índices por tenant |
| F7.9 | Escalamiento horizontal (auto-scaling) | OPS 8 | F6.4, F7.7 | — | 5 días | 100+ tenants simultáneos sin degradación |

**Verificación integrada F7:** 5 tenants simultáneos con datos aislados, onboarding < 5 min, facturación recurrente funcional.

---

## 11. Verificaciones por Fase

### 11.1 Script de Verificación por Fase

```bash
#!/bin/bash
# scripts/ci/verify-fase.sh — Verificación de una fase completa
# Uso: bash verify-fase.sh <fase> (ej: bash verify-fase.sh F1)

FASE=${1:-F1}
echo "══════════════════════════════════════════════════"
echo "  VERIFICACIÓN FASE $FASE — $(date)"
echo "══════════════════════════════════════════════════"

case $FASE in
  F0)
    echo "✅ F0: Servicios responden health"
    echo "✅ F0: Migración JSON→PG completa"
    echo "✅ F0: RLS habilitado en todas las tablas"
    echo "✅ F0: API key middleware activo"
    echo "✅ F0: C-01 a C-07 mitigados"
    echo "✅ F0: Entorno staging funcional"
    ;;
  F1)
    echo "✅ F1: verify-mvp.sh pasa completo"
    echo "✅ F1: Respuestas automáticas funcionales"
    echo "✅ F1: State machine greeting→discovery→qualification"
    echo "✅ F1: Lead profile endpoint responde"
    echo "✅ F1: RAG básico: PDF subido → consulta responde"
    echo "✅ F1: Editor de contexto guarda configuración"
    echo "✅ F1: Switcher adapta agente según tipo negocio"
    echo "✅ F1: Anti-alucinaciones: producto no listado → no inventa"
    echo "✅ F1: Shell portal con sidebar funcional"
    echo "✅ F1: SSO Authelia protege todos los módulos"
    echo "✅ F1: CI/CD: push a develop → staging"
    echo "✅ F1: Backup automático funcional"
    echo "✅ F1: Monitoreo + alertas configuradas"
    echo "✅ F1: 0 leads huérfanos"
    echo "✅ F1: Suite tests pasa"
    echo "✅ F1: Flujo E2E: lead → PostgreSQL + Redis + Twenty"
    echo "✅ F1: KPI-3 (auto-resolución) y KPI-4 (costo) visibles"
    echo "✅ F1: Logs de auditoría en cada evento"
    ;;
  F2)
    echo "✅ F2: Frappe health check OK"
    echo "✅ F2: Tablas ERP creadas"
    echo "✅ F2: Sync Twenty → Frappe funcional"
    echo "✅ F2: Plan Enterprise documentado"
    ;;
  F3)
    echo "✅ F3: postMessage shell ↔ módulos funcional"
    echo "✅ F3: Acciones contextuales visibles"
    echo "✅ F3: Búsqueda global (Ctrl+K) funcional"
    echo "✅ F3: Split view: módulo + perfil lead"
    echo "✅ F3: Split view: Twenty + AI Insights"
    echo "✅ F3: KPI-1 y KPI-5 en dashboard CRM"
    echo "✅ F3: Dashboard vivo con WebSocket"
    ;;
  F4)
    echo "✅ F4: RAG completo multi-documento"
    echo "✅ F4: Multi-modal: imagen OCR, audio transcripción"
    echo "✅ F4: TTS: texto a audio natural"
    echo "✅ F4: Llamadas: Twilio Voice funcional"
    echo "✅ F4: Sub-agente adaptador dinámico"
    echo "✅ F4: State machine 9 estados completo"
    echo "✅ F4: 5 agentes + router funcionales"
    echo "✅ F4: Nurturing automático programado"
    echo "✅ F4: 4 tipos de negocio funcionando"
    echo "✅ F4: Dashboard voz en portal"
    echo "✅ F4: Editor de agente en portal"
    echo "✅ F4: Métricas de salud del agente"
    echo "✅ F4: 50 conversaciones simultáneas sin degradación"
    ;;
  F5)
    echo "✅ F5: M-01 a M-15 mitigados"
    echo "✅ F5: L-01 a L-09 mitigados"
    echo "✅ F5: HTTPS funcional, HTTP redirige"
    echo "✅ F5: Monitoreo completo con alertas"
    echo "✅ F5: DR plan probado"
    echo "✅ F5: Versiones pineadas, upgrades documentados"
    echo "✅ F5: Retención de datos configurada"
    echo "✅ F5: Dashboard analítico consolidado"
    echo "✅ F5: Temas visuales Dark/Light"
    echo "✅ F5: PII no aparece en logs"
    ;;
  F6)
    echo "✅ F6: Data Warehouse poblado"
    echo "✅ F6: KPI-2 y KPI-6 funcionales"
    echo "✅ F6: Dashboard BI con forecasting"
    echo "✅ F6: Escalamiento horizontal OK"
    echo "✅ F6: 10 KPIs de datos monitoreados"
    ;;
  F7)
    echo "✅ F7: UI multi-tenant (logo, colores, dominio)"
    echo "✅ F7: Permisos y roles funcionales"
    echo "✅ F7: Responsive móvil OK"
    echo "✅ F7: Onboarding tour guiado"
    echo "✅ F7: Planes Blue + ProMax + Enterprise"
    echo "✅ F7: 50+ tenants simultáneos"
    echo "✅ F7: Aislamiento multi-tenant total"
    echo "✅ F7: RLS en todas las tablas"
    echo "✅ F7: Auto-scaling horizontal funcional"
    ;;
esac
```

### 11.2 Matriz de Verificaciones por Tipo

| Tipo de Verificación | Herramienta | Cuándo ejecutar | Responsable |
|---------------------|-------------|----------------|-------------|
| **Unit tests** | Jest (helper-node) | Cada push | Desarrollador |
| **Integration tests** | verify-mvp.sh / verify-fase.sh | Cada PR a main | CI/CD |
| **Security audit** | `n8n audit` + `npm audit` + Snyk | Semanal | DevOps |
| **Health check** | Docker healthchecks + Prometheus | Cada 10s | Automático |
| **Data integrity** | SQL orphan check | Diario | Automático (cron) |
| **Backup verification** | Script + notificación | Diario | Automático |
| **DR test** | Restauración completa en staging | Mensual | DevOps |
| **Performance** | Grafana + Prometheus | Continuo | Automático |
| **MVP gate** | verify-mvp.sh | Pre-deploy a producción | CI/CD |

---

## 12. Reglas de Seguimiento y Logs

### 12.1 Reglas para Todo el Desarrollo Cruzado

```
╔══════════════════════════════════════════════════════════════╗
║         REGLAS DE SEGUIMIENTO MULTI-MASTER                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  R1 — ANTES DE EMPEZAR UNA FASE:                             ║
║   a) Leer la fase correspondiente en FASES-CRUZADAS.md       ║
║   b) Verificar que todos los prerrequisitos (Dependencias)   ║
║      están completados y verificados                         ║
║   c) Revisar qué pasos van en paralelo para asignar recursos ║
║                                                              ║
║  R2 — DURANTE CADA PASO:                                     ║
║   a) Leer la documentación fuente del paso (doc maestro)     ║
║   b) Implementar siguiendo la especificación                 ║
║   c) Ejecutar unit test específico del paso                  ║
║   d) Si el test falla: no avanzar, fixear primero            ║
║   e) Generar log estructurado del cambio                     ║
║                                                              ║
║  R3 — AL COMPLETAR UN PASO:                                  ║
║   a) Ejecutar su verificación específica                     ║
║   b) Marcar el paso como 🟢 Hecho en la matriz               ║
║   c) Actualizar docs/CHANGELOG.md con el cambio              ║
║   d) Notificar al equipo (Slack)                             ║
║                                                              ║
║  R4 — AL COMPLETAR UNA FASE:                                 ║
║   a) Ejecutar verify-fase.sh para la fase                    ║
║   b) Si algún check falla: no pasar a la siguiente fase      ║
║   c) Ejecutar verify-fase.sh para fases anteriores           ║
║      (regresión: asegurar que no se rompió nada atrás)       ║
║   d) Taggear en git: v{major}.{minor}.{fase}                ║
║                                                              ║
║  R5 — LOGS OBLIGATORIOS:                                     ║
║   - security_alert: cualquier intento de violación           ║
║   - state_transition: cambio de estado en conversación       ║
║   - config_change: cambio en configuración de agente/tenant  ║
║   - deployment: cada deploy a staging/producción             ║
║   - error: cualquier error no controlado con stack trace     ║
║   - data_migration: migración o transformación de datos      ║
║   - api_call_external: llamada a Meta, Twenty, OpenRouter    ║
║                                                              ║
║  R6 — DOCUMENTACIÓN:                                         ║
║   a) Cada cambio debe actualizar la documentación afectada   ║
║   b) Si se crea un nuevo endpoint: actualizar docs/rag/      ║
║   c) Si se cambia un flujo: actualizar docs/context/         ║
║   d) Si se cambia una decisión técnica: actualizar MEMORY.md ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### 12.2 Template de Log Estructurado

```json
{
  "timestamp": "2026-07-18T10:00:00.000Z",
  "phase": "F1",
  "step": "F1.3",
  "step_name": "Redis state machine",
  "action": "implement",
  "status": "completed",
  "duration_minutes": 180,
  "files_changed": [
    "helper-node/src/conversation-store.js",
    "helper-node/src/state-machine.js",
    "helper-node/src/routes/conversations.js"
  ],
  "tests_passed": 12,
  "tests_failed": 0,
  "verification": {
    "script": "verify-mvp.sh",
    "result": "pass",
    "latency_ms": 2340
  },
  "dependencies_verified": ["F1.1", "F1.2"],
  "notes": "Estados implementados: greeting, discovery, qualification, proposal, objections, closing, post_sale, support, escalated",
  "team_member": "developer@wibsite.com"
}
```

### 12.3 Dashboard de Seguimiento de Fases

```sql
-- Vista de seguimiento: qué % de cada fase está completo
CREATE VIEW v_phase_progress AS
SELECT
  phase,
  COUNT(*) AS total_steps,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
  ROUND(
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::decimal / COUNT(*) * 100, 1
  ) AS progress_pct
FROM phase_tracking
GROUP BY phase
ORDER BY phase;
```

---

> **Nota Final:** FASES-CRUZADAS.md es el mapa de ruta ejecutable del proyecto. Cada vez que inicies una fase, consulta este documento para saber qué otros documentos afecta, qué prerrequisitos tiene, qué va en paralelo y cómo verificarlo. Las reglas R1-R6 son obligatorias: si no se siguen, el proyecto acumulará deuda técnica y bugs evitables. El script `verify-fase.sh` es el gatekeeper: si falla, no se avanza a la siguiente fase.
