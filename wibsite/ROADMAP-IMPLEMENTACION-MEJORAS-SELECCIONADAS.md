# ROADMAP DE IMPLEMENTACIÓN — Mejoras Seleccionadas (62)

> **Tipo:** Ruta de implementación + Cruce código ↔ selección ↔ roadmap iterativo | **Fecha:** 27/08/2026
> **Origen:** selección del usuario sobre las 105 recomendaciones de `docs/ANALISIS-CRUZADO-ERP-CRM-2026-08-26.md`
> **Compañero de:** `ROADMAP-ITERATIVO-NUEVAS-FUNCIONALIDADES.md` (5 ideas F1–F5, fases A–H)
> **Validación de código:** helper-node v2.2.0 + frontend Next.js + e2e Playwright (verificado 27/08/2026)
> **Propósito:** instanciar la ruta concreta de implementación y validación de las 62 mejoras seleccionadas, marcando qué ya existe en código (no re-implementar), qué hay que completar y qué se pospone.

---

## ÍNDICE

1. [Resumen ejecutivo y selección](#1-resumen-ejecutivo)
2. [Cruce con el estado del código (por área)](#2-cruce-con-el-código)
3. [Cruce con el roadmap anterior (F1–F5 / A–H)](#3-cruce-con-el-roadmap-anterior)
4. [Ruta de implementación por oleadas](#4-ruta-de-implementación)
5. [Verificaciones y criterios de aceptación](#5-verificaciones)
6. [Objetivos y KPIs](#6-objetivos-y-kpis)
7. [Riesgos y dependencias externas](#7-riesgos)
8. [Registro de iteraciones](#8-registro-de-iteraciones)

---

## 1. Resumen ejecutivo

**Selección del usuario:** 62 de las 105 recomendaciones (se excluyen integraciones I*, y subconjuntos de C/K/L/R/A/D).

| Área | Seleccionadas | Excluidas (referencia) |
|---|---|---|
| Campañas | 12 (C1, C3–C6, C8–C10, C12–C15) | C2 (Meta real), C7 (plantillas por rubro — cubierta por F5), C11 (zonas horarias) |
| Contactos | 12 (K1–K7, K9, K10, K12, K13, K15) | K8, K11, K14 |
| Calificación | 12 (L2–L11, L14, L15) | L1, L12, L13 |
| Respuestas automáticas | 11 (R1, R2, R4–R8, R12–R15) | R3, R9, R10, R11 |
| Agentes de ventas | 10 (A1–A3, A5–A7, A9–A12) | A4, A8, A13–A15 |
| Datos | 5 (D1–D3, D9, D11) | D4–D8, D10, D12–D15 |
| **Total** | **62** | 43 |

**Hallazgos del cruce con código (antes de escribir la ruta):**

- ✅ **4 items ya están implementados** y NO requieren desarrollo nuevo: **R2** (grafo comercial de 8+ etapas, activo en inbound multicanal — `services/agentCore/`, verificado), **R15** (simulador de conversación — `agentCore/testGraph.js` + endpoint `/api/agent/test-graph`), **A9** (recomendación de próximo paso — `nextAction` en perfil y grafo, ya en UI), **K5** (perfil 360° — detalle de lead con notas, entregas, historial de score y mini-chat). Su tarea es **validar y exponer**, no construir.
- 🟡 **~25 items parcialmente implementados** — la pieza existe pero falta completarla (ej. C1: el registro de opt-out y el filtro en broadcast existen, pero el motor de envío de campañas no lo consulta en el loop).
- 🔴 **~33 items no existen** — implementación nueva.
- La selección **encaja con las 5 ideas previas (F1–F5)** y agrega 3 bloques nuevos que el roadmap anterior no cubría: respuestas automáticas (Oleada 4), copiloto del operador (Oleada 5) y auditoría/UX de cierre (Oleada 7).

---

## 2. Cruce con el código

> Leyenda estado: ✅ Implementado · 🟡 Parcial · 🔴 No existe
> Veredicto: **VALIDAR** (ya existe) · **COMPLETAR** (existe pieza) · **IMPLEMENTAR** (nuevo) · **POSPONER** (dependencia externa)

### 2.1 Campañas (12)

| ID | Estado | Evidencia en código | Veredicto |
|---|---|---|---|
| C1 Bloquear envíos a opt-out | 🟡 | Registro opt-out ✅ (`index.js:1020-1049, 2568-2577`), score -100 (`:1085`), filtro en broadcast (`:3016`), check-batch (`:1311`). El motor de envío de campaña NO consulta opt-outs en su loop | **COMPLETAR** (Oleada 3) |
| C3 Segmentos dinámicos como audiencia | 🔴 | `audience` rudimentario en broadcast (`:3013-3024`); campañas solo `audience_filter` estático | **IMPLEMENTAR** (F2/F3, Oleadas 2–3) |
| C4 Reactivación automática | 🔴 | No hay triggers por evento | **IMPLEMENTAR** (Oleada 3) |
| C5 A/B testing de mensajes | 🔴 | No existe | **IMPLEMENTAR** (Oleada 3) |
| C6 Campañas por evento (fecha/aniversario) | 🔴 | Solo `scheduled_at` puntual | **IMPLEMENTAR** (Oleada 3) |
| C8 Rate-limit con backoff/retry | 🟡 | `channel_status` con info de límites (`:981-1014`); sin backoff ni re-intentos | **COMPLETAR** (Oleada 3) |
| C9 Dry-run (simular audiencia/costo) | 🔴 | No existe | **IMPLEMENTAR** (Oleada 3) |
| C10 ROI/atribución | 🟡 | Stats auto-calculados (`:755-768`); sin enlace a ventas | **COMPLETAR** (MVP: atribución por respuestas Oleada 3; ventas = Frappe, pospuesto) |
| C12 Plantillas validadas por canal | 🟡 | `template_name` + 11 plantillas + `max_length` por canal ✅ (`:1782-1896`); sin Meta real | **COMPLETAR** (Oleada 3, sin depender de C2) |
| C13 Colas multi-tenant por plan | 🔴 | Solo diseño (OPS-MASTER) | **POSPONER** (SaaS real) |
| C14 Webhook de eventos de campaña | 🔴 | No existe | **IMPLEMENTAR** (Oleada 7) |
| C15 Auditoría completa (costos, actores) | 🟡 | `logEvent` en acciones de campaña; sin costos por mensaje ni traza completa | **COMPLETAR** (Oleada 7) |

### 2.2 Contactos (12)

| ID | Estado | Evidencia | Veredicto |
|---|---|---|---|
| K1 Deduplicación + merge | 🟡 | Dedup por teléfono solo al importar (`:892-919`); sin merge programado | **IMPLEMENTAR** (Oleada 1) |
| K2 Empresas de primer nivel | 🔴 | Leads sueltos; Twenty `people` solamente | **POSPONER** (requiere I1 — Twenty bidireccional, no seleccionada) |
| K3 Enriquecimiento de datos | 🔴 | No existe | **POSPONER** (opcional, requiere API externa con consentimiento) |
| K4 Tags multi-valor + colores | 🟡 | Solo colores para grupos de chat (`lib/format.ts:92-111`); leads sin tags | **IMPLEMENTAR** (Oleada 2, junto a F2) |
| K5 Perfil 360° en UI | ✅ | `buildLeadProfile` (`:968-975`) + detalle rico en `leads/page.tsx:27-290` (notas, entregas, historial score, chat) | **VALIDAR** (completar con datos Twenty/campañas, Oleada 1) |
| K6 Favoritos + notas rápidas | 🟡 | Notas ✅ (`PATCH :1461-1465`, UI); favoritos ❌ | **COMPLETAR** (Oleada 1) |
| K7 Línea de tiempo por contacto | 🟡 | Score history + notas + chat por separado; sin timeline unificada (mensajes+campañas+etapas) | **COMPLETAR** (Oleada 1) |
| K9 Normalización de teléfonos en base | 🟡 | Solo al sincronizar a Twenty | **COMPLETAR** (Oleada 0) |
| K10 Campos custom desde UI | 🟡 | `custom_fields` JSONB ✅; sin editor en UI | **COMPLETAR** (Oleada 2) |
| K12 Listas manuales (grupos fijos) | 🟡 | Patrón completo en `services/chatGroups.js` pero **sobre conversaciones** | **IMPLEMENTAR** para leads (F2, Oleada 2) |
| K13 Detección de duplicados en vivo | 🔴 | No existe | **IMPLEMENTAR** (Oleada 1) |
| K15 Borrado lógico + GDPR | 🔴 | `DELETE /api/leads/:id` borra físicamente (`:1474-1488`) | **IMPLEMENTAR** (Oleada 7) |

### 2.3 Calificación de leads (12)

| ID | Estado | Evidencia | Veredicto |
|---|---|---|---|
| L2 Recalificación periódica | 🟡 | `evaluate-all` manual ✅ (`:1186`, botón "Score All" en UI); sin job programado | **COMPLETAR** (Oleada 2) |
| L3 Routing automático por score/canal | 🔴 | Solo diseño (CTX-03/04) | **IMPLEMENTAR** (Oleada 5) |
| L4 Workflow lead→oportunidad→deals | 🟡 | Estados comerciales derivados ✅ (`commercialState.js`); pipeline UI ✅; sin conversión a oportunidades en Twenty | **COMPLETAR** (Oleada 1; parte Twenty pospuesta con I1) |
| L5 Score decay por inactividad | 🟡 | Regla `recent_activity` (`:1083-1084`); sin decay continuo | **COMPLETAR** (Oleada 1) |
| L6 Ponderación por rubro | 🟡 | Plantillas por rubro con objeciones/followup ✅ (`templates/*.json`); sin pesos de scoring por plantilla | **COMPLETAR** (Oleada 2) |
| L7 Atribución de fuentes | 🟡 | `lead.source` ✅; sin reporte de mejores fuentes | **COMPLETAR** (Oleada 7) |
| L8 Explicación del score en UI | 🟡 | Historial con categoría ✅ (`leads/page.tsx:208-220`); sin factores desglosados visibles | **COMPLETAR** (Oleada 1) |
| L9 Alerta de lead caliente en tiempo real | 🔴 | No existe | **IMPLEMENTAR** (Oleada 6) |
| L10 SLA de respuesta por categoría | 🔴 | No existe | **IMPLEMENTAR** (Oleada 6) |
| L11 A/B del modelo de scoring | 🟡 | `GET /api/scoring/compare/:leadId` ✅ (`:1209`); sin cohortes | **COMPLETAR** (Oleada 7) |
| L14 Feedback del operador al score | 🔴 | No existe | **IMPLEMENTAR** (Oleada 7) |
| L15 Predicción de conversión % | 🔴 | No existe | **IMPLEMENTAR** (Oleada 7, cuando haya histórico maduro) |

### 2.4 Respuestas automáticas (11)

| ID | Estado | Evidencia | Veredicto |
|---|---|---|---|
| R1 Bienvenida + fuera de horario | 🟡 | Plantilla welcome ✅ + `greeting` en config de agente ✅ (settings UI); fuera de horario ❌ | **COMPLETAR** (Oleada 4) |
| R2 Grafo comercial 8 etapas | ✅ | **Implementado y activo**: 11 nodos + aristas condicionales (`services/agentCore/index.js:76-144`), ejecutado en inbound multicanal (`index.js:2745-2757`), tests (`agentGraph.test.js`) | **VALIDAR** (e2e, Oleada 4 — no desarrollar) |
| R4 Snippets/respuestas rápidas | 🔴 | No existe en el chat | **IMPLEMENTAR** (Oleada 4) |
| R5 Agentes por rol con fallback | 🟡 | `agentRegistry` CRUD ✅ (`:2070-2134`); topología router/extractor/scoring ❌ | **COMPLETAR** (Oleada 4) |
| R6 Handoff inmediato "pido humano" | 🟡 | Nodo `handoffNode` ✅ + estado `escalated` ✅; regla explícita medible ❌ | **COMPLETAR** (Oleada 4) |
| R7 Sync externa de KB (productos/precios) | 🔴 | KB local (Weaviate + documentos); sin sync externa | **IMPLEMENTAR** (Oleada 4) |
| R8 Límite de intentos + escalar canal | 🟡 | `lost_threshold` por plantilla ✅ (`followupNode.js:7`); escalamiento de canal ❌ | **COMPLETAR** (Oleada 4) |
| R12 Autorespuestas a comandos | 🟡 | STOP ✅ (`:2568-2577`); MENU/HORARIOS/PRECIO ❌ | **COMPLETAR** (Oleada 4) |
| R13 Multimedia en respuestas | 🟡 | Pipeline multimodal ✅ (mediaProcessor STT/visión/TTS, `chat/reply` con media/audio `:3534-3594`); catálogo de productos ❌ | **COMPLETAR** (Oleada 4) |
| R14 Registro de opt-in explícito | 🟡 | Opt-out completo ✅; sin registro de consentimiento | **COMPLETAR** (Oleada 4) |
| R15 Simulador de conversación | ✅ | `agentCore/testGraph.js` ✅ + `/api/agent/test-graph` (`:380`) + spec `flow-simulations.spec.js` | **VALIDAR** (exponer en UI settings, Oleada 4) |

### 2.5 Agentes de ventas (10)

| ID | Estado | Evidencia | Veredicto |
|---|---|---|---|
| A1 Copiloto IA en el chat | 🟡 | `/api/llm/chat` ✅ (`:2269`) + perfil de lead; sin panel copiloto embebido en chat | **IMPLEMENTAR** (Oleada 5) |
| A2 Motor de cadencias ejecutable | 🟡 | Secuencia en plantilla ✅ (`followup.sequence`, `templates/*.json:14-25`) y anunciada por nodo `seguimiento`; sin scheduler real | **IMPLEMENTAR** (F4, Oleada 6) |
| A3 Tareas "qué hacer hoy" | 🔴 | No existe | **IMPLEMENTAR** (F4, Oleada 6) |
| A5 Handoff con contexto completo | 🟡 | `handoffNode` ✅ + diseño 12 campos (CTX-04 §7) | **COMPLETAR** (Oleada 5) |
| A6 Asignación round-robin/habilidad/score | 🔴 | No existe | **IMPLEMENTAR** (Oleada 5) |
| A7 Resúmenes post-conversación | 🟡 | `briefing` del grafo ✅ (`agentCore/index.js:265`) + `conversation_summaries` en PG ✅; sin UI | **COMPLETAR** (Oleada 5) |
| A9 Próximo mejor paso | ✅ | `nextAction` en perfil y grafo ✅, visible en UI (`leads/page.tsx:147-154`) | **VALIDAR** (enriquecer con grupos/etapas, Oleada 5) |
| A10 Guiado metodología en el chat | 🟡 | Metodología en plantillas (SPICED/MEDDIC en CTX-04); sin checklist en UI | **COMPLETAR** (Oleada 5) |
| A11 Propuestas/cotizaciones desde el chat | 🟡 | `quoteEngine` + nodo `cotizacion` (mini-cotización) ✅; documentos formales = Frappe ❌ | **COMPLETAR** MVP (Oleada 5); documento formal pospuesto con Frappe |
| A12 Entrenamiento con conversaciones exitosas | 🔴 | No existe | **IMPLEMENTAR** (Oleada 5) |

### 2.6 Datos (5)

| ID | Estado | Evidencia | Veredicto |
|---|---|---|---|
| D1 Migración JSON→PostgreSQL primario | 🟡 | Dual-write ✅ (`storeFacade`, verificado F-08); PG primario ❌ (F-09 pendiente) | **COMPLETAR** (Oleada 0) |
| D2 Índices/PK-FK en tablas | 🟡 | `campaigns-schema.sql` ✅; gaps PK/FK documentados (DATABASE-VALIDATION) | **COMPLETAR** (Oleada 0) |
| D3 Pipelines por tipo de cliente | 🔴 | Un solo pipeline kanban (`pipeline/page.tsx`) | **IMPLEMENTAR** (mínimo: pipeline configurable, Oleada 1) |
| D9 Normalización en ingreso | 🟡 | Sanitizer 23 patrones ✅ (seguridad); sin normalización de dominio (tel/email/mayúsculas) | **COMPLETAR** (Oleada 0) |
| D11 Conversaciones a PG | 🟡 | `conversation_summaries` migradas a PG ✅ (15/08); conversaciones completas siguen en Redis TTL 7d | **COMPLETAR** (Oleada 0 — prerequisito del agrupador F2) |

---

## 3. Cruce con el roadmap anterior

> `ROADMAP-ITERATIVO-NUEVAS-FUNCIONALIDADES.md` (F1–F5, fases A–H). Las oleadas de este documento **absorben y amplían** las fases previas.

| Oleada aquí | Fase anterior | Ideas cubiertas | Mejoras nuevas absorbidas |
|---|---|---|---|
| 0 Cimientos | A | — | D1, D2, D9, D11, K9 |
| 1 Ciclo de vida del lead | B | F1 (etapas) | L4, L5, L8, D3, K1, K5, K6, K7, K13 |
| 2 Grupos y segmentos | C + D | F2 (grupos+agrupador) · F3 (segmentos activos) | K4, K10, K12, L2, L6, C3 |
| 3 Campañas inteligentes | E | F5 (parcial: audiencia por segmento) | C1, C4, C5, C6, C8, C9, C12, C10 |
| 4 Respuestas automáticas | *(nuevo)* | — | R1, R2(val), R4–R8, R12–R15 |
| 5 Copiloto y asignación | *(nuevo)* | — | A1, A5, A6, A7, A9(val), A10, A11, A12, L3 |
| 6 Calendario y seguimiento | F | F4 (calendario) | A2, A3, L9, L10 |
| 7 Cierre: auditoría y UX | *(nuevo)* | — | L7, L11, L14, L15, C14, C15, K15 |
| 8 Consolidación | G + H | F5 (plantillas IA) | Suites e2e + docs |

**Conclusión del cruce:** el roadmap anterior cubría ~40% de la selección. Este documento lo completa: **3 bloques nuevos** (respuestas automáticas, copiloto, cierre UX/auditoría) y **4 validaciones sin código nuevo** (R2, R15, A9, K5). No hay conflicto entre archivos: este instancia la implementación, aquel mantiene la visión por funcionalidad.

---

## 4. Ruta de implementación

### Oleada 0 — Cimientos de datos (D1, D2, D9, D11, K9)

**Objetivo:** preparar la base para que todo lo demás sea confiable.

| Item | Acción | Entregable |
|---|---|---|
| D1 | Cutover PG primario (F-09): lecturas desde PG con flag `STORE_MODE=pg`; mantener dual-write como respaldo transitorio | Migración + flag + conteos pre/post |
| D2 | PK/FK reales e índices en campañas/leads/scores/opt-outs; corregir gaps de DATABASE-VALIDATION | DDL corregido + verificación |
| D9 | Extender sanitizer/normalizador: teléfono E.164, email lowercase, trim, mayúsculas | Middleware + tests |
| K9 | Normalización aplicada en toda escritura de lead (no solo sync Twenty) | Tests de normalización |
| D11 | Archivar `conversations` de Redis a PG (tabla particionada por mes) antes de expirar TTL | Job de archivado + verificación |

**Verificación:** suite Jest + conteos pre/post en seed + smoke `/api/internal/run-smoke` (ya existe).

### Oleada 1 — Ciclo de vida del lead (L4, L5, L8, D3, K1, K5, K6, K7, K13) = F1

**Objetivo:** etapas claras (primer contacto → primer mensaje → interesado → cotización pendiente → posible comprador → comprador) + trazabilidad + perfil completo.

| Item | Acción |
|---|---|
| L4 | Catálogo `lead_stages` + transiciones validadas + historial `lead_stage_history` + migración de `status` legados (el mapeo de sinónimos de `pipeline/page.tsx:19-27` es la base) |
| L5 | Decay automático: job diario baja score a leads inactivos según antigüedad; si cae bajo umbral y cadencia agotada → `descartado` |
| L8 | Factores del score visibles en el detalle (desglose de `score_factors`) |
| D3 | Pipeline configurable por tenant (estructura de columnas en BD; UI lee la config en vez de constantes) |
| K1 | Merge programado: job detecta duplicados (tel+email+nombre) y fusiona con reglas de ganador de campos |
| K5 | Completar perfil 360°: añadir datos de Twenty (vista) y campañas asociadas |
| K6 | Favoritos por lead (campo + filtro + estrella en UI) |
| K7 | Timeline unificada por contacto: mensajes + campañas + cambios de etapa + scores en una línea de tiempo |
| K13 | Al crear/editar lead, sugerir duplicados existentes en vivo |

**Verificación:** tests `leadStages.test.js` (transiciones válidas/inválidas) + e2e kanban (drag&drop válido e inválido) + migración sin pérdidas.

### Oleada 2 — Grupos y segmentos (K4, K10, K12, L2, L6, C3) = F2 + F3

**Objetivo:** grupos manuales con agrupador IA + segmentos dinámicos continuos.

| Item | Acción |
|---|---|
| K12 | `lead_groups` (reutilizar patrón `chatGroups.js` 1:1 pero sobre leads) + vínculo N:M + grupo "Sin agrupar" |
| K4 | Tags multi-valor con colores por lead (complementario a grupos) |
| Agrupador | Job batch: clasifica leads con conversación contra los criterios de los grupos (LLM con fallback heurístico, concurrencia limitada) — requiere D11 (archivado PG) |
| L2 | Job diario de recalificación (reutiliza `evaluate-all` pero programado) |
| L6 | Pesos de scoring por plantilla de rubro (campo nuevo en `templates/*.json`) |
| C3 | Segmentos dinámicos: `kind: dynamic` con reglas evaluables (etapa, score, recencia, replies) |
| K10 | Editor UI de campos custom por tenant |

**Verificación:** batch sobre seed completo (100% con grupo o "sin agrupar"); acierto con feedback de operador; recalificación diaria observable en `audit_logs`.

### Oleada 3 — Campañas inteligentes (C1, C3-audiencia, C4, C5, C6, C8, C9, C10, C12)

**Objetivo:** campañas segmentadas, verificables y sin envíos indebidos.

| Item | Acción |
|---|---|
| C1 | El motor de envío consulta opt-outs antes de cada envío (integrar `check-batch` al loop) |
| C3 | `POST /api/campaigns` acepta `audience: { group_id / segment_id }`; resolver audiencia al programar |
| C4 | Campaña tipo "reactivación": audiencia = leads tibios sin respuesta en N días; activación manual/auto |
| C6 | Triggers por evento de fecha (cumpleaños/aniversario si hay campo; post-compra N días cuando Frappe) — MVP: fecha configurable |
| C5 | A/B: dos variantes de plantilla sobre mitades de la audiencia + métricas por variante |
| C8 | Backoff + re-intentos por canal respetando `rate_limit_reset_at` |
| C9 | Dry-run: previsualizar audiencia resuelta, conteo, costo estimado y confirmación antes de enviar |
| C12 | Validación de plantilla por canal en el form (HSM vs sesión) — sin requerir C2 |
| C10 | Atribución MVP: campaña → replies → etapas avanzadas (ventas reales = Frappe, diferido) |

**Verificación:** e2e: campaña a segmento X llega solo a miembros; envío a opt-out bloqueado (400/skip); dry-run muestra conteo exacto.

### Oleada 4 — Respuestas automáticas (R1, R2, R4, R5, R6, R7, R8, R12, R13, R14, R15)

**Objetivo:** cerrar el ciclo de atención automática con validación de lo ya construido.

| Item | Acción |
|---|---|
| R2 | **Sin código nuevo**: e2e integral del grafo (flujos apertura→cotización→handoff) sobre el inbound multicanal; documentar estado real |
| R15 | Exponer `/api/agent/test-graph` en settings (botón "Probar agente") |
| R1 | Mensaje fuera de horario configurable (en agent config) + plantilla de bienvenida por tenant |
| R4 | Snippets en el chat del operador (biblioteca rápida, CRUD reutilizando templates con categoría `snippet`) |
| R6 | Regla "pide humano → handoff inmediato" configurable y con métrica de cumplimiento |
| R8 | Escalamiento de canal tras `lost_threshold` (WhatsApp→llamada registrada como evento, ver F4) |
| R12 | Comandos MENU/HORARIOS/PRECIO con respuestas configurables |
| R13 | Catálogo simple: imágenes/productos en KB servidas como respuesta multimedia |
| R14 | Registro de opt-in explícito por lead (para campañas) |
| R5 | Router por rol: intención→nodo especializado (reutiliza los nodos existentes del grafo) con fallback |
| R7 | Sync de KB externa: job que trae productos/precios/horarios desde fuente del negocio (contrato flexible; proveedor según cliente) |

**Verificación:** e2e del grafo + tests de comandos + medición de handoff.

### Oleada 5 — Copiloto y asignación (A1, A5, A6, A7, A9, A10, A11, A12, L3)

**Objetivo:** empoderar al operador humano.

| Item | Acción |
|---|---|
| A1 | Panel copiloto en el chat: resumen de conversación + sugerencia de respuesta (usa `/api/llm/chat` + perfil) |
| A7 | UI de resúmenes post-conversación (consumir `briefing` del grafo y `conversation_summaries`) |
| A9 | Enriquecer `nextAction` con contexto de grupos/etapas (ya existe — ampliar) |
| A10 | Checklist SPICED/MEDDIC por etapa en el panel del operador |
| A5 | Handoff con los 12 campos + nota IA al operador (completar `handoffNode` con entrega de contexto) |
| A6 | Asignación de conversaciones nuevas: round-robin / por score (colas por operador) |
| A11 | MVP: mini-cotización ya funciona → permitir enviar el resumen de cotización por el chat (link/texto); documento formal = Frappe (diferido) |
| A12 | Dataset de conversaciones ganadas → inyección como ejemplos al prompt (bajo consentimiento del tenant) |
| L3 | Routing automático: hot → asignación inmediata; warm → cola; cold → nurturing (sobre A6) |

**Verificación:** e2e chat con copiloto; asignación round-robin observable; handoff con contexto completo.

### Oleada 6 — Calendario y seguimiento (A2, A3, L9, L10) = F4

**Objetivo:** la vista por fechas con cards por grupo + seguimientos que no se pierden.

| Item | Acción |
|---|---|
| A2 | Motor de cadencias ejecutable: job que materializa los `followup.sequence` en eventos programados (reemplaza el "anuncio" del nodo seguimiento) |
| A3 | Cola "qué hacer hoy" por operador (eventos con deadline) |
| F4 | Entidad `lead_events` + hooks del grafo (cotización/reunión/cierre → evento automático) + página `/calendar` con vista por fecha y cards por grupo + recordatorios vía `/api/notifications` |
| L9 | Alerta en tiempo real cuando un lead cruza umbral hot (socket/polling → notificación) |
| L10 | SLA por categoría (hot <5min, warm <2h) con alerta por incumplimiento |

**Verificación:** e2e: conversación con cotización → evento en calendario → recordatorio; reporte de SLAs cumplidos.

### Oleada 7 — Cierre: auditoría y UX (L7, L11, L14, L15, C14, C15, K15)

**Objetivo:** medir, mejorar y cumplir.

| Item | Acción |
|---|---|
| L7 | Reporte de fuentes con atribución (canal/campaña → respuestas/etapas avanzadas) |
| L11 | Cohorte A/B reglas vs LLM (sobre el `compare` existente) |
| L14 | Thumbs up/down al score en el detalle del lead → feedback almacenado |
| L15 | Predicción de conversión % simple (histórico de etapas por segmento) |
| C14 | Webhooks salientes de eventos de campaña |
| C15 | Auditoría completa: costos por mensaje, actores, cambios (sobre `audit_logs` existente) |
| K15 | Borrado lógico + retención + right-to-be-forgotten |

**Verificación:** reportes correctos sobre datos históricos; webhook recibido por consumidor de prueba; borrado lógico verificado (datos ocultos, no eliminados).

### Oleada 8 — Consolidación (F5 restante + suites)

**Objetivo:** cerrar el anillo completo y validar todo junto.

- F5 (del roadmap anterior): agente plantillero + selector de plantillas en el form de campaña (aprovecha C12 de Oleada 3).
- Suite e2e integral: inbound → etapa → grupo/segmento → campaña → calendario → reporte.
- Pruebas de carga (k6, patrón existente) + actualización de `TEC-02`, `TEC-06`, `MAESTRO-FUNCIONALIDADES-CORE.md` y `Avances/`.

**Pospuestos (con motivo):** C13 (SaaS real), K2 + parte de L4/C10/A11 (requieren I1/I2 — Twenty/Frappe no seleccionadas), K3 (depende de proveedor externo), L15 parcial (histórico).

---

## 5. Verificaciones

1. **Unitarias (Jest):** `helper-node/__tests__/` — nuevos: `leadStages`, `leadGroups`, `segments`, `leadEvents`, `campaignAudience`, `snippets`, `copilot`. Meta: mantener 176 tests existentes en verde.
2. **E2E (Playwright, `e2e/specs/`):** por oleada (kanban con transiciones, agrupador, campaña segmentada, simulador en settings, calendario, webhooks).
3. **Auditoría:** todo cambio de etapa/asignación/evento con traza en `audit_logs` (módulos: `leadStages`, `leadGroups`, `leadEvents`, `copilot`, `cadence`).
4. **Verificación en vivo:** health + smoke + TeVS después de cada oleada (procedimiento en `Avances/PROCEDIMIENTOS.md`).
5. **Regla de oro del proyecto:** no iniciar la siguiente oleada sin cerrar la actual con todos sus checks.

---

## 6. Objetivos y KPIs

| Oleada | Objetivo | KPI |
|---|---|---|
| 0 | Datos confiables | 0 pérdidas en cutover PG; conversaciones archivadas >99% |
| 1 | Etapas claras | 100% leads con etapa válida y trazable; 0 transiciones inválidas |
| 2 | Segmentación viva | ≥95% leads con conversación agrupados; acierto IA ≥80% |
| 3 | Campañas correctas | 0 envíos a opt-outs; ≥50% campañas con audiencia por segmento; ahorro tokens ≥40% vs personalización por lead |
| 4 | Atención automática | ≥90% handoff pedidos cumplidos; comandos respondidos <1s |
| 5 | Operador potenciado | Tiempo de primera respuesta ↓30%; ≥60% respuestas usan copiloto |
| 6 | Seguimiento sin fugas | ≥90% eventos generados automáticamente; ≥90% cumplidos a tiempo |
| 7 | Cumplimiento y mejora | 100% feedbacks registrados; GDPR verificable |
| 8 | Consolidación | Suite integral verde + docs actualizadas |

---

## 7. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Cutover PG (D1) rompe lecturas | Flag `STORE_MODE` + dual-write intacto + smoke antes/después |
| R2 | TTL Redis 7d pierde contexto del agrupador | D11 (archivado PG) va en Oleada 0, antes del agrupador |
| R3 | "Rango de compras" real requiere Frappe | MVP con señales proxy (score/replies/recencia/etapa); monto diferido |
| R4 | Costo LLM del agrupador y copiloto | Fallback heurístico (ya existe en `classifyIntoGroup`); límites de concurrencia; copiloto bajo demanda |
| R5 | C12/C10/A11 incompletos sin Meta/Twenty/Frappe reales | Avanzar todo lo posible sin credenciales; C2/I1/I2 no bloquean las oleadas |
| R6 | Alcance de 8 oleadas | Ejecución secuencial con regla de oro; cada oleada es un incremento validable independiente |

---

## 8. Registro de iteraciones

| Ciclo | Fecha | Contenido | Estado |
|---|---|---|---|
| 1 | 27/08/2026 | Creación: selección de 62 mejoras, cruce con código (4 ya implementadas, ~25 parciales, ~33 nuevas), cruce con roadmap anterior, ruta en 8 oleadas con verificaciones, KPIs y riesgos | ✅ Base |
| 2 | 27/08/2026 | Carga a GitLab (API REST): 77 issues #17–#93, 10 milestones con fechas, 14 labels nuevas. Incidente de codificación PS 5.1 resuelto con curl.exe + JSON `\uXXXX`. Flujo documentado en `docs/GITLAB-ISSUE-WORKFLOW.md`; herramienta: `scripts/gitlab/gitlab-upsert-issues.ps1` | ✅ Cargado en GitLab |

---

## 9. Referencias

- `ROADMAP-ITERATIVO-NUEVAS-FUNCIONALIDADES.md` — visión por funcionalidad F1–F5.
- `docs/ANALISIS-CRUZADO-ERP-CRM-2026-08-26.md` — investigación base (105 recomendaciones).
- Código: `helper-node/index.js`, `services/chatGroups.js`, `services/agentCore/*`, `services/conversationStore.js`, `frontend/src/app/*`, `e2e/specs/*`.
- `Avances/ESTADO-GENERAL.md`, `docs/tecnica/TEC-02/TEC-06`, `DATA-MASTER.md`.
