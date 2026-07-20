# Wibsite Business — Guía de Configuración Fase 1

## Prerrequisitos

- Docker Desktop (Windows) o Docker Engine + Compose
- Node.js 20+ (para scripts de init)
- Cuenta de Facebook Developer (para WhatsApp API)
- Git

## Paso 1: Configurar variables de entorno

```bash
cd wibsite
cp .env.example .env
```

Editar `.env` y generar los secretos:

```bash
# En Windows PowerShell:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Completar en `.env`:
- `CHATWOOT_SECRET_KEY` — con el hash de 64 bytes
- `DIFY_SECRET_KEY` — con el hash de 32 bytes
- `N8N_ENCRYPTION_KEY` — con el hash de 32 bytes
- `TWENTY_ACCESS_TOKEN_SECRET`, `TWENTY_LOGIN_TOKEN_SECRET`,
  `TWENTY_REFRESH_TOKEN_SECRET`, `TWENTY_FILE_TOKEN_SECRET` — hashes de 32 bytes

## Paso 2: Iniciar servicios

```bash
docker compose up -d
```

Esto levanta todos los servicios. La primera vez puede tomar 5-10 minutos
porque descarga las imágenes.

Verificar que todos los servicios estén corriendo:
```bash
docker compose ps
```

## Paso 3: Configurar cada servicio

### 3a. Chatwoot

1. Abrir http://localhost:3002
2. Completar el wizard de registro (usar el email de `CHATWOOT_ADMIN_EMAIL`)
3. Ir a Settings > Profile > Access Token — generar un token y copiarlo a `CHATWOOT_API_KEY` en `.env`
4. Ir a Settings > Inboxes > Add Inbox > WhatsApp Business
5. Configurar con las credenciales de Meta (App ID, App Secret, Phone Number ID)
6. Ir a Settings > Integrations > Webhooks — añadir webhook apuntando a `http://n8n:5678/webhook/chatwoot-inbound`
   - Suscribirse a: `conversation_created`, `message_created`, `conversation_status_changed`

### 3b. Dify

1. Abrir http://localhost:3003
2. Completar el wizard de inicialización (email: admin@wibsite.com, contraseña: la de `DIFY_ADMIN_PASSWORD`)
3. Ir a Workflows > Import — importar el archivo `dify/workflows/whatsapp-lead-classifier.yml`
4. Publicar el workflow
5. Ir a API Access — crear API Key y copiarla a `DIFY_API_KEY` en `.env`

### 3c. Twenty CRM

1. Abrir http://localhost:3001
2. Crear workspace (registro inicial)
3. Ir a Settings > API > Create API Key — copiarla a `TWENTY_API_KEY` en `.env`
4. Opcional: crear campos personalizados para scoring (intentScore, leadStatus, buyingStage, priority, aiSummary)

### 3d. n8n

1. Abrir http://localhost:5678
2. Crear cuenta de usuario
3. Ir a Workflows > Add > Import from File — importar cada archivo de `n8n/workflows/`
4. Para cada workflow, crear las credenciales necesarias:
   - **Chatwoot API**: HTTP Header Auth → Header: `api_access_token`, Value: CHATWOOT_API_KEY
   - **Dify API**: HTTP Header Auth → Header: `Authorization`, Value: `Bearer <DIFY_API_KEY>`
   - **Twenty CRM**: HTTP Header Auth → Header: `Authorization`, Value: `Bearer <TWENTY_API_KEY>`
   - **Meta Graph API**: OAuth2 o Header Auth con App Access Token
5. Ir a Settings > Environment — añadir:
   - `DIFY_API_KEY`
   - `CHATWOOT_API_KEY`
   - `TWENTY_API_KEY`
   - `META_API_VERSION` (v21.0)
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `META_APP_ACCESS_TOKEN`
6. Activar los workflows

### 3e. Helper Node

Reiniciar el helper después de configurar las API keys:
```bash
docker compose restart helper
```

## Paso 4: Configurar WhatsApp Business API

1. Ir a https://developers.facebook.com
2. Crear una App tipo Business
3. Añadir producto WhatsApp
4. Configurar webhook:
   - Callback URL: `http://<TU_IP_PUBLICA>:3100/webhooks/whatsapp` (o usa ngrok para desarrollo)
   - Verify Token: el mismo de `META_WEBHOOK_VERIFY_TOKEN`
5. Obtener Phone Number ID y Business Account ID
6. Completar en `.env`: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
   `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`
7. Generar App Access Token desde el dashboard de Meta
8. Añadir `META_APP_ACCESS_TOKEN` a las variables de entorno de n8n

> **Nota para desarrollo local**: Usa ngrok para exponer el helper-node:
> ```bash
> ngrok http 3100
> ```
> Luego usa la URL de ngrok como callback URL en Meta Developers.

## Paso 5: Verificar

```bash
# Instalar dependencias del script de init
cd scripts && npm install

# Ejecutar verificación
node init-wibsite.js
```

O manualmente:
```bash
# Verificar que todos los servicios responden
curl http://localhost:80/health
curl http://localhost:3002/health
curl http://localhost:3003
curl http://localhost:5678/healthz
curl http://localhost:3001/healthz
curl http://localhost:3100/health
```

## Probar el flujo completo

### Inbound (recibir y clasificar)

1. Enviar un mensaje al número de WhatsApp configurado
2. El mensaje aparece en Chatwoot
3. n8n procesa → Dify clasifica → Twenty CRM crea el lead
4. Verificar en Chatwoot que hay una respuesta automática
5. Verificar en Twenty CRM que el lead fue creado con score y clasificación

### Campaña (enviar)

1. Crear una campaña via helper API:
   ```bash
   curl -X POST http://localhost:3100/campaigns \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Oferta Julio",
       "message": "Hola {{name}}, tenemos una oferta especial para {{company}}...",
       "template_name": "campaign_generic",
       "scheduled_at": "2026-07-10T10:00:00Z"
     }'
   ```
2. Programar la campaña:
   ```bash
   curl -X POST http://localhost:3100/campaigns/<ID>/schedule \
     -H "Content-Type: application/json" \
     -d '{"scheduled_at": "2026-07-10T10:00:00Z"}'
   ```
3. n8n recoge la campaña y la envía
4. Monitorear estadísticas:
   ```bash
   curl http://localhost:3100/campaigns/<ID>/stats
   ```

## Resolución de Problemas

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| Chatwoot no inicia | DB no lista | Esperar a que postgres esté healthy |
| Dify da error 500 | Weaviate no conecta | `docker compose restart weaviate dify-api dify-worker` |
| n8n no importa workflows | Formato JSON inválido | Validar con `n8n import:workflow --input=file.json` |
| Twenty no arranca | Secretos inválidos | Regenerar TWENTY_*_SECRET con 32 bytes hex |
| WhatsApp no conecta | Meta App no configurada | Seguir Paso 4 detalladamente |
| Webhook no llega a n8n | n8n no accesible desde Chatwoot | Usar redes de Docker (n8n:5678) no localhost |
| Dify workflow no publica | Faltan modelos API | Configurar proveedor LLM en Dify > Settings > Model Provider |

## Arquitectura de Puertos

| Servicio | Interno | Externo | Notas |
|----------|---------|---------|-------|
| Chatwoot | 3000 | 3002 | |
| Dify Web | 3000 | 3003 | |
| Dify API | 5001 | 5001 | |
| n8n | 5678 | 5678 | |
| Twenty CRM | 3000 | 3001 | |
| Helper Node | 3100 | 3100 | |
| Nginx | 80 | 80 | Proxy unificado |
| PostgreSQL | 5432 | — | Solo interno |
| Redis | 6379 | — | Solo interno |
| Weaviate | 8080 | — | Solo interno |
