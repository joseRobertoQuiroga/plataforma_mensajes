# OBJETIVOS PENDIENTES — Por Completar

> Priorizado por impacto y dependencias — Última actualización: 2026-07-18

---

## 🚨 Bloqueantes (P0 — Impiden flujo completo)

| # | Objetivo | Componente | Depende de | Detalle |
|---|----------|-----------|------------|---------|
| 1 | **Configurar Meta App** | Meta Developers | — | Crear App Business en Facebook Developers, obtener META_APP_ID, META_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID |
| 2 | **Configurar Inbox WhatsApp en Chatwoot** | Chatwoot | #1 | Agregar inbox WhatsApp Business en Chatwoot con credenciales Meta |
| 3 | **Configurar Webhook Chatwoot → n8n** | Chatwoot, n8n | #2 | Crear webhook en Chatwoot apuntando a `http://n8n:5678/webhook/chatwoot-inbound` para eventos: conversation_created, message_created, conversation_status_changed |
| 4 | **Configurar credenciales en n8n** | n8n | #2, #7 | Crear credenciales: Chatwoot API Key, Dify API Key (Bearer), Twenty API Key (Bearer), Meta Graph API (OAuth2 o Header), Meta WhatsApp Access Token |
| 5 | **Configurar variables de entorno Meta en n8n** | n8n | #1 | Agregar a Settings > Environment en n8n: META_API_VERSION (v21.0), WHATSAPP_PHONE_NUMBER_ID, META_APP_ACCESS_TOKEN |
| 6 | **Resolver body parser bug de n8n 2.23.4** | n8n | — | Bug en `body-parser.ts:78` lanza `"Failed to parse request body"` en endpoints REST con JSON. Workaround actual: usar UI. Requiere fix o upgrade. |
| 7 | **Configurar webhook Meta WhatsApp → helper-node** | Helper Node, Meta | #1 | Apuntar webhook de Meta a `http://<IP>:3100/webhooks/whatsapp` con verify token. Usar ngrok para desarrollo local. |
| 8 | **Probar flujo completo Inbound** | Todos | #1, #2, #3, #4, #5, #7 | Enviar WhatsApp real → Chatwoot → n8n → Dify → responder → Twenty CRM |

## 🔴 Alta Prioridad (P1 — Funcionalidad core)

| # | Objetivo | Componente | Depende de | Detalle |
|---|----------|-----------|------------|---------|
| 9 | **Probar flujo Campaign Broadcast** | n8n, Helper, Meta | #1, #4, #5, #7 | Ejecutar workflow 02 con campaña real y contactos reales |
| 10 | **Activar workflows n8n desde UI** | n8n | #6 | Toggle manual de workflows a `active` desde la UI (workaround hasta resolver body parser bug) |
| 11 | **Configurar Authelia como SSO** | Authelia | — | Unificar autenticación de todos los servicios tras Authelia. Actualmente checklist SSO documentado pero no implementado. |
| 12 | **Twenty CRM: workspace post-reset** | Twenty CRM | — | Si se resetea la BD, requiere configuración manual: crear workspace, generar API key JWT, recrear campos custom |

## 🟡 Prioridad Media (P2 — Mejoras y robustez)

| # | Objetivo | Componente | Detalle |
|---|----------|-----------|---------|
| 13 | **Implementar envío real de mensajes por canales alternativos** | Helper, n8n | Messenger, TikTok, SMS (Twilio), Email — actualmente solo soporte estructural |
| 14 | **Sistema de reintentos con backoff para envíos fallidos** | Helper | Para campañas, con cola de reintentos y notificación de fallos |
| 15 | **Dashboards de analytics en helper-node** | Helper | Gráficos de conversión, tendencias de scoring, efectividad de campañas |
| 16 | **Integración Frappe ERP (Fase 2)** | Frappe, n8n | Sincronización de leads, pedidos, facturación desde Twenty CRM a Frappe |
| 17 | **Pipeline IA Avanzado (Fase 4)** | Dify | RAG con documentos, state machine, function calling, multi-idioma, análisis de sentimiento |
| 18 | **Endurecimiento Producción (Fase 5)** | Todos | Seguridad, monitoreo, backups automatizados, CI/CD, plan de recuperación ante desastres |
| 19 | **Multi-tenant y escalamiento (Fase 7)** | Todos | Aislamiento de datos, white-label, billing, onboarding self-service, API pública |

## 🟢 Baja Prioridad (P3 — Mejoras cosméticas/calidad de vida)

| # | Objetivo | Componente | Detalle |
|---|----------|-----------|---------|
| 20 | **Internacionalización del dashboard SPA** | Helper | Soporte multi-idioma (es/en) |
| 21 | **Exportar reportes de campañas a PDF/CSV** | Helper | Botón de exportación de estadísticas |
| 22 | **Notificaciones push en dashboard** | Helper | Alertas en tiempo real cuando campaña se completa o falla |
| 23 | **CRUD de usuarios/agentes** | Helper, Chatwoot | Gestión de agentes humanos desde el dashboard |
| 24 | **Modo oscuro en dashboard** | Helper | Tema oscuro para la SPA |

---

## Leyenda de Estados

| Símbolo | Significado |
|---------|-------------|
| 🚫 No iniciado | No se ha comenzado a trabajar |
| 🔄 En progreso | Se está trabajando activamente |
| ⚠️ Bloqueado | Requiere dependencia externa |
| ✅ Completado | Finalizado y verificado |
