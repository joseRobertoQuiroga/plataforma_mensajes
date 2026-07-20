SELECT a.attname, a.attnum
FROM pg_index i
JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
WHERE i.indrelid = 'webhook_entity'::regclass
AND i.indisprimary;
