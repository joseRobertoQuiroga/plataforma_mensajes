BEGIN;

-- Reset the workflow state - set activeVersionId and active flag
UPDATE workflow_entity 
SET "activeVersionId" = 'a87511a3-896d-4002-b452-966f20ff62a9', active = true
WHERE id = 'hfmpleUgLaOZUcQ6';

-- Ensure campaign workflow is active
UPDATE workflow_entity 
SET active = true
WHERE id = 'kW9O2RkkwrmiGEjC' AND active = false;

-- Clean and re-register webhooks properly
DELETE FROM webhook_entity;

-- For webhook nodes with webhookId, n8n prefixes the path with webhookId
-- n8n will re-register these on startup automatically
-- We just need the workflow entity to have activeVersionId set

COMMIT;
