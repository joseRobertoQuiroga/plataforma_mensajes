# Documentación Técnica — Índice General

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Estado:** Consolidado inicial
> **Propósito:** Esta capa contiene la documentación de **infraestructura, funciones, implementación y objetivos técnicos** del proyecto: el **CÓMO** y el **ESTADO REAL**. Está organizada para **optimizar iteraciones, búsqueda de contexto y seguimiento de cambios/fases/funcionalidades**. Para el QUÉ/POR QUÉ ver [`../contextual/00-INDICE-CONTEXTUAL.md`](../contextual/00-INDICE-CONTEXTUAL.md). Para el mapa RAG ver [`../maestro/MAESTRO-FUNCIONALIDADES-CORE.md`](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md).

---

## Los 6 documentos técnicos

| # | Documento | Contenido | Cuándo leerlo |
|---|---|---|---|
| TEC-01 | [Arquitectura e infraestructura técnica](TEC-01-ARQUITECTURA-INFRAESTRUCTURA.md) | Inventario real: 20 servicios (incl. Elastic Stack, MinIO), puertos, rutas Nginx, almacenamiento, redes, seguridad de borde | Antes de tocar docker-compose, nginx, .env o cualquier servicio |
| TEC-02 | [Funciones e implementación](TEC-02-FUNCIONES-IMPLEMENTACION.md) | Qué está implementado (endpoints, módulos, workflows), qué está parcial y qué falta — por grupo funcional | Antes de modificar código del helper, n8n o Dify |
| TEC-03 | [Objetivos técnicos y fases](TEC-03-OBJETIVOS-TECNICOS-FASES.md) | OT-01…OT-12: objetivos técnicos con implementación, verificación y fase; unificación de las dos numeraciones de fases | Para planificar la próxima iteración |
| TEC-04 | [Seguimiento de cambios e iteraciones](TEC-04-SEGUIMIENTO-CAMBIOS-ITERACIONES.md) | Sistema de control: ADRs, CHANGELOG, versiones, reglas R1-R6, deuda técnica e inconsistencias conocidas | Después de cada cambio; revisión semanal |
| TEC-05 | [Guía de contexto y búsqueda RAG](TEC-05-GUIA-CONTEXTO-RAG.md) | Cómo está organizada toda la documentación, qué leer según la tarea, reglas para trabajo asistido por IA | Punto de entrada de cualquier sesión de desarrollo |
| TEC-06 | [Plan de implementación por fases (56 fases)](TEC-06-FASES-IMPLEMENTACION.md) | 56 micro-fases F-01…F-56 en 10 oleadas A-J: una por objetivo, con contexto, implementación, pruebas, verificaciones (funcionamiento+seguridad/datos), logs y gate. Diseñado para ejecución agéntica | Seleccionar la primera ⬜, leer solo su fase + refs, implementar, verificar, cerrar |

---

## Principios de esta capa (heredados de CONSOLIDADO-METODOLOGIA)

1. **Documentación viva:** un cambio de código sin su actualización aquí es un cambio incompleto (regla R3).
2. **Verificable, no suposición:** cada afirmación de estado tiene su check en TEC-03 o en `docs/PRUEBAS-Y-VERIFICACIONES.md`.
3. **Cruces ≠ duplicación:** TEC-0X referencia a los maestros y a los CTX-0X, no los reescribe. Si hay conflicto de datos, gana el documento más reciente y se registra en TEC-04 §5.
4. **IA-native:** estructura predecible (tablas, IDs, rutas de archivo) consultable directamente por agentes.

## Sistema de estados usado en toda la capa

| Símbolo | Significado |
|---|---|
| ✅ | Implementado y verificado |
| 🟡 | Parcial / implementado con deuda o pendiente de activación |
| 🔴 | No iniciado / bloqueado |
| ⚠️ | Implementado pero con riesgo o inconsistencia conocida (ver TEC-04 §5) |

## Mapa de la documentación completa del proyecto

```
docs/contextual/    QUÉ/POR QUÉ (7 docs CTX)          ← negocio, agente, visión
docs/tecnica/       CÓMO/ESTADO (5 docs TEC)          ← estás aquí
docs/maestro/       MAPA RAG (funcionalidades core)   ← búsqueda rápida
docs/context/       Fichas por módulo (7)             ← detalle por servicio
docs/rag/           Datos compactos para IA (6)       ← endpoints, env, credenciales
docs/*.md           Manuales, runbook, checklists     ← operación diaria
Avances/*.md        Estado vivo                       ← qué se hizo / qué falta
Raíz (*-MASTER.md)  6 maestros + 2 cruces             ← planes profundos
```
