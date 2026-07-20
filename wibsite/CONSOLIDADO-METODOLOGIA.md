# Wibsite Business — CONSOLIDADO: Metodología de Documentación Asistida

> **Propósito:** Documentar y replicar el enfoque de documentación dinámica, estructurada en RAG, multi-capa y orientada a desarrollo asistido por IA utilizado en este proyecto.
> **Métrica:** 49 archivos | ~12,456 líneas | 6 carpetas temáticas | 6 documentos maestros | 2 archivos de cruce
> **Uso futuro:** Plantilla para nuevos proyectos que quieran adoptar este mismo estilo de documentación viva, cruzada y verificable.

---

## Índice

1. [Filosofía de la Documentación](#1-filosofía-de-la-documentación)
2. [Arquitectura de Capas Documentales](#2-arquitectura-de-capas-documentales)
3. [Patrón de Nomenclatura](#3-patrón-de-nomenclatura)
4. [Estructura de un Documento Maestro](#4-estructura-de-un-documento-maestro)
5. [Sistema de Cruces entre Documentos](#5-sistema-de-cruces-entre-documentos)
6. [Formato RAG para Consumo de IA](#6-formato-rag-para-consumo-de-ia)
7. [Ciclo de Vida de la Documentación](#7-ciclo-de-vida-de-la-documentación)
8. [Reglas para Desarrollo Asistido por IA](#8-reglas-para-desarrollo-asistido-por-ia)
9. [Plantilla de Proyecto para Replicar](#9-plantilla-de-proyecto-para-replicar)

---

## 1. Filosofía de la Documentación

### Principios Rectores

```
1. DOCUMENTACIÓN VIVA ≠ DOCUMENTACIÓN MUERTA
   ─────────────────────────────────────────
   No es un artifact que se escribe una vez y se archiva.
   Es un organismo que respira con el código.
   Se actualiza cuando cambia el código.
   Se consulta antes de cambiar el código.

2. CAPAS CON PROPÓSITO ≠ MONOLITO
   ──────────────────────────────
   No todo en un solo archivo.
   Cada capa tiene un lector objetivo diferente:
   - Avances/ → El equipo (estado vivo)
   - docs/context/ → Desarrolladores (por qué)
   - docs/rag/ → IA (datos concretos)
   - Maestros → Planificación estratégica (visión)

3. CRUCES ≠ DUPLICACIÓN
   ──────────────────────
   Un dato aparece en varios lugares con perspectivas diferentes:
   - Contexto técnico (docs/context/DIFY.md)
   - Dato concreto (docs/rag/ENDPOINTS.md)
   - Plan de acción (ROADMAP-MULTI-AGENT.md)
   - Verificación (FASES-CRUZADAS.md)
   No es duplicación: es la misma información desde ángulos diferentes.

4. VERIFICABLE ≠ SUPOSICIÓN
   ──────────────────────────
   Cada afirmación técnica tiene su verificación asociada.
   Cada paso tiene su check.
   Cada fase tiene su script de validación.
   Si no se puede verificar, no está documentado.

5. IA-NATIVE ≠ HUMANO-ONLY
   ────────────────────────
   La documentación está escrita para ser leída TANTO por humanos
   COMO por asistentes de IA. Por eso existe docs/rag/ con datos
   compactos y estructurados para consumo algorítmico.
```

---

## 2. Arquitectura de Capas Documentales

### Diagrama de Capas

```
                    ┌──────────────────────────────────────────┐
                    │          CAPA 0: ÍNDICE                  │
                    │   INDEX.md (guía visual de navegación)   │
                    │   SOURCE_INDEX.md (índice de código)     │
                    └────────────┬─────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  CAPA 1: ESTADO   │  │  CAPA 2: CONTEXTO │  │  CAPA 3: DATOS   │
│  Avances/ (vivo)  │  │  docs/context/    │  │  docs/rag/       │
│                   │  │  (por qué)        │  │  (qué/dónde)     │
│  • ESTADO         │  │  • DIFY.md        │  │  • ENDPOINTS.md  │
│  • COMPONENTES    │  │  • N8N.md         │  │  • CREDENTIALS   │
│  • LOGROS         │  │  • CHATWOOT.md    │  │  • ENV-VARS.md   │
│  • PENDIENTES     │  │  • HELPER-NODE.md │  │  • DATA-FLOW.md  │
│  • ROADMAP        │  │  • CAMPAIGNS.md   │  │  • DEPENDENCIA   │
│  • PROCEDIMIENTOS │  │  • TWENTY-CRM.md  │  └──────────────────┘
└──────────────────┘  └──────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  CAPA 4: ESPECS   │  │  CAPA 5: MAESTROS│  │  CAPA 6: CRUCES  │
│  specs/           │  │  raíz/           │  │  raíz/           │
│                   │  │                  │  │                  │
│  • ARCHITECTURE   │  │  • ROADMAP MULTI │  │  • FASE1-MVP     │
│  • COMPLETE_ARCH  │  │  • SECURITY      │  │  • FASES CRUZ    │
│  • SETUP_GUIDE    │  │  • UI-UX         │  │                  │
│                   │  │  • OPS           │  │                  │
│                   │  │  • DATA          │  │                  │
│                   │  │  • BUSINESS      │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
                                 │
          ┌──────────────────────┴──────────────────────┐
          ▼                                             ▼
┌──────────────────┐                       ┌──────────────────────┐
│  CAPA 7: CÓDIGO   │                       │  CAPA 8: HUB VISUAL │
│  (autodocumentado)│                       │  hub/index.html      │
│                   │                       │                      │
│  • helper-node/   │                       │  Diccionario visual  │
│  • n8n/workflows  │                       │  con buscador,       │
│  • dify/workflows │                       │  flujos, objetivos,  │
│  • scripts/       │                       │  verificación        │
└──────────────────┘                       └──────────────────────┘
```

### Propósito de Cada Capa

| Capa | ¿Qué contiene? | ¿Para quién? | ¿Cuándo se consulta? |
|------|---------------|-------------|---------------------|
| **0 - Índice** | Mapa de navegación de toda la documentación | Todos | Antes de cualquier búsqueda |
| **1 - Estado** | Estado vivo del proyecto, avances, pendientes | Equipo | Diariamente |
| **2 - Contexto** | Explicación profunda de cada módulo (por qué) | Desarrolladores | Antes de modificar un módulo |
| **3 - Datos RAG** | Datos concretos, compactos, estructurados | IA / Desarrolladores | Durante desarrollo asistido |
| **4 - Especificaciones** | Visión y arquitectura de alto nivel | Nuevos integrantes, stakeholders | Al inicio del proyecto |
| **5 - Maestros** | Planes estratégicos multi-dimensionales | Planificación | Al planificar sprints/fases |
| **6 - Cruces** | Relaciones entre documentos, dependencias, verificaciones | Ejecución | Durante el desarrollo de cada fase |
| **7 - Código** | Implementación real (JS, YML, SQL, JSON) | Desarrolladores | Durante desarrollo |
| **8 - Hub Visual** | Versión navegable e interactiva de la documentación | Usuarios no técnicos | Consulta rápida visual |

---

## 3. Patrón de Nomenclatura

### Convención de Nombres

| Patrón | Ejemplos | Cuándo usarlo |
|--------|----------|---------------|
| `SCREAMING_SNAKE_CASE.md` | `CHECKLIST-SSO.md`, `TAREAS-FUNCIONALES.md`, `PRUEBAS-Y-VERIFICACIONES.md` | Documentos operativos, procedimentales, de verificación |
| `ALLCAPS.md` | `LOGROS.md`, `ROADMAP.md`, `ESTADO-GENERAL.md` | Documentos de estado, especificaciones, visión |
| `PascalCase.md` | `DIFY.md`, `CHATWOOT.md`, `HELPER-NODE.md`, `MEMORY.md` | Contexto de módulos, registros de decisiones |
| `kebab-case.md` / `.yml` / `.json` | `docker-compose.yml`, `recovery-nginx.md`, `init-db.sql` | Configuración, archivos de sistema, código |
| `{PREFIJO}-MASTER.md` | `SECURITY-MASTER.md`, `UI-UX-MASTER.md`, `OPS-MASTER.md` | Documentos maestros estratégicos |
| `{FASE}-{CONTEXTO}.md` | `FASE1-MVP-CRUZADO.md`, `FASES-CRUZADAS.md` | Cruces y relaciones entre documentos |

### Reglas de Nomenclatura

1. **Un archivo, un propósito**: No mezclar contexto técnico con estado del proyecto.
2. **El nombre refleja el contenido**: `DIFY.md` = todo sobre Dify. `TAREAS-INTERFAZ.md` = validación de UI.
3. **Consistencia de carpetas**: `docs/context/` solo tiene contextos de módulos. `docs/rag/` solo datos compactos.
4. **Mismo nivel = mismo tipo de contenido**: Todos los maestros en raíz. Todos los avances en `Avances/`.

---

## 4. Estructura de un Documento Maestro

### Template de Documento Maestro

```markdown
# Wibsite Business — {DOMINIO}-MASTER: {TÍTULO COMPLETO}

> **Versión:** X.X — {MES} 2026
> **Propósito:** {Una línea clara de para qué sirve este documento}
> **Estado:** {Planificación | Implementación | Completo | Mantenimiento}

---

## Índice

1. [Sección 1](#1-sección-1)
2. [Sección 2](#2-sección-2)
...

---

## 1. Sección 1

### 1.1 Subsección

#### Objetivo
{Qué se busca con esta sección}

#### Implementación / Análisis
{Contenido detallado, tablas, diagramas, código}

#### Verificación
- [ ] Test 1: descripción → resultado esperado
- [ ] Test 2: descripción → resultado esperado

#### Errores / Mitigaciones
| Error | Síntoma | Mitigación |
|-------|---------|------------|

#### Contextos Afectados
- {Qué otros módulos/documentos se ven afectados}

---

## N. Nota Final

>{Resumen, advertencias, siguientes pasos}
```

### Elementos Obligatorios en Cada Documento Maestro

```
✅ Header con versión, propósito y estado
✅ Índice al inicio
✅ Tablas para datos comparativos
✅ Listas de verificación ([ ])
✅ Sección de errores conocidos y mitigaciones
✅ Sección de contextos afectados
✅ Nota final con resumen
```

---

## 5. Sistema de Cruces entre Documentos

### 5.1 Tipos de Cruce

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **Cruce de dependencia** | Paso A depende de Paso B | `ROAD 1.1 → DATA 10` |
| **Cruce de verificación** | Lo que dice un documento se verifica en otro | `BUS KPI-3 → ROAD 1.1 (métrica de eficiencia)` |
| **Cruce de contexto** | Misma información desde ángulos diferentes | `DIFY.md (contexto) → docs/rag/ENDPOINTS.md (datos)` |
| **Cruce de fase** | Un paso contribuye a múltiples fases | `ROAD 4.1 → F1 (básico) + F4 (completo)` |

### 5.2 Formato de Referencia Cruzada

```
Formato: {DOCUMENTO} {SECCIÓN}

Ejemplos:
  ROAD 1.1   → ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md, sección 1.1
  SEC C-01   → SECURITY-MASTER.md, vulnerabilidad C-01
  UX 2.4     → UI-UX-MASTER.md, sección 2.4
  OPS 4.1    → OPS-MASTER.md, sección 4.1
  DATA 3     → DATA-MASTER.md, sección 3
  BUS 2      → BUSINESS-MASTER.md, sección 2
  F1.3       → FASE1-MVP-CRUZADO.md, paso F1.3
```

### 5.3 Matriz de Cruce (Template)

```
                    │ DOC A  DOC B  DOC C  DOC D
────────────────────┼────────────────────────────
Paso 1             │   ●     ●              
Paso 2             │          ●     ●     ●
Paso 3             │   ●            ●     
Paso 4             │                ●     ●

● = contribuye / depende de
```

---

## 6. Formato RAG para Consumo de IA

### 6.1 Principios del Formato RAG

```
1. DATOS COMPACTOS: Cada archivo de docs/rag/ tiene un propósito único
   y no excede 150 líneas. La IA puede consumirlo completo.

2. ESTRUCTURA PREDECIBLE: Tablas, listas, código. Sin prosa innecesaria.
   Sin adjetivos. Sin opiniones.

3. SIN REDUNDANCIA: Si un dato está en docs/rag/ENDPOINTS.md, no está
   también en docs/context/HELPER-NODE.md con diferente formato.
   Cada capa tiene SU versión del dato.

4. ENCABEZADO DE CONTEXTO: Cada archivo RAG comienza con:
   ```markdown
   # {ARCHIVO} — {CONTEXTO}
   > Propósito: {una línea}
   > Fuente: {de dónde se extrajo esta información}
   > Actualizado: {fecha}
   ```

5. FORMATO CONSULTABLE: La IA debe poder hacer preguntas como:
   - "¿Cuál es el endpoint para crear una campaña?"
   - "¿Qué credenciales necesita n8n?"
   - "¿Cuál es el flujo de un mensaje entrante?"
   Y obtener la respuesta directamente del archivo RAG.
```

### 6.2 Ejemplo de Archivo RAG (docs/rag/ENDPOINTS.md)

```markdown
# ENDPOINTS — Referencia de API

> Propósito: Lista completa de endpoints del sistema
> Fuente: docs/context/HELPER-NODE.md + código fuente
> Actualizado: 2026-07-18

## Helper Node (v2 API)
| Método | Ruta | Autenticación | Propósito |
|--------|------|--------------|-----------|
| GET    | /api/health | No | Health check |
| POST   | /api/campaigns | API Key | Crear campaña |
| POST   | /api/seed | API Key + Admin | Poblar datos de prueba |

## Dify
| Método | Ruta | Autenticación | Propósito |
|--------|------|--------------|-----------|
| POST   | /v1/workflows/run | Bearer Token | Ejecutar workflow |
| POST   | /console/api/login | Email + Password | Login de administración |
```

---

## 7. Ciclo de Vida de la Documentación

### Diagrama de Ciclo

```
PLANIFICACIÓN (Sprint Planning)
    │
    ├── Leer: FASES-CRUZADAS.md (qué toca esta fase)
    ├── Leer: Documento maestro relevante (contexto completo)
    ├── Leer: Avances/OBJETIVOS-PENDIENTES.md (prioridades)
    │
    ▼
IMPLEMENTACIÓN (Durante el Sprint)
    │
    ├── Consultar: docs/context/{MODULO}.md (cómo funciona)
    ├── Consultar: docs/rag/{DATOS}.md (datos concretos)
    ├── Modificar: código fuente
    ├── Ejecutar: tests unitarios
    │
    ▼
VERIFICACIÓN (Post-Implementación)
    │
    ├── Ejecutar: verify-fase.sh o verify-mvp.sh
    ├── Consultar: FASES-CRUZADAS.md (verificaciones)
    ├── Generar: log estructurado del cambio
    │
    ▼
ACTUALIZACIÓN (Cierre del Sprint)
    │
    ├── Actualizar: docs/context/{MODULO}.md si cambió
    ├── Actualizar: docs/rag/{DATOS}.md si cambió
    ├── Actualizar: Avances/LOGROS.md (marcar lo completado)
    ├── Actualizar: Avances/ESTADO-GENERAL.md (barras de progreso)
    ├── Actualizar: FASES-CRUZADAS.md (estado de pasos)
    ├── Actualizar: docs/CHANGELOG.md (nueva versión)
    │
    ▼
CONSULTA (Siguiente Sprint)
    │
    └── Vuelve a PLANIFICACIÓN con estado actualizado
```

### Reglas de Actualización

```
1. INMEDIATA (mientras se programa):
   - docs/rag/ → si cambia un endpoint, variable de entorno o credencial
   
2. DIARIA:
   - Avances/ESTADO-GENERAL.md (barras de progreso)
   
3. SEMANAL (cierre de sprint):
   - Avances/LOGROS.md
   - Avances/OBJETIVOS-PENDIENTES.md
   - FASES-CRUZADAS.md (estado de pasos)
   - docs/CHANGELOG.md
   
4. MENSUAL:
   - docs/context/{MODULO}.md (si hubo cambios significativos)
   - Documentos maestros (si cambió la estrategia)
   
5. POR FASE COMPLETADA:
   - FASE1-MVP-CRUZADO.md o FASES-CRUZADAS.md
   - Scripts de verificación correspondientes
```

---

## 8. Reglas para Desarrollo Asistido por IA

### 8.1 Cómo la IA Debe Usar Esta Documentación

```
1. ANTES DE ESCRIBIR CÓDIGO:
   a) Leer INDEX.md para entender la estructura del proyecto
   b) Navegar a la capa apropiada según lo que necesite:
      - ¿Contexto de un módulo? → docs/context/{MODULO}.md
      - ¿Datos concretos? → docs/rag/{ARCHIVO}.md
      - ¿Estado actual? → Avances/{ARCHIVO}.md
      - ¿Plan estratégico? → {DOMINIO}-MASTER.md
      - ¿Qué toca hacer ahora? → FASE1-MVP-CRUZADO.md o FASES-CRUZADAS.md

2. DURANTE LA IMPLEMENTACIÓN:
   a) Leer completamente el contexto del módulo a modificar
   b) Identificar todas las referencias cruzadas (dependencias)
   c) Implementar siguiendo las verificaciones especificadas
   d) No modificar nada fuera del alcance del paso actual

3. DESPUÉS DE CADA CAMBIO:
   a) Ejecutar tests unitarios del módulo modificado
   b) Verificar que las referencias cruzadas sigan siendo válidas
   c) Si se rompió algo: revertir o fixear antes de continuar
   d) Actualizar la documentación afectada

4. SI HAY DUDA:
   a) Buscar en los archivos RAG primero (docs/rag/)
   b) Si no está ahí, buscar en el contexto (docs/context/)
   c) Si no está ahí, buscar en el código fuente
   d) Si no está en ningún lado: preguntar al equipo ANTES de asumir
```

### 8.2 Prompt Inicial Recomendado para IA

```
"Eres un asistente de desarrollo para el proyecto {NOMBRE}.
Antes de responder cualquier cosa, lee los siguientes archivos:

1. INDEX.md (visión general de la documentación)
2. FASES-CRUZADAS.md (qué fase estamos ejecutando y qué pasos incluye)
3. docs/context/{MODULO}.md (contexto del módulo que vamos a modificar)
4. docs/rag/{DATOS}.md (datos concretos necesarios)

Usa las referencias cruzadas (ROAD X.X, SEC C-XX, UX X.X, OPS X.X, DATA X, BUS X)
para entender cómo este cambio afecta a otros documentos.

Después de cada modificación, verifica:
- Que los tests pasan
- Que las referencias cruzadas siguen siendo válidas
- Que la documentación afectada se actualiza

No asumas nada que no esté documentado. Si falta información, pregúntame."
```

### 8.3 Log de Interacción con IA

Cada interacción con IA que resulte en cambios debe generar un log:

```json
{
  "timestamp": "2026-07-18T10:00:00Z",
  "task": "Implementar Redis state machine",
  "docs_consulted": [
    "ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md (1.1)",
    "docs/context/HELPER-NODE.md",
    "docs/rag/ENDPOINTS.md"
  ],
  "files_modified": [
    "helper-node/src/conversation-store.js",
    "helper-node/src/routes/conversations.js"
  ],
  "tests_executed": ["npm test", "verify-mvp.sh F1.3"],
  "tests_result": "passed",
  "docs_updated": [
    "docs/context/HELPER-NODE.md (nuevos endpoints de conversación)",
    "FASES-CRUZADAS.md (F1.3 marcado como completo)"
  ],
  "ai_assisted": true,
  "duration_minutes": 45
}
```

---

## 9. Plantilla de Proyecto para Replicar

### 9.1 Estructura de Carpetas

```
{nombre-proyecto}/
│
├── INDEX.md                          ← GUÍA VISUAL DE NAVEGACIÓN
├── docker-compose.yml                ← Orquestación (si aplica)
│
├── docs/
│   ├── INDEX.md                      ← Índice detallado de docs/
│   ├── CHANGELOG.md                  ← Historial de versiones
│   ├── MEMORY.md                     ← ADRs (decisiones técnicas)
│   ├── GLOSSARY.md                   ← Glosario de términos
│   ├── MANUAL-TECNICO.md             ← Referencia técnica
│   ├── MANUAL-USUARIO.md             ← Manual de usuario
│   │
│   ├── context/                      ← CAPA 2: Contexto por módulo
│   │   ├── MODULO-A.md
│   │   ├── MODULO-B.md
│   │   └── ...
│   │
│   ├── rag/                          ← CAPA 3: Datos compactos para IA
│   │   ├── ARCHITECTURE-OVERVIEW.md
│   │   ├── DATA-FLOW.md
│   │   ├── ENDPOINTS.md
│   │   ├── ENVIRONMENT-VARIABLES.md
│   │   ├── CREDENTIALS-REFERENCE.md
│   │   └── DEPENDENCY-MATRIX.md
│   │
│   ├── decisions/                    ← ADRs individuales (opcional)
│   │
│   ├── OPERACIONES/
│   │   ├── CHECKLIST-MANTENIMIENTO.md
│   │   ├── PLAYBOOK-CAMBIOS.md
│   │   ├── RUNBOOK.md
│   │   └── PRUEBAS-Y-VERIFICACIONES.md
│   │
│   └── TAREAS/
│       ├── TAREAS-FUNCIONALES.md
│       └── TAREAS-INTERFAZ.md
│
├── specs/                            ← CAPA 4: Especificaciones
│   ├── ARCHITECTURE.md
│   └── SETUP_GUIDE.md
│
├── avances/                          ← CAPA 1: Estado vivo
│   ├── ESTADO-GENERAL.md
│   ├── COMPONENTES.md
│   ├── LOGROS.md
│   ├── OBJETIVOS-PENDIENTES.md
│   ├── ROADMAP.md
│   └── PROCEDIMIENTOS.md
│
├── {DOMINIO}-MASTER.md              ← CAPA 5: Maestros (varios)
├── {FASE}-{CONTEXTO}-CRUZADO.md     ← CAPA 6: Cruces
│
└── hub/                              ← CAPA 8: Portal visual
    └── index.html
```

### 9.2 Checklist de Creación de Proyecto

```
[N ] 1. Crear estructura de carpetas (docs/, specs/, avances/, hub/)
[N ] 2. Crear INDEX.md (guía visual de navegación)
[N ] 3. Crear docs/INDEX.md (índice detallado)
[N ] 4. Crear docs/GLOSSARY.md (glosario inicial)
[N ] 5. Crear docs/CHANGELOG.md (v0.1.0)
[N ] 6. Crear specs/ARCHITECTURE.md (visión general)
[N ] 7. Crear avances/ESTADO-GENERAL.md (estado inicial)
[N ] 8. Crear avances/ROADMAP.md (fases planeadas)
[N ] 9. Por cada módulo agregado: crear docs/context/{MODULO}.md
[N ] 10. Por cada módulo agregado: actualizar docs/rag/
[N ] 11. Por cada decisión técnica: agregar ADR en docs/MEMORY.md
[N ] 12. Al planificar una fase: crear {DOMINIO}-MASTER.md
[N ] 13. Al iniciar una fase: crear o actualizar los cruces
[N ] 14. Al completar un paso: actualizar avances/ + cruces
[N ] 15. Al liberar versión: actualizar CHANGELOG.md
```

### 9.3 Fórmula de Mantenimiento

```
Salud de la documentación = (docs_actualizados / docs_totales) × 100

Si < 80%: la documentación está rezagada. Priorizar actualización.
Si > 95%: salud excelente.
Si hay archivos con [ ] sin marcar: están incompletos.

Frecuencia de revisión: semanal (cierre de sprint).
```

---

> **Nota Final:** Esta metodología convierte la documentación de un peso muerto en un motor activo del desarrollo. Las 8 capas (Índice → Estado → Contexto → RAG → Especificaciones → Maestros → Cruces → Hub Visual) trabajan juntas para que tanto humanos como IA tengan siempre la información correcta en el momento correcto. Los cruces entre documentos aseguran que ningún cambio ocurra en el vacío. Las verificaciones garantizan que lo documentado funcione realmente. Para replicar este sistema en un nuevo proyecto, sigue la plantilla de carpetas y el checklist de creación. El resultado es un proyecto donde la documentación no es un artifact secundario, sino el plano ejecutable del sistema.
