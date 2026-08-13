# Contexto: n8n

## Propósito
n8n es el orquestador de flujos visual. Conecta Chatwoot, Dify, Twenty CRM y Meta WhatsApp API en pipelines automatizados.

## Configuración
- **Puerto**: 5679 (mapeado a 5678 interno)
- **Base de datos**: PostgreSQL, database `n8n`
- **Encryption key**: <N8N_ENCRYPTION_KEY de .env> (rotar antes de producción)
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

## Bug Conocido: Body Parser Roto en n8n 2.23.4
La REST API de n8n 2.23.4 tiene un bug en `body-parser.ts:78` que lanza `"Failed to parse request body"` en todos los endpoints REST con JSON body. El webhook endpoint (`POST /webhook/*`) SÍ procesa JSON correctamente.

**Workaround**: Usar la UI para operaciones con body. Login funciona con `application/x-www-form-urlencoded`.

## Estado Actual
- ✅ Servicio funcionando (puerto 5679, mapeado a 5678 interno)
- ✅ Login funcional con cookie auth (usar `emailOrLdapLoginId`, no `email`)
- ✅ Owner confirmado en BD (`admin@wibsite.com`)
- ✅ 3 workflows en BD con `active=true` (seteados vía SQL directo)
- ✅ Webhook endpoint `POST /webhook/*` procesa JSON correctamente
- ❌ API REST no puede activar/desactivar workflows (body parser bug)
- ❌ Credenciales en n8n: pendientes de configurar (Dify, Twenty, Meta)

## Workflows en BD (activos vía SQL)

| Nombre | ID | Webhook | Estado |
|--------|----|---------|--------|
| 01 - Inbound WhatsApp → Dify → Twenty CRM | `ktheIzGfXPHbZ9Rg` | `/webhook/chatwoot-inbound` | Activo en BD |
| 02 - Campaign Broadcast WhatsApp | `kW9O2RkkwrmiGEjC` | Schedule (cada 30 min) | Activo en BD |
| 03 - [Helper] Score & Sync | `tercer-id` | Manual/webhook | Activo en BD |

**Nota**: Están seteados como `active=true` en BD, pero al cargarse pueden quedar en estado "inactive" por el bug. Se requiere toggle manual desde UI.
