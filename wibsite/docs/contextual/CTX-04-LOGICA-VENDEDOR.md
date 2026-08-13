# CTX-04 — Lógica de Vendedor: Documentación Completa del Comportamiento Comercial del Agente

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Contextual (QUÉ/POR QUÉ)
> **Fuentes consolidadas:** `Organizar_Estructurar/logica-agente-vendedor.md`, `Organizar_Estructurar/consultora-software-objeciones-seguimiento.md`, `Organizar_Estructurar/Documento sin título.docx` (metodologías, handoff HITL, triage, edge cases, reglas WhatsApp).
> **Ejecución técnica:** RAG-G15 en [`../maestro/MAESTRO-FUNCIONALIDADES-CORE.md`](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md) | Config ejecutable: [CTX-05](CTX-05-ABSTRACCION-AGENTE-PLANTILLAS-NEGOCIOS.md) | Persistencia: [CTX-03](CTX-03-ABSTRACCION-CRM-TWENTY-FRAPPE-ERPNEXT.md)

---

## 0. Punto de partida

Ya existe el esqueleto técnico: tres capas (núcleo / plantilla por rubro / configuración por cliente — CTX-05), motor de indagación tipo slot-filling, y confidencialidad por etiquetas (público/asistido/interno — CTX-06). Esta capa es la de **comportamiento comercial**: lo que convierte al motor de indagación en un vendedor que **piensa, propone, insiste con criterio y no suelta al lead hasta cerrarlo o descartarlo con causa**.

Piezas: (1) qué es "vendedor activo", (2) punto de flexión/autonomía, (3) flujo comercial core, (4) seguimiento y consolidación, (5) banco de objeciones, (6) temperatura del lead, (7) handoff, (8) metodologías de venta, (9) casos de borde y reglas de infraestructura WhatsApp, (10) topología front/back-office.

## 1. Qué significa "vendedor activo, creativo y proactivo" (diseño, no personalidad)

| Comportamiento | Reactivo | Vendedor |
|---|---|---|
| Ante silencio o duda | Espera | Reencuadra con pregunta o beneficio concreto |
| Ante objeción de precio | Repite el precio | Reformula valor, ofrece alternativa de alcance/paquete |
| Ante datos incompletos | Pide el dato y frena | Pide el dato **y** avanza con hipótesis de propuesta |
| Ante lead que se enfría | No hace nada | Dispara secuencia de reactivación |
| Ante fit dudoso | Deriva sin más | Califica: intenta encajarlo en paquete/alcance antes de descartar |

Esto es **lógica de flujo explícita**: el grafo necesita nodos de *reencuadre*, *manejo de objeciones*, *oferta alternativa* y *reactivación* — no solo "preguntar campo → guardar campo".

### Objetivos de venta del agente (en orden de prioridad)
1. **Calificar rápido:** descartar o confirmar fit en el menor número de turnos posible.
2. **Dar valor percibido antes de pedir:** cada pregunta acompañada de por qué se hace o de un micro-beneficio.
3. **Mover el estado del lead siempre hacia adelante:** nunca terminar un turno en callejón sin salida — siempre hay siguiente acción (dato, opción, cita, derivación).
4. **Maximizar tasa de handoff útil:** el humano recibe lo necesario para cerrar en una llamada, no para repetir la indagación.
5. **No fugar información sensible ni inventar:** restricción dura sobre todo lo anterior (etiquetas de confidencialidad, CTX-06).

## 2. El "punto de flexión": dónde termina la autonomía del agente

Cada plantilla de rubro declara **como configuración** (no inferencia del modelo en el momento) hasta dónde decide el agente solo:

| Zona | Comportamiento | Ejemplos |
|---|---|---|
| 🟢 Verde (autónoma) | Indagar, calificar, rangos de precio calculados, catálogo estándar, agendar, objeciones típicas con respuestas de plantilla | Salón de eventos: casi todo el flujo |
| 🟡 Amarilla (con aviso) | Personalizaciones dentro de márgenes predefinidos (±20% paquete), cotización preliminar marcada "sujeta a confirmación" | Variar paquete, fraccionar alcance |
| 🔴 Roja (deriva sí o sí) | Dato "interno" (costos, márgenes reales), negociación fuera de catálogo, compromiso contractual, clientes alto valor/complejidad | Precio final consultora = siempre humano |

**Implementación conceptual:** `autonomy_level` es un campo más de la plantilla (como la confidencialidad). El nodo de decisión del grafo **lee** el valor — el modelo no lo decide. Ejecutable en `template.autonomy_levels` y `fields[].autonomy_zone` (CTX-05 §3).

Casos calibrados: **Consultora de software** → zona verde chica (indagar, tipo de servicio, urgencia), zona roja grande (todo número final). **Salón de eventos** → zona verde/amarilla grande (catálogo + personalización acotada), zona roja chica.

## 3. Flujo comercial estándar (core reutilizable entre rubros)

El flujo es **genérico**; la plantilla aporta contenidos, no estructura (mismo patrón que el slot-filling):

1. **Apertura / encuadre** — presentación + motivo de contacto en 1-2 preguntas abiertas (no arranca con formulario).
2. **Calificación** — slot-filling dirigido: solo campos obligatorios para saber si hay fit.
3. **Propuesta de valor situacional** — antes de seguir pidiendo: un rango, paquete sugerido o caso similar con lo que ya sabe (aunque sea parcial).
4. **Profundización** — completa campos restantes con el lead ya "enganchado".
5. **Manejo de objeciones** — nodo dedicado con banco de objeciones del rubro (respuestas pre-aprobadas: el agente elige y adapta, no genera libre).
6. **Cierre preliminar o derivación** — según zona de autonomía: agenda, confirma, o arma handoff.
7. **Consolidación (handoff)** — paquete para el humano (§7).
8. **Seguimiento** — disparadores y cadencia (§4).

### Máquina de estados del lead (comercial, corre en el núcleo)
`nuevo → calificando → propuesta_enviada → en_objeción → agendado/cerrado → enfriándose → reactivado → perdido`

> **Mapeo con lo implementado:** el `conversationStore` del helper v2.2.0 ya tiene la state machine técnica de 9 estados (`greeting→discovery→qualification→proposal→objections→closing→post_sale→support→escalated`, RAG-G10-01). La máquina comercial de arriba es la capa de negocio que se monta sobre ella — relación detallada en CTX-07 §4.

## 4. Seguimiento y consolidación de clientes

### Disparadores de seguimiento (genéricos, configurables por rubro)
- Sin respuesta en X horas/días → reactivación **aportando algo nuevo** (disponibilidad, oferta, caso de éxito), no "¿seguís interesado?".
- Propuesta enviada sin respuesta → recordatorio con valor agregado.
- Lead "frío" tras N intentos → secuencia nurture de baja frecuencia (no se descarta, se desprioriza).
- Evento externo relevante (fecha del evento se acerca, nueva necesidad) → reactivación contextual.

El **mecanismo de disparo y cola de seguimiento es del núcleo**; la cadencia y contenidos son de la plantilla (ejecución futura: ROAD 5.1 nurturing en n8n, schedule 6h).

### Consolidación
Cada interacción actualiza **el mismo estado consolidado del lead** (no hilos separados): cuando el humano entra ve una sola línea de tiempo — primer contacto, objeciones surgidas, qué se ofreció, por qué se enfrió o avanzó. Esto es lo que se sincroniza al CRM (CTX-03 §6).

## 5. Banco de objeciones (caso piloto: consultora de software)

Patrón de fondo: **escuchar → indagar más → responder con valor, no con descuento**. Estructura: disparador → qué esconde → respuesta base (el agente personaliza, no improvisa). Regla: cada objeción resuelta queda registrada en el estado del lead (alimenta temperatura §6 y handoff §7).

| # | Objeción | Qué esconde | Respuesta base (patrón) | Zona |
|---|---|---|---|---|
| 1 | "Es muy caro" | No ve el valor todavía | Reencuadrar como inversión: "¿con qué lo estás comparando — con otro presupuesto o con no hacerlo?" | 🟢 |
| 2 | "Tengo que comparar opciones" | Interés real (objeción "buena") | Diferenciador concreto + proponer llamada como lugar de la comparación | 🟢 |
| 3 | "No sé si lo necesito / vale la pena" | Escepticismo sobre valor | Pedir el problema concreto y conectar con caso similar | 🟢 |
| 4 | "Debo consultarlo con mi socio" | Decisión compartida | Agendar con ambas partes o dejar resumen reenviable | 🟢 |
| 5 | "¿Cuánto tarda?" + silencio | Urgencia/prioridad encubierta | Preguntar motivo del plazo (alimenta campo `urgency`) | 🟢 |
| 6 | "¿Por qué ustedes y no otro?" | Confianza/diferenciación | Especialización concreta (tipo de proyectos, stack, casos), no adjetivos | 🟢 |
| 7 | "Mándame la cotización, ya lo vemos" | Objeción silenciosa (evita el vivo) | Enviar resumen + **activar secuencia de seguimiento** (`triggers_followup`) | 🟢 |
| 8 | "Fuera de mi presupuesto ahora" | Restricción real o salida educada | "¿Monto total o forma de pago?" → fraccionar alcance (auditoría primero) | 🟡 |

Versión ejecutable en `template.objections[]` (CTX-05 §3, `template-consultora-software.json`).

## 6. Temperatura del lead: regla calculable, no criterio del modelo

Score numérico sobre 3 dimensiones — el agente **lee campos del estado**, no evalúa "vibra". (Principio hermano del scoring rule-based ya implementado, RAG-G4-01; este es el de negocio conversacional.)

### Fit (máx 30) — ¿tiene sentido perseguirlo?
| Señal | Puntos |
|---|---|
| Tipo de servicio dentro de la oferta | +15 |
| Presupuesto mencionado compatible con ticket mínimo | +10 |
| Contexto técnico ya definido | +5 |

### Engagement (máx 40) — ¿cómo se comporta?
| Señal | Puntos |
|---|---|
| Responde <1h / 1-24h / >24h | +15 / +8 / +2 |
| Completa campos obligatorios sin evasivas | +15 |
| Hace preguntas de seguimiento | +10 |

### Intención (máx 30) — ¿quiere avanzar?
| Señal | Puntos |
|---|---|
| Fecha límite o urgencia concreta | +15 |
| Pregunta precio/forma de pago espontáneamente | +10 |
| Pide agendar sin que se lo propongan | +5 |

### Umbrales y decaimiento
- 🔥 **Caliente (≥70):** handoff inmediato — actuar en los primeros minutos multiplica la conversión.
- 🌤 **Tibio (40-69):** sigue en cadencia activa del agente; no pasa a humano salvo pedido explícito.
- ❄ **Frío (<40):** secuencia de reactivación de baja frecuencia.
- **Decay:** tibio/caliente sin interactuar 5 días → score −20% (la prioridad refleja el momento actual).

Versión ejecutable en `template.lead_temperature` con condiciones evaluables (`response_time_minutes < 60`), no juicios.

## 7. Handoff y seguimiento post-contacto

### 7.1 Cadencia de reactivación (consultora; base B2B: 5-8 intentos, la mayoría abandona tras 1)
| Intento | Cuándo | Canal | Tipo de mensaje |
|---|---|---|---|
| 1 | Inmediato | Mismo de contacto | Confirmación + siguiente paso claro |
| 2 | +1 día | Mismo | Recordatorio con valor agregado (ejemplo de proyecto similar) |
| 3 | +3 días | Mismo | Pregunta de baja fricción (sí/no, 2 opciones) |
| 4 | +6 días | Email si existe | Resumen escrito + oferta de agendar |
| 5 | +10 días | Email/WhatsApp | Contenido de valor (no venta directa) |
| 6-8 | Cada 10-15 días | Alternar | Nurture pasivo |

Tras intento 4 sin respuesta: bajar el ritmo (persistir quema el canal, sobre todo WhatsApp).

### 7.2 Umbral de "lead perdido" → en realidad "nurture pasivo"
| Estado | Condición | Acción del sistema |
|---|---|---|
| Activo | Dentro de intentos 1-4 | Secuencia normal |
| Frío/nurture | Pasó intento 8 sin respuesta, o score <40 sostenido 15+ días | Sale de cadencia activa → contenido mensual máx. |
| Descartado explícito | Dijo que no / sin fit posible | Cierra hilo; solo reabre evento externo |
| Reactivado | Lead en nurture vuelve a interactuar | **Score se reinicia desde cero** con la nueva interacción |

### 7.3 Formato del paquete de handoff (campos mínimos, siempre presentes)
- **Datos duros:** nombre/contacto, tipo de servicio, urgencia, infraestructura previa.
- **Contexto de calificación:** score de temperatura **y motivo** (qué señales lo generaron), objeciones y respuestas dadas, completitud de la indagación.
- **Insumo para cotizar:** rango preliminar ya comunicado (para no contradecirlo), presupuesto/forma de pago mencionado espontáneamente.
- **Próxima acción sugerida:** **una sola** recomendación explícita (`agendar_llamada_esta_semana` / `enviar_propuesta_escrita` / `requiere_descubrimiento_tecnico_antes_de_cotizar`).

Versión ejecutable en `template.handoff.required_fields` + `next_action_options`.

## 8. Metodologías de venta integradas (del docx de investigación)

### 8.1 Mapa de metodologías por escenario
| Escenario | Metodología | Núcleo |
|---|---|---|
| Descubrimiento inicial | **SPICED** | Situation, Pain, Impact, Critical Event, Decision |
| Calificación y cierre | **MEDDIC** | Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion |
| Primer contacto en frío (outbound) | **Insight Selling + ABP** (Challenger) | Vender la reunión, no el producto: insight de industria → hipótesis de dolor |
| Campaña a cliente conocido | **ABS + Insight Selling** | Hook contextual → hipótesis de dolor → solución → CTA bajo compromiso |
| Venta cruzada post-venta | **Modelo Bowtie** | Onboard → Impact (validar ROI) → Grow (cross-sell como siguiente paso lógico) |
| Seguimiento de servicios | **KAM + QBR/EBR** | Revisión trimestral estratégica con Economic Buyer; servicio como inversión, no gasto |
| Seguimiento de productos | **Customer Health Score** | Métricas de uso → salud roja (intervención anti-churn) / verde (trigger de upgrade) |

### 8.2 Fórmula PIPC (primer contacto en frío)
1. **P — Personalización/Relevancia:** mencionar rubro o hito reciente de la empresa.
2. **I — Insight/Provocación:** desafío o tendencia crítica de su sector.
3. **P — Propuesta de valor:** producto enfocado solo en resultado/impacto.
4. **C — CTA basado en interés:** validar hipótesis o compartir mejores prácticas (sin presionar compra).

Flujo completo: Campaña Outbound (Insight Selling: lograr primera respuesta) → Primera llamada (SPICED: validar hipótesis de dolor) → Calificación y cierre (MEDDIC: Economic Buyer + Champion).

### 8.3 Scoring metodológico (algoritmo del docx, complementario al §6)
`Total = Fit base (rubro+tamaño, +20) + SPICED (Pain validado +15, Impact $ +20, Critical Event +15) + MEDDIC (Economic Buyer +15, Champion +15)`
Umbrales: <50 → bot mantiene nurturing; ≥70 → notificación a vendedor humano.

## 9. Handoff Humano (Human-in-the-Loop): matriz y protocolo

**Principio:** la IA recopila, diagnostica y califica; el humano conecta, empatiza y cierra.

### 9.1 Triggers de intervención por metodología
| Etapa | Trigger humano | Rol bot (pre) | Rol vendedor (post) |
|---|---|---|---|
| PIPC/Prospección | Acepta agendar / alta intención | Generar interés, ofrecer horarios | Primera llamada ejecutiva |
| SPICED | Impact cuantificado o pide propuesta | Preguntas S/P/I | Diseñar propuesta enfocada en Impact |
| MEDDIC | Economic Buyer involucrado / negociación | Mapear decisor y criterios | Negociar, objeciones, cerrar, validar Champion |
| Health Score | Salud roja (churn) | Registrar tickets/métricas | Llamada proactiva anti-cancelación |
| Bowtie/KAM | Achieved Impact validado | Check-ins/encuestas | QBR con cross/up-sell |

### 9.2 Triggers automáticos (interrupción directa)
- **A. Por score:** `lead_fit_score >= 70` → estado `assigned_to_rep`, pausa bot, notifica vendedor.
- **B. Por intención explícita:** "quiero hablar con una persona", "descuento", "contrato/factura" → traspaso inmediato.
- **C. Failsafe por incertidumbre:** confianza baja o misma pregunta 3 veces (bucle) → transferencia de emergencia.

### 9.3 Protocolo de transición sin fricción
Mensaje del bot: *"Excelente [Nombre]. Con lo que me compartes sobre el impacto en [Pain], asigné a [Vendedor], especialista en [Rubro], para revisar tu caso. Te contacta por este mismo medio en breve."* + briefing interno al vendedor (formato en CTX-03 §7) + campo `Modo_Conversación` para devolución al bot (edge case 5).

## 10. Casos de borde (6) y reglas de infraestructura WhatsApp (3)

### 10.1 Edge cases operativos críticos
1. **Entrada multimodal** (audio/foto/PDF/comprobantes): pre-procesamiento antes del Router — Whisper para voz, visión/OCR para imágenes/PDF (ejecución: ROAD 2.1).
2. **Guardrails anti-alucinación comercial:** el agente **nunca calcula precios/inventario de memoria** → lookup determinista a BD/ERP (patrón RAG/lookup; ROAD 7.2, CTX-03 §5).
3. **Ghosting:** si `SPICED_In_Progress` sin mensajes 24h → secuencia de reactivación suave (bump) vía webhook.
4. **Multi-contacto misma empresa:** vincular al objeto Company existente (historial unificado, CTX-03 §4).
5. **Devolución al bot post-intervención humana:** `Modo_Conversación: IA/Humano/Devolver_a_IA` + mensaje de reenganche.
6. **Crisis/sentimiento negativo:** analizador de sentimiento en el Router → **bypass total de metodologías comerciales** → operador humano de soporte prioritario.

### 10.2 Reglas de infraestructura WhatsApp (normativas Meta)
1. **Ventana de 24h:** pasadas 24h sin mensaje del usuario, no se puede enviar texto libre → usar **plantilla HSM aprobada con botones** (ej. [Continuar cotización]/[Hablar con asesor]); al responder se reabre la ventana. *Impacto directo en §4: toda reactivación >24h es HSM, no texto libre.*
2. **Latencia/UX:** la cadena completa (Router→Extractor→CRM→Conversacional) toma 3-8s → activar `typing_indicator` inmediato al recibir el webhook para evitar race conditions.
3. **Anti-baneo/opt-out:** detección dura de "no me molesten/bájenme/spam/cancelar" → `opt_out = TRUE`, detener seguimientos, despedida breve neutra. (Ya implementado parcialmente: RAG-G3-05 detección "STOP".)

## 11. Topología del sistema de agentes (Front-office / Back-office)

**Separación clave:** un solo agente que hable *y* analice produce respuestas lentas, largas y artificiales.

```
┌─────────────────────────────────────────────────┐
│ FRONT-OFFICE: Agente Conversacional (WhatsApp)  │
│ • Charla natural, breve (2-3 oraciones máx.)    │
│ • No calcula: ejecuta directivas del Back-Office│
└──────────────────┬──────────────────────────────┘
                   │ contexto │ directivas
┌──────────────────▼──────────────────────────────┐
│ BACK-OFFICE (silencioso, en Dify)               │
│ 1. Router    → etapa actual (PIPC/SPICED/MEDDIC)│
│ 2. Extractor → JSON estructurado del mensaje    │
│ 3. Scoring   → recalcula score + sync CRM       │
└─────────────────────────────────────────────────┘
```

Ejemplo de salida del Extractor: `{"spiced_pain": "Pérdida 15% inventario", "spiced_impact_financial": 12000, "critical_event_date": "2026-09-30", "detected_champion": "Carlos Ramírez"}`. Relación con los 6 agentes especializados del roadmap (Qualifier/Sales/Support/Nurturing/Post-Sale/Voice, ROAD 5.2) en CTX-05 §4.

## 12. Objetivos y criterios de cumplimiento (seguimiento)

| # | Objetivo contextual | Criterio medible | Estado | Seguimiento |
|---|---|---|---|---|
| CTX04-O1 | Comportamiento vendedor (no formulario) | Flujo de 8 etapas implementado como nodos del grafo; nodos de reencuadre/objeción/reactivación existen | Diseñado | RAG-G15-01 |
| CTX04-O2 | Autonomía por configuración | `autonomy_zone` leído de plantilla en cada nodo de decisión (0 decisiones de zona inferidas por el modelo) | Diseñado (JSON listo) | RAG-G15-02, CTX-05 |
| CTX04-O3 | Banco de objeciones operativo | ≥8 objeciones con trigger + respuesta base cargadas en plantilla; objeciones registradas en estado del lead | JSON listo (consultora) | RAG-G15-03 |
| CTX04-O4 | Temperatura calculable | Score fit+engagement+intent computado desde campos; umbrales 70/40; decay −20% a los 5 días | JSON listo | RAG-G15-04 |
| CTX04-O5 | Cadencia y nurture | Secuencia de 8 intentos configurada; estados activo/nurture/descartado/reactivado con reingreso a score cero | JSON listo; ejecución futura (ROAD 5.1) | RAG-G15-05 |
| CTX04-O6 | Handoff útil | Paquete con campos mínimos siempre presentes + 1 sola próxima acción; KPI: humano cierra sin repetir indagación | Diseñado | RAG-G15-06 |
| CTX04-O7 | Metodologías mapeadas | Matriz estado→metodología (§8/CTX-03 §3) cargada; scoring metodológico con umbral 70 | Diseñado | CTX-03 OT-06 |
| CTX04-O8 | Cumplimiento WhatsApp | 100% reactivaciones >24h vía HSM; typing indicator <1s tras webhook; opt-out duro <1 turno | Parcial (STOP ya detecta) | RAG-G8-01, G3-05 |
| CTX04-O9 | Edge cases cubiertos | Los 6 casos con manejo explícito en el grafo | 1/6 parcial (opt-out) | ROAD 2.1, 7.2 |

**Nota sobre fuentes (heredada):** los números de cadencia (5-8 intentos), el scoring fit/engagement/intent y los umbrales provienen de literatura B2B general — son **valores iniciales a ajustar con datos reales** tras las primeras semanas en producción (tasa de respuesta por intento, punto real de corte caliente/tibio).

---

## Referencias cruzadas

- → [CTX-05 Plantillas para negocios](CTX-05-ABSTRACCION-AGENTE-PLANTILLAS-NEGOCIOS.md) (cómo todo esto se vuelve JSON ejecutable)
- → [CTX-03 CRM/ERP](CTX-03-ABSTRACCION-CRM-TWENTY-FRAPPE-ERPNEXT.md) (persistencia del estado comercial, pipelines, handoff en Twenty)
- → [CTX-06 Información del negocio](CTX-06-LOGICA-NEGOCIO-INFORMACION.md) (confidencialidad de los datos que el agente maneja)
- → [TEC-03](../tecnica/TEC-03-OBJETIVOS-TECNICOS-FASES.md) (qué partes ya corren: state machine, opt-out, scoring rule-based)
