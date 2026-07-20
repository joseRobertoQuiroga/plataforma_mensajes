DO $$
DECLARE
    rec RECORD;
    nodes_jsonb jsonb;
    updated_nodes jsonb;
    i integer;
    node jsonb;
BEGIN
    FOR rec IN 
        SELECT h."workflowId", h."versionId", h.nodes::jsonb AS nb 
        FROM workflow_history h
        JOIN workflow_entity w ON w.id = h."workflowId"
        WHERE w.active = true
    LOOP
        nodes_jsonb := rec.nb;
        updated_nodes := '[]'::jsonb;
        
        FOR i IN 0..jsonb_array_length(nodes_jsonb) - 1 LOOP
            node := nodes_jsonb -> i;
            
            IF node->>'type' = 'n8n-nodes-base.httpRequest' 
               AND node->'parameters'->>'authentication' = 'genericCredentialType' THEN
                node := jsonb_set(node, '{parameters,authentication}', '"none"');
                node := node #- '{parameters,genericAuthType}';
            END IF;
            
            updated_nodes := updated_nodes || node;
        END LOOP;
        
        UPDATE workflow_history 
        SET nodes = updated_nodes::json 
        WHERE "versionId" = rec."versionId";
        
        RAISE NOTICE 'Updated workflow % (version: %)', rec."workflowId", rec."versionId";
    END LOOP;
END $$;
