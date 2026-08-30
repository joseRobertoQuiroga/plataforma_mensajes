# Manual Técnico de Usuario — Plataforma Wibsite

## Índice
1. [Visión General](#1-visión-general)
2. [Hub Central (Nginx)](#2-hub-central-nginx)
3. [Helper API y Dashboard](#3-helper-api-y-dashboard)
4. [Twenty CRM](#4-twenty-crm)
5. [n8n (Automatización)](#5-n8n-automatización)
6. [Dify (IA/LLM)](#6-dify-iallm)
7. [Chatwoot (Inbox Omnicanal)](#7-chatwoot-inbox-omnicanal)
8. [Meta/WhatsApp](#8-metawhatsapp)
9. [Scoring Engine](#9-scoring-engine)
10. [Flujo Completo: Inbound WhatsApp](#10-flujo-completo-inbound-whatsapp)
11. [Flujo Completo: Campaign Broadcast](#11-flujo-completo-campaign-broadcast)
12. [Pruebas por Módulo](#12-pruebas-por-módulo)

---

## 1. Visión General

### Arquitectura
```
Usuario → Nginx Hub (:8080) → Helper API (:3100) → JSON Store
                            → Twenty CRM (:3001)
                            → n8n (:5679) → Dify (:5001) → OpenRouter
                            → Chatwoot (:3002)
                            → PostgreSQL (:5432) / Redis (:6379) / Weaviate
```

### Mapa de Puertos
| Servicio | Puerto Interno | Puerto Externo | URL vía Nginx |
|----------|---------------|----------------|---------------|
| Hub Central | - | 8080 | https://localhost:8080/ |
| Helper API | 3100 | 3100 | http://localhost:8080/admin/ |
| Twenty CRM | 3000 | 3001 | http://localhost:8080/crm/ |
| n8n | 5678 | 5679 | http://localhost:8080/n8n/ |
| Dify Web | 3000 | 3003 | http://localhost:3003 (directo) |
| Chatwoot | 3000 | 3002 | http://localhost:8080/chatwoot/ |
| PostgreSQL | 5432 | - | Interno |
| Redis | 6379 | - | Interno |

### Credenciales Globales
| Plataforma | Usuario | Contraseña |
|-----------|---------|------------|
| Hub Central | - | - |
| Helper Dashboard | admin@wibsite.com | Admin@123 |
| n8n | admin@wibsite.com | Wibsite2024! |
| Dify | joserobertoquirogasalvador@gmail.com | Admin@123 |
| Twenty CRM | admin@wibsite.com | Admin@123 |
| Chatwoot | admin@wibsite.com | Admin@123 |

---

## 2. Hub Central (Nginx)

### Propósito
Página de aterrizaje tipo Odoo con acceso a todas las plataformas.

### URL
`https://localhost:8080/`

### Funcionalidad
- Mosaico con tarjetas para cada plataforma
- LEDs de estado (verde = online, rojo = offline, amarillo = pendiente)
- Puerto y credenciales visibles en cada tarjeta
- Redirección automática desde `http://localhost:8080/`

### Pruebas
- [x] `GET /hub/` → HTTP 200, HTML renderizado
- [x] `GET /` → Redirección 302 a /hub/
- [x] LEDs reflejan estado real de servicios

### Verificación Rápida
```powershell
curl.exe -s -o nul -w "%{http_code}" https://localhost:8080/
# Debe retornar: 200
```

---

## 3. Helper API y Dashboard

### Propósito
API central de integración + Dashboard SPA de monitoreo.

### URLs
- Dashboard: `http://localhost:8080/admin/`
- API Health: `http://localhost:8080/api/health`
- Swagger/REST: `http://localhost:8080/api/`

### Endpoints Clave

#### Campaigns
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/campaigns | Lista todas las campañas |
| POST | /api/campaigns | Crea campaña |
| GET | /api/campaigns/:id | Detalle de campaña |
| PATCH | /api/campaigns/:id | Actualiza campaña |
| POST | /api/campaigns/:id/start | Inicia envío |
| POST | /api/campaigns/:id/pause | Pausa envío |
| POST | /api/campaigns/:id/complete | Completa campaña |
| POST | /api/campaigns/:id/schedule | Programa envío |
| DELETE | /api/campaigns/:id | Elimina campaña |

#### Leads
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/campaigns/:id/leads | Crear leads individuales |
| GET | /api/campaigns/:id/leads | Listar leads de campaña |
| POST | /api/campaigns/:id/leads/upload | Subida masiva Excel/CSV |

#### Scoring
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/scoring/rules | Ver reglas de scoring |
| PUT | /api/scoring/rules | Actualizar reglas |
| POST | /api/scoring/evaluate | Evaluar lead individual |
| POST | /api/scoring/evaluate-all | Evaluar todos los leads |
| POST | /api/scoring/evaluate-llm | Evaluar con IA (OpenRouter) |

#### Twenty CRM Sync
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/twenty/health | Estado conexión Twenty |
| POST | /api/twenty/sync | Sincronizar lead individual |
| POST | /api/twenty/sync-all | Sincronizar todos los leads |

#### Agente comercial (grafo 8 etapas + RAG + cotización)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/agent/chat | Turno del agente (message/conversationId) — grafo con cuestionarios por servicio, KB (nodo kb) y mini-cotización (nodo cotizacion) |
| GET | /api/agent/templates | Listar plantillas de negocio |
| PUT | /api/agent/templates/:id | Guardar plantilla dinámicamente (products, questionnaire, estimate_factors) |
| GET | /api/agent/config · PUT | Configuración del agente por tenant |

#### Multicanal (Email · Telegram · WhatsApp · Messenger · TikTok)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/channels/status | Estado/configuración de los 5 canales |
| POST | /api/channels/test | Enviar mensaje de prueba `{channel, to, text}` |
| POST | /api/channels/broadcast | Broadcast multicanal `{channel, message_template, audience}` |
| GET+POST | /webhooks/telegram | Webhook Telegram (verificación + mensajes; voz/foto con STT/visión) |
| GET+POST | /webhooks/messenger | Webhook Messenger (hub.verify + mensajes) |
| POST | /webhooks/email-inbound | Entrada de email (proveedor-agnóstico) |
| POST | /webhooks/tiktok-comments | Comentarios TikTok (agregador/API) |
| POST | /webhooks/twilio-inbound | WhatsApp/Twilio inbound (existente) |

#### Portal (búsqueda, notificaciones, observabilidad)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/search?q= | Búsqueda global (leads + campañas) — Ctrl+K del portal |
| GET | /api/notifications | Notificaciones unificadas (incidentes/seguridad/fallbacks 24h) |
| GET | /api/internal/health-detailed | Dependencias reales (PG, Redis ping, Elastic cluster, LLM, canales, multimodal) |
| GET | /api/internal/alerts | Alertas activas |
| GET | /api/knowledge-base/query | Consulta directa a la base de conocimiento |

#### Dashboard
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/dashboard/summary | Estadísticas agregadas |
| GET | /api/channels | Estado de canales (LEDs) |
| PATCH | /api/channels/:channel | Actualizar estado canal |

#### LLM
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/llm/health | Estado OpenRouter |
| POST | /api/llm/chat | Chat completion |

#### Seed Data
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/seed | Generar datos de prueba |
| DELETE | /api/seed | Limpiar todos los datos |

### Dashboard SPA (Tabs)
1. **Dashboard** — Cards resumen + LEDs canales + barra entregas
2. **Campañas** — Tabla de campañas + botón Importar Leads
3. **Leads** — Tabla con scores, estados, filtros
4. **Plantillas** — Filtro por canal, preview, crear nueva
5. **Canales** — Detalle por canal (estado, errores, último check)

### Pruebas Rápidas
```powershell
# Health check
curl.exe -s http://localhost:8080/api/health | python -m json.tool

# List campaigns
curl.exe -s http://localhost:8080/api/campaigns | python -m json.tool

# Dashboard summary
curl.exe -s http://localhost:8080/api/dashboard/summary | python -m json.tool

# Scoring rules
curl.exe -s http://localhost:8080/api/scoring/rules | python -m json.tool

# LLM health
curl.exe -s http://localhost:8080/api/llm/health | python -m json.tool
```

---

## 4. Twenty CRM

### Propósito
CRM open-source para gestión de contactos, leads y oportunidades.

### URL
`http://localhost:8080/crm/`

### Autenticación
- Usuario: admin@wibsite.com
- Contraseña: Admin@123
- API Key (JWT): configurada en .env como TWENTY_API_KEY

### Operaciones desde Helper
- **Sync individual**: `POST /api/twenty/sync` — upsert por teléfono
- **Sync masivo**: `POST /api/twenty/sync-all` — sincroniza todos los leads
- **Health check**: `GET /api/twenty/health`

### Campos Custom en People
| Campo | Tipo | Descripción |
|-------|------|-------------|
| painPoints | TEXT | Problemas/necesidades del lead |
| interests | TEXT | Intereses del contacto |
| leadOrigin | TEXT | Origen del lead |
| leadScoreHistory | TEXT | Historial de scores (JSON) |
| leadLastScore | NUMBER | Último score calculado |
| leadCustomData | TEXT | Campos adicionales (JSON) |

### Nota Técnica
Twenty CRM usa namespace global para nombres de campo, por eso hay duplicación (scoreHistory y leadScoreHistory, etc.). Se usa prefijo `lead` para evitar colisiones.

### Pruebas Rápidas
```powershell
# Health
curl.exe -s http://localhost:8080/api/twenty/health | python -m json.tool

# Sync all leads to Twenty
curl.exe -s -X POST http://localhost:8080/api/twenty/sync-all | python -m json.tool
```

---

## 5. n8n (Automatización)

### Propósito
Orquestador de flujos visual para automatizar procesos de negocio.

### URL
`http://localhost:8080/n8n/`

### Autenticación
- Usuario: admin@wibsite.com
- Contraseña: Wibsite2024!
- Login usa `emailOrLdapLoginId` como campo

### Workflows Instalados
1. **01 - Inbound WhatsApp → Dify → Twenty CRM** (`ktheIzGfXPHbZ9Rg`)
   - Recibe webhook de Meta WhatsApp
   - Clasifica con Dify (LLM)
   - Actualiza Twenty CRM
   - Responde al usuario
2. **02 - Campaign Broadcast WhatsApp** (`kW9O2RkkwrmiGEjC`)
   - Obtiene leads de campaña activa
   - Envía mensajes vía Meta WhatsApp
   - Tracking de entregas

### Activar Workflows
1. Login en `http://localhost:8080/n8n/`
2. Ir a "Workflows"
3. Abrir workflow deseado
4. Click "Save" + "Active" toggle

### Webhooks de n8n
| Webhook | Descripción |
|---------|-------------|
| POST /webhook/whatsapp-inbound | Mensajes entrantes WhatsApp |

### Pruebas Rápidas
```powershell
# Verificar que n8n responde
curl.exe -s -o nul -w "%{http_code}" http://localhost:8080/n8n/
# Debe retornar: 200

# Login test
curl.exe -s -X POST http://localhost:8080/n8n/rest/login -H "Content-Type: application/json" -d '{"emailOrLdapLoginId":"admin@wibsite.com","password":"Wibsite2024!"}' | python -m json.tool
```

---

## 6. Dify (IA/LLM)

### Propósito
Plataforma de orquestación de IA low-code para workflows de clasificación, agentes conversacionales y RAG.

### URL
- Consola: `http://localhost:3003` (directo, no vía nginx)
- API: `http://localhost:5001`

### Autenticación
- Email: joserobertoquirogasalvador@gmail.com
- Contraseña: Admin@123
- API Key: `app-IohwPPX3HDWA46TQLEcGBZq0`

### Plugins Instalados
- `langgenius/openai_api_compatible:0.0.55` — Conexión OpenRouter

### Modelos OpenRouter Configurados
| Modelo | ID |
|--------|-----|
| GPT-4o Mini | openai/gpt-4o-mini |
| GPT-4o | openai/gpt-4o |
| GPT-4o Mini Search Preview | openai/gpt-4o-mini-search-preview |
| Llama 3.3 70B | meta-llama/llama-3.3-70b-instruct |
| Mistral Large | mistralai/mistral-large |

### App: WhatsApp Lead Classifier
- ID: `c7fdaa3c-d911-4cef-ae62-54bf206f2f78`
- Modo: Workflow
- Estado: Normal
- **Pendiente**: Construir grafo con 6 nodos

### Workflow YAML (whatsapp-lead-classifier.yml)
```
Nodos:
1. detect_language        → Detecta idioma del mensaje
2. classify_intent        → Clasifica intención (venta, soporte, info, queja)
3. extract_contact_data   → Extrae nombre, email, teléfono
4. calculate_score        → Calcula score del lead
5. generate_response      → Genera respuesta contextual
6. assemble_result        → Ensambla resultado final
```

### Pruebas Rápidas
```powershell
# Verificar Dify API
curl.exe -s http://localhost:5001/health | python -m json.tool

# Verificar app existe
curl.exe -s http://localhost:5001/console/api/apps -H "Authorization: Bearer app-IohwPPX3HDWA46TQLEcGBZq0" | python -m json.tool
```

---

## 7. Chatwoot (Inbox Omnicanal)

### Propósito
Sistema de inbox omnicanal para gestionar conversaciones de WhatsApp, Messenger, TikTok, etc.

### URL
`http://localhost:8080/chatwoot/`

### Autenticación
- Email: admin@wibsite.com
- Contraseña: Admin@123
- API Key: `SpMUEqpey6UiCxKq7wnoECD6`

### Estado Actual
- ✅ Chatwoot responde HTTP 200 (verificado)
- Inbox WhatsApp **no configurado** (requiere token permanente Meta)
- Webhook hacia n8n: **pendiente**

### Configuración de Inbox WhatsApp
1. Login en Chatwoot
2. Settings → Inboxes → Add Inbox
3. Seleccionar "WhatsApp"
4. Ingresar:
   - Phone Number ID: `1287367854450926`
   - Business Account ID: `1024953670257131`
   - Permanent Access Token (desde Meta Business Settings)
   - Webhook Verify Token: `wibsite_verify_2026`
5. Guardar y verificar webhook

### Pruebas Rápidas
```powershell
# Verificar Chatwoot
curl.exe -s -o nul -w "%{http_code}" http://localhost:8080/chatwoot/
# Debe retornar: 200

# Login API
curl.exe -s -X POST http://localhost:3002/api/v1/auth/sign_in -H "Content-Type: application/json" -d '{"email":"admin@wibsite.com","password":"Admin@123"}' -D - | findstr "access-token"
```

---

## 8. Meta/WhatsApp

### Propósito
Integración con WhatsApp Business API para envío y recepción de mensajes.

### Datos de Configuración
| Campo | Valor |
|-------|-------|
| App ID | 1694506861827055 |
| App Secret | <META_APP_SECRET de .env> |
| Phone Number ID | 1287367854450926 |
| WABA ID | 1024953670257131 |
| Page ID (Messenger) | 1344793823853080 |
| Verify Token | wibsite_verify_2026 |
| Número | +591 75210458 (Bolivia) |

### Token de Acceso
- **Tipo**: User Access Token (expira ~6h)
- **Estado**: Temporal — requiere permanent token desde Meta Business Settings

### Webhooks
| Ruta | Método | Descripción |
|------|--------|-------------|
| /webhooks/whatsapp | GET | Verificación Meta |
| /webhooks/whatsapp | POST | Recepción eventos + status updates |

### Flujo de Webhook
1. Meta envía POST a `/webhooks/whatsapp`
2. Helper procesa mensajes entrantes:
   - Texto "stop" → registra opt-out
   - Otro texto → crea lead + delivery + reenvía a n8n `/webhook/whatsapp-inbound`
3. Status updates → tracking de deliveries

### Pruebas Rápidas
```powershell
# Verificar webhook
curl.exe -s "http://localhost:8080/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=99999&hub.verify_token=wibsite_verify_2026"
# Debe retornar: 99999
```

---

## 9. Scoring Engine

### Propósito
Sistema de puntuación de leads (0-100) basado en reglas y opcionalmente IA.

### Factores Ponderados (Rule-Based)
| Factor | Peso | Descripción |
|--------|------|-------------|
| Engagement | 35% | replies, opens, clicks |
| Recency | 25% | días desde último contacto |
| Channel Affinity | 15% | segmento del lead |
| Profile Completeness | 15% | datos completos |
| Interest Match | 10% | interés conocido |

### Reglas Condicionales
| Regla | Condición | Score |
|-------|-----------|-------|
| Replied to message | has_replied = true | +20 |
| Opened message | has_opened = true | +10 |
| Clicked link | has_clicked = true | +15 |
| Has phone and email | has_both_contact = true | +10 |
| Has custom fields | custom_field_count >= 2 | +5 |
| Recent activity | days_since_contact <= 7 | +15 |
| Medium recency | days_since_contact 8-30 | +8 |
| Opted out | has_opted_out = true | -100 |

### Umbrales de Categoría
| Categoría | Rango | Descripción |
|-----------|-------|-------------|
| Hot | 70-100 | Alta probabilidad de conversión |
| Warm | 40-69 | Interesado, requiere seguimiento |
| Cold | 0-39 | Frío, necesita nurturing |

### Scoring con IA (OpenRouter)
Endpoint: `POST /api/scoring/evaluate-llm`
- Usa GPT-4o Mini para análisis contextual
- Prompt incluye datos del lead, entregas, campaña
- Retorna score + categoría + razonamiento

### Pruebas Rápidas
```powershell
# Ver reglas
curl.exe -s http://localhost:8080/api/scoring/rules | python -m json.tool

# Evaluar todos los leads
curl.exe -s -X POST http://localhost:8080/api/scoring/evaluate-all | python -m json.tool

# Scoring con IA (requiere lead_id)
curl.exe -s -X POST http://localhost:8080/api/scoring/evaluate-llm -H "Content-Type: application/json" -d '{"lead_id":"<LEAD_ID>"}' | python -m json.tool
```

---

## 10. Flujo Completo: Inbound WhatsApp

### Diagrama
```
Usuario → WhatsApp → Meta → Webhook POST → Helper → Crea Lead + Delivery
                                                     → Reenvía a n8n (/webhook/whatsapp-inbound)
                                                     → Dify clasifica (LLM)
                                                     → Twenty CRM sync
                                                     → Responde al usuario
```

### Pasos de Verificación
1. Enviar WhatsApp al número +591 75210458
2. Verificar en logs de helper: `docker logs wibsite-helper --tail 50`
3. Verificar lead creado: `GET /api/campaigns/:id/leads`
4. Verificar delivery: `GET /api/campaigns/:id/stats`
5. Verificar en Twenty CRM: `http://localhost:8080/crm/`
6. Verificar respuesta (si n8n workflow activo)

### Estado Actual
- [ ] Meta webhook registrado (requiere URL pública)
- [x] Webhook helper funcional (crea leads + deliveries)
- [ ] n8n workflow activo
- [ ] Dify workflow publicado
- [ ] Twenty sync automático

---

## 11. Flujo Completo: Campaign Broadcast

### Diagrama
```
Dashboard → Crear Campaña → Importar Leads (Excel) → Evaluar Scoring
                                                      → Sincronizar CRM (Twenty)
                                                      → Iniciar Envío
                                                      → Tracking de Entregas
                                                      → Reporte de Resultados
```

### Pasos de Verificación
1. Desde Dashboard: Tab Campañas → "Nueva Campaña"
2. Tab Leads → "Importar Leads" → subir Excel
3. Botón "📊 Score All" → evaluar todos los leads
4. Botón "☁ Sync CRM" → sincronizar a Twenty
5. Click "▶" en campaña → iniciar envío
6. Tab Dashboard → ver métricas en tiempo real

### Estado Actual
- [x] Crear campaña (POST /api/campaigns)
- [x] Importar Excel (POST /campaigns/:id/leads/upload)
- [x] Scoring evaluate-all
- [x] Sync Twenty CRM
- [ ] Envío real WhatsApp (requiere token permanente)
- [x] Tracking de entregas simulado

---

## 12. Pruebas por Módulo

### 12.1 Infraestructura
```powershell
# Todos los contenedores running
docker compose ps --format "table {{.Name}}\t{{.State}}"

# PostgreSQL health
docker exec wibsite-postgres pg_isready -U wibsite

# Redis health
docker exec wibsite-redis redis-cli ping

# Conectividad helper → servicios
docker exec wibsite-helper wget -qO- http://twenty-server:3000/healthz
docker exec wibsite-helper wget -qO- http://n8n:5678/healthz
```

### 12.2 Helper API Completa
```powershell
# 1. Health
curl.exe -s http://localhost:8080/api/health

# 2. Seed data
curl.exe -s -X POST http://localhost:8080/api/seed

# 3. List campaigns
curl.exe -s http://localhost:8080/api/campaigns | python -m json.tool

# 4. Dashboard summary
curl.exe -s http://localhost:8080/api/dashboard/summary | python -m json.tool

# 5. Channel status
curl.exe -s http://localhost:8080/api/channels | python -m json.tool

# 6. Templates
curl.exe -s http://localhost:8080/api/templates | python -m json.tool

# 7. Scoring evaluate-all
curl.exe -s -X POST http://localhost:8080/api/scoring/evaluate-all | python -m json.tool

# 8. Sync to Twenty
curl.exe -s -X POST http://localhost:8080/api/twenty/sync-all | python -m json.tool

# 9. Twenty health
curl.exe -s http://localhost:8080/api/twenty/health | python -m json.tool

# 10. LLM health
curl.exe -s http://localhost:8080/api/llm/health | python -m json.tool
```

### 12.3 Twenty CRM
```powershell
# REST API directa
curl.exe -s http://localhost:3001/rest/people -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjdlN2RjMjVmLTc0NTItNDJjNi04M2IyLTQ1YTI4ZDc5YjZiMCJ9.eyJzdWIiOiI5M2MyMTNiYi0yNjhkLTRmMjUtYmNhZS03NTYzMDgwYTk3ZTkiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiOTNjMjEzYmItMjY4ZC00ZjI1LWJjYWUtNzU2MzA4MGE5N2U5IiwiaWF0IjoxNzgzNjcyMjk2LCJleHAiOjQ5MzcxODU4OTUsImp0aSI6IjIxNzIyYWU1LWYwNDItNDM0MC04ZTBiLWQwODkwNDU2MTNmNiJ9.D8TZQXtSbS0P8emH7TB1wNRKVOC6kQXtncqXaMWg-8i3Wl13C1WWuUAtof1o0dzhro8ZQsV2fyBdatdqRLyTVw" | python -m json.tool
```

### 12.4 n8n
```powershell
# Login test
$body = @{emailOrLdapLoginId="admin@wibsite.com";password="Wibsite2024!"} | ConvertTo-Json
curl.exe -s -X POST http://localhost:8080/n8n/rest/login -H "Content-Type: application/json" -d $body | python -m json.tool
```

### 12.5 Dify
```powershell
# Health
curl.exe -s http://localhost:5001/health

# List apps (con API key correcta)
curl.exe -s http://localhost:5001/console/api/apps -H "Authorization: Bearer app-IohwPPX3HDWA46TQLEcGBZq0" | python -m json.tool
```

### 12.6 Chatwoot
```powershell
# Login y obtener token
$body = @{email="admin@wibsite.com";password="Admin@123"} | ConvertTo-Json
$headers = curl.exe -s -X POST http://localhost:3002/api/v1/auth/sign_in -H "Content-Type: application/json" -d $body -D -
$headers | Select-String "access-token"
```

### 12.7 Flujo End-to-End (Sin Meta)
```powershell
# 1. Seed data
curl.exe -s -X POST http://localhost:8080/api/seed | python -m json.tool

# 2. Verificar dashboard
curl.exe -s http://localhost:8080/api/dashboard/summary | python -m json.tool

# 3. Scoring masivo
curl.exe -s -X POST http://localhost:8080/api/scoring/evaluate-all | python -m json.tool

# 4. Sync a Twenty
curl.exe -s -X POST http://localhost:8080/api/twenty/sync-all | python -m json.tool

# 5. Verificar leads con score
curl.exe -s "http://localhost:8080/api/leads/top?limit=5" | python -m json.tool

# 6. Crear campaña nueva
$camp = @{name="Test E2E $(Get-Date -Format HH:mm)";channel="whatsapp";message_template="Hola {{name}}, test E2E"} | ConvertTo-Json
curl.exe -s -X POST http://localhost:8080/api/campaigns -H "Content-Type: application/json" -d $camp | python -m json.tool

# 7. Ver plantillas
curl.exe -s http://localhost:8080/api/templates | python -m json.tool

# 8. Preview template
$preview = @{template_id="welcome-whatsapp";values=@{name="Test";business="Wibsite"}} | ConvertTo-Json
curl.exe -s -X POST http://localhost:8080/api/templates/preview -H "Content-Type: application/json" -d $preview | python -m json.tool
```
