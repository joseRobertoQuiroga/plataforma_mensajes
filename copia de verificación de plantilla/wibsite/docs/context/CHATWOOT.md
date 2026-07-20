# Contexto: Chatwoot

## Propósito
Chatwoot es el sistema de inbox omnicanal. Recibe mensajes de WhatsApp (y futuros canales: Messenger, TikTok) y los presenta a agentes humanos. También permite respuestas automatizadas vía API.

## Configuración Actual
- **Puerto**: 3002 (mapeado a 3000 interno)
- **Worker**: Sidekiq para tareas asíncronas
- **Base de datos**: PostgreSQL, database `chatwoot`
- **Admin**: admin@wibsite.com / Admin@123
- **API Key**: SpMUEqpey6UiCxKq7wnoECD6
- **Account ID**: 1 (valor por defecto)

## Endpoints Relevantes
- `POST /api/v1/accounts/{id}/webhooks` — Crear webhook
- `POST /api/v1/accounts/{id}/inboxes` — Crear inbox (WhatsApp)
- `POST /api/v1/accounts/{id}/conversations/{id}/messages` — Enviar mensaje
- `POST /auth/sign_in` — Login
- `POST /api/v1/profile/reset_access_token` — Regenerar API key

## Integraciones
- **Webhook → n8n**: `conversation_created`, `message_created`, `conversation_status_changed`
- **Inbox WhatsApp**: Pendiente de configuración (requiere META_APP_ID, WHATSAPP_PHONE_NUMBER_ID)
- **Helper**: Endpoint `/chatwoot/normalize` para normalizar payloads

## Estado Actual
- ✅ Servicio funcionando
- ✅ API key generada
- ❌ Webhook a n8n: pendiente (requiere account ID + Meta credenciales)
- ❌ Inbox WhatsApp: pendiente (requiere Meta app)
