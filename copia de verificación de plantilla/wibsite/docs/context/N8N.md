# Contexto: n8n

## Propósito
n8n es el orquestador de flujos visual. Conecta Chatwoot, Dify, Twenty CRM y Meta WhatsApp API en pipelines automatizados.

## Configuración
- **Puerto**: 5679 (mapeado a 5678 interno)
- **Base de datos**: PostgreSQL, database `n8n`
- **Encryption key**: 46b15d9b72bdd7353b7ddab49b8da0b0d5536a6ba8b7be3eb9f1c56e3352bed2
- **Webhook URL**: http://localhost:5679
- **Workflows montados en**: `/opt/n8n-workflows` (volumen desde `./n8n/workflows`)

## Autenticación
- **Campo login**: `emailOrLdapLoginId` (NO `email`)
- **Credenciales**: admin@wibsite.com / Admin@123
- **Rol**: global:owner (confirmado en BD)
- **Auth**: Cookie `n8n-auth` en responses exitosos

## Endpoints Relevantes
- `POST /rest/login` — Login (body: `{emailOrLdapLoginId, password}`)
- `POST /rest/workflows` — Importar workflow
- `GET /rest/workflows` — Listar workflows
- `POST /rest/credentials` — Crear credencial
- `GET /healthz` — Health check

## Workflows
### 01-inbound-message.json
- **Trigger**: Webhook de Chatwoot (message_created)
- **Flujo**: Recibir mensaje → Filtrar → Dify (clasificar) → Responder vía Chatwoot → Twenty CRM (crear/actualizar lead)
- **Dependencias**: Chatwoot API key, Dify API key, Twenty API key

### 02-campaign-broadcast.json
- **Trigger**: Schedule o manual
- **Flujo**: Obtener campañas pendientes → Obtener audiencia → Generar contenido → Enviar WhatsApp → Tracking
- **Dependencias**: Helper-node URL, Twenty API key, Meta WhatsApp API credentials

## Estado Actual
- ✅ Servicio funcionando
- ✅ Login funcional (cookie auth)
- ✅ Owner confirmado
- ❌ Workflows: pendientes de importar vía API REST
- ❌ Credenciales en n8n: pendientes de configurar
