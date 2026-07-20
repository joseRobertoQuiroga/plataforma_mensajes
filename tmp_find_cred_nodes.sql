-- Extract nodes that need credential fix for the two active workflows
SELECT h."workflowId", 
       w.name,
       jsonb_path_query(h.nodes, '$[*] ? (@.type == "n8n-nodes-base.httpRequest")')->>'name' AS node_name,
       jsonb_path_query(h.nodes, '$[*] ? (@.type == "n8n-nodes-base.httpRequest")')->'parameters'->>'authentication' AS auth_type,
       jsonb_path_query(h.nodes, '$[*] ? (@.type == "n8n-nodes-base.httpRequest")')->'parameters'->>'genericAuthType' AS generic_auth
FROM workflow_history h
JOIN workflow_entity w ON w.id = h."workflowId"
WHERE w.active = true
ORDER BY w.name, node_name;
