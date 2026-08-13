-- Wibsite Business — F-46/G-24: columnas de traza OTel en audit_logs
-- Estándar: quién → qué → cómo → módulo → proceso + trace_id/span_id (traza E2E)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS span_id  TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_logs_trace_id        ON audit_logs (trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_conversation_id ON audit_logs (conversation_id);