-- Wibsite Business — Audit Logs Schema
-- Stores structured audit events for security and compliance

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level VARCHAR(20) NOT NULL DEFAULT 'info',
        -- 'info', 'warn', 'error', 'security'
    tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
    request_id VARCHAR(255),
    conversation_id VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
        -- 'security_alert', 'state_transition', 'api_call', 'error', 'config_change',
        -- 'data_migration', 'deployment', 'handoff_created', 'followup_scheduled',
        -- 'compliance_event', 'backup_completed', 'hallucination_blocked', 'campaign_sent'
    message TEXT,
    latency_ms INT,
    data JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_time ON audit_logs(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_conversation ON audit_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON audit_logs(level);

-- Auto-cleanup: eventos mayores a 30 días (retención legal básica)
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
