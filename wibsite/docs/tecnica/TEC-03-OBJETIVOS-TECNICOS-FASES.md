# TEC-03 — Objetivos Técnicos, Fases y Cómo Implementarlos

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Técnica (CÓMO/EJECUCIÓN)
> **Propósito:** lista única de objetivos técnicos (OT-XX) con su implementación concreta, verificación y trazabilidad a objetivos de negocio (CTX) y fases. **Es el documento de planificación de iteraciones.**
> **Fuentes:** `FASE1-MVP-CRUZADO.md`, `FASES-CRUZADAS.md`, `Avances/OBJETIVOS-PENDIENTES.md`, `SAAS_PLAN-INTEGRACION-MODULOS.md`, `ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md`, CTX-01…07.

---

## 1. Unificación de las dos numeraciones de fases

Coexisten dos esquemas (registrado como inconsistencia conocida en TEC-04 §5):

| Fase unificada | `Avances/ROADMAP.md` (producto) | `ROADMAP-MULTI-AGENT` (sistema agente) | Estado |
|---|---|---|---|
| **U-F0** Fundación | F0 ✅ | — | ✅ Completa |
| **U-F1** Canal real + MVP agente | F1 🟡 70-75% | F0 hardening ✅, F1 memoria ✅ (básico) | 🟡 En curso |
| **U-F2** ERP | F2 🔴 | — | 🔴 |
| **U-F3** Copilot | F3 🔴 | — | 🔴 |
| **U-F4** IA avanzada | F4 🔴 | F2 multi-modal, F3 voz, F4 multi-contexto, F5 orquestación | 🔴 |
| **U-F5** Producción | F5 🔴 | F7 verificación | 🔴 |
| **U-F6** Analytics | F6 🔴 | F6 visualización | 🔴 |
| **U-F7** Multi-tenant | F7 🔴 | F0.2 (hecho básico) | 🔴 |

**Regla de cita:** usar siempre el código unificado (U-Fx) o la fuente explícita (`ROADMAP Fx` / `ROAD x.x`).

## 2. Objetivos técnicos (orden de ejecución recomendado)

### OT-01 — Cerrar acceso y canal real (U-F1, P0) — *brechas B1+B4*
**Objetivo:** SSO operativo + flujo WhatsApp real E2E.
| Tarea | Implementación | Verificación |
|---|---|---|
| Activar Authelia completo | `docker compose up -d authelia`; locations protegidos con `auth_request /auth` (config ya en ADR-016/CHECKLIST-SSO) | Login único abre Hub, n8n, Chatwoot, Twenty, Dify |
| Credenciales Meta | Obtener token permanente + registrar webhook `https://<dominio>/webhooks/whatsapp` (verify `wibsite_verify_2026`) | `GET /webhooks/whatsapp` verificado por Meta |
| Inbox Chatwoot WhatsApp | Phone Number ID `1287367854450926`, WABA `1024953670257131` | Mensaje de prueba visible en inbox |
| Credenciales n8n | Crear vía UI (bug body parser): Chatwoot API, Dify Bearer, Twenty Bearer, Meta Graph API | Workflow 01 ejecuta sin error de credenciales |
| E2E inbound | Mensaje real → helper → n8n → Dify → Twenty → respuesta | Checklist `PRUEBAS-Y-VERIFICACIONES.md` flujo inbound |
| E2E broadcast | Activar workflow 02 + campaña de prueba | Delivery `sent` trackeado en `/api/campaigns/:id/stats` |

**Contexto:** CTX01-O1, CTX02-O2, CTX04-O8 · **Bloqueante externo:** aprobación Meta Business.

### OT-02 — Migración JSON → PostgreSQL multi-tenant (U-F1/U-F7, P0) — *brecha B2*
**Objetivo:** PostgreSQL como primario con `organization_id`/tenant_id + RLS.
| Fase DATA §10 | Qué hacer | Verificación |
|---|---|---|
| Semana 1 DUMP | `scripts/db/migrate-json-to-pg.js` (ya diseñado: campaigns, leads, deliveries, scores, optOuts con ON CONFLICT) | Conteos JSON == conteos PG |
| Semana 2 DUAL WRITE | Endpoints escriben PG+JSON, leen PG | Tests 112 pasando sin cambios de API |
| Semana 3 CUTOVER | Solo PG; JSON queda backup de emergencia | `GET /health` dependencies.db ok; store.json sin escrituras nuevas |
| RLS | `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + policy `tenant_id = current_setting('app.tenant_id')`; middleware `SET app.tenant_id` | 2 tenants de prueba sin fuga cruzada (403/404) |

**Contexto:** CTX01-O2, CTX06-O6 · **Desbloquea:** Metabase (OT-04), multi-tenant real (G18).

### OT-03 — Observabilidad: Prometheus + Grafana + GlitchTip (U-F5, P1) — *brecha B5*
**Implementación (receta completa en `Organizar_Estructurar/SAAS_PLAN-INTEGRACION-MODULOS.md` §1-2):**
1. Agregar servicios `cadvisor`, `prometheus`, `grafana` a docker-compose + `monitoring/prometheus.yml` (jobs cadvisor y helper:3100/metrics).
2. Sumar `prom-client` al helper (middleware `/metrics`).
3. Nginx: `location /grafana/ { auth_request /auth; proxy_pass http://grafana:3000/; }`.
4. GlitchTip (4 contenedores: postgres, redis, app, worker) + `@sentry/node` en helper (`Sentry.init({dsn: GLITCHTIP_DSN, tracesSampleRate: 0.2})`, handlers antes/después de rutas).
**Verificación:** Grafana con datasource `http://prometheus:9090` muestra métricas reales de todos los contenedores; error forzado en helper aparece en GlitchTip con contexto. **Contexto:** CTX01-O3/O4.

### OT-04 — Storage (MinIO) y BI (Metabase) (U-F5/U-F6, P1-P2)
1. **MinIO:** servicio + bucket `wibsite-media`; `/storage/` (API S3, **sin** auth_request) y `/minio-console/` (con auth); cliente `minio` en helper (`uploadFile`); producción: usuario de servicio con permisos solo al bucket + lifecycle policy. **Contexto:** CTX01-O5.
2. **Metabase (tras OT-02):** BD `metabase` en init-db.sql; rol `metabase_reader` solo lectura sobre `wibsite`; `location /reportes/` con auth; dashboard campañas/leads por estado/tasa respuesta; sandboxing por `organization_id`. **Contexto:** CTX01-O6.

### OT-05 — Hardening y operación (U-F5, P1)
- HTTPS con certs ya generados (A-04), CORS restrictivo (A-03), usuarios PG por servicio (C-07), rotación de keys (C-02), PII filter en logs (`src/pii-filter.js`, DATA §6), backups script unificado `backup.sh` (pg_dump 5 DBs + Redis SAVE + configs + media, retención 30d) **con restauración probada** (CTX01-O8), `archive.sql` mensual (retención CTX-06 §6). Roadmap completo: SECURITY-MASTER F0-F5. **Contexto:** CTX01-O8, CTX06-O4/O5.

### OT-06 — CRM metodológico y bidireccional (U-F1/U-F4, P1) — *CTX03-O2/O3/O4*
1. Crear campos SPICED/MEDDIC/scoring en Twenty (`people`/Opportunity) según CTX-03 §3 — vía `POST /rest/metadata/fields` (cuidado namespace global: prefijar).
2. Pipelines por tipo de cliente + campo `ContactType` + `Modo_Conversación`.
3. Webhook Twenty→helper (escuchar cambios) + sync por evento (`temperature_change`, `handoff`).
**Verificación:** lead con `qualification_stage=SPICED_In_Progress` cambia a `MEDDIC_Qualified` al completar Impact+Economic Buyer; briefing de handoff visible como nota en Twenty.

### OT-07 — ERP Frappe/ERPNext (U-F2, P2) — *CTX03-O5*
Setup Frappe en compose → modelo órdenes/facturas → sync leads Twenty→Frappe → workflows n8n. **Verificación F2:** lead cerrado en Twenty → factura automática en Frappe. **Gate:** no iniciar antes de OT-01 (regla CTX02-O4).

### OT-08 — Motor de plantillas y grafo comercial (U-F4, P1) — *el corazón de CTX-04/05*
**Objetivo:** el núcleo ejecuta plantillas por rubro (G15/G16).
| Paso | Implementación | Referencia |
|---|---|---|
| 1. Loader de plantillas | `helper-node/services/templateEngine.js`: carga `template-*.json` + `client-config-*.json`, merge en runtime, valida contra esquema CTX-05 §3 | CTX-05 |
| 2. Grafo comercial | Nodos del flujo de 8 etapas sobre `conversationStore` (mapeo CTX-07 §3); nodos de reencuadre/objeción/oferta/reactivación | CTX-04 §3 |
| 3. Confidencialidad | Filtro de lectura de estado: respuesta solo con `public` + `assisted` transformados | CTX-06 §4.2 |
| 4. Temperatura | Motor de reglas evalúa `signals[].condition` contra estado del lead; decay programado | CTX-04 §6 |
| 5. Followup | Cola de seguimiento (Bull+Redis o n8n schedule) con `followup.sequence`; HSM si >24h | CTX-04 §7, §10.2 |
| 6. Handoff | Generador de paquete según `handoff.required_fields` + 1 `next_action`; briefing a Twenty/Chatwoot/Slack | CTX-04 §7.3 |
| 7. Editor visual | Extender Agent Config Editor a esquema completo (7 pestañas ROAD 4.1) | CTX-05 §7 |

**Verificación:** conversación de prueba con plantilla consultora ejecuta objeción "muy caro" → respuesta del banco; temperatura calculada visible en estado; intento 2 de followup disparado a +1d. **Prerrequisitos:** OT-01 (canal), recomendado OT-02.

### OT-09 — Planes y límites SaaS (U-F7, P2)
Aplicar DDL `platform_tenants/branches/users` (OPS §2) con límites denormalizados por plan (CTX-06 §1); middleware `planLimiter` (patrón ya existente en `lumi/backend/src/api/middleware/planLimiter.js` del proyecto hermano); cobro manual en pilotos → Stripe después. **Contexto:** CTX06-O1.

### OT-10 — Topología multi-agente (U-F4, P2)
Router por `intent_label`+`conversation_state` → 6 agentes (Qualifier/Sales/Support/Nurturing/Post-Sale/Voice) con prompts y temperaturas propios (ROAD 5.2); separación front/back-office (CTX-04 §11); sub-agente adaptador con GPT-4o-mini + cache (ROAD 4.2). **Prerrequisito:** OT-08.

### OT-11 — Multi-modalidad y voz (U-F4, P2-P3)
Pipeline multimedia (ROAD 2.1: 7 tipos, cola Bull, límites 10/25/50/20MB, storage por tenant → MinIO de OT-04), TTS con fallback 4 proveedores (ROAD 3.1), llamadas Twilio Voice (ROAD 3.2). **Contexto:** CTX-04 §10.1 (edge case 1).

### OT-12 — Suite de verificación continua (transversal)
Completar `verify-mvp.sh` (FASE1-MVP-CRUZADO) y `verify-fase.sh <FASE>` (FASES-CRUZADAS); CI GitHub Actions `mvp-tests.yml`; 176 tests actuales (22 suites) + tests E2E de flujo real. **Regla:** verificación fallida = no avanzar (regla de oro).

## 3. Tabla de seguimiento (actualizar en cada iteración)

| OT | Objetivo | Prioridad | Fase-U | Brecha/CTX | Estado | Última verificación |
|---|---|---|---|---|---|---|
| OT-01 | Acceso + canal real | P0 | U-F1 | B1, B4 / CTX01-O1, CTX02-O2 | 🟡 Meta pendiente | — |
| OT-02 | Migración PG multi-tenant | P0 | U-F1/F7 | B2 / CTX01-O2, CTX06-O6 | 🔴 | — |
| OT-03 | Observabilidad | P1 | U-F5 | B5 / CTX01-O3/O4 | 🔴 | — |
| OT-04 | MinIO + Metabase | P1-P2 | U-F5/F6 | CTX01-O5/O6 | 🔴 | — |
| OT-05 | Hardening + backups | P1 | U-F5 | CTX01-O8, CTX06-O4/O5 | 🟡 parcial | — |
| OT-06 | CRM metodológico | P1 | U-F1/F4 | CTX03-O2/O3/O4 | 🔴 | — |
| OT-07 | ERP Frappe | P2 | U-F2 | CTX03-O5 | 🔴 gated por OT-01 | — |
| OT-08 | Motor plantillas + grafo comercial | P1 | U-F4 | CTX04-O1..O6, CTX05-O3 | 🔴 diseño listo | — |
| OT-09 | Planes/límites SaaS | P2 | U-F7 | CTX06-O1 | 🔴 | — |
| OT-10 | Multi-agente | P2 | U-F4 | CTX05-O6 | 🔴 | — |
| OT-11 | Multi-modal + voz | P2-P3 | U-F4 | CTX04-O9 | 🔴 | — |
| OT-12 | Verificación continua | P0 transversal | todas | Reglas de oro | ✅ 176 tests OK + TeVS 13/13 + e2e-trace 10/10 | — |

**Cadencia de actualización:** este tabla se revisa semanal (junto a `Avances/OBJETIVOS-PENDIENTES.md`) — ver TEC-04 §3.

## 4. Próximas iteraciones sugeridas (cola ordenada)

1. **Iteración actual:** OT-01 (todo lo que no depende de Meta: Authelia, credenciales n8n, activación workflows) + OT-12 (verify-mvp).
2. **Siguiente:** OT-02 semanas 1-3 + OT-03 (en paralelo, no se tocan).
3. **Luego:** OT-06 + OT-08 pasos 1-4 (con canal real ya disponible).
4. **Después:** OT-04, OT-05 completo, OT-08 pasos 5-7.
5. **Fases futuras (gate: pilotos con evidencia):** OT-07, OT-09, OT-10, OT-11.

---

## Referencias cruzadas
- → [CTX-07 §4 Secuencia consolidada](../contextual/CTX-07-CONSOLIDACION-NEGOCIO-INFRAESTRUCTURA.md) (el porqué de este orden)
- → [TEC-02](TEC-02-FUNCIONES-IMPLEMENTACION.md) (base sobre la que se implementa)
- → [TEC-04](TEC-04-SEGUIMIENTO-CAMBIOS-ITERACIONES.md) (cómo registrar el avance)
- → `FASE1-MVP-CRUZADO.md` (verify-mvp.sh), `FASES-CRUZADAS.md` (verify-fase.sh), `docs/RUTA-ACCIONES-PENDIENTES.md` (pasos manuales detallados de OT-01)
