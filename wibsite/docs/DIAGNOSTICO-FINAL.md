# Wibsite — Diagnóstico Final del Sistema

> **Fecha:** Agosto 2026 | **Metodología:** pruebas unitarias + verificación CLI + inter-módulo + HTTPS SSO

---

## 1. Resultados de Pruebas

| Tipo | Resultado | Detalle |
|------|-----------|---------|
| Unitarias | **112/112 PASS** | 8 suites: security, conversation, leadProfile, agentConfig, ragEngine, antiHallucination, rateLimiter, integration |
| API endpoints | **12/12 PASS** | Health, campaigns, channels, templates, agent graph, LLM, Twenty, search, logs, webhook, trends, opt-out |
| Inter-módulo | **8/8 OK** | PG↔Helper, Redis↔Helper, Weaviate↔Helper, LLM↔Helper, Chatwoot↔Helper, n8n↔Helper, Twenty↔Helper, Dify↔Helper |
| HTTPS SSO | **6/6 redirigen** | /chatwoot/, /n8n/, /crm/, /dify/, /grafana/, /minio-console/ → todos 302 a /auth/ |
| Contenedores | **23/23 UP** | Sin restart loops, sin unhealthy |
| verify-final | **13/22** | 9 falsos negativos por HTTP→HTTPS (script usa http en vez de https) |

---

## 2. Estado por Módulo

| Módulo | Operativo | SSO | OIDC | Observaciones |
|--------|-----------|-----|------|---------------|
| **Helper Node v2.2.0** | ✅ | ✅ | N/A | 50+ endpoints, 112 tests, store dual |
| **PostgreSQL** | ✅ | N/A | N/A | 7 tablas + audit_logs |
| **Redis** | ✅ | N/A | N/A | Conversation store 9 estados |
| **Weaviate** | ✅ | N/A | N/A | RAG con 3 chunks cargados |
| **Nginx v5** | ✅ | ✅ | N/A | HTTPS + TLS 1.2/1.3, 10 security headers, 18 rutas |
| **Authelia** | ✅ | ✅ | ✅ | 5 OIDC clients configurados, discovery OK |
| **n8n** | ✅ | ✅ | ⚠️ | 3 workflows activos, body parser bug, OIDC env vars puestas |
| **Chatwoot** | ✅ | ✅ | ⚠️ | Bridge Twilio funcional, OIDC requiere config manual en UI |
| **Twenty CRM** | ✅ | ✅ | ⚠️ | 7 campos SPICED/MEDDIC, sync bidireccional, OIDC requiere config manual |
| **Dify** | ✅ | ✅ | ⚠️ | Workflow classifier publicado, OIDC requiere config manual en UI |
| **Grafana** | ✅ | ✅ | ✅ | Auth proxy configurado (X-WEBAUTH-USER) |
| **Prometheus** | ✅ | N/A | N/A | Métricas helper + cAdvisor, puerto 9090 |
| **cAdvisor** | ✅ | N/A | N/A | Métricas Docker |
| **GlitchTip** | ✅ | ✅ | 🔴 | Worker roto (celery no encontrado), sin superuser |
| **MinIO** | ✅ | ✅ | ⚠️ | OIDC env vars puestas, bucket pendiente crear |
| **Twilio Bridge** | ✅ | N/A | N/A | Inbound/outbound/status callbacks completos |
| **Dashboard SPA** | ✅ | ✅ | N/A | 5 tabs, gráficos, botones acción rápida |
| **Portal Shell** | ✅ | ✅ | N/A | 9 módulos, sidebar, iframe, Quick Launch |
| **Hub** | ✅ | Público | N/A | Health checks en vivo, 17 servicios, 7 flujos |

---

## 3. Flujos Verificados

| Flujo | Estado | Pasos completados |
|-------|--------|-------------------|
| **SSO Login** | ✅ | /module → 302 → /auth/ → login → redirect → module |
| **Twilio Inbound** | ✅ | WhatsApp → POST /webhooks/twilio-inbound → lead+delivery → Chatwoot → n8n |
| **Twilio Broadcast** | ✅ | Campaign → n8n workflow 02 → /api/twilio/send → StatusCallback |
| **Scoring Rule-Based** | ✅ | 5 factores + 8 reglas → evaluate/evaluate-all → hot/warm/cold |
| **Scoring LLM** | ✅ | OpenRouter GPT-4o → /api/scoring/evaluate-llm → score 0-100 |
| **Twenty CRM Sync** | ✅ | Helper → upsert por teléfono → /rest/people → bidireccional via webhook |
| **Agent Commercial** | ✅ | 7 etapas: entry→discovery→qualification→proposal→closing→handoff→followup |
| **Opt-Out** | ✅ | STOP detection → /opt-outs → check-batch → bloqueo envíos |
| **Chatwoot Bridge** | ✅ | pushToChatwoot() → contacto+conversación → outbound webhook → Twilio send |
| **RAG KB** | ✅ | load-kb-documents.js → Weaviate → 3 chunks FAQ |
| **Dify Workflow** | ✅ | 8 nodos LLM → publicado → verify-dify-workflow.js (200 OK) |
| **Email/CSV Import** | ✅ | Excel/CSV drag-drop → auto-detección columnas → created/errors/duplicates |
| **Audit Logging** | ✅ | 12 event types → PG audit_logs → GET /api/logs |

---

## 4. Gaps Identificados

### 🔴 Críticos

| # | Gap | Impacto | Solución |
|---|-----|---------|----------|
| G1 | **verify-final.ps1 obsoleto** | Falsos negativos por HTTP→HTTPS | Actualizar script a usar HTTPS |
| G2 | **GlitchTip worker roto** | Sin procesamiento de errores en background | Cambiar comando worker en docker-compose |
| G3 | **n8n body parser bug** | No se pueden gestionar credenciales vía API | Usar UI manual o upgrade n8n |
| G4 | **OIDC no verificado en n8n/Chatwoot/Twenty/Dify** | Los usuarios ven doble login | Configurar manualmente en cada UI |
| G5 | **Sin CI/CD** | Sin tests automáticos en cada cambio | Crear .github/workflows/ci.yml |

### 🟡 Medios

| # | Gap | Impacto | Solución |
|---|-----|---------|----------|
| G6 | **Sin multi-tenant** | Datos no aislados entre clientes | tenant_id + RLS + middleware |
| G7 | **Sin load testing** | Sin evidencia del techo del host | k6 script 50 conversaciones simultáneas |
| G8 | **Prometheus/Grafana sin dashboards** | Métricas sin visualizar | Configurar datasource + dashboard |
| G9 | **GlitchTip sin superuser** | Error tracking sin acceso | `docker exec ... createsuperuser` |
| G10 | **MinIO sin bucket** | Storage sin contenedor | Crear bucket wibsite-media |
| G11 | **nginx warning `duplicate MIME type`** | Warning cosmético | Quitar duplicado en sub_filter_types |
| G12 | **HTTPS cert autofirmado** | Warning en navegador | Aceptable en desarrollo, Let's Encrypt en prod |

### 🟢 Bajos

| # | Gap | Impacto | Solución |
|---|-----|---------|----------|
| G13 | **manifest.json 404** | Error en consola, sin impacto | Ignorar o agregar ruta |
| G14 | **Frappe ERP no iniciado** | Fase 2, sin impacto actual | Planificado post-pilotos |
| G15 | **Planes SaaS no implementados** | Sin límites por tenant | planLimiter middleware |
| G16 | **Meta API sin credenciales** | Twilio la reemplaza | Obtener credenciales Meta |
| G17 | **Dashboard sin gráficos avanzados** | Visualización básica | Chart.js en SPA |

---

## 5. Diagrama de Problemas a Resolver

```
URGENTE (1-2h)
├── G1: Actualizar verify-final.ps1 → HTTPS
├── G2: Arreglar GlitchTip worker
├── G4: Configurar OIDC en n8n/Chatwoot/Twenty/Dify (manual en UI)
└── G10: Crear bucket MinIO wibsite-media

IMPORTANTE (1-3 días)
├── G5: Configurar CI/CD pipeline
├── G6: Implementar multi-tenant (RLS + middleware)
├── G8: Crear dashboards Grafana
└── G9: Crear superuser GlitchTip

PLANIFICADO (futuro)
├── G7: Load testing 50 conversaciones
├── G14: Frappe ERP
├── G15: Planes SaaS
└── G16: Meta API (cuando lleguen credenciales)
```

---

## 6. Rutas y URLs Verificadas

| Ruta | Tipo | Auth | Status |
|------|------|------|--------|
| `/hub/` | Estático | No | 200 |
| `/health` | Helper | No | 200 |
| `/webhooks/` | Helper | No | 200 |
| `/auth/` | Authelia | No | 200 |
| `/admin/` | Helper SPA | SSO | 302→auth |
| `/n8n/` | n8n | SSO | 302→auth |
| `/chatwoot/` | Chatwoot | SSO | 302→auth |
| `/crm/` | Twenty | SSO | 302→auth |
| `/dify/` | Dify | SSO | 302→auth |
| `/portal/` | Portal | SSO | 302→auth |
| `/grafana/` | Grafana | SSO | 302→auth |
| `/glitchtip/` | GlitchTip | SSO | 302→auth |
| `/minio-console/` | MinIO | SSO | 302→auth |
| `/storage/` | MinIO API | No | 200 |
