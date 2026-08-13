-- ═══════════════════════════════════════════════════════════════
-- Wibsite Business — Row Level Security (RLS) Policies (FASE 7)
-- Ejecutar DESPUÉS de multi-tenant-schema.sql
-- ═══════════════════════════════════════════════════════════════
-- NOTA: RLS sólo filtra cuando app.tenant_id está configurado.
-- El helper-node usa SET LOCAL app.tenant_id = '<uuid>' al inicio de cada request.
-- Cuando no está configurado (valor vacío), las policies devuelven false → acceso denegado.
-- El superusuario de PostgreSQL (wibsite) BYPASS RLS por defecto.
-- Si se quiere aplicar RLS al superusuario: ALTER ROLE wibsite NOBYPASSRLS;
-- (NO hacerlo en producción sin crear un rol de app separado primero)

-- ─── Función helper para extraer tenant_id actual ────────────────
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
DECLARE
    tenant_setting TEXT;
BEGIN
    -- Intenta leer la variable de sesión
    BEGIN
        tenant_setting := current_setting('app.tenant_id', true);
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
    -- Si está vacía o es inválida, retorna NULL
    IF tenant_setting IS NULL OR tenant_setting = '' THEN
        RETURN NULL;
    END IF;
    RETURN tenant_setting::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── Habilitar RLS en tablas de negocio ──────────────────────────
ALTER TABLE campaigns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE opt_outs       ENABLE ROW LEVEL SECURITY;

-- ─── Policies de aislamiento por tenant ──────────────────────────
-- campaigns
DROP POLICY IF EXISTS tenant_isolation_campaigns ON campaigns;
CREATE POLICY tenant_isolation_campaigns ON campaigns
    USING (
        tenant_id = current_tenant_id()
        OR current_tenant_id() IS NULL  -- bypass cuando no hay tenant context (admin direct)
    );

-- campaign_leads
DROP POLICY IF EXISTS tenant_isolation_campaign_leads ON campaign_leads;
CREATE POLICY tenant_isolation_campaign_leads ON campaign_leads
    USING (
        tenant_id = current_tenant_id()
        OR current_tenant_id() IS NULL
    );

-- lead_scores
DROP POLICY IF EXISTS tenant_isolation_lead_scores ON lead_scores;
CREATE POLICY tenant_isolation_lead_scores ON lead_scores
    USING (
        tenant_id = current_tenant_id()
        OR current_tenant_id() IS NULL
    );

-- workflow_logs
DROP POLICY IF EXISTS tenant_isolation_workflow_logs ON workflow_logs;
CREATE POLICY tenant_isolation_workflow_logs ON workflow_logs
    USING (
        tenant_id = current_tenant_id()
        OR current_tenant_id() IS NULL
    );

-- opt_outs
DROP POLICY IF EXISTS tenant_isolation_opt_outs ON opt_outs;
CREATE POLICY tenant_isolation_opt_outs ON opt_outs
    USING (
        tenant_id = current_tenant_id()
        OR current_tenant_id() IS NULL
    );

-- ─── Rol de aplicación (recomendado para producción) ─────────────
-- CREATE ROLE wibsite_app WITH LOGIN PASSWORD 'wibsite_app_pass' NOBYPASSRLS;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wibsite_app;
-- (descomenta y ejecuta manualmente si quieres RLS estricto)

DO $$
BEGIN
    RAISE NOTICE 'RLS policies applied successfully. Use SET LOCAL app.tenant_id = <uuid> in queries.';
END;
$$;
