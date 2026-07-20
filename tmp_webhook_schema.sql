SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'webhook_entity' 
ORDER BY ordinal_position;

SELECT conname, conrelid::regclass, confrelid::regclass, contype
FROM pg_constraint
WHERE conrelid = 'webhook_entity'::regclass;
