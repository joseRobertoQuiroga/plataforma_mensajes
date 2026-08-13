-- Wibsite - Orphan Check & Referential Integrity
-- Run periodically to detect orphaned records

-- 1. Campaign leads without campaign
SELECT '1: Leads sin campania' as check_name, COUNT(*) as orphan_count
FROM campaign_leads cl
LEFT JOIN campaigns c ON cl.campaign_id = c.id
WHERE c.id IS NULL;

-- 2. Lead scores without lead
SELECT '2: Scores sin lead' as check_name, COUNT(*) as orphan_count
FROM lead_scores ls
LEFT JOIN campaign_leads cl ON ls.lead_id = cl.id
WHERE cl.id IS NULL;

-- 3. Lead scores without campaign
SELECT '3: Scores sin campania' as check_name, COUNT(*) as orphan_count
FROM lead_scores ls
LEFT JOIN campaigns c ON ls.campaign_id = c.id
WHERE c.id IS NULL;

-- 4. Workflow logs with invalid source
SELECT '4: Logs con source invalido' as check_name, COUNT(*) as orphan_count
FROM workflow_logs
WHERE source NOT IN ('n8n', 'dify', 'helper', 'chatwoot');

-- 5. Leads with extreme scores
SELECT '5: Leads con score fuera de rango' as check_name, COUNT(*) as orphan_count
FROM campaign_leads
WHERE score < 0 OR score > 100;

-- 6. Duplicate phone numbers (potential data issues)
SELECT '6: Telefonos duplicados' as check_name, COUNT(*) - COUNT(DISTINCT phone) as duplicate_count
FROM campaign_leads
WHERE phone IS NOT NULL;

-- 7. Audit logs older than 30 days
SELECT '7: Audit logs >30 dias' as check_name, COUNT(*) as old_records
FROM audit_logs
WHERE timestamp < NOW() - INTERVAL '30 days';
