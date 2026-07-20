SELECT h."workflowId", 
       w.name AS workflow_name,
       node->>'name' AS node_name,
       node->'parameters'->>'authentication' AS auth_type,
       node->'parameters'->>'genericAuthType' AS generic_auth
FROM workflow_history h
JOIN workflow_entity w ON w.id = h."workflowId"
CROSS JOIN json_array_elements(h.nodes) AS node
WHERE w.active = true
  AND node->>'type' = 'n8n-nodes-base.httpRequest'
  AND node->'parameters'->>'authentication' IS NOT NULL
ORDER BY w.name, node_name;
