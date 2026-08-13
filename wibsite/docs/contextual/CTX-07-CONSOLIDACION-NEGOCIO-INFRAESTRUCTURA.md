# CTX-07 — Consolidación: Lógica de Negocio frente a Infraestructura

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Contextual (QUÉ/POR QUÉ) — **documento de cierre de la capa contextual**
> **Fuentes consolidadas:** todos los CTX-01 a CTX-06 + `Avances/ESTADO-GENERAL.md`, `doc/ESTADO.md`, `FASE1-MVP-CRUZADO.md`, `FASES-CRUZADAS.md`.
> **Propósito:** responder en un solo lugar: *¿qué capacidad de negocio exige cada decisión de infraestructura, qué brechas existen hoy, y en qué orden se cierran?*

---

## 1. Matriz capacidad de negocio ↔ infraestructura que la sostiene

| Capacidad de negocio (QUÉ) | Componente de infraestructura (CÓMO) | Estado infra | Brecha |
|---|---|---|---|
| Agente vendedor 24/7 que califica y propone (CTX-04) | Dify workflows + helper state machine + OpenRouter | 🟡 Parcial | Falta grafo comercial (8 etapas) sobre la state machine ya lista; Meta para canal real |
| Respuestas en segundos, no en minutos | OpenRouter gpt-4o-mini + typing indicator + colas | 🟡 Parcial | Typing indicator pendiente; cadena completa 3-8s sin feedback visual |
| Plantillas por rubro sin código (CTX-05) | Agent Config Editor (helper) + esquema JSON plantilla/cliente | 🟡 Parcial | Editor hoy cubre tipo+personalidad; falta leer esquema completo (objeciones/temperatura/followup) |
| Handoff útil al humano (CTX-04 §7) | Twenty CRM (campos custom) + Chatwoot (inbox) + sync helper | 🟡 Parcial | Sync unidireccional; inbox pendiente Meta; briefing automático pendiente |
| Campañas masivas con tracking | n8n workflow 02 + Meta API + helper track | 🔴 Bloqueado | Credenciales Meta (P0-01); workflow inactivo |
| Reactivación de leads (followup) | ROAD 5.1 nurturing n8n + HSM templates Meta | 🔴 No iniciado | Depende de Meta + ventana 24h exige HSM aprobados |
| Memoria de conversación | Redis conversation store (9 estados) | ✅ Listo | — |
| RAG / conocimiento del negocio | Weaviate + ragEngine helper | ✅ Listo (básico) | Sync externa de productos/precios pendiente |
| Multi-tenant real (vender a N clientes) | PostgreSQL Lumi + organization_id + RLS | 🔴 Deuda crítica | Helper aún en JSON store (CTX01-O2) |
| Un solo login | Authelia + Nginx auth_request | 🟡 Implementado | Activación completa pendiente |
| Observabilidad ("ver venir" problemas) | Prometheus/Grafana/GlitchTip + SLI helper | 🟡 SLI básico | Stack de monitoreo por instalar (CTX-01 §6) |
| BI para clientes | Metabase + daily_metrics | 🔴 No iniciado | Requiere migración PG previa |
| Facturación SaaS | Stripe + subscriptions/billing_events (schema Lumi) | 🔴 No iniciado | Cobro manual en pilotos primero |
| ERP del cliente (pedidos/facturas) | Frappe/ERPNext + n8n | 🔴 Fase 2 | Depende de F1 cerrada |

## 2. Las 5 brechas críticas actuales (consolidadas de todos los documentos)

| # | Brecha | Qué bloquea | Origen documental | Resolución |
|---|---|---|---|---|
| B1 | **Credenciales Meta** (token permanente, webhook registrado) | Canal real inbound+broadcast, inbox Chatwoot, HSM de reactivación, F2-F4 en cascada | P0-01 en todos los docs de estado | Gestión externa (Meta Business) — ver TEC-03 OT-01 |
| B2 | **JSON store como primario** | Multi-tenant, Metabase, datos huérfanos, escalado | ADR-001/007, DATABASE-VALIDATION, DATA §10 | Migración 3 fases (DUMP→DUAL WRITE→CUTOVER) — TEC-03 OT-02 |
| B3 | **n8n body parser bug** (2.23.4) | Gestión de workflows/credenciales vía API | ADR-019 | Workaround UI+SQL; no actualizar n8n hasta fix confirmado |
| B4 | **Authelia sin activación completa** | 6 logins, exposición de módulos | ADR-016, SEC A-11 | Completar activación — TEC-03 OT-01 |
| B5 | **Sin observabilidad de infraestructura** | Validación con pilotos a ciegas | CTX-01 §5.2 | Prometheus+Grafana+GlitchTip — TEC-03 OT-03 |

## 3. Correspondencia de estados: negocio ↔ técnico (los dos modelos de estados)

La plataforma maneja **dos máquinas de estados** que deben mantenerse coherentes:

| Máquina | Estados | Dueño | Persistencia |
|---|---|---|---|
| **Técnica (implementada)** | `greeting, discovery, qualification, proposal, objections, closing, post_sale, support, escalated` | conversationStore helper (RAG-G10-01) | Redis TTL 7d |
| **Comercial (diseñada)** | `nuevo, calificando, propuesta_enviada, en_objeción, agendado/cerrado, enfriándose, reactivado, perdido` | Núcleo de plantillas (CTX-04 §3) | CRM (Twenty) |

**Regla de mapeo:** la máquina comercial es una *proyección* de la técnica + datos del lead:
- `discovery/qualification` ↔ `calificando` · `proposal` ↔ `propuesta_enviada` · `objections` ↔ `en_objeción` · `closing` ↔ `agendado/cerrado` · sin actividad + decay ↔ `enfriándose` · nurture que responde ↔ `reactivado` · `lost_threshold` alcanzado ↔ `perdido`(=nurture pasivo).
- El estado **técnico** vive en Redis (rápido, volátil); el **comercial** se sincroniza al CRM por evento (`temperature_change`, `handoff`) — nunca al revés.

De la misma forma, el `qualification_stage` del CRM (`Cold / SPICED_In_Progress / MEDDIC_Qualified / Ready_To_Close`, CTX-03 §3) es la proyección metodológica usada por el Router para elegir prompt de agente.

## 4. Secuencia consolidada de cierre (negocio manda sobre infra)

Orden resultante de cruzar la ruta estratégica (CTX-01 §4), el MVP cruzado y los bloqueantes:

```
PASO 1  Cerrar B4 (Authelia) + B5 parcial (SLI ya existe; instalar Grafana)
        → producto demostrable y seguro      [1-3 días]
PASO 2  Resolver B1 (Meta) → flujo inbound real E2E + campaña real
        → la plataforma "vende" de verdad    [1-2 días tras credenciales]
PASO 3  Cerrar B2 (migración PG Lumi) → multi-tenant real
        → se puede vender a >1 cliente sin riesgo  [~3 semanas]
PASO 4  Pilotos reales (1-3) + observabilidad completa
        → evidencia de negocio + técnica     [continuo]
PASO 5  Con evidencia: automatizar onboarding, reforzar datos,
        BI (Metabase), billing manual → Stripe
PASO 6  Decisión CON NÚMEROS (costo/tenant real, síntomas del host):
        ¿seguir en Ruta B o saltar a Ruta A (K8s)?
```

**Regla anti-trampa (de la fuente):** no invertir fuerte en SaaS maduro (multi-tenant completo, billing, compliance) antes de tener evidencia de uso real. Netflix no nació con microservicios.

## 5. Marco de decisión de escalado (cuándo cambiar de ruta)

Decidir Ruta B → Ruta A solo cuando **al menos 2** de estas señales con números reales se den:
1. CPU compitiendo entre n8n y Dify de forma sostenida (visible en Grafana, no en sensaciones).
2. Caídas en cascada por falta de réplicas.
3. Costo por tenant activo medido que justifica autoscaling (objetivo CTX01-O7: medir costo/cliente con 2-3 pilotos).
4. SLA contractual con clientes pagando que exija HA (>99.9% medido).

Umbrales de orquestación (OPS §3): Compose hasta ~5-10 tenants · Swarm 10-100 · K8s 100+.

## 6. Trazabilidad objetivo de negocio → objetivo técnico → verificación

| Objetivo de negocio | Objetivo contextual | Objetivo técnico (TEC-03) | Verificación |
|---|---|---|---|
| Demostrar el producto a pilotos | CTX01-O1 (SSO) | OT-01 | Login único abre todos los módulos |
| Vender sin riesgo de fuga entre clientes | CTX01-O2 / CTX06-O6 | OT-02 | RLS activo, 2 tenants aislados, 0 huérfanos |
| Agente que vende, no formulario | CTX04-O1..O6 | OT-08 | Flujo 8 etapas + plantilla JSON activa en conversación real |
| Enterarse antes que el cliente | CTX01-O3/O4 | OT-03 | Error forzado visible en GlitchTip; métricas en Grafana |
| Reportes que el cliente puede ver | CTX01-O6 / CTX06-O2 | OT-04 | Dashboard Metabase filtrado por tenant |
| No perder leads por silencio | CTX04-O5 | OT-08 | Cadencia dispara HSM tras 24h (ventana Meta) |
| Handoff que cierra | CTX04-O6 / CTX03-O1 | OT-06 | Briefing automático en Twenty con score+objeciones+1 acción |

## 7. Objetivos y criterios de cumplimiento de esta consolidación

| # | Objetivo | Criterio |
|---|---|---|
| CTX07-O1 | Toda decisión de infra nueva justificada por capacidad de negocio | Cada ítem nuevo en TEC-03 referencia un CTX0X-OY |
| CTX07-O2 | Las 5 brechas con dueño y paso | B1-B5 reflejadas en TEC-03 con estado actualizado semanal |
| CTX07-O3 | Dos máquinas de estados coherentes | Mapeo §3 implementado en el núcleo; sync comercial→CRM por evento |
| CTX07-O4 | Escalado por números | Decisión Ruta A documentada solo con 2+ señales de §5 |

---

## Referencias cruzadas

- → Cierra la capa contextual: [00-INDICE](00-INDICE-CONTEXTUAL.md)
- → Ejecución: [TEC-03 Objetivos técnicos y fases](../tecnica/TEC-03-OBJETIVOS-TECNICOS-FASES.md)
- → Seguimiento: [TEC-04 Control de cambios](../tecnica/TEC-04-SEGUIMIENTO-CAMBIOS-ITERACIONES.md) y [Archivo maestro RAG](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md)
