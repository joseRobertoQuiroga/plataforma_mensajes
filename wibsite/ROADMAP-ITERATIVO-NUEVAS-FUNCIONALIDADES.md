# ROADMAP ITERATIVO — Nuevas Funcionalidades (Ciclo 1)

> **Tipo:** Roadmap + Planificación + Análisis cruzado código ↔ investigación | **Fecha:** 27/08/2026
> **Base de investigación:** `docs/ANALISIS-CRUZADO-ERP-CRM-2026-08-26.md` (13 ERPs/CRMs, 105 recomendaciones)
> **Validación de código:** helper-node v2.2.0 (`helper-node/index.js` + `services/`), frontend Next.js (`frontend/src/app/*`), `Avances/ESTADO-GENERAL.md`
> **Propósito:** plantear la ruta de desarrollo de las funcionalidades propuestas por el usuario, con desglose de alcance/objetivo/utilidad, análisis cruzado contra el estado REAL del código y planificación por fases con verificaciones y objetivos.
> **Modo de trabajo:** este documento es **iterativo**. En cada ciclo se agrega/refina una funcionalidad, se valida contra el código y se actualiza el registro de iteraciones (§9).

---

## ÍNDICE

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Estado actual del sistema (validado en código)](#2-estado-actual-del-sistema)
3. [Desglose por funcionalidad](#3-desglose-por-funcionalidad)
   - 3.1 F1 — Ciclo de vida de leads con etapas claras (sin score ambiguo)
   - 3.2 F2 — Grupos de contactos manuales + agrupador IA
   - 3.3 F3 — Agrupación activa por agente (segmentos según lógica de negocio)
   - 3.4 F4 — Calendario de seguimientos y eventos
   - 3.5 F5 — Plantillas de campaña recomendadas por IA
4. [Diseño transversal (modelo de datos objetivo)](#4-diseño-transversal)
5. [Roadmap de implementación](#5-roadmap-de-implementación)
6. [Verificaciones y criterios de aceptación](#6-verificaciones-y-criterios-de-aceptación)
7. [Objetivos y KPIs](#7-objetivos-y-kpis)
8. [Riesgos y dependencias](#8-riesgos-y-dependencias)
9. [Registro de iteraciones](#9-registro-de-iteraciones)
10. [Referencias](#10-referencias)

---

## 1. Resumen ejecutivo

El sistema **ya tiene** el 40–60% de la base técnica de las 5 funcionalidades propuestas, pero en capas distintas a las que el usuario necesita:

| # | Funcionalidad propuesta | Estado real hoy | Gap principal |
|---|---|---|---|
| **F1** | Etapas claras del ciclo de vida del lead (primer contacto → … → comprador) en vez del score | 🟡 Pipeline kanban con 5 etapas (`nuevo…cerrado`) + score hot/warm/cold; **sin validación de transiciones ni los términos pedidos** | Catálogo de etapas, transiciones, trazabilidad, renombrado |
| **F2** | Grupos creados por el usuario + agrupador IA que clasifica contactos | 🟡 **Ya existe a nivel de conversaciones** (`chatGroups` con clasificación LLM); **no existe a nivel de leads/contactos** | Extender grupos a leads + agrupador batch + UI |
| **F3** | Grupos fijos definidos por la IA según lógica de negocio (segmentación activa) | 🔴 No existe; hay base: estado comercial derivado + scoring + plantillas por rubro | Segmentos dinámicos + job de re-agrupación + feed a campañas |
| **F4** | Calendario de seguimientos/reuniones/compras con vista por fecha y cards por grupo | 🔴 No existe (ni tareas, ni calendario, ni recordatorios); solo cadencia reactiva del agente | Entidad eventos + motor de programación + UI + hooks del agente |
| **F5** | Plantillas de campaña generadas/recomendadas por IA según lógica del negocio | 🟡 11 plantillas default + CRUD + Dify content-generator; **sin agente recomendador ni conexión al form** | Agente plantillero + integración al flujo de campañas |

**Regla de oro:** reutilizar lo existente (chatGroups, estado comercial, templateEngine, scoring) en lugar de crear módulos paralelos. La F1 es el cimiento: todas las demás dependen directa o indirectamente de tener etapas claras y validadas.

---

## 2. Estado actual del sistema

### 2.1 Arquitectura relevante (validado)

- **helper-node** (Express, `helper-node/index.js`, 3.672 líneas, ~130 rutas): núcleo de integración. Persistencia: **PostgreSQL vía dual-write** + fallback JSON (`wibsite-store.json`) — deuda conocida OT-02.
- **Frontend Next.js** (`frontend/src/app/`): 9 páginas activas — dashboard, chat, campaigns, leads, pipeline, automation, reports, templates, settings.
- **IA:** grafo comercial **implementado y activo en inbound multicanal** (`services/agentCore/`): 11 nodos (apertura, analyze, calificación, propuesta, profundización, objeciones, cierre, handoff, seguimiento, kb, cotización) con aristas condicionales, checkpointer, guards de autonomía/confidencialidad y template por rubro (`templateEngine` con 3 plantillas).
- **Memoria conversacional:** state machine de 9 estados en Redis (TTL 7d) con transiciones validadas (`services/conversationStore.js`).
- **Estados comerciales derivados:** `services/agentCore/commercialState.js` proyecta cada transición de máquina a un estado comercial (`nuevo, calificando, propuesta_enviada, en_objeción, agendado/cerrado, reactivado, derivado_a_humano, perdido, enfriándose`) y lo escribe en el metadata de la conversación.

### 2.2 Validación por dominio (código ↔ investigación)

| Dominio | Lo que existe (código) | Referencia | Lo que NO existe |
|---|---|---|---|
| **Leads** | CRUD completo; `status` libre (string); score 0–100 (8 reglas + LLM); umbrales hot≥70/warm≥40; import CSV/Excel; perfil 360° con notas, entregas, historial de scoring, mini-chat | `index.js:1384-1488` (leads), `:1064-1106` (scoring), `services/leadProfile.js` | Transiciones de etapa validadas; catálogo de etapas; trazabilidad de cambios de etapa |
| **Pipeline UI** | Kanban 5 columnas con drag & drop + menú táctil + FAB crear lead; mapeo de sinónimos de estados viejos (`interesado`→oportunidad, `cotizado`→propuesta, `contactado`→calificado) | `frontend/src/app/pipeline/page.tsx:11-27, 141-161, 197`; `leads/page.tsx:11` | Los términos pedidos (primer contacto, cotización pendiente, posible comprador, comprador) |
| **Score como lenguaje** | Etiquetas "Caliente/Tibio/Frío" en toda la UI; filtros por min_score | `frontend/src/lib/format.ts:28-48`; `leads/page.tsx:390-395` | Relegar el score a métrica de apoyo (no el lenguaje primario) |
| **Grupos** | `chatGroups`: CRUD de grupos (name, description, **criteria**, color), grupo sistema "Pendiente de revisión", asignación manual, clasificación IA por conversación (LLM con fallback heurístico), review masivo con concurrencia | `services/chatGroups.js` (completo, 252 líneas); endpoints `index.js:1706-1772`; UI en `chat/page.tsx:99-107` | Grupos a nivel **leads/contactos**; agrupador sobre historial de leads; grupos como audiencia de campañas |
| **Calendario/tareas** | ❌ Nada. Solo: `scheduled_at` en campañas; cadencia de seguimiento **reactiva** dentro del grafo (secuencia con `delay_days`, umbral de pérdida tras 8 intentos — no programa nada) | `services/agentCore/nodes/followupNode.js` | Entidad eventos/tareas; motor de programación (cron/job); UI calendario; recordatorios |
| **Campañas** | CRUD, ciclo draft→sending→completed, programación, tracking por webhook, stats, export, upload leads, opt-out STOP | `index.js:244-378, 558-887`; UI `campaigns/page.tsx` | Audiencia por grupos/segmentos; A/B testing; triggers por evento; bloqueo automático a opt-outs |
| **Plantillas mensajes** | 11 default (5 canales) + CRUD + preview con `{{variables}}` + categorías (welcome/promotion/followup/…) | `index.js:1782-1945`; UI `templates/page.tsx` | Generación/recomendación por IA; selección de plantilla en el form de campaña; reescritura con IA |
| **IA de contenido** | Dify `campaign-content-generator` (personalización por lead, máx 300 chars) | `dify/workflows/campaign-content-generator.yml` | Personalización por **segmento** (ahorro de tokens); recomendador de plantillas |
| **Agente activo** | Inbound multicanal (Telegram/Messenger/Email/TikTok/WhatsApp) → crea lead → grafo comercial → respuesta por el canal; STT/visión/TTS | `index.js:2657-2824` | Hooks que escriban eventos al calendario; segmentación continua |

### 2.3 Lectura cruzada

- La investigación (ANALISIS-CRUZADO §7) confirma que Wibsite ya supera a los 13 CRMs en lo conversacional (state machine + classifier + doble scoring + RAG). Los gaps que atacan estas 5 funcionalidades son exactamente los estándar de la industria: pipeline por etapas (Pipedrive), listas/segmentos (HubSpot, GoHighLevel), tareas/calendario (HubSpot, Kommo, Bitrix24), plantillas IA (Keap, HubSpot AI writer).
- **F1** = combinación de L4 (workflow lead→oportunidad) + D3 (pipeline por tipo de cliente).
- **F2/F3** = C3 (segmentos dinámicos) + K4 (tags) + K12 (listas estáticas) + L2 (recalificación periódica).
- **F4** = gaps #3 y #4 del análisis (tareas/calendario + cadencias ejecutables) + A2/A3.
- **F5** = C7 (plantillas pre-armadas por rubro) + recomendación IA (HubSpot AI content writer, Keap Proven Templates).

---

## 3. Desglose por funcionalidad

### 3.1 F1 — Ciclo de vida del lead con etapas claras

> **Propuesta del usuario:** reemplazar el lenguaje de score ("caliente/tibio/frío", poco claro para no expertos) por un flujo de etapas con nombres inequívocos.

**Etapas propuestas (términos del usuario → IDs técnicos):**

| Orden | Término usuario | ID técnico | Cuándo se alcanza (criterio base) |
|---|---|---|---|
| 1 | Primer contacto | `primer_contacto` | Lead creado (inbound/manual/import/campaña); aún sin mensaje saliente |
| 2 | Primer mensaje | `primer_mensaje` | Se le envió el primer mensaje (agente o campaña); sin respuesta aún |
| 3 | Interesado | `interesado` | Respondió / mostró interés (intención de compra detectada o reply) |
| 4 | Propuesta / Cotización pendiente | `cotizacion_pendiente` | Se le envió propuesta o mini-cotización y espera decisión |
| 5 | Posible comprador | `posible_comprador` | Señales fuertes de cierre (aceptó cotización, agendó, supera umbral de score + objeciones resueltas) |
| 6 | Comprador | `comprador` | Venta confirmada / compra registrada |
| — | (terminales) | `descartado`, `opt_out` | Sin respuesta tras cadencia agotada / STOP-BAJA |

**Alcance:**
- Catálogo de etapas configurable por tenant (con `id`, `label`, `color`, `orden`, `criterios`), con un set default = los 6 términos de arriba.
- Motor de transiciones validadas (estilo `VALID_TRANSITIONS` de `conversationStore.js:61-71`, pero para leads).
- Migración automática de `status` legados (nuevo, calificado, oportunidad, propuesta, cerrado, opted_out, sent, replied, won…) — el frontend ya hace un mapeo de sinónimos en `pipeline/page.tsx:19-27` que sirve de base.
- Trazabilidad: `lead_stage_history` (lead_id, from, to, motivo, actor: agente/operador/IA, timestamp) con eventos en `audit_logs`.
- UI: pipeline kanban renombrado + selector de etapa en detalle del lead + filtro por etapa (ya existen, solo cambian los términos y se valida el motor).

**Objetivo:** que un operador sin familiaridad con el sistema entienda en 2 segundos en qué punto del proceso está cada contacto, sin interpretar números.

**Utilidades/cualidades:**
- El score pasa a ser **métrica de apoyo** (sigue visible en el detalle y como factor de criterios), no el lenguaje principal.
- Cada etapa se puede conectar a automatizaciones (estado X → acción Y, ver F4/F5).
- Base para F2/F3 (agrupar por etapa) y para reportes por embudo con términos de negocio.

**Estado en código (validado):**
- `status` es un string libre: `POST /api/leads` default `'nuevo'` (`index.js:1405-1434`); `PATCH /api/leads/:id` acepta cualquier `status` sin validar (`index.js:1450-1472`).
- Frontend usa 6 estados (`leads/page.tsx:11`, `pipeline/page.tsx:11-17`) y el backend los persiste tal cual.
- El grafo comercial ya produce un "estado comercial" derivado por conversación (`commercialState.js:4-14`), pero **no se escribe al lead** (queda en metadata de la conversación Redis, TTL 7d).
- ❌ No hay tabla de etapas, ni transiciones, ni historial de cambios de etapa del lead.

**Cruce con la investigación:** L4 (workflow explícito lead→oportunidad→deals), D3 (pipeline por tipo de cliente), L5 (score decay por inactividad → criterio para `descartado`), A9 (recomendación de próximo paso según etapa).

---

### 3.2 F2 — Grupos de contactos manuales + agrupador IA

> **Propuesta del usuario:** el operador crea grupos (ej. "teclados", "pantallas" en una tienda de electrónica) con un criterio descrito en lenguaje natural; al ejecutar el **agrupador**, la IA revisa todos los contactos con conversación y los asigna a los grupos.

**Alcance:**
- CRUD de **grupos de leads** con `name`, `description`, `criteria` (texto libre o reglas), `color` — espejo de `chatGroups` pero sobre la entidad lead.
- Relación `lead ↔ grupos` (N:M: un lead puede estar en varios grupos) + grupo sistema "Sin agrupar".
- **Agrupador IA batch:** job que toma todos los leads (con su historial de conversaciones, score, etapa e interés extraído) y ejecuta clasificación LLM contra los criterios de los grupos definidos — mismo patrón que `reviewPending()` (`chatGroups.js:221-245`) con concurrencia limitada y fallback heurístico (matching por keywords de interés/producto) para no disparar costos.
- UI: página o sección de grupos en `/leads` (listar grupos, ver miembros, asignar/desasignar manualmente, botón "Ejecutar agrupador" con progreso y resumen de asignaciones).
- Resultado auditable: cada asignación guarda `source: manual|ai`, `confidence`, `reasoning` (patrón existente `aiAnalysis` en `chatGroups.js:207-213`).

**Objetivo:** ordenar la base de contactos bajo los conceptos del negocio del usuario (productos, servicios, campañas) con un clic, sin reglas técnicas.

**Diferencia con lo que ya existe:** hoy los grupos existen **solo para conversaciones** (chat inbox). Aquí se agrupan **contactos/leads** de forma estable y explotable (ver F3/E).

**Estado en código (validado):**
- ✅ 100% del patrón ya implementado en `services/chatGroups.js` (grupos con criteria, asignación manual `assignConversation`, clasificación LLM `reviewConversation` con `classifyIntoGroup`, batch `reviewPending`, persistencia JSON + grupo sistema). Reutilizable casi 1:1 cambiando la unidad de agrupación (conversación → lead).
- ❌ No hay vínculo lead↔grupo; no hay UI de grupos en leads; los leads no exponen su grupo en listados/pipeline.
- ⚠️ El contexto para clasificar debe unificar: lead (`store.leads`) + conversaciones asociadas (`GET /api/conversations/:tenant`) + score + `custom_fields.interest`. Las conversaciones viven en Redis con TTL 7d → riesgo de pérdida de contexto (ver §8).

**Cruce con la investigación:** K4 (tags multi-valor), K12 (listas estáticas — HubSpot static lists), C3 (segmentos como fuente de audiencia), K11 (vistas guardadas por equipo).

---

### 3.3 F3 — Agrupación activa por agente (segmentos según lógica de negocio)

> **Propuesta del usuario:** la IA, con el contexto de la lógica del negocio, define 4–5 grupos fijos (ej. por rango de compras, veces consultado, cantidad de compras) y **mantiene** a cada lead clasificado en ellos de forma continua, para que las campañas se segmenten con esa información pre-calculada y se reduzca el costo de personalización (menos llamadas LLM por mensaje).

**Alcance:**
- **Segmentos dinámicos:** grupos cuyo criterio es una **regla evaluable** (no solo texto): `score ≥ X`, `etapa ∈ {…}`, `último contacto > N días`, `replies ≥ N`, `grupo manual ∈ {…}`, y en el futuro `monto comprado/rango` (requiere Frappe, F2 del roadmap maestro).
- **Sugerencia de segmentos por IA:** el agente recibe la lógica del negocio (plantilla de rubro + KB + config) y propone 4–5 segmentos default (ej. "compradores frecuentes", "en proceso de decisión", "fríos sin respuesta", "solo consultaron"), que el operador aprueba/ajusta.
- **Job continuo de re-clasificación:** recalculo periódico (diario o por evento) que mueve leads entre segmentos — equivalente a L2 (recalificación automática).
- **Consumo en campañas:** los segmentos/grupos se exponen como fuente de audiencia (Fase E), con pre-personalización por segmento (un solo contenido generado por segmento + variables por lead) en lugar de 1 llamada LLM por lead.

**Objetivo:** segmentación viva y barata: la personalización deja de ser agéntica por mensaje y pasa a ser por segmento pre-calculado.

**Estado en código (validado):**
- ✅ Existen las piezas: estado comercial derivado (`commercialState.js`), scoring doble, `templateEngine` con lógica de negocio por rubro, intenciones/interés extraídos, `audience_filter` rudimentario en broadcast (`index.js:3005-3058`: solo `phones`, `all`, `channel`, `limit`).
- ❌ No hay tablas de segmentos dinámicos, ni job de recálculo, ni selección de audiencia por grupo/segmento en `POST /api/campaigns` (el form del frontend ni siquiera toca audiencia: `campaigns/page.tsx:28-97`).
- ⚠️ "Rango de compras" real depende de Frappe/ERPNext (fase F2 del roadmap maestro). **Fallback MVP:** usar señales proxy ya disponibles (score, replies, recencia, etapa) y dejar el monto como extensión posterior.

**Cruce con la investigación:** C3 (segmentos dinámicos — GoHighLevel Smart Lists, HubSpot lists), C4 (reactivación automática), L2, L13 (umbrales por tenant), y reduce costo del flujo de personalización LLM (pilar de campañas §3.3 del análisis).

---

### 3.4 F4 — Calendario de seguimientos y eventos

> **Propuesta del usuario:** calendario donde el agente y el operador registran eventos (reuniones, compras, cotizaciones, seguimientos) asociados a fechas; vista por fecha con **cards por grupo** (ej. "teclados — 15 ago: 15 leads" con su estado resumido); reactivo (el agente crea eventos al conversar) y pasivo (el operador agenda, recibe recordatorios y el feedback del agente por cliente).

**Alcance:**
- **Entidad eventos/tareas:** `lead_events` (id, tenant, lead_id, grupo/segmento, tipo: `seguimiento|reunion|cotizacion|compra|recordatorio`, fecha/hora, estado `pendiente|hecho|vencido`, notas, creado_por: `agente|operador|sistema`).
- **Hooks reactivos del agente:** al detectar cotización enviada, reunión agendada, cierre o inicio de cadencia, el grafo escribe un evento automático (punto de integración natural: `executeCommercialGraph` en `agentCore/index.js:150-267` + hook de transiciones `onTransition` ya existente en `conversationStore.js:285-289`).
- **Motor de programación:** job (cron en helper o workflow n8n) que crea las tareas de seguimiento según la cadencia (`followupNode.js` ya define la secuencia con `delay_days` — hoy solo la anuncia, no la programa) y emite recordatorios/notificaciones al operador (`/api/notifications` ya existe como canal de notificaciones).
- **UI Calendario:** vista mensual/semanal + vista de día con **cards agrupadas** (grupo → lista de leads con estado resumido: compró / requiere seguimiento / solo consultó); filtros por grupo, segmento y etapa. Nueva página `/calendar` en el frontend.
- **Feedback al operador:** los resultados del agente por cliente (respuestas, objeciones, estado comercial) se reflejan en las cards del día.

**Objetivo:** visualizar "qué pasó y qué toca hacer" por fecha y por grupo, permitiendo operar el día con tarjetas en lugar de listas planas.

**Estado en código (validado):**
- ❌ Cero entidades de tareas/calendario en backend y frontend (grep completo: ninguna mención a calendar/task/reminder fuera de campañas).
- ✅ Existen los disparadores y el canal de notificación: transiciones de máquina, nodo `seguimiento` con cadencia, `commercialState`, `/api/notifications`, `audit_logs`.
- ✅ `nextAction` ya se calcula por lead (`leadProfile`) y se muestra en el detalle (`leads/page.tsx:147-154`) — es el germen de "qué hacer hoy".

**Cruce con la investigación:** gaps #3 y #4 (tareas/calendario + cadencias ejecutables); A2 (motor de cadencias), A3 (tareas "qué hacer hoy" — Pipedrive Focus View), A8 (agendamiento con IA — Kommo AI booking), I11 (sync Google/Outlook, fase posterior), C6 (campañas por evento). Kommo "auto-create follow-up desde chat" es la referencia directa.

---

### 3.5 F5 — Plantillas de campaña recomendadas por IA

> **Propuesta del usuario:** un agente (distinto del vendedor) hace análisis cruzado del contexto cargado del negocio (lógica, KB, metodologías) y consulta al usuario lo que haga falta, para **recomendar/generar plantillas por defecto** que optimicen consumo y llamadas al agente.

**Alcance:**
- **Agente plantillero:** endpoint `POST /api/templates/generate` que recibe (opcional) brief del usuario y produce N plantillas (`name`, `canal`, `categoría`, `body` con variables, `uso sugerido`) basadas en: template de rubro (`templateEngine`), KB (`/api/knowledge-base/query`), tipos de negocio y campañas históricas. Modo **recomendación** (sugiere a partir de las 11 default + historial) y modo **generación** (crea nuevas).
- **Análisis cruzado:** el agente detecta gaps (ej. "no tienes plantilla de reactivación para email") y los prioriza según KPIs de campaña (replied rate, opt-outs) — conecta con C4/C7 del análisis.
- **Integración al flujo de campaña:** en el form de campaña, selector de plantilla + botón "sugerir/reescribir con IA" + previsualización con variables validadas (ya existe `POST /api/templates/preview`, `index.js:1940`).
- **Ahorro de tokens:** las plantillas recomendadas se combinan con segmentos (F3) para que el contenido se genere 1 vez por segmento.

**Objetivo:** que crear una campaña efectiva no requiera redactar desde cero ni llamar al LLM por cada lead.

**Estado en código (validado):**
- ✅ 11 plantillas default con categorías y variables (`index.js:1782-1896`), CRUD + preview (`:1898-1945`), UI completa (`templates/page.tsx`, 468 líneas), `campaign-content-generator` en Dify.
- ❌ Sin endpoint de generación/recomendación por IA; sin selector de plantilla en el form de campaña (`campaigns/page.tsx:28-97` usa `message_template` libre); sin "reescribir con IA".
- ✅ La infraestructura LLM está lista (`/api/llm/chat`, `llmClient` con fallback, `agentRegistry` con multi-agente esbozado en `services/agentRegistry.js`).

**Cruce con la investigación:** C7 (plantillas pre-armadas por rubro — Keap Proven Templates), HubSpot AI content writer, R9 (mensajes dinámicos por estado), y la optimización de consumo de agente (pilar 8 del análisis).

---

## 4. Diseño transversal

### 4.1 Modelo de datos objetivo (nuevas tablas PostgreSQL)

```
lead_stages            (id, tenant_id, key, label, orden, color, criterios JSONB, is_system)
lead_stage_history     (id, lead_id, from_stage, to_stage, motivo, actor, created_at)
lead_groups            (id, tenant_id, name, description, criteria, kind: manual|dynamic, rules JSONB, color, is_system)
lead_group_members     (lead_id, group_id, source: manual|ai|rule, confidence, reasoning, assigned_at)
lead_events            (id, tenant_id, lead_id, group_id, type, title, scheduled_at, done_at, status, created_by, notes)
```

- `leads.stage` → FK conceptual a `lead_stages` (default `primer_contacto`).
- Regla: los grupos **manuales** (F2) y **dinámicos** (F3) comparten la tabla `lead_groups` (diferencia = columna `kind` + `rules`), tal como la industria (HubSpot: listas estáticas vs activas).
- Los eventos (F4) referencian grupo/segmento para permitir las cards agrupadas por fecha.

### 4.2 Flujos clave

```
Inbound → lead creado (etapa: primer_contacto)
        → agente responde (etapa avanza: primer_mensaje/interesado/…)
        → grafo comercial emite evento al calendario (F4) y actualiza estado comercial
        → job de agrupación clasifica/segmenta (F2/F3)
        → campañas leen grupos/segmentos como audiencia (E) con plantillas IA (F5)
        → seguimientos programados disparan recordatorios al operador (F4)
```

---

## 5. Roadmap de implementación

> Orden de dependencias: **F1 es prerequisito** (etapas alimentan criterios de grupos, eventos y segmentos). Los grupos manuales (F2) preceden a los dinámicos (F3) porque comparten tabla y UI. El calendario (F4) y las plantillas (F5) son consumidores de lo anterior.

| Fase | Nombre | Contenido | Requiere | Entregables | Verificación (resumen) |
|---|---|---|---|---|---|
| **A** | Base de datos de leads | Migración de leads a PG primario (OT-02/D1-D2); DDL de `lead_stages`, `lead_groups`, `lead_group_members`, `lead_events`, `lead_stage_history`; migración de `status` legados | — | Migraciones SQL + script de migración de datos + tests | Dual-write verificado; 0 pérdidas en migración (conteos pre/post) |
| **B (F1)** | Ciclo de vida del lead | Catálogo de etapas default (6 términos) + motor de transiciones + historial + endpoint `PATCH /api/leads/:id` validando etapa + UI (kanban, selector, filtros) renombrada | A | API de etapas + tests de transiciones + UI actualizada | Tests Jest (transiciones válidas/inválidas) + e2e Playwright del kanban |
| **C (F2)** | Grupos manuales + agrupador IA | `lead_groups` CRUD + vínculo lead↔grupo + agrupador batch (LLM con fallback heurístico, reutilizando `chatGroups`) + UI de grupos en `/leads` | A (B recomendado) | API grupos de leads + job agrupador + UI | Batch sobre seed: 100% leads con grupo o "sin agrupar"; feedback de operador guardado |
| **D (F3)** | Segmentos dinámicos + agrupación activa | Reglas evaluables por segmento + sugerencia de 4–5 segmentos por IA según plantilla de negocio + job de recálculo continuo + estado visible en leads | B, C | Motor de reglas + job de segmentación + UI segmentos | Recálculo sobre dataset histórico correcto; costo LLM ≤ presupuesto (solo sugerencias usan LLM) |
| **E** | Segmentación en campañas | Audiencia por grupo/segmento en `POST /api/campaigns` + pre-personalización por segmento (1 generación por segmento) + bloqueo automático a opt-outs (C1) | C, D | API campañas con audiencia por segmento + UI selector de audiencia | Campaña enviada a segmento X llega solo a miembros; medición de ahorro de tokens |
| **F (F4)** | Calendario de seguimientos | `lead_events` + hooks reactivos del agente (cotización/reunión/cierre/cadencia) + motor de programación (cron/n8n) + página `/calendar` con vista por fecha y cards por grupo + recordatorios vía `/api/notifications` | B, C, D | API eventos + job de cadencia ejecutable + página calendario | E2E: conversación de cotización → evento visible en calendario → recordatorio al operador |
| **G (F5)** | Plantillas IA | Agente plantillero (`POST /api/templates/generate` recomendación+generación) + selector de plantilla y reescritura IA en form de campaña + análisis cruzado de gaps de plantillas | E (parcial) | API generador + UI integrada | Plantilla generada cumple max_length por canal y variables válidas (preview OK) |
| **H** | Consolidación | Suite E2E integral (inbound→etapa→grupo→segmento→campaña→calendario), pruebas de carga, auditoría documental, actualización de `TEC-02/TEC-06/MAESTRO` | A–G | Suite e2e + docs actualizadas | Suite verde + regla de oro del proyecto (todo activo y validado) |

**Estimación relativa (esfuerzo):** A: S · B: M · C: M · D: M · E: S-M · F: L (la más grande) · G: M.

---

## 6. Verificaciones y criterios de aceptación

Por fase, siguiendo los patrones ya establecidos en el repo:

1. **Tests unitarios (Jest)** en `helper-node/__tests__/` — nuevos: `leadStages.test.js`, `leadGroups.test.js`, `segments.test.js`, `leadEvents.test.js`, `templateGen.test.js` (patrón existente: 176 tests / 22 suites).
2. **E2E Playwright** en `e2e/` — flujos: kanban por etapas (drag&drop + validación de transición inválida), crear grupo → ejecutar agrupador → ver miembros, crear campaña con audiencia por segmento, ver evento automático en calendario, generar plantilla y usarla en campaña.
3. **Auditoría:** todo cambio de etapa/asignación/evento debe dejar traza en `audit_logs` (módulos nuevos: `leadStages`, `leadGroups`, `leadEvents`, `templateGen`).
4. **Verificación en vivo** (estilo `Avances/PROCEDIMIENTOS.md`): health checks + smoke + TeVS después de cada fase.
5. **Criterio de aceptación global:** el flujo completo se puede operar desde la UI sin tocar API manual, y el costo LLM por campaña segmentada es menor que el actual por-lead.

---

## 7. Objetivos y KPIs

| Funcionalidad | Objetivo | KPI propuesto |
|---|---|---|
| F1 Etapas | 100% de leads con etapa válida y trazable | % de transiciones inválidas = 0; % leads con historial de etapa = 100% |
| F2 Grupos manuales | Toda la base clasificable en 1 clic | Cobertura: ≥95% de leads con conversación asignados por el agrupador; acierto IA ≥80% (validado con feedback del operador) |
| F3 Segmentos | Segmentación viva y barata | Recalculo ≤ 1 h tras cambio de reglas; ahorro ≥40% de tokens en personalización de campañas segmentadas |
| F4 Calendario | Seguimientos sin fugas | ≥90% de eventos generados automáticamente por el agente; ≥90% de seguimientos completados dentro de su fecha |
| F5 Plantillas | Campañas sin redacción manual | ≥50% de campañas nuevas usan plantilla recomendada; <20% de mensajes editados tras generar |
| Transversal | Costo controlado | Costo LLM por lead contactado (campañas) decreciente entre fases E y G |

---

## 8. Riesgos y dependencias

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | **JSON store sigue siendo primario** para leads (deuda OT-02/D1) | Migraciones y jobs frágiles | Fase A primero; dual-write ya verificado como puente |
| R2 | **Contexto de conversación con TTL 7d en Redis** — el agrupador puede perder historial | Clasificación F2/F3 incompleta | Archivar conversaciones a PG (D11) antes/paralelo a C |
| R3 | **"Rango de compras" real requiere Frappe** (ERP, fase F2 del roadmap maestro, diferido) | Segmentos de compra incompletos | MVP con señales proxy (score, replies, recencia, etapa); monto = extensión posterior |
| R4 | **Costo LLM del agrupador batch** si la base crece | Presupuesto de tokens | Clasificación solo para leads con conversación; fallback heurístico (ya existe en `classifyIntoGroup`); límites de concurrencia |
| R5 | **Duplicación de conceptos** (grupos de conversación vs grupos de leads vs segmentos) | Confusión operativa | Tabla única `lead_groups` con `kind`; nomenclatura fija en UI ("Grupos" = manuales, "Segmentos" = dinámicos) |
| R6 | **n8n 02 (broadcast) inactivo** — el envío masivo programado aún no corre solo | Campañas segmentadas no se disparan | Activar workflow 02 (C2 del análisis) dentro de la fase E |
| R7 | **Estados sin conexión entre lead y conversación** (estado comercial queda en Redis) | Etapas F1 desincronizadas del agente | El hook `onTransition` escribe la proyección también al lead (es parte de B) |

---

## 9. Registro de iteraciones

| Ciclo | Fecha | Contenido | Estado |
|---|---|---|---|
| 1 | 27/08/2026 | Creación del documento. Desglose de las 5 funcionalidades propuestas (F1–F5), análisis cruzado contra código e investigación, modelo de datos objetivo, roadmap A–H, verificaciones, KPIs y riesgos | ✅ Documento base |
| 2 | 27/08/2026 | Selección del usuario de 62 recomendaciones → nuevo archivo ejecutivo: `ROADMAP-IMPLEMENTACION-MEJORAS-SELECCIONADAS.md` (ruta en 8 oleadas). Cruce: las oleadas absorben las fases A–H y añaden 3 bloques nuevos (respuestas automáticas, copiloto, cierre UX/auditoría). Hallazgo: R2, R15, A9 y K5 ya implementados en código | ✅ Vinculado |
| 3 | 27/08/2026 | Carga a GitLab: ambos roadmaps convertidos en 77 issues (#17–#93) + 10 milestones + 14 labels, con estándar de 7 secciones por issue. Proceso documentado en `docs/GITLAB-ISSUE-WORKFLOW.md` y script reutilizable `scripts/gitlab/gitlab-upsert-issues.ps1`. Lección: usar curl.exe (no Invoke-RestMethod PS 5.1) para preservar UTF-8 | ✅ Cargado en GitLab |

---

## 10. Referencias

**Código (validado 27/08/2026):**
- `helper-node/index.js` — rutas leads (1384-1488), scoring (920-1380), campañas (244-887), plantillas (1782-1945), grupos chat (1706-1772), broadcast (3005-3058), pipeline multicanal (2657-2824), notificaciones (2992).
- `helper-node/services/chatGroups.js` — patrón reutilizable para F2.
- `helper-node/services/conversationStore.js` — state machine 9 estados + `onTransition` (hook para F4).
- `helper-node/services/agentCore/` — grafo comercial (`index.js`, `graph.js`), `commercialState.js`, `followupNode.js` (cadencia), `llmClient.js` (`classifyIntoGroup`).
- `frontend/src/app/` — leads, pipeline, chat, campaigns, templates, automation, reports, settings.
- `frontend/src/lib/format.ts` — etiquetas de score actuales.

**Documentación:**
- `docs/ANALISIS-CRUZADO-ERP-CRM-2026-08-26.md` — investigación base (recomendaciones C/K/L/A/R/D/I citadas por ID).
- `Avances/ESTADO-GENERAL.md`, `Avances/ROADMAP.md`, `docs/tecnica/TEC-02/TEC-06`, `docs/maestro/MAESTRO-FUNCIONALIDADES-CORE.md`.
- `DATA-MASTER.md` (modelo de datos), `ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md` (memoria/agentes).

---

*Fin del Ciclo 1. Próximo paso sugerido: iterar sobre F1 (validar términos de etapas y criterios de transición) antes de iniciar la Fase A.*
