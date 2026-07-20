# Environment Variables (RAG-optimized)

## Database
- `POSTGRES_USER=wibsite`
- `POSTGRES_PASSWORD=wibsite_pass`

## Chatwoot
- `CHATWOOT_PORT=3002`
- `CHATWOOT_FRONTEND_URL=http://localhost:3002`
- `CHATWOOT_SECRET_KEY=fb9a26f39...`
- `CHATWOOT_ADMIN_EMAIL=admin@wibsite.com`
- `CHATWOOT_ADMIN_PASSWORD=Admin@123`
- `CHATWOOT_API_KEY=SpMUEqpey6UiCxKq7wnoECD6`

## Dify
- `DIFY_API_PORT=5001`
- `DIFY_WEB_PORT=3003`
- `DIFY_ADMIN_PASSWORD=Admin@123`
- `DIFY_SECRET_KEY=dd9d0827e...`
- `DIFY_ADMIN_EMAIL=joserobertoquirogasalvador@gmail.com`
- `DIFY_API_KEY=app-IohwPPX3HDWA46TQLEcGBZq0`

## n8n
- `N8N_PORT=5679`
- `N8N_HOST=localhost`
- `N8N_WEBHOOK_URL=http://localhost:5679`
- `N8N_ENCRYPTION_KEY=46b15d9b7...`

## Twenty CRM
- `TWENTY_PORT=3001`
- `TWENTY_SERVER_URL=http://localhost:3001`
- `TWENTY_FRONTEND_URL=http://localhost:3001`
- `TWENTY_ACCESS_TOKEN_SECRET=2128ba02...`
- `TWENTY_LOGIN_TOKEN_SECRET=77708feb...`
- `TWENTY_REFRESH_TOKEN_SECRET=64f695da...`
- `TWENTY_FILE_TOKEN_SECRET=2e88580e...`
- `TWENTY_ENCRYPTION_KEY=3c5c3e44...`

## Plugin Daemon (shared secrets)
- `PLUGIN_DAEMON_KEY=lYkiYYT6owG+71oLerGzA7GXCgOT++6ovaezWAjpCjf+Sjc3ZtU+qUEi`
- `PLUGIN_DIFY_INNER_API_KEY=QaHbTe77CtuXmsfyhR7+vRjI/+XbV1AaFy691iy+kGDv2Jvy0/eAh8Y1`

## Meta / WhatsApp (PENDING)
- `META_APP_ID=` (empty)
- `META_APP_SECRET=` (empty)
- `META_API_VERSION=v21.0`
- `META_WEBHOOK_VERIFY_TOKEN=wibsite_verify_2026`
- `WHATSAPP_PHONE_NUMBER_ID=` (empty)
- `WHATSAPP_BUSINESS_ACCOUNT_ID=` (empty)

## Twenty CRM API
- `TWENTY_API_KEY=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjdlN2RjMj...` (JWT configurado)
- `TWENTY_API_URL=http://localhost:3001`

## Helper Node
- `HELPER_PORT=3100`
- Usa `TWENTY_API_KEY` y `TWENTY_API_URL` para sync con Twenty CRM
- Usa `POSTGRES_USER` y `POSTGRES_PASSWORD` para conexión a PostgreSQL (database `wibsite`)
- Dependencias npm: express, cors, pino, axios, pg, xlsx, multer

## OpenRouter (LLM provider — replaces xAI)
- `OPENROUTER_API_KEY=sk-or-v1-YOUR_OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `OPENROUTER_MODEL=openai/gpt-4o-mini` (default model, configurable)
- Usado por helper-node para scoring LLM y Dify via plugin openai_api_compatible

## xAI (DEPRECATED - no credits)
- API Key: xai-YOUR_XAI_API_KEY_HERE
- Endpoint: https://api.x.ai/v1
- **Reemplazado por OpenRouter** — mantener por si se recuperan créditos
