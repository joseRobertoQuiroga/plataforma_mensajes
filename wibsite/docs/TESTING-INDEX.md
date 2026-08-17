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

- Unit tests: disponibles y ejecutables sobre módulos clave.
- Integration tests: ejecutables con éxito en el helper actual.
- End-to-end: se cubre de forma inicial con la suite de integración y se puede ampliar cuando los servicios externos estén disponibles.

## Estado actual (15/08/2026)

- **Jest: 22 suites · 176/176 PASS** — unitarias (security, conversation, leadProfile, agentConfig, ragEngine, antiHallucination, rateLimiter, tenantContext, channels, kbRag, quoteFlow, behavior) + agente (agentGraph, guards, checkpointer, commercialState, difyFallback) + integración (contract, contract-integrations, smoke, flow, integration).
- **TeVS (SOAC): 13/13 PASSED** — catálogo: TEST-AGENT-001 (telemetría LLM), TEST-CHN-001 (multicanal), TEST-CORR-001 (correlación trace-logs), TEST-DATA-001 (traces), TEST-DEV-001/002/003 (error rate, presupuesto, alucinación), TEST-DR-001/002 (resiliencia collector, redundancia), TEST-MM-001 (degradación multimodal), TEST-OBS-001 (salud ES/Kibana), TEST-SEC-001/002 (auth, retención audit). Runner: `scripts/tevs/tevs-runner.ps1 -TestFolder scripts/tevs/tests`.
- **Gate e2e-trace (F-46): 10/10** — `node scripts/verify/e2e-trace.js --key <HELPER_API_KEY>`.
- **Load tests (F-51)**: `scripts/load/k6-scenario.js` (k6) + `scripts/load/load-test-node.js` (simulador local; 8 conv p95 1177ms · 3.29 turnos/s).

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

## Seguimiento

- Mantener esta guía actualizada cada vez que se añada un nuevo módulo o un nuevo flujo crítico.
- Si un test falla, registrar el tipo de fallo, el módulo afectado y la causa (infraestructura, entorno o regresión).
- Priorizar mantener verdes las suites que cubren el negocio principal: campañas, leads, scoring, conversaciones y seguridad.
