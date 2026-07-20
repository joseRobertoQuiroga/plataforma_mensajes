# Wibsite — Pasos de Configuración en UI + Checklist Visual de Validación
# ==================================================================

## PARTE A — Pasos obligatorios en cada UI

---

### A1. n8n — Reimportar workflows corregidos

| # | Paso | Detalle |
|---|------|---------|
| 1 | Abrir `http://localhost:8080/n8n/` | Login SSO con `admin@wibsite.com` / `Admin@123`. Si es primera vez, n8n pedirá login propio con las mismas credenciales. |
| 2 | Ir a Workflows | Menú lateral izquierdo → Workflows |
| 3 | Eliminar workflows viejos | Si existen "01 - Inbound WhatsApp" o "02 - Campaign Broadcast", eliminarlos desde el menú `...` |
| 4 | Importar inbound | Botón `Add Workflow` → `Import from File` → seleccionar `n8n/workflows/01-inbound-message.json` |
| 5 | Importar broadcast | Botón `Add Workflow` → `Import from File` → seleccionar `n8n/workflows/02-campaign-broadcast.json` |
| 6 | Activar ambos | Entrar a cada workflow y mover el toggle `Active` (esquina superior derecha) a ON |
| 7 | Verificar webhooks | En el workflow inbound, el nodo "Chatwoot Webhook" debe mostrar una URL de webhook. Copiarla para el paso A3 |

---

### A2. Dify — Importar workflow de campañas

| # | Paso | Detalle |
|---|------|---------|
| 1 | Abrir `http://localhost:8080/dify/` | Login SSO. Si es primera vez, login Dify con `joserobertoquirogasalvador@gmail.com` / `Admin@123` |
| 2 | Ir a Studio | Menú superior → Studio |
| 3 | Importar workflow | Botón `Import` → seleccionar `dify/workflows/campaign-content-generator.yml` |
| 4 | Publicar | Dentro del workflow importado, hacer clic en `Publish` |
| 5 | Obtener API key | Ir a la pestaña `API Access` del workflow publicado. Copiar el API key. |
| 6 | Actualizar .env | Si el API key es diferente al existente en `.env` (`DIFY_API_KEY`), actualizar la variable y reiniciar n8n: `docker compose restart n8n` |

---

### A3. Chatwoot — Configurar webhooks

| # | Paso | Detalle |
|---|------|---------|
| 1 | Abrir `http://localhost:8080/chatwoot/` | Login SSO. Si es primera vez, login Chatwoot con `admin@wibsite.com` / `Admin@123` |
| 2 | Ir a Settings → Webhooks | Menú lateral → Settings → Webhooks |
| 3 | Crear webhook n8n inbound | URL: `http://n8n:5678/webhook/chatwoot-inbound`. Eventos: `message_created`, `message_updated` |
| 4 | Crear webhook auto-scoring | URL: `http://helper:3100/api/scoring/trigger-from-chatwoot`. Eventos: `message_created`, `message_updated` |
| 5 | Guardar | Verificar que ambos webhooks estén activos |

---

## PARTE B — Checklist Visual de Validación por Flujo

### B1. Validar SSO (Gateway)

| # | Acción en navegador | Verificación visual |
|---|---------------------|---------------------|
| 1 | Abrir `http://localhost:8080/hub/` | [ ] Carga página de inicio Wibsite con 5 tarjetas de módulos |
| 2 | Clic en tarjeta "Dify" → redirige a login | [ ] Pantalla de login Authelia con logo y formulario |
| 3 | Login: `admin@wibsite.com` / `Admin@123` | [ ] Redirige automáticamente a Dify |
| 4 | Abrir nueva pestaña: `http://localhost:8080/n8n/` | [ ] Carga n8n SIN pedir login (sesión SSO activa) |
| 5 | Nueva pestaña: `http://localhost:8080/chatwoot/` | [ ] Carga Chatwoot SIN pedir login |
| 6 | Nueva pestaña: `http://localhost:8080/crm/` | [ ] Carga Twenty CRM SIN pedir login |
| 7 | Nueva pestaña: `http://localhost:8080/admin/` | [ ] Carga Dashboard SIN pedir login |

---

### B2. Validar Flujo A — WhatsApp → IA → Respuesta

| # | Acción | Verificación visual |
|---|--------|---------------------|
| 1 | Enviar "Hola, quiero información de sus servicios" desde WhatsApp | [ ] Mensaje aparece en Chatwoot (bandeja de entrada) |
| 2 | Esperar 10-15 segundos | [ ] Aparece respuesta automática del bot en la conversación |
| 3 | En la misma conversación, ver nota privada | [ ] Nota con "🤖 Análisis IA" con score, intención, prioridad |
| 4 | Abrir Twenty CRM (`/crm/`) → People | [ ] Lead creado/actualizado con score, tags, AI summary |
| 5 | Abrir n8n → Executions | [ ] Ejecución completada sin errores (verde) |

---

### B3. Validar Flujo B — Campañas → Broadcast

| # | Acción | Verificación visual |
|---|--------|---------------------|
| 1 | Abrir Dashboard (`/admin/`) → pestaña "Campañas" | [ ] Lista de campañas cargada |
| 2 | Crear campaña vía API (o Seed en Dashboard) | [ ] Campaña aparece en la tabla con status "draft" |
| 3 | Usar botón "🌱 Seed" si no hay datos | [ ] Datos de prueba generados |
| 4 | Subir leads: botón "+ Importar Leads (Excel/CSV)" | [ ] Modal de import. Arrastrar archivo → ver reporte de created/errors |
| 5 | Schedule: vía API `POST /api/campaigns/:id/schedule` | [ ] Status cambia a "scheduled" en la tabla |
| 6 | Esperar 1 min (schedule trigger en n8n) | [ ] En n8n → Executions: aparece ejecución de "02 - Campaign Broadcast" |
| 7 | Verificar en Dashboard: stats de envíos | [ ] sent_count, delivered_count actualizados en la campaña |

---

### B4. Validar Flujo C — Chatwoot → Scoring automático

| # | Acción | Verificación visual |
|---|--------|---------------------|
| 1 | En Chatwoot, responder a una conversación como agente | [ ] Mensaje enviado correctamente |
| 2 | Abrir Dashboard → pestaña "Leads" | [ ] Score del lead aumentó (+15 boost por reply del agente) |
| 3 | Verificar en tabla de leads: columna "Score" | [ ] Valor numérico actualizado, barra de color cambió |

---

### B5. Validar Flujo D — Twenty CRM Sync

| # | Acción | Verificación visual |
|---|--------|---------------------|
| 1 | Dashboard → botón "☁ Sync CRM" | [ ] Proceso inicia, esperar 5-15 segundos |
| 2 | Abrir Twenty CRM (`/crm/`) → People | [ ] Todos los leads del helper aparecen en Twenty |
| 3 | Verificar campos personalizados | [ ] Campos como intentScore, leadStatus, aiSummary con datos |

---

### B6. Validar Flujo E — Dashboard

| # | Acción | Verificación visual |
|---|--------|---------------------|
| 1 | Pestaña "Dashboard" | [ ] 4 tarjetas KPI con datos: Campañas Activas, Mensajes Hoy, Leads Scored, Top Lead |
| 2 | Sección "Estado de Canales" | [ ] LEDs indicadores por canal (WhatsApp, Messenger, TikTok, SMS, Email) |
| 3 | Sección "Entregas vs Envíos" | [ ] Barra de progreso con colores por estado |
| 4 | Pestaña "Campañas" | [ ] Tabla con columnas: Nombre, Canal, Estado, Env, Ent, Leíd, Resp, Fall, Prog, Creada, Acción |
| 5 | Pestaña "Leads" | [ ] Tabla de leads con score y barras de progreso |
| 6 | Pestaña "Plantillas" | [ ] Lista de templates de mensaje por canal y categoría |
| 7 | Pestaña "Canales" | [ ] Estado detallado de cada canal con mensaje y timestamp |
| 8 | Botón "🤖 Test LLM" | [ ] Respuesta de OpenRouter confirmando conexión |
| 9 | Botón "📊 Score All" | [ ] Todos los leads reciben score, hot/warm/cold actualizado |
| 10 | Auto-refresh cada 15s | [ ] Timestamp "Última actualización" cambia automáticamente |

---

## PARTE C — Troubleshooting rápido

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| n8n no recibe webhooks | Chatwoot webhook apunta a URL incorrecta | Verificar que la URL en Chatwoot Settings → Webhooks sea `http://n8n:5678/webhook/chatwoot-inbound` |
| Dify workflow no responde | API key incorrecto | Verificar `.env` → `DIFY_API_KEY` coincide con el key del workflow publicado |
| Authelia pide login en cada clic | Cookie de sesión no se guarda | Usar `http://127.0.0.1:8080` en vez de `localhost:8080`, o verificar configuración de cookies del navegador |
| Campañas no se envían | Meta no tiene templates aprobados | Los templates `campaign_generic`, `welcome_message`, etc. deben existir en Meta Business |
| Score no se actualiza | Webhook de Chatwoot a helper no configurado | Ir a Chatwoot → Settings → Webhooks → agregar `http://helper:3100/api/scoring/trigger-from-chatwoot` |
