# Wibsite Business — Guía Visual de Documentación

> **Propósito:** Encontrar rápidamente el archivo que necesitas según lo que buscas.
> **Archivos totales:** ~100+ documentos | **Última actualización:** Agosto 2026
> **📖 Hub Visual:** Abre `hub/index.html` en navegador para versión interactiva.
> **📌 Documentos maestros:** `ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md` · `SECURITY-MASTER.md` · `UI-UX-MASTER.md` · `OPS-MASTER.md` · `DATA-MASTER.md` · `BUSINESS-MASTER.md`
> **⭐ Estructura consolidada (punto de entrada):** `docs/contextual/` (QUÉ/POR QUÉ — 7 bloques CTX) · `docs/tecnica/` (CÓMO/ESTADO — 6 bloques TEC) · `docs/maestro/` (mapa RAG de funcionalidades core G1-G18). Ver `docs/INDEX.md`.

---

## 🚀 Si buscas empezar rápido

| Archivo | Líneas | Encontrarás |
|---------|--------|-------------|
| `specs/SETUP_GUIDE.md` | 200 | Guía paso a paso de configuración inicial (prerrequisitos, .env, servicio por servicio) |
| `Avances/PROCEDIMIENTOS.md` | 190 | Comandos para iniciar/detener, verificar health, hacer backup |
| `Avances/ESTADO-GENERAL.md` | 129 | Estado actual del proyecto con barras de progreso y top 5 próximos pasos |

---

## 📂 ESTRUCTURA COMPLETA DE DOCUMENTACIÓN

### 📁 `Avances/` — Estado Vivo del Proyecto (6 archivos)

> **Propósito:** Refleja el estado actual del proyecto. Se actualiza constantemente.

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `ESTADO-GENERAL.md` | 165 | Barra de progreso por área, tabla de componentes con estado, top 5 próximos pasos | Vista rápida del estado general del proyecto |
| `COMPONENTES.md` | 130 | Matriz de salud de cada servicio (puerto, estado, health check, versión, DB) incluido Elastic Stack | Diagnosticar qué servicio está funcionando o no |
| `LOGROS.md` | 170 | Todos los logros completados organizados por dominio (infra, helper, Dify, n8n, Twenty, docs, observabilidad) | Saber qué se ha hecho hasta ahora |
| `OBJETIVOS-PENDIENTES.md` | 60 | Objetivos priorizados P0 (bloqueantes), P1 (alta), P2 (media), P3 (baja) | Saber qué falta por hacer y en qué orden |
| `ROADMAP.md` | 174 | Roadmap con 8 fases (F0-F7), sub-fases detalladas, dependencias, milestones | Visión a largo plazo de hacia dónde va el proyecto |
| `PROCEDIMIENTOS.md` | 240 | Comandos: start/stop, acceso a servicios, post-reset, Twilio/Meta WhatsApp, health verification, backup, Elastic/OTel, **suite TeVS** | Operaciones del día a día |

### 📁 `docs/` — Documentación Principal (17 archivos)

> **Propósito:** Documentación técnica, de usuario, operativa y de decisiones.

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `INDEX.md` | 65 | Índice maestro de toda la documentación organizado en 9 categorías | Punto de entrada a toda la documentación |
| `SOURCE_INDEX.md` | 133 | Mapeo de cada archivo de código fuente del proyecto con su propósito | Entender qué hace cada archivo en el proyecto |
| `GLOSSARY.md` | 28 | 28 términos definidos (ADR, Authelia, Canal, Dify, RAG, etc.) | Aclarar vocabulario técnico y de dominio |
| `CHANGELOG.md` | 188 | Historial de versiones v1.0.0 → v3.0.0 con Added/Changed/Fixed | Saber qué cambió entre versiones |
| `MEMORY.md` | 162 | 21 Architecture Decision Records (ADR-001 a ADR-021) con contexto, decisión, consecuencias | Entender por qué se tomaron ciertas decisiones técnicas |
| `MANUAL-USUARIO.md` | 520 | Manual end-user: cómo usar Hub, Dashboard, Chatwoot, Dify, n8n, Twenty CRM paso a paso | Capacitar usuarios no técnicos |
| `MANUAL-TECNICO.md` | 619 | Manual técnico: endpoints, puertos, credenciales, comandos de prueba por módulo, scoring | Referencia técnica para desarrolladores |
| `CHECKLIST-SSO.md` | 134 | Pasos de configuración de SSO + checklists visuales de 5 flujos | Implementar y validar SSO |
| `CHECKLIST-MANTENIMIENTO.md` | 133 | Mantenimiento diario, semanal, mensual, pre/post-release y emergencia | Operaciones de mantenimiento programado |
| `PLAYBOOK-CAMBIOS.md` | 419 | Cómo modificar cada componente (helper, docker, Dify, n8n, docs, nginx, SPAs) | Procedimiento seguro para hacer cambios |
| `RUNBOOK.md` | 226 | Quick start, diagnóstico, problemas comunes, backup/restore, logs, orden de reinicio | Operaciones de runtime y troubleshooting |
| `RUTA-ACCIONES-PENDIENTES.md` | 250 | Paso a paso de tareas manuales pendientes (activar n8n, Meta webhook, Chatwoot inbox, Twenty CRM) | Ejecutar las tareas que faltan para completar Fase 1 |
| `PRUEBAS-Y-VERIFICACIONES.md` | 345 | Checklist de verificación: infra, nginx, helper, dashboard, Twenty, n8n, Dify, Chatwoot, flujos E2E | Validar que todo funciona después de cambios |
| `TAREAS-FUNCIONALES.md` | 336 | Estado de cada funcionalidad del sistema (campañas, leads, scoring, sync, n8n, Dify, etc.) | Seguimiento granular de features |
| `TAREAS-INTERFAZ.md` | 279 | Validación visual de cada pantalla: Hub, Dashboard tabs, n8n UI, Twenty, Dify, Chatwoot, flujos E2E | QA visual de la interfaz de usuario |
| `SCALABILITY-ANALYSIS.md` | 197 | Análisis de escalabilidad: vertical vs horizontal, comparativa de gateways, propuesta multi-tenant | Planificar crecimiento a futuro |
| `DATABASE-VALIDATION.md` | 158 | Validación de BD: PK/FK, gaps en schema Lumi, debilidades del JSON store, recomendaciones de migración | Auditoría de base de datos |
| `GAPS-MINIFASES.md` | — | 45 gaps menores (G-01…G-45) detectados en cruce de fuentes; prioridades G-01…G-12 ya cerradas | Micro-tareas pendientes de cierre |
| `04_TEST_AND_VALIDATION_STANDARD.md` | — | Estándar de la suite TeVS: JSON Schema, códigos de salida 0-5, ejecución | Ejecutar y extender la suite de validación |
| `AUDIT-CROSSCHECK.md` · `AUDIT-TEST-MONITORING-STATUS.md` · `DIAGNOSTICO-FINAL.md` · `ANALISIS-CRITICO-FINAL.md` · `CIERRE-FINAL-TWILIO.md` | — | Reportes de auditoría cruzada (código↔docs↔infra) y cierre del puente Twilio | Saber qué está verificado y qué tiene gaps |

### 📁 `docs/contextual/` — Documentación Contextual Consolidada (8 archivos)

> **Propósito:** Planteamientos, ideas, objetivos, soluciones teóricas y lógica del proyecto. El QUÉ y POR QUÉ. **Punto de partida para entender cualquier faceta.**

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `00-INDICE-CONTEXTUAL.md` | 140 | Índice de los 7 bloques + sistema de referencias CTX/TEC/RAG/ADR | Navegar la capa contextual |
| `CTX-01-INFRAESTRUCTURA.md` | 280 | Diagnóstico del stack, 3 rutas de escalado A/B/C, 5 patrones de grandes empresas, módulos de integración planificados, ruta estratégica auth→validación→SaaS | Entender por qué la infraestructura está como está y hacia dónde va |
| `CTX-02-OBJETIVOS-MODULOS.md` | 240 | Objetivo, meta, funcionalidad esperada y estado de los 13 módulos de la plataforma | Saber qué debe hacer cada módulo y en qué fase está |
| `CTX-03-ABSTRACCION-CRM-TWENTY-FRAPPE-ERPNEXT.md` | 260 | Cómo el agente abstrae el CRM (Twenty) y ERP (Frappe): modelo de datos SPICED/MEDDIC, pipelines por tipo de cliente, sync como registro vivo, triage, handoff | Conectar el agente con el CRM/ERP sin acoplarlo |
| `CTX-04-LOGICA-VENDEDOR.md` | 550 | Documentación completa del vendedor IA: flujo 8 etapas, autonomía green/yellow/red, 8 objeciones, temperatura, cadencia 8 intentos, handoff, metodologías SPICED/MEDDIC/PIPC/Bowtie/KAM, 6 edge cases, 3 reglas WhatsApp, front/back-office | Todo lo que el agente necesita saber para vender |
| `CTX-05-ABSTRACCION-AGENTE-PLANTILLAS-NEGOCIOS.md` | 340 | Arquitectura 3 capas (núcleo/plantilla por rubro/config por cliente), esquema JSON de plantilla, switcher de contexto por tipo de negocio, topología multi-agente | Cómo se agrega un rubro sin tocar código |
| `CTX-06-LOGICA-NEGOCIO-INFORMACION.md` | 260 | 4 planes SaaS (Demo/Blue/ProMax/Enterprise), 6 KPIs centrales, confidencialidad public/assisted/internal, ciclo de vida y retención de información, cumplimiento | Manejar la información del negocio correctamente |
| `CTX-07-CONSOLIDACION-NEGOCIO-INFRAESTRUCTURA.md` | 220 | Matriz capacidad de negocio↔infraestructura, 5 brechas críticas actuales (B1-B5), secuencia consolidada de cierre, marco de decisión de escalado | Saber qué gap atacar primero y con qué números decidir escalar |

### 📁 `docs/tecnica/` — Documentación Técnica y de Ejecución (7 archivos)

> **Propósito:** El CÓMO, el ESTADO REAL y el PLAN DE IMPLEMENTACIÓN. **Capa de trabajo diario para desarrollo.**

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `00-INDICE-TECNICO.md` | 80 | Índice de los 6 bloques técnicos + sistema de estados ✅🟡🔴⚠️ | Navegar la capa técnica |
| `TEC-01-ARQUITECTURA-INFRAESTRUCTURA.md` | 190 | Inventario real: **20 servicios** (incl. Elasticsearch, Kibana, OTel Collector, MinIO), puertos, rutas Nginx, capa de datos, integraciones externas, seguridad de borde, flujos implementados | Referencia exacta antes de tocar infra |
| `TEC-02-FUNCIONES-IMPLEMENTACION.md` | 310 | Qué está implementado (y cómo) por grupo funcional G1-G18: endpoints, módulos, workflows, estado y deuda | Saber qué existe (y qué no) antes de codificar |
| `TEC-03-OBJETIVOS-TECNICOS-FASES.md` | 290 | 12 objetivos técnicos OT-01…12 con implementación, verificación y fase; unificación de las dos numeraciones de fases (U-F0…U-F7) | Planificar la próxima iteración |
| `TEC-04-SEGUIMIENTO-CAMBIOS-ITERACIONES.md` | 180 | Sistema de control: herramientas de seguimiento, versionado, deuda registrada (D1-D8), 8 inconsistencias documentales conocidas (I1-I8), ritual de iteración, salud documental | Mantener la documentación viva y confiable |
| `TEC-05-GUIA-CONTEXTO-RAG.md` | 150 | Mapa total de documentación, ruta de lectura según la tarea, reglas de trabajo asistido por IA, flujo de actualización cruzada | Encontrar el contexto correcto en <2 minutos |
| **TEC-06-FASES-IMPLEMENTACION.md** | **970** | **🆕 56 micro-fases en 10 oleadas**: cada una con objetivo único, contexto, implementación, pruebas, verificaciones + seguridad, logs y gate pre-prod/prod. Tabla de seguimiento. Ejecución agéntica | **Implementar el proyecto completo fase a fase** |

### 📁 `docs/maestro/` — Archivo Maestro RAG (1 archivo)

> **Propósito:** Índice navegable de las 68 funcionalidades core con ID `RAG-GX-YY`, path, funciones, estado y referencias. Incluye mapa de fases→RAG para ejecución agéntica.

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `MAESTRO-FUNCIONALIDADES-CORE.md` | 470 | 18 grupos técnicos (G1 infra…G18 SaaS), 68 entradas RAG con estado (33✅/9🟡/1⚠️/25🔴) + **cruce de las 56 fases de implementación** (objetivo, RAGs que actualiza, pruebas clave, verif., gate) | Búsqueda rápida por ID; seguimiento de qué fase actualiza qué funcionalidad |

### 📁 `docs/context/` — Fichas Técnicas por Módulo (7 archivos)

> **Propósito:** Un archivo por servicio del stack. Explica configuración, estado, integraciones.

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `ARCHITECTURE.md` | 102 | Diagrama de arquitectura general, stack de **20 servicios**, mapa de puertos, flujos inbound y broadcast | Entender cómo se conectan los servicios |
| `CHATWOOT.md` | 30 | Configuración de Chatwoot, inbox omnicanal, endpoints relevantes, estado (inbox pendiente) | Configurar y mantener Chatwoot |
| `DIFY.md` | 84 | Plugin system, autenticación (console + public API), workflow de 8 nodos LLM, OpenRouter | Configurar y mantener Dify/IA |
| `N8N.md` | 59 | Autenticación (emailOrLdapLoginId), 2 workflows, body parser bug, workaround SQL | Configurar y mantener n8n |
| `TWENTY-CRM.md` | 50 | API key JWT, 10 campos custom en `people`, sync endpoints, problema namespace global | Configurar y mantener Twenty CRM |
| `HELPER-NODE.md` | 125 | Todos los endpoints v1 legacy + v2 API, dashboard SPA, PostgreSQL + JSON fallback | Entender y extender el helper-node |
| `CAMPAIGNS.md` | 152 | Arquitectura multi-canal, endpoints completos, schema PostgreSQL, estados de campaña | Gestionar el sistema de campañas |

### 📁 `docs/rag/` — Datos Compactos para Consumo IA (6 archivos)

> **Propósito:** Versión condensada de datos técnicos, optimizada para ser consultada por LLMs.

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `ARCHITECTURE-OVERVIEW.md` | 50 | Stack, URLs internas/externas, credenciales clave | Vista rápida de la arquitectura para IA |
| `DATA-FLOW.md` | 88 | 4 flujos (inbound, broadcast, opt-out, classification) con tabla de puntos de integración | Entender los flujos de datos del sistema |
| `ENDPOINTS.md` | 145 | Todos los endpoints: Helper, Dify console + public, n8n, Chatwoot, Twenty, Plugin Daemon | Referencia rápida de APIs |
| `ENVIRONMENT-VARIABLES.md` | 70 | Variables de entorno por servicio | Configurar servicios |
| `CREDENTIALS-REFERENCE.md` | 51 | Todas las credenciales en una sola referencia | Consultar credenciales rápidamente |
| `DEPENDENCY-MATRIX.md` | 125 | Diagrama de dependencias, tabla por servicio, compatibilidad de versiones, health checks | Validar dependencias entre servicios |

### 📁 `specs/` — Especificaciones de Alto Nivel (3 archivos)

> **Propósito:** Documentos fundacionales con la visión del producto y la arquitectura.

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `ARCHITECTURE.md` | 128 | Diagrama del sistema, flujos inbound/campaign, tabla de stack, rutas Nginx, env vars críticas | Visión general de la arquitectura |
| `COMPLETE_ARCHITECTURE.md` | 1,032 | Documento maestro: visión del producto, mercado, 8 fases de roadmap (F0-F7), matriz de riesgos, configuración | Documento fundacional del proyecto |
| `SETUP_GUIDE.md` | 200 | Setup Fase 1: prerrequisitos, .env, configuración servicio por servicio (Chatwoot, Dify, n8n, Twenty, Meta) | Guía de configuración inicial |

### 📁 `hub/` — Portal Visual de Documentación (1 archivo)

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `index.html` | 710 | Diccionario visual interactivo con sidebar, buscador, 7 tabs (Dashboard, Módulos, Flujos, Objetivos, Verificación, Impacto), LEDs de estado | Navegar la documentación visualmente sin leer archivos .md |

### 📁 `scripts/` — Automatización, Auditoría y Pruebas (4 scripts + SQL + suites)

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `init-db.sql` | ~30 | SQL de inicialización: crea 5 bases de datos (chatwoot, dify, n8n, twenty, wibsite) | Crear bases al iniciar PostgreSQL |
| `campaigns-schema.sql` | 160 | Migración: 6 tablas (campaigns, campaign_leads, lead_scores, channel_status, opt_outs, workflow_logs) | Schema del sistema de campañas |
| `init-wibsite.js` | 572 | Script de inicialización post-deploy: configura APIs de Chatwoot, Dify, n8n, Twenty | Automatizar configuración inicial |
| `configure-openrouter.js` | 137 | Configura OpenRouter como proveedor LLM en Dify vía plugin | Conectar Dify con OpenRouter |
| `fix-n8n-workflow.js` | ~50 | Activa workflows n8n vía SQL directo (workaround del body parser bug) | Activar workflows sin UI |
| `diagnose-chatwoot.ps1` | 37 | Diagnóstico: estado del contenedor Chatwoot, logs, DB, Redis | Troubleshooting de Chatwoot |
| `audit-all.js` / `audit/` | — | Runner maestro de auditorías: 13 módulos / 78+ checks (última ejecución 2026-08-03 OK) | Auditoría integral del sistema |
| `simulations/` | — | 3 simulaciones con datos mockup (inbound, broadcast, grafo de agentes) | Pruebas de flujos E2E |
| `verify/` | — | Verificaciones rápidas de conectividad | Comprobaciones post-cambio |
| `tevs/` | — | **Suite TeVS**: runner PowerShell + 11 tests contra Elasticsearch + setup ILM/alertas + dashboard Kibana (estándar en `docs/04_TEST_AND_VALIDATION_STANDARD.md`) | Validación de observabilidad — **primera ejecución pendiente** |

### 📁 `n8n/workflows/` — Flujos de Automatización (2 archivos)

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `01-inbound-message.json` | 446 | Workflow: mensaje entrante → filtro → Dify → Chatwoot reply → Twenty CRM upsert | Flujo de atención de leads |
| `02-campaign-broadcast.json` | 313 | Workflow: schedule → campañas pendientes → Meta API → tracking | Envío de campañas masivas WhatsApp |

### 📁 `dify/workflows/` — Flujos de IA (2 archivos)

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `whatsapp-lead-classifier.yml` | 292 | Workflow Dify: 8 nodos LLM (detección idioma → clasificación intención → extracción datos → scoring → respuesta) | Clasificar leads con IA |
| `campaign-content-generator.yml` | 143 | Workflow Dify: personalización de mensajes de campaña por lead | Generar contenido personalizado para campañas |

### 📁 `Organizar_Estructurar/` — Investigación y Diseño Original (9 archivos)

> **Propósito:** Fuentes de investigación de las que se consolidaron los CTX. Lógica de vendedor, plantillas, casos de uso, guías de escalabilidad y SaaS. **Leer antes de CTX-04 y CTX-05 para entender el origen de las decisiones.**

| Archivo | ¿Qué contiene? | Consolidado en |
|---------|----------------|----------------|
| `logica-agente-vendedor.md` | Punto de partida del agente vendedor: reactivo vs vendedor, flujo 8 etapas, lead states, follow-up, capas | CTX-04 |
| `esquema-config-plantilla.md` | Esquema genérico de plantilla por rubro (meta, fields, objections, temperatura, followup, handoff) | CTX-05 |
| `consultora-software-objeciones-seguimiento.md` | Caso piloto: banco de 8 objeciones, temperatura scoring, cadencia B2B, umbral perdido, formato handoff | CTX-04 §5-7 |
| `template-consultora-software.json` | Plantilla poblada para consultora de software (referencia ejecutable) | CTX-05 §6 |
| `client-config-acme-dev-studio.json` | Config de cliente de ejemplo (tarifas, overrides, routing de handoff) | CTX-05 §6 |
| `Documento sin título.docx` | Metodologías de venta (SPICED/MEDDIC/PIPC/Bowtie/KAM/QBR/Health Score/ABS), topología front/back-office, handoff HITL, triage, 6 edge cases, reglas WhatsApp | CTX-04 §8-11, CTX-03 §3-4 |
| `SAAS_GUIA-ESCALABILIDAD-MULTI-MODULO.md` | 3 rutas de escalado (A K8s / B pragmática / C mínima), 5 patrones de grandes empresas | CTX-01 |
| `SAAS_RUTA-ESTRATEGICA-AUTH-VALIDACION-SAAS.md` | Ruta auth→validación→SaaS, opciones de identidad, objetivos secuenciales | CTX-01 §4-5 |
| `SAAS_PLAN-INTEGRACION-MODULOS.md` | Receta detallada: Prometheus+Grafana, GlitchTip, MinIO, Metabase, Flowbite | CTX-01 §6, TEC-06 Oleada G |

### 📁 `helper-node/` — Servicio Central (2 archivos principales)

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `index.js` | 2,755 | Servidor Express: ~108 rutas (campañas, leads, scoring, templates, Twenty sync, Excel upload, LLM chat, Twilio bridge, webhooks, agentCore) | Lógica de integración central |
| `public/index.html` | 718 | Dashboard SPA: 5 tabs (Dashboard, Campañas, Leads, Plantillas, Canales), modales drag & drop, auto-refresh | Monitoreo visual del sistema |

### 📄 `Raíz del Proyecto` — Configuración y Documentos Maestros

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `docker-compose.yml` | 669 | Orquestación de **20 servicios** con health checks, redes, volúmenes (incl. Elasticsearch, Kibana, OTel Collector, MinIO) | Levantar todo el sistema |
| `nginx.conf` | 624 | Proxy reverso: rutas /hub/, /chatwoot/, /dify/, /n8n/, /crm/, /kibana/, /minio-console/, /admin/, /api/, /webhooks/ + auth_request Authelia | Unificar acceso a todos los servicios |
| `.env` | 90 | Variables de entorno activas (DB, API keys, secretos, Elastic Stack) | Configurar servicios |
| `.env.example` | 93 | Template de variables con placeholders (sincronizado con el compose) | Guía para generar .env |
| `recovery-nginx.md` | 321 | Diagnóstico de redirect loops, configuración de referencia, recuperación paso a paso | Recuperar Nginx si falla |
| `Avances/` | — | Documentos vivos de estado (ver sección arriba) | Estado del proyecto |

---

## 🆕 Documentos Maestros Estratégicos

> **Propósito:** Planificación a futuro de grandes módulos del sistema. **6 maestros + 3 conectores.**

| Archivo | Líneas | ¿Qué contiene? | ¿Para qué sirve? |
|---------|--------|----------------|-------------------|
| `ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md` | 917 | Plan de implementación: memoria multi-agente, state machine, RAG, multi-modal (imagen/audio/video), voz y llamadas, sub-agente adaptador, editor visual de contexto | Guía de desarrollo del sistema de agentes y memoria |
| `SECURITY-MASTER.md` | 1,082 | Análisis de vulnerabilidades: 7 críticas, 12 altas, 15 medias, 9 bajas. Superficie de ataque por componente, mitigaciones, roadmap de hardening en 5 fases, anti-inyección, multimodal, cumplimiento | Auditoría y hardening de seguridad |
| `UI-UX-MASTER.md` | 1,077 | Plan de unificación visual: portal shell con iframes embebidos, navegación unificada, SSO, comunicación cruzada entre módulos, branding, split view con panel de contexto | Unificar la experiencia de usuario en un solo portal |
| `OPS-MASTER.md` | 1,002 | Arquitectura multi-tenant, jerarquía 4 niveles, DDL platform, CI/CD (GitHub Actions + approval gates), monitoreo y alertas (P0-P3), backup/DR 4 niveles, versionado, hardening pre-despliegue | Operaciones, despliegue y disaster recovery |
| `DATA-MASTER.md` | 712 | Modelo de datos consolidado (13 entidades), flujo E2E de un dato, estrategia de almacenamiento, normalización vs rendimiento, seguridad de datos nivel medio, retención/archivado, DW y BI, migración JSON→PG | Diseño y gobierno de datos del SaaS |
| `BUSINESS-MASTER.md` | 743 | 4 planes SaaS (Demo/Blue/ProMax/Enterprise) con precios y márgenes, 6 KPIs centrales, switcher de contexto por tipo de negocio, 10 industrias mapeadas, métricas de salud del agente, proyección financiera | Estrategia de negocio y monetización |
| `CONSOLIDADO-METODOLOGIA.md` | 590 | Metodología de documentación dinámica multi-capa orientada a IA: arquitectura de 8 capas, sistema de cruces, nomenclatura, ciclo de vida, reglas para desarrollo asistido, plantilla de replicación | Replicar esta calidad documental en otros proyectos |
| `FASE1-MVP-CRUZADO.md` | 810 | Cruce de los 6 maestros sobre el MVP Fase 1: 10 objetivos (MVP-01…10), ruta crítica 4 semanas / 20 pasos, paralelización, verify-mvp.sh como gate, reglas de oro | Ejecutar el MVP con verificación integrada |
| `FASES-CRUZADAS.md` | 780 | Matriz completa 6 maestros × 8 fases (F0-F7): estados Hecho/En progreso/Pendiente por paso, tiempos, verificación, reglas R1-R6, logs obligatorios | Mapa de ruta ejecutable de todo el proyecto |

---

## 🎯 Guía Rápida: ¿Qué archivo abrir según lo que necesitas?

| Si necesitas... | Abre este archivo |
|----------------|-------------------|
| **Estado actual del proyecto** | `Avances/ESTADO-GENERAL.md` |
| **Qué falta por hacer** | `Avances/OBJETIVOS-PENDIENTES.md` |
| **Qué se ha logrado hasta ahora** | `Avances/LOGROS.md` |
| **Roadmap completo a futuro** | `Avances/ROADMAP.md` |
| **Saber si un servicio está funcionando** | `Avances/COMPONENTES.md` |
| **Comandos para operar el sistema** | `Avances/PROCEDIMIENTOS.md` |
| **Entender la arquitectura general** | `specs/ARCHITECTURE.md` o `docs/context/ARCHITECTURE.md` |
| **Documento fundacional del proyecto** | `specs/COMPLETE_ARCHITECTURE.md` |
| **Guía de configuración inicial** | `specs/SETUP_GUIDE.md` |
| **Saber qué cambió entre versiones** | `docs/CHANGELOG.md` |
| **Entender decisiones técnicas** | `docs/MEMORY.md` |
| **Capacitar a un usuario no técnico** | `docs/MANUAL-USUARIO.md` |
| **Referencia técnica para desarrolladores** | `docs/MANUAL-TECNICO.md` |
| **Guía de pruebas post-cambio** | `docs/PRUEBAS-Y-VERIFICACIONES.md` |
| **Checklist de mantenimiento** | `docs/CHECKLIST-MANTENIMIENTO.md` |
| **Cómo hacer cambios sin romper** | `docs/PLAYBOOK-CAMBIOS.md` |
| **Troubleshooting y runbook** | `docs/RUNBOOK.md` |
| **Tareas manuales pendientes paso a paso** | `docs/RUTA-ACCIONES-PENDIENTES.md` |
| **Validación visual de interfaces** | `docs/TAREAS-INTERFAZ.md` |
| **Estado de funcionalidades del sistema** | `docs/TAREAS-FUNCIONALES.md` |
| **Análisis de escalabilidad** | `docs/SCALABILITY-ANALYSIS.md` |
| **Validación de base de datos** | `docs/DATABASE-VALIDATION.md` |
| **Glosario de términos** | `docs/GLOSSARY.md` |
| **Configurar SSO** | `docs/CHECKLIST-SSO.md` |
| **Detalle de un módulo específico** | `docs/context/{MODULO}.md` |
| **Referencia rápida de APIs/endpoints** | `docs/rag/ENDPOINTS.md` |
| **Credenciales de todos los servicios** | `docs/rag/CREDENTIALS-REFERENCE.md` |
| **Variables de entorno** | `docs/rag/ENVIRONMENT-VARIABLES.md` |
| **Navegación visual sin leer MDs** | `hub/index.html` (abrir en navegador) |
| **Plan de memoria multi-agente (nuevo)** | `ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md` |
| **Auditoría de seguridad (nuevo)** | `SECURITY-MASTER.md` |
| **Unificación de UI/UX (nuevo)** | `UI-UX-MASTER.md` |
| **Operaciones y DevOps multi-tenant (nuevo)** | `OPS-MASTER.md` |
| **Datos y Analytics (nuevo)** | `DATA-MASTER.md` |
| **Métricas, Planes y Lógica de Agente (nuevo)** | `BUSINESS-MASTER.md` |
| **MVP Cruzado: fases y verificaciones** | `FASE1-MVP-CRUZADO.md` |
| **Cruce completo entre todos los maestros** | `FASES-CRUZADAS.md` |
| **Configurar Nginx (recovery)** | `recovery-nginx.md` |
| **Variable de entorno ejemplo** | `.env.example` |
| **Validar observabilidad (Elastic/TeVS)** | `docs/04_TEST_AND_VALIDATION_STANDARD.md` + `scripts/tevs/` |
| **Auditorías realizadas (reportes)** | `docs/AUDIT-CROSSCHECK.md` · `docs/DIAGNOSTICO-FINAL.md` |
| **Ver/editar flujos n8n** | `n8n/workflows/01-inbound-message.json` y `02-campaign-broadcast.json` |
| **Ver/editar workflows Dify** | `dify/workflows/whatsapp-lead-classifier.yml` y `campaign-content-generator.yml` |
| **Código del helper-node** | `helper-node/index.js` |
| **Dashboard SPA** | `helper-node/public/index.html` |
| **Configuración de servicios** | `docker-compose.yml` y `.env` |
| **🆕 Documentación contextual (QUÉ/POR QUÉ)** | `docs/contextual/00-INDICE-CONTEXTUAL.md` |
| **🆕 Lógica del vendedor IA (objeciones, temperatura, handoff)** | `docs/contextual/CTX-04-LOGICA-VENDEDOR.md` |
| **🆕 Plantillas por rubro (arquitectura 3 capas)** | `docs/contextual/CTX-05-ABSTRACCION-AGENTE-PLANTILLAS-NEGOCIOS.md` |
| **🆕 Infraestructura: rutas de escalado y SaaS** | `docs/contextual/CTX-01-INFRAESTRUCTURA.md` |
| **🆕 Plan de fases de implementación (56 micro-fases)** | `docs/tecnica/TEC-06-FASES-IMPLEMENTACION.md` |
| **🆕 Mapa RAG de funcionalidades core (68 entradas)** | `docs/maestro/MAESTRO-FUNCIONALIDADES-CORE.md` |
| **🆕 Objetivos técnicos OT-01…12** | `docs/tecnica/TEC-03-OBJETIVOS-TECNICOS-FASES.md` |
| **🆕 Investigación original de ventas y metodologías** | `Organizar_Estructurar/` |

---

## 🧭 Mapa de Navegación por Tipo de Contenido

```
📊 ESTADO              → Avances/ (6 archivos)
📖 DOCUMENTACIÓN       → docs/ (17 archivos base)
📘 CONTEXTUAL (QUÉ)    → docs/contextual/ (8 archivos — 7 bloques CTX + índice)
🔧 TÉCNICA (CÓMO)      → docs/tecnica/ (7 archivos — TEC-01…06 + índice)
🗂️ MAESTRO RAG         → docs/maestro/ (1 archivo — 68 entradas + 56 fases)
📋 FICHAS POR MÓDULO   → docs/context/ (7 archivos)
🤖 DATOS PARA IA       → docs/rag/ (6 archivos)
🔬 INVESTIGACIÓN       → Organizar_Estructurar/ (9 archivos — fuentes originales)
📐 ESPECIFICACIONES    → specs/ (3 archivos)
🖥️ PORTAL VISUAL       → hub/index.html
⚙️ CONFIGURACIÓN       → docker-compose.yml · nginx.conf · .env
📜 SCRIPTS             → scripts/ (*.sql, *.js, *.ps1)
⚡ WORKFLOWS n8n       → n8n/workflows/ (2 JSON)
🧠 WORKFLOWS Dify      → dify/workflows/ (2 YML)
🆕 PLANES MAESTROS     → raíz (9 MD: 6 maestros + 3 conectores)
```

---

> 💡 **Consejo:** Si no sabes por dónde empezar, abre `Avances/ESTADO-GENERAL.md` para ver el estado actual, o abre `hub/index.html` en tu navegador para explorar visualmente.
