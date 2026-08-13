# Caso Consultora de Software — Objeciones, Temperatura, Cadencia, Umbral y Handoff

Contexto que se toma como base (de lo ya definido): rubro = servicios técnicos, tipos de servicio = integración / módulo nuevo / desarrollo a medida / auditoría-consultoría, autonomía = zona verde chica (indagar, dar rango), zona roja grande (número final siempre pasa por vos). Este documento baja los 5 puntos pendientes a reglas concretas y usables por el agente, no a lineamientos generales.

---

## 1. Banco de objeciones — consultora de software

Estructura de cada objeción: **disparador** (qué dice el lead) → **método** → **respuesta base** (la plantilla la personaliza, el agente no la improvisa desde cero). El método de fondo es escuchar → indagar más → responder con valor, no con descuento — es el patrón que se repite en las guías de manejo de objeciones: reconocer la preocupación, hacer una pregunta que la precise, y recién ahí responder con una razón concreta para avanzar en vez de restar valor a la oferta.

| # | Objeción típica | Qué esconde realmente | Respuesta base (patrón) |
|---|---|---|---|
| 1 | "Es muy caro" / "¿no hay algo más barato?" | Rara vez es solo precio — casi siempre es que no ve el valor todavía. Antes de tocar el número conviene preguntar qué está comparando. | Reencuadrar como inversión y devolver la pregunta: "¿con qué lo estás comparando — con otro presupuesto o con no hacerlo?" Después mostrar qué incluye el alcance, no bajar el precio de entrada. |
| 2 | "Tengo que comparar con otras opciones" | Interés real, no rechazo — es la objeción "buena" según los frameworks de venta. | No competir en precio en el chat. Ofrecer un diferenciador concreto (ej. auditoría previa incluida, garantía de alcance) y proponer la llamada como el lugar donde se resuelve la comparación. |
| 3 | "No sé si esto realmente lo necesito / si vale la pena" | Escepticismo sobre el valor, no sobre el precio. | Pedir el problema concreto que están viviendo hoy y conectarlo con un caso similar ya resuelto (si la plantilla tiene casos de referencia cargados). |
| 4 | "Necesito consultarlo con mi socio/equipo" | Objeción de decisión compartida, no de interés. | No presionar por cierre inmediato. Ofrecer agendar la reunión con ambas partes presentes, o dejar un resumen escrito fácil de reenviar. |
| 5 | "¿Cuánto tiempo tarda?" seguido de silencio tras la respuesta | Suele ser una objeción de urgencia/prioridad encubierta. | Preguntar el motivo del plazo (¿hay una fecha externa que lo empuja?) — esto además alimenta el campo "urgencia" de la indagación. |
| 6 | "¿Por qué ustedes y no otro desarrollador/agencia?" | Objeción de confianza/diferenciación. | Responder con especialización concreta (tipo de proyectos, stack, casos), no con adjetivos genéricos ("somos los mejores"). |
| 7 | "Mándame la cotización por escrito, ya lo vemos" (lead se desconecta) | Objeción silenciosa — no es que la rechace, es que evita seguir la conversación en vivo. | No forzar la conversación; enviar el resumen y activar la secuencia de seguimiento (sección 3) en vez de insistir en el mismo canal en el momento. |
| 8 | "Esto está fuera de mi presupuesto ahora" | Restricción real o excusa de salida educada. | Preguntar si es tema de monto total o de forma de pago — abre la puerta a fraccionar el alcance (auditoría primero, desarrollo después) en vez de perder el lead entero. |

**Regla de diseño:** cada objeción resuelta queda registrada en el estado del lead (qué objeción, qué respuesta se dio) — esto alimenta tanto la "temperatura" (punto 2) como el handoff (punto 5), y evita que el humano repita el mismo argumento que el agente ya usó.

---

## 2. Temperatura del lead — regla calculable, no criterio del modelo

Se arma como un **score numérico simple** que combina tres dimensiones — el mismo principio que separan los modelos de lead scoring más usados: encaje con el perfil ideal (fit), comportamiento durante la conversación (engagement), y señales de intención de compra. Cada dimensión suma puntos por señales objetivas que el agente ya captura en el flujo normal — no evalúa "vibra", lee campos del estado.

### Fit (peso 30 pts) — ¿es un lead que tiene sentido perseguir?
| Señal | Puntos |
|---|---|
| Tipo de servicio dentro de lo que ofrecés (integración/módulo/a medida/auditoría) | +15 |
| Menciona presupuesto o rango compatible con tus mínimos | +10 |
| Tiene infraestructura o contexto técnico ya definido (menos ambigüedad) | +5 |

### Engagement (peso 40 pts) — ¿cómo se está comportando en la conversación?
| Señal | Puntos |
|---|---|
| Responde en menos de 1 hora | +15 |
| Responde entre 1 y 24 horas | +8 |
| Responde después de 24 horas | +2 |
| Completa los campos obligatorios sin evasivas | +15 |
| Hace preguntas de seguimiento (no solo contesta lo mínimo) | +10 |

### Intención (peso 30 pts) — ¿hay señales de que quiere avanzar?
| Señal | Puntos |
|---|---|
| Menciona una fecha límite o urgencia concreta | +15 |
| Pregunta por precio o forma de pago espontáneamente | +10 |
| Pide agendar reunión sin que el agente lo proponga primero | +5 |

### Umbrales de temperatura
- **Caliente (≥70 pts):** prioridad de handoff inmediato, contacto humano en el menor tiempo posible — está probado que actuar en los primeros minutos multiplica la probabilidad de conversión frente a demorar la respuesta.
- **Tibio (40–69 pts):** sigue en cadencia activa del agente, no pasa a humano todavía salvo que pida explícitamente hablar con alguien.
- **Frío (<40 pts):** pasa a la secuencia de reactivación de baja frecuencia (sección 3) en vez de seguimiento intensivo.

**Decaimiento (score decay):** si un lead tibio o caliente no interactúa en 5 días, el score baja un 20% — para que la prioridad refleje el momento actual y no una conversación vieja que ya perdió impulso.

---

## 3. Cadencia y canal de reactivación

La evidencia de seguimiento comercial B2B es consistente en un punto: la mayoría abandona demasiado pronto — cerca de la mitad de los vendedores deja de insistir después de un solo intento, y ahí es donde se pierde la mayor parte del pipeline. El estándar razonable cuando ya hubo una interacción inicial (no es prospección en frío) es de 5 a 8 intentos antes de desistir formalmente.

### Secuencia propuesta para la consultora

| Intento | Cuándo | Canal | Tipo de mensaje |
|---|---|---|---|
| 1 | Inmediato (mismo turno) | Igual al de contacto (WhatsApp probablemente) | Confirmación + siguiente paso claro |
| 2 | +1 día si no hubo respuesta | Mismo canal | Recordatorio con valor agregado (no "¿seguís ahí?" — sí "te dejo un ejemplo de un proyecto similar") |
| 3 | +3 días | Mismo canal | Pregunta puntual y fácil de responder (baja la fricción: sí/no, o elegir entre 2 opciones) |
| 4 | +6 días | Cambia a email si hay dato, si no sigue en WhatsApp | Resumen escrito de lo hablado + oferta de agendar |
| 5 | +10 días | Email o WhatsApp | Contenido de valor (caso de éxito, artículo, comparación) — no venta directa |
| 6–8 | Cada 10–15 días | Alternar canal | Nurture de baja frecuencia — recién acá el lead pasa a "frío" formalmente si no hay señal |

Después del intento 4, si el lead nunca respondió, conviene bajar el ritmo en vez de sostener la misma frecuencia — persistir con la cadencia original a un lead que ya mostró desinterés genera fricción y desgasta el canal (especialmente WhatsApp, donde el costo de spam es más alto que en email).

---

## 4. Umbral de "lead perdido"

No se declara "perdido" en el sentido de eliminado — se declara **inactivo/nurture pasivo**, salvo casos con dato explícito de descarte (ej. dijo directamente que no, o el proyecto no encaja en absoluto con lo que ofrecés).

| Estado | Condición | Qué hace el sistema |
|---|---|---|
| Activo | Dentro de los primeros 4 intentos de la cadencia | Sigue la secuencia normal |
| Frío / nurture | Pasó el intento 8 sin respuesta, o score de temperatura <40 sostenido por 15+ días | Sale de la cadencia activa, entra a lista de contenido de valor esporádico (mensual, no más) |
| Descartado explícito | El lead dijo que no, o no hay fit posible con el rubro | Se cierra el hilo, no se reintenta salvo evento externo (ver disparadores contextuales del documento anterior) |
| Reactivado | Cualquier lead en nurture que vuelve a interactuar por su cuenta | Reingresa a temperatura calculada desde cero con la nueva interacción, no arrastra el score viejo |

Esto evita dos errores comunes y opuestos: seguir insistiendo indefinidamente (quema el canal) y descartar leads que solo necesitaban más tiempo — los datos de seguimiento en B2B muestran que quienes responden recién en el sexto u octavo contacto no son leads de menor calidad, muchas veces simplemente tardaron más en madurar la decisión internamente.

---

## 5. Formato del paquete de handoff (consultora)

Campos mínimos, siempre presentes, sin importar en qué punto del flujo se derivó:

**Datos duros**
- Nombre y datos de contacto
- Tipo de servicio solicitado (integración / módulo / a medida / auditoría)
- Urgencia declarada (con o sin fecha límite)
- Infraestructura previa mencionada (tiene sistema existente / arranca de cero)

**Contexto de calificación**
- Score de temperatura y motivo (qué señales lo generaron, no solo el número)
- Objeciones que surgieron y cómo se respondieron (de la tabla del punto 1)
- Nivel de completitud de la indagación (qué campos quedaron sin responder, si los hay)

**Insumo para cotizar**
- Rango preliminar ya comunicado al lead (si se dio alguno), para no contradecirlo en la reunión
- Cualquier dato de presupuesto o forma de pago que el lead haya mencionado espontáneamente

**Próxima acción sugerida**
- Una sola recomendación explícita: "agendar llamada esta semana" / "enviar propuesta escrita" / "requiere descubrimiento técnico antes de cotizar" — no una lista de opciones para que el humano decida desde cero.

---

## Nota sobre las fuentes

Los números de cadencia (5–8 intentos), el patrón de abandono temprano de los vendedores, y el principio de fit + engagement + intención en el scoring están tomados de literatura de ventas B2B general — son puntos de partida razonables para configurar la plantilla, pero conviene tratarlos como valores iniciales a ajustar con tus propios datos reales (tasa de respuesta por intento, en qué contacto realmente convierten tus leads) después de las primeras semanas en producción — el corte entre "caliente" y "tibio", por ejemplo, va a rendir distinto según cómo responda tu audiencia real.

## Siguiente paso

Con esto la plantilla de la consultora ya tiene los 5 puntos operativos. Quedaría replicar el mismo ejercicio para el salón de eventos (que va a tener cadencias más cortas por la fecha fija del evento, y un scoring de fit distinto porque no hay "presupuesto a definir" sino paquete cerrado) — o, si preferís, pasar directo a diseñar el esquema de datos (JSON/config) que traduce estas tablas a algo que el núcleo pueda leer como configuración de plantilla.
