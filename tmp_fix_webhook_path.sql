-- Fix webhook_entity: include webhookId in path for nodes that have webhookId
BEGIN;

-- Remove incorrect webhook entries
DELETE FROM webhook_entity;

-- Re-insert with correct webhookId-prefixed paths
INSERT INTO webhook_entity ("webhookPath", "method", "node", "webhookId", "pathLength", "workflowId")
VALUES 
  ('986f4539-ab2e-454d-a710-ef6c35b832db/chatwoot-inbound', 'POST', 'Chatwoot Webhook', '986f4539-ab2e-454d-a710-ef6c35b832db', 16, 'hfmpleUgLaOZUcQ6'),
  ('465311bc-8dba-4816-8ed8-1fa0668514dc/campaign-trigger', 'POST', 'Manual Webhook Trigger', '465311bc-8dba-4816-8ed8-1fa0668514dc', 16, 'kW9O2RkkwrmiGEjC');

COMMIT;
