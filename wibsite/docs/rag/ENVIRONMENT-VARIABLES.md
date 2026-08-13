# Environment Variables (RAG-optimized)

> Actualizado: 2026-08-12. Los valores reales viven SOLO en `.env` (no commiteado). Esta referencia documenta nombres y cómo generarlos. Template completo: `.env.example`.

## Database
- `POSTGRES_USER=wibsite`
- `POSTGRES_PASSWORD=wibsite_pass` (⚠️ default de desarrollo — generar real en prod)

## Chatwoot
- `CHATWOOT_PORT=3002`
- `CHATWOOT_FRONTEND_URL=http://localhost:3002`
- `CHATWOOT_SECRET_KEY=<generar: openssl rand -hex 64>`
- `CHATWOOT_ADMIN_EMAIL=admin@wibsite.com`
- `CHATWOOT_API_KEY=<valor del .env>`

## Dify
- `DIFY_API_PORT=5001`
- `DIFY_WEB_PORT=3003`
- `DIFY_ADMIN_PASSWORD=<valor del .env>`
- `DIFY_SECRET_KEY=<generar: openssl rand -hex 32>`
- `DIFY_ADMIN_EMAIL=joserobertoquirogasalvador@gmail.com`
- `DIFY_API_KEY=<valor del .env>`
- `PLUGIN_DAEMON_KEY=<generar: openssl rand -hex 32>`
- `PLUGIN_DIFY_INNER_API_KEY=<generar: openssl rand -hex 32>`

## n8n
- `N8N_PORT=5679` (⚠️ ajustado al compose; docs previas decían 5678)
- `N8N_HOST=localhost`
- `N8N_WEBHOOK_URL=http://localhost:5679`
- `N8N_ENCRYPTION_KEY=<generar: openssl rand -hex 32>`

## Twenty CRM
- `TWENTY_PORT=3001`
- `TWENTY_SERVER_URL=http://localhost:3001`
- `TWENTY_FRONTEND_URL=http://localhost:3001`
- `TWENTY_ACCESS_TOKEN_SECRET` / `TWENTY_LOGIN_TOKEN_SECRET` / `TWENTY_REFRESH_TOKEN_SECRET` / `TWENTY_FILE_TOKEN_SECRET` / `TWENTY_ENCRYPTION_KEY` = `<generar: openssl rand -hex 32>`

## Twilio (canal real vigente — reemplaza Meta)
- `TWILIO_ACCOUNT_SID=<del .env>`
- `TWILIO_AUTH_TOKEN=<del .env>`
- `TWILIO_PHONE_NUMBER=<del .env>`
- `TWILIO_SANDBOX_NUMBER=+14155238886`

## Twenty CRM API
- `TWENTY_API_KEY=<JWT ES256 de .env>` (NUNCA documentar el token)
- `TWENTY_API_URL=http://localhost:3001`

## Helper Node
- `HELPER_PORT=3100`
- `HELPER_API_KEY=<generar: openssl rand -hex 32>`
- `STORE_MODE=dual` (JSON + PG; cutover PG = F-09)
- `REDIS_URL=redis://redis:6379` · `WEAVIATE_URL=http://weaviate:8080`
- Dependencias npm: express, cors, pino, axios, pg, xlsx, multer, prom-client

## OpenRouter (LLM provider — reemplaza xAI)
- `OPENROUTER_API_KEY=sk-or-v1-<del .env>`
- `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `OPENROUTER_MODEL=openai/gpt-4o-mini` (default model, configurable)
- Usado por helper-node para scoring LLM y Dify via plugin openai_api_compatible (7 modelos)

## Stack Elástico / Observabilidad
- `STACK_VERSION=9.4.2`
- `ELASTIC_PASSWORD=<generar: openssl rand -hex 32>`
- `KIBANA_PASSWORD=<generar: openssl rand -hex 32>`
- `ES_JAVA_OPTS=-Xms1g -Xmx1g`
- `ELASTICSEARCH_HOST=elasticsearch`
- `ELASTIC_OTLP_ENDPOINT=http://otel-collector:4318`
- `KIBANA_SERVICE_TOKEN=<generar: openssl rand -hex 32>`
- `ELASTIC_OTEL_API_KEY=<generar: openssl rand -hex 32>`
- `KIBANA_ENCRYPTION_KEY=<generar: openssl rand -hex 32>`
- ⚠️ `otel-collector/config.yaml` usa password hardcodeada — corregir en F-35 (gap conocido)

## MinIO
- `MINIO_ROOT_USER=minioadmin` · `MINIO_ROOT_PASSWORD=<generar: openssl rand -hex 32>`

## Authelia SSO
- `AUTHELIA_JWT_SECRET` / `AUTHELIA_SESSION_SECRET` = `<generar: openssl rand -hex 64>`
- `AUTHELIA_STORAGE_ENCRYPTION_KEY=<generar: openssl rand -hex 32>`
- `AUTHELIA_ADMIN_EMAIL=admin@wibsite.com`

## Meta / WhatsApp (EN PAUSA — reemplazado por Twilio)
- `META_APP_ID=` (empty) · `META_APP_SECRET=` (empty) · `META_API_VERSION=v21.0`
- `META_WEBHOOK_VERIFY_TOKEN=wibsite_verify_2026` · `WHATSAPP_PHONE_NUMBER_ID=` (empty) · `WHATSAPP_BUSINESS_ACCOUNT_ID=` (empty)

## xAI (DEPRECATED - no credits)
- Endpoint: https://api.x.ai/v1 — **reemplazado por OpenRouter**

> Nota de seguridad (hallazgo de auditoría): esta referencia contenía claves reales en texto plano; fueron redactadas el 2026-08-12. Cualquier valor real nuevo debe ir solo al `.env`.