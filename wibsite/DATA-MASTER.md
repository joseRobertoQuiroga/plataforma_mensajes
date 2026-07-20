# Wibsite Business — DATA-MASTER: Datos y Analytics

> **Versión:** 1.0 — Julio 2026
> **Propósito:** Definir el modelo de datos, flujos de información, estrategia de almacenamiento y analytics del sistema, con balance entre seguridad, consistencia y rendimiento.
> **Filosofía:** Datos normalizados y seguros sin llegar a blindaje bancario. Suficiente estructura para evitar datos huérfanos e inconsistencies, sin枷ar el rendimiento.

---

## Índice

1. [Principios de Diseño de Datos](#1-principios-de-diseño-de-datos)
2. [Modelo de Datos Consolidado](#2-modelo-de-datos-consolidado)
3. [Flujo E2E de un Dato](#3-flujo-e2e-de-un-dato)
4. [Estrategia de Almacenamiento por Tipo de Dato](#4-estrategia-de-almacenamiento-por-tipo-de-dato)
5. [Normalización vs Rendimiento](#5-normalización-vs-rendimiento)
6. [Seguridad de Datos (Nivel Medio)](#6-seguridad-de-datos-nivel-medio)
7. [Retención y Archivado](#7-retención-y-archivado)
8. [Data Warehouse y BI](#8-data-warehouse-y-bi)
9. [KPIs y Métricas de Datos](#9-kpis-y-métricas-de-datos)
10. [Migración desde JSON Store a PostgreSQL](#10-migración-desde-json-store-a-postgresql)

---

## 1. Principios de Diseño de Datos

1. **Consistencia sin rigidez**: Los datos deben ser consistentes (sin huérfanos, sin duplicados) pero no necesitamos ACID bancario. Eventual consistency es aceptable para datos no críticos (logs, analytics).
2. **Seguridad sensata**: Los datos de leads (PII) deben estar protegidos, pero no necesitamos cifrado a nivel de columna. Cifrado en reposo (disco) + RLS por tenant + cifrado en tránsito (TLS) es suficiente.
3. **Rendimiento primero**: Las consultas de lectura (perfil de lead, historial de conversación) deben ser rápidas. Las escrituras (logging, analytics) pueden ser asíncronas.
4. **Denormalización controlada**: Datos de consulta frecuente se cachean/denormalizan (score en lead, count de mensajes). Datos de escritura frecuente se normalizan.
5. **Tenant isolation por defecto**: Toda tabla de negocio tiene `tenant_id`. RLS es la norma, no la excepción.
6. **Audit trail ligero**: No necesitamos CDC (Change Data Capture) bancario, pero sí un log de cambios en datos sensibles (cambios de plan, eliminación de leads, opt-outs).

---

## 2. Modelo de Datos Consolidado

### 2.1 Diagrama de Entidades y Relaciones

```
┌──────────────────┐       ┌──────────────────────┐
│  platform_tenants│       │  platform_branches   │
│──────────────────│       │──────────────────────│
│ id (PK)          │──┐    │ id (PK)              │
│ name             │  └────│ tenant_id (FK)       │
│ slug             │       │ name                 │
│ plan_id          │       │ phone_number_id      │
│ is_active        │       │ timezone             │
│ industry         │       │ is_active            │
│ config (JSONB)   │       │ config (JSONB)       │
│ max_branches     │       └──────────┬───────────┘
│ max_users        │                  │
│ max_leads        │                  │
│ stripe_sub_id    │       ┌──────────┴───────────┐
│ trial_ends_at    │       │  platform_users      │
│ created_at       │       │──────────────────────│
└──────────────────┘       │ id (PK)              │
       │                   │ tenant_id (FK)       │
       │                   │ branch_id (FK)       │
       ▼                   │ email                │
┌──────────────────┐       │ role                 │
│  platform_plans  │       │ is_active            │
│──────────────────│       │ last_login_at        │
│ id (PK)          │       │ preferences (JSONB)  │
│ name             │       └──────────────────────┘
│ price_monthly    │
│ max_branches     │       ┌──────────────────────┐
│ max_users        │       │  leads               │
│ max_leads        │       │──────────────────────│
│ max_convs_month  │       │ id (PK)              │
│ features (JSONB) │       │ tenant_id (FK)       │
│ is_active        │       │ branch_id (FK)       │
└──────────────────┘       │ campaign_id (FK)     │
                           │ name                 │
┌──────────────────┐       │ phone                │
│  campaigns       │       │ email                │
│──────────────────│       │ score                │
│ id (PK)          │──┐    │ status               │
│ tenant_id (FK)   │  │    │ source               │
│ branch_id (FK)   │  │    │ custom_fields (JSONB)│
│ name             │  │    │ score_data (JSONB)   │
│ channel          │  │    │ contact_id (Twenty)  │
│ status           │  │    │ last_contact_at      │
│ message_template │  │    │ created_at           │
│ template_name    │  │    └──────────────────────┘
│ scheduled_at     │  │              │
│ audience_filter  │  │              │
│ sent_count       │  │              │
│ delivered_count  │  │              │
│ created_at       │  │              │
└──────────────────┘  │              │
       │              │              │
       ▼              │              │
┌──────────────────┐  │  ┌───────────┴───────────┐
│  deliveries      │  │  │  conversations        │
│──────────────────│  │  │───────────────────────│
│ id (PK)          │  │  │ id (PK)               │
│ campaign_id (FK) │◄─┘  │ tenant_id (FK)        │
│ lead_id (FK)     │◄────┤ lead_id (FK)          │
│ status           │     │ channel               │
│ message_id       │     │ state (state machine) │
│ sent_at          │     │ agent_type            │
│ delivered_at     │     │ message_count         │
│ read_at          │     │ last_message_at       │
│ replied_at       │     │ sentiment_trajectory  │
│ score            │     │ metadata (JSONB)      │
│ error            │     │ created_at            │
└──────────────────┘     └───────────────────────┘
       │                             │
       ▼                             ▼
┌──────────────────┐     ┌──────────────────────┐
│  lead_scores     │     │  messages            │
│──────────────────│     │──────────────────────│
│ id (PK)          │     │ id (PK)              │
│ lead_id (FK)     │     │ conversation_id (FK) │
│ score            │     │ role (user/agent)    │
│ category         │     │ content (TEXT)       │
│ score_factors    │     │ type (text/image/    │
│ model_used       │     │       audio/file)    │
│ llm_reasoning    │     │ attachment_url       │
│ created_at       │     │ agent_type           │
└──────────────────┘     │ metadata (JSONB)     │
                         │ created_at           │
┌──────────────────┐     └──────────────────────┘
│  kb_documents    │
│──────────────────│     ┌──────────────────────┐
│ id (PK)          │     │  audit_logs          │
│ tenant_id (FK)   │     │──────────────────────│
│ file_name        │     │ id (PK)              │
│ file_type        │     │ tenant_id (FK)       │
│ file_size        │     │ event_type           │
│ chunk_count      │     │ lead_id              │
│ status           │     │ conversation_id      │
│ created_at       │     │ data (JSONB)         │
└──────────────────┘     │ ip_address           │
                         │ created_at           │
┌──────────────────┐     └──────────────────────┘
│  opt_outs        │
│──────────────────│     ┌──────────────────────┐
│ id (PK)          │     │  agent_configs       │
│ tenant_id (FK)   │     │──────────────────────│
│ phone            │     │ tenant_id (PK,FK)    │
│ email            │     │ business_name        │
│ channel          │     │ business_type        │
│ reason           │     │ description          │
│ source           │     │ personality          │
│ created_at       │     │ products (JSONB)     │
└──────────────────┘     │ services (JSONB)     │
                         │ policies (JSONB)     │
┌──────────────────┐     │ voice (JSONB)        │
│  security_rules  │     │ security (JSONB)     │
│──────────────────│     │ external_apis (JSONB)│
│ id (PK)          │     │ updated_at           │
│ tenant_id (FK)   │     └──────────────────────┘
│ pattern          │
│ severity         │
│ action           │
│ is_active        │
│ created_at       │
└──────────────────┘
```

### 2.2 Tabla de Responsabilidad por Tipo de Dato

| Tipo de Dato | Almacenamiento Primario | Almacenamiento Secundario | Caché | Backup |
|-------------|------------------------|--------------------------|-------|--------|
| Leads y contactos | PostgreSQL (tabla `leads`) | Twenty CRM (vía sync) | Redis (perfil cache 5min) | pg_dump + Twenty API |
| Conversaciones activas | Redis (TTL 7d) | PostgreSQL (historial `messages`) | — | Redis RDB |
| Mensajes e historial | PostgreSQL (`messages`) | — | Redis (últimos 50 msg) | pg_dump |
| Campañas y deliveries | PostgreSQL (`campaigns`, `deliveries`) | Helper JSON store (fallback) | Redis (stats agregados) | pg_dump |
| Scores de leads | PostgreSQL (`lead_scores`) | — | Redis (último score) | pg_dump |
| Documentos KB | Weaviate (vectores) | Filesystem (archivos originales) | — | Weaviate export + rsync |
| Archivos multimedia | Filesystem (`storage/`) | — | — | rsync + snapshot |
| Logs de auditoría | PostgreSQL (`audit_logs`) | — | — | pg_dump con retención |
| Configuración de agente | PostgreSQL (`agent_configs`) | — | Redis | pg_dump |
| Métricas de rendimiento | Prometheus (TSDB) | — | — | Prometheus snapshot |
| Sesiones de usuario | Redis (TTL 8h) | — | — | — |

---

## 3. Flujo E2E de un Dato

### 3.1 Desde que el lead escribe hasta que aparece en un reporte

```
PASO 1: INGESTA (Webhook WhatsApp)
────────────────────────────────────
Lead escribe: "Hola, quiero info sobre planes"
    │
    ▼
Meta WhatsApp API → webhook → helper-node
    │
    ▼
helper-node recibe → sanitiza → identifica tenant por phone_number_id
    │
    ▼
Almacena en Redis: conversación activa (TTL 7d)
    └── Key: {tenant_id}:conv:{conversation_id}
    └── Value: { state: "greeting", messages: [...], leadProfile: {...} }
Almacena en PostgreSQL: mensaje raw (async, cola)
    └── INSERT INTO messages (tenant_id, conversation_id, role, content, type, created_at)

PASO 2: CLASIFICACIÓN (Dify)
────────────────────────────
helper-node → envía a n8n webhook
    │
    ▼
n8n → Dify workflow "WhatsApp Lead Classifier"
    │
    ▼
Dify retorna: { intent_label, intent_score, captured_data, suggested_response }
    │
    ▼
n8n → helper-node (webhook response)
    │
    ▼
helper-node actualiza Redis: conversation state
    └── UPDATE Redis: state="discovery", lastIntentLabel="product_inquiry", lastIntentScore=73
helper-node actualiza PostgreSQL: score
    └── INSERT INTO lead_scores (lead_id, score, category, score_factors, model_used)
helper-node responde al lead (auto-reply)

PASO 3: SINCRONIZACIÓN (Twenty CRM)
────────────────────────────────────
helper-node (asíncrono, cola):
    │
    ▼
Busca o crea lead en Twenty CRM vía REST API
    └── name, phone, email, painPoints, interests, leadScoreHistory, leadLastScore
    │
    ▼
Actualiza PostgreSQL: contact_id con el ID de Twenty
    └── UPDATE leads SET contact_id = '{twenty_id}', score = 73

PASO 4: ANALYTICS (Reportes)
────────────────────────────
Cada 30 min (n8n schedule o worker en helper):
    │
    ▼
Agrega métricas del día:
    └── INSERT INTO daily_metrics (tenant_id, date, leads_created, messages_processed, avg_score, ...)
    │
    ▼
Dashboards (Grafana / helper SPA) consultan:
    └── SELECT FROM daily_metrics WHERE tenant_id = X AND date >= NOW() - 30d
```

---

## 4. Estrategia de Almacenamiento por Tipo de Dato

### 4.1 Datos Transaccionales (PostgreSQL)

```sql
-- Índices críticos para rendimiento
CREATE INDEX idx_leads_tenant_status ON leads(tenant_id, status);
CREATE INDEX idx_leads_tenant_score ON leads(tenant_id, score DESC);
CREATE INDEX idx_leads_tenant_phone ON leads(tenant_id, phone);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_deliveries_campaign ON deliveries(campaign_id, status);
CREATE INDEX idx_scores_lead ON lead_scores(lead_id, created_at DESC);
CREATE INDEX idx_audit_logs_tenant_event ON audit_logs(tenant_id, event_type, created_at DESC);
CREATE INDEX idx_conversations_tenant_state ON conversations(tenant_id, state);

-- Particionamiento por mes para tablas grandes
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    role VARCHAR(10) NOT NULL,
    content TEXT,
    type VARCHAR(20) DEFAULT 'text',
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE messages_2026_07 PARTITION OF messages
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE messages_2026_08 PARTITION OF messages
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
-- ... auto-generar particiones mensuales
```

### 4.2 Datos de Sesión y Estado (Redis)

```redis
# Keyspace design
{tenant_id}:conv:{conversation_id}       → Conversation state (TTL: 7d)
{tenant_id}:profile:{lead_id}            → Cached lead profile (TTL: 5min)
{tenant_id}:ratelimit:{conversation_id}  → Rate limit counter (TTL: 1min)
{tenant_id}:session:{user_id}            → User session (TTL: 8h)
{tenant_id}:kb:cache:{query_hash}        → KB query cache (TTL: 1h)
{tenant_id}:stats:daily:{date}           → Aggregated daily stats (TTL: 48h)

# Memory estimation: ~50KB por conversación activa
# 1,000 conversaciones activas = ~50MB
# 10,000 conversaciones activas = ~500MB
# Presupuesto Redis: 2GB para 40,000 conversaciones concurrentes
```

### 4.3 Datos Vectoriales (Weaviate)

```python
# Weaviate schema por tenant
class_document_chunk = {
    "class": f"DocumentChunk_{tenant_id.replace('-', '_')}",
    "vectorizer": "text2vec-transformers",
    "properties": [
        {"name": "documentId", "dataType": ["string"]},
        {"name": "fileName", "dataType": ["string"]},
        {"name": "chunkIndex", "dataType": ["int"]},
        {"name": "text", "dataType": ["text"]},
        {"name": "tokens", "dataType": ["int"]},
        {"name": "metadata", "dataType": ["text"]},
        {"name": "timestamp", "dataType": ["date"]},
    ]
}

# Estimación: 1,000 documentos x 50 chunks c/u = 50,000 objetos
# 50,000 objetos x ~2KB c/u = ~100MB por tenant
```

### 4.4 Datos de Archivos (Filesystem)

```
storage/
├── {tenant_id}/
│   ├── images/{uuid}.jpg          → Imágenes de WhatsApp (OCR procesado)
│   ├── thumbnails/{uuid}.jpg      → Thumbnails 200px
│   ├── audio/{uuid}.ogg           → Audios transcritos
│   ├── video/{uuid}.mp4           → Videos (solo referencia si >50MB)
│   ├── documents/{uuid}.pdf       → Documentos originales
│   ├── kb_uploads/{uuid}.pdf      → Documentos subidos a KB
│   └── tts/{uuid}.mp3             → Audios generados por TTS
│
├── {tenant_id}/
│   └── ...
```

---

## 5. Normalización vs Rendimiento

### 5.1 Reglas de Normalización

| Nivel | Tablas | Estrategia |
|-------|--------|-----------|
| **Totalmente normalizado** | `messages`, `lead_scores`, `audit_logs`, `deliveries` | Cada mensaje/score/delivery es una fila. Las consultas analíticas usan agregaciones. |
| **Denormalización controlada** | `leads`, `campaigns`, `conversations` | Campos calculados se almacenan: `score`, `sent_count`, `message_count`, `last_message_at`. Se actualizan en writes, no se calculan en reads. |
| **JSONB para flexibles** | `custom_fields`, `score_data`, `metadata`, `config`, `preferences` | Datos que varían por tenant/industria se guardan como JSONB. Sin esquema rígido. |
| **Cache para calientes** | Perfil de lead, última conversación | Redis con TTL de 5 min. Invalidación en escritura. |

### 5.2 Cuándo Normalizar vs Cuándo Cachear

| Escenario | Estrategia | Razón |
|-----------|-----------|-------|
| Lead actualiza score | Denormalizar en `leads.score` + historial en `lead_scores` | El score se lee 100x más de lo que se escribe |
| Contar mensajes de una conversación | Denormalizar en `conversations.message_count` | Evitar COUNT(*) en `messages` que puede ser lento |
| Timeline de interacciones con lead | Cache en Redis (últimos 50 eventos) + query a `messages` si necesita más | 90% de las veces solo se ven los últimos mensajes |
| Reporte mensual de campañas | Agregación en `daily_metrics` | No recalcular desde 0 cada vez que se ve el reporte |
| Búsqueda de leads por nombre | Índice GIN en PostgreSQL sobre `name` | Suficiente para <100k leads. Para más, usar Elasticsearch |

### 5.3 Política de Conexiones a Base de Datos

```javascript
// helper-node — pool de conexiones optimizado
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || 'postgres',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'wibsite',
  user: process.env.PG_USER || 'wibsite',
  password: process.env.PG_PASSWORD || 'wibsite_pass',
  max: 20,                 // Máximo 20 conexiones simultáneas
  idleTimeoutMillis: 30000, // Cerrar conexiones idle después de 30s
  connectionTimeoutMillis: 5000, // Timeout de conexión 5s
  statement_timeout: 10000, // Timeout de query 10s (evitar queries lentas)
});

// Para queries lentas/analíticas, usar un pool separado con menos conexiones
const analyticsPool = new Pool({
  ...poolOptions,
  max: 5,
  statement_timeout: 30000, // 30s para queries analíticas
});
```

---

## 6. Seguridad de Datos (Nivel Medio)

### 6.1 Clasificación de Datos

| Nivel | Descripción | Ejemplos | Medidas |
|-------|-------------|----------|---------|
| **Público** | No sensible, sin PII | Nombres de servicios, versiones, health status | Sin restricciones |
| **Interno** | Datos operativos no sensibles | Métricas agregadas, configs no sensibles, logs sin PII | Autenticación requerida |
| **Confidencial** | PII de leads, datos de negocio | Nombres, teléfonos, emails, mensajes, scores, campañas | Auth + RLS + HTTPS + cifrado en reposo |
| **Restringido** | Credenciales, secrets | API keys, tokens, passwords, facturación | Auth + RLS + cifrado + acceso mínimo + no en logs |

### 6.2 Medidas de Seguridad Aplicadas

```yaml
# docker-compose.yml — cifrado en reposo para PostgreSQL
services:
  postgres:
    image: pgvector/pgvector:pg15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # El cifrado en reposo se maneja a nivel de disco (LUKS/cloud encryption)
    # PostgreSQL TDE no está habilitado (no necesario para este nivel de seguridad)

# Redis no tiene cifrado en reposo nativo
# Se confía en cifrado a nivel de disco + red interna Docker
# Los datos en Redis son temporales (TTL) y no contienen PII completa

# Cifrado en tránsito: HTTPS entre servicios externos
# Comunicación interna Docker: sin cifrado (red aislada, confianza en Docker networking)
```

### 6.3 Protección de PII en Logs

```javascript
// helper-node/src/pii-filter.js — Filtro de PII en logs
const PII_PATTERNS = [
  // Teléfonos
  { pattern: /\b\d{10,15}\b/g, replacement: '[PHONE]' },
  // Emails
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[EMAIL]' },
  // Nombres completos (detecta 2+ palabras con mayúscula inicial)
  { pattern: /\b[A-Z][a-záéíóúñ]+ [A-Z][a-záéíóúñ]+(?: [A-Z][a-záéíóúñ]+)*\b/g, replacement: '[NAME]' },
  // Direcciones IP
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },
  // API keys y tokens
  { pattern: /(sk-or-|app-|eyJ)[A-Za-z0-9._-]{20,}/g, replacement: '[KEY]' },
];

function redactPII(data) {
  if (typeof data === 'string') {
    let redacted = data;
    for (const { pattern, replacement } of PII_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
    return redacted;
  }
  if (typeof data === 'object' && data !== null) {
    const redacted = Array.isArray(data) ? [] : {};
    for (const [key, value] of Object.entries(data)) {
      // No redactar ciertos campos necesarios para debugging
      if (['id', 'status', 'score', 'event_type', 'latency_ms', 'success'].includes(key)) {
        redacted[key] = value;
      } else {
        redacted[key] = redactPII(value);
      }
    }
    return redacted;
  }
  return data;
}
```

### 6.4 Política de Acceso a Datos

| Rol | Leads | Mensajes | Campañas | Scores | Config | Logs | Facturación |
|-----|-------|----------|----------|--------|--------|------|-------------|
| **Super Admin** (Wibsite) | Todos los tenants | Todos | Todos | Todos | Todos | Todos | Todos |
| **Admin del Tenant** | Su tenant | Su tenant | Su tenant | Su tenant | Su tenant | Su tenant | Su tenant |
| **Agente** | Su branch | Su branch | Su branch (solo lectura) | Su branch | Solo perfil propio | No | No |
| **Read Only** | Su tenant (solo lectura) | Su tenant | Su tenant (solo lectura) | Su tenant | No | No | No |

---

## 7. Retención y Archivado

### 7.1 Política de Retención

| Tipo de Dato | Retención | Acción al Vencer | Justificación |
|-------------|-----------|------------------|---------------|
| Conversaciones activas en Redis | 7 días sin actividad | Expira automáticamente (TTL) | Contexto de ventas, después de 7d sin actividad es lead frío |
| Mensajes históricos en PostgreSQL | 2 años | Archive a tabla `messages_archive` o export | Posible necesidad legal. Después de 2 años, probabilidad de re-engagement muy baja |
| Leads no calificados (score < 30) | 90 días sin contacto | Marcar como `cold_expired`, visible solo en reportes | Oportunidad de re-engagement, pero no saturar la vista activa |
| Leads calificados (score >= 30) | 2 años | Archive | Ciclo de ventas B2B puede ser largo |
| Scores de leads | 2 años | Archive junto con lead | Historial de evolución del lead |
| Logs de auditoría | 1 año | Purge | Cumplimiento. Después de 1 año, utilidad marginal |
| Archivos multimedia | 90 días | Delete (dejar solo metadatos) | Ocupan espacio, después de 90d ya no son relevantes |
| Documentos KB | Indefinido | — | Base de conocimiento del negocio |
| Grabaciones de voz | 30 días | Delete | Cumplimiento + espacio |
| Datos de facturación | 5 años | Archive | Obligación fiscal |
| Métricas de rendimiento | 90 días | Downsample a 1h de granularidad | Ocupan mucho espacio, tendencias se ven con datos agregados |

### 7.2 Script de Archivado

```sql
-- scripts/db/archive.sql — Archivado mensual

-- 1. Archivar mensajes antiguos (> 2 años)
INSERT INTO messages_archive (id, tenant_id, conversation_id, role, content, type, created_at)
SELECT id, tenant_id, conversation_id, role, content, type, created_at
FROM messages
WHERE created_at < NOW() - INTERVAL '2 years'
  AND id NOT IN (SELECT id FROM messages_archive);

DELETE FROM messages
WHERE created_at < NOW() - INTERVAL '2 years';

-- 2. Marcar leads fríos como expired
UPDATE leads
SET status = 'cold_expired', updated_at = NOW()
WHERE score < 30
  AND (last_contact_at IS NULL OR last_contact_at < NOW() - INTERVAL '90 days')
  AND status NOT IN ('opted_out', 'converted', 'cold_expired');

-- 3. Limpiar archivos multimedia > 90 días (correr desde script externo)
-- find /storage/*/images/ -type f -mtime +90 -delete
-- find /storage/*/audio/ -type f -mtime +90 -delete
-- find /storage/*/thumbnails/ -type f -mtime +90 -delete
```

---

## 8. Data Warehouse y BI

### 8.1 Modelo de Data Warehouse (Estrella)

```
HECHOS: daily_metrics
┌────────────────────────────┐
│ date (PK)                  │
│ tenant_id (FK)             │
│ leads_created              │
│ leads_scored               │
│ messages_inbound           │
│ messages_outbound          │
│ conversations_started      │
│ conversations_completed    │
│ campaigns_sent             │
│ campaigns_delivered        │
│ campaigns_read             │
│ campaigns_replied          │
│ calls_made                 │
│ calls_duration_seconds     │
│ total_llm_tokens           │
│ total_llm_cost_cents       │
│ avg_response_time_seconds  │
│ avg_lead_score             │
│ hot_leads                  │
│ warm_leads                 │
│ cold_leads                 │
└────────────────────────────┘
         │
         ├── DIMENSIONES: tenants
         │   ├── tenant_id, name, industry, plan_id, country
         │
         ├── DIMENSIONES: dates
         │   ├── date, year, month, day, day_of_week, is_weekend
         │
         └── DIMENSIONES: channels
             ├── channel_id, channel_name (whatsapp, messenger, email, voice, web)
```

### 8.2 Vistas Materializadas para KPIs

```sql
-- Vista materializada actualizada cada hora
CREATE MATERIALIZED VIEW mv_daily_kpi AS
SELECT
    d.date,
    t.tenant_id,
    t.name AS tenant_name,
    t.industry,
    t.plan_id,
    COALESCE(dm.leads_created, 0) AS leads_created,
    COALESCE(dm.messages_inbound, 0) AS messages_inbound,
    COALESCE(dm.messages_outbound, 0) AS messages_outbound,
    COALESCE(dm.campaigns_sent, 0) AS campaigns_sent,
    COALESCE(dm.campaigns_delivered, 0) AS campaigns_delivered,
    CASE WHEN dm.campaigns_sent > 0
         THEN ROUND((dm.campaigns_delivered::decimal / dm.campaigns_sent) * 100, 1)
         ELSE 0 END AS delivery_rate,
    COALESCE(dm.avg_lead_score, 0) AS avg_lead_score,
    COALESCE(dm.hot_leads, 0) AS hot_leads,
    COALESCE(dm.warm_leads, 0) AS warm_leads,
    COALESCE(dm.cold_leads, 0) AS cold_leads,
    COALESCE(dm.total_llm_cost_cents, 0) AS total_llm_cost_cents
FROM generate_series(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE,
    '1 day'
) AS d(date)
CROSS JOIN platform_tenants t
LEFT JOIN daily_metrics dm ON dm.date = d.date AND dm.tenant_id = t.tenant_id
WHERE t.is_active = true
ORDER BY d.date DESC, t.name;

CREATE UNIQUE INDEX idx_mv_kpi_date_tenant ON mv_daily_kpi(date, tenant_id);
```

---

## 9. KPIs y Métricas de Datos

| KPI | Fórmula | Frecuencia | Alerta si | Propósito |
|-----|---------|-----------|-----------|-----------|
| **Tasa de entrega de campañas** | `delivered / sent * 100` | Por campaña | < 90% | Salud de números WhatsApp |
| **Tasa de lectura** | `read / delivered * 100` | Por campaña | < 30% | Calidad de contenido |
| **Tasa de respuesta** | `replied / read * 100` | Por campaña | < 5% | Engagement de leads |
| **Tasa de conversión lead → calificado** | `leads_with_score > 50 / total_leads * 100` | Diario | < 10% | Calidad de leads entrantes |
| **Tiempo promedio de respuesta** | AVG(ms entre mensaje inbound y primera respuesta) | Diario | > 60s | Eficiencia del agente |
| **Precisión de clasificación IA** | `clasificaciones_correctas / total_clasificaciones * 100` | Semanal | < 80% | Salud del modelo IA |
| **Costo de IA por lead** | `total_llm_cost_cents / leads_scored` | Diario | > $0.01/lead | Eficiencia económica |
| **Tasa de escalamiento humano** | `escalations / total_conversations * 100` | Diario | > 30% | Efectividad del agente automático |
| **Leads huérfanos** | `leads sin campaign_id ni branch_id` | Diario | > 0 | Integridad de datos |
| **Crecimiento de base de datos** | `tamaño_total_bd / día` | Semanal | > 10%/semana | Planificación de capacidad |

---

## 10. Migración desde JSON Store a PostgreSQL

### 10.1 Estado Actual

El helper-node usa `wibsite-store.json` como almacenamiento con fallback a PostgreSQL. Para escalar, la migración a PostgreSQL como almacenamiento primario debe ser completa.

### 10.2 Plan de Migración

```
FASE 1: DUMP (Semana 1)
├── Exportar JSON store a SQL
├── Crear tablas en PostgreSQL (si no existen)
├── Cargar datos
└── Verificar integridad (comparar conteos)

FASE 2: DUAL WRITE (Semana 2)
├── helper-node escribe en PostgreSQL + JSON store simultáneamente
├── Monitorear inconsistencias
├── Corregir bugs en queries PostgreSQL
└── READ desde PostgreSQL (JSON store como respaldo)

FASE 3: CUTOVER (Semana 3)
├── helper-node lee/escribe solo PostgreSQL
├── JSON store solo para backup de emergencia
├── Monitorear latencia y errores
└── Si todo OK, eliminar JSON store como fuente primaria
```

### 10.3 Script de Migración

```javascript
// scripts/db/migrate-json-to-pg.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || 'postgres',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'wibsite',
  user: process.env.PG_USER || 'wibsite',
  password: process.env.PG_PASSWORD || 'wibsite_pass',
});

const store = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'helper-node', 'wibsite-store.json'), 'utf-8'
));

async function migrate() {
  console.log('📦 Migrating JSON store to PostgreSQL...');

  // Migrar campañas
  for (const campaign of store.campaigns || []) {
    await pool.query(`
      INSERT INTO campaigns (id, name, description, channel, message_template, template_name,
        audience_filter, status, scheduled_at, sent_count, delivered_count, read_count,
        replied_count, failed_count, opt_out_count, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (id) DO UPDATE SET name = $2, status = $8, updated_at = $17
    `, [campaign.id, campaign.name, campaign.description, campaign.channel,
        campaign.message_template, campaign.template_name,
        JSON.stringify(campaign.audience_filter || {}), campaign.status,
        campaign.scheduled_at, campaign.sent_count || 0, campaign.delivered_count || 0,
        campaign.read_count || 0, campaign.replied_count || 0, campaign.failed_count || 0,
        campaign.opt_out_count || 0, campaign.created_at, campaign.updated_at]);
    console.log(`  ✅ Campaign: ${campaign.name}`);
  }

  // Migrar leads
  for (const lead of store.leads || []) {
    await pool.query(`
      INSERT INTO leads (id, campaign_id, name, phone, email, custom_fields, status,
        score, score_data, source, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET score = $8, status = $7, updated_at = $12
    `, [lead.id, lead.campaign_id, lead.name, lead.phone, lead.email,
        JSON.stringify(lead.custom_fields || {}), lead.status, lead.score || 0,
        JSON.stringify(lead.score_data || {}), lead.source || 'migrated',
        lead.created_at, lead.updated_at]);
  }

  console.log('✅ Migration complete');
  console.log(`   Campaigns: ${(store.campaigns || []).length}`);
  console.log(`   Leads: ${(store.leads || []).length}`);
  console.log(`   Deliveries: ${(store.deliveries || []).length}`);
  console.log(`   Scores: ${(store.scores || []).length}`);
  console.log(`   Opt-Outs: ${(store.optOuts || []).length}`);

  await pool.end();
}

migrate().catch(err => { console.error('Migration failed:', err); process.exit(1); });
```

---

> **Resumen de Filosofía de Datos:** Normalizar lo que se escribe mucho (mensajes), denormalizar lo que se lee mucho (scores, counts). Cachear en Redis lo que es temporal (conversaciones activas, perfiles). Asegurar con RLS + cifrado en reposo + filtro de PII en logs. No necesitamos CDC ni cifrado a nivel de columna — el riesgo no justifica el costo de rendimiento y complejidad. Las métricas van a un DW simple (daily_metrics + vistas materializadas) que alimenta dashboards sin recalcular desde 0 cada vez.
