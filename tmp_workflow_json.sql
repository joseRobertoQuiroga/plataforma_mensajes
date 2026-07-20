-- Extract workflow JSON to find webhook nodes
SELECT w.name AS workflow_name,
       h."versionId",
       h.nodes::text
FROM workflow_history h
JOIN workflow_entity w ON w.id = h."workflowId"
ORDER BY w.name;
