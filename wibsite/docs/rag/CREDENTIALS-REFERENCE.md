# Credentials Reference (RAG-optimized)

> Actualizado: 2026-08-12. ⚠️ **Los valores reales NO se documentan aquí** (redactados por seguridad; hallazgo AUDIT-CROSSCHECK). Fuente autorizada: `.env` (no commiteado). Nombres/instrucciones: `.env.example`.

## Dify
- Admin Email: joserobertoquirogasalvador@gmail.com
- Password: `<del .env>` (DIFY_ADMIN_PASSWORD)
- Console API: Cookie auth (access_token + csrf_token + X-CSRF-TOKEN header)
- Password format: Must be Base64 encoded in login request
- App API Key: `<del .env>` (DIFY_API_KEY)

## n8n
- Admin Email: admin@wibsite.com
- Password: `<del .env>`
- Login field: `emailOrLdapLoginId` (NOT `email`)
- Auth: Cookie `n8n-auth`
- Role: global:owner

## Chatwoot
- Admin Email: admin@wibsite.com
- Password: `<del .env>`
- API Key: `<del .env>` (CHATWOOT_API_KEY)
- Account ID: 1 (default)

## Twilio (canal real vigente)
- Account SID / Auth Token: `<del .env>` (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)
- Phone: `<del .env>` (TWILIO_PHONE_NUMBER)
- Sandbox: +14155238886

## xAI (DEPRECADO - sin créditos)
- Endpoint: https://api.x.ai/v1 — modelos grok-2/beta/4.5/3.5/3 probados sin éxito
- **Reemplazado por OpenRouter**

## Plugin Daemon Communication
- PLUGIN_DAEMON_KEY / PLUGIN_DIFY_INNER_API_KEY: `<del .env>`
- Auth header: `X-Api-Key` (NOT Bearer token)
- Used by: dify-api → plugin-daemon requests

## Meta / WhatsApp (EN PAUSA — reemplazado por Twilio)
- META_APP_ID / META_APP_SECRET / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_BUSINESS_ACCOUNT_ID: NOT SET
- Webhook Verify Token: `wibsite_verify_2026` (dev)

## Twenty CRM
- API Key: `<del .env>` (TWENTY_API_KEY, JWT ES256)
- URL: http://localhost:3001
- GraphQL Endpoint: POST /graphql

## Elastic Stack / Observabilidad
- Usuarios: `elastic` / `kibana_system`; passwords en `.env` (ELASTIC_PASSWORD, KIBANA_PASSWORD)
- Service token Kibana→ES: `<del .env>` (KIBANA_SERVICE_TOKEN)
- ⚠️ `otel-collector/config.yaml` contiene password hardcodeada — corregir en F-35

## Plugin Marketplace
- Marketplace URL: https://marketplace.dify.ai/api
- Plugin identifier format: `{org}/{name}:{version}@{hash}`
- Installed: langgenius/openai_api_compatible (v0.0.55)