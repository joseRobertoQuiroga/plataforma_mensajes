-- ═══════════════════════════════════════════════════════════════
-- Wibsite Business — Multi-Tenant Schema (FASE 6)
-- Ejecutar en la base de datos `wibsite` (la compartida del helper)
-- ═══════════════════════════════════════════════════════════════

-- Habilitar extensión UUID si no existe
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Tabla central de tenants/empresas ──────────────────────────
CREATE TABLE IF NOT EXISTS platform_tenants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(255) NOT NULL,
    slug         VARCHAR(100) UNIQUE NOT NULL,
    plan_id      VARCHAR(50)  DEFAULT 'demo',
    is_active    BOOLEAN      DEFAULT true,
    config       JSONB        DEFAULT '{}',
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── Tabla de sucursales por tenant ─────────────────────────────
CREATE TABLE IF NOT EXISTS platform_branches (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES platform_tenants(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    is_active    BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tabla de usuarios por tenant ───────────────────────────────
CREATE TABLE IF NOT EXISTS platform_users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES platform_tenants(id) ON DELETE CASCADE,
    email        VARCHAR(255) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    role         VARCHAR(50)  DEFAULT 'agent',
    is_active    BOOLEAN DEFAULT true,
    authelia_id  VARCHAR(255),
    last_login   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- ─── Agregar tenant_id a tablas de negocio existentes ───────────
ALTER TABLE campaigns     ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES platform_tenants(id) ON DELETE SET NULL;
ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES platform_tenants(id) ON DELETE SET NULL;
ALTER TABLE lead_scores   ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES platform_tenants(id) ON DELETE SET NULL;
ALTER TABLE workflow_logs  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES platform_tenants(id) ON DELETE SET NULL;
ALTER TABLE channel_status ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES platform_tenants(id) ON DELETE SET NULL;
ALTER TABLE opt_outs      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES platform_tenants(id) ON DELETE SET NULL;

-- ─── Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant      ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_tenant ON campaign_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_tenant    ON lead_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_tenant  ON workflow_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_users_tenant ON platform_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_users_email  ON platform_users(email);

-- ─── Triggers updated_at ────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_platform_tenants_updated_at') THEN
        CREATE TRIGGER update_platform_tenants_updated_at
            BEFORE UPDATE ON platform_tenants
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_platform_branches_updated_at') THEN
        CREATE TRIGGER update_platform_branches_updated_at
            BEFORE UPDATE ON platform_branches
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- ─── Seed: tenant default ───────────────────────────────────────
INSERT INTO platform_tenants (name, slug, plan_id, config)
VALUES ('Wibsite Default', 'default', 'demo',
        '{"max_campaigns": 10, "max_users": 5, "features": ["whatsapp", "ai_scoring"]}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ─── Seed: admin user ───────────────────────────────────────────
INSERT INTO platform_users (tenant_id, email, name, role, authelia_id)
SELECT id, 'admin@wibsite.com', 'Admin Wibsite', 'superadmin', 'admin@wibsite.com'
FROM platform_tenants WHERE slug = 'default'
ON CONFLICT (tenant_id, email) DO NOTHING;

-- ─── Backfill: asignar tenant default a registros existentes ────
UPDATE campaigns     SET tenant_id = (SELECT id FROM platform_tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE campaign_leads SET tenant_id = (SELECT id FROM platform_tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE workflow_logs  SET tenant_id = (SELECT id FROM platform_tenants WHERE slug = 'default') WHERE tenant_id IS NULL;

DO $$
DECLARE t_id UUID;
BEGIN
    SELECT id INTO t_id FROM platform_tenants WHERE slug = 'default';
    RAISE NOTICE 'Multi-tenant schema OK. Default tenant ID: %', t_id;
END;
$$;
