# Auditoría cruzada: pruebas, monitoreo y seguimiento

## 1. Objetivo

Este informe cruza la documentación, el código fuente, los módulos y el estándar de pruebas/monitoreo para determinar:
- qué ya está implementado
- qué falta por implementar
- qué incongruencias existen
- cómo avanzar hacia un proyecto estandarizado en control de errores, gestión, seguimiento y auditoría de flujos

## 2. Alcance analizado

- `docs/ESTANDAR-TESTING-MONITOREO.md`
- `docs/TESTING-INDEX.md`
- `docs/DIAGRAMA-MONITOREO-CONTROL.md`
- `helper-node/index.js`
- `helper-node/services/auditLogger.js`
- `helper-node/middleware/auth.js`
- `helper-node/middleware/tenantContext.js`
- `helper-node/services/store.js`
- `helper-node/services/conversationStore.js`
- tests en `helper-node/__tests__`

## 3. Implementación actual

### 3.1 Pruebas

- `Unit tests` existentes para módulos críticos:
  - tenant context (`tenantContext.test.js`)
  - lead profile (`leadProfile.test.js`)
  - agent config (`agentConfig.test.js`)
  - rate limiter (`rateLimiter.test.js`)
  - security / sanitización (`security.test.js`)
  - conversación (`conversation.test.js`)
  - RAG fallback (`ragEngine.test.js`)
- `Integration tests` cubren flujos de:
  - salud (`/health`, `/api/sli/metrics`)
  - LLM health y chat
  - autenticación API Key
  - conversación CRUD y transiciones
  - leads y agent config
  - knowledge base con fallback
  - campañas CRUD, scheduling/start
  - dashboard, scoring, templates, canales, opt-out, webhook de WhatsApp
- `Smoke tests` cubren salud, métricas y endpoints esenciales del helper
- `Contract tests` validan contratos API de `/health` y `/api/scoring/rules`
- Scripts de prueba en `helper-node/package.json` permiten ejecutar por capas:
  - `test:unit`
  - `test:integration`
  - `test:smoke`
  - `test:contract`
  - `test:e2e`
  - `test:ci`

### 3.2 Monitoreo y salud

- Exposición de métricas Prometheus:
  - `/metrics`
  - `http_requests_total`
  - `http_request_duration_seconds`
- Endpoints de health:
  - `/health`
  - `/api/sli/metrics`
  - `/api/llm/health`
  - `/api/knowledge-base/health`
  - `/api/twenty/health`
- `health` incluye:
  - módulos activos, leads, entregas, scores, conversations
  - dependencias: DB, LLM, Weaviate, Redis
  - SLI básicos: requestCount, errorRate, avgLatencyMs, deliverySuccessRate24h
- Auditoría básica de llamadas API con middleware `createAuditMiddleware('api_call')`
- Endpoint de logs: `/api/logs` lee `audit_logs`

### 3.3 Control y seguimiento

- Multi-tenant context middleware disponible con fallback a tenant `default`
- Audit logger con niveles `info`, `warn`, `error`, `security`
- Registro de eventos de error desde la store JSON/PG
- Conversation store con Redis/in-memory fallback y validación de transiciones
- Sanitización y bloqueo de inyecciones en LLM con logs de seguridad

## 4. Gaps detectados

### 4.1 Incongruencias entre documentación y código

- Documentación menciona `Grafana` y `GlitchTip`, pero en el código no hay integración activa con GlitchTip ni configuración de dashboards.
- El estándar exige `alertas mínimas`; el código expone métricas pero no define reglas de alerta ni una integración con sistemas de alerta.
- La documentación habla de `mutations testing`; no hay evidencia de herramientas como Stryker ni configuración al respecto.
- El standard sugiere `cargar leads` y `procesar webhook` como flujos críticos; las pruebas integradas cubren webhook de verificación de WhatsApp, pero no un flujo completo de webhook de evento entrante ni carga masiva de leads mediante CSV.
- El documento `docs/TESTING-INDEX.md` declara cobertura de integración amplia, pero no lista una cobertura de `upload CSV` ni `contract tests para terceros`.

### 4.2 Brechas de implementación

- Falta registro estructurado de incidentes con: `módulo`, `flujo`, `severidad`, `tenant`, `dependency`, `evidence`
- Auditoría de errores solo se dispara en middleware API y en algunas escrituras fallidas, pero no hay logs uniformes para:
  - fallbacks de dependencias (Weaviate, Redis, DB)
  - timeouts de terceros
  - errores de webhook entrante
  - cambios de estado de conversación con trazabilidad
- Falta un mecanismo de `requestId` consistente para poder enlazar logs y tracer con peticiones.
- `Sentry` está en dependencias (`@sentry/node`) pero sin uso real en el código.
- No hay pruebas de contrato para integraciones clave con Twenty, n8n, Dify o Meta.
- No hay pruebas de flujo de negocio para:
  - carga masiva de leads `/api/campaigns/:id/leads/upload`
  - export de datos `/api/campaigns/:id/export`
  - scoring y evaluación de leads en un flujo continuo
  - incidentes de webhook POST de WhatsApp o Chatwoot
- La `health` del helper depende de `getStore()` y de DB/Redis/Weaviate, pero no se documenta la criticidad de cada dependencia ni un SLI/SLO por servicio.
- No hay dashboards ni documentación concreta de qué métricas específicas consultar en Grafana.

## 5. Evaluación por módulo

### Helper API
- Implementado: middleware, auth, health, metrics, audit logs básicos.
- Falta: alertas automáticas y trazabilidad completa de request/response con requestId.

### Campañas y Leads
- Implementado: CRUD campañas, leads, upload CSV, export CSV, seed.
- Falta: cobertura de prueba de carga masiva y pasos de auditoría de errores de importación.

### Scoring y decisiones
- Implementado: endpoints de reglas de scoring, lead profile, score history.
- Falta: pruebas de flujo donde el scoring impacte decisiones y pasos de seguimiento.

### Conversaciones y seguridad
- Implementado: state transitions, auth, sanitización, bloqueo de prompt injection.
- Falta: registro estructurado de cambios de estado de conversación y seguimiento multiusuario con contexto tenant.

### Integraciones externas
- Implementado: health check para LLM, Weaviate, Twenty; webhook verify token.
- Falta: pruebas de contrato con terceros y métricas específicas de timeouts/errores externos.

### Infraestructura y observabilidad
- Implementado: prom-client, `/metrics`, hook de health.
- Falta: dashboards y alertas integradas, uso de recursos, métricas de fallback por módulo.

## 6. Recomendaciones de mejora inmediata

### 6.1 Implementar alertas y dashboards

- Definir alertas Prometheus para:
  - error rate > 5% en 5 minutos
  - avg latency > 1000ms en endpoints críticos
  - fallback de Weaviate o Redis activado
  - webhook POST de WhatsApp/Chatwoot fallando repetidamente
- Documentar dashboards clave en Grafana:
  - `Helper API health`
  - `Campañas y leads`
  - `Scoring`
  - `Conversaciones`
  - `Integraciones externas`
  - `Fallback / degradación`

### 6.2 Mejorar trazabilidad y auditoría

- Añadir requestId único a cada request y propagarlo a logs/audit events.
- Expandir `auditLogger` para registrar eventos de:
  - fallback de dependencias
  - errores de webhook y contract violations
  - transiciones de conversación con razón y usuario
  - generación de prompts y bloqueos de seguridad
- Usar `tenantId` y `tenantSource` en todos los logs para auditoría multiusuario.
- Activar `Sentry` si se desea captura de excepciones estructurada en producción.

### 6.3 Completar pruebas faltantes

- Añadir tests de flujo para:
  - `POST /api/campaigns/:id/leads/upload` con CSV válido e inválido
  - `POST /webhooks/whatsapp` con payload de mensaje entrante
  - `POST /api/campaigns/:id/export` y verificación del contenido CSV
  - `POST /api/seed` seguido de scoring y lead profile
- Añadir contract tests para:
  - helper ↔ Twenty API
  - helper ↔ n8n webhook / callback
  - helper ↔ Dify / LLM contract shapes
  - helper ↔ Meta webhook signature handling
- Evaluar mutation testing con Stryker para asegurar cobertura real.

### 6.4 Cerrar brechas documentales

- Actualizar `docs/TESTING-INDEX.md` con los flujos pendientes y la matriz de pruebas exacta.
- Actualizar `docs/ESTANDAR-TESTING-MONITOREO.md` con el estado de cumplimiento actual y las brechas detectadas.
- Documentar los `SLI/SLO` y alertas necesarias para cada módulo.
- Añadir un `runbook` específico para auditoría de incidentes en `docs/RUNBOOK.md` o `docs/PLAYBOOK-CAMBIOS.md`.

## 7. Pasos concretos para estandarizar

1. Definir un checklist de pruebas obligatorio en `package.json` y en docs.
2. Añadir test pipeline de regresión en CI que ejecute `npm run test:ci` y `npm run test:coverage`.
3. Registrar los incidentes con requestId, tenantId, eventType y severity.
4. Implementar alertas Prometheus/Grafana y documentar reglas.
5. Asegurar que `Sentry` o un error tracker similar esté configurado y documentado.
6. Crear pruebas de flujo para CSV upload y webhook processing.
7. Actualizar la documentación para que coincida con la implementación real.

## 8. Conclusión

El helper ya cuenta con una base sólida de pruebas unitarias, integración y salud. Sin embargo, para cumplir plenamente el estándar operationalizado, falta cerrar las brechas en:
- alertas automáticas
- seguimiento estructurado y auditoría de incidentes
- pruebas de flujo de carga/contrato con terceros
- documentación de métricas y dashboards
- uso real de Sentry / error tracker

Con estas mejoras, el proyecto avanzará de una implementación funcional a un sistema estandarizado y auditado de manera consistente.
