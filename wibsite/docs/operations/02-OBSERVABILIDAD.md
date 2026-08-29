# Observabilidad (verificado 2026-08-28)

## 1. Stack

- Elasticsearch 9.x (`:9200`, cluster yellow single-node) + Kibana (`:5601`) + OTel Collector (`:4317/:4318`).
- Datastreams: `traces-*`, `metrics-*`, `logs-*` con ILM rollover 1d / delete 30d.
- Helper emite logs vía puente OTLP (`services/otelBridge.js`) + auditoría (24 event types, PII filter).
- TeVS escribe resultados en `tevs-results-*`.

## 2. Evidencia verificada

- Contenedores ES/Kibana/OTel Up (28/08).
- ES health: status=yellow, 1 node (normal single-node; réplicas por decidir — #V9).
- Correlación: `request_id`, `conversation_id`, `agent_id`, `deployment_version`, `service`, `timestamp`.

## 3. Alertas

- Endpoint `/api/internal/alerts` operativo (hub). Reglas Kibana por crear (#P5).

## 4. KPI operativos (documentados)

| Métrica | Umbral |
|---------|--------|
| Error rate | TeVS DEV-001 valida umbral |
| Latencia LLM | budget DIFY_BUDGET_MS=6000 (fallback circuit breaker) |
| Presupuesto LLM | TeVS DEV-002 |
| Hallucination score | TeVS DEV-003 |

## 5. Notas

- Elastic **no es fuente de verdad del proyecto** (ADR-001): es observabilidad.
- T3: revisar password en `otel-collector/config.yaml`.