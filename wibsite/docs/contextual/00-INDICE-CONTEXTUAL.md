# Documentación Contextual — Índice General

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Estado:** Consolidado inicial
> **Propósito:** Esta capa contiene los **planteamientos, ideas, objetivos, metas, soluciones teóricas, ejemplos y manuales funcionales** del proyecto Wibsite Business. Es la documentación de **QUÉ y POR QUÉ** (visión, negocio, comportamiento del agente, lógica comercial). Para el **CÓMO técnico** ver [`../tecnica/00-INDICE-TECNICO.md`](../tecnica/00-INDICE-TECNICO.md). Para el mapa RAG de funcionalidades ver [`../maestro/MAESTRO-FUNCIONALIDADES-CORE.md`](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md).

---

## Sistema de referencias

| Prefijo | Significado | Ubicación |
|---|---|---|
| `CTX-0X` | Documento contextual (esta carpeta) | `docs/contextual/` |
| `TEC-0X` | Documento técnico | `docs/tecnica/` |
| `RAG-GX-YY` | Entrada del archivo maestro de funcionalidades | `docs/maestro/` |
| `ADR-0XX` | Decisión de arquitectura | `docs/MEMORY.md` |
| `ROAD X.X` | Paso del roadmap multi-agente | `ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md` |
| `SEC X-XX` | Vulnerabilidad/hardening | `SECURITY-MASTER.md` |
| `OPS X.X` | Sección operativa | `OPS-MASTER.md` |
| `DATA X` | Sección de datos | `DATA-MASTER.md` |
| `BUS X` | Sección de negocio | `BUSINESS-MASTER.md` |
| `UX X.X` | Sección de portal/UI | `UI-UX-MASTER.md` |
| `F1.X` | Paso de fase cruzada | `FASES-CRUZADAS.md` |
| `MVP-XX` | Objetivo del MVP Fase 1 | `FASE1-MVP-CRUZADO.md` |

**Regla de oro de seguimiento:** cada documento contextual declara al final sus *fuentes* (documentos de donde se consolidó) y sus *referencias técnicas* (dónde se ejecuta lo aquí planteado). Si un planteamiento cambia, se actualiza primero el documento fuente y luego esta consolidación.

---

## Los 7 bloques contextuales

| # | Documento | Qué consolida | Fuentes principales |
|---|---|---|---|
| CTX-01 | [Infraestructura](CTX-01-INFRAESTRUCTURA.md) | Planteamiento de infraestructura: stack actual, rutas de escalado (A/B/C), módulos de integración (observabilidad, errores, storage, BI), ruta estratégica auth→validación→SaaS | `SAAS_GUIA-ESCALABILIDAD-MULTI-MODULO.md`, `SAAS_PLAN-INTEGRACION-MODULOS.md`, `SAAS_RUTA-ESTRATEGICA-AUTH-VALIDACION-SAAS.md`, `OPS-MASTER.md`, `SCALABILITY-ANALYSIS.md` |
| CTX-02 | [Objetivos de módulos](CTX-02-OBJETIVOS-MODULOS.md) | Objetivo, meta y funcionalidad esperada de cada módulo de la plataforma con su estado | `Avances/*`, `BUSINESS-MASTER.md`, `ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md`, `FASES-CRUZADAS.md` |
| CTX-03 | [Abstracción CRM Twenty + Frappe/ERPNext](CTX-03-ABSTRACCION-CRM-TWENTY-FRAPPE-ERPNEXT.md) | Cómo se abstrae el CRM (Twenty) y el ERP (Frappe/ERPNext) frente al motor de agentes: modelo de datos comercial, sincronización, handoff, pipelines | `Documento sin título.docx`, `docs/context/TWENTY-CRM.md`, `Avances/ROADMAP.md` (F2), `DATABASE-VALIDATION.md` |
| CTX-04 | [Lógica de vendedor](CTX-04-LOGICA-VENDEDOR.md) | Documentación completa del comportamiento comercial del agente: flujo de 8 etapas, zonas de autonomía, objeciones, temperatura, cadencia, handoff, metodologías SPICED/MEDDIC/PIPC/Bowtie, casos de borde, reglas WhatsApp | `logica-agente-vendedor.md`, `consultora-software-objeciones-seguimiento.md`, `Documento sin título.docx` |
| CTX-05 | [Abstracción de lógica de agente — Plantillas para negocios](CTX-05-ABSTRACCION-AGENTE-PLANTILLAS-NEGOCIOS.md) | Arquitectura de 3 capas (núcleo/plantilla por rubro/config por cliente), esquema de configuración de plantilla, switcher de contexto, topología multi-agente | `esquema-config-plantilla.md`, `template-consultora-software.json`, `client-config-acme-dev-studio.json`, `BUSINESS-MASTER.md`, `ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md` |
| CTX-06 | [Lógica de negocio y manejo de información](CTX-06-LOGICA-NEGOCIO-INFORMACION.md) | Modelo de monetización (4 planes), KPIs, clasificación y ciclo de vida de la información del negocio, confidencialidad, retención | `BUSINESS-MASTER.md`, `DATA-MASTER.md`, `esquema-config-plantilla.md` |
| CTX-07 | [Consolidación: lógica de negocio frente a infraestructura](CTX-07-CONSOLIDACION-NEGOCIO-INFRAESTRUCTURA.md) | Matriz de correspondencia capacidad de negocio ↔ componente de infraestructura, brechas actuales, secuencia de decisión, costo por tenant | Todos los anteriores + `Avances/ESTADO-GENERAL.md`, `doc/ESTADO.md` |

---

## Cómo usar esta capa

1. **Antes de definir una funcionalidad nueva:** leer CTX-02 (objetivo del módulo afectado) y CTX-07 (¿la infraestructura actual lo soporta?).
2. **Antes de tocar comportamiento del agente:** leer CTX-04 (lógica de vendedor) y CTX-05 (plantillas) — la regla es *configuración sobre código*.
3. **Antes de tocar datos de leads/CRM:** leer CTX-03 y CTX-06 (clasificación y ciclo de vida de la información).
4. **Para seguimiento de objetivos:** cada CTX-0X termina con *objetivos y criterios de cumplimiento* medibles, cruzados con TEC-03 (objetivos técnicos) y con el archivo maestro RAG.

## Mapa rápido con el resto de la documentación

```
Contexto (QUÉ/POR QUÉ)   → docs/contextual/   ← estás aquí
Técnica  (CÓMO/ESTADO)   → docs/tecnica/
Maestro  (MAPA RAG)      → docs/maestro/
Estado vivo              → Avances/ESTADO-GENERAL.md
Decisiones (ADRs)        → docs/MEMORY.md
Datos compactos IA       → docs/rag/
Fichas por módulo        → docs/context/
Metodología doc.         → CONSOLIDADO-METODOLOGIA.md
```
