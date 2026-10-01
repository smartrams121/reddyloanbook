#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily Finance — Database Backup Script
# Add to crontab: 0 2 * * * /opt/dailyfinance/deploy/scripts/backup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

BACKUP_DIR="/opt/dailyfinance/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "Backing up database..."

docker compose -f /opt/dailyfinance/deploy/docker-compose.yml exec -T postgres \
  pg_dump -U financeapp -d financeapp_db --clean --if-exists \
  | gzip > "$BACKUP_DIR/dailyfinance_${TIMESTAMP}.sql.gz"

echo "Backup saved: $BACKUP_DIR/dailyfinance_${TIMESTAMP}.sql.gz"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "dailyfinance_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "Cleaned up backups older than $RETENTION_DAYS days."
