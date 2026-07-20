BEGIN;

-- 1. Publish versions (link history versions as published)
INSERT INTO workflow_published_version ("workflowId", "publishedVersionId", "createdAt", "updatedAt")
VALUES 
  ('hfmpleUgLaOZUcQ6', 'a87511a3-896d-4002-b452-966f20ff62a9', NOW(), NOW()),
  ('kW9O2RkkwrmiGEjC', 'e2436433-b766-4a29-b9ed-4f5901b8ffa0', NOW(), NOW()),
  ('ktheIzGfXPHbZ9Rg', '1a6b685c-69ec-4409-8c29-cc711c03659d', NOW(), NOW());

-- 2. Set activeVersionId on each workflow
UPDATE workflow_entity SET "activeVersionId" = 'a87511a3-896d-4002-b452-966f20ff62a9' WHERE id = 'hfmpleUgLaOZUcQ6';
UPDATE workflow_entity SET "activeVersionId" = 'e2436433-b766-4a29-b9ed-4f5901b8ffa0' WHERE id = 'kW9O2RkkwrmiGEjC';
UPDATE workflow_entity SET "activeVersionId" = '1a6b685c-69ec-4409-8c29-cc711c03659d' WHERE id = 'ktheIzGfXPHbZ9Rg';

-- 3. Register webhooks in webhook_entity
-- Note: both "01 - Inbound" workflows share same path "chatwoot-inbound", but PK is (webhookPath, method)
-- so only one can register. We register the original (hfmpleUgLaOZUcQ6) and deactivate the duplicate.
INSERT INTO webhook_entity ("webhookPath", "method", "node", "webhookId", "pathLength", "workflowId")
VALUES 
  ('chatwoot-inbound', 'POST', 'Chatwoot Webhook', '986f4539-ab2e-454d-a710-ef6c35b832db', 16, 'hfmpleUgLaOZUcQ6'),
  ('campaign-trigger', 'POST', 'Manual Webhook Trigger', '465311bc-8dba-4816-8ed8-1fa0668514dc', 16, 'kW9O2RkkwrmiGEjC');

-- 4. Deactivate the duplicate workflow (same path, can't register webhook)
UPDATE workflow_entity SET active = false WHERE id = 'ktheIzGfXPHbZ9Rg';

COMMIT;
