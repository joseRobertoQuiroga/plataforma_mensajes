# Lógica, Estructura y Objetivos de Venta del Agente

## 0. Punto de partida

Ya tenés resuelto el esqueleto técnico: tres capas (núcleo / plantilla por rubro / configuración por cliente), un motor de indagación tipo slot-filling, y un mecanismo de confidencialidad por etiquetas (público / asistido / interno). Lo que falta —y es lo que pediste ahora— es la **capa de comportamiento comercial**: qué hace que ese motor de indagación deje de ser un formulario disfrazado de chat y se convierta en un vendedor que **piensa, propone, insiste con criterio y no suelta al lead hasta cerrarlo o descartarlo con causa**.

Este documento separa esa capa en cinco piezas: objetivo de venta, punto de flexión (autonomía), flujo comercial, seguimiento/consolidación, y cómo esto se integra con lo que ya definiste.

---

## 1. Qué significa "vendedor activo, creativo y proactivo" (en términos de diseño, no de personalidad)

Un agente **reactivo** contesta lo que le preguntan y llena campos. Un agente **vendedor** hace tres cosas que el reactivo no hace:

| Comportamiento | Reactivo | Vendedor |
|---|---|---|
| Ante silencio o duda del lead | Espera | Reencuadra con una pregunta o beneficio concreto |
| Ante objeción de precio | Repite el precio | Reformula valor, ofrece alternativa de alcance/paquete |
| Ante datos incompletos | Pide el dato y frena | Pide el dato **y** avanza con lo que ya tiene una hipótesis de propuesta |
| Ante lead que se enfría | No hace nada | Dispara secuencia de reactivación |
| Ante fit dudoso | Deriva sin más | Califica: intenta encajarlo en un paquete/alcance antes de descartar |

Esto no es "tono simpático". Es **lógica de flujo explícita**: el grafo necesita nodos de *reencuadre*, *manejo de objeciones*, *oferta alternativa* y *reactivación* — no solo nodos de "preguntar campo → guardar campo".

### Objetivos de venta que el agente debe perseguir, en orden de prioridad
1. **Calificar rápido**: descartar o confirmar fit en el menor número de turnos posible (nadie vende si agota al lead con 15 preguntas antes de mostrar valor).
2. **Dar valor percibido antes de pedir**: cada pregunta que hace debería venir acompañada de por qué la hace o de un micro-beneficio, no ser un formulario secuencial.
3. **Mover el estado del lead siempre hacia adelante**: nunca terminar un turno en un callejón sin salida — siempre hay una siguiente acción propuesta (dato, opción, cita, derivación).
4. **Maximizar tasa de handoff útil**: que cuando llegue al humano, el humano tenga lo necesario para cerrar en una llamada, no para repetir la indagación.
5. **No fugar información sensible ni inventar** (esto ya lo resolviste con las etiquetas — se mantiene como restricción dura sobre todo lo anterior).

---

## 2. El "punto de flexión": dónde termina la autonomía del agente

Esto es lo que te faltaba nombrar explícitamente. Cada plantilla de rubro necesita declarar, no implícitamente sino como configuración, **hasta dónde decide el agente solo**:

- **Zona verde (autónoma):** indagar, calificar, dar rangos de precio ya calculados o catálogo estándar, agendar, resolver objeciones típicas con respuestas ya definidas en la plantilla.
- **Zona amarilla (autónoma con aviso):** personalizaciones dentro de márgenes predefinidos (ej. el salón de eventos permite variar paquete ±20% sin humano), o cotización preliminar marcada explícitamente como "sujeta a confirmación".
- **Zona roja (deriva sí o sí):** todo lo que toque el dato "interno" (costo de producción, márgenes reales), negociación fuera de catálogo, cualquier compromiso contractual, clientes de alto valor o alta complejidad (ej. desarrollo a medida en tu consultora).

Esta clasificación **es un campo más de la plantilla**, igual que la etiqueta de confidencialidad de cada dato. Así el "punto de flexión" no es una decisión que el modelo toma en el momento (riesgoso), sino una regla que ya viene dada por el estado del grafo: el nodo de decisión simplemente lee `autonomy_level` del campo o de la etapa en la que está el lead.

Para tus dos casos:
- **Consultora de software:** zona verde muy chica (indagación, tipo de servicio, urgencia), zona roja grande (todo lo que sea número final) — coincide con lo que ya concluimos: el agente no cotiza cerrado, arma el rango y el handoff.
- **Salón de eventos:** zona verde/amarilla grande (catálogo con precios fijos + personalizaciones acotadas), zona roja chica (solo estructura de costos internos y casos atípicos) — el agente sí puede casi cerrar solo.

---

## 3. Flujo comercial estándar (el "core" reutilizable entre rubros)

Igual que el slot-filling es genérico y la plantilla solo aporta los campos, el flujo de venta también puede ser genérico y la plantilla aporta los contenidos. Etapas:

1. **Apertura / encuadre** — el agente se presenta, entiende el motivo de contacto en 1-2 preguntas abiertas (no arranca con formulario).
2. **Calificación** — slot-filling dirigido: solo los campos obligatorios para saber si hay fit (rubro, urgencia, tipo de necesidad).
3. **Propuesta de valor situacional** — antes de seguir pidiendo datos, el agente devuelve algo de valor: un rango, un paquete sugerido, un caso similar — usando lo que ya sabe, aunque sea parcial.
4. **Profundización** — completa los campos restantes (fecha, personalización, alcance específico), ahora con el lead ya "enganchado" porque ya vio valor.
5. **Manejo de objeciones** — nodo dedicado: precio, tiempo, confianza, comparación con competencia. Cada plantilla trae un banco de objeciones típicas del rubro con respuestas pre-aprobadas (esto es lo que le da "creatividad con control": el agente elige y adapta la respuesta, pero de un set curado, no libre).
6. **Cierre preliminar o derivación** — según la zona de autonomía: agenda, confirma reserva/cotización, o arma el handoff.
7. **Consolidación (handoff)** — paquete de información para el humano: datos duros + resumen de contexto + nivel de temperatura del lead (caliente/tibio/frío) + próxima acción sugerida.
8. **Seguimiento** — ver punto 4.

Este flujo es el mismo grafo para consultora y para salón de eventos; lo que cambia es el contenido de cada nodo (preguntas, objeciones, catálogo), no la estructura.

---

## 4. Seguimiento y consolidación de clientes (lo que falta diseñar)

Esto es la pieza que tu documento original no cubre todavía y que es clave para "vendedor activo": qué pasa **después** del primer contacto.

### Estados del lead (máquina de estados simple, corre en el núcleo)
`nuevo → calificando → propuesta_enviada → en_objeción → agendado/cerrado → enfriándose → reactivado → perdido`

### Disparadores de seguimiento (genéricos, configurables por rubro)
- Sin respuesta del lead en X horas/días → mensaje de reactivación (no un simple "¿seguís interesado?", sino aportar algo nuevo: disponibilidad, oferta, caso de éxito).
- Propuesta enviada sin respuesta → recordatorio con valor agregado, no solo repetición.
- Lead marcado "frío" tras N intentos → pasa a secuencia de nurture de baja frecuencia (no se descarta, se despriorizada).
- Evento externo relevante (ej. fecha del evento se acerca, o cliente de consultora abrió nueva necesidad) → reactivación contextual.

Cada disparador y su cadencia es configuración por plantilla (un salón de eventos con fecha fija tiene lógica de seguimiento distinta a una consultora con ciclo de venta largo), pero el **mecanismo de disparo y cola de seguimiento es del núcleo** — mismo patrón de reutilización que ya aplicaste al resto.

### Consolidación
Cada interacción de seguimiento debe actualizar el mismo estado consolidado del lead (no crear hilos separados), para que cuando el humano entra, vea una sola línea de tiempo con: primer contacto, objeciones que surgieron, qué se le ofreció, y por qué se enfrió o avanzó.

---

## 5. Cómo esto se integra con lo ya definido

- **Capas (núcleo/plantilla/config):** el flujo comercial de 8 etapas y la máquina de estados de seguimiento viven en el **núcleo**. Los bancos de objeciones, catálogo, cadencias de reactivación y niveles de autonomía viven en la **plantilla por rubro**. Tarifas y textos de marca en **configuración por cliente** — sin cambios respecto a lo ya acordado, solo se agregan estos nuevos tipos de contenido a cada capa.
- **LangGraph:** las etapas del flujo comercial y los estados del lead mapean naturalmente a nodos y transiciones condicionales — es el mismo mecanismo que ya identificaste para aislamiento de contexto, aplicado ahora a "en qué etapa de venta estoy" en vez de solo "qué dato falta".
- **Twenty / Frappe-ERPNext:** el estado consolidado del lead (etapa, temperatura, historial de objeciones) es lo que se sincroniza hacia el CRM en cada actualización — así el handoff no es un mensaje suelto sino un registro vivo que el humano puede seguir desde antes del cierre.
- **Chatwoot:** las respuestas de manejo de objeciones y reactivación son buenas candidatas para vivir como plantillas de mensaje reutilizables (tu pregunta original sobre Chatwoot) — el agente elige y personaliza la plantilla, no la escribe libre desde cero, lo que te da control de marca y velocidad.

---

## 6. Qué falta decidir (próximos puntos de iteración)

1. **Banco de objeciones por rubro** — armar el primero (¿consultora o salón de eventos?) como piloto, con 5-8 objeciones típicas y su respuesta base.
2. **Definición de "temperatura del lead"** — qué señales concretas (tiempo de respuesta, preguntas de precio, datos aportados) suben o bajan la temperatura, para que no sea un juicio del modelo sino una regla calculable.
3. **Cadencia y canal de reactivación** — cuántos intentos, cada cuánto, y si cambia de canal (WhatsApp → email) tras cierto punto.
4. **Umbral de "lead perdido"** — cuándo el sistema deja de intentar (para no gastar cuota de WhatsApp ni generar fricción con reactivaciones eternas).
5. **Formato exacto del paquete de handoff** — qué campos mínimos siempre debe traer para que sea útil sin importar el rubro.

¿Con cuál de estos cinco puntos querés seguir iterando primero? El banco de objeciones y la temperatura del lead son probablemente los que más impactan en que el agente se sienta "activo" de verdad, así que son buen punto de entrada si querés ir a lo concreto.
