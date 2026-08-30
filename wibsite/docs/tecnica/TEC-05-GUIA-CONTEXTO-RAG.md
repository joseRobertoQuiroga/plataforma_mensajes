# TEC-05 — Guía de Contexto y Búsqueda (Optimización de Iteraciones)

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Técnica (NAVEGACIÓN)
> **Propósito:** que cualquier persona o agente IA encuentre el contexto correcto en **menos de 2 minutos** y sepa exactamente qué leer (y qué no) antes de actuar. Es la capa de "optimización de búsqueda de contexto" del proyecto.

---

## 1. Mapa total de la documentación (qué vive dónde)

| Capa | Ubicación | Lector | Contenido | Tamaño típico |
|---|---|---|---|---|
| **Contextual** | `docs/contextual/` (CTX-01…07) | Todos | QUÉ/POR QUÉ: negocio, vendedor, plantillas, infra | 100-200 líneas |
| **Técnica** | `docs/tecnica/` (TEC-01…05) | Dev | CÓMO/ESTADO + objetivos OT + control | 80-200 líneas |
| **Maestro RAG** | `docs/maestro/` | IA/Dev | Inventario G1-G18 de funcionalidades core con paths | 1 archivo |
| Estado vivo | `Avances/` (6) | Equipo | Qué se hizo, qué falta, salud | 60-190 líneas |
| Fichas módulo | `docs/context/` (7) | Dev | Detalle por servicio antes de modificarlo | 30-152 líneas |
| Datos IA | `docs/rag/` (6) | IA | Endpoints, env, credenciales, dependencias | ≤150 líneas |
| Maestros | raíz `*-MASTER.md` (6) | Arquitecto | Planes profundos por dominio | 700-1100 líneas |
| Cruces | `FASE1-MVP-CRUZADO.md`, `FASES-CRUZADAS.md` | PM/Dev | Matriz maestros×fases, verify scripts | 250-400 líneas |
| Operación | `RUNBOOK`, `PLAYBOOK-CAMBIOS`, checklists | Ops | Día a día, troubleshooting, cambios seguros | 130-420 líneas |
| Manuales | `MANUAL-TECNICO`, `MANUAL-USUARIO` | Usuario/Dev | Paso a paso | 520-620 líneas |
| Decisiones | `docs/MEMORY.md` | Dev | ADR-001…021 | 162 líneas |
| Investigación nueva | `Organizar_Estructurar/` | — | Fuentes originales de CTX-01/04/05 (9 archivos) | — |
| Frontend | `frontend/` (Next.js, 15 vistas) | Todos | Interfaz unificada del sistema | — |

## 2. Ruta de lectura según la tarea (tabla de decisión)

| Si vas a… | Lee en este orden | NO leas (todavía) |
|---|---|---|
| **Empezar cualquier sesión** | ① `Avances/ESTADO-GENERAL.md` ② TEC-03 tabla §3 ③ TEC-04 §4-5 (deuda/inconsistencias) | Los maestros completos |
| **Tocar comportamiento del agente/vendedor** | ① CTX-04 ② CTX-05 ③ TEC-02 G15/G16 ④ `template-consultora-software.json` | SECURITY/OPS |
| **Tocar helper-node (endpoints)** | ① TEC-02 §G2 ② `docs/context/HELPER-NODE.md` ③ `docs/rag/ENDPOINTS.md` ④ ADRs afectados | BUSINESS-MASTER |
| **Tocar campañas/leads/scoring** | ① TEC-02 G3/G4 ② `docs/context/CAMPAIGNS.md` ③ TAREAS-FUNCIONALES §1-4 | UI-UX-MASTER |
| **Tocar CRM/Twenty** | ① CTX-03 ② TEC-02 G7 ③ `docs/context/TWENTY-CRM.md` ④ ADR-012 | — |
| **Tocar n8n workflows** | ① TEC-02 G6 ② ADR-019 (bug) ③ `docs/context/N8N.md` | — |
| **Tocar Dify workflows** | ① TEC-02 G5 ② `docs/context/DIFY.md` ③ ADR-018/021 | — |
| **Tocar infraestructura/docker/nginx** | ① TEC-01 ② CTX-01 ③ `docker-compose.yml` + `nginx.conf` | CTX-04/05 |
| **Agregar un rubro/cliente nuevo** | ① CTX-05 §7 ② `esquema-config-plantilla.md` ③ JSON de ejemplo | TEC-01 |
| **Planificar la próxima iteración** | ① TEC-03 ② CTX-07 ③ `FASE1-MVP-CRUZADO.md` | Manuales |
| **Operar/troubleshoot** | ① `RUNBOOK.md` ② `Avances/PROCEDIMIENTOS.md` ③ `recovery-nginx.md` (si nginx) | CTX-* |
| **Capacitar usuario** | ① `MANUAL-USUARIO.md` ② `frontend/` (interfaz unificada) | Toda la técnica |
| **Buscar una funcionalidad concreta** | ① `docs/maestro/MAESTRO-FUNCIONALIDADES-CORE.md` (índice RAG) → te lleva al doc exacto | — |

## 3. Reglas para trabajo asistido por IA (heredadas + nuevas)

1. **Leer antes de codificar:** índice de la capa apropiada (tabla §2) + ficha del módulo + tests existentes.
2. **Ante duda: RAG → contexto → código → preguntar. No asumir.** (CONSOLIDADO-METODOLOGIA)
3. **IDs estables:** referenciar siempre por ID (CTX-04-O3, OT-08, RAG-G15-04, ADR-016), no por nombre de archivo solo.
4. **Tras cada cambio:** tests + doc actualizada + referencias válidas (ver checklist TEC-04 §7).
5. **Alucinación documental = bug:** si un dato no está en la documentación, no se inventa; se pregunta o se marca como pendiente.
6. **Conflicto de datos:** aplica la regla de TEC-04 §5 (gana el más reciente, se registra).

## 4. Convenciones de formato para nuevos documentos

- **Nombres:** `CTX-XX-TITULO.md` (contextual), `TEC-XX-TITULO.md` (técnica), `SCREAMING_SNAKE_CASE.md` (operativos), PascalCase (fichas/ADRs).
- **Header obligatorio:** versión, fecha, tipo, fuentes, referencias de ejecución/contexto.
- **Cierre obligatorio:** sección "Referencias cruzadas" + (en CTX) tabla de "Objetivos y criterios de cumplimiento".
- **Tamaño:** contextual/técnica 80-250 líneas; datos IA (rag/) ≤150 líneas; tablas sobre prosa.
- **Estados:** ✅ 🟡 🔴 ⚠️ (leyenda en `docs/tecnica/00-INDICE-TECNICO.md`).

## 5. Flujo de actualización cruzada (qué tocar cuando cambia algo)

```
Cambio en código (feature core)
  ├─→ TEC-02 (estado del grupo G) 
  ├─→ docs/maestro/MAESTRO (entrada RAG-G*)
  ├─→ Avances/LOGROS.md + ESTADO-GENERAL.md
  ├─→ CHANGELOG.md
  └─→ Si es decisión: ADR en MEMORY.md

Cambio en planteamiento/negocio
  ├─→ Documento fuente (Organizar_Estructurar/ o maestro)
  ├─→ CTX-0X afectado (consolidación)
  └─→ Si cambia un objetivo: tabla CTX0X-OY + TEC-03

Nuevo objetivo técnico
  └─→ TEC-03 (OT-XX) + justificación CTX en su fila (regla CTX07-O1)
```

## 6. Atajos de búsqueda (grep rápido)

| Buscar | Patrón |
|---|---|
| Un objetivo de negocio | `CTX0[1-7]-O\d+` |
| Un objetivo técnico | `OT-\d\d` |
| Una funcionalidad core | `G\d+(-\d\d)?` en `docs/maestro/` |
| Una decisión | `ADR-0\d\d` |
| Una vulnerabilidad | `(C\|A\|M\|L)-\d\d` en SECURITY-MASTER |
| Estado de algo | buscar el símbolo ✅/🟡/🔴 junto al ID |

---

## Referencias cruzadas
- → [00-INDICE-TECNICO](00-INDICE-TECNICO.md) | [00-INDICE-CONTEXTUAL](../contextual/00-INDICE-CONTEXTUAL.md) | [MAESTRO RAG](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md)
- → `CONSOLIDADO-METODOLOGIA.md` (metodología madre de esta guía)
