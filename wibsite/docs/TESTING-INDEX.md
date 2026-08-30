# Testing y Validación — Wibsite Business

## Objetivo

Este documento centraliza la estrategia de pruebas del proyecto, los niveles de cobertura recomendados y los comandos de ejecución para validar el estado del sistema de forma repetible.

## Estrategia por capas

### 1. Unit tests
- Validan lógica pura y reglas de negocio aisladas.
- Cubren módulos como lead profile, agent config, conversation state, rate limiter, security filters y tenant context.
- Se ejecutan sin depender de servicios externos.

### 2. Integration tests
- Validan la interacción entre el helper, middleware, almacenamiento local y rutas HTTP.
- Cobran flujos críticos como campañas, dashboard, scoring, templates, opt-out, conversations y knowledge base.
- Son la capa principal para verificar el comportamiento real del helper en el entorno de ejecución.

### 3. End-to-end / smoke tests
- Verifican flujos end-to-end del sistema desde el punto de vista del usuario o del servicio.
- En este punto, la suite de integración cubre el mayor porcentaje de los flujos que se pueden validar sin depender de servicios externos completos.

## Estado actual del proyecto

- Unit tests: disponibles y ejecutables sobre módulos clave (83 tests en la capa unit del pipeline).
- Integration tests: ejecutables con éxito en el helper actual (contract, flow, integration, smoke).
- E2E Playwright: disponible (`e2e/specs/`) y ejecutable **por alcance** (modificaciones del cambio), con reporter SOAC → ES.
- Pipeline GitLab dev: prevalidación automática (unit + smoke + flow + tevs informativo) en cada push/MR; main con gate estricto.

## Estado actual (30/08/2026 — verificado en vivo)

- **Jest: 24 suites de test** en `helper-node/__tests__/` — unitarias (agentConfig, antiHallucination, conversation, leadProfile, rateLimiter, ragEngine, security, tenantContext, channels, kbRag, chatGroups, wibsite20) + agente (agentGraph, guards, checkpointer, commercialState, difyFallback, behavior) + integración/flujos (contract, contract-integrations, smoke, flow, integration, quoteFlow).
- **Pipeline de prevalidación en GitLab (rama `dev`, pipeline #58 SUCCESS)** — se ejecuta en cada push/MR:
  - `helper-tests` (unit, 83 tests) → **bloqueante** en dev y main.
  - `smoke-tests` (2 tests, flujo esencial) → **bloqueante**.
  - `flow-tests` (3 tests, flujos de negocio) → **bloqueante**.
  - `validate_tevs` (TeVS 14) → en `dev` informativo (`allow_failure: true`); en `main` gate estricto.
- **TeVS (SOAC): 14 tests** — catálogo: TEST-AGENT-001 (telemetría LLM), TEST-CHN-001 (multicanal), TEST-CORR-001 (correlación trace-logs), TEST-DATA-001 (traces), TEST-DEV-001/002/003 (error rate, presupuesto, alucinación), TEST-DR-001/002 (resiliencia collector, redundancia), TEST-MM-001 (degradación multimodal), TEST-OBS-001 (salud ES/Kibana), TEST-SEC-001/002 (auth, retención audit), TEST-UI-001 (evidencia E2E UI).
  - **10/14 pasan en CI** (los que validan ES/Kibana/helper en vivo).
  - **4 requieren entorno completo** (informativos en dev): TEST-DR-001/002 (2º nodo collector), TEST-SEC-001 (gateway SSO desde runner), TEST-UI-001 (evidencia E2E reciente con reporter SOAC).
- **E2E Playwright** (`e2e/specs/*.spec.js`, 13 specs + frontend specs) — **por alcance**: se ejecuta solo sobre las modificaciones del cambio (no suite completa por consumo de recursos). Reporter SOAC envía eventos `e2e_ui` a ES (alimenta TEST-UI-001).
- **Gate e2e-trace (F-46): 10/10** — `node scripts/verify/e2e-trace.js --key <HELPER_API_KEY>`.
- **Load tests (F-51)**: `scripts/load/k6-scenario.js` (k6) + `scripts/load/load-test-node.js` (simulador local; 8 conv p95 1177ms · 3.29 turnos/s).
- **Validación profunda SOAC (bajo demanda)**: cruce estado real ↔ telemetría ES (traces/logs/metrics) solo para modificaciones grandes o análisis de bugs — no en cada PR (optimización de recursos).

## Comandos recomendados

Desde la carpeta del helper:

- Ejecutar todos los tests:
  - npm test
- Ejecutar unitarios:
  - node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --forceExit --runTestsByPath __tests__/tenantContext.test.js
- Ejecutar integración:
  - node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --forceExit --runTestsByPath __tests__/integration.test.js
- Ejecutar cobertura:
  - npm run test:coverage

## Matriz de cobertura

| Área | Tipo | Estado |
|---|---|---|
| Tenant context | Unit | ✅ |
| Conversaciones | Unit / Integration | ✅ |
| Lead profile | Unit | ✅ |
| Agent config | Unit | ✅ |
| Security / prompt injection | Unit / Integration | ✅ |
| Rate limiter | Unit | ✅ |
| Campañas | Integration | ✅ |
| Dashboard | Integration | ✅ |
| Scoring | Integration | ✅ |
| Templates | Integration | ✅ |
| Opt-out | Integration | ✅ |
| Knowledge base | Unit / Integration | ✅ (RAG conectado al grafo, nodo kb) |
| Grafo agente (8 etapas) | Unit / Behavior | ✅ (agentGraph + behavior) |
| Cuestionarios + cotización | Unit / Behavior | ✅ (quoteFlow) |
| Multicanal (5 adapters) | Unit | ✅ (channels) |
| Multimodal (STT/visión/TTS) | Unit / Integration | ✅ (channels + mediaProcessor) |
| Flujos de negocio (lead→score→campaña) | Integration | ✅ (flow) |
| Grupos de chat (chat-groups) | Unit | ✅ (chatGroups) |
| Agent knowledge / registry | Unit / Integration | ✅ (agentKnowledge + agentRegistry) |
| Wibsite 2.0 consolidado (pipeline FAB) | Integration | ✅ (wibsite20) |
| Frontend Next.js (utilidades) | Unit | ✅ (`frontend/__tests__/`: format, logger) |

## Seguimiento

- Mantener esta guía actualizada cada vez que se añada un nuevo módulo o un nuevo flujo crítico.
- Si un test falla, registrar el tipo de fallo, el módulo afectado y la causa (infraestructura, entorno o regresión).
- Priorizar mantener verdes las suites que cubren el negocio principal: campañas, leads, scoring, conversaciones y seguridad.
- **Regla de contribución (obligatoria):** todo cambio que toque un módulo/flujo DEBE actualizar o añadir su test en la capa correspondiente (unit/integración/E2E por alcance/TeVS) y actualizar este índice. Ver checklist en `.gitlab/merge_request_templates/default.md`.
