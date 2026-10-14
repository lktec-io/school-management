#!/usr/bin/env bash
# =============================================================================
# School Management System — automated MySQL backup (cron)
#
#   30 2 * * * /var/www/school-system/server/bin/backup-db.sh >> /var/log/school-system/backup.log 2>&1
#
# Reads DB_* / BACKUP_DIR / MYSQLDUMP_PATH from server/.env (parsed, never executed),
# writes a gzip-compressed, integrity-checked dump and prunes backups older than
# RETENTION_DAYS. Set OFFSITE_TARGET (rsync destination, e.g. backup@10.0.0.5:/srv/school)
# to also copy each backup off the VPS.
# =============================================================================
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$SERVER_DIR/.env}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

[[ -r "$ENV_FILE" ]] || die "Cannot read $ENV_FILE"
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "RETENTION_DAYS must be a whole number"

# Read KEY=value from .env without sourcing it (values may contain shell metacharacters).
env_value() {
  local key="$1" line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  if [[ "$line" == \"*\" ]]; then line="${line:1:${#line}-2}"; fi
  if [[ "$line" == \'*\' ]]; then line="${line:1:${#line}-2}"; fi
  printf '%s' "$line"
}

DB_HOST="$(env_value DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="$(env_value DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
DB_USER="$(env_value DB_USER)"
DB_PASSWORD="$(env_value DB_PASSWORD)"
DB_NAME="$(env_value DB_NAME)"
BACKUP_DIR="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"; BACKUP_DIR="${BACKUP_DIR:-$SERVER_DIR/storage/backups}"
MYSQLDUMP="$(env_value MYSQLDUMP_PATH)"; MYSQLDUMP="${MYSQLDUMP:-mysqldump}"

[[ -n "$DB_USER" ]] || die "DB_USER is not set in $ENV_FILE"
[[ "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] || die "DB_NAME is missing or invalid in $ENV_FILE"
[[ "$DB_PASSWORD" != *'"'* ]] || die "DB_PASSWORD must not contain double quotes"
command -v "$MYSQLDUMP" >/dev/null 2>&1 || die "mysqldump not found (install mysql-client or set MYSQLDUMP_PATH)"

mkdir -p "$BACKUP_DIR"
STAMP="$(TZ=Africa/Dar_es_Salaam date '+%Y%m%d-%H%M%S')"
TARGET="$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"
PARTIAL="$TARGET.partial"
CREDENTIALS="$(mktemp)"
trap 'rm -f "$CREDENTIALS" "$PARTIAL"' EXIT

# Credentials go in a private option file so the password never appears in `ps`.
cat > "$CREDENTIALS" <<EOF
[client]
host=$DB_HOST
port=$DB_PORT
user=$DB_USER
password="$DB_PASSWORD"
EOF

log "Backing up database '$DB_NAME' to $TARGET"
START=$(date +%s)
"$MYSQLDUMP" --defaults-extra-file="$CREDENTIALS" \
  --single-transaction --quick --routines --triggers --no-tablespaces \
  --set-gtid-purged=OFF --default-character-set=utf8mb4 --hex-blob \
  "$DB_NAME" | gzip -9 > "$PARTIAL"

gzip -t "$PARTIAL" || die "Compressed backup failed its integrity check"
zcat "$PARTIAL" | tail -n 1 | grep -q 'Dump completed' || die "Dump is incomplete (no completion marker)"
mv "$PARTIAL" "$TARGET"
chmod 640 "$TARGET"
log "Backup complete in $(( $(date +%s) - START ))s — $(du -h "$TARGET" | cut -f1)"

if [[ -n "${OFFSITE_TARGET:-}" ]]; then
  command -v rsync >/dev/null 2>&1 || die "OFFSITE_TARGET is set but rsync is not installed"
  log "Copying backup off-site to $OFFSITE_TARGET"
  rsync -az --chmod=F640 "$TARGET" "$OFFSITE_TARGET/" || die "Off-site copy failed"
fi

while IFS= read -r old; do
  log "Removed backup older than ${RETENTION_DAYS} days: $(basename "$old")"
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_NAME}-*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete)

log "Done."
