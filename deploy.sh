#!/usr/bin/env bash
# =============================================================================
# School Management System — one-click deployment for https://school.clixworks.co.tz
# on a Contabo (or any) Ubuntu 22.04 / 24.04 LTS VPS.
#
# First install (repository cloned to /var/www/school-system):
#   sudo ./deploy.sh --email it@clixworks.co.tz --school-name "Al-Noor Academy Zanzibar"
# Every update afterwards (pulls main, rebuilds, reloads with zero downtime):
#   sudo ./deploy.sh
#
# Options:
#   --domain NAME          Public hostname (default school.clixworks.co.tz; DNS A record → this server)
#   --email ADDRESS        Let's Encrypt registration/expiry email   [required for the first certificate]
#   --school-name NAME     School name for the initial .env          [required on first install]
#   --branch NAME          Git branch to deploy (default main)
#   --no-pull              Deploy the code as it is on disk (skip git pull)
#   --app-dir PATH         Install location (default /var/www/school-system)
#   --app-user NAME        Unprivileged system user running the API (default schoolapp)
#   --pm2-instances N      API worker processes (default 2)
#   --skip-ssl             Serve over plain HTTP (testing only — cookies become non-secure)
#   --enable-firewall      Configure and enable UFW (allows OpenSSH + HTTP/HTTPS only)
#
# Re-running is safe: packages are installed only if missing, the database/user and
# .env are created only once, certificates are reused, and PM2 reloads without downtime.
# =============================================================================
set -Eeuo pipefail

ORIGINAL_ARGS=("$@")
DOMAIN="school.clixworks.co.tz"
BRANCH="main"
PULL="true"
EMAIL=""
SCHOOL_NAME=""
APP_DIR="/var/www/school-system"
APP_USER="schoolapp"
PM2_INSTANCES="2"
SKIP_SSL="false"
ENABLE_FIREWALL="false"
DB_NAME="school_management"
DB_USER="school_app"
LOG_DIR="/var/log/school-system"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BOLD=$'\e[1m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; RESET=$'\e[0m'
step() { printf '\n%s==> %s%s\n' "$BOLD" "$*" "$RESET"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '%s    ! %s%s\n' "$YELLOW" "$*" "$RESET"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }
trap 'die "Deployment failed at line $LINENO (exit $?). Fix the error above and re-run — the script is safe to repeat."' ERR

usage() { sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --school-name) SCHOOL_NAME="${2:-}"; shift 2 ;;
    --branch) BRANCH="${2:-}"; shift 2 ;;
    --no-pull) PULL="false"; shift ;;
    --app-dir) APP_DIR="${2:-}"; shift 2 ;;
    --app-user) APP_USER="${2:-}"; shift 2 ;;
    --pm2-instances) PM2_INSTANCES="${2:-}"; shift 2 ;;
    --skip-ssl) SKIP_SSL="true"; shift ;;
    --enable-firewall) ENABLE_FIREWALL="true"; shift ;;
    -h|--help) usage 0 ;;
    *) printf 'Unknown option: %s\n\n' "$1"; usage 1 ;;
  esac
done

# ---------------------------------------------------------------------------
step "Pre-flight checks"
[[ $EUID -eq 0 ]] || die "Run as root: sudo ./deploy.sh ..."
[[ -n "$DOMAIN" ]] || die "--domain is required"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || die "--domain contains invalid characters"
[[ "$SKIP_SSL" == "true" || -n "$EMAIL" ]] || die "--email is required for the Let's Encrypt certificate (or pass --skip-ssl)"
[[ "$PM2_INSTANCES" =~ ^[1-9][0-9]*$ ]] || die "--pm2-instances must be a positive number"
[[ "$APP_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || die "--app-user is not a valid user name"
[[ -f "$SOURCE_DIR/server/package.json" && -f "$SOURCE_DIR/client/package.json" ]] \
  || die "Run deploy.sh from the project root (server/ and client/ not found next to it)"
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || die "--branch contains invalid characters"

# ---------------------------------------------------------------------------
if [[ "$PULL" == "true" && -d "$SOURCE_DIR/.git" ]]; then
  step "Pulling latest code (origin/$BRANCH)"
  command -v git >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq git; }
  # core.fileMode=false: the chmod +x applied to scripts after cloning is not a local change.
  GIT=(git -C "$SOURCE_DIR" -c "safe.directory=$SOURCE_DIR" -c core.fileMode=false)
  BEFORE_SCRIPT="$(sha256sum "$SOURCE_DIR/deploy.sh" | cut -d' ' -f1)"
  if [[ -n "$("${GIT[@]}" status --porcelain --untracked-files=no)" ]]; then
    die "Local changes in $SOURCE_DIR would be overwritten. Commit/stash them or re-run with --no-pull."
  fi
  "${GIT[@]}" fetch --prune origin "$BRANCH"
  "${GIT[@]}" checkout -q "$BRANCH"
  "${GIT[@]}" merge --ff-only "origin/$BRANCH"
  info "Now at $("${GIT[@]}" log -1 --format='%h %s (%cr)')"
  # If this update changed deploy.sh itself, restart with the new version.
  if [[ "$(sha256sum "$SOURCE_DIR/deploy.sh" | cut -d' ' -f1)" != "$BEFORE_SCRIPT" ]]; then
    info "deploy.sh was updated — restarting with the new version"
    trap - ERR
    exec bash "$SOURCE_DIR/deploy.sh" "${ORIGINAL_ARGS[@]}" --no-pull
  fi
elif [[ "$PULL" == "true" ]]; then
  warn "$SOURCE_DIR is not a git checkout — deploying the files on disk"
fi

. /etc/os-release
if [[ "${ID:-}" != "ubuntu" || ! "${VERSION_ID:-}" =~ ^(22\.04|24\.04)$ ]]; then
  warn "Tested on Ubuntu 22.04/24.04 LTS; detected ${PRETTY_NAME:-unknown}. Continuing."
fi
FIRST_INSTALL="false"
[[ -f "$APP_DIR/server/.env" ]] || FIRST_INSTALL="true"
if [[ "$FIRST_INSTALL" == "true" && -z "$SCHOOL_NAME" ]]; then
  die "--school-name is required on the first install"
fi
info "Domain: $DOMAIN | App dir: $APP_DIR | User: $APP_USER | First install: $FIRST_INSTALL"

# ---------------------------------------------------------------------------
step "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
PACKAGES=(ca-certificates curl gnupg rsync openssl nginx mysql-server mysql-client cron)
[[ "$SKIP_SSL" == "true" ]] || PACKAGES+=(certbot)
[[ "$ENABLE_FIREWALL" == "true" ]] && PACKAGES+=(ufw)
MISSING=()
for pkg in "${PACKAGES[@]}"; do
  dpkg -s "$pkg" >/dev/null 2>&1 || MISSING+=("$pkg")
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  info "Installing: ${MISSING[*]}"
  apt-get install -y -qq "${MISSING[@]}"
else
  info "All required packages already installed"
fi
timedatectl set-timezone Africa/Dar_es_Salaam 2>/dev/null || warn "Could not set the timezone to Africa/Dar_es_Salaam"
systemctl enable --now mysql nginx cron >/dev/null

# ---------------------------------------------------------------------------
step "Node.js 20 LTS & PM2"
NODE_MAJOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)"
if [[ "${NODE_MAJOR:-0}" -lt 20 ]]; then
  info "Installing Node.js 20.x from NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
info "Node $(node -v), npm $(npm -v)"
if ! command -v pm2 >/dev/null 2>&1; then
  info "Installing PM2"
  npm install -g pm2@latest --silent
fi
info "PM2 $(pm2 -v)"

# ---------------------------------------------------------------------------
step "Application user & files"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/$APP_USER" --shell /bin/bash "$APP_USER"
  info "Created system user $APP_USER"
fi
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
mkdir -p "$APP_DIR" "$LOG_DIR" /var/www/certbot
if [[ "$(realpath "$SOURCE_DIR")" != "$(realpath "$APP_DIR")" ]]; then
  info "Syncing code from $SOURCE_DIR to $APP_DIR"
  rsync -a --delete \
    --exclude '.git/' --exclude 'node_modules/' --exclude 'client/dist/' \
    --exclude 'server/.env' --exclude 'server/storage/' \
    "$SOURCE_DIR/" "$APP_DIR/"
fi
# Normalise line endings in case the code was edited on Windows.
find "$APP_DIR" -maxdepth 3 -name '*.sh' -not -path '*/node_modules/*' -exec sed -i 's/\r$//' {} +
chmod +x "$APP_DIR/deploy.sh" "$APP_DIR/server/bin/backup-db.sh"
mkdir -p "$APP_DIR/server/storage/backups" "$APP_DIR/server/storage/branding"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$LOG_DIR"
chmod 750 "$APP_DIR/server/storage"

run_as_app() { sudo -u "$APP_USER" -H env PM2_LOG_DIR="$LOG_DIR" PM2_INSTANCES="$PM2_INSTANCES" DEPLOY_DOMAIN="$DOMAIN" bash -lc "$*"; }

# ---------------------------------------------------------------------------
step "MySQL database & credentials"
set_env() { # set_env FILE KEY VALUE — replace or append KEY=VALUE
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" 'BEGIN{done=0} $0 ~ "^"k"=" {print k"="v; done=1; next} {print} END{if(!done) print k"="v}' "$file" > "$tmp"
  cat "$tmp" > "$file"
  rm -f "$tmp"
}
ENV_FILE="$APP_DIR/server/.env"
if [[ "$FIRST_INSTALL" == "true" ]]; then
  DB_PASSWORD="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32)"
  JWT_SECRET="$(openssl rand -hex 64)"
  mysql --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
  info "Database '${DB_NAME}' and user '${DB_USER}' ready"

  cp "$APP_DIR/server/.env.example" "$ENV_FILE"
  set_env "$ENV_FILE" NODE_ENV production
  set_env "$ENV_FILE" PORT 5000
  set_env "$ENV_FILE" TRUST_PROXY 1
  set_env "$ENV_FILE" DB_HOST 127.0.0.1
  set_env "$ENV_FILE" DB_PORT 3306
  set_env "$ENV_FILE" DB_USER "$DB_USER"
  set_env "$ENV_FILE" DB_PASSWORD "$DB_PASSWORD"
  set_env "$ENV_FILE" DB_NAME "$DB_NAME"
  set_env "$ENV_FILE" JWT_SECRET "$JWT_SECRET"
  set_env "$ENV_FILE" SCHOOL_NAME "\"${SCHOOL_NAME//\"/}\""
  set_env "$ENV_FILE" STORAGE_DIR "$APP_DIR/server/storage"
  set_env "$ENV_FILE" BACKUP_DIR "$APP_DIR/server/storage/backups"
  set_env "$ENV_FILE" DOMAIN "$DOMAIN"
  if [[ "$SKIP_SSL" == "true" ]]; then
    set_env "$ENV_FILE" CORS_ORIGINS "http://$DOMAIN"
    set_env "$ENV_FILE" COOKIE_SECURE false
  else
    set_env "$ENV_FILE" CORS_ORIGINS "https://$DOMAIN"
    set_env "$ENV_FILE" COOKIE_SECURE true
  fi
  info "Created $ENV_FILE (database password and JWT secret generated)"
else
  info "Keeping existing $ENV_FILE"
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ---------------------------------------------------------------------------
step "Backend dependencies & database migrations"
run_as_app "cd '$APP_DIR/server' && npm ci --omit=dev --no-audit --no-fund"
run_as_app "cd '$APP_DIR/server' && npm run db:migrate"

# ---------------------------------------------------------------------------
step "Frontend build"
run_as_app "cd '$APP_DIR/client' && npm ci --no-audit --no-fund && npm run build"
[[ -f "$APP_DIR/client/dist/index.html" ]] || die "Frontend build did not produce client/dist/index.html"
chmod o+x /var/www "$APP_DIR" "$APP_DIR/client"
chmod -R o+rX "$APP_DIR/client/dist"

# ---------------------------------------------------------------------------
step "Nginx & HTTPS"
SITE_FILE="/etc/nginx/sites-available/school-system"
rm -f /etc/nginx/sites-enabled/default
if [[ "$SKIP_SSL" == "true" ]]; then
  warn "--skip-ssl: serving plain HTTP. Do not use this for real student or payment data."
  cat > "$SITE_FILE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    server_tokens off;
    root ${APP_DIR}/client/dist;
    index index.html;
    client_max_body_size 5m;
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
    }
    location /assets/ { expires 1y; try_files \$uri =404; }
    location / { try_files \$uri \$uri/ /index.html; }
    location ~ /\\. { deny all; }
}
NGINX
else
  if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    info "Requesting a Let's Encrypt certificate for ${DOMAIN}"
    cat > "$SITE_FILE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 503; }
}
NGINX
    ln -sf "$SITE_FILE" /etc/nginx/sites-enabled/school-system
    nginx -t && systemctl reload nginx
    certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
      --email "$EMAIL" --agree-tos --no-eff-email --non-interactive \
      --deploy-hook "systemctl reload nginx"
  else
    info "Certificate for ${DOMAIN} already present (auto-renewal handled by certbot.timer)"
  fi
  # nginx.conf is written for school.clixworks.co.tz in /var/www/school-system; adapt if overridden.
  sed -e "s|school\.clixworks\.co\.tz|${DOMAIN}|g" -e "s|/var/www/school-system|${APP_DIR}|g" "$APP_DIR/nginx.conf" > "$SITE_FILE"
fi
ln -sf "$SITE_FILE" /etc/nginx/sites-enabled/school-system
nginx -t
systemctl reload nginx
info "Nginx configuration valid and reloaded"

# ---------------------------------------------------------------------------
step "API process (PM2)"
if ! run_as_app "pm2 describe pm2-logrotate >/dev/null 2>&1"; then
  run_as_app "pm2 install pm2-logrotate >/dev/null"
fi
run_as_app "pm2 set pm2-logrotate:max_size 20M >/dev/null && pm2 set pm2-logrotate:retain 14 >/dev/null && pm2 set pm2-logrotate:compress true >/dev/null"
# Remove the process name used by earlier releases so two copies never compete for port 5000.
if run_as_app "pm2 describe school-api >/dev/null 2>&1"; then
  run_as_app "pm2 delete school-api >/dev/null"
  info "Removed legacy PM2 process 'school-api'"
fi
run_as_app "cd '$APP_DIR' && pm2 startOrReload ecosystem.config.js --env production --update-env && pm2 save"
pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" >/dev/null
systemctl enable "pm2-$APP_USER" >/dev/null 2>&1 || true

info "Waiting for the API health check"
HEALTHY="false"
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:5000/api/v1/health >/dev/null 2>&1; then HEALTHY="true"; break; fi
  sleep 2
done
[[ "$HEALTHY" == "true" ]] || die "API did not become healthy. Inspect: sudo -u $APP_USER pm2 logs school-system-api --lines 100"
info "API healthy on 127.0.0.1:5000"

SCHEME="https"; [[ "$SKIP_SSL" == "true" ]] && SCHEME="http"
PUBLIC_HEALTH="${SCHEME}://${DOMAIN}/api/v1/health"
if PUBLIC_RESPONSE="$(curl -fsS --max-time 15 "$PUBLIC_HEALTH" 2>&1)"; then
  info "Public health check OK: $PUBLIC_HEALTH → $PUBLIC_RESPONSE"
else
  warn "Public health check failed for $PUBLIC_HEALTH ($PUBLIC_RESPONSE)."
  warn "The API is running locally; check DNS for ${DOMAIN}, the firewall (ports 80/443) and the certificate."
fi

# ---------------------------------------------------------------------------
step "Daily database backup (cron 02:30 EAT)"
CRON_LINE="30 2 * * * $APP_DIR/server/bin/backup-db.sh >> $LOG_DIR/backup.log 2>&1"
( crontab -u "$APP_USER" -l 2>/dev/null | grep -v 'backup-db.sh' || true; echo "$CRON_LINE" ) | crontab -u "$APP_USER" -
info "Installed: $CRON_LINE"

# ---------------------------------------------------------------------------
if [[ "$ENABLE_FIREWALL" == "true" ]]; then
  step "Firewall (UFW)"
  ufw allow OpenSSH >/dev/null
  ufw allow 'Nginx Full' >/dev/null
  ufw --force enable >/dev/null
  info "UFW enabled: OpenSSH, HTTP and HTTPS allowed"
fi

# ---------------------------------------------------------------------------
trap - ERR
printf '\n%s✓ Deployment complete — %s://%s%s\n' "$GREEN$BOLD" "$SCHEME" "$DOMAIN" "$RESET"
info "Commit: $(git -C "$APP_DIR" -c "safe.directory=$APP_DIR" log -1 --format='%h %s' 2>/dev/null || echo 'not a git checkout')"
info "API processes: $(run_as_app "pm2 jlist" 2>/dev/null | grep -o '"status":"online"' | wc -l) online"
if [[ "$FIRST_INSTALL" == "true" ]]; then
  cat <<NEXT

Next steps:
  1. Create the Headmaster account (prints a one-time temporary password):
       cd $APP_DIR/server && sudo -u $APP_USER npm run create-admin -- --name "Full Name" --email head@school.ac.tz
  2. Add Beem Africa SMS keys to $ENV_FILE (BEEM_API_KEY, BEEM_SECRET_KEY, BEEM_SENDER_ID),
     then reload:  sudo -u $APP_USER pm2 reload school-system-api --update-env
  3. Sign in, set the calendar in Academic Setup, and upload the logo/stamp under School Settings.
NEXT
fi
