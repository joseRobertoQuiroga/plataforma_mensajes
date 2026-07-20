# Contexto: Sistema de Campañas Multi-Canal

## Visión General
Sistema de campañas de mensajería que permite crear, programar, ejecutar y monitorear campañas a través de múltiples canales (WhatsApp, Messenger, TikTok, SMS, Email).

## Canales Soportados (Fase 1)
- **WhatsApp**: Mensajes template (aprobados por Meta) + mensajes de sesión (free-form)

## Canales Futuros
- Facebook Messenger
- TikTok Messaging
- SMS (Twilio)
- Email

## Estados de Campaña
`draft` → `scheduled` → `sending` → `active` → `completed` / `cancelled` / `failed`

## Estados de Entrega
`pending` → `sent` → `delivered` → `read` → `replied` / `failed`

## Arquitectura Actual
```
[n8n trigger] → [helper-node /campaigns/pending]
              → [Twenty CRM (audiencia)]
              → [Dify (contenido personalizado)]
              → [Meta WhatsApp API]
              → [helper-node /campaigns/track]
```

## Endpoints Actuales (helper-node v2)

### Legacy (compatibilidad con n8n workflows)
| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | /campaigns | Crear campaña (v1) |
| GET | /campaigns | Listar campañas (v1) |
| GET | /campaigns/pending | Obtener pendientes (v1) |
| POST | /campaigns/:id/schedule | Programar (v1) |
| POST | /campaigns/:id/complete | Completar (v1) |
| POST | /campaigns/track | Tracking entrega (v1) |
| GET | /campaigns/:id/stats | Estadísticas (v1) |

### Nueva API /api/*
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | /api/dashboard/summary | Resumen del dashboard (stats globales) |
| POST | /api/campaigns | Crear campaña multi-canal |
| GET | /api/campaigns | Listar campañas (filtro: status, channel, limit, offset) |
| GET | /api/campaigns/pending | Obtener campañas pendientes de ejecución |
| GET | /api/campaigns/:id | Obtener campaña por ID |
| PATCH | /api/campaigns/:id | Actualizar campaña |
| POST | /api/campaigns/:id/schedule | Programar campaña |
| POST | /api/campaigns/:id/start | Iniciar campaña (→ sending) |
| POST | /api/campaigns/:id/pause | Pausar campaña |
| POST | /api/campaigns/:id/complete | Completar campaña |
| DELETE | /api/campaigns/:id | Eliminar campaña |
| POST | /api/campaigns/:id/leads | Agregar leads a campaña |
| GET | /api/campaigns/:id/leads | Listar leads de campaña |
| POST | /api/campaigns/track | Tracking de entrega |
| GET | /api/campaigns/:id/stats | Estadísticas de campaña |
| POST | /api/leads/score | Registrar score de lead |
| GET | /api/leads/:id/scores | Historial de scores de lead |
| GET | /api/leads/top | Top leads por score |
| GET | /api/channels | Estado de todos los canales (LEDs) |
| PATCH | /api/channels/:channel | Actualizar estado de un canal |
| POST | /api/opt-outs | Registrar opt-out |
| GET | /api/opt-outs/check | Verificar opt-out |
| GET | /api/twenty/health | Verificar conexión con Twenty CRM |
| POST | /api/chatwoot/normalize | Normalizar payload de Chatwoot |
| POST | /api/campaigns/:id/leads/upload | Subir Excel/CSV de leads (multipart, field: file) |
| GET | /api/templates | Listar plantillas de mensajes (filtro: channel, category) |
| POST | /api/templates | Crear plantilla |
| DELETE | /api/templates/:id | Eliminar plantilla |
| POST | /api/templates/preview | Previsualizar plantilla (reemplaza {{name}}, {{phone}}) |
| POST | /api/scoring/rules | Obtener configuración de reglas/scoring |
| PUT | /api/scoring/rules | Actualizar reglas/scoring |
| POST | /api/scoring/evaluate | Evaluar score de un lead |
| POST | /api/scoring/evaluate-all | Evaluar score de todos los leads |
| POST | /api/seed | Poblar base de datos con datos de prueba |
| DELETE | /api/seed | Limpiar todos los datos de prueba |
| POST | /api/twenty/sync | Sincronizar lead a Twenty CRM |
| POST | /api/twenty/sync-all | Sincronizar todos los leads a Twenty CRM |

## Schema PostgreSQL

### campaigns
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(255) | Nombre de campaña |
| description | TEXT | Descripción |
| channel | VARCHAR(50) | Canal: whatsapp, messenger, tiktok, sms, email |
| message_template | TEXT | Contenido del mensaje |
| template_name | VARCHAR(255) | Nombre del template (WhatsApp) |
| audience_filter | JSONB | Filtro de audiencia |
| status | VARCHAR(20) | draft, scheduled, sending, active, paused, completed, cancelled, failed |
| scheduled_at | TIMESTAMPTZ | Fecha programada |
| started_at | TIMESTAMPTZ | Fecha de inicio |
| completed_at | TIMESTAMPTZ | Fecha de finalización |
| sent_count | INT | Enviados |
| delivered_count | INT | Entregados |
| read_count | INT | Leídos |
| replied_count | INT | Respondidos |
| failed_count | INT | Fallidos |
| opt_out_count | INT | Opt-outs |

### campaign_leads
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID | PK |
| campaign_id | UUID | FK → campaigns |
| contact_id | VARCHAR | ID en CRM |
| name, phone, email, facebook_id, tiktok_id | VARCHAR | Datos del contacto |
| status | VARCHAR(20) | pending, queued, sent, delivered, read, replied, failed, opted_out |
| message_id | VARCHAR | ID del mensaje en el canal |
| score | INT | Score 0-100 |
| score_data | JSONB | Factores de scoring |

### channel_status
| Columna | Tipo | Descripción |
|---------|------|-------------|
| channel | VARCHAR(50) | UNIQUE: whatsapp, messenger, tiktok, sms, email |
| status | VARCHAR(20) | connected, disconnected, error, limited, pending |
| status_message | TEXT | Mensaje de estado |
| error_count | INT | Contador de errores |
| rate_limit_remaining | INT | Rate limit restante |

## Estados
### Estados de Campaña
`draft` → `scheduled` → `sending` → `active` ⇄ `paused` → `completed` / `cancelled` / `failed`

### Estados de Entrega
`pending` → `queued` → `sent` → `delivered` → `read` → `replied` / `failed` / `opted_out`

## State Actual
- ✅ CRUD de campañas funcional (v2 con PostgreSQL)
- ✅ Tracking de entregas con stats auto-calculados
- ✅ Webhook Meta para status updates
- ✅ PostgreSQL con fallback a JSON file store
- ✅ Interfaz de monitoreo con LEDs (dashboard en tiempo real)
- ✅ Soporte multi-canal (5 canales: WhatsApp, Messenger, TikTok, SMS, Email)
- ✅ Scoring de leads integrado (0-100 con factores)
- ✅ Channel status management con LEDs (conectado/desconectado/error/limitado/pendiente)
- ✅ Excel/CSV upload con auto-detección de columnas y validación
- ✅ UI drag & drop Excel en dashboard
- ✅ 11 plantillas de mensajes predefinidas (WhatsApp, Messenger, TikTok, SMS, Email)
- ✅ Seed data para pruebas (3 campañas, 12 leads, etc.)
- ✅ Twenty CRM sync endpoints (sync individual + batch)
- ✅ Scoring engine rule-based (5 factores + 8 reglas)
- ✅ Twenty API key configurada y funcional
- ❌ Conexión real a Meta WhatsApp API: pendiente (requiere META_APP_ID, WHATSAPP_PHONE_NUMBER_ID)
- ❌ Mensajería real por Messenger/TikTok/SMS/Email: pendiente
