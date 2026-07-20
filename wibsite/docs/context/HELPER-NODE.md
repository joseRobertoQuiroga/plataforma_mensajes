# Contexto: Helper Node

## Propósito
Servicio Express.js (v2) que centraliza la lógica de integración personalizada: gestión de campañas multi-canal, tracking de entregas, webhooks, opt-outs, Excel/CSV upload, plantillas de mensajes, scoring de leads, sincronización con Twenty CRM, seed data, y normalización de datos. Sirve también el dashboard SPA de monitoreo.

## Configuración
- **Puerto**: 3100
- **Lenguaje**: Node.js 20 (Alpine)
- **Framework**: Express 5.x
- **Almacenamiento principal**: PostgreSQL (database `wibsite`, tablas: campaigns, campaign_leads, lead_scores, channel_status, opt_outs, workflow_logs)
- **Fallback**: JSON file store (`wibsite-store.json`) si PostgreSQL no está disponible
- **Dependencias**: express, cors, pino, axios, pg, xlsx, multer

## Arquitectura de Endpoints

### Legacy (v1 — compatibilidad backward con n8n)
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | /health | Health check (reporta tipo de DB) |
| POST | /campaigns | Crear campaña (legacy) |
| GET | /campaigns | Listar campañas |
| GET | /campaigns/pending | Pendientes de ejecución |
| POST | /campaigns/:id/schedule | Programar campaña |
| POST | /campaigns/:id/complete | Completar campaña |
| POST | /campaigns/track | Tracking de entrega |
| GET | /campaigns/:id/stats | Estadísticas de campaña |
| GET | /webhooks/whatsapp | Verificación webhook Meta |
| POST | /webhooks/whatsapp | Notificaciones Meta |
| POST | /opt-outs | Registrar opt-out |
| GET | /opt-outs/check | Verificar opt-out |
| POST | /chatwoot/normalize | Normalizar payload Chatwoot |

### API v2 (/api/*) — Campañas
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | /api/dashboard/summary | Resumen dashboard (stats globales) |
| POST | /api/campaigns | Crear campaña multi-canal |
| GET | /api/campaigns | Listar (filtro: status, channel, limit, offset) |
| GET | /api/campaigns/pending | Pendientes programadas |
| GET | /api/campaigns/:id | Obtener por ID |
| PATCH | /api/campaigns/:id | Actualizar |
| POST | /api/campaigns/:id/schedule | Programar |
| POST | /api/campaigns/:id/start | Iniciar (→ sending) |
| POST | /api/campaigns/:id/pause | Pausar |
| POST | /api/campaigns/:id/complete | Completar |
| DELETE | /api/campaigns/:id | Eliminar |
| POST | /api/campaigns/:id/leads | Agregar leads |
| GET | /api/campaigns/:id/leads | Listar leads (filtro: status) |
| POST | /api/campaigns/track | Tracking de entrega |
| GET | /api/campaigns/:id/stats | Estadísticas detalladas |

### API v2 — Excel/CSV Upload
| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | /api/campaigns/:id/leads/upload | Subir archivo (multipart, field: file). Soporta .xlsx, .xls, .csv. Auto-detecta columnas phone/name/email. Columnas extra → custom_fields. Reporta created/errors/duplicates |

### API v2 — Plantillas
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | /api/templates | Listar (filtro: channel, category) |
| POST | /api/templates | Crear plantilla |
| DELETE | /api/templates/:id | Eliminar |
| POST | /api/templates/preview | Previsualizar (reemplaza {{name}}, {{phone}}) |

### API v2 — Scoring
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | /api/scoring/rules | Obtener configuración (pesos, umbrales, reglas) |
| PUT | /api/scoring/rules | Actualizar configuración |
| POST | /api/scoring/evaluate | Evaluar lead individual (body: {lead_id}) |
| POST | /api/scoring/evaluate-all | Evaluar todos los leads |

### API v2 — Twenty CRM
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | /api/twenty/health | Verificar conexión Twenty |
| POST | /api/twenty/sync | Sincronizar lead individual (upsert por teléfono) |
| POST | /api/twenty/sync-all | Sincronizar todos los leads |

### API v2 — Datos de Prueba
| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | /api/seed | Poblar: 3 campañas, 12 leads, 12 deliveries, 12 scores, 5 channel status |
| DELETE | /api/seed | Limpiar todos los datos de prueba |

### API v2 — Canales y Opt-Outs
| Método | Ruta | Propósito |
|--------|------|-----------|
| GET | /api/channels | Listar estados de canales (LEDs) |
| PATCH | /api/channels/:channel | Actualizar estado de canal |
| POST | /api/opt-outs | Registrar opt-out (phone/email/channel) |
| GET | /api/opt-outs/check | Verificar opt-out |

### API v2 — Leads y Scores
| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | /api/leads/score | Registrar score (0-100 con factores) |
| GET | /api/leads/:id/scores | Historial de scores |
| GET | /api/leads/top | Top leads por score (filtro: min_score, limit) |

## Dashboard SPA
- Servido desde `public/index.html`
- 5 tabs: Dashboard, Campañas, Leads, Plantillas, Canales
- Modales: Import Excel (drag & drop), Seed data, Templates preview
- Botones acción rápida: ☁ Sync CRM, 📊 Score All, 🌱 Seed, 🗑 Clear, ⟳ Refresh
- Auto-refresh cada 15s
- Sin dependencias externas (HTML/JS puro)

## Almacenamiento
- **Primario**: PostgreSQL con pool de conexiones (`pg` Pool)
- **Fallback**: Archivo JSON (`wibsite-store.json`) — se activa automáticamente si PostgreSQL no responde
- **Seed data**: 11 templates, reglas de scoring default, factores ponderados, umbrales

## Estado Actual
- ✅ Servicio funcionando con PostgreSQL + fallback JSON
- ✅ CRUD completo campañas multi-canal (v2)
- ✅ Excel/CSV upload con validación y auto-mapeo
- ✅ 11 plantillas de mensajes predefinidas + CRUD
- ✅ Scoring rule-based (5 factores + 8 reglas + umbrales)
- ✅ Twenty CRM sync (individual + batch)
- ✅ Seed data + clear para pruebas
- ✅ Dashboard SPA con 5 tabs, modales, botones rápidos
- ✅ Twenty API key configurada (JWT funcional)
- ❌ Webhook WhatsApp real: pendiente (requiere Meta app configurada)
- ❌ Envío real de mensajes: pendiente (requiere credenciales Meta)
