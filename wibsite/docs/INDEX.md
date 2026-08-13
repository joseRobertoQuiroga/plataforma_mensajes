# Wibsite Business — Índice de Documentación

> Este documento organiza toda la documentación del proyecto por categorías.  
> 📖 **Hub Visual**: Abrir [`/hub/`](../hub/index.html) en navegador para el diccionario visual interactivo del proyecto.

---

## ⭐ Estructura Consolidada Principal (3 capas — punto de entrada recomendado)

> Organización maestra de la documentación: **contexto** (QUÉ/POR QUÉ), **técnica** (CÓMO/ESTADO) y **mapa RAG** (seguimiento rápido de funcionalidades core).

| Capa | Carpeta | Contenido | Empieza por |
|---|---|---|---|
| 📘 **Documentación Contextual** | `docs/contextual/` | 7 bloques: infraestructura, objetivos de módulos, abstracción CRM Twenty+Frappe/ERPNext, lógica de vendedor, plantillas para negocios, lógica de negocio e información, consolidación negocio↔infra | [`contextual/00-INDICE-CONTEXTUAL.md`](contextual/00-INDICE-CONTEXTUAL.md) |
| 🔧 **Documentación Técnica** | `docs/tecnica/` | 6 bloques: arquitectura/infraestructura, funciones e implementación, objetivos técnicos y fases (OT-01…12), seguimiento de cambios, guía de contexto RAG, **plan de fases de implementación (F-01…F-56)** | [`tecnica/00-INDICE-TECNICO.md`](tecnica/00-INDICE-TECNICO.md) → fase actual: [`tecnica/TEC-06-FASES-IMPLEMENTACION.md`](tecnica/TEC-06-FASES-IMPLEMENTACION.md) |
| 🗂️ **Archivo Maestro RAG** | `docs/maestro/` | Todas las funcionalidades core (G1-G18, 68 entradas) con path, funciones, estado y referencias — numeración RAG-GX-YY | [`maestro/MAESTRO-FUNCIONALIDADES-CORE.md`](maestro/MAESTRO-FUNCIONALIDADES-CORE.md) |

---

## 0. Estado Vivo del Proyecto
- `Avances/ESTADO-GENERAL.md` — Visión general con progreso, barras por área y próximos pasos
- `Avances/LOGROS.md` — Todos los logros completados por dominio
- `Avances/OBJETIVOS-PENDIENTES.md` — Objetivos pendientes priorizados P0-P3
- `Avances/COMPONENTES.md` — Matriz de salud de cada servicio y endpoint
- `Avances/PROCEDIMIENTOS.md` — Comandos y pasos operativos esenciales
- `Avances/ROADMAP.md` — Hoja de ruta con fases, milestones y dependencias
- `hub/index.html` — 🆕 **Diccionario visual interactivo** con buscador, flujos y guías

## 1. Operaciones y Cambios
- `docs/PLAYBOOK-CAMBIOS.md` — Cómo hacer cambios en cada componente (helper, docker, dify, n8n, docs)
- `docs/CHECKLIST-MANTENIMIENTO.md` — Mantenimiento diario/semanal/mensual/emergencia
- `docs/RUNBOOK.md` — Operaciones comunes: inicio rápido, diagnóstico, logs, backup, troubleshooting

## 2. Mapa del Sistema
- `docs/SOURCE_INDEX.md` — Índice completo del código fuente con descripción de cada archivo
- `docs/GLOSSARY.md` — Glosario de términos del dominio y técnicos
- `docs/CHANGELOG.md` — Historial de cambios por versión

## 3. Contexto por Módulo
- `docs/context/ARCHITECTURE.md` — Arquitectura general (diagrama Mermaid, stack, puertos, flujos)
- `docs/context/CHATWOOT.md` — Inbox omnicanal (Chatwoot)
- `docs/context/DIFY.md` — Orquestación IA (Dify + plugin-daemon + sandbox)
- `docs/context/N8N.md` — Orquestador de flujos (n8n)
- `docs/context/TWENTY-CRM.md` — CRM (Twenty)
- `docs/context/HELPER-NODE.md` — Helper Node (campañas, scoring, webhooks, dashboard)
- `docs/context/CAMPAIGNS.md` — Sistema de campañas multi-canal

## 4. Datos Concretos (RAG)
- `docs/rag/ARCHITECTURE-OVERVIEW.md` — Vista general de la arquitectura
- `docs/rag/DATA-FLOW.md` — Flujos de datos entre servicios
- `docs/rag/ENDPOINTS.md` — Todos los endpoints de la API
- `docs/rag/ENVIRONMENT-VARIABLES.md` — Variables de entorno y secretos
- `docs/rag/CREDENTIALS-REFERENCE.md` — Referencia de credenciales
- `docs/rag/DEPENDENCY-MATRIX.md` — Matriz de dependencias entre servicios con health checks

## 5. Decisiones Técnicas (ADR)
- `docs/MEMORY.md` — Registro de decisiones (ADR), con estado activo/obsoleto

## 6. Pruebas y Verificaciones
- `docs/PRUEBAS-Y-VERIFICACIONES.md` — Checklist de verificación (infra, servicios, flujos e2e)
- `docs/TESTING-INDEX.md` — Estrategia de testing por capas, comandos y seguimiento
- `docs/ESTANDAR-TESTING-MONITOREO.md` — Estándar operativo de pruebas, alertas, monitoreo y control
- `docs/04_TEST_AND_VALIDATION_STANDARD.md` — 🆕 Estándar de la suite **TeVS** (JSON Schema, exit codes 0-5)
- `docs/DIAGRAMA-MONITOREO-CONTROL.md` — Diagrama integral de pruebas, monitoreo, seguimiento y gestión
- `docs/TAREAS-FUNCIONALES.md` — Objetivos funcionales del sistema con estado
- `docs/TAREAS-INTERFAZ.md` — Validación de flujos por pantalla
- `docs/AUDIT-CROSSCHECK.md` · `docs/AUDIT-TEST-MONITORING-STATUS.md` — Auditoría cruzada código↔docs↔infra
- `docs/DIAGNOSTICO-FINAL.md` · `docs/ANALISIS-CRITICO-FINAL.md` · `docs/GAPS-MINIFASES.md` — Diagnósticos finales y 45 micro-gaps
- `docs/CIERRE-FINAL-TWILIO.md` — Cierre del puente Twilio (F-03…F-06)

## 7. Manuales
- `docs/MANUAL-TECNICO.md` — Manual técnico por plataforma (endpoints, pruebas, flujos)
- `docs/MANUAL-USUARIO.md` — Manual de usuario (instrucciones paso a paso)

## 8. Acciones Pendientes
- `docs/RUTA-ACCIONES-PENDIENTES.md` — Paso a paso de las tareas manuales que faltan (activar n8n, Meta webhook, Chatwoot inbox, etc.)

## 9. Documentos de Estado (raíz del proyecto)
- `Avances/ESTADO-GENERAL.md` — Estado general con barra de progreso y métricas
- `Avances/LOGROS.md` — Logros completados organizados por componente
- `Avances/OBJETIVOS-PENDIENTES.md` — Objetivos pendientes priorizados (P0-P3)
- `Avances/COMPONENTES.md` — Matriz de salud de servicios y endpoints
- `Avances/PROCEDIMIENTOS.md` — Procedimientos operativos y troubleshooting
- `Avances/ROADMAP.md` — Roadmap completo Fase 0-7 con dependencias
