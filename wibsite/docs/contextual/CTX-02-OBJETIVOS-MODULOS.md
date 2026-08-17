# CTX 02 — Objetivos, Metas y Funcionalidad Esperada por Módulo

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Contextual (QUÉ/POR QUÉ)
> **Fuentes consolidadas:** `Avances/ESTADO GENERAL.md`, `Avances/ROADMAP.md`, `Avances/COMPONENTES.md`, `Avances/OBJETIVOS PENDIENTES.md`, `BUSINESS MASTER.md`, `ROADMAP MULTI AGENT MEMORY CONTEXT.md`, `FASES CRUZADAS.md`, `doc/ESTADO.md`.
> **Ejecución técnica:** [TEC 02 Funciones e implementación](../tecnica/TEC 02 FUNCIONES IMPLEMENTACION.md) | Mapa RAG por módulo en [`../maestro/MAESTRO FUNCIONALIDADES CORE.md`](../maestro/MAESTRO FUNCIONALIDADES CORE.md)

   

## 1. Visión del producto (marco de todos los módulos)

**Wibsite Business**: plataforma SaaS omnicanal con IA para PYMEs — un agente comercial 24/7 que atiende WhatsApp (y luego Messenger, TikTok, SMS, Email), califica leads con metodología de ventas, ejecuta campañas con tracking, y sincroniza todo con CRM/ERP. Objetivo inmediato (`doc/ESTADO.md`): plantilla "llave en mano" desplegable con un solo `docker compose up`.

**Filosofía de comportamiento del agente (BUS):** el agente no es un formulario disfrazado de chat — es un **vendedor que califica, propone valor, maneja objeciones y consolida el handoff al humano** (detalle completo en CTX 04).

## 2. Objetivo y meta de cada módulo

### M1 — Nginx + Hub (puerta de entrada)
  **Objetivo:** un solo punto de acceso (`:8080`) para todos los módulos; Hub visual como centro de operaciones.
  **Meta:** una URL, un login (con Authelia), navegación unificada (UX O1/O2/O3).
  **Estado:** ✅ Operativo (Hub completado Fase 1 doc/ESTADO; SSO en activación). RAG G1 01, G13 01.

### M2 — Helper Node (núcleo de integración, Express v2.2.0)
  **Objetivo:** API de integración que conecta todo: campañas, leads, scoring, sync CRM, webhooks, RAG, configuración de agente, memoria de conversación.
  **Meta:** ser el *núcleo* de la arquitectura de 3 capas (núcleo/plantilla/config, ver CTX 05): el motor genérico que lee plantillas por rubro y config por cliente.
  **Funcionalidad esperada:** 50+ endpoints (ver TEC 02), middleware de seguridad, state machine de 9 estados, lead profile unificado, agent config editor, RAG engine, anti alucinación, SLI/SLO.
  **Estado:** ✅ 100% módulos v2.2.0 con 112 tests pasando. Deuda: JSON store como primario (migración PG pendiente). RAG G2.

### M3 — Chatwoot (bandeja omnicanal / Front office humano)
  **Objetivo:** inbox donde el equipo humano atiende conversaciones; canal de entrada/salida de mensajes del agente.
  **Meta:** inbox WhatsApp operativo; handoff bot↔humano visible en una sola línea de tiempo (CTX 04 §7).
  **Estado:** 🟡 Servicio OK (20% objetivo): inbox WhatsApp pendiente de Meta App. RAG G8 03.

### M4 — Dify (cerebro IA / Back office de análisis)
  **Objetivo:** orquestar los agentes LLM: clasificación de intención, extracción de datos, scoring IA, generación de respuestas, personalización de campañas.
  **Meta:** ejecutar la topología multi agente (Router → Extractor → Scoring → Conversacional, ver CTX 05 §4) y las metodologías comerciales (CTX 04 §8).
  **Estado:** ✅ Workflow lead classifier operativo con OpenRouter (8 nodos, output unificado ADR 021). RAG G5.

### M5 — n8n (orquestador de flujos)
  **Objetivo:** conectar eventos entre módulos sin código: inbound (Chatwoot→Dify→Twenty), broadcast (campañas), nurturing, futuro onboarding de clientes.
  **Meta:** flujos inbound y broadcast reales end to end; luego workflow de nurturing (ROAD 5.1) y de onboarding SaaS (CTX 01 §5.3).
  **Estado:** 🟡 90%: 2 3 workflows importados/activados vía SQL (workaround body parser bug ADR 019); faltan credenciales y toggle UI. RAG G6.

### M6 — Twenty CRM (persistencia comercial / estado del lead)
  **Objetivo:** sistema de registro del lead: datos duros, campos de calificación (SPICED/MEDDIC), score, historial, oportunidades y pipelines.
  **Meta:** ser la "fuente de verdad" comercial que consolida el handoff (CTX 04 §7) y alimenta los pipelines por tipo de cliente (CTX 03).
  **Estado:** ✅ API key JWT, 10 campos custom en `people`, sync 12/12 leads. Pendiente: bidireccionalidad, oportunidades. RAG G7.

### M7 — PostgreSQL + Redis + Weaviate (capa de datos)
  **Objetivo:** persistencia relacional (5 BD), estado volátil/colas (Redis), vectores para RAG (Weaviate).
  **Meta:** schema Lumi multi tenant con RLS como primario (DATA 10); Redis como store de conversaciones + cache real; Weaviate por tenant.
  **Estado:** ✅ Operativos. Deuda: helper aún lee/escribe JSON store. RAG G1 03/04/05.

### M8 — Authelia (identidad / SSO de borde)
  **Objetivo:** un solo login delante de todos los módulos (guardián de entrada).
  **Meta:** sesión única de 8h; base para rate limiting por tenant y auditoría (CTX 01 §2).
  **Estado:** 🟡 Implementado (ADR 016), activación completa pendiente. RAG G9 01.

### M9 — Meta WhatsApp API (canal principal)
  **Objetivo:** envío/recepción real de mensajes WhatsApp Business.
  **Meta:** token permanente, webhook registrado, templates HSM aprobados (obligatorio para reactivación >24h, CTX 04 §9).
  **Estado:** 🔴 0% — **bloqueante raíz** del proyecto (P0 01): App creada, faltan credenciales permanentes. RAG G8 01.

### M10 — Twilio (canal alternativo / voz futura)
  **Objetivo:** puente WhatsApp vía Twilio (canal alterno a Meta directo) y llamadas de voz (F3 ROAD).
  **Estado:** 🟡 Bridge Chatwoot↔Twilio implementado en helper (`/api/chatwoot/push`, `/webhooks/chatwoot outbound`, `/api/twilio/send`); llamadas pendientes (ROAD 3.2). RAG G8 04.

### M11 — Frappe/ERPNext (ERP — Fase 2, no iniciada)
  **Objetivo:** extender el flujo comercial más allá del CRM: pedidos, facturación, órdenes — el lead calificado se convierte en venta registrada.
  **Meta (FASES CRUZADAS F2):** lead en Twenty → factura automática en Frappe como verificación E2E.
  **Estado:** 🔴 No iniciada (depende de F1). Abstracción en CTX 03 §5. RAG G17.

### M12 — Lumi Sales Copilot (asistente del vendedor — Fase 3)
  **Objetivo:** copiloto para el vendedor humano: recomendaciones, seguimiento de leads, análisis de conversación en vivo, insights en split view.
  **Meta (BUS §8):** >5h/día de uso por vendedor; KPI 5 (salud pipeline) >60. Hereda el proyecto hermano `lumi/` (Omnipresence) como base técnica.
  **Estado:** 🔴 No iniciada (depende de F2). RAG G17 02.

### M13 — Módulos de integración planificados (observabilidad/errores/storage/BI)
  Prometheus+Grafana, GlitchTip, MinIO, Metabase, Flowbite — objetivos detallados en CTX 01 §6. RAG G14.

## 3. Metas globales medibles (de BUSINESS MASTER §8 y ROADMAP)

| Métrica técnica | Meta | Métrica de negocio | Meta |
|   |   |   |   |
| Disponibilidad | >99.9% | Leads clasificados/día | >50 |
| Helper node latencia | <200ms p95 | Conversión de leads (KPI 1) | >15% global |
| Clasificación Dify | <5s | Auto resolución agente (KPI 3) | >70% sin humano |
| Throughput | >1000 msgs/hora | Costo por lead (KPI 4) | <$0.01 |
| Precisión IA | >85% (F4: >90%) | Efectividad campañas (KPI 2) | >60 score compuesto |

## 4. Mapa de fases y dependencia de módulos

```
F0 Fundación ✅ (M1 M7 base)
F1 WhatsApp+IA+Twenty 🟡 70 75% (M3,M4,M5,M6,M9) ← bloqueada por M9 (Meta App)
F2 Frappe ERP 🔴 (M11) — depende de F1
F3 Lumi Copilot 🔴 (M12) — depende de F2
F4 IA Avanzada 🔴 (M4 ampliado: RAG completo, multi modal, voz) — depende de F3
F5 Producción 🔴 (M8,M13: hardening, monitoreo, backups, CI/CD)
F6 Analytics 🔴 (M13 Metabase + Data Warehouse)
F7 Multi Tenant 🔴 (M2,M7: aislamiento total, billing, onboarding self service)
```

> Nota de criterio (heredada de FASES CRUZADAS): coexisten dos numeraciones de fases — la de `Avances/ROADMAP.md` (producto, arriba) y la de `ROADMAP MULTI AGENT MEMORY CONTEXT.md` (técnica del sistema de agentes: F0 hardening, F1 memoria, F2 multi modal, F3 voz, F4 multi contexto, F5 orquestación, F6 visualización, F7 verificación). En TEC 03 se unifican en una sola tabla de seguimiento. **Regla:** al citar una fase, indicar siempre su fuente (`ROADMAP Fx` vs `ROAD Fx`).

## 5. Objetivos y criterios de cumplimiento (seguimiento)

| # | Objetivo contextual | Criterio medible | Estado | Seguimiento |
|   |   |   |   |   |
| CTX02 O1 | Cada módulo tiene objetivo y meta declarados | Este documento + RAG actualizados al cambiar alcance de un módulo | ✅ Inicial | TEC 04 (control de cambios) |
| CTX02 O2 | F1 completa (canal real operativo) | Flujo inbound Meta→helper→n8n→Dify→Twenty→respuesta E2E en producción | 🟡 70 75% | TEC 03 OT 01, OBJETIVOS PENDIENTES P0 |
| CTX02 O3 | Módulos con salud visible | COMPONENTES.md y dashboard reflejan estado real de cada servicio | ✅ | RAG G14 |
| CTX02 O4 | Nuevos módulos (ERP, Copilot) entran solo con F1 cerrada | Ninguna tarea de F2 F4 iniciada antes de verificación `verify mvp.sh` | En control | FASE1 MVP CRUZADO (reglas de oro) |

   

## Referencias cruzadas

  → [CTX 01 Infraestructura](CTX 01 INFRAESTRUCTURA.md) (rutas de escalado del stack)
  → [CTX 04 Lógica de vendedor](CTX 04 LOGICA VENDEDOR.md) (comportamiento que M4/M5/M6 ejecutan)
  → [CTX 05 Plantillas de negocio](CTX 05 ABSTRACCION AGENTE PLANTILLAS NEGOCIOS.md) (cómo M2/M4 se configuran por rubro)
  → [TEC 02 Funciones e implementación](../tecnica/TEC 02 FUNCIONES IMPLEMENTACION.md) (estado real por función)
  → [Archivo maestro RAG](../maestro/MAESTRO FUNCIONALIDADES CORE.md) (inventario navegable por módulo)
