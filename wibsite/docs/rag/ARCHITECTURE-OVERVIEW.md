# Architecture Overview (RAG-optimized)

> Actualizado: 2026-08-12 — 20 servicios en docker-compose (ver TEC-01).

## Stack Components
- Chatwoot: Inbox omnicanal (WhatsApp, Messenger, TikTok), puerto 3002
- Dify 1.15.x: Orquestación IA (workflows, agents, RAG), puerto 5001 (API) / 3003 (Web)
- n8n: Orquestador de flujos visual, puerto 5679
- Twenty CRM: Gestión de leads y contactos, puerto 3001
- Helper Node: Lógica de campañas, tracking y bridge Twilio, puerto 3100
- Plugin Daemon: Gestión de plugins de modelos (marketplace), puerto 5002
- PostgreSQL: Base de datos compartida (chatwoot, dify, n8n, twenty, wibsite)
- Redis: Cache/queue compartido
- Weaviate: Vector store para RAG en Dify y helper
- Elasticsearch: Trazas y logs OTLP, puerto 9200
- Kibana: UI observabilidad, puerto 5601
- OTel Collector: Recepción OTLP (4317 gRPC / 4318 HTTP) → export ES
- MinIO: Object storage, puertos 9000 (API) / 9001 (consola)
- Authelia: SSO de borde (nginx auth_request)
- Nginx: Reverse proxy unificado, puerto 8080

## Service URLs (internal Docker network)
- dify-api: http://dify-api:5001
- dify-web: http://dify-web:3000
- n8n: http://n8n:5678
- chatwoot: http://chatwoot:3000
- twenty-server: http://twenty-server:3000
- helper: http://helper:3100
- plugin-daemon: http://plugin-daemon:5002
- elasticsearch: http://elasticsearch:9200
- otel-collector: http://otel-collector:4318 (OTLP HTTP)
- postgres: postgres:5432
- redis: redis:6379
- weaviate: http://weaviate:8080

## External URLs (via Nginx :8080, SSO detrás de Authelia)
- Dify Web: http://localhost:8080/dify/ (y :3003)
- Chatwoot: http://localhost:8080/chatwoot/
- n8n: http://localhost:8080/n8n/
- Twenty CRM: http://localhost:8080/crm/
- Kibana: http://localhost:8080/kibana/ (y :5601)
- MinIO Consola: http://localhost:8080/minio-console/ (y :9001)
- Helper API: http://localhost:8080/api/helper/
- Portal de control (hub): http://localhost:8080/hub/

## Data Flow: Inbound Message (Twilio — canal real vigente)
WhatsApp → Twilio → helper `POST /webhooks/whatsapp` → lead+delivery en store → forward n8n `/webhook/chatwoot-inbound` → Dify Workflow (clasificación) → respuesta vía Twilio / escalado → upsert Twenty CRM. (F-05, TEC-06)

## Data Flow: Campaign Broadcast (Twilio)
n8n Schedule → helper `GET /campaigns/pending` → audiencia Twenty → contenido Dify → helper `POST /api/twilio/send` con StatusCallback → delivery tracking → `POST /campaigns/track`. (F-06, TEC-06)

## Data Flow: Telemetría (OTel → Elasticsearch)
helper/n8n/Dify → OTLP (4317/4318) → otel-collector → export a elasticsearch:9200 → índices `*-doags.otel-production` → visualización en Kibana. (F-36/F-38, TEC-06)

## Key Credentials
> ⚠️ Los valores reales NO se documentan aquí (gaps de seguridad registrados en TEC-01 §5). Fuente autorizada: `.env` (no commiteado) y `.env.example` (nombres + instrucciones de generación).
- Dify admin: joserobertoquirogasalvador@gmail.com (password: `.env`)
- n8n admin: admin@wibsite.com
- Chatwoot admin: admin@wibsite.com
- Todas las API keys: ver `.env` (DIFY_API_KEY, CHATWOOT_API_KEY, PLUGIN_DAEMON_KEY, PLUGIN_DIFY_INNER_API_KEY, TWENTY_API_KEY, etc.)