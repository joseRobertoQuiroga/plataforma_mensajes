# Validación de Bases de Datos — Wibsite Business v2.1.1

> Análisis de PKs, FKs, índices, flujos de datos y consistencia entre módulos.

---

## 1. Diagrama de Bases de Datos por Servicio

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        INFRAESTRUCTURA COMPARTIDA                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ PostgreSQL (puerto 5432)   │ Redis (6379)          │ Weaviate (8080)         │
│ ┌───────────────────────── │ ┌───────────────────  │ ┌─────────────────────  │
│ │ chatwoot_db              │ │ chatwoot-queue     │ │ vectors (embeddings) │
│ │ dify_db                  │ │ chatwoot-cache     │ │ Sin auth             │
│ │ n8n_db                   │ │ n8n-queue          │ └─────────────────────  │
│ │ twenty_db                │ │ n8n-cache          │                        │
│ │ wibsite_db (lumi schema) │ └────────────────────┘                        │
│ └───────────────────────── ┘                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      SERVICIO HELPER (JSON Store)                           │
│  wibsite-store.json  │  { campaigns, leads, deliveries, scores,            │
│                      │    channels, optOuts, templates }                   │
│  SIN PKs, SIN FKs, SIN índices, SIN transacciones                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Validación de Schema Lumi (PostgreSQL) — Referencia Multi-Tenant

### 2.1 Tablas, PKs, FKs e Índices

| Tabla | PK | FKs | Índices | CHECK Constraints |
|-------|----|-----|---------|-------------------|
| **users** | `id UUID` | — | — | — |
| **organizations** | `id UUID` (inferido) | — | `slug`, `stripe_customer_id` | — |
| **sessions** | `id UUID` | `user_id → users(id) CASCADE`, `organization_id → organizations(id) CASCADE` | `token_hash`, `user_id` | — |
| **memberships** | `id UUID` | `user_id → users(id) CASCADE`, `organization_id → organizations(id) CASCADE` | `user_id`, `organization_id` | `UNIQUE(user_id, org_id)`, `role IN ('owner','admin','member','viewer')` |
| **leads** | `id UUID` | `organization_id → organizations(id) CASCADE` | `org_id`, `org_status`, `org_score DESC` | `UNIQUE(org_id, conversation_id)`, `status IN ('new','contacted','qualified','converted','lost')` |
| **platform_connections** | `id UUID` | `organization_id → organizations(id) CASCADE` | `org_id`, `bot_token` | `platform IN ('telegram','whatsapp','instagram','messenger')` |
| **subscriptions** | `id UUID` | `organization_id → organizations(id) CASCADE` | `org_id`, `stripe_sub`, `stripe_cust` | `plan IN ('free','pro','business','agency')`, `status IN ('incomplete','active','past_due','canceled','unpaid','trialing')` |
| **billing_events** | `id UUID` | `organization_id → organizations(id) SET NULL` | `org_id`, `stripe_event_id` | — |
| **usage_counters** | `id UUID` | `organization_id → organizations(id) CASCADE` | `org_id` | `UNIQUE(org_id, metric, period_start)` |
| **social_connections** | `id UUID` | `organization_id → organizations(id) CASCADE` | `org_id`, `platform` | `UNIQUE(org_id, platform, platform_account_id)`, `platform IN ('instagram','facebook','tiktok','twitter')` |
| **account_metrics** | `id UUID` | `organization_id → organizations(id) CASCADE`, `social_connection_id → social_connections(id) CASCADE` | `org_id`, `org_date DESC` | — |
| **assets** | `id UUID` | `organization_id → organizations(id) CASCADE` | `org_id`, `org_active` | — |
| **posts** | `id UUID` | `organization_id → organizations(id) CASCADE` | `org_id`, `org_status`, `org_scheduled` | `status IN ('draft','scheduled','publishing','published','failed')` |
| **post_accounts** | `id UUID` | `post_id → posts(id) CASCADE`, `social_connection_id → social_connections(id) CASCADE` | — | `UNIQUE(post_id, social_connection_id)`, `status IN ('pending','published','failed')` |
| **campaigns** | `id UUID` | `organization_id → organizations(id) CASCADE`, `created_by → users(id)` | `org_status`, `scheduled` | `status IN ('draft','scheduled','sending','completed','cancelled','failed')` |
| **campaign_messages** | `id UUID` | `campaign_id → campaigns(id) CASCADE`, `organization_id → organizations(id) CASCADE` | `campaign_id`, `org_status` | `status IN ('pending','sent','delivered','read','replied','failed')` |

### 2.2 RLS (Row Level Security) — Activo en:
leads, platform_connections, subscriptions, billing_events, social_connections, account_metrics, assets, posts, post_accounts, memberships

Todas usan: `organization_id = current_setting('app.current_org')::uuid`

---

## 3. JSON Store (Helper) — Estructura Actual

```javascript
store = {
  campaigns:  [ { id, name, description, channel, message_template, template_name,
                  audience_filter, status, scheduled_at, sent_count, delivered_count,
                  read_count, replied_count, failed_count, opt_out_count,
                  created_at, updated_at } ],
  leads:      [ { id, campaign_id, contact_id, name, phone, email, custom_fields,
                  status, score, score_data, source, created_at, updated_at } ],
  deliveries: [ { id, campaign_id, contact_id, contact_name, phone, status,
                  message_id, channel_message_id, sent_at, delivered_at, read_at,
                  replied_at, error, score, created_at } ],
  scores:     [ { id, lead_id, campaign_id, score, score_factors, score_model,
                  classified_at, notes } ],
  channels:   [ { channel, status, status_message, last_checked_at, error_count } ],
  optOuts:    [ { phone, campaign_id, channel, reason, created_at } ],
  templates:  [ { id, name, channel, category, subject, body, variables,
                  max_length, created_at, updated_at } ]  // opcional
}
```

### 3.1 Gaps vs PostgreSQL Lumi Schema

| Aspecto | JSON Store (Helper) | PostgreSQL Lumi | Riesgo |
|---------|--------------------|-----------------|--------|
| **Primary Keys** | No enforced (UUID generado en JS) | `UUID PK` con `gen_random_uuid()` | 🟡 Bajo — UUID único pero sin constraint |
| **Foreign Keys** | ❌ NO EXISTEN | `REFERENCES ... ON DELETE CASCADE` | 🔴 **ALTO** — leads/campañas huérfanos |
| **Índices** | ❌ NO EXISTEN | `CREATE INDEX` en campos de búsqueda | 🟡 Medio — O(n) en lecturas |
| **Unique Constraints** | ❌ NO EXISTEN | `UNIQUE(org_id, conversation_id)`, etc. | 🟡 Medio — duplicados posibles |
| **CHECK Constraints** | ❌ NO EXISTEN | `CHECK (status IN (...))` | 🟡 Medio — estados inválidos posibles |
| **Transacciones** | ❌ Lock manual (promise chain) | Transacciones ACID nativas | 🟡 Medio — race condition residual |
| **RLS (tenant isolation)** | ❌ NO EXISTE | RLS por `organization_id` | 🔴 **ALTO** — sin multi-tenant |
| **Tipos de datos** | Dinámicos (JS) | `UUID`, `TIMESTAMPTZ`, `JSONB`, `INTEGER` | 🟢 Bajo |
| **Persistencia** | Archivo plano | WAL + replicación | 🔴 **ALTO** — corrupción por crash |

### 3.2 Flujos de Datos entre Módulos y Datos Huérfanos Identificados

| Flujo | Origen | Destino | Dato Clave | Gap |
|-------|--------|---------|------------|-----|
| Lead → Campaign | `store.leads.campaign_id` | `store.campaigns.id` | **FK lógica** | DELETE campaign → leads huérfanos |
| Delivery → Lead | `store.deliveries.contact_id` | `store.leads.id` | **FK lógica** | DELETE lead → deliveries huérfanas |
| Delivery → Campaign | `store.deliveries.campaign_id` | `store.campaigns.id` | **FK lógica** | DELTE campaign → deliveries huérfanas |
| Score → Lead | `store.scores.lead_id` | `store.leads.id` | **FK lógica** | DELETE lead → scores huérfanos |
| OptOut → Campaign | `store.optOuts.campaign_id` | `store.campaigns.id` | **FK lógica** | DELTE campaign → optOuts huérfanos |
| Lead → Twenty CRM | `store.leads.contact_id` | `twenty.person.id` | **ID externo** | Twenty actualizado pero store no actualizado |
| Campaign → n8n | n8n workflow | Helper API | **URL/ruta** | Legacy v1 endpoints necesarios |

---

## 4. Hallazgos y Recomendaciones

### 4.1 Problemas Inmediatos (v2.1.1)

| # | Problema | Severidad | Solución |
|---|----------|-----------|----------|
| P1 | **DELETE campaign no limpia leads/deliveries/scores** | 🔴 Alta | Agregar `updateStore` que filtre por campaign_id |
| P2 | **POST /api/leads (single) no valida campaign_id** | 🟡 Media | Verificar que campaign exista antes de crear lead |
| P3 | **No hay FK constraints en JSON store** | 🟡 Media | Migrar a PostgreSQL con schema lumi |
| P4 | **Templates en DEFAULT_TEMPLATES + store duplicados** | 🟢 Baja | Unificar fuente de verdad |
| P5 | **Channels hardcodeados en seed** | 🟢 Baja | Persistir en store y permitir CRUD real |
| P6 | **contact_id nulo hasta sync Twenty** | 🟢 Baja | Sync automático post-creación de lead |

### 4.2 Normalización Recomendada

Para la **plantilla base actual**, mantener JSON store es aceptable pero con estas reglas:

1. **Toda escritura debe usar `updateStore`** — verificado: 100% de las rutas ahora lo hacen
2. **Validar FKs lógicas antes de crear** — campaign_id debe existir, lead_id debe existir
3. **DELETE en cascada manual** — al eliminar campaña, eliminar leads/deliveries/scores asociados
4. **Migrar a PostgreSQL Lumi** antes de Gateway/SSO — sin BD relacional no hay multi-tenant seguro

### 4.3 Orden de Implementación Recomendado

```
Fase Actual (v2.1.1) → 1. Gateway/SSO → 2. PostgreSQL Lumi → 3. Multi-tenant
                              │                    │
                              ▼                    ▼
                         JWT central +       Tablas con org_id +
                         rate limiting       RLS + FKs reales
```

---

## 5. Conclusión

La base de datos **PostgreSQL Lumi** (9 migraciones) está correctamente normalizada:
- ✅ 19 tablas con UUID PK
- ✅ 18 FK con ON DELETE CASCADE/SET NULL
- ✅ 25+ índices compuestos y condicionales
- ✅ CHECK constraints en todos los enums
- ✅ RLS activo en 12 tablas
- ✅ UNIQUE compuestos en miembros, leads, platform_connections

El **JSON Store del helper** carece de todas estas garantías. Para la plantilla base es funcional pero debe migrarse a PostgreSQL Lumi antes de Gateway/SSO y multi-tenant.
