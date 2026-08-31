#!/bin/bash
# Wibsite - Backup Script
# Backs up all PostgreSQL databases, Redis, and configuration files

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${RETENTION_DAYS:-30}
PG_USER="${PG_USER:-wibsite}"
PG_PASSWORD="${PG_PASSWORD:-wibsite_pass}"
PG_HOST="${PG_HOST:-localhost}"

mkdir -p "$BACKUP_DIR"

echo "=== Wibsite Backup $TIMESTAMP ==="

# PostgreSQL backups (ADR-010: twenty fuera de alcance, ya no se respalda)
for db in wibsite chatwoot dify n8n; do
  echo "  Backing up $db..."
  PGPASSWORD=$PG_PASSWORD pg_dump -h $PG_HOST -U $PG_USER -d $db -F c > "$BACKUP_DIR/${db}_${TIMESTAMP}.dump"
  if [ $? -eq 0 ]; then
    gzip "$BACKUP_DIR/${db}_${TIMESTAMP}.dump"
    echo "    ✅ $db backed up ($(du -h "$BACKUP_DIR/${db}_${TIMESTAMP}.dump.gz" | cut -f1))"
  else
    echo "    ❌ $db backup failed"
  fi
done

# Redis backup
if command -v redis-cli &> /dev/null; then
  echo "  Backing up Redis..."
  redis-cli SAVE
  echo "    ✅ Redis snapshot triggered"
fi

# Configuration backup
echo "  Backing up configuration..."
tar czf "$BACKUP_DIR/config_${TIMESTAMP}.tar.gz" \
  .env docker-compose.yml nginx.conf \
  authelia/ monitoring/ 2>/dev/null
echo "    ✅ Config backed up"

# Cleanup old backups
echo "  Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.dump.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "=== Backup Complete ==="
