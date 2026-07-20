BEGIN;

-- 1. Set httpMethod: POST on the chatwoot webhook node in the main workflow's history
UPDATE workflow_history
SET nodes = (
    SELECT json_agg(
        CASE 
            WHEN node->>'id' = 'webhook-chatwoot' THEN
                jsonb_set(node::jsonb, '{parameters,httpMethod}', '"POST"')::json
            ELSE node
        END
    )
    FROM json_array_elements(workflow_history.nodes) AS node
)
WHERE "versionId" = 'a87511a3-896d-4002-b452-966f20ff62a9';

-- 2. Also set it in the duplicate's history (to be safe)
UPDATE workflow_history
SET nodes = (
    SELECT json_agg(
        CASE 
            WHEN node->>'id' = 'webhook-chatwoot' THEN
                jsonb_set(node::jsonb, '{parameters,httpMethod}', '"POST"')::json
            ELSE node
        END
    )
    FROM json_array_elements(workflow_history.nodes) AS node
)
WHERE "versionId" = '1a6b685c-69ec-4409-8c29-cc711c03659d';

-- 3. Delete webhook_entity for the duplicate
DELETE FROM webhook_entity WHERE "workflowId" = 'ktheIzGfXPHbZ9Rg';

-- 4. Deactivate the duplicate workflow
UPDATE workflow_entity SET active = false, "activeVersionId" = NULL WHERE id = 'ktheIzGfXPHbZ9Rg';

-- 5. Ensure main workflow is active
UPDATE workflow_entity SET active = true, "activeVersionId" = 'a87511a3-896d-4002-b452-966f20ff62a9' WHERE id = 'hfmpleUgLaOZUcQ6';

COMMIT;
