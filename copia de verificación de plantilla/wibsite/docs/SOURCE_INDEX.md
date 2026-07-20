# Wibsite Business — Índice del Código Fuente

## Raíz del Proyecto
| Ruta | Propósito |
|------|-----------|
| `docker-compose.yml` | Orquestación de todos los servicios (PostgreSQL, Redis, Chatwoot, Dify, n8n, Twenty CRM, Plugin Daemon, Helper, Nginx) |
| `nginx.conf` | Reverse proxy para unificar todos los servicios bajo un mismo puerto (8080) |
| `.env` | Variables de entorno (secretos, claves API, config) |
| `scripts/init-db.sql` | SQL de inicialización — crea las bases de datos (chatwoot, dify, n8n, twenty) |
| `scripts/init-wibsite.js` | Script de inicialización post-deploy — configura APIs de Chatwoot, Dify, n8n, Twenty |

## helper-node/
Servicio Express.js con PostgreSQL + dashboard de monitoreo SPA.

| Ruta | Propósito |
|------|-----------|
| `helper-node/index.js` | Servidor Express v2: CRUD campañas multi-canal, leads, scoring, tracking, webhooks WhatsApp, opt-outs, channel status, dashboard summary, Twenty health, Excel/CSV upload, templates CRUD, seed data, Twenty sync, scoring engine |
| `helper-node/public/index.html` | SPA de monitoreo con 5 tabs (Dashboard, Campañas, Leads, Plantillas, Canales), modals import/seed/templates, botones sync/score/seed/clear, auto-refresh 15s |
| `helper-node/Dockerfile` | Dockerfile para el helper (node:20-alpine con public/) |
| `helper-node/package.json` | Dependencias: express, cors, pino, axios, pg, xlsx, multer |
| `helper-node/test-upload.js` | Script de prueba para Excel upload |
| `helper-node/test_leads.csv` | CSV de prueba (5 filas: nombre, teléfono, email) |

## scripts/
| Ruta | Propósito |
|------|-----------|
| `scripts/campaigns-schema.sql` | Migración PostgreSQL: campaigns, campaign_leads, lead_scores, channel_status, opt_outs, workflow_logs |
| `scripts/configure-openrouter.js` | Configura OpenRouter como modelo LLM en Dify vía plugin openai_api_compatible |

## n8n/workflows/
| Ruta | Propósito |
|------|-----------|
| `n8n/workflows/01-inbound-message.json` | Workflow: Mensaje entrante WhatsApp → Dify → Twenty CRM |
| `n8n/workflows/02-campaign-broadcast.json` | Workflow: Campaña broadcast WhatsApp |

## dify/workflows/
| Ruta | Propósito |
|------|-----------|
| `dify/workflows/whatsapp-lead-classifier.yml` | Workflow Dify: clasificador de leads WhatsApp (usa gpt-4o-mini) |

## specs/
| Ruta | Propósito |
|------|-----------|
| `specs/ARCHITECTURE.md` | Documento de arquitectura original |
| `specs/COMPLETE_ARCHITECTURE.md` | Arquitectura completa del sistema |
| `specs/SETUP_GUIDE.md` | Guía de configuración inicial |

## Scripts Python (raíz)
Estos son scripts de diagnóstico/desarrollo, no parte del despliegue.

| Ruta | Propósito |
|------|-----------|
| `dify_login.py` | Login a Dify API (prueba de autenticación) |
| `install_plugin.py` | Instalación de plugin vía marketplace API |
| `check_plugin_endpoints.py` | Verificación de endpoints del plugin-daemon |
| `check_providers.py` | Listar providers de modelos en Dify |
| `check_task.py` | Verificar estado de tarea de instalación |
| `get_provider_detail.py` | Obtener detalle de un provider específico |
| `add_xai_model.py` | Agregar modelo xAI Grok al provider openai_api_compatible |
| `config_xai.py` | Configurar modelo xAI Grok en Dify |
| `test_xai.py` | Test de conexión con xAI API |
| `test_xai_models.py` | Testear diferentes modelos de xAI |
| `test_n8n.py` | Test de conexión con n8n |
| `check_n8n_db.py` | Verificar base de datos de n8n |
| `check_admin.py` | Verificar estado del admin en Dify |
| `extract_plugins.py` | Extraer información de plugins instalados |
| `list_routes.py` | Listar rutas de Dify API |
| `n8n_import.py` | Script para importar workflows a n8n vía API |
| `tmp_*.py` | Scripts temporales de diagnóstico |

## Scripts Twenty CRM (helper-node/twenty-*.js)
Scripts de diagnóstico/desarrollo para Twenty CRM API.

| Ruta | Propósito |
|------|-----------|
| `helper-node/twenty-fields.js` | Crear campos custom en Twenty (people): painPoints, interests, scoreHistory, etc. |
| `helper-node/twenty-fields2.js` | Crear campos adicionales con prefijo lead (leadScoreHistory, leadLastScore, etc.) |
| `helper-node/twenty-debug.js` | Debug de campos Twenty existentes |
| `helper-node/twenty-create.js` | Crear persona de prueba en Twenty vía REST |
| `helper-node/twenty-patch.js` | Actualizar persona existente en Twenty vía REST |
| `helper-node/twenty-test-payload.js` | Payload de prueba para sync Twenty |

## lumi/ (proyecto separado)
Proyecto complementario de frontend/documentación. No forma parte del stack principal.
