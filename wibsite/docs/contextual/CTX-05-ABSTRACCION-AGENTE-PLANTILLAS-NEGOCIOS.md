# CTX-05 — Abstracción de la Lógica del Agente: Plantillas para Negocios

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Contextual (QUÉ/POR QUÉ)
> **Fuentes consolidadas:** `Organizar_Estructurar/esquema-config-plantilla.md`, `Organizar_Estructurar/template-consultora-software.json`, `Organizar_Estructurar/client-config-acme-dev-studio.json`, `Organizar_Estructurar/logica-agente-vendedor.md` §5, `BUSINESS-MASTER.md` §4-5 (switcher de contexto), `ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md` (pasos 4.1, 4.2, 5.2), `Documento sin título.docx` (topología de agentes).
> **Ejecución técnica:** RAG-G12, G15, G16 en [`../maestro/MAESTRO-FUNCIONALIDADES-CORE.md`](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md) | Implementado hoy: Agent Config Editor del helper v2.2.0 (RAG-G12-01)

---

## 1. La idea central: 3 capas, un solo núcleo

Todo el comportamiento del agente se separa en **tres capas** para que agregar un rubro nuevo sea *escribir configuración, no código*:

```
┌────────────────────────────────────────────────────────┐
│ CAPA 1 — NÚCLEO (código, genérico)                     │
│ Motor de indagación slot-filling, flujo comercial de   │
│ 8 etapas, máquina de estados del lead, mecanismo de    │
│ confidencialidad, cola de seguimiento, scoring.        │
│ → Vive en helper-node + Dify workflows. NO se toca     │
│   por rubro ni por cliente.                            │
├────────────────────────────────────────────────────────┤
│ CAPA 2 — PLANTILLA POR RUBRO (JSON, uno por industria) │
│ Campos a indagar, banco de objeciones, temperatura,    │
│ cadencia de seguimiento, zonas de autonomía, handoff.  │
│ → template-{rubro}.json  (ej. consultora de software)  │
├────────────────────────────────────────────────────────┤
│ CAPA 3 — CONFIGURACIÓN POR CLIENTE (JSON, pequeño)     │
│ Tarifas, catálogo específico, textos de marca,         │
│ diferenciadores, overrides de seguimiento, routing.    │
│ → client-config-{cliente}.json (ej. Acme Dev Studio)   │
└────────────────────────────────────────────────────────┘
```

**Regla de oro:** un cliente nuevo dentro de un rubro existente **no toca la plantilla** — solo aporta su `client-config.json`, que se combina con la plantilla en tiempo de ejecución. Un rubro nuevo = un archivo de plantilla nuevo, cero cambios en el núcleo.

## 2. Qué vive en cada capa (distribución exacta)

| Contenido | Capa | Ejemplo concreto |
|---|---|---|
| Flujo comercial de 8 etapas (CTX-04 §3) | Núcleo | — |
| Máquina de estados del lead + mecanismo de seguimiento | Núcleo | — |
| Filtrado por confidencialidad (public/assisted/internal) | Núcleo (regla de lectura de estado, no prompt) | — |
| Campos a indagar + su confidencialidad + su zona | Plantilla | `service_type` enum [integracion, modulo_nuevo, …] |
| Banco de objeciones (trigger → respuesta base) | Plantilla | 8 objeciones de consultora (CTX-04 §5) |
| Temperatura: dimensiones, señales, pesos, umbrales, decay | Plantilla | fit 30 / engagement 40 / intent 30 |
| Cadencia de reactivación + umbral de "perdido" | Plantilla | 8 intentos, delays 0/1/3/6/10/20/30/45 días |
| Formato de handoff (campos requeridos, acciones) | Plantilla | 12 campos + 3 próximas acciones |
| Zonas de autonomía (verde/amarilla/roja) | Plantilla | Consultora: verde chica, roja grande |
| Tarifas, rangos preliminares, ticket mínimo, moneda | Cliente | integracion USD 800-3000 |
| Textos de marca, tono, saludo | Cliente | "Soy el asistente de Acme Dev Studio…" |
| Diferenciadores y especialización (placeholders de objeciones) | Cliente | "auditoría técnica gratuita" |
| Overrides de seguimiento (canales, horario, timezone) | Cliente | whatsapp>email, business hours, America/La_Paz |
| Routing del handoff (canal de notificación, workspace CRM, eventos de sync) | Cliente | Slack #leads-acme, sync en `temperature_change`/`handoff` |

## 3. Esquema de configuración de plantilla (lo que lee el núcleo)

Estructura genérica de **todo** archivo `template-*.json` (las claves no cambian entre rubros, solo el contenido):

```
template
├── meta                 → template_id, display_name, version (semver),
│                          deployment_type, crm_connector, erp_connector
├── autonomy_levels      → green/yellow/red: description, requires_human,
│                          requires_disclaimer
├── fields[]             → id, label, type, confidentiality (public/assisted/internal),
│                          autonomy_zone (green/yellow/red), required_before
│                          (quote/handoff/none), stage, assisted_transform
├── objections[]         → id, trigger_patterns[], hidden_reason,
│                          response_pattern (con {{placeholders}}), autonomy_zone,
│                          triggers_followup
├── lead_temperature     → dimensions[] (name, weight_max, signals[] con
│                          points + condition evaluable), thresholds
│                          {hot, warm, cold}, decay {after_days_inactive,
│                          percent_reduction}
├── followup             → sequence[] (attempt_number, delay_days, channel,
│                          message_type), lost_threshold {attempts,
│                          resulting_state, reentry_rule}
└── handoff              → required_fields[], next_action_options[]
```

### Por qué esta forma (decisiones de diseño)
- **`fields[].confidentiality`** implementa el filtrado: el nodo que arma la respuesta al cliente solo lee `public` y la versión transformada de `assisted` — **nunca `internal`**. Es regla de lectura de estado, no instrucción de prompt (más en CTX-06 §4).
- **`fields[].autonomy_zone`** es el punto de flexión (CTX-04 §2): el nodo de decisión **lee** el valor, el modelo no lo infiere.
- **`objections[].response_pattern`** usa placeholders `{{campo}}` rellenados con datos del lead o con overrides del cliente (`objection_overrides` en client-config).
- **`lead_temperature.*.condition`** es pseudo-código evaluable contra el estado (`service_type in offered_services`) — se traduce al motor de reglas real.
- **`handoff.required_fields`** garantiza que el paquete al humano **nunca varía en estructura**, sin importar en qué etapa se derivó.

### Referencia rápida de claves (tipos)
| Clave | Tipo | Notas |
|---|---|---|
| `meta.version` | semver | Versionado de plantilla |
| `autonomy_levels.red.requires_human` | boolean | Siempre `true` en roja |
| `fields[].required_before` | enum `quote`/`handoff`/`none` | Qué acción bloquea si falta el dato |
| `objections[].trigger_patterns` | string[] | Heurística inicial; puede evolucionar a clasificador |
| `signals[].points` | number | Positivo o negativo |
| `thresholds` | object | `hot: 70`, `warm: 40`, `cold: 0` |
| `followup.sequence[]` | array ordenado | 8 intentos en la consultora |
| `lost_threshold.attempts` | number | Tras esto → `nurture_pasivo` |

## 4. Topología de agentes que ejecuta las plantillas

### 4.1 Front-office / Back-office (del docx — ver CTX-04 §11)
1 agente conversacional (cara visible, respuestas breves) + 3 de análisis silenciosos (Router, Extractor, Scoring/Sync). Las plantillas alimentan a los 4: el Router lee `stage` y `autonomy_zone`; el Extractor conoce `fields[]`; el Conversacional recibe directivas + `response_pattern` de objeciones.

### 4.2 Agentes especializados del roadmap (ROAD 5.2)
6 agentes con system prompt, temperatura y config propios: **Qualifier, Sales, Support, Nurturing, Post-Sale, Voice**. Router por `intent_label` + `conversation_state` con fallback a Qualifier. Relación con 4.1: el Back-office madura hacia este router multi-agente; la lógica de vendedor (CTX-04) vive sobre todo en Sales/Qualifier/Nurturing.

### 4.3 Sub-agente adaptador de contexto (ROAD 4.2 + BUS §4)
Componente que traduce la configuración del negocio al comportamiento del agente principal. Output: `{adapted_prompt, relevant_kb_chunks, suggested_response_style, products_to_mention, forbidden_topics, suggested_state}`. Usa modelo barato (GPT-4o-mini) con cache por similitud. Costo: ~1-2s y ~50% más tokens por mensaje.

## 5. Switcher de contexto por tipo de negocio (BUSINESS-MASTER §4-5)

Complemento de las plantillas por rubro: el sistema clasifica el negocio en un **tipo base** que define flujos, state machine y funciones habilitadas:

| Tipo | Flujo característico | Funciones | State machine |
|---|---|---|---|
| `productos_fisicos` | mostrar_producto → precio → stock | CONSULTAR_STOCK, CONSULTAR_PRECIO | `venta_directa` |
| `servicios` | descubrir_necesidad → cotizar | CALCULAR_COTIZACION, AGENDAR_CITA | `consulting` |
| `mixto` | clasificar intención → dual | Sales Agent + Support Agent | `dual` |
| `suscripcion` | (recurrente) | — | `subscription` |
| (pedidos bajo encargo) | — | — | `pedido_personalizado` |

Matriz de 10 industrias mapeadas (electrodomésticos, pastelería, gimnasio, desarrollo software, clínica, tienda ropa, restaurante, jurídicos, ferretería, mixto) con tono y funciones especiales. **Principio BUS:** el usuario solo configura su catálogo — el comportamiento se adapta automáticamente.

### Estado de implementación (puente con lo ya construido)
El **Agent Config Editor del helper v2.2.0** (RAG-G12-01) ya implementa una primera versión de esta idea: `BUSINESS_TYPES` (10 tipos), `PERSONALITY_TYPES` (5), `buildSystemPrompt()` dinámico, endpoints `GET/PUT /api/agent/config`, multi-tenant por header `x-tenant-id`. La evolución pendiente es que ese editor **lea/escriba el esquema de plantilla de §3** (rubros completos con objeciones/temperatura/followup/handoff) en vez de solo tipo+personalidad — ver TEC-03 OT-08.

## 6. Ejemplo completo de referencia (ya poblado)

- **Plantilla:** `template-consultora-software.json` — 9 campos (3 públicos/green de calificación, 2 públicos/green de profundización, 2 assisted/yellow, 2 internal/red), 8 objeciones, temperatura 30/40/30 con 11 señales, 8 intentos de followup, handoff con 12 campos y 3 acciones.
- **Cliente:** `client-config-acme-dev-studio.json` — min_ticket USD 800, 4 rangos preliminares con disclaimers, overrides de 2 objeciones (diferenciador + especialización), prioridad de canal whatsapp>email, handoff a Slack #leads-acme con sync Twenty en `temperature_change`/`handoff`.

**Uso en diseño de nuevos rubros:** replicar el mismo ejercicio para salón de eventos (cadencias más cortas por fecha fija del evento; scoring de fit distinto — paquete cerrado, no presupuesto a definir) — pendiente declarado en la fuente.

## 7. Flujo de alta de un nuevo rubro / cliente (manual de uso)

1. **Nuevo cliente en rubro existente:** crear `client-config-{id}.json` con meta (`client_id`, `template_id`, `template_version`), branding, commercial_params, overrides opcionales. **No toca plantilla ni código.**
2. **Nuevo rubro:** copiar estructura de §3, poblar: fields (con confidentiality + autonomy_zone), 5-8 objeciones típicas, señales de temperatura, cadencia, handoff. Versionar con semver. Validar contra la tabla de claves (§3).
3. **Activación:** el núcleo combina plantilla + client-config en tiempo de ejecución; el editor visual (ROAD 4.1) será la UI para esto (7 pestañas: Contexto, Productos, KB, Voz, Seguridad, APIs, Probar).

## 8. Objetivos y criterios de cumplimiento (seguimiento)

| # | Objetivo contextual | Criterio medible | Estado | Seguimiento |
|---|---|---|---|---|
| CTX05-O1 | Esquema de plantilla estable | Estructura de §3 versionada (1.0.0) y respetada por todos los templates | ✅ Definido + 1 ejemplo | Este doc + JSON |
| CTX05-O2 | Alta de cliente sin tocar código | Un client-config nuevo se activa solo con su JSON | Diseñado | RAG-G16-02 |
| CTX05-O3 | Núcleo único para todos los rubros | 0 ramas de código por rubro en helper/Dify | Parcial (hoy tipo+personalidad) | RAG-G12-01, TEC-03 OT-08 |
| CTX05-O4 | Segundo rubro piloto | Plantilla salón de eventos poblada (cadencias cortas, fit por paquete) | Pendiente | Próxima iteración CTX-04 |
| CTX05-O5 | Editor visual conectado al esquema | ROAD 4.1 edita plantillas completas (no solo tipo/tono) | Pendiente | TEC-03 OT-08 |
| CTX05-O6 | Router multi-agente | 6 agentes con router por intent+state; fallback a Qualifier | Pendiente (ROAD 5.2) | RAG-G5-03 |

---

## Referencias cruzadas

- → [CTX-04 Lógica de vendedor](CTX-04-LOGICA-VENDEDOR.md) (el contenido que las plantillas transportan)
- → [CTX-06 Información del negocio](CTX-06-LOGICA-NEGOCIO-INFORMACION.md) (confidencialidad y ciclo de vida del dato)
- → [CTX-03 CRM/ERP](CTX-03-ABSTRACCION-CRM-TWENTY-FRAPPE-ERPNEXT.md) (`crm_connector`/`erp_connector` en meta)
- → [TEC-02 §G12](../tecnica/TEC-02-FUNCIONES-IMPLEMENTACION.md) (Agent Config Editor implementado)
- → ROAD 4.1, 4.2, 5.2 (`ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md`), BUS §4-5 (`BUSINESS-MASTER.md`)
