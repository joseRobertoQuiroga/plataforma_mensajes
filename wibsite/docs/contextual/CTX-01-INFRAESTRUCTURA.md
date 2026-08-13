# CTX-01 — Infraestructura: Planteamiento, Objetivos y Rutas de Escalado

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Contextual (QUÉ/POR QUÉ)
> **Fuentes consolidadas:** `Organizar_Estructurar/SAAS_GUIA-ESCALABILIDAD-MULTI-MODULO.md`, `Organizar_Estructurar/SAAS_PLAN-INTEGRACION-MODULOS.md`, `Organizar_Estructurar/SAAS_RUTA-ESTRATEGICA-AUTH-VALIDACION-SAAS.md`, `OPS-MASTER.md`, `docs/SCALABILITY-ANALYSIS.md`, `docs/DATABASE-VALIDATION.md`, `Avances/COMPONENTES.md`, ADR-016 (`docs/MEMORY.md`).
> **Ejecución técnica:** [TEC-01](../tecnica/TEC-01-ARQUITECTURA-INFRAESTRUCTURA.md) | Mapa RAG: G1, G9, G10, G14, G18 en [`../maestro/MAESTRO-FUNCIONALIDADES-CORE.md`](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md)

---

## 1. Punto de partida (diagnóstico consensuado)

La plataforma hoy es un **ecosistema multi-módulo open source en un solo host** (Docker Compose, 20 servicios, ver TEC-01). El diagnóstico compartido por `SAAS_GUIA-ESCALABILIDAD-MULTI-MODULO.md`, `SCALABILITY-ANALYSIS.md` y ADR-016 es:

| Dimensión | Estado actual | Riesgo que representa |
|---|---|---|
| Escalabilidad | Vertical pura: 1 host, sin réplicas ni balanceo | Contención de CPU/RAM entre n8n y Dify; caída en cascada |
| Identidad | Cada módulo con login propio (Dify, n8n, Chatwoot, Twenty…) → Authelia implementado como SSO de borde (ADR-016, 2026-07-15) | Parcialmente resuelto: falta completar activación y JWT interno |
| Multi-tenant | Sin aislamiento real: helper usa JSON store sin `organization_id`, sin FKs, sin RLS | 🔴 Alto (DATABASE-VALIDATION): un cliente podría ver datos de otro |
| Gateway | Nginx como proxy; Authelia como guardián; sin rate limiting por tenant ni auditoría unificada | Medio: cubierto en borde, no en API propia |
| Observabilidad | SLI/SLO básico en helper (`/health`, `/api/sli/metrics`); sin Prometheus/Grafana | Cualquier escalado sin métricas es "un tiro a ciegas" |

**Principio rector adoptado:** este estado **es el correcto para la fase de validación actual**. El error sería saltar a Kubernetes antes de tener usuarios pagando. La infraestructura crece por *escalera*, no por salto.

## 2. Idea central: identidad y costo son el mismo problema

Planteamiento clave de la guía de escalabilidad: **identidad federada** y **escalabilidad de costos** se resuelven con la misma pieza arquitectónica — una **capa de borde (edge layer)** delante de los módulos que resuelve a la vez:

- *Quién sos* → autenticación (SSO/OIDC)
- *Cuánto podés pedir* → rate limiting por tenant/plan
- *A dónde te enruto* → multi-tenant routing
- *Qué cacheo* → reducción de carga sobre los servicios internos

Esto formaliza lo que ADR-016 ya intuyó con Authelia + Nginx `auth_request`. Referencia conceptual: patrón "passport" (los servicios validan la firma del token del IdP, no re-interrogan credenciales).

## 3. Los 5 patrones de las grandes empresas adoptados como objetivo

| Patrón | Aplicación en Wibsite | Estado |
|---|---|---|
| Connection pooling (PgBouncer) | 1000 usuarios ≠ 1000 conexiones PG | Pendiente (Ruta B, paso 3) |
| Cache en capas | Redis ya corre: usarlo como cache real (dashboard, scoring), no solo colas | Parcial (conversation store ya usa Redis) |
| Autoscaling horizontal reactivo | Réplicas del servicio saturado que se apagan solas | Futuro (Ruta A) |
| Arquitectura orientada a eventos | n8n ya orquesta; falta cola real institucionalizada (Bull+Redis planeado en ROAD 1.1/2.1) | Parcial |
| Multi-tenancy modelo **Pool** (compartido con `organization_id` + RLS) | Es exactamente el schema Lumi ya diseñado (DATABASE-VALIDATION §2: 16-19 tablas, RLS en 10-12 tablas) | Diseñado, pendiente migración desde JSON store |

Referencia formal: "SaaS Tenancy Model" de AWS (Silo/Pool/Bridge) — el modelo **Pool** es el elegido por balance costo/aislamiento para SaaS B2B mediano.

## 4. Las tres rutas de escalado (opciones y decisión)

| | 🔴 Ruta A — Enterprise | 🟡 Ruta B — Pragmática | 🟢 Ruta C — Mínimo viable |
|---|---|---|---|
| Qué es | Kubernetes + Keycloak + Kong/service mesh + HPA + read replicas + Kafka/RabbitMQ | Compose/Swarm + Authelia/oauth2-proxy + Helper como gateway API + PgBouncer + Redis cache + migración a PostgreSQL Lumi con RLS | Solo Authelia delante de Nginx + escalado vertical + `proxy_cache` |
| Dificultad | Muy alta | Media | Baja (1-2 días) |
| Costo infra | Medio-alto inicial, barato por usuario a gran escala | Bajo (1-2 hosts) | Casi nulo |
| Resuelve SSO | ✅ Keycloak | ✅ Authelia | ✅ Authelia |
| Multi-tenant real | ✅ | ✅ (con migración Lumi) | ❌ |
| Autoscaling | ✅ automático | Manual (réplicas fijas + `least_conn`) | ❌ |
| Apto fase actual (validación) | ❌ Prematuro | ✅ **Recomendado** | ✅ Como parche rápido |

**Decisión contextual (de `SAAS_RUTA-ESTRATEGICA` + guía):** los tres objetivos estratégicos son **secuenciales, no paralelos**:

```
1. Autenticación resuelta rápido (Ruta C → Authelia)   [EN CURSO — ADR-016]
        ↓ da producto demostrable y seguro para pilotos
2. Validación de arquitectura con uso real (piloto + métricas)
        ↓ evidencia antes de invertir más
3. Camino a SaaS maduro (Ruta B completa → Ruta A solo con números)
```

La trampa a evitar (explícita en la fuente): madurar infraestructura (objetivo 3) antes de tener evidencia de uso real (objetivo 2).

## 5. Objetivos de infraestructura por objetivo estratégico

### 5.1 Autenticación rápida sin sobre-ingeniería
- **Opción elegida:** guardián de borde (Authelia) delante de Nginx — un solo login para Dify, n8n, Chatwoot, Twenty sin tocar código interno de los módulos. Estado: implementado (ADR-016); pendiente activación completa (ver TEC-03).
- Evolución natural (no necesidad inmediata): módulo propio como emisor de identidad, o Keycloak si aparecen 2-3 clientes piloto con roles distintos.

### 5.2 Validación de arquitectura con evidencia
Combinación adoptada: **piloto controlado + observabilidad continua en simultáneo**.
- Piloto: 1-3 clientes reales (aunque sea a precio simbólico) → evidencia técnica y de negocio a la vez.
- Observabilidad: Prometheus + cAdvisor + Grafana (visibilidad antes que errores), GlitchTip para excepciones, para "ver venir" los problemas en vez de enterarse por el cliente.
- Opción complementaria previa a piloto pago: simulación de carga (k6/Locust) para conocer el techo del host actual.

### 5.3 SaaS maduro y seguro (sub-frentes con mínimo razonable vs nivel maduro)
| Sub-frente | Mínimo razonable | Nivel maduro |
|---|---|---|
| Datos sensibles | Cifrado de secrets, backups **probados** (restaurados de verdad), `.env` fuera del código | Cifrado en reposo, política de retención, auditoría de accesos |
| Aislamiento multi-tenant | `organization_id` en BD (schema Lumi) | RLS reforzado (la protección no depende del desarrollador) |
| Onboarding de clientes | Checklist documentado de pasos manuales | Flujo automatizado en n8n: "un botón, nuevo cliente" |
| Respuesta a incidentes | Alertas simples a Telegram/WhatsApp | Runbook de comunicación a cliente que paga |
| Legal/confianza | Política de privacidad + términos simples, opt-out documentado como política | Acuerdo de procesamiento de datos por cliente |
| Monetización | Cobro manual/factura simple en pilotos | Stripe (schema Lumi ya contempla `subscriptions`/`billing_events`) |

## 6. Módulos de integración planificados (ampliación del stack)

Del plan de integración (`SAAS_PLAN-INTEGRACION-MODULOS.md`) — orden de fases: **visibilidad → errores → storage → BI**; Flowbite en paralelo. Prerrequisito: el guardián de entrada (Authelia) ya activo; cada UI nueva va **detrás** de esa capa.

| Módulo | Propósito | Por qué esta elección | Prerrequisito |
|---|---|---|---|
| Prometheus + cAdvisor + Grafana | CPU/RAM/latencia por contenedor en tiempo real | cAdvisor es la fuente de métricas Docker; sin él Prometheus queda vacío | Ninguno |
| GlitchTip | Captura de errores del Helper con contexto | Sentry self-hosted completo requiere ~14 servicios (Kafka, ClickHouse…): desproporcionado. GlitchTip usa **el mismo SDK/protocolo Sentry** → migración futura sin cambiar código | Ninguno |
| MinIO | Storage único S3-compatible para adjuntos (imágenes WhatsApp, comprobantes, logos) | Reemplaza disco local disperso; API S3 no va detrás de `auth_request` (rompería firma de requests) | Ninguno |
| Metabase | Reportes/BI sobre datos de negocio (campañas, scoring, leads) | Solo rinde cuando el helper escriba en PostgreSQL schema Lumi (no sobre JSON) | Migración JSON→PG |
| Flowbite (CDN) | Consistencia visual del dashboard actual sin migrar de framework | HTML/JS puro, sin build | Ninguno |

**Nota de conexión:** el Helper suma `prom-client` (métricas `/metrics`), `@sentry/node` apuntando a GlitchTip, y cliente `minio` para uploads — todo configurable por `.env`. Detalle de implementación en TEC-03 (objetivos técnicos próximos).

## 7. Objetivos y criterios de cumplimiento (seguimiento)

| # | Objetivo contextual | Criterio medible | Estado | Seguimiento técnico |
|---|---|---|---|---|
| CTX01-O1 | Un solo login para todos los módulos | Login único abre Hub, Dify, n8n, Chatwoot, Twenty, Grafana | En curso (Authelia implementado, falta activación) | TEC-03 OT-01, RAG-G9-01 |
| CTX01-O2 | Multi-tenant real (aislamiento lógico) | Helper migrado a PostgreSQL con `organization_id` + RLS; 0 datos huérfanos | Pendiente | TEC-03 OT-02, RAG-G1-04 |
| CTX01-O3 | Observabilidad de infraestructura | Grafana muestra métricas reales de todos los contenedores; alertas P0/P1 configuradas | Pendiente | TEC-03 OT-03, RAG-G14 |
| CTX01-O4 | Captura de errores | Error forzado en Helper aparece en GlitchTip con contexto completo | Pendiente | TEC-03 OT-03 |
| CTX01-O5 | Storage unificado de archivos | Archivo subido aparece en bucket MinIO y es accesible vía `/storage/` | Pendiente | TEC-03 OT-04 |
| CTX01-O6 | BI para clientes | Metabase conecta con rol de solo lectura; dashboard filtrado por `organization_id` | Pendiente (tras OT-02) | TEC-03 OT-04 |
| CTX01-O7 | Validación con uso real | 1-3 pilotos reales con métricas activas; decisión Ruta B→A tomada **con números de costo/tenant**, no intuición | Pendiente | CTX-07 §5 |
| CTX01-O8 | Backups probados | Restauración real ejecutada al menos una vez | Pendiente | OPS 6, TEC-03 OT-05 |

**Regla de secuencia (no saltarse):** CTX01-O1 → CTX01-O2 → pilotos+CTX01-O3 → resto. La decisión de Ruta A (Kubernetes) solo se evalúa cuando el host único muestre síntomas reales (CPU compitiendo n8n/Dify, caídas en cascada) y existan clientes pagando.

---

## Referencias cruzadas

- → [CTX-02 Objetivos de módulos](CTX-02-OBJETIVOS-MODULOS.md) (qué hace cada servicio del stack)
- → [CTX-07 Consolidación negocio↔infraestructura](CTX-07-CONSOLIDACION-NEGOCIO-INFRAESTRUCTURA.md) (costo por tenant, cuándo escalar)
- → [TEC-01 Arquitectura e infraestructura técnica](../tecnica/TEC-01-ARQUITECTURA-INFRAESTRUCTURA.md) (inventario real de servicios, puertos, rutas)
- → [TEC-03 Objetivos técnicos y fases](../tecnica/TEC-03-OBJETIVOS-TECNICOS-FASES.md) (implementación de OT-01 a OT-05)
- → ADR-016 (Authelia), ADR-007 (migración PG), ADR-014 (Nginx DNS runtime) en `docs/MEMORY.md`
