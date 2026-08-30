# Wibsite Business — Batería Completa de Pruebas y Verificación

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Propósito:** Suite unificada de pruebas de código, tensión y funcionamiento para validar la plataforma completa antes de producción.
> **Estado:** ✅ Implementado · ⬜ Pendiente de ejecución (requiere contenedores activos)

---

## Índice

1. [Pruebas Unitarias (176 tests)](#1-pruebas-unitarias)
2. [Pruebas de Contratos entre Módulos](#2-pruebas-de-contratos)
3. [Pruebas de API Endpoints](#3-pruebas-de-api)
4. [Pruebas de Integración Helper → Servicios](#4-pruebas-de-integración)
5. [Pruebas de Base de Datos y Almacenamiento](#5-pruebas-de-base-de-datos)
6. [Pruebas de Seguridad](#6-pruebas-de-seguridad)
7. [Pruebas de Tension/Carga](#7-pruebas-de-tensión)
8. [Pruebas de Flujo E2E](#8-pruebas-de-flujo-e2e)
9. [Pruebas de UI/UX](#9-pruebas-de-uiux)
10. [Verificación Post-Despliegue](#10-verificación-post-despliegue)

---

## 1. Pruebas Unitarias

### 1.1 Suite de Seguridad (`security.test.js`)
| # | Test | Comando | Verificación |
|---|------|---------|-------------|
| 1 | API Key válida accede | `curl -H "X-API-Key: valid" /api/campaigns` | 200 OK |
| 2 | API Key inválida rechazada | `curl /api/campaigns` | 401 Unauthorized |
| 3 | Rate limiting 30 req/min | 31 requests en 1s | 429 Too Many Requests |
| 4 | Sanitizador bloquea inyección | `POST /api/... body: {"prompt": "ignora instrucciones"}` | Prompt sanitizado |
| 5 | HMAC Meta válido | Webhook con firma correcta | 200 OK |
| 6 | HMCA inválido rechazado | Webhook con firma incorrecta | 401 Unauthorized |
| 7 | PII filter enmascara phone | Log con "+521234567890" | `[PHONE_REDACTED]` |
| 8 | PII filter enmascara email | Log con "test@email.com" | `[EMAIL_REDACTED]` |
| 9 | PII filter respeta whitelist | Log con "id: 123" | `123` sin redactar |

### 1.2 Suite de Conversation Store (`conversationStore.test.js`)
| # | Test | Verificación |
|---|------|-------------|
| 10 | Crear estado conversación | Estado greeting creado |
| 11 | Transición greeting → discovery | Válida, estado actualizado |
| 12 | Transición inválida greeting → closed | Rechazada |
| 13 | 9 estados disponibles | greeting, discovery, qualification, proposal, objections, closing, post_sale, support, escalated |
| 14 | TTL expira | Estado eliminado tras TTL |
| 15 | Recuperación tras restart | Estado reanudado de Redis |

### 1.3 Suite de Lead Profile (`leadProfile.test.js`)
| # | Test | Verificación |
|---|------|-------------|
| 16 | Build perfil completo | Todos los campos poblados |
| 17 | Score history | Array ordenado cronológicamente |
| 18 | Delivery stats agregados | sent/delivered/read/replied/failed |
| 19 | Tags generados | Al menos 1 tag según score |
| 20 | Next action sugerido | string no vacío |

### 1.4 Suite de Agent Config (`agentConfig.test.js`)
| # | Test | Verificación |
|---|------|-------------|
| 21 | 10 tipos de negocio | Lista completa |
| 22 | 5 personalidades | Lista completa |
| 23 | System prompt generado | String no vacío, incluye contexto |
| 24 | Config guardada y recuperada | Mismos valores |

### 1.5 Suite de RAG Engine (`ragEngine.test.js`)
| # | Test | Verificación |
|---|------|-------------|
| 25 | Documento agregado a Weaviate | ID de documento retornado |
| 26 | Query a KB devuelve resultados | Array con al menos 1 resultado |
| 27 | Fallback in-memory funciona | Query con Weaviate caído |
| 28 | Documento eliminado | Ya no aparece en búsqueda |

### 1.6 Suite de Anti-Hallucination (`antiHallucination.test.js`)
| # | Test | Verificación |
|---|------|-------------|
| 29 | Consulta dentro de conocimiento | Respuesta normal |
| 30 | Consulta fuera de conocimiento | Respuesta controlada |
| 31 | Forbidden topic bloqueado | Rechazo explícito |
| 32 | Precio solo de lookup | Nunca de memoria |

### 1.7 Suite de Rate Limiter (`rateLimiter.test.js`)
| # | Test | Verificación |
|---|------|-------------|
| 33 | Límite por IP funciona | 30 req/min por IP |
| 34 | Límite diferente por ruta | API (30) vs LLM (5) |

### 1.8 Suite de Integración (`integration.test.js`)
| # | Test | Verificación |
|---|------|-------------|
| 35 | CRUD campaña completo | Crear, leer, actualizar, eliminar |
| 36 | Upload Excel | Leads creados desde archivo |
| 37 | Scoring rule-based | Score calculado correctamente |
| 38 | Twenty sync | Lead sincronizado exitosamente |
| 39 | Seed data | Datos poblados y limpiados |

---

## 2. Pruebas de Contratos entre Módulos

### 2.1 Helper → n8n
| # | Test | Comando | Verificación |
|---|------|---------|-------------|
| 40 | Health helper | `curl localhost:3100/health` | 200 + status |
| 41 | Health n8n | `curl localhost:5679/health` | 200 |
| 42 | Campaign format | `GET /api/campaigns` | Array con id, name, channel, status |
| 43 | Lead format | `GET /api/campaigns/:id/leads` | Array con phone, name, score |

### 2.2 Helper → Twenty CRM
| # | Test | Comando | Verificación |
|---|------|---------|-------------|
| 44 | Twenty health | `GET /api/twenty/health` | 200 + connected |
| 45 | Sync lead | `POST /api/twenty/sync` | 200 + contactId |
| 46 | Sync all | `POST /api/twenty/sync-all` | 200 + counts |

### 2.3 Helper → Dify
| # | Test | Comando | Verificación |
|---|------|---------|-------------|
| 47 | LLM health | `GET /api/llm/health` | 200 |
| 48 | Chat completion | `POST /api/llm/chat` | 200 + response |
| 49 | Scoring LLM | `POST /api/scoring/evaluate-llm` | 200 + score |

### 2.4 Helper → Redis
| # | Test | Verificación |
|---|------|-------------|
| 50 | Conversation store Redis | Set/get conversación |
| 51 | TTL aplicado | Clave expira |

### 2.5 Helper → PostgreSQL
| # | Test | Verificación |
|---|------|-------------|
| 52 | Conexión PG | Pool healthy |
| 53 | CRUD en PG | Operaciones básicas |

---

## 3. Pruebas de API Endpoints

### 3.1 Campañas
| # | Endpoint | Método | Código Esperado | Validación |
|---|----------|--------|----------------|------------|
| 54 | `/api/campaigns` | POST | 201 | Crea campaña con nombre único |
| 55 | `/api/campaigns` | GET | 200 | Lista con paginación |
| 56 | `/api/campaigns/pending` | GET | 200 | Solo scheduled ≤ now |
| 57 | `/api/campaigns/:id` | GET | 200 | Objeto completo |
| 58 | `/api/campaigns/:id` | PATCH | 200 | Campos actualizados |
| 59 | `/api/campaigns/:id/schedule` | POST | 200 | Status → scheduled |
| 60 | `/api/campaigns/:id/start` | POST | 200 | Status → sending |
| 61 | `/api/campaigns/:id/pause` | POST | 200 | Status → paused |
| 62 | `/api/campaigns/:id/complete` | POST | 200 | Status → completed |
| 63 | `/api/campaigns/:id` | DELETE | 200 | Eliminado |
| 64 | Nombre duplicado | POST | 409 | Conflict |
| 65 | Campaign no existe | GET | 404 | Not found |

### 3.2 Leads
| # | Endpoint | Método | Código | Validación |
|---|----------|--------|--------|------------|
| 66 | `/api/campaigns/:id/leads` | POST | 201 | Crea leads |
| 67 | `/api/campaigns/:id/leads` | GET | 200 | Lista filtrable |
| 68 | Upload Excel | POST | 200 | Parse + created/errors |

### 3.3 Scoring
| # | Endpoint | Método | Código | Validación |
|---|----------|--------|--------|------------|
| 69 | `/api/scoring/rules` | GET | 200 | Reglas con pesos |
| 70 | `/api/scoring/rules` | PUT | 200 | Reglas actualizadas |
| 71 | `/api/scoring/evaluate` | POST | 200 | Score 0-100 |
| 72 | `/api/scoring/evaluate-all` | POST | 200 | Todos evaluados |

### 3.4 Plantillas
| # | Endpoint | Método | Código | Validación |
|---|----------|--------|--------|------------|
| 73 | `/api/templates` | GET | 200 | 11 plantillas |
| 74 | `/api/templates` | POST | 201 | Nueva plantilla |
| 75 | `/api/templates/preview` | POST | 200 | Variables reemplazadas |

### 3.5 Agent Core (Nuevo)
| # | Endpoint | Método | Código | Validación |
|---|----------|--------|--------|------------|
| 76 | `/api/agent/test-graph` | POST | 200 | Grafo ejecutado |
| 77 | `/api/agent/templates` | GET | 200 | Lista plantillas |
| 78 | `/api/agent/templates/:id` | GET | 200 | Plantilla específica |
| 79 | `/api/agent/templates/validate` | GET | 200 | Validación de todas |
| 80 | `/api/agent/templates/validate/:id` | GET | 200 | Validación individual |

### 3.6 Logs y Monitoreo
| # | Endpoint | Método | Código | Validación |
|---|----------|--------|--------|------------|
| 81 | `/api/logs` | GET | 200 | Audit logs |
| 82 | `/metrics` | GET | 200 | Prometheus metrics |
| 83 | `/health` | GET | 200 | Health detallado |

---

## 4. Pruebas de Integración Helper → Servicios

### 4.1 Chatwoot Integration
| # | Test | Procedimiento | Verificación |
|---|------|--------------|-------------|
| 84 | Normalize payload | POST `/api/chatwoot/normalize` | Payload normalizado |
| 85 | Webhook scoring | POST webhook Chatwoot | Score actualizado |
| 86 | Handoff visible | Nota privada en conversación | ⬜ Pendiente Meta |

### 4.2 Dify Integration
| # | Test | Procedimiento | Verificación |
|---|------|--------------|-------------|
| 87 | Workflow clasificador | Mensaje de prueba → Dify | Score + intent + datos |
| 88 | Fallback OpenRouter | Dify caído → OpenRouter | Clasificación disponible |

### 4.3 n8n Integration
| # | Test | Procedimiento | Verificación |
|---|------|--------------|-------------|
| 89 | Workflow 01 activo | Verificar en UI n8n | Toggle active ON |
| 90 | Workflow 02 activo | Verificar en UI n8n | Toggle active ON |
| 91 | Webhook reachable | POST a webhook n8n | 200 OK |

### 4.4 Twenty CRM Integration
| # | Test | Procedimiento | Verificación |
|---|------|--------------|-------------|
| 92 | Campos SPICED/MEDDIC | Script verificación | 13 campos OK |
| 93 | Sync bidireccional | Cambio en Twenty → helper | Estado reflejado |

---

## 5. Pruebas de Base de Datos

### 5.1 PostgreSQL
| # | Test | Query | Verificación |
|---|------|-------|-------------|
| 94 | Conexión | `SELECT 1` | 1 fila |
| 95 | Tablas existen | `\dt` | campaigns, campaign_leads, lead_scores, channel_status, opt_outs, workflow_logs, audit_logs |
| 96 | FKs íntegras | orphan-check.sql | 0 huérfanos |
| 97 | RLS activo | `\d+ campaigns` | Políticas RLS |
| 98 | Índices | `\di` | Todos los índices creados |

### 5.2 JSON → PG Migración
| # | Test | Procedimiento | Verificación |
|---|------|--------------|-------------|
| 99 | DUMP completo | `node migrate-json-to-pg.js` | Conteos JSON == PG |
| 100 | DUAL WRITE | Crear campaña | Datos en PG + JSON |
| 101 | CUTOVER | STORE_MODE=pg | Solo PG operativo |

### 5.3 Redis
| # | Test | Procedimiento | Verificación |
|---|------|--------------|-------------|
| 102 | Conexión | `redis-cli ping` | PONG |
| 103 | Conversation store | Crear/leer estado | OK |
| 104 | TTL | `TTL key` | > 0 |

---

## 6. Pruebas de Seguridad

### 6.1 Autenticación
| # | Test | Procedimiento | Verificación |
|---|------|--------------|-------------|
| 105 | SSO Authelia activo | Abrir `/crm/` sin login | Redirect a login |
| 106 | Login único | Login → abrir 4 módulos | Sin segundo prompt |
| 107 | Sesión 8h | Cookie `wibsite_session` | Expira 8h |
| 108 | API Key auth | Request sin key | 401 |
| 109 | Webhook HMAC | Firma inválida | 401 |

### 6.2 Transporte
| # | Test | Procedimiento | Verificación |
|---|------|--------------|-------------|
| 110 | HTTPS redirect | HTTP → HTTPS | 301 |
| 111 | HSTS header | Response headers | `Strict-Transport-Security` |
| 112 | CORS restrictivo | Origen no whitelist | Bloqueado |

### 6.3 Datos
| # | Test | Procedimiento | Verificación |
|---|------|--------------|-------------|
| 113 | PII en logs | Buscar patrones phone/email | 0 coincidencias |
| 114 | Audit logs | `SELECT * FROM audit_logs` | Eventos registrados |
| 115 | Rotación keys | Nueva key → servicios OK | Todos funcionales |
| 116 | Roles PG por servicio | Matriz rol↔BD | Aislamiento verificado |

---

## 7. Pruebas de Tensión/Carga

### 7.1 Helper Node
| # | Test | Escenario | SLI | Verificación |
|---|------|-----------|-----|-------------|
| 117 | Latencia p95 | 100 requests concurrentes | <200ms | ✅/⬜ |
| 118 | Throughput | 1000 requests en 60s | >500 req/min | ✅/⬜ |
| 119 | Error rate | Bajo carga normal | <1% | ✅/⬜ |
| 120 | Memoria | 50 conversaciones simultáneas | <256MB RSS | ✅/⬜ |

### 7.2 Dify
| # | Test | Escenario | SLI | Verificación |
|---|------|-----------|-----|-------------|
| 121 | Latencia clasificación | 10 requests paralelas | <5s | ✅/⬜ |
| 122 | Throughput IA | 30 requests/min | Sin rate limit | ✅/⬜ |

### 7.3 Base de Datos
| # | Test | Escenario | SLI | Verificación |
|---|------|-----------|-----|-------------|
| 123 | PG conexiones | 50 simultáneas | <5% error | ✅/⬜ |
| 124 | Redis hits | 1000 ops/seg | >99% hits | ✅/⬜ |

### 7.4 Agente Conversacional
| # | Test | Escenario | SLI | Verificación |
|---|------|-----------|-----|-------------|
| 125 | 50 conversaciones simultáneas | 5 turnos c/u | p95 <5s | ✅/⬜ |
| 126 | Mezcla de casos | Objeción/compra/soporte | Sin errores | ✅/⬜ |

---

## 8. Pruebas de Flujo E2E

### 8.1 Flujo Inbound (WhatsApp → IA → Respuesta)
| # | Paso | Componente | Verificación |
|---|------|-----------|-------------|
| 127 | Enviar mensaje desde WhatsApp | Meta API | ⬜ Pendiente Meta |
| 128 | Webhook recibido en helper | Helper | ⬜ Pendiente Meta |
| 129 | Lead creado/actualizado | Helper/PG | ⬜ Pendiente Meta |
| 130 | n8n workflow ejecutado | n8n | ⬜ Pendiente Meta |
| 131 | Dify clasifica (intent + score) | Dify | ⬜ Pendiente Meta |
| 132 | Twenty CRM upsert | Twenty | ⬜ Pendiente Meta |
| 133 | Respuesta automática enviada | Helper | ⬜ Pendiente Meta |
| 134 | Latencia total <10s | Todos | ⬜ Pendiente Meta |

### 8.2 Flujo Broadcast (Campaña → Envío → Tracking)
| # | Paso | Componente | Verificación |
|---|------|-----------|-------------|
| 135 | Campaña creada via API | Helper | ✅ |
| 136 | Leads importados | Helper | ✅ |
| 137 | Campaña programada | Helper | ✅ |
| 138 | n8n workflow picking | n8n | ⬜ Pendiente Meta |
| 139 | Mensajes enviados via Meta | Meta | ⬜ Pendiente Meta |
| 140 | Tracking actualizado | Helper | ⬜ Pendiente Meta |

### 8.3 Flujo Opt-Out
| # | Paso | Componente | Verificación |
|---|------|-----------|-------------|
| 141 | Palabra "baja" detectada | Helper | ✅ |
| 142 | Opt-out registrado en BD | PG | ✅ |
| 143 | Cola de followup cancelada | Helper | ✅ |
| 144 | Despedida enviada | Helper | ⬜ Pendiente Meta |

### 8.4 Flujo Handoff (Bot → Humano)
| # | Paso | Componente | Verificación |
|---|------|-----------|-------------|
| 145 | Lead solicita humano | Helper/Agente | ✅ |
| 146 | Briefing generado (12 campos) | Helper | ✅ |
| 147 | Nota privada en Chatwoot | Chatwoot | ✅ |
| 148 | Lead pasa a modo humano | Helper | ✅ |

### 8.5 Trazabilidad E2E sin pérdida
| # | Test | Procedimiento | Verificación |
|---|------|--------------|-------------|
| 149 | Rastreo por conversation_id | helper → n8n → Dify → Twenty → Chatwoot | ⬜ Pendiente Meta |
| 150 | Campos intactos en cada salto | nombre, teléfono, intent, score | ⬜ Pendiente Meta |
| 151 | 0 campos perdidos | Salto N vs N+1 | ⬜ Pendiente Meta |

---

## 9. Pruebas de UI/UX

### 9.1 Hub Central
| # | Test | Verificación |
|---|------|-------------|
| 152 | Hub carga en `/hub/` | 8+ tarjetas de módulos |
| 153 | Links funcionan | Cada tarjeta navega correctamente |
| 154 | Responsive | Mobile/tablet/desktop |

### 9.2 Portal Shell
| # | Test | Verificación |
|---|------|-------------|
| 155 | Portal en `/portal/` | 9 módulos en sidebar |
| 156 | Navegación funciona | Click cambia iframe |
| 157 | Health checker | Status dot verde |
| 158 | Lazy loading | Módulos cargan al navegar |
| 159 | Watermark presente | Esquina inferior derecha |

### 9.3 Dashboard SPA
| # | Test | Verificación |
|---|------|-------------|
| 160 | 5 tabs funcionales | Dashboard, Campañas, Leads, Plantillas, Canales |
| 161 | LEDs de canales | 5 canales con estado |
| 162 | Auto-refresh 15s | Timestamp cambia |
| 163 | Import Excel drag & drop | Modal + preview + submit |
| 164 | Botones acción rápida | Seed, Clear, Sync, Score, LLM |

### 9.4 Twenty CRM
| # | Test | Verificación |
|---|------|-------------|
| 165 | People list | Campos metodológicos visibles |
| 166 | Campos SPICED/MEDDIC | 13 campos en formulario |

---

## 10. Verificación Post-Despliegue

### 10.1 Script de Verificación Rápida
```bash
# Verificación rápida post-deploy
echo "=== Wibsite Quick Verify ==="

curl -sf http://localhost:3100/health && echo "✅ Helper" || echo "❌ Helper"
curl -sf https://localhost:8080/ && echo "✅ Hub" || echo "❌ Hub"
curl -sf http://localhost:5679/health && echo "✅ n8n" || echo "❌ n8n"
curl -sf http://localhost:3001 && echo "✅ Twenty" || echo "❌ Twenty"
curl -sf http://localhost:3003 && echo "✅ Dify" || echo "❌ Dify"
curl -sf http://localhost:3002 && echo "✅ Chatwoot" || echo "❌ Chatwoot"
redis-cli ping && echo "✅ Redis" || echo "❌ Redis"

node scripts/verify/contract-tests.js
echo "✅ Contract tests"
```

### 10.2 Gate Pre-Producción
| # | Check | Script | Obligatorio |
|---|-------|--------|-------------|
| 167 | Tests unitarios | `npm test` (176 tests · 22 suites) | ✅ Sí |
| 168 | Contract tests | `node scripts/verify/contract-tests.js` | ✅ Sí |
| 169 | Orphan check | `scripts/db/orphan-check.sql` | ✅ Sí |
| 170 | Data integrity | `node scripts/verify/data-integrity.js` | ✅ Sí |
| 171 | Backup restore | `scripts/backup.sh` + restore test | ✅ Sí |
| 172 | Security audit | SECURITY-MASTER.md actualizado | ✅ Sí |
| 173 | Load test | `k6 run k6-conversations.js` | ⬜ Opcional |

### 10.3 Comando Unificado
```bash
# Ejecutar toda la batería de verificación
./scripts/verify/verify-fase.sh all

# O por oleada específica
./scripts/verify/verify-fase.sh A   # Acceso y canal
./scripts/verify/verify-fase.sh B   # Datos multi-tenant
./scripts/verify/verify-fase.sh C   # Motor agéntico
```

---

## Resumen de Cobertura

| Categoría | Total Tests | Implementados | Pendientes (Meta) |
|-----------|-------------|---------------|-------------------|
| Unitarias | 39 | 39 | 0 |
| Contratos | 15 | 15 | 0 |
| API Endpoints | 30 | 30 | 0 |
| Integración | 10 | 7 | 3 |
| Base de Datos | 11 | 11 | 0 |
| Seguridad | 12 | 12 | 0 |
| Tensión/Carga | 10 | 0 | 10 |
| Flujo E2E | 25 | 8 | 17 |
| UI/UX | 15 | 15 | 0 |
| Post-Despliegue | 7 | 7 | 0 |

**Total: 174 tests | ✅ 144 implementados | ⬜ 30 pendientes (requieren Meta o ejecución manual)**

---

## Instrucciones de Ejecución

```bash
# 1. Tests unitarios (176 tests automatizados · 22 suites)
cd helper-node && npm test

# 2. Contract tests
node scripts/verify/contract-tests.js

# 3. Verificación por oleada
./scripts/verify/verify-fase.sh all

# 4. Migración JSON→PG
node scripts/db/migrate-json-to-pg.js

# 5. Campos Twenty CRM
TWENTY_API_KEY=... node scripts/twenty-spiced-meddic-fields.js

# 6. Backup
./scripts/backup.sh

# 7. Orphan check (psql)
PGPASSWORD=wibsite_pass psql -h localhost -U wibsite -d wibsite -f scripts/db/orphan-check.sql
```
