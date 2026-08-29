# Arquitectura Verificada

> Verificado en vivo 2026-08-28 (docker ps + APIs). El código es la verdad.

## 1. Stack (21 contenedores)

```
                     ┌─ gitlab-ce (:9080) + gitlab-runner
                     │
internet/nginx (:80/443/8080/3003)
   ├── wibsite-helper (:3100) ──────── PostgreSQL (5 bases) · Redis · Weaviate · MinIO
   │     ├── services/channels/       5 adapters (telegram, whatsapp/Twilio, messenger, email, tiktok)
   │     ├── services/agentCore/      grafo 9 nodos · guards · checkpointer · quoteEngine
   │     ├── services/ragEngine.js    Weaviate + fallback in-memory
   │     ├── middleware/              auth · rateLimiter · sanitizer · tenantContext · piiFilter
   │     └── services/otelBridge.js   OTLP → Elasticsearch
   ├── wibsite-n8n (:5679)            workflows inbound + broadcast + score&sync
   ├── wibsite-dify (:5001/3000/5002) workflow clasificador · OpenRouter
   ├── wibsite-chatwoot               inbox + bridge Twilio
   ├── wibsite-authelia (:9091)       SSO auth_request
   ├── wibsite-frontend (:4000)       Next.js
   └── elasticsearch (:9200) ← kibana (:5601) ← otel-collector (:4317/4318)
```

## 2. Flujos verificados

### Inbound (Twilio/Telegram → IA)
```
Canal → /api/webhooks/* (HMAC/verify) → conversationStore → agentCore (grafo 9 nodos)
→ RAG/LLM (Dify → fallback OpenRouter) → respuesta + auditLogger (PG + OTLP→ES)
→ sync Twenty CRM (10 campos custom)
```
Evidencia: webhook Telegram simulado 15/08 (lead + grafo + LLM real + auditoría PG/ES); pipeline multicanal 15/08.

### Campaign/Broadcast
```
POST /api/channels/broadcast → por canal (adapter) → tracking (entregado/leído/respondido) → opt-out
```
Evidencia: dashboard 10 campañas, 24 entregas, 27 leads (28/08).

### Observabilidad
```
helper (OTLP logs) → otel-collector → ES datastreams traces/metrics/logs → Kibana (ILM 1d/30d)
```

## 3. Persistencia (decisión ADR-003)

- PostgreSQL primario (dual-write con JSON store como fallback; cutover flag `STORE_MODE=pg` pendiente).
- Redis: estado de conversación (TTL) + colas.
- Weaviate: vectores RAG.
- MinIO: objetos/media.
- JSON store: fallback (contiene PII → riesgo T2).

## 4. Redes y puertos

- Red interna `wibsite_default` (nombres de contenedor); gateway nginx como único punto de entrada externo.
- GitLab comparte red para jobs CI (runner corre jobs que alcanzan elasticsearch:9200, helper:3100, nginx:443).

## 5. Frontend

- `wibsite-frontend` Next.js (:4000) — módulos dashboard/chat/campaigns/leads/pipeline/reports/settings/templates/automation.
- Portal legacy (hub/control-center) servido por nginx — convivencia en transición.