ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads FORCE ROW LEVEL SECURITY;
ALTER TABLE lead_scores FORCE ROW LEVEL SECURITY;
ALTER TABLE opt_outs FORCE ROW LEVEL SECURITY;
ALTER TABLE workflow_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE channel_status FORCE ROW LEVEL SECURITY;
SELECT relname, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced FROM pg_class WHERE relname IN ('campaigns','campaign_leads','lead_scores','opt_outs','workflow_logs','audit_logs','channel_status') ORDER BY relname;
