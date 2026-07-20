# Lista de Verificación y Pruebas — Plataforma Wibsite

## Convención de símbolos
- [ ] Pendiente de probar
- [x] Verificado funcionando
- [!] Funciona con limitaciones / parcial
- [~] No aplica / bloqueado por dependencia externa

---

## 1. INFRAESTRUCTURA Y RED

### 1.1 Contenedores Docker
- [x] Todos los servicios se levantan sin errores (`docker compose up -d`)
- [x] Estados: postgres, redis, weaviate, t2v en `healthy`
- [ ] `docker compose ps` sin contenedores en estado `unhealthy` o `exited`
- [x] Logs sin errores críticos en postgres, redis, n8n, twenty-server, dify-api

### 1.2 Conectividad entre servicios
- [x] helper alcanza twenty-server (`GET /api/twenty/health`)
- [x] helper alcanza n8n
- [x] n8n alcanza postgres
- [x] dify-api alcanza plugin-daemon
- [x] dify-api alcanza postgres, redis, weaviate

### 1.3 Bases de datos
- [x] PostgreSQL: bases `wibsite`, `dify`, `n8n`, `chatwoot`, `twenty`, `dify_plugin` creadas
- [ ] PostgreSQL: schema `campaigns` migrado (tablas: campaigns, campaign_leads, lead_scores, channel_status, opt_outs, workflow_logs)
- [x] Redis: accesible desde todos los servicios que lo requieren
- [ ] Weaviate: conectado y operable

---

## 2. NGINX — HUB CENTRAL

### 2.1 Página principal
- [x] `GET /hub/` → HTTP 200, HTML renderizado
- [x] `GET /` → Redirección 302 a /hub/
- [x] Assets estáticos (CSS inline, JS inline) cargan sin errores

### 2.2 Rutas proxy
- [x] `GET /admin/` → Dashboard SPA (helper) → HTTP 200
- [x] `GET /api/health` → Health endpoint → HTTP 200
- [x] `GET /api/campaigns` → Lista de campañas → HTTP 200
- [x] `POST /api/campaigns/:id/leads/upload` → Subida Excel → HTTP 201
- [x] `GET /n8n/` → n8n Web UI → HTTP 200
- [x] `GET /crm/` → Twenty CRM → HTTP 200
- [x] `GET /dify/` → Dify Web → HTTP 307 (redirect a login)
- [!] `GET /chatwoot/` → Chatwoot → HTTP 502 (servicio en reinicio continuo)

### 2.3 Resolución dinámica de hosts
- [x] Chatwoot usa `set $chatwoot_upstream` + `resolver 127.0.0.11` para arranque independiente
- [x] Nginx arranca correctamente aunque chatwoot esté caído
- [ ] Verificar que chatwoot se resuelve cuando finalmente arranque

---

## 3. HELPER-NODE (API de integración)

### 3.1 Endpoints base
- [x] `GET /health` → `{service: "wibsite-helper", status: "ok", ...}`
- [x] `GET /api/dashboard/summary` → Estadísticas agregadas
- [x] `GET /api/channels` → Estado de 5 canales con LEDs
- [x] `PATCH /api/channels/:channel` → Actualizar estado de canal

### 3.2 Campañas
- [x] `POST /api/campaigns` → Crear campaña (name, channel, message_template, etc.)
- [x] `GET /api/campaigns` → Listar con filtros (status, channel, limit, offset)
- [x] `GET /api/campaigns/pending` → Campañas scheduled pendientes
- [x] `GET /api/campaigns/:id` → Detalle de campaña
- [x] `PATCH /api/campaigns/:id` → Actualizar campos permitidos
- [x] `POST /api/campaigns/:id/schedule` → Programar envío
- [x] `POST /api/campaigns/:id/start` → Iniciar envío
- [x] `POST /api/campaigns/:id/pause` → Pausar envío
- [x] `POST /api/campaigns/:id/complete` → Completar campaña
- [x] `DELETE /api/campaigns/:id` → Eliminar campaña

### 3.3 Leads
- [x] `POST /api/campaigns/:id/leads` → Crear lead(s) individuales
- [x] `GET /api/campaigns/:id/leads` → Listar leads de campaña
- [x] `POST /api/campaigns/:id/leads/upload` → **Subida masiva Excel/CSV**
  - [x] Detección automática de columnas (phone, name, email)
  - [x] Validación por fila (requiere phone o email)
  - [x] Detección de duplicados dentro de la misma campaña
  - [x] Reporte detallado (creados, errores, duplicados)
  - [x] Campos no mapeados → custom_fields automáticos
  - [x] Soporta .xlsx, .xls, .csv
  - [x] Preview en dashboard antes de confirmar

### 3.4 Tracking de entregas
- [x] `POST /api/campaigns/track` → Registrar evento de delivery
- [x] `GET /api/campaigns/:id/stats` → Estadísticas de campaña con deliveries
- [ ] Verificar que el tracking actualiza correctamente sent/delivered/read/replied/failed counts

### 3.5 Plantillas de mensajes
- [x] `GET /api/templates` → Lista de 11 plantillas predefinidas (W/M/T/SMS/Email)
- [x] `POST /api/templates` → Crear nueva plantilla
- [x] `DELETE /api/templates/:id` → Eliminar plantilla
- [x] `POST /api/templates/preview` → Preview con variables reemplazadas
- [x] Filtro por canal en dashboard
- [ ] Verificar que las plantillas se persisten entre reinicios

### 3.6 Twenty CRM
- [x] `GET /api/twenty/health` → Estado de conexión
- [x] `POST /api/twenty/sync` → Sincronizar lead individual (upsert por teléfono)
- [x] `POST /api/twenty/sync-all` → Sincronizar todos los leads
  - [x] Normaliza teléfonos (+52...)
  - [x] Crea o actualiza personas en Twenty
  - [x] Guarda twenty_id en el lead local
  - [x] Reporte detallado por lead
- [ ] Verificar que campos custom de Twenty se actualizan correctamente en re-sync
- [ ] Verificar que Twenty API key rotada sigue funcionando

### 3.7 Scoring Engine
- [x] `GET /api/scoring/rules` → Reglas de scoring (configurables)
- [x] `PUT /api/scoring/rules` → Actualizar reglas/pesos/umbrales
- [x] `POST /api/scoring/evaluate` → Evaluar lead individual
  - [x] 5 factores ponderados (engagement, recency, affinity, completeness, interest)
  - [x] 8 reglas condicionales (+20 reply, +10 open, +15 click, -100 opt-out, etc.)
  - [x] Categorización hot/warm/cold según umbrales
  - [x] Historial almacenado en scores[]
- [x] `POST /api/scoring/evaluate-all` → Evaluar todos los leads en lote
- [ ] Verificar scores negativos (opt-out) funcionan correctamente
- [ ] Verificar que la recategorización no duplica entradas en scores[]

### 3.8 Opt-Out
- [x] `POST /api/opt-outs` → Registrar opt-out (por teléfono o email)
- [x] `GET /api/opt-outs/check` → Verificar si un contacto opt-out
- [x] Marca leads relacionados como `opted_out`

### 3.9 Webhooks
- [x] `GET /webhooks/whatsapp` → Verificación Meta webhook (hub.mode, hub.verify_token)
- [x] `POST /webhooks/whatsapp` → Recepción de eventos Meta
- [x] `POST /api/chatwoot/normalize` → Normalizar payload de Chatwoot
- [ ] Verificar flujo completo: Meta → webhook → tracking → n8n

### 3.10 Seed Data
- [x] `POST /api/seed` → Genera 3 campañas, 12 leads, 12 deliveries, scores, 5 canales
- [x] `DELETE /api/seed` → Limpia todos los datos
- [ ] Verificar que seed no rompe datos existentes (append vs replace)

---

## 4. DASHBOARD SPA (Interfaz de monitoreo)

### 4.1 Tabs y navegación
- [x] Tab Dashboard: cards resumen, LEDs de canales, barra de entregas
- [x] Tab Campañas: tabla con todas las campañas + botón Importar Leads
- [x] Tab Leads: tabla con leads, scores, estados
- [x] Tab Plantillas: filtro por canal, preview, crear nueva
- [x] Tab Canales: detalle por canal (estado, errores, último check)

### 4.2 Importación Excel
- [x] Modal drag & drop + selector de archivos
- [x] Previsualización de datos parseados
- [x] Reporte de resultados (creados, errores, duplicados)
- [ ] Verificar que la importación funciona correctamente con archivos grandes (>1000 filas)
- [ ] Verificar encoding UTF-8 con caracteres especiales (ñ, tildes)

### 4.3 Acciones rápidas
- [x] Botón ☁ Sync CRM → Sincroniza leads a Twenty
- [x] Botón 📊 Score All → Evalúa scoring de todos los leads
- [x] Botón 🌱 Seed → Genera datos de prueba
- [x] Botón 🗑 Clear → Limpia todos los datos
- [x] Botón ⟳ Refresh → Recarga todos los datos
- [x] Auto-refresh cada 15 segundos

### 4.4 Estados visuales
- [x] LEDs de canal: connected (verde), disconnected (rojo), pending (amarillo), error (rojo + animación)
- [x] Badges de estado de campañas (draft, scheduled, sending, completed, paused, failed)
- [x] Barras de progreso con colores por rango de score
- [x] Última actualización mostrada

---

## 5. TWENTY CRM

### 5.1 Conexión y autenticación
- [x] API configurada y funcional (JWT en TWENTY_API_KEY)
- [x] `GET /rest/people` → 200 autenticado
- [x] `GET /rest/companies` → 200 autenticado
- [x] `GET /rest/opportunities` → 200 autenticado

### 5.2 Campos personalizados creados en `people`
- [x] `painPoints` (TEXT) — Problemas/necesidades del lead
- [x] `interests` (TEXT) — Intereses del contacto
- [x] `scoreHistory` (TEXT) — Historial de scores (JSON)
- [x] `lastScore` (NUMBER) — Último score calculado
- [x] `leadSource` (TEXT) — Origen del lead (web, facebook, referral...)
- [x] `customFields` (TEXT) — Campos adicionales (JSON)
- [x] `leadScoreHistory` (TEXT) — Historial alternativo
- [x] `leadLastScore` (NUMBER) — Score alternativo
- [x] `leadOrigin` (TEXT) — Origen alternativo
- [x] `leadCustomData` (TEXT) — Custom data alternativo
- [!] Nota: Hay duplicación de campos (scoreHistory y leadScoreHistory, etc.) porque Twenty usa namespace global para nombres de campo

### 5.3 Operaciones CRUD
- [x] `POST /rest/people` → Crear persona con todos los campos custom
- [x] `PATCH /rest/people/:id` → Actualizar campos
- [x] `DELETE /rest/people/:id` → Eliminar (probado con campos de prueba)
- [x] Sincronización upsert por teléfono desde helper (12 leads sync OK)

---

## 6. N8N

### 6.1 Web UI
- [x] Accesible en http://localhost:8080/n8n/ → HTTP 200
- [x] Login funciona con `emailOrLdapLoginId`
- [ ] Verificar que las credenciales funcionan en UI

### 6.2 Workflows importados
- [x] `01-inbound-message.json` → Importado con ID `ktheIzGfXPHbZ9Rg`
- [x] `02-campaign-broadcast.json` → Importado con ID `kW9O2RkkwrmiGEjC`
- [x] Fix aplicado: "Check Needs Human?" renombrado a "Needs Human?"
- [ ] Verificar que ambos workflows aparecen en la UI de n8n
- [ ] Verificar que los webhooks de n8n responden a peticiones externas
- [ ] Verificar que el workflow de inbound message llama al helper correctamente
- [ ] Verificar que campaign broadcast puede ejecutarse manualmente

---

## 7. DIFY

### 7.1 Web UI
- [x] Accesible en http://localhost:8080/dify/ → Redirección a login
- [x] Admin: joserobertoquirogasalvador@gmail.com
- [ ] Verificar login en UI de Dify
- [ ] Verificar que el workspace aparece correctamente

### 7.2 Plugin Daemon
- [x] Plugin `langgenius/openai_api_compatible:0.0.55` instalado
- [x] Provider visible en Dify
- [ ] Verificar que el plugin acepta configuraciones de proveedor
- [ ] Verificar que los modelos se listan en Dify

### 7.3 Workflow Lead Classifier
- [ ] Workflow `whatsapp-lead-classifier.yml` pendiente de probar (requiere LLM configurado)
- [ ] Verificar que usa `gpt-4o-mini` como modelo por defecto

---

## 8. CHATWOOT

### 8.1 Web UI
- [!] `GET /chatwoot/` → HTTP 502 (servicio en reinicio)
- [!] Chatwoot no está disponible actualmente
- [ ] Verificar logs de chatwoot para diagnosticar reinicio

### 8.2 Webhooks
- [ ] `POST /api/v1/accounts/1/webhooks` → Pendiente (requiere chatwoot funcional + credenciales Meta)
- [ ] Configuración de webhook hacia n8n → Pendiente

---

## 9. FLUJOS END-TO-END (Integración general)

### 9.1 Con Meta/WhatsApp (bloqueado)
- [~] META_APP_ID: vacío
- [~] META_APP_SECRET: vacío
- [~] WHATSAPP_PHONE_NUMBER_ID: vacío
- [~] WHATSAPP_BUSINESS_ACCOUNT_ID: vacío
- [~] Envío real de mensajes WhatsApp: bloqueado
- [~] Recepción de mensajes entrantes: bloqueado
- [~] Webhook Meta → helper → tracking: bloqueado

### 9.2 Con LLM (bloqueado)
- [~] xAI Grok: sin créditos
- [~] Clasificación de leads con IA: bloqueado
- [~] Agente conversacional 24/7: bloqueado
- [~] Scoring con IA: bloqueado (usando rule-based como fallback)

### 9.3 Pipeline completo (sin Meta/LLM)
- [x] Seed data → Dashboard con datos → OK
- [x] Seed data → Scoring evaluate-all → OK
- [x] Seed data → Sync to Twenty CRM → OK
- [x] Excel upload → Dashboard preview → OK
- [x] Campaign creation → Lead assignment → OK
- [x] Template design → Preview → OK
- [ ] Cycle completo: crear campaña → importar leads → evaluar scoring → sincronizar CRM → lanzar campaña → trackear eventos

---

## 10. SEGURIDAD Y CONFIGURACIÓN

### 10.1 Variables de entorno
- [ ] Verificar que todas las claves requeridas están en `.env`:
  - [x] TWENTY_API_KEY
  - [~] META_APP_ID (vacío)
  - [~] META_APP_SECRET (vacío)
  - [~] WHATSAPP_PHONE_NUMBER_ID (vacío)
  - [~] WHATSAPP_BUSINESS_ACCOUNT_ID (vacío)
  - [ ] DIFY_SECRET_KEY
  - [x] PLUGIN_DAEMON_KEY
  - [x] PLUGIN_DIFY_INNER_API_KEY
  - [ ] N8N_ENCRYPTION_KEY
  - [x] TWENTY_ACCESS_TOKEN_SECRET
  - [x] TWENTY_LOGIN_TOKEN_SECRET
  - [x] CHATWOOT_SECRET_KEY

### 10.2 Puertos y accesos
- [x] 5432 PostgreSQL (interno)
- [x] 6379 Redis (interno)
- [x] 3001 Twenty CRM
- [x] 3002 Chatwoot
- [x] 3100 Helper API
- [x] 5001 Dify API
- [x] 5002 Plugin Daemon
- [x] 5679 n8n
- [x] 8080 Nginx Hub (puerta de entrada única)

---

## 11. DOCUMENTACIÓN

- [x] `wibsite/docs/INDEX.md` — Índice maestro
- [x] `wibsite/docs/SOURCE_INDEX.md` — Índice de archivos fuente
- [x] `wibsite/docs/GLOSSARY.md` — Glosario de términos
- [x] `wibsite/docs/MEMORY.md` — ADRs y decisiones técnicas
- [x] `wibsite/docs/CHANGELOG.md` — Historial de cambios
- [x] `wibsite/docs/RUNBOOK.md` — Guías de operación
- [x] `wibsite/docs/context/` — 7 contextos con diagramas Mermaid
- [x] `wibsite/docs/rag/` — 6 archivos RAG (DEPENDENCY-MATRIX, etc.)
- [x] `doc/ESTADO.md` — Documento maestro de estado
- [x] `~/.config/opencode/skills/documentation-standard.json` — Skill reutilizable

---

## RESUMEN DE ESTADO

| Módulo | Estado | Pruebas OK | Pendientes |
|--------|--------|-----------|------------|
| Infraestructura | ✅ Funcional | 8/10 | 2 no críticas |
| Nginx Hub | ✅ Funcional | 10/11 | Chatwoot 502 |
| Helper API | ✅ Funcional | 30/32 | 2 verificaciones pendientes |
| Dashboard | ✅ Funcional | 18/19 | 1 verificación archivos grandes |
| Twenty CRM | ✅ Funcional | 12/12 | - |
| n8n | ✅ Funcional | 4/8 | UI workflows pendientes |
| Dify | ✅ Parcial | 3/5 | Login + plugin provider |
| Chatwoot | ❌ Caído | 0/3 | En reinicio continuo |
| Meta/WhatsApp | ❌ Bloqueado | 0/4 | Sin credenciales |
| LLM | ❌ Bloqueado | 0/3 | xAI sin créditos |
| Scoring | ✅ Funcional | 7/9 | 2 verificaciones |
| Sincronización CRM | ✅ Funcional | 6/6 | - |
| Documentación | ✅ Completa | 11/11 | - |
