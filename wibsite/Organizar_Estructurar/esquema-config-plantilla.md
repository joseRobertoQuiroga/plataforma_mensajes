# Esquema de configuración de plantilla (lo que lee el núcleo)

Este documento define la **forma genérica** que debe tener el archivo de configuración de cualquier rubro. El núcleo (los nodos del grafo) lee siempre esta misma estructura — lo único que cambia entre "consultora de software" y "salón de eventos" es el contenido de cada bloque, no las claves.

Va acompañado de `template-consultora-software.json`, que es esta estructura ya poblada con todo lo que definimos para la consultora (objeciones, temperatura, cadencia, handoff).

---

## Estructura de alto nivel

```
template
├── meta                  → identidad y versión de la plantilla
├── autonomy_levels        → definición de las 3 zonas (verde/amarillo/rojo)
├── fields                 → campos a indagar (slot-filling + confidencialidad + autonomía)
├── objections              → banco de objeciones
├── lead_temperature       → dimensiones, señales, pesos, umbrales, decaimiento
├── followup                → cadencia de reactivación y umbral de "perdido"
└── handoff                 → formato del paquete que recibe el humano
```

## Por qué esta forma

- **`fields[].confidentiality`** es lo que implementa el mecanismo de filtrado que definimos antes: `public` / `assisted` / `internal`. El nodo que arma la respuesta al cliente solo puede leer `public` y la versión ya transformada de `assisted` — nunca `internal`. Esto es una regla de lectura de estado, no una instrucción de prompt.
- **`fields[].autonomy_zone`** es el "punto de flexión": cada campo (o etapa) declara si el agente puede decidir solo (`green`), decidir con aviso/límite (`yellow`), o debe derivar sí o sí (`red`). El nodo de decisión del grafo lee este valor en vez de que el modelo lo infiera en el momento.
- **`objections[]`** mapea 1 a 1 con la tabla que armamos: disparador → método → respuesta base. El agente elige entre estas respuestas y las personaliza con los datos ya recolectados del lead — no genera una respuesta libre.
- **`lead_temperature`** traduce la tabla de puntos a algo computable: cada señal es una condición evaluable contra el estado del lead (`response_time_minutes < 60`, por ejemplo), no un juicio del modelo.
- **`followup.sequence`** es la cadencia ya tabulada: cada intento sabe cuándo dispararse, por qué canal y qué tipo de mensaje usar.
- **`handoff.required_fields`** asegura que el paquete que llega al humano nunca varíe en estructura, sin importar en qué etapa se derivó.

## Claves y tipos (referencia rápida)

| Clave | Tipo | Notas |
|---|---|---|
| `meta.template_id` | string | único por rubro |
| `meta.version` | string (semver) | para el versionado que mencionamos como pendiente |
| `autonomy_levels.<zone>.description` | string | documentación humana de qué implica la zona |
| `autonomy_levels.<zone>.requires_human` | boolean | `red` siempre `true` |
| `fields[].id` | string | identificador único, usado en `handoff.required_fields` |
| `fields[].confidentiality` | enum: `public`, `assisted`, `internal` | ver arriba |
| `fields[].autonomy_zone` | enum: `green`, `yellow`, `red` | ver arriba |
| `fields[].required_before` | enum: `quote`, `handoff`, `none` | qué acción bloquea si falta este dato |
| `objections[].id` | string | referenciado desde logs de conversación |
| `objections[].trigger_patterns` | string[] | frases/keywords que activan esta objeción (heurística inicial; puede evolucionar a clasificador) |
| `objections[].response_pattern` | string | plantilla de respuesta con placeholders `{{campo}}` |
| `lead_temperature.dimensions[].signals[].points` | number | positivo o negativo |
| `lead_temperature.dimensions[].signals[].condition` | string | expresión evaluable contra el estado (pseudo-código, se traduce al motor de reglas real) |
| `lead_temperature.thresholds` | object | `hot`, `warm`, `cold` con su valor mínimo |
| `lead_temperature.decay` | object | `after_days_inactive`, `percent_reduction` |
| `followup.sequence[]` | array ordenado | `attempt_number`, `delay_days`, `channel`, `message_type` |
| `followup.lost_threshold.attempts` | number | intentos antes de pasar a nurture pasivo |
| `handoff.required_fields` | string[] | ids de `fields` + campos calculados (`temperature_score`, `objections_log`) |
| `handoff.next_action_options` | string[] | catálogo cerrado de próximas acciones sugeridas |

## Cómo se agrega un cliente nuevo (recordatorio)

Un cliente nuevo dentro de un rubro existente **no toca este archivo**. Solo aporta un archivo `client-config.json` más chico con tarifas, catálogo específico y textos de marca, que se combina en tiempo de ejecución con esta plantilla. Este documento es exclusivamente la capa "plantilla por rubro".
