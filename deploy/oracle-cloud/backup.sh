#!/bin/bash
# backup.sh - Automated backup script for Kavach on Oracle Cloud
# Runs daily at 2 AM via cron
#
# SECURITY: This script does NOT backup .env files containing secrets.
# Secrets should be managed via a secrets manager (Vault, AWS Secrets Manager).

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
# SECURITY: Use --pass instead of -a to avoid leaking password in process listing
docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" exec -T redis \
  redis-cli --pass "${REDIS_PASSWORD}" BGSAVE
sleep 5
docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" cp \
  redis:/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# SECURITY: Do NOT backup .env file — it contains JWT secrets, DB passwords, etc.
# Secrets should be managed via a secrets manager, not backup files.
echo "[$(date)] Skipping .env backup (secrets must be managed via secrets manager)"

# Compress all backups
echo "[$(date)] Compressing backups..."
tar -czf "$BACKUP_DIR/kavach_$DATE.tar.gz" \
  "$BACKUP_DIR/db_$DATE.sql.gz" \
  "$BACKUP_DIR/redis_$DATE.rdb"

# Clean up individual files
rm -f "$BACKUP_DIR/db_$DATE.sql.gz" \
      "$BACKUP_DIR/redis_$DATE.rdb"

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
