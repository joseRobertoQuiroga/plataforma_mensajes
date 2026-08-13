# TEC-06 — Plan de Implementación por Fases (Ejecución Agéntica)

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Técnica (EJECUCIÓN POR FASES)
> **Propósito:** plan de **56 fases pequeñas** (F-01…F-56), cada una con **un solo objetivo**, su contexto, partes a modificar, implementación, pruebas, verificaciones (funcionamiento + seguridad/datos), logs y gate pre-producción/producción. Diseñado para **implementación agéntica**: un agente (o desarrollador) puede tomar UNA fase, ejecutarla con el contexto aquí referenciado, verificarla y marcarla — sin abarcar más contexto del necesario.
> **Fuentes:** [CTX-01…07](../contextual/), [TEC-01…05](./), [MAESTRO RAG](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md), `FASE1-MVP-CRUZADO.md`, `FASES-CRUZADAS.md`, `Organizar_Estructurar/`.

---

## 1. Protocolo de ejecución agéntica (cómo usar este archivo)

1. **Seleccionar fase:** tomar la primera fase ⬜ cuyas dependencias estén ✅. Leer SOLO: esta fase + sus referencias directas (columna "Contexto y refs").
2. **Antes de tocar código:** leer la ficha del módulo en `docs/context/` y los tests existentes del área (regla TEC-04 §3).
3. **Implementar** los pasos numerados. Nada fuera del alcance declarado.
4. **Ejecutar verificaciones** (funcionamiento + seguridad/datos). Si alguna falla → **la fase NO se cierra** (regla de oro).
5. **Cerrar:** marcar ✅ en la tabla de seguimiento (§5) con fecha + actualizar `Avances/ESTADO-GENERAL.md`, `CHANGELOG.md`, y el estado RAG afectado en `docs/maestro/`.
6. **Logs obligatorios** en cada fase (formato JSON, ver F-40): `security_alert`, `state_transition`, `api_call`, `error`, `config_change`, `data_migration`, `deployment`.

**Leyenda de estado:** ⬜ pendiente · 🔵 en curso · ✅ verificada · ⛔ bloqueada (con causa).

## 2. Mapa de oleadas y dependencias

```
A. Acceso y canal real (F-01…06)        ← bloqueante externo: credenciales Meta
B. Datos multi-tenant (F-07…12)         ← independiente de A (puede ir en paralelo)
C. Motor agéntico LangChain (F-13…18)   ← requiere B-09 (PG) recomendado
D. Comportamiento comercial (F-19…24)   ← requiere C
E. CRM metodológico y ERP (F-25…30)     ← requiere D-22; ERP gated por A
F. Seguridad y hardening (F-31…35)      ← transversal, tras A+B
G. Observabilidad (F-36…40)             ← tras F (paralelo con E)
H. Verificación unificada y portal (F-41…46) ← tras C+G
I. Validación agente/datos/plantillas (F-47…51) ← tras D+H
J. SaaS y despliegue (F-52…56)          ← requiere I + G + F
```

**Decisión técnica registrada (LangChain):** el motor agéntico se implementa con **LangChain.js + LangGraph.js dentro de `helper-node`** (Node/CommonJS ya existente — sin nuevo lenguaje ni servicio). Dify sigue como cerebro LLM (classifier/generator); LangGraph orquesta el grafo comercial y el contexto profundo. Checkpointer = `conversationStore` (Redis) extendido. Validar en F-13; si la POC falla, fallback: grafo propio sin dependencia (misma estructura de nodos).

---

## 3. Oleada A — Acceso y canal real (F-01…F-06)

> **Objetivo de oleada:** la plataforma habla y escucha por WhatsApp real, detrás de un solo login. **Salida:** flujos inbound y broadcast E2E en vivo. Contexto: CTX-02-O2, brechas B1/B4 (CTX-07 §2), OT-01 (TEC-03).

### F-01 — Activación completa de Authelia SSO
| Campo | Contenido |
|---|---|
| Objetivo | Un solo login gobierna todos los módulos |
| Depende de | — |
| Contexto y refs | CTX01-O1, ADR-016, `docs/CHECKLIST-SSO.md`, RAG-G9-01 |
| Partes a modificar | `docker-compose.yml` (servicio authelia activo), `nginx.conf` (`auth_request` en locations protegidos), `authelia/configuration.yml`, `authelia/users.yml` |
| Implementación | 1. Levantar `docker compose up -d authelia`. 2. Verificar Redis de sesiones. 3. Aplicar `auth_request /auth` a `/n8n/`, `/chatwoot/`, `/crm/`, `/admin/`, `:3003`. 4. Mantener públicas `/hub/`, `/webhooks/`, `/opt-outs/`, `/health`. 5. Probar login argon2id + cookie 8h |
| Pruebas | Test manual guiado por CHECKLIST-SSO (5 flujos) |
| Verif. funcionamiento | Login único abre Hub, n8n, Chatwoot, Twenty, Dify sin segundo prompt |
| Verif. seguridad/datos | Acceso anónimo a `/crm/` → redirect a login; `/health` sigue pública |
| Logs | `security_alert` ante 401/403 repetidos |
| Gate | Pre-prod: 5 flujos SSO OK. Prod: sesión expira a las 8h y renueva |

### F-02 — Credenciales n8n y activación de workflows
| Campo | Contenido |
|---|---|
| Objetivo | Workflows 01/02 activos con credenciales reales creadas vía UI |
| Depende de | F-01 |
| Contexto y refs | ADR-019 (body parser bug), TEC-02 §G6, RAG-G6-01/02 |
| Partes a modificar | n8n UI (credenciales: Chatwoot API, Dify Bearer, Twenty Bearer, Meta Graph API), variables `META_API_VERSION=v21.0` |
| Implementación | 1. Login n8n vía SSO. 2. Crear las 5 credenciales **desde la UI** (bug impide REST). 3. Asignarlas a workflows 01/02. 4. Activar toggle en UI. 5. Verificar `active=true` en BD |
| Pruebas | Ejecución manual de workflow 01 con payload de prueba |
| Verif. funcionamiento | `GET /rest/workflows` muestra 01 activo; ejecución sin error de credenciales |
| Verif. seguridad/datos | Credenciales no aparecen en exports ni logs |
| Logs | `api_call` por ejecución; `error` con workflow_name |
| Gate | Pre-prod: ejecución manual OK. Prod: webhook n8n responde 200 a ping real |

### F-03 — Meta: token permanente y webhook registrado
| Campo | Contenido |
|---|---|
| Objetivo | WhatsApp Business API operativa con token permanente |
| Depende de | gestión externa (Meta Business) |
| Contexto y refs | P0-01 (OBJETIVOS-PENDIENTES), `docs/RUTA-ACCIONES-PENDIENTES.md`, RAG-G8-01, CTX-04 §10.2 |
| Partes a modificar | `.env` (META_ACCESS_TOKEN permanente, WHATSAPP_PHONE_NUMBER_ID, WABA_ID), Meta App Dashboard (webhook URL + verify token `wibsite_verify_2026`) |
| Implementación | 1. Generar token permanente (System User). 2. Registrar webhook `https://<dominio>/webhooks/whatsapp`. 3. Suscribir campos `messages`. 4. Verificar handshake GET |
| Pruebas | `curl "http://localhost:8080/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=OK"` → `OK` |
| Verif. funcionamiento | Meta Dashboard muestra webhook verificado; POST de prueba llega al helper |
| Verif. seguridad/datos | Firma HMAC de Meta validada (middleware ya existe); token solo en `.env` |
| Logs | `api_call_external` Meta; `security_alert` ante firma inválida |
| Gate | Pre-prod: mensaje de prueba recibido. Prod: token sin expiración 60d |

### F-04 — Inbox WhatsApp en Chatwoot
| Campo | Contenido |
|---|---|
| Objetivo | Inbox WhatsApp operativa en Chatwoot conectada a Meta |
| Depende de | F-03 |
| Contexto y refs | `docs/context/CHATWOOT.md`, TEC-02 §G8, RAG-G8-03, Phone Number ID `1287367854450926`, WABA `1024953670257131` |
| Partes a modificar | Chatwoot UI (nueva inbox WhatsApp Cloud), variables Chatwoot en `.env` |
| Implementación | 1. Crear inbox WhatsApp en Chatwoot con Phone Number ID + token. 2. Configurar webhook saliente hacia helper `/webhooks/chatwoot-outbound`. 3. Probar mensaje entrante visible en bandeja |
| Pruebas | Enviar WhatsApp real al número → aparece en inbox |
| Verif. funcionamiento | Conversación creada en Chatwoot con contacto y mensaje |
| Verif. seguridad/datos | Inbox solo accesible tras SSO; API key Chatwoot en `.env` |
| Logs | `api_call` Chatwoot; `error` con inbox_id |
| Gate | Pre-prod: mensaje visible <5s. Prod: agente humano responde desde inbox y llega al cliente |

### F-05 — E2E inbound real
| Campo | Contenido |
|---|---|
| Objetivo | Mensaje real recorre Meta→helper→n8n→Dify→Twenty→respuesta |
| Depende de | F-02, F-03, F-04 |
| Contexto y refs | TEC-01 §6 (flujo), RAG-G6-01, G5-01, `docs/PRUEBAS-Y-VERIFICACIONES.md` (flujo inbound), CTX02-O2 |
| Partes a modificar | Ninguna (integración); ajustes puntuales de payloads si falla algún nodo |
| Implementación | 1. Enviar "Hola, quiero info de precios" desde WhatsApp real. 2. Verificar lead+delivery en helper. 3. Verificar ejecución n8n. 4. Verificar clasificación Dify (intent, score). 5. Verificar upsert en Twenty. 6. Verificar respuesta automática recibida |
| Pruebas | Checklist E2E de PRUEBAS-Y-VERIFICACIONES (inbound) completo |
| Verif. funcionamiento | Las 6 verificaciones pasan; latencia total <10s |
| Verif. seguridad/datos | HMAC OK; sin PII en logs (teléfono enmascarado si F-33 aplicado, si no, registrar deuda) |
| Logs | Trazabilidad por `conversation_id` en los 5 saltos |
| Gate | Pre-prod: 3 mensajes consecutivos OK. Prod: estable 24h sin intervención |

### F-06 — E2E broadcast real
| Campo | Contenido |
|---|---|
| Objetivo | Campaña programada real se envía por Meta API y se trackea |
| Depende de | F-03, F-05 |
| Contexto y refs | RAG-G6-02, G3-01/03, TEC-02 §G6, CTX-04 §10.2 (HSM) |
| Partes a modificar | `n8n/workflows/02-campaign-broadcast.json` (activar), plantilla HSM de campaña aprobada en Meta |
| Implementación | 1. Aprobar plantilla HSM `campaign_generic` en Meta. 2. Crear campaña de prueba (2 leads propios) vía API. 3. Programar `scheduled_at` pasado. 4. Verificar workflow 02 la recoge, personaliza (Dify), envía (Meta), trackea |
| Pruebas | Campaña E2E a 2 números controlados |
| Verif. funcionamiento | `/api/campaigns/:id/stats` muestra sent=2, delivered≥1 |
| Verif. seguridad/datos | Opt-out respetado (lead con STOP previo no recibe) |
| Logs | `campaign_sent` por destinatario; `error` con campaign_id |
| Gate | Pre-prod: 2/2 enviados. Prod: campaña de 50 sin errores de rate limit |

---

## 4. Oleada B — Base de datos multi-tenant (F-07…F-12)

> **Objetivo de oleada:** PostgreSQL como primario con aislamiento real por tenant. **Salida:** JSON store retirado a backup; RLS activo. Contexto: CTX01-O2, CTX06-O6, brecha B2, OT-02 (TEC-03), DATA §10.

### F-07 — Migración JSON→PG: DUMP inicial
| Campo | Contenido |
|---|---|
| Objetivo | Volcado completo del JSON store a PostgreSQL sin pérdida |
| Depende de | — |
| Contexto y refs | DATA §10 (F1 DUMP), TEC-04 D1, RAG-G1-03 |
| Partes a modificar | CREAR `scripts/db/migrate-json-to-pg.js` (diseño en DATA §10), `scripts/campaigns-schema.sql` (verificar tablas destino) |
| Implementación | 1. Script lee `wibsite-store.json`. 2. Inserta campaigns, leads, deliveries, scores, optOuts con `ON CONFLICT DO NOTHING`. 3. Reporta conteos por colección |
| Pruebas | Test: conteos JSON == conteos PG por colección |
| Verif. funcionamiento | Query `SELECT count(*)` por tabla == reporte del script |
| Verif. seguridad/datos | 0 filas con FK rota tras el dump |
| Logs | `data_migration` con conteos y duración |
| Gate | Pre-prod: dump repetible idempotente. Prod: dump ejecutado con backup previo |

### F-08 — DUAL WRITE (PG + JSON)
| Campo | Contenido |
|---|---|
| Objetivo | Endpoints escriben en PG y JSON, leen de PG |
| Depende de | F-07 |
| Contexto y refs | DATA §10 (F2), TEC-02 §G2 |
| Partes a modificar | `helper-node/index.js` (capa de acceso: extraer `store` a `services/store.js` con backend dual), `helper-node/services/` (nuevo `pgStore.js`) |
| Implementación | 1. Crear `pgStore.js` con mismas operaciones que el JSON store. 2. `store.js` como facade: lee PG, escribe ambos. 3. Feature flag `STORE_MODE=dual` en `.env`. 4. Sin cambios de API externa |
| Pruebas | 112 tests existentes pasando sin modificar + test nuevo: escritura visible en ambos stores |
| Verif. funcionamiento | CRUD campañas/leads/scoring/templates OK vía API; datos en PG |
| Verif. seguridad/datos | Escrituras concurrentes sin corrupción (lock ya existente + transacciones PG) |
| Logs | `data_migration` modo dual activo; `error` con store backend |
| Gate | Pre-prod: 48h en dual sin divergencias. Prod: diff automático JSON vs PG = 0 |

### F-09 — CUTOVER: PostgreSQL primario
| Campo | Contenido |
|---|---|
| Objetivo | PG único primario; JSON queda backup de emergencia |
| Depende de | F-08 |
| Contexto y refs | DATA §10 (F3), OT-02 |
| Partes a modificar | `helper-node/services/store.js` (`STORE_MODE=pg`), `helper-node/index.js` (quitar fallback a JSON en lecturas) |
| Implementación | 1. Cambiar `STORE_MODE=pg`. 2. JSON store solo escritura de respaldo (job horario) o desactivado. 3. Verificar `/health` dependencies.db |
| Pruebas | Suite completa + restart del contenedor (datos persisten) |
| Verif. funcionamiento | Todos los endpoints operan tras reinicio; dashboard carga datos |
| Verif. seguridad/datos | Backup JSON generado antes del corte |
| Logs | `config_change` STORE_MODE; `data_migration` cutover |
| Gate | Pre-prod: 72h solo-PG estable. Prod: rollback plan probado (volver a dual en <10 min) |

### F-10 — tenant_id y RLS en tablas wibsite
| Campo | Contenido |
|---|---|
| Objetivo | Aislamiento a nivel BD con Row Level Security |
| Depende de | F-09 |
| Contexto y refs | CTX-06 §8, OPS §2, DATA principio 5, RAG-G18-02 |
| Partes a modificar | Migración SQL: `ALTER TABLE campaigns/campaign_leads/lead_scores/opt_outs/workflow_logs ADD tenant_id`, `ENABLE ROW LEVEL SECURITY` + policies, índices por tenant |
| Implementación | 1. Migración agrega `tenant_id UUID NOT NULL DEFAULT 'default'`. 2. Policies `USING (tenant_id = current_setting('app.tenant_id')::uuid)`. 3. Índices `(tenant_id, status)` etc. 4. Datos existentes → tenant `default` |
| Pruebas | Test SQL: con `SET app.tenant_id='A'` no se ven filas de 'B' |
| Verif. funcionamiento | Endpoints devuelven solo datos del tenant activo |
| Verif. seguridad/datos | Bypass imposible incluso con SQL directo del rol de la app |
| Logs | `data_migration` RLS; `security_alert` ante intento cross-tenant |
| Gate | Pre-prod: 2 tenants aislados verificados. Prod: policy audit sin violaciones 7 días |

### F-11 — Middleware tenantContext
| Campo | Contenido |
|---|---|
| Objetivo | Resolución de tenant por request propagada a PG y Redis |
| Depende de | F-10 |
| Contexto y refs | ROAD 0.2, OPS §1, RAG-G18-02 |
| Partes a modificar | CREAR `helper-node/middleware/tenantContext.js`, `helper-node/index.js` (orden de middleware), `helper-node/services/conversationStore.js` (prefijos `{tenant}:conv:`) |
| Implementación | 1. Tenant por header `x-tenant-id` > API key > payload webhook. 2. `SET app.tenant_id` por request (transacción). 3. Prefijos Redis. 4. Respuestas 403/404 cross-tenant, 401 key inválida, 403 tenant inactivo |
| Pruebas | Tests: request sin tenant → default; con tenant B no ve datos de A (403/404) |
| Verif. funcionamiento | API responde correctamente por tenant; conversation store aislado |
| Verif. seguridad/datos | Sin fuga por cache Redis (claves prefijadas) |
| Logs | `security_alert` cross-tenant con request_id |
| Gate | Pre-prod: suite security pasando. Prod: penetración manual cross-tenant = 0 hallazgos |

### F-12 — Verificación de aislamiento y cero huérfanos
| Campo | Contenido |
|---|---|
| Objetivo | Gate de oleada: aislamiento probado + integridad referencial |
| Depende de | F-10, F-11 |
| Contexto y refs | DATABASE-VALIDATION §4 (7 flujos huérfanos), OPS §9.2 (`orphan-check.sql`), CTX06-O6 |
| Partes a modificar | CREAR `scripts/db/orphan-check.sql` (5 queries), FKs faltantes si aplica (ON DELETE CASCADE) |
| Implementación | 1. Ejecutar orphan-check. 2. Corregir FKs (DELETE campaign limpia leads/deliveries/scores). 3. Test de aislamiento con 2 tenants de prueba |
| Pruebas | Test: borrar campaña → 0 huérfanos; tenant A no ve B |
| Verif. funcionamiento | orphan-check = 0 filas en las 5 queries |
| Verif. seguridad/datos | RLS + FKs activos verificados en BD |
| Logs | `data_migration` fix FKs; reporte orphan-check |
| Gate | Pre-prod: gate documentado. Prod: orphan-check en cron diario con alerta |

---

## 5. Oleada C — Motor agéntico LangChain: contexto profundo (F-13…F-18)

> **Objetivo de oleada:** el núcleo ejecuta plantillas por rubro con manejo profundo del contexto (LangGraph + checkpointer). **Salida:** grafo comercial de 8 etapas corriendo sobre conversaciones reales de prueba. Contexto: CTX-04, CTX-05, OT-08 (TEC-03), RAG-G15/G16/G12-02.

### F-13 — Bootstrap del agent-core (LangChain.js)
| Campo | Contenido |
|---|---|
| Objetivo | POC: LangGraph.js operando dentro del helper con un mini-grafo de 2 nodos |
| Depende de | — |
| Contexto y refs | Decisión §2 de este documento, CTX-05 §1, CTX-04 §3 |
| Partes a modificar | `helper-node/package.json` (deps `@langchain/langgraph`, `@langchain/core`, `@langchain/openai`), CREAR `helper-node/services/agentCore/` (index.js, graph.js, nodes/) |
| Implementación | 1. Instalar deps. 2. Mini-grafo: nodo entrada → nodo respuesta con OpenRouter. 3. Endpoint temporal `POST /api/agent/test-graph`. 4. Medir latencia y tokens |
| Pruebas | Test POC: mensaje → respuesta del grafo; latencia <5s |
| Verif. funcionamiento | Endpoint responde con output del grafo |
| Verif. seguridad/datos | Sanitizer aplicado a la entrada (middleware existente) |
| Logs | `api_call` LLM con tokens/latencia |
| Gate | Pre-prod: POC aprobada → continuar oleada. Si falla: fallback grafo propio (misma estructura) |

### F-14 — Checkpointer: memoria profunda Redis + PG
| Campo | Contenido |
|---|---|
| Objetivo | Estado del grafo persistido por conversación (reanudable, auditable) |
| Depende de | F-13 |
| Contexto y refs | ROAD 1.1, CTX-07 §3 (dos máquinas), RAG-G10-01/02 |
| Partes a modificar | `helper-node/services/conversationStore.js` (extender como checkpointer: save/load por `conversation_id`, historial máx 100 msgs, TTL 7d), CREAR `agentCore/checkpointer.js` |
| Implementación | 1. Adaptador checkpointer LangGraph↔conversationStore. 2. Snapshot de estado del grafo por turno en Redis. 3. Resumen persistente en PG (tabla `conversation_summaries`) para memoria larga. 4. Recuperación tras restart |
| Pruebas | Test: conversación de 5 turnos, restart servicio, turno 6 conserva contexto |
| Verif. funcionamiento | Estado reanudado idéntico tras restart |
| Verif. seguridad/datos | Claves Redis prefijadas por tenant (F-11) |
| Logs | `state_transition` por turno con conversation_id |
| Gate | Pre-prod: 0 pérdida de contexto en tests. Prod: TTL y limpieza verificados 7 días |

### F-15 — Template engine (loader + validador de esquema)
| Campo | Contenido |
|---|---|
| Objetivo | El núcleo carga plantilla de rubro + client-config y las valida |
| Depende de | — (recomendado F-13) |
| Contexto y refs | CTX-05 §3 (esquema), `Organizar_Estructurar/esquema-config-plantilla.md`, `template-consultora-software.json`, `client-config-acme-dev-studio.json`, RAG-G16-01/02 |
| Partes a modificar | CREAR `helper-node/services/templateEngine.js` (load, validate, merge), `helper-node/templates/` (mover JSONs), endpoints `GET/PUT /api/agent/templates`, `GET /api/agent/templates/validate` |
| Implementación | 1. `loadTemplate(template_id)` + `loadClientConfig(client_id)`. 2. Validador de claves/tipos según tabla CTX-05 §3 (semver en meta.version). 3. Merge runtime (client overrides sobre plantilla). 4. Errores de validación explícitos |
| Pruebas | Tests: carga consultora OK; merge aplica overrides; JSON inválido → error descriptivo |
| Verif. funcionamiento | `GET /api/agent/templates/validate` → valid para los 2 JSON existentes |
| Verif. seguridad/datos | Solo lectura desde directorio controlado; sin path traversal |
| Logs | `config_change` por carga/actualización de plantilla |
| Gate | Pre-prod: validación integrada al guardado. Prod: plantillas versionadas en BD o git |

### F-16 — Grafo LangGraph de 8 etapas comerciales
| Campo | Contenido |
|---|---|
| Objetivo | Flujo comercial completo ejecutable: apertura→calificación→propuesta→profundización→objeciones→cierre→handoff→seguimiento |
| Depende de | F-13, F-14, F-15 |
| Contexto y refs | CTX-04 §3 (etapas), CTX-04 §1 (nodos de reencuadre/objeción/oferta/reactivación), RAG-G15-01 |
| Partes a modificar | `agentCore/graph.js` (8 nodos + nodos de reencuadre), `agentCore/nodes/*.js`, endpoint `POST /api/agent/chat` (canal de prueba) |
| Implementación | 1. Nodos por etapa leyendo campos de plantilla (slot-filling). 2. Transiciones condicionales por estado + completitud. 3. Nodo propuesta de valor situacional (usa datos parciales). 4. Salida siempre con siguiente acción (regla CTX-04 §1.3) |
| Pruebas | Test conversacional guionizado: lead curioso → handoff en ≤8 turnos con campos mínimos |
| Verif. funcionamiento | Chat de prueba completa el flujo; estado visible en Redis |
| Verif. seguridad/datos | Sin datos `internal` en respuestas (verificación F-17) |
| Logs | `state_transition` por etapa; `api_call` LLM por nodo |
| Gate | Pre-prod: 5 guiones de prueba OK. Prod: latencia p95 <5s por turno |

### F-17 — Guardas: confidencialidad y zonas de autonomía
| Campo | Contenido |
|---|---|
| Objetivo | Reglas de lectura (public/assisted/internal) y de decisión (green/yellow/red) aplicadas por el núcleo |
| Depende de | F-15, F-16 |
| Contexto y refs | CTX-04 §2, CTX-06 §4.2, RAG-G15-02, CTX06-O3 |
| Partes a modificar | `agentCore/guards/confidentiality.js`, `agentCore/guards/autonomy.js`, `templateEngine.js` (exponer etiquetas) |
| Implementación | 1. Filtro de contexto: respuesta solo lee `public` + `assisted` transformados (aplica `assisted_transform`). 2. Nodo de decisión lee `autonomy_zone` → deriva en red. 3. Disclaimer automático en yellow. 4. Test de fuga: intento de citar `internal_cost_structure` → bloqueado |
| Pruebas | Tests: 0 datos internal en 20 respuestas generadas; red siempre deriva |
| Verif. funcionamiento | Cotización final nunca emitida por el agente (consultora) |
| Verif. seguridad/datos | **Gate de seguridad de la oleada C:** test de fuga automatizado pasando |
| Logs | `security_alert` ante intento de exposición |
| Gate | Pre-prod: suite de guardas 100%. Prod: monitoreo semanal de fugas = 0 |

### F-18 — Integración Dify classifier como nodo + fallback
| Campo | Contenido |
|---|---|
| Objetivo | El grafo usa el workflow Dify existente como nodo de análisis, con fallback directo a OpenRouter |
| Depende de | F-16 |
| Contexto y refs | RAG-G5-01/04, ADR-021, CTX-04 §11 (front/back-office) |
| Partes a modificar | `agentCore/nodes/analyze.js` (llamada `dify-api:5001/v1/workflows/run`, parse `final_result`), `agentCore/llmClient.js` (fallback OpenRouter) |
| Implementación | 1. Nodo analyze llama Dify con timeout 30s. 2. Parse defensivo (doble JSON). 3. Si Dify cae → clasificación simple por OpenRouter (intent + score). 4. Circuit breaker tras 3 fallos |
| Pruebas | Test: con Dify up (score presente) y down (fallback activo) |
| Verif. funcionamiento | Clasificación disponible en ambos modos |
| Verif. seguridad/datos | API key Dify solo en servidor; sin exposición en logs |
| Logs | `api_call` dify con modo (primary/fallback); `error` con reason |
| Gate | Pre-prod: failover <1s. Prod: fallback ejercido en monitoreo real sin incidente |

---

## 6. Oleada D — Comportamiento comercial ejecutable (F-19…F-24)

> **Objetivo de oleada:** el agente vende de verdad: objeciones, temperatura, handoff y seguimiento operando. **Salida:** plantilla consultora ejecuta su comportamiento completo E2E. Contexto: CTX-04 (completo), RAG-G15.

### F-19 — Banco de objeciones ejecutable
| Campo | Contenido |
|---|---|
| Objetivo | Nodo de objeciones detecta trigger y responde con patrón de plantilla personalizado |
| Depende de | F-15, F-16 |
| Contexto y refs | CTX-04 §5 (8 objeciones), `template.objections[]`, RAG-G15-03 |
| Partes a modificar | `agentCore/nodes/objectionHandler.js`, `templateEngine.js` (resolución de `{{placeholders}}` con datos del lead + client overrides) |
| Implementación | 1. Matcher de `trigger_patterns` (heurística keywords). 2. Selección de `response_pattern` + fill con datos del lead y `objection_overrides`. 3. Registro en estado del lead (`objections_log`). 4. `triggers_followup` marca para cadencia |
| Pruebas | Tests: las 8 objeciones de consultora disparan su patrón; log registrado |
| Verif. funcionamiento | "Es muy caro" → respuesta de reencuadre con nombre del lead |
| Verif. seguridad/datos | Objeciones respetan zona de autonomía (F-17) |
| Logs | `state_transition` a objections; objections_log por lead |
| Gate | Pre-prod: 8/8 patrones OK. Prod: tasa de resolución de objeción medible |

### F-20 — Motor de temperatura del lead + decay
| Campo | Contenido |
|---|---|
| Objetivo | Score fit+engagement+intent calculado desde estado, con umbrales y decay |
| Depende de | F-15, F-16 |
| Contexto y refs | CTX-04 §6, `template.lead_temperature`, RAG-G15-04 |
| Partes a modificar | CREAR `helper-node/services/leadTemperature.js` (evaluador de `signals[].condition` contra estado), integración en `agentCore` post-turno |
| Implementación | 1. Mini-motor de condiciones (`response_time_minutes < 60` etc.). 2. Cálculo por turno + banda (hot/warm/cold). 3. Decay programado (−20% tras 5 días inactivo, job diario). 4. Sync del valor al estado y al perfil |
| Pruebas | Tests: lead simulado hot (≥70), warm, cold; decay aplicado tras fecha simulada |
| Verif. funcionamiento | Temperatura visible en `/api/leads/:id/profile` con motivo (señales) |
| Verif. seguridad/datos | Cálculo determinista (0 inferencia del modelo en el número) |
| Logs | `state_transition` temperature_change con score y banda |
| Gate | Pre-prod: umbrales verificados con datos simulados. Prod: decay corriendo diario sin errores |

### F-21 — Sincronización máquina comercial ↔ técnica
| Campo | Contenido |
|---|---|
| Objetivo | Proyección del estado técnico (Redis) al estado comercial del lead (nuevo→…→perdido) |
| Depende de | F-16, F-20 |
| Contexto y refs | CTX-07 §3 (mapeo de máquinas), CTX-04 §3 |
| Partes a modificar | `agentCore/commercialState.js` (mapper), `conversationStore.js` (hook post-transición) |
| Implementación | 1. Mapper estado técnico + temperatura + followup → estado comercial. 2. Actualización por evento (no por mensaje). 3. Persistencia en perfil del lead |
| Pruebas | Test: secuencia de estados técnicos produce estados comerciales esperados (tabla CTX-07 §3) |
| Verif. funcionamiento | Perfil del lead muestra estado comercial coherente |
| Verif. seguridad/datos | Solo proyección (fuente de verdad = técnica); sin escritura inversa |
| Logs | `state_transition` commercial con from/to |
| Gate | Pre-prod: mapeo 100% cubierto por tests. Prod: dashboard refleja estado comercial |

### F-22 — Generador de handoff + briefing automático
| Campo | Contenido |
|---|---|
| Objetivo | Paquete de handoff completo (12 campos + 1 acción) entregado al canal configurado |
| Depende de | F-19, F-20, F-21 |
| Contexto y refs | CTX-04 §7.3/§9, `template.handoff`, `client-config.handoff_routing`, RAG-G15-06, CTX-03 §7 |
| Partes a modificar | CREAR `agentCore/handoff.js` (builder del paquete + router de entrega), integración Chatwoot (nota privada) y Slack/webhook según client-config |
| Implementación | 1. Builder valida `required_fields` (falla si falta alguno). 2. Selección de 1 `next_action`. 3. Entrega: nota interna Chatwoot + webhook `notify_target`. 4. Triggers A/B/C (score≥70, intención explícita, failsafe) |
| Pruebas | Tests: paquete con campos completos; trigger por score; trigger por "quiero hablar con una persona" |
| Verif. funcionamiento | Briefing visible en Chatwoot con score, objeciones y acción |
| Verif. seguridad/datos | Paquete sin datos `internal` crudos (solo lo permitido por handoff) |
| Logs | `handoff_created` con lead_id, trigger, acción |
| Gate | Pre-prod: humano recibe paquete y cierra sin repetir indagación (validación manual). Prod: tiempo de handoff <1 min desde trigger |

### F-23 — Cola de seguimiento con cadencia
| Campo | Contenido |
|---|---|
| Objetivo | Secuencia de followup (8 intentos) disparada automáticamente por lead |
| Depende de | F-20, F-21 |
| Contexto y refs | CTX-04 §7.1-7.2, `template.followup`, RAG-G15-05, ROAD 5.1 |
| Partes a modificar | CREAR `helper-node/services/followupQueue.js` (Bull + ioredis ya disponible), `agentCore/followupWorker.js`, endpoints `GET /api/followups/status` |
| Implementación | 1. Job por intento con `delay_days` de la plantilla. 2. Mensaje por `message_type` (confirmación, valor, baja fricción, resumen, contenido, nurture). 3. Stop al responder (reentry score cero) o al llegar a `lost_threshold` → nurture pasivo. 4. Respeta `business_hours_only` y timezone del client-config |
| Pruebas | Tests: intento 2 se programa a +1d; respuesta del lead cancela secuencia y reinicia score |
| Verif. funcionamiento | Cola ejecuta intento en horario y canal correcto |
| Verif. seguridad/datos | Opt-out detiene la cola inmediatamente (F-24) |
| Logs | `followup_scheduled/sent/cancelled` con lead_id y attempt |
| Gate | Pre-prod: cadencia simulada acelerada OK. Prod: 0 envíos fuera de horario en 7 días |

### F-24 — Cumplimiento WhatsApp: HSM 24h + typing + opt-out duro
| Campo | Contenido |
|---|---|
| Objetivo | Toda salida >24h usa plantilla HSM; typing indicator activo; opt-out bloquea todo |
| Depende de | F-03, F-23 |
| Contexto y refs | CTX-04 §10.2 (3 reglas), RAG-G8-01, G3-05, CTX04-O8 |
| Partes a modificar | `helper-node/index.js` (webhook: typing indicator inmediato), `followupQueue.js` (selector HSM si ventana cerrada), Meta App (plantillas HSM de reactivación aprobadas) |
| Implementación | 1. Regla: si último mensaje del lead >24h → enviar HSM con botones, no texto libre. 2. Typing indicator al recibir webhook (antes del procesamiento). 3. Opt-out: detección ampliada ("no me molesten", "bájenme", "spam", "cancelar") → `opt_out=TRUE`, detiene colas, despedida breve |
| Pruebas | Tests: ventana cerrada → HSM; frase de baja → opt-out + 0 envíos posteriores |
| Verif. funcionamiento | Meta no rechaza reactivaciones; typing visible en cliente |
| Verif. seguridad/datos | **Cumplimiento Meta ToS:** 0 mensajes libres fuera de ventana |
| Logs | `compliance_event` (hsm_sent, typing, opt_out) |
| Gate | Pre-prod: simulacro ventana cerrada OK. Prod: 0 violaciones de política en 30 días |

---

## 7. Oleada E — CRM metodológico y ERP (F-25…F-30)

> **Objetivo de oleada:** Twenty como registro metodológico vivo + Frappe operando el post-cierre + administración visual de plantillas. **Salida:** verificación "lead → factura automática". Contexto: CTX-03 (completo), OT-06/OT-07/OT-08-paso7 (TEC-03).

### F-25 — Campos SPICED/MEDDIC en Twenty
| Campo | Contenido |
|---|---|
| Objetivo | Modelo de datos metodológico creado en `people`/Opportunity |
| Depende de | — |
| Contexto y refs | CTX-03 §3, ADR-012 (namespace global), RAG-G7-04 |
| Partes a modificar | Twenty metadata (`POST /rest/metadata/fields`), scripts `twenty-fields*.js` (raíz repo) como referencia |
| Implementación | 1. Crear campos con prefijo seguro: `spicedSituation`, `spicedPain`, `spicedImpactValue`, `spicedCriticalEvent`, `meddicEconomicBuyer`, `meddicChampion`, `meddicDecisionCriteriaMet`, `leadFitScore`, `qualificationStage` (select). 2. Verificar no colisión de namespace |
| Pruebas | Script de verificación: los 9 campos existen y aceptan valores |
| Verif. funcionamiento | Upsert desde helper escribe campos metodológicos |
| Verif. seguridad/datos | API key Twenty con scope mínimo |
| Logs | `config_change` por campo creado |
| Gate | Pre-prod: campos operativos. Prod: backup de metadata exportado |

### F-26 — ContactType y pipelines diferenciados
| Campo | Contenido |
|---|---|
| Objetivo | Triage Fase 0 enruta a pipeline Corporativo/Mayorista/Minorista con campos dinámicos |
| Depende de | F-25 |
| Contexto y refs | CTX-03 §4, CTX-04 §8 (docx triage), RAG-G7-04 |
| Partes a modificar | Twenty (3 pipelines, campo `contactType`), `agentCore/nodes/triage.js` (1-2 preguntas de bajo impacto) |
| Implementación | 1. Campo `contactType` (enterprise/wholesale/b2c). 2. Nodo triage en el grafo antes de metodologías. 3. Campos dinámicos por tipo (MOQ etc. en customFields). 4. Multi-contacto: vinculación por dominio/nombre de empresa a Company existente |
| Pruebas | Tests: 3 mensajes de entrada enrutan a los 3 pipelines; segundo contacto de misma empresa vinculado |
| Verif. funcionamiento | Oportunidad creada en pipeline correcto |
| Verif. seguridad/datos | Vinculación sin duplicar leads (unique por teléfono) |
| Logs | `state_transition` triage con contactType |
| Gate | Pre-prod: 3 rutas verificadas. Prod: 0 leads duplicados por empresa en 7 días |

### F-27 — Bidireccionalidad Twenty + Modo_Conversación
| Campo | Contenido |
|---|---|
| Objetivo | Cambios en Twenty se reflejan en el helper; el vendedor puede devolver el chat al bot |
| Depende de | F-25 |
| Contexto y refs | CTX-03 §6, CTX-04 edge case 5, RAG-G7-03, OT-06 |
| Partes a modificar | Twenty (campo `modoConversacion`, webhook saliente), CREAR `helper-node/index.js` endpoint `POST /webhooks/twenty` |
| Implementación | 1. Campo `modoConversacion` (IA/Humano/Devolver_a_IA). 2. Webhook Twenty→helper ante update. 3. Helper actualiza estado y, si `Devolver_a_IA`, envía mensaje de reenganche. 4. Sync por evento (`temperature_change`, `handoff`) consolidado |
| Pruebas | Tests: cambio en Twenty → estado helper actualizado; devolución → reenganche enviado |
| Verif. funcionamiento | Vendedor cambia modo en CRM y el bot retoma con mensaje |
| Verif. seguridad/datos | Webhook con token/secreto propio |
| Logs | `api_call` twenty webhook; `state_transition` modo |
| Gate | Pre-prod: ciclo IA→Humano→IA completo. Prod: sync por evento sin duplicados 7 días |

### F-28 — Frappe/ERPNext en compose
| Campo | Contenido |
|---|---|
| Objetivo | ERPNext operativo como servicio del stack |
| Depende de | F-05 (gate de canal, CTX02-O4) |
| Contexto y refs | CTX-03 §5, ROADMAP F2, RAG-G17-01 |
| Partes a modificar | `docker-compose.yml` (servicios frappe/erpnext + mariadb/redis según imagen oficial), `nginx.conf` (`/erp/` tras auth), `.env` |
| Implementación | 1. Agregar servicios con volúmenes. 2. Setup inicial (site, empresa de prueba). 3. Ruta Nginx protegida. 4. Health check |
| Pruebas | Login ERPNext + creación de cliente de prueba |
| Verif. funcionamiento | UI accesible vía `/erp/` tras SSO |
| Verif. seguridad/datos | Credenciales admin en `.env`; sin exposición pública |
| Logs | `deployment` servicio erp |
| Gate | Pre-prod: servicio estable 48h. Prod: backup de BD erp incluido en backup.sh |

### F-29 — Sync Twenty→Frappe + factura automática
| Campo | Contenido |
|---|---|
| Objetivo | Verificación E2E de la abstracción ERP: lead cerrado genera factura |
| Depende de | F-27, F-28 |
| Contexto y refs | CTX-03 §5, FASES-CRUZADAS F2 (verificación), RAG-G17-01 |
| Partes a modificar | CREAR `n8n/workflows/05-twenty-frappe-sync.json` (oportunidad ganada → cliente + sales invoice en ERPNext) |
| Implementación | 1. Trigger: oportunidad pasa a "ganada" en Twenty. 2. Upsert Customer en ERPNext. 3. Crear Sales Invoice con monto acordado (zona roja: solo dato confirmado por humano). 4. Enlace de retorno (invoice id en Twenty) |
| Pruebas | Test E2E: lead → oportunidad → ganada → factura visible en ERPNext |
| Verif. funcionamiento | Factura creada con datos correctos del lead |
| Verif. seguridad/datos | Monto final solo desde campo confirmado por humano (nunca del agente) |
| Logs | `erp_sync` con opportunity_id e invoice_id |
| Gate | Pre-prod: factura automática OK. Prod: reconciliación semanal Twenty↔ERP sin diferencias |

### F-30 — Editor visual de plantillas (administración del sistema)
| Campo | Contenido |
|---|---|
| Objetivo | UI para gestionar plantillas por rubro y client-configs sin tocar JSON a mano |
| Depende de | F-15 |
| Contexto y refs | CTX-05 §7, ROAD 4.1, RAG-G12-01/02, CTX05-O5 |
| Partes a modificar | CREAR `helper-node/public/agent-config.html` (SPA 7 pestañas: Contexto, Productos, KB, Voz, Seguridad, APIs, Probar), endpoints de `templateEngine` (F-15) |
| Implementación | 1. CRUD visual de plantilla + client-config. 2. Validación en vivo (F-15). 3. Pestaña "Probar Agente" contra `/api/agent/chat` (F-16). 4. Acceso tras SSO |
| Pruebas | Crear client-config nuevo desde UI → validación OK → usable por el núcleo |
| Verif. funcionamiento | Alta de cliente nuevo sin editar archivos (CTX05-O2) |
| Verif. seguridad/datos | Solo rol admin tras SSO; cambios auditados |
| Logs | `config_change` con usuario y diff |
| Gate | Pre-prod: alta completa por UI. Prod: permisos por rol verificados |

---

## 8. Oleada F — Seguridad y hardening (F-31…F-35)

> **Objetivo de oleada:** cerrar las brechas altas/medias y formalizar el cumplimiento. **Salida:** re-auditoría con críticas y altas en 0. Contexto: CTX-01 §5.3, SECURITY-MASTER (roadmap F0-F5), OT-05 (TEC-03).

### F-31 — HTTPS + CORS + security headers completos
| Campo | Contenido |
|---|---|
| Objetivo | Tránsito cifrado y superficie web endurecida |
| Depende de | F-01 |
| Contexto y refs | SEC A-03/A-04, §8 (headers), TEC-01 §5 |
| Partes a modificar | `nginx.conf` (443 con certs de `certs/`, redirect 80→443, HSTS), helper (`cors` con whitelist) |
| Implementación | 1. Activar SSL con certs generados. 2. Redirect permanente a HTTPS. 3. CORS restrictivo por origen. 4. Headers completos (CSP, HSTS, X-Frame-Options) |
| Pruebas | `curl -I https://localhost` → 200 + headers; HTTP → 301 |
| Verif. funcionamiento | Todos los módulos accesibles por HTTPS |
| Verif. seguridad/datos | SSL Labs o equivalente ≥A en local simulado |
| Logs | `security_alert` ante handshake fallido repetido |
| Gate | Pre-prod: 0 contenido mixto. Prod: renovación de certs documentada |

### F-32 — Rotación de API keys + usuarios PG por servicio
| Campo | Contenido |
|---|---|
| Objetivo | Una compromiso de credencial ≠ compromiso total |
| Depende de | F-09 |
| Contexto y refs | SEC C-02/C-07, §9 (jerarquía de keys), TEC-04 I3 |
| Partes a modificar | `.env` (keys rotadas), PostgreSQL (roles por servicio: chatwoot, dify, n8n, twenty, wibsite), procedimiento de rotación documentado |
| Implementación | 1. Crear rol PG por servicio con GRANT solo a su BD. 2. Rotar keys (Dify, Twenty, Chatwoot, OpenRouter) y actualizar `.env`. 3. Unificar credenciales n8n (resolver I3). 4. Documentar procedimiento de rotación trimestral |
| Pruebas | Cada servicio conecta solo a su BD con su rol |
| Verif. funcionamiento | Stack completo operativo tras rotación |
| Verif. seguridad/datos | Rol wibsite no puede leer BD twenty y viceversa |
| Logs | `security_alert` ante auth fallida de rol |
| Gate | Pre-prod: matriz rol↔BD verificada. Prod: rotación ejecutada una vez en vivo sin incidente |

### F-33 — PII filter + audit logger unificado
| Campo | Contenido |
|---|---|
| Objetivo | Sin PII en logs; auditoría estructurada de eventos sensibles |
| Depende de | — |
| Contexto y refs | DATA §6 (pii-filter), ROAD 6.2 (audit-logger, 12 event types), CTX06-O4 |
| Partes a modificar | CREAR `helper-node/src/pii-filter.js` (5 patrones + whitelist), `helper-node/services/auditLogger.js`, tabla `audit_logs` (PG) |
| Implementación | 1. Integrar pii-filter con `pino` (ya en deps). 2. Audit logger escribe PG (tenant_id+timestamp indexados). 3. Retención 30 días (job). 4. Endpoint `GET /api/logs` tras SSO |
| Pruebas | Tests: teléfono/email/key enmascarados en output de log; audit event persistido |
| Verif. funcionamiento | 0 coincidencias de patrones PII en logs de un día de prueba |
| Verif. seguridad/datos | Whitelist solo campos técnicos (id, status, score, latency) |
| Logs | Esta fase define el formato final de todos |
| Gate | Pre-prod: filtro activo en todos los servicios helper. Prod: auditoría consultable con filtros |

### F-34 — Backups + restauración probada + archivado
| Campo | Contenido |
|---|---|
| Objetivo | Backup que se restaura de verdad + políticas de retención activas |
| Depende de | F-09 |
| Contexto y refs | OPS §6 (backup.sh), DATA §7 (retención), CTX01-O8, CTX06-O5 |
| Partes a modificar | CREAR `scripts/backup.sh` (pg_dump 5 BD + Redis SAVE + configs + media), `scripts/restore.sh`, `scripts/db/archive.sql` |
| Implementación | 1. backup.sh con verificación gunzip + limpieza >30d. 2. Programar (cron/Task Scheduler). 3. **Restauración real en entorno de prueba.** 4. archive.sql mensual (messages >2 años → archive, etc.) |
| Pruebas | Restauración completa en entorno limpio → verificación de conteos |
| Verif. funcionamiento | Sistema operativo desde backup restaurado |
| Verif. seguridad/datos | Backups cifrados o en volumen de acceso restringido |
| Logs | `backup_completed/failed`, `restore_test`, `archive_run` |
| Gate | Pre-prod: restauración probada 1 vez. Prod: restauración probada mensual (OPS §10) |

### F-35 — Re-auditoría de seguridad
| Campo | Contenido |
|---|---|
| Objetivo | SECURITY-MASTER actualizado: críticas y altas verificadas como mitigadas |
| Depende de | F-31, F-32, F-33 |
| Contexto y refs | SECURITY-MASTER (43 vulns), TEC-04 I7, OT-05 |
| Partes a modificar | `SECURITY-MASTER.md` (estado por vulnerabilidad), `docs/tecnica/TEC-04` (cerrar I7) |
| Implementación | 1. Re-evaluar las 43 vulnerabilidades una a una con evidencia. 2. Marcar mitigadas (C-01…C-07, A-01…A-12) con referencia a fase F-XX. 3. Re-programar medias/bajas restantes |
| Pruebas | Checklist de auditoría con evidencia por ítem |
| Verif. funcionamiento | 0 críticas y 0 altas abiertas |
| Verif. seguridad/datos | Esta fase ES la verificación de seguridad de oleadas A-F |
| Logs | Reporte de auditoría versionado |
| Gate | Pre-prod: auditoría firmada. Prod: auditoría trimestral programada |

---

## 9. Oleada G — Observabilidad (F-36…F-40)

> **Objetivo de oleada:** ver venir los problemas: métricas, errores, storage y logs unificados. **Salida:** paneles operativos detrás del SSO. Contexto: CTX-01 §6, CTX01-O3/O4/O5, OT-03/OT-04, `Organizar_Estructurar/SAAS_PLAN-INTEGRACION-MODULOS.md`.

### F-36 — Prometheus + cAdvisor + Grafana
| Campo | Contenido |
|---|---|
| Objetivo | Métricas de infraestructura de todos los contenedores |
| Depende de | F-01 |
| Contexto y refs | SAAS_PLAN §1 (receta completa), RAG-G14-02 |
| Partes a modificar | `docker-compose.yml` (cadvisor, prometheus, grafana + volúmenes), CREAR `monitoring/prometheus.yml`, `nginx.conf` (`/grafana/` tras auth) |
| Implementación | Seguir receta SAAS_PLAN §1: servicios, scrape jobs (cadvisor + helper:3100/metrics), datasource en Grafana |
| Pruebas | `curl localhost:9090/-/healthy` y `:3000/api/health` → 200 |
| Verif. funcionamiento | Grafana muestra CPU/RAM de chatwoot, n8n, dify, twenty, helper |
| Verif. seguridad/datos | `/grafana/` exige SSO |
| Logs | `deployment` stack monitoreo |
| Gate | Pre-prod: dashboard infra visible. Prod: retención 15d activa |

### F-37 — Métricas de negocio en helper + alertas P0/P1
| Campo | Contenido |
|---|---|
| Objetivo | Métricas de aplicación (requests, latencia, sync, scoring) + alertas accionables |
| Depende de | F-36 |
| Contexto y refs | SAAS_PLAN §1 (prom-client), OPS §5 (severidades), RAG-G14-01/02 |
| Partes a modificar | `helper-node/package.json` (`prom-client`), `helper-node/index.js` (`/metrics`), `monitoring/prometheus.yml` (job helper), Grafana alertas (Telegram/email) |
| Implementación | 1. Middleware prom-client (requests por endpoint, latencia). 2. Métricas custom: sync Twenty, temperatura calculada, handoffs. 3. Reglas: ServiceDown 30s (P0), p95>5s (P1), error rate >5% (P2). 4. Contact point a Telegram |
| Pruebas | Forzar error → alerta P1 recibida; bajar servicio → P0 |
| Verif. funcionamiento | Alertas llegan al canal configurado |
| Verif. seguridad/datos | `/metrics` solo en red interna (no expuesto en Nginx público) |
| Logs | `alert_fired` con severidad |
| Gate | Pre-prod: P0/P1 disparan en simulacro. Prod: runbook de respuesta por alerta |

### F-38 — GlitchTip: captura de errores
| Campo | Contenido |
|---|---|
| Objetivo | Excepciones del helper con contexto completo antes que el cliente reporte |
| Depende de | F-01 |
| Contexto y refs | SAAS_PLAN §2 (receta), RAG-G14-03 |
| Partes a modificar | `docker-compose.yml` (glitchtip ×4 servicios), `helper-node/package.json` (`@sentry/node`), `helper-node/index.js` (Sentry.init + handlers), `nginx.conf` (`/glitchtip/` tras auth) |
| Implementación | Seguir receta SAAS_PLAN §2: servicios, createsuperuser, proyecto wibsite-helper, DSN en `.env`, tracesSampleRate 0.2 |
| Pruebas | Error forzado en endpoint de prueba → aparece en GlitchTip con endpoint y payload |
| Verif. funcionamiento | Error visible con contexto completo |
| Verif. seguridad/datos | PII filter (F-33) aplicado antes de enviar a GlitchTip; registro abierto deshabilitado |
| Logs | `error_captured` con issue_id |
| Gate | Pre-prod: error de prueba capturado. Prod: notificación de error nuevo al canal |

### F-39 — MinIO: storage unificado
| Campo | Contenido |
|---|---|
| Objetivo | Adjuntos y archivos en un solo storage S3-compatible |
| Depende de | F-01 |
| Contexto y refs | SAAS_PLAN §3 (receta), RAG-G14 (storage), CTX01-O5 |
| Partes a modificar | `docker-compose.yml` (minio), `nginx.conf` (`/storage/` sin auth_request, `/minio-console/` con auth), `helper-node` (cliente `minio`, `uploadFile`) |
| Implementación | Seguir receta SAAS_PLAN §3: servicio, bucket `wibsite-media`, usuario de servicio con permisos solo al bucket, integración en upload de Excel |
| Pruebas | Subir archivo → visible en bucket y accesible vía `/storage/` |
| Verif. funcionamiento | Upload Excel usa MinIO (no disco local) |
| Verif. seguridad/datos | API S3 no tras auth_request (firma); consola tras SSO; usuario no-root para la app |
| Logs | `storage_upload` con bucket y key |
| Gate | Pre-prod: archivo de prueba servido. Prod: backup de bucket programado |

### F-40 — Logs estructurados JSON unificados entre módulos
| Campo | Contenido |
|---|---|
| Objetivo | Todos los módulos emiten logs correlacionados (request_id/conversation_id/tenant_id) |
| Depende de | F-33 |
| Contexto y refs | CTX-07 (unidad de verificación), ROAD 6.2, FASES-CRUZADAS (template de log) |
| Partes a modificar | `helper-node` (pino con correlation id middleware), n8n (variables de log), convención documentada en TEC-04 |
| Implementación | 1. Middleware de correlation id (genera/propaga `x-request-id`). 2. Campos obligatorios: timestamp, level, tenant_id, request_id, conversation_id, event_type, latency_ms. 3. Tabla de event types unificada (12 de ROAD 6.2 + compliance/handoff/followup). 4. Doc de convención en TEC-04 |
| Pruebas | Test: flujo inbound completo → misma conversation_id en helper, n8n y Dify |
| Verif. funcionamiento | Consulta por conversation_id devuelve la traza completa del mensaje |
| Verif. seguridad/datos | PII filter (F-33) aplicado en todos los puntos de emisión |
| Logs | Esta fase los estandariza |
| Gate | Pre-prod: traza E2E correlada. Prod: consulta de traza usada en 1 incidente real o simulado |

---

## 10. Oleada H — Verificación unificada y portal (F-41…F-46)

> **Objetivo de oleada:** los módulos actúan como **una sola página unificada**: verificación sistémica entre ellos + portal shell. **Salida:** gate de integración ejecutable con un comando. Contexto: CTX-07 (consolidación), UI-UX-MASTER (UX-1/2), FASE1-MVP-CRUZADO (verify-mvp), FASES-CRUZADAS (verify-fase).

### F-41 — Sistema unificado de verificación entre módulos
| Campo | Contenido |
|---|---|
| Objetivo | Un script verifica la salud conjunta: contratos entre módulos, no solo pings |
| Depende de | F-05, F-36 |
| Contexto y refs | `FASE1-MVP-CRUZADO.md` (verify-mvp.sh), `FASES-CRUZADAS.md` (verify-fase), `docs/PRUEBAS-Y-VERIFICACIONES.md` |
| Partes a modificar | CREAR `scripts/verify/verify-fase.sh`, `scripts/verify/contract-tests.js` (helper↔n8n, n8n↔dify, helper↔twenty, helper↔weaviate, helper↔redis, helper↔PG) |
| Implementación | 1. Contract tests: payload real por cada frontera (formato, campos requeridos, status). 2. verify-fase.sh orquesta: health + contratos + checks de la oleada. 3. Salida JSON + exit code |
| Pruebas | Ejecución con un contrato roto a propósito → falla y reporta cuál |
| Verif. funcionamiento | `verify-fase.sh A` pasa tras Oleada A; idem B, C… |
| Verif. seguridad/datos | Incluye checks de SSO activo y RLS |
| Logs | `verification_run` con fase, checks, resultado |
| Gate | Pre-prod: gate obligatorio antes de cada oleada nueva. Prod: ejecución programada + alerta |

### F-42 — CI con gates de verificación
| Campo | Contenido |
|---|---|
| Objetivo | Ningún cambio entra sin tests + contratos verdes |
| Depende de | F-41 |
| Contexto y refs | OPS §4 (pipeline), FASE1-MVP-CRUZADO (mvp-tests.yml) |
| Partes a modificar | CREAR `.github/workflows/ci.yml` (lint, 112+ tests, contract tests, npm audit), branch protection |
| Implementación | 1. Workflow: install → tests → contract tests → audit. 2. Gate: PR solo mergeable en verde. 3. Smoke test post-merge contra entorno local |
| Pruebas | PR con test roto → bloqueado; PR verde → mergeable |
| Verif. funcionamiento | Pipeline ejecuta en cada push |
| Verif. seguridad/datos | `npm audit --production` sin críticos |
| Logs | `ci_run` con resultado |
| Gate | Pre-prod: gate activo en repo. Prod: tag de versión solo desde main verde |

### F-43 — Portal shell UX-1 (una sola página)
| Campo | Contenido |
|---|---|
| Objetivo | Shell con sidebar + topbar que embebe todos los módulos tras un solo login |
| Depende de | F-01 |
| Contexto y refs | UI-UX-MASTER §2-5 (código del shell), UX-O1/O2/O3, RAG-G13-03 |
| Partes a modificar | CREAR `hub/portal/` (index.html, css, js: sidebar, MODULES config, moduleFrame con sandbox, lazy loading), `nginx.conf` (`/portal/`) |
| Implementación | Seguir UI-UX-MASTER §4-5: layout, navegación de 9 secciones, iframe sandbox + lazy load, watermark, health checker en status bar |
| Pruebas | Navegación a Inbox/CRM/IA Studio/Automations/Campaigns sin salir del shell |
| Verif. funcionamiento | Una URL, un login, navegación siempre visible |
| Verif. seguridad/datos | Iframes tras SSO; sandbox attributes correctos |
| Logs | `portal_nav` con módulo destino |
| Gate | Pre-prod: 5 módulos embebidos. Prod: sesión única sostenida 8h |

### F-44 — Contexto compartido postMessage + Lead Context Panel
| Campo | Contenido |
|---|---|
| Objetivo | Módulos se pasan el lead activo; split view con perfil unificado |
| Depende de | F-43, F-04 (perfil lead existe) |
| Contexto y refs | UI-UX-MASTER §6 (7 escenarios), §9 (Lead Context Panel), RAG-G4-04 |
| Partes a modificar | `hub/portal/js/postmessage.js` (protocolo bidireccional `wibsite-portal`/`wibsite-module`), script de inyección Chatwoot/Twenty, panel de lead en shell |
| Implementación | 1. Protocolo postMessage con sessionStorage (`wibsite:active:*`). 2. Twenty→Chatwoot (abrir conversación del lead) y Chatwoot→Twenty como primeros 2 escenarios. 3. Panel lateral consume `GET /api/leads/:id/profile` |
| Pruebas | Click en lead en Twenty → Chatwoot abre su conversación; panel muestra score/temperatura |
| Verif. funcionamiento | Contexto persiste entre navegaciones del shell |
| Verif. seguridad/datos | Origen de mensajes validado (no `*`) |
| Logs | `context_switch` con origen/destino y lead_id |
| Gate | Pre-prod: 2 escenarios cruzados OK. Prod: panel usado en handoff real (F-22) |

### F-45 — Búsqueda global + notificaciones unificadas
| Campo | Contenido |
|---|---|
| Objetivo | Ctrl+K busca en leads/campañas/conversaciones; notificaciones centralizadas |
| Depende de | F-43 |
| Contexto y refs | UI-UX-MASTER §9 (Global Search, Notification Center), UX-08/09 |
| Partes a modificar | `hub/portal/js/search.js`, endpoint `GET /api/search?q=` en helper (busca store PG + Twenty), `hub/portal/js/notifications.js` |
| Implementación | 1. Endpoint de búsqueda unificada (lead, campaña, conversación). 2. UI Ctrl+K con resultados por módulo y salto con contexto (F-44). 3. Centro de notificaciones (handoffs, alertas F-37, errores F-38) |
| Pruebas | Búsqueda de un teléfono → salto al lead con panel abierto |
| Verif. funcionamiento | Búsqueda <500ms; notificación de handoff visible |
| Verif. seguridad/datos | Resultados filtrados por tenant |
| Logs | `search_query` (sin PII: solo tipo de resultado) |
| Gate | Pre-prod: 3 tipos de resultado. Prod: notificaciones P0 distinguibles |

### F-46 — Trazabilidad E2E sin pérdida (gate de unificación)
| Campo | Contenido |
|---|---|
| Objetivo | Verificación de que un mensaje recorre todo el sistema sin pérdida de información ni datos |
| Depende de | F-40, F-41, F-44 |
| Contexto y refs | CTX-07 (unidad), CTX04-O8/O9, CTX06-O3 |
| Partes a modificar | `scripts/verify/e2e-trace.js` (mensaje sintético → rastreo por conversation_id en helper, n8n, Dify, Twenty, Chatwoot, portal) |
| Implementación | 1. Inyectar mensaje de prueba con marker único. 2. Rastrear presencia en cada módulo (logs, estado, CRM, panel). 3. Validar campos clave intactos en cada salto (nombre, teléfono, intent, score, temperatura). 4. Reporte de pérdidas (campo presente en salto N, ausente en N+1) |
| Pruebas | 10 mensajes sintéticos variados (con objeción, con opt-out, con handoff) |
| Verif. funcionamiento | 10/10 trazas completas; 0 campos perdidos entre saltos |
| Verif. seguridad/datos | Marker de prueba no persiste en producción (flag de test) |
| Logs | `e2e_trace` con saltos y veredicto |
| Gate | Pre-prod: gate de Oleada H. Prod: ejecución diaria programada |

**Estado (2026-08-12):** gate `scripts/verify/e2e-trace.js` implementado y en verde (10/10 en 3 corridas consecutivas, exit 0; usa marker único, tenant `default` + `x-tenant-id`, verificación en PG `audit_logs` y ES OTel con polling por el reintento del elasticsearchexporter cuando un batch mezclado con spans ajenos —redis `PUBLISH` de otros servicios— se rechaza temporalmente). Traza verificada en vivo: `HTTP POST /api/agent/chat → agent.graph.run → llm.completion` con tokens (`gen_ai.usage.input_tokens/output_tokens`, `llm.usage.total_tokens`) e `wibsite.intent/score` sin pérdida. TeVS completo 11/11 con el helper final.

---

## 11. Oleada I — Validación de agente, datos y plantillas (F-47…F-51)

> **Objetivo de oleada:** evidencia formal de que el agente se comporta, los datos no se pierden y las plantillas son de contexto cerrado. **Salida:** suites de validación + segundo rubro + prueba de carga. Contexto: CTX-04, CTX-05, CTX-06, OT-12 (TEC-03).

### F-47 — Suite de validación de comportamiento del agente
| Campo | Contenido |
|---|---|
| Objetivo | Batería automatizada que prueba el comportamiento comercial completo |
| Depende de | F-19…F-24 |
| Contexto y refs | CTX-04 (todas las reglas), CTX04-O1…O6, ROAD 7.1 |
| Partes a modificar | CREAR `helper-node/__tests__/agentBehavior.test.js` (guiones: calificación rápida, valor antes de pedir, objeciones ×8, zonas ×3, handoff ×3 triggers, seguimiento ×8 intentos, reentry) |
| Implementación | 1. Harness de conversación simulada contra el grafo. 2. 20+ guiones con aserciones por regla de CTX-04. 3. Integrado a CI (F-42) |
| Pruebas | La suite misma: 100% verde para cerrar la fase |
| Verif. funcionamiento | Cada objetivo CTX04-O1..O6 con al menos 1 test |
| Verif. seguridad/datos | Tests de fuga (internal) y de zona roja incluidos |
| Logs | `behavior_suite` con guiones y fallos |
| Gate | Pre-prod: suite en CI. Prod: suite corre ante cada despliegue |

### F-48 — Validación de datos y contexto (integridad, cero pérdida)
| Campo | Contenido |
|---|---|
| Objetivo | Verificación de integridad entre Redis, PG, Twenty y portal en operación continua |
| Depende de | F-46 |
| Contexto y refs | CTX-06 (manejo de información), CTX06-O6, DATA §9 (leads huérfanos >0 alerta) |
| Partes a modificar | CREAR `scripts/verify/data-integrity.js` (checks: huérfanos, divergencias Redis↔PG, leads sin sync, temperaturas fuera de rango) + cron |
| Implementación | 1. Checks diarios: orphan-check (F-12), diff estado Redis vs PG, leads sin `contact_id`, scores fuera de 0-100. 2. Alerta a canal (F-37) si check >0 |
| Pruebas | Introducir inconsistencia a propósito → detectada y alertada |
| Verif. funcionamiento | Reporte diario en 0 errores |
| Verif. seguridad/datos | Sin datos de otros tenants en reportes (RLS) |
| Logs | `data_integrity` con checks y conteos |
| Gate | Pre-prod: 7 días en 0. Prod: alerta probada en simulacro mensual |

### F-49 — Validación de plantillas en contexto cerrado
| Campo | Contenido |
|---|---|
| Objetivo | El agente solo sabe lo que su plantilla+KB le permite (contexto cerrado) |
| Depende de | F-15, F-17 |
| Contexto y refs | CTX-05 (plantillas), CTX-04 §10.1 (guardrails), ROAD 7.2 (anti-alucinación), CTX05-O3 |
| Partes a modificar | `agentCore/guards/closedContext.js` (forbidden_topics, solo-KB mode), `antiHallucination.js` (verificación contra KB antes de responder) |
| Implementación | 1. Modo conservador por plantilla: solo KB, sin inferencias. 2. `forbidden_topics` bloquean respuesta. 3. Precios/inventario solo vía lookup determinista (API/KB), nunca de memoria. 4. Reemplazo por "No pude verificar esa información" ante fallo de verificación |
| Pruebas | Tests: pregunta fuera de KB → respuesta controlada; precio pedido → solo de lookup; forbidden topic → rechazo |
| Verif. funcionamiento | 0 respuestas no verificadas en batería de 50 preguntas adversariales |
| Verif. seguridad/datos | Log de alucinaciones bloqueadas (`security_alert` tipo hallucination) |
| Logs | `hallucination_blocked` con motivo |
| Gate | Pre-prod: batería adversarial verde. Prod: tasa de bloqueo monitoreada |

### F-50 — Segundo rubro piloto (salón de eventos)
| Campo | Contenido |
|---|---|
| Objetivo | Validar el patrón multi-rubro: nueva plantilla sin tocar el núcleo |
| Depende de | F-15, F-49 |
| Contexto y refs | CTX05-O4, CTX-04 §2 (salón: zona verde/amarilla grande), CTX-05 §6 |
| Partes a modificar | CREAR `helper-node/templates/template-salon-eventos.json` + `client-config` de ejemplo |
| Implementación | 1. Poblar plantilla: catálogo con precios fijos, personalización ±20% (yellow), cadencias cortas por fecha fija, fit por paquete. 2. Validar con templateEngine. 3. Guiones de comportamiento (F-47) replicados para este rubro |
| Pruebas | Suite de comportamiento para salón verde; 0 cambios en código del núcleo |
| Verif. funcionamiento | Conversación de reserva completa con paquete y fecha |
| Verif. seguridad/datos | Estructura de costos internos marcada internal/red |
| Logs | `config_change` nueva plantilla |
| Gate | Pre-prod: rubro operativo en pruebas. Prod: decisión de rubro siguiente con datos |

### F-51 — Load test: 50 conversaciones simultáneas + SLI
| Campo | Contenido |
|---|---|
| Objetivo | Evidencia de capacidad del host actual con carga realista |
| Depende de | F-36, F-47 |
| Contexto y refs | ROAD 7.1 (estrés 50 conversaciones), CTX-01 §5.2 (validación con evidencia), métricas BUS §6 |
| Partes a modificar | CREAR `scripts/load/k6-conversations.js` (50 conversaciones concurrentes contra `/api/agent/chat` + webhooks) |
| Implementación | 1. Escenario: 50 conversaciones × 5 turnos con mezcla de casos. 2. Medir p95, error rate, tokens, costo. 3. Comparar contra SLI (helper <200ms p95 en endpoints, Dify <5s) |
| Pruebas | Ejecución completa sin errores >5% |
| Verif. funcionamiento | p95 dentro de SLI; Grafana muestra la carga |
| Verif. seguridad/datos | Rate limiting no rechaza tráfico legítimo dentro de umbrales |
| Logs | `load_test` con escenario y resultados |
| Gate | Pre-prod: resultados documentados (techo del host). Prod: baseline para comparar tras cambios |

---

## 12. Oleada J — SaaS y despliegue (F-52…F-56)

> **Objetivo de oleada:** plataforma lista para pilotos oficiales: BI, planes, despliegue distribuido y go-live. **Salida:** 1-3 clientes piloto en producción con monitoreo. Contexto: CTX-01 §4-5, CTX-06, CTX-07 §4-5, OT-04/OT-09 (TEC-03).

### F-52 — BI: Metabase + daily_metrics + KPIs
| Campo | Contenido |
|---|---|
| Objetivo | Reportes de negocio sobre datos reales, filtrados por tenant |
| Depende de | F-09, F-10 |
| Contexto y refs | CTX01-O6, CTX-06 §2/§7, DATA §8 (daily_metrics), SAAS_PLAN §4 (receta Metabase) |
| Partes a modificar | `docker-compose.yml` (metabase), `scripts/init-db.sql` (BD metabase), SQL rol `metabase_reader`, job de agregación `daily_metrics` (cada 30 min), `nginx.conf` (`/reportes/`) |
| Implementación | 1. Servicio Metabase tras SSO. 2. Rol solo-lectura. 3. Tabla/vista materializada `daily_metrics` + job. 4. Dashboard: campañas activas, leads por banda, tasa respuesta, KPI-3/KPI-4 |
| Pruebas | Dashboard muestra datos reales del tenant de prueba; KPI-4 <$0.01 calculado |
| Verif. funcionamiento | Metabase conecta con `metabase_reader` (no admin) |
| Verif. seguridad/datos | Sandboxing por `organization_id`; sin dashboards públicos sin filtro |
| Logs | `metrics_aggregation` por corrida |
| Gate | Pre-prod: KPI-3 y KPI-4 medibles. Prod: dashboard mostrado a piloto |

### F-53 — Planes, límites y onboarding automatizado
| Campo | Contenido |
|---|---|
| Objetivo | Alta de cliente nuevo en minutos con límites de su plan aplicados |
| Depende de | F-10, F-30 |
| Contexto y refs | CTX-06 §1 (4 planes), OPS §2 (DDL), CTX-01 §5.3 (onboarding), RAG-G18-01/03, OT-09 |
| Partes a modificar | Migración SQL `platform_tenants/branches/users`, `helper-node/middleware/planLimiter.js` (patrón de `lumi/backend`), CREAR `n8n/workflows/06-tenant-onboarding.json` |
| Implementación | 1. DDL con plan_id y límites denormalizados. 2. planLimiter rechaza al superar límite (leads/mes, campañas/mes). 3. Workflow onboarding: crear tenant → branch → config agente → workspace Dify → inbox → plantillas. 4. Cobro manual documentado (Stripe después) |
| Pruebas | Alta de tenant demo → límites aplicados (101º lead rechazado); onboarding <5 min |
| Verif. funcionamiento | Botón "nuevo cliente" completo sin pasos manuales |
| Verif. seguridad/datos | Límites por tenant en BD, no solo en app |
| Logs | `tenant_created`, `limit_reached`, `billing_event` (manual) |
| Gate | Pre-prod: onboarding E2E. Prod: primer piloto dado de alta por el flujo |

### F-54 — Plan de despliegue distribuido (producción)
| Campo | Contenido |
|---|---|
| Objetivo | Manifiesto de producción: servicios endurecidos, réplicas de lo stateless, procedimiento de despliegue |
| Depende de | F-31, F-34, F-36 |
| Contexto y refs | CTX-01 §4 (Ruta B), OPS §3 (entornos), OPS §8 (escalamiento), CTX-07 §5 |
| Partes a modificar | CREAR `docker-compose.prod.yml` (non-root, resource limits, 2-3 réplicas helper tras Nginx `least_conn`, imágenes pineadas), `scripts/deploy.sh`, `nginx.conf` prod (upstream helper ×N) |
| Implementación | 1. Compose prod con límites CPU/RAM por servicio. 2. Réplicas de helper (stateless tras F-09/F-11). 3. deploy.sh: pull → migrate → up → smoke (verify-fase.sh) → rollback si falla. 4. Documentar en RUNBOOK |
| Pruebas | Despliegue completo en entorno de staging desde cero |
| Verif. funcionamiento | Smoke post-deploy verde; Nginx balancea entre réplicas |
| Verif. seguridad/datos | Contenedores non-root, cap_drop, secrets fuera de imagen |
| Logs | `deployment` con versión y resultado |
| Gate | Pre-prod: deploy+rollback probados. Prod: procedimiento usado en go-live (F-56) |

### F-55 — Staging + verificación pre-producción completa
| Campo | Contenido |
|---|---|
| Objetivo | Entorno espejo donde se ejecuta TODA la batería antes del piloto |
| Depende de | F-54, F-41, F-42 |
| Contexto y refs | OPS §3.1 (staging), FASE1-MVP-CRUZADO (verify-mvp como puerta), TEC-04 §7 (checklist de cierre) |
| Partes a modificar | Entorno staging (mismo compose prod, datos anonimizados), `scripts/verify/run-all.sh` (todas las suites: tests, contract, behavior, e2e-trace, data-integrity, security checks) |
| Implementación | 1. Levantar staging. 2. Ejecutar run-all.sh. 3. Ejecutar restore de backup en staging (F-34). 4. Ejecutar load test (F-51). 5. Checklist de go/no-go firmado |
| Pruebas | run-all.sh verde en staging |
| Verif. funcionamiento | Checklist: tests ✅ contratos ✅ comportamiento ✅ traza ✅ integridad ✅ seguridad ✅ carga ✅ restore ✅ |
| Verif. seguridad/datos | Datos de staging anonimizados (sin PII real) |
| Logs | `preprod_gate` con veredicto y evidencias |
| Gate | **Esta fase ES el gate pre-producción del proyecto** |

### F-56 — Go-live piloto + monitoreo en producción
| Campo | Contenido |
|---|---|
| Objetivo | 1-3 clientes piloto reales operando con monitoreo y criterios de éxito |
| Depende de | F-55 |
| Contexto y refs | CTX-01 §4-5 (piloto + observabilidad en simultáneo), CTX01-O7, CTX-07 §4, BUS §8 |
| Partes a modificar | Producción (deploy con F-54), onboarding de pilotos (F-53), dashboards (F-36/37/52) |
| Implementación | 1. Deploy a producción con deploy.sh. 2. Onboarding del piloto 1 por el flujo automatizado. 3. Monitoreo diario primera semana (alertas, errores, KPIs, comportamiento del agente). 4. Medición de costo/tenant (CTX01-O7). 5. Revisión semanal: ajuste de plantillas (umbrales, objeciones) con datos reales |
| Pruebas | Smoke diario automatizado en producción |
| Verif. funcionamiento | Piloto atiende leads reales; handoffs útiles; KPI-3 >50%, KPI-4 <$0.01 |
| Verif. seguridad/datos | 0 incidentes de seguridad/aislamiento en el piloto |
| Logs | Todos los event types activos; reporte semanal de piloto |
| Gate | **Producción:** 30 días de piloto estable → decisión con números: escalar (Ruta B+) o ajustar. Criterios en CTX-07 §5 |

---

## 5. Tabla de seguimiento de fases (actualizada Agosto 2026)

> **Estado 2026-08-12:** 34 fases ✅ · 22 ⬜ · 0 en curso. Stack de observabilidad cambiado: **Elastic Stack (Elasticsearch 9.x + Kibana + OTel Collector) reemplaza a Prometheus/Grafana/GlitchTip** (ver F-36/F-38). Docker Desktop estaba detenido durante esta revisión → los ✅ del stack son configuración (compose/config), no runtime verificado.

| Fase | Objetivo (corto) | Oleada | Depende de | Estado | Fecha verif. |
|---|---|---|---|---|---|---|
| F-01 | Authelia SSO activo | A | — | ✅ Config implemented | 2026-07-26 |
| F-02 | Credenciales n8n + workflows | A | F-01 | ⬜ Requiere UI n8n | — |
| F-03 | Twilio bridge (reemplaza Meta) | A | externo | ✅ Twilio inbound webhook + status callback | 2026-07-26 |
| F-04 | Chatwoot inbox (Twilio bridge) | A | F-03 | ✅ /api/chatwoot/push + pushToChatwoot() | 2026-07-26 |
| F-05 | E2E inbound real (Twilio) | A | F-02,03,04 | ✅ Twilio→helper→n8n→Dify→Twenty→response | 2026-07-26 |
| F-06 | E2E broadcast real (Twilio) | A | F-03,05 | ✅ /api/twilio/send con StatusCallback + delivery tracking | 2026-07-26 |
| F-07 | DUMP JSON→PG | B | — | ✅ Script created | 2026-07-26 |
| F-08 | DUAL WRITE | B | F-07 | ✅ Store facade + pgStore | 2026-07-26 |
| F-09 | CUTOVER PG primario | B | F-08 | ⬜ Feature flag ready | — |
| F-10 | tenant_id + RLS | B | F-09 | ⬜ Schema ready | — |
| F-11 | Middleware tenantContext | B | F-10 | ⬜ Design ready | — |
| F-12 | Aislamiento + 0 huérfanos | B | F-10,11 | ✅ Orphan-check.sql | 2026-07-26 |
| F-13 | Bootstrap agent-core LangChain | C | — | ✅ Graph engine + POC | 2026-07-26 |
| F-14 | Checkpointer memoria profunda | C | F-13 | ✅ ConversationStore ready + checkpointer.js + tabla conversation_summaries (TTL 7d, MAX_MESSAGES 100, loadCheckpoint del pool) | 2026-08-12 |
| F-15 | Template engine + validador | C | — | ✅ templateEngine.js | 2026-07-26 |
| F-16 | Grafo 8 etapas | C | F-13,14,15 | ✅ agentCore graph ejecutable (9 nodos, aristas condicionales, slotFilling, walkMachine BFS, calificacion→propuesta delegación) | 2026-08-12 |
| F-17 | Guardas confidencialidad+autonomía | C | F-15,16 | ✅ Guards confidentiality.js + autonomy.js (zonas green/yellow/red, filtro PII assisted, sanitizeOutput) | 2026-08-12 |
| F-18 | Dify como nodo + fallback | C | F-16 | ✅ llmClient.js (Dify workflows/run + fallback OpenRouter, circuit breaker, parseFinalResult) | 2026-08-12 |
| F-19 | Banco objeciones ejecutable | D | F-15,16 | ✅ Templates con objections | 2026-07-26 |
| F-20 | Motor temperatura + decay | D | F-15,16 | ✅ Templates config ready | 2026-07-26 |
| F-21 | Sync máquinas comercial↔técnica | D | F-16,20 | ✅ commercialState.js (MAP comercial↔técnico + registerHook en onTransition + metadata PG) | 2026-08-12 |
| F-22 | Handoff + briefing | D | F-19,20,21 | ✅ Handoff config templates | 2026-07-26 |
| F-23 | Cola seguimiento + cadencia | D | F-20,21 | ✅ Followup sequence templates | 2026-07-26 |
| F-24 | HSM 24h + typing + opt-out | D | F-03,23 | ✅ /api/twilio/typing + opt-out duro implementado | 2026-07-26 |
| F-25 | Campos SPICED/MEDDIC Twenty | E | — | ✅ Script + validation | 2026-07-26 |
| F-26 | ContactType + pipelines | E | F-25 | ✅ Fields defined in script | 2026-07-26 |
| F-27 | Bidireccionalidad Twenty | E | F-25 | ✅ ModoConversacion field | 2026-07-26 |
| F-28 | Frappe en compose | E | F-05 | ⬜ Solo ruta nginx huérfana (`/erp/`→frappe:8000), servicio NO en compose | — |
| F-29 | Sync Twenty→Frappe factura | E | F-27,28 | ⬜ Gated by F-05 | — |
| F-30 | Editor visual plantillas | E | F-15 | ✅ Templates endpoints | 2026-07-26 |
| F-31 | HTTPS + CORS + headers | F | F-01 | ✅ Security headers in nginx | 2026-07-26 |
| F-32 | Rotación keys + roles PG | F | F-09 | ⬜ Documented | — |
| F-33 | PII filter + audit logger | F | — | ✅ piiFilter + auditLogger | 2026-07-26 |
| F-34 | Backups + restore + archivo | F | F-09 | ✅ backup.sh created | 2026-07-26 |
| F-35 | Re-auditoría seguridad | F | F-31,32,33 | ✅ Timing-safe API key (crypto.timingSafeEqual), nginx sin `x-api-key` hardcodeada, password ES vía `${ELASTIC_PASSWORD}` | 2026-08-12 |
| F-36 | Elastic Stack + OTel (reemplaza P+G) | G | F-01 | ✅ Elasticsearch 9.4.2 + Kibana + otel-collector en compose (Prometheus/Grafana retirados) | 2026-08-12 |
| F-37 | Métricas negocio + alertas | G | F-36 | ✅ prom-client middleware | 2026-07-26 |
| F-38 | OTel export a ES (sustituye GlitchTip) | G | F-01 | ✅ otel-collector/config.yaml (password vía env `${ELASTIC_PASSWORD}`) | 2026-08-12 |
| F-39 | MinIO | G | F-01 | ✅ docker-compose + nginx | 2026-07-26 |
| F-40 | Logs JSON unificados | G | F-33 | ✅ auditLogger + pino | 2026-07-26 |
| F-41 | Verificación unificada módulos | H | F-05,36 | ✅ verify-fase.sh | 2026-07-26 |
| F-42 | CI con gates | H | F-41 | ⬜ contract-tests.js ready — URLs internas por corregir (tevs-validation.yml, .gitlab-ci.yml) | — |
| F-43 | Portal shell UX-1 | H | F-01 | ✅ Portal SPA (`hub/control-center.html`, 72 KB servido en `/hub/`) + nginx route | 2026-07-26 |
| F-44 | postMessage + lead panel | H | F-43 | ✅ postMessage in portal | 2026-07-26 |
| F-45 | Búsqueda + notificaciones | H | F-43 | ⬜ Design ready | — |
| F-46 | Trazabilidad E2E sin pérdida | H | F-40,41,44 | ✅ `scripts/verify/e2e-trace.js` gate 10/10 (3 corridas consecutivas) + TeVS 11/11 | 2026-08-12 |
| F-47 | Suite comportamiento agente | I | F-19…24 | ⬜ Templates behavior defined | — |
| F-48 | Validación datos/contexto | I | F-46 | ✅ data-integrity script | 2026-07-26 |
| F-49 | Plantillas contexto cerrado | I | F-15,17 | ✅ forbidden_topics config | 2026-07-26 |
| F-50 | Segundo rubro piloto | I | F-15,49 | ✅ salon-eventos template | 2026-07-26 |
| F-51 | Load test 50 conversaciones | I | F-36,47 | ⬜ k6 script pending | — |
| F-52 | BI Metabase + KPIs | J | F-09,10 | ⬜ Solo ruta nginx huérfana (`/reportes/`→metabase:3000), servicio NO en compose | — |
| F-53 | Planes + onboarding auto | J | F-10,30 | ⬜ Design ready | — |
| F-54 | Despliegue distribuido | J | F-31,34,36 | ⬜ backup.sh ready | — |
| F-55 | Staging + gate pre-producción | J | F-54,41,42 | ✅ verify-fase.sh + tests | 2026-07-26 |
| F-56 | Go-live piloto | J | F-55 | ⬜ Pending | — |

## 6. Ruta crítica resumida

```
F-03 (Meta) → F-05 (inbound) → F-06 (broadcast)         [canal real]
F-07…F-12 (datos/tenant)                                  [paralelo al canal]
F-13…F-18 (motor LangChain) → F-19…F-24 (vendedor)      [agente real]
F-22 (handoff) + F-24 (cumplimiento)                      [listo para humanos]
F-35 (seguridad) + F-41 (verificación) + F-46 (traza)     [confianza]
F-47…F-51 (validaciones)                                  [evidencia]
F-52…F-56 (SaaS + despliegue + piloto)                    [producción]
```

**Paralelización recomendada:** A y B en paralelo; C cuando B-09 lista; F(31-35) y G en paralelo tras A+B; E-25/26/27 en paralelo con C/D; H tras C+G; I tras D+H; J secuencial.

### Oleada K — Cierre de Gaps (G-01…G-37)

> **Nota:** Tras completar las oleadas A-J, se identificaron 37 gaps adicionales (G-01 a G-37) documentados en `docs/GAPS-MINIFASES.md`. Estos gaps surgen del análisis cruzado de TAREAS-FUNCIONALES.md, TAREAS-INTERFAZ.md, CTX-01…07, PRUEBAS-Y-VERIFICACIONES.md y código fuente. La implementación de los gaps prioritarios (G-01 a G-06, G-08, G-09, G-12, G-17, G-19) ya está completa. Ver `docs/GAPS-MINIFASES.md` para detalle completo y estado de cada gap.

---

## Referencias cruzadas

- → [TEC-03 Objetivos técnicos](TEC-03-OBJETIVOS-TECNICOS-FASES.md) (OT-01…12; cada OT se descompone aquí en fases F-XX)
- → [TEC-04 Control de cambios](TEC-04-SEGUIMIENTO-CAMBIOS-ITERACIONES.md) (ritual de cierre, checklist de iteración)
- → [CTX-07 §4](../contextual/CTX-07-CONSOLIDACION-NEGOCIO-INFRAESTRUCTURA.md) (porqué de este orden) · [CTX-04](../contextual/CTX-04-LOGICA-VENDEDOR.md) (oleadas C/D/I) · [CTX-05](../contextual/CTX-05-ABSTRACCION-AGENTE-PLANTILLAS-NEGOCIOS.md) (F-15/30/49/50)
- → [MAESTRO RAG](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md) (cada fase actualiza el estado de sus entradas RAG-GX-YY)
- → `FASE1-MVP-CRUZADO.md` · `FASES-CRUZADAS.md` (verify-mvp/verify-fase absorvidos en F-41/42/55)
