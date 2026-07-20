# Credentials Reference (RAG-optimized)

## Dify
- Admin Email: joserobertoquirogasalvador@gmail.com
- Admin Password: Admin@123
- Console API: Cookie auth (access_token + csrf_token + X-CSRF-TOKEN header)
- Password format: Must be Base64 encoded in login request
- App API Key: app-IohwPPX3HDWA46TQLEcGBZq0

## n8n
- Admin Email: admin@wibsite.com
- Password: Admin@123
- Login field: `emailOrLdapLoginId` (NOT `email`)
- Auth: Cookie `n8n-auth`
- Role: global:owner

## Chatwoot
- Admin Email: admin@wibsite.com
- Password: Admin@123
- API Key: SpMUEqpey6UiCxKq7wnoECD6
- Account ID: 1 (default)

## xAI
- API Key: xai-YOUR_XAI_API_KEY_HERE
- Endpoint: https://api.x.ai/v1
- Models tried: grok-2, grok-beta, grok-4.5, grok-3.5, grok-3 (all failed - no credits)
- Error: 403 "no credits" (newer models), 400 "model not found" (deprecated models)

## Plugin Daemon Communication
- PLUGIN_DAEMON_KEY: Shared secret between Dify API and plugin-daemon
- INNER_API_KEY_FOR_PLUGIN: Shared secret for internal Dify↔plugin communication
- Auth header: `X-Api-Key` (NOT Bearer token)
- Used by: dify-api → plugin-daemon requests

## Meta / WhatsApp (PENDING)
- META_APP_ID: NOT SET
- META_APP_SECRET: NOT SET
- WHATSAPP_PHONE_NUMBER_ID: NOT SET
- WHATSAPP_BUSINESS_ACCOUNT_ID: NOT SET
- Webhook Verify Token: wibsite_verify_2026

## Twenty CRM
- API Key: eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjdlN2RjMjVmLTc0NTItNDJjNi04M2IyLTQ1YTI4ZDc5YjZiMCJ9... (JWT, expira 4937185895)
- URL: http://localhost:3001
- GraphQL Endpoint: POST /graphql

## Plugin Marketplace
- Marketplace URL: https://marketplace.dify.ai/api
- Plugin identifier format: `{org}/{name}:{version}@{hash}`
- Example: `langgenius/openai_api_compatible:0.0.55@d64be9924f2edf13fd5329fc03fdfc0d0e0e36e0aef5321c4942f0845de8c030`
- Installed: langgenius/openai_api_compatible (v0.0.55)
