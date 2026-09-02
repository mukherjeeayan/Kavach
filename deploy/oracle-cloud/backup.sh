#!/bin/bash
# backup.sh - Automated backup script for Kavach on Oracle Cloud
# Runs daily at 2 AM via cron

set -euo pipefail

# Configuration
BACKUP_DIR="/home/ubuntu/backups/kavach"
COMPOSE_DIR="/home/ubuntu/kavach/deploy"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL database
echo "[$(date)] Starting database backup..."
docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" exec -T postgres \
  pg_dump -U postgres kavach | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup Redis data
echo "[$(date)] Starting Redis backup..."
docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" exec -T redis \
  redis-cli -a "${REDIS_PASSWORD:-redis_password}" BGSAVE
sleep 5
docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" cp \
  redis:/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Backup environment file
echo "[$(date)] Backing up configuration..."
cp "$COMPOSE_DIR/.env" "$BACKUP_DIR/env_$DATE"

# Compress all backups
echo "[$(date)] Compressing backups..."
tar -czf "$BACKUP_DIR/kavach_$DATE.tar.gz" \
  "$BACKUP_DIR/db_$DATE.sql.gz" \
  "$BACKUP_DIR/redis_$DATE.rdb" \
  "$BACKUP_DIR/env_$DATE"

# Clean up individual files
rm -f "$BACKUP_DIR/db_$DATE.sql.gz" \
      "$BACKUP_DIR/redis_$DATE.rdb" \
      "$BACKUP_DIR/env_$DATE"

# Remove old backups
echo "[$(date)] Cleaning up old backups..."
find "$BACKUP_DIR" -name "kavach_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Upload to Oracle Object Storage (optional)
# Uncomment if you have OCI CLI configured
# echo "[$(date)] Uploading to Object Storage..."
# oci os object put \
#   --bucket-name kavach-backups \
#   --name "backups/kavach_$DATE.tar.gz" \
#   --file "$BACKUP_DIR/kavach_$DATE.tar.gz" \
#   --force

echo "[$(date)] Backup completed: kavach_$DATE.tar.gz"
