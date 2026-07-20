# PROCEDIMIENTOS — Operación y Mantenimiento

> Comandos y pasos esenciales para el día a día — Última actualización: 2026-07-18

---

## 1. Inicio y Detención

### Levantar todos los servicios
```bash
cd wibsite
docker compose up -d
```
> La primera vez toma 5-10 min descargando imágenes.

### Detener todos los servicios
```bash
docker compose down
```

### Detener y eliminar volúmenes (reset total)
```bash
docker compose down -v
```
> ⚠️ Elimina TODOS los datos. Usar solo para reset completo.

### Ver estado de servicios
```bash
docker compose ps
docker compose logs -f <servicio>  # Ver logs en tiempo real
```

---

## 2. Acceso a Servicios

| Servicio | URL | Credenciales |
|----------|-----|-------------|
| Chatwoot | http://localhost:3002 | admin@wibsite.com / Admin@123 |
| Dify Web | http://localhost:3003 | joserobertoquirogasalvador@gmail.com / Admin@123 |
| n8n | http://localhost:5679 | admin@wibsite.com / Admin@123 (campo login: `emailOrLdapLoginId`) |
| Twenty CRM | http://localhost:3001 | (requiere setup workspace post-reset) |
| Helper Node | http://localhost:3100 | — (API pública interna) |
| Nginx | http://localhost:8080 | Proxy unificado (rutas: /chatwoot/, /dify/, /n8n/, /crm/, /api/helper/) |

---

## 3. Configuración Inicial Post-Reset

### 3a. Generar secretos en `.env`
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # CHATWOOT_SECRET_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # DIFY_SECRET_KEY, N8N_ENCRYPTION_KEY, TWENTY_*_SECRET
```

### 3b. Inicializar servicios
```bash
docker compose up -d
```

### 3c. Twenty CRM — Setup manual
1. Abrir http://localhost:3001
2. Crear workspace (registro inicial)
3. Settings > API > Create API Key → copiar a `TWENTY_API_KEY` en `.env`
4. Recrear campos custom usando helper-node API

### 3d. Configurar n8n desde UI
1. Abrir http://localhost:5679
2. Login con admin@wibsite.com / Admin@123 (usar `emailOrLdapLoginId`)
3. Reimportar workflows desde `n8n/workflows/` si es necesario
4. Toggle manual de workflows a `active`
5. Settings > Environment → agregar: DIFY_API_KEY, CHATWOOT_API_KEY, TWENTY_API_KEY, META_API_VERSION, WHATSAPP_PHONE_NUMBER_ID, META_APP_ACCESS_TOKEN

### 3e. Configurar credenciales n8n (desde UI — workaround body parser bug)
- **Chatwoot**: HTTP Header Auth → Header: `api_access_token`, Value: CHATWOOT_API_KEY
- **Dify**: HTTP Header Auth → Header: `Authorization`, Value: `Bearer <DIFY_API_KEY>`
- **Twenty CRM**: HTTP Header Auth → Header: `Authorization`, Value: `Bearer <TWENTY_API_KEY>`
- **Meta Graph API**: OAuth2 o Header Auth con App Access Token

---

## 4. Conexión Meta WhatsApp API

### 4a. Requisitos
1. Cuenta en Facebook Developers
2. App tipo Business creada
3. Producto WhatsApp agregado
4. Número de WhatsApp Business verificado

### 4b. Variables a configurar en `.env`
```
META_APP_ID=<ID de la app>
META_APP_SECRET=<App Secret>
META_WEBHOOK_VERIFY_TOKEN=<token personalizado>
WHATSAPP_PHONE_NUMBER_ID=<ID del número>
WHATSAPP_BUSINESS_ACCOUNT_ID=<ID de la cuenta>
META_APP_ACCESS_TOKEN=<token generado>
```

### 4c. Webhook Meta → helper-node
```bash
# Desarrollo local con ngrok
ngrok http 3100
# Usar URL de ngrok como Callback URL en Meta Developers
# Verify token: el mismo de META_WEBHOOK_VERIFY_TOKEN
```

### 4d. Webhook Chatwoot → n8n
En Chatwoot: Settings > Integrations > Webhooks → añadir:
- URL: `http://n8n:5678/webhook/chatwoot-inbound`
- Eventos: conversation_created, message_created, conversation_status_changed

---

## 5. Verificación de Salud

### Script automático
```bash
cd wibsite/scripts
npm install
node init-wibsite.js
```

### Manual
```bash
# Health checks directos
curl http://localhost:3100/health
curl http://localhost:5679/healthz
curl http://localhost:3001/healthz

# Helper endpoints de verificación
curl http://localhost:3100/api/twenty/health
curl http://localhost:3100/api/dashboard/summary

# Dify — verificar workflow
curl -X POST http://localhost:5001/v1/workflows/run \
  -H "Authorization: Bearer app-IohwPPX3HDWA46TQLEcGBZq0" \
  -H "Content-Type: application/json" \
  -d '{"inputs":{"message":"Hola, quiero info sobre planes","conversation_history":"[]","contact_name":"Test","platform":"whatsapp"},"response_mode":"blocking","user":"test-verification"}'
```

---

## 6. Seed Data para Pruebas

```bash
# Poblar base de datos con datos de prueba
curl -X POST http://localhost:3100/api/seed

# Verificar datos
curl http://localhost:3100/api/dashboard/summary
curl http://localhost:3100/api/campaigns

# Limpiar datos de prueba
curl -X DELETE http://localhost:3100/api/seed
```

---

## 7. Backup y Recuperación

### Backup de PostgreSQL
```bash
docker exec wibsite-postgres pg_dump -U wibsite -d chatwoot > backups/chatwoot-$(date +%Y%m%d).dump
docker exec wibsite-postgres pg_dump -U wibsite -d dify > backups/dify-$(date +%Y%m%d).dump
docker exec wibsite-postgres pg_dump -U wibsite -d n8n > backups/n8n-$(date +%Y%m%d).dump
docker exec wibsite-postgres pg_dump -U wibsite -d twenty > backups/twenty-$(date +%Y%m%d).dump
docker exec wibsite-postgres pg_dump -U wibsite -d wibsite > backups/wibsite-$(date +%Y%m%d).dump
```

### Restore
```bash
cat backups/<archivo>.dump | docker exec -i wibsite-postgres psql -U wibsite -d <database>
```

---

## 8. Troubleshooting Común

| Problema | Causa | Solución |
|----------|-------|----------|
| Chatwoot no inicia | DB no lista | Esperar a que postgres esté healthy |
| Dify error 500 | Weaviate no conecta | `docker compose restart weaviate dify-api dify-worker` |
| n8n no importa workflows | Body parser bug | Usar UI para importar, no API REST |
| Twenty no arranca | Secretos inválidos | Regenerar TWENTY_*_SECRET con 32 bytes hex |
| n8n login falla | Usar `email` en vez de `emailOrLdapLoginId` | Usar campo `emailOrLdapLoginId` en body |
| Webhook no llega a n8n | Ruta incorrecta | Usar nombres Docker (n8n:5678), no localhost |
| Dify workflow falla | Modelo no disponible | Verificar OpenRouter API key y saldo |
| Helper usa JSON file store | PostgreSQL no responde | Verificar conexión BD y reiniciar helper |
| n8n workflows inactivos | Body parser bug impide activación vía API | Toggle manual desde UI |
