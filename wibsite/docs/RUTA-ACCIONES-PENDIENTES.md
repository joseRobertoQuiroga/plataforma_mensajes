# Ruta de Acciones Pendientes — Estado Actual del Proyecto

## Lo que YA está funcionando

- ✅ **Dify Workflow "WhatsApp Lead Classifier"**: 100% funcional vía API con 8 nodos LLM (Code nodes reemplazados). Clasifica leads en hot/warm/cold con intent_label, score, datos extraídos y respuesta sugerida.
- ✅ **Helper API**: Todos los endpoints operativos (campañas, scoring, templates, channels, webhook WhatsApp mock, Twenty CRM sync, LLM chat).
- ✅ **Dashboard SPA**: Monitoreo en tiempo real con tabs, LEDs, botones de acción.
- ✅ **LLM via OpenRouter**: `openai/gpt-4o-mini` configurado y respondiendo.
- ✅ **Scoring rule-based**: 25 leads evaluados (24 hot, 1 cold).
- ✅ **Twenty CRM**: Conectado con API key, 10 campos custom creados.
- ✅ **Dify Sandbox**: Corriendo en puerto 8194, conectado a dify-api.
- ✅ **Seed data**: 3 campañas, 25 leads, 27 deliveries cargados.

---

## Tarea 1: Activar Workflows n8n desde UI

El bug del body parser en n8n 2.23.4 impide activar workflows vía REST API. La solución es activarlos manualmente desde la UI.

### Paso a Paso

1. **Abrir n8n** en `http://localhost:5679`
2. **Login** con `admin@wibsite.com` / `Wibsite2024!`
3. Ir al menú **Workflows**
4. **Abrir cada workflow** y verificar:
   - **"01 - Inbound WhatsApp → Dify → Twenty CRM"** (ID: `ktheIzGfXPHbZ9Rg`)
     - Nodo **Webhook**: verificar ruta `/webhook/chatwoot-inbound` y `POST`
     - Nodo **HTTP Request (Dify)**: URL debe ser `http://dify-api:5001/v1/workflows/run`
     - Nodo **HTTP Request (Twenty)**: URL debe ser `http://twenty-server:3000/rest/people`
     - Nodo **Set/Response**: verificar formato de respuesta
     - Click **Save** (Ctrl+S)
     - Toggle **Active** (esquina superior derecha, debe ponerse verde)
   - **"02 - Campaign Broadcast WhatsApp"** (ID: `kW9O2RkkwrmiGEjC`)
     - Verificar nodos Schedule/Webhook
     - Verificar que apunte a `http://helper:3100/campaigns/pending`
     - Click **Save** → **Active**
   - **"03 - [Helper] Score & Sync"** (ID: por verificar)
     - Click **Save** → **Active**

5. **Verificar**:
   - Los 3 workflows deben mostrar indicador verde "Active"
   - Ir a **Executions** → debe empezar a mostrar ejecuciones
   - Test webhook: `curl -X POST http://localhost:5679/webhook/chatwoot-inbound -H "Content-Type: application/json" -d '{"message_type":"incoming","content":"test"}'`

### Si los workflows no aparecen
Importar desde archivos en `wibsite/n8n/workflows/`:
- Desde UI: Workflows → tres puntos → Import from File → seleccionar `.json`

---

## Tarea 2: Registrar Webhook en Meta Developers

Necesario para que WhatsApp envíe mensajes reales al helper/node.

### Requisitos
- META_APP_ID: `1694506861827055` (ya en `.env`)
- META_APP_ACCESS_TOKEN: token temporal (ya en `.env`, expira cada ~6h)
- WHATSAPP_PHONE_NUMBER_ID: `1287367854450926` (ya en `.env`)

### Paso a Paso

1. **Ir a** `https://developers.facebook.com/apps/1694506861827055/webhooks/`
2. **WhatsApp** → **Configure**
3. **Callback URL**: `https://TU-DOMINIO-PUBLICO/webhooks/whatsapp`
   - Si no tienes dominio público, usa ngrok:
     ```bash
     # Instalar ngrok: https://ngrok.com/download
     ngrok http 3100
     # Usar la URL generada (ej: https://abc123.ngrok-free.app)
     ```
4. **Verify Token**: `wibsite_verify_2026`
5. **Campos a suscribir**: `messages`, `message_deliveries`, `message_reads`
6. Click **Verify and Save**
7. En **Webhook fields**, click **Manage** → suscribir: `messages`, `message_deliveries`

### Verificar
```bash
# Después de configurar, Meta hará GET con hub.mode, hub.verify_token, hub.challenge
# Debe responder 200 con el challenge
curl -s "http://localhost:3100/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=CHALLENGE_123"
# Debe retornar: CHALLENGE_123
```

---

## Tarea 3: Obtener Token Permanente de Meta

Los tokens USER token de Meta expiran cada ~6h. Para producción se necesita un **System User Token** permanente.

### Paso a Paso

1. **Ir a** `https://business.facebook.com/settings/system-users`
2. **Agregar System User** si no existe:
   - Nombre: `Wibsite WhatsApp Bot`
   - Rol: `Admin`
3. **Asignar permisos** al System User:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
   - `business_management`
4. **Generar token**:
   - Seleccionar System User → Generate New Token
   - Seleccionar la app `Wibsite Platform`
   - Expiración: `Never` (permanente)
5. **Copiar token** a `.env` como `META_APP_ACCESS_TOKEN`
6. **Reconstruir helper** si es necesario:
   ```bash
   docker compose up -d helper
   ```

### Verificar
```bash
# Test que el token funciona con Meta Graph API
curl -s "https://graph.facebook.com/v21.0/1287367854450926/messages?access_token=TOKEN_AQUI"
# Debe retornar información del phone number
```

---

## Tarea 4: Configurar Inbox WhatsApp en Chatwoot

Para que los mensajes de WhatsApp aparezcan en Chatwoot y sean manejados por agentes humanos.

### Paso a Paso

1. **Abrir Chatwoot** en `http://localhost:3002`
2. **Login** con `admin@wibsite.com` / `Admin@123`
3. Ir a **Settings** → **Inboxes** → **Add Inbox**
4. **Seleccionar WhatsApp** (o WhatsApp Cloud API)
5. **Ingresar credenciales**:
   - Phone Number ID: `1287367854450926`
   - Business Account ID: `1024953670257131`
   - API Key: el token permanente (Tarea 3)
6. **Asignar** a un agente (admin@wibsite.com)
7. **Configurar webhook** en Chatwoot:
   - Settings → Integrations → Webhook
   - URL: `http://n8n:5678/webhook/chatwoot-inbound`
   - Eventos: `message_created`, `conversation_created`
8. **Verificar** que el inbox muestra "Connected"

### Verificar flujo completo
```bash
# Enviar mensaje simulado desde Meta Test App
# Debería: llegar a Chatwoot → disparar webhook n8n → n8n llama a Dify → Dify clasifica → n8n responde
```

---

## Tarea 5: Corregir Twenty CRM Sync (Normalización de Teléfono)

Actualmente el sync a Twenty falla con 400 por formato de teléfono. El helper normaliza a `+` pero algunos leads no tienen teléfono o tienen formato inválido.

### Diagnóstico
```bash
curl -s http://localhost:3100/api/twenty/sync-all -X POST | python -c "
import sys, json
d = json.load(sys.stdin)
print(f'Synced: {d[\"synced\"]}, Errors: {d[\"errors\"]}')
for err in d.get('details', [])[:5]:
    print(f'  Lead {err[\"id\"][:8]}... : {err[\"error\"][:80]}')
"
```

### Causas comunes
1. Teléfono sin prefijo `+` → el helper normaliza, pero si el teléfono está vacío no puede normalizar
2. Lead ya existe en Twenty → el lookup por teléfono falla si el teléfono no coincide exactamente
3. Twenty no tiene el campo custom esperado → error de schema

### Solución
- Verificar que todos los leads tengan teléfono con prefijo `+`
- Si un lead no tiene teléfono, el sync debe omitir el campo phones
- Verificar que los campos custom en Twenty coincidan con lo que el helper envía

### Verificar después de corregir
```bash
curl -s http://localhost:3100/api/twenty/sync-all -X POST | python -c "
import sys, json
d = json.load(sys.stdin)
print(f'Synced: {d[\"synced\"]}/{d[\"total\"]}, Errores: {d[\"errors\"]}')
"
# Debe mostrar "Synced: 25/25, Errores: 0"
```

---

## Tarea 6: Verificar Flujo Completo Integrado

Después de completar las tareas 1-5:

### Prueba 1: Webhook WhatsApp → Lead en helper
```bash
curl -s -X POST http://localhost:3100/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "object":"whatsapp_business_account",
    "entry":[{"id":"1024953670257131","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"+591 75210458","phone_number_id":"1287367854450926"},"contacts":[{"profile":{"name":"María García"},"wa_id":"59175488354"}],"messages":[{"from":"59175488354","id":"wamid.test","timestamp":"1234567890","text":{"body":"Hola, quiero información de sus servicios"},"type":"text"}]},"field":"messages"}]}]
'
# Response esperado: "OK"
```

### Prueba 2: Lead → Scoring
```bash
# Ver que el lead se creó
curl -s http://localhost:3100/api/leads/top?limit=5 | python -c "import sys,json; d=json.load(sys.stdin); [print(l['name'],l['score'],l['status']) for l in d[:5]]"
```

### Prueba 3: Lead → Twenty CRM
```bash
curl -s http://localhost:3100/api/twenty/sync-all -X POST
# Debe mostrar synced=25, errors=0
```

### Prueba 4: Dify Workflow (IA)
```bash
curl -s -X POST http://localhost:5001/v1/workflows/run \
  -H "Authorization: Bearer app-IohwPPX3HDWA46TQLEcGBZq0" \
  -H "Content-Type: application/json" \
  -d '{"inputs":{"message":"Hola, quiero agendar una demo para mi empresa","conversation_history":"[]","contact_name":"Pedro López","platform":"whatsapp"},"response_mode":"blocking","user":"test-verify"}'
# Debe retornar succeeded con score high/hot
```

### Prueba 5: n8n workflow activo
```bash
curl -s -X POST http://localhost:5679/webhook/chatwoot-inbound \
  -H "Content-Type: application/json" \
  -d '{"message_type":"incoming","content":"Quiero precios","sender":{"name":"Test","phone_number":"59175488354"},"conversation_id":"conv1","account_id":1,"inbox_id":1,"source_id":"src1"}'
# Debe retornar: {"status":"received"} o similar
```

---

## Resumen de Acciones

| # | Acción | Prioridad | Tiempo | Estado |
|---|--------|-----------|--------|--------|
| 1 | Activar n8n workflows desde UI | Alta | 10 min | ⬜ Pendiente |
| 2 | Registrar webhook en Meta Developers | Alta | 30 min | ⬜ Pendiente |
| 3 | Obtener token permanente Meta (System User) | Alta | 20 min | ⬜ Pendiente |
| 4 | Configurar inbox WhatsApp en Chatwoot | Alta | 15 min | ⬜ Pendiente |
| 5 | Corregir Twenty CRM sync (phone normalization) | Media | 30 min | ⬜ Pendiente |
| 6 | Verificar flujo completo integrado | Alta | 15 min | ⬜ Pendiente |
| | **Total** | | **~2 horas** | |

---

## Notas Adicionales

- **n8n 2.23.4 bug**: REST API no procesa JSON body. Solo usar UI para operaciones con body JSON. Login funciona con `application/x-www-form-urlencoded`.
- **Dify Code nodes**: El sandbox corre pero la sintaxis `{{#node_id.text#}}` no se reemplaza correctamente. Si necesitas lógica programática, usa LLM nodes con prompts que generen JSON.
- **Token Meta**: Hasta obtener el System User permanente, los tokens expiran cada ~6h. Renew manualmente desde Meta Developers.
- **ngrok**: Para pruebas sin dominio público, ngrok expone localhost a internet. La URL cambia cada vez que reinicias ngrok.
