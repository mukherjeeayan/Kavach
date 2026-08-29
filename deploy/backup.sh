#!/bin/bash
# Kavach database backup script
# Run daily via cron: 0 2 * * * /opt/kavach/deploy/backup.sh >> /var/log/kavach-backup.log 2>&1
#
# Required environment variables:
#   DB_HOST, DB_PORT, DB_USER, DB_NAME, DB_PASSWORD (or PGPASSWORD)
#   BACKUP_BUCKET (S3 bucket name)
#   AWS_REGION (default: us-east-1)
#   BACKUP_RETENTION_DAYS (default: 30)

set -euo pipefail

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/kavach_${TIMESTAMP}.sql.gz"
BACKUP_BUCKET="${BACKUP_BUCKET:-kavach-prod-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
LOG_PREFIX="[kavach-backup]"

echo "${LOG_PREFIX} Starting backup at $(date -Iseconds)"

# 1. Verify required env vars
if [ -z "${DB_HOST:-}" ] || [ -z "${DB_USER:-}" ] || [ -z "${DB_NAME:-}" ]; then
  echo "${LOG_PREFIX} ERROR: DB_HOST, DB_USER, and DB_NAME must be set" >&2
  exit 1
fi

# 2. Verify pg_dump is available
if ! command -v pg_dump &> /dev/null; then
  echo "${LOG_PREFIX} ERROR: pg_dump not found. Install postgresql-client." >&2
  exit 1
fi

# 3. Create the backup (compressed, custom format for fast restore)
echo "${LOG_PREFIX} Dumping database ${DB_NAME} from ${DB_HOST}..."
export PGPASSWORD="${DB_PASSWORD:-}"

if ! pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT:-5432}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --verbose \
  --file="${BACKUP_FILE}"; then
  echo "${LOG_PREFIX} ERROR: pg_dump failed" >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# 4. Get backup size for logging
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "${LOG_PREFIX} Backup file created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# 5. Upload to S3
if command -v aws &> /dev/null; then
  echo "${LOG_PREFIX} Uploading to s3://${BACKUP_BUCKET}/db/..."
  if ! aws s3 cp "${BACKUP_FILE}" "s3://${BACKUP_BUCKET}/db/kavach_${TIMESTAMP}.dump" \
    --storage-class STANDARD_IA \
    --only-show-errors; then
    echo "${LOG_PREFIX} ERROR: S3 upload failed" >&2
    exit 1
  fi
  echo "${LOG_PREFIX} Upload complete"
else
  echo "${LOG_PREFIX} WARNING: aws CLI not found, backup not uploaded to S3"
fi

# 6. Cleanup old backups (older than retention period)
if command -v aws &> /dev/null; then
  echo "${LOG_PREFIX} Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
  CUTOFF_DATE=$(date -d "${BACKUP_RETENTION_DAYS} days ago" +%Y-%m-%d 2>/dev/null || date -v -"${BACKUP_RETENTION_DAYS}"d +%Y-%m-%d)
  aws s3api list-objects-v2 \
    --bucket "${BACKUP_BUCKET}" \
    --prefix "db/" \
    --query "Contents[?LastModified<='${CUTOFF_DATE}'].Key" \
    --output text 2>/dev/null | while read -r KEY; do
      if [ -n "${KEY}" ] && [ "${KEY}" != "None" ]; then
        aws s3 rm "s3://${BACKUP_BUCKET}/${KEY}" --only-show-errors
        echo "${LOG_PREFIX} Deleted old backup: ${KEY}"
      fi
    done
fi

# 7. Cleanup local file
rm -f "${BACKUP_FILE}"

echo "${LOG_PREFIX} Backup completed successfully at $(date -Iseconds)"

# 8. Verify last backup is restorable (optional, set VERIFY_RESTORE=1)
if [ "${VERIFY_RESTORE:-0}" = "1" ]; then
  echo "${LOG_PREFIX} VERIFY_RESTORE=1, performing test restore..."
  LATEST=$(aws s3api list-objects-v2 \
    --bucket "${BACKUP_BUCKET}" \
    --prefix "db/" \
    --query "Contents | sort_by(@, &LastModified) | [-1].Key" \
    --output text 2>/dev/null)
  if [ -n "${LATEST}" ] && [ "${LATEST}" != "None" ]; then
    aws s3 cp "s3://${BACKUP_BUCKET}/${LATEST}" /tmp/verify_restore.dump
    TEST_DB="kavach_restore_verify_${TIMESTAMP}"
    createdb "${TEST_DB}" 2>/dev/null || true
    if pg_restore --dbname="${TEST_DB}" --no-owner /tmp/verify_restore.dump 2>&1 | tail -5; then
      COUNT=$(psql "${TEST_DB}" -tAc "SELECT COUNT(*) FROM parents;")
      echo "${LOG_PREFIX} Restore verification passed: ${COUNT} parents in restored DB"
      dropdb "${TEST_DB}"
    else
      echo "${LOG_PREFIX} ERROR: Restore verification FAILED" >&2
      exit 1
    fi
    rm -f /tmp/verify_restore.dump
  fi
fi

exit 0
