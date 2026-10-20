#!/usr/bin/env bash
# =====================================================================
# School Management System — production update.
#
#   ./deploy.sh
#
# Runs from the repository root (wherever it is cloned) and does exactly:
#   1. git pull origin main (fast-forward only, when inside a git checkout)
#   2. npm install for server and client (skipped when package-lock.json is unchanged)
#   3. database migrations      (server: npm run db:migrate)
#   4. production build         (client: npm run build)
#   5. PM2 reload               (school-system-api, zero-downtime) — or a fresh start when the
#                                running process belongs to another checkout (e.g. an old app dir)
#   6. smoke check              (API answers /health and runs from this checkout)
#
# Run it as the user that owns the PM2 process. To run from root on behalf of that
# user:  RUN_AS=schoolapp ./deploy.sh
# Exits non-zero on the first failure; nothing is reloaded unless every step succeeded.
# =====================================================================
set -euo pipefail

APP_NAME="school-system-api"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${RUN_AS:-}" && "$(id -un)" != "$RUN_AS" ]]; then
  exec sudo -u "$RUN_AS" -H env RUN_AS="$RUN_AS" bash "$ROOT/deploy.sh" "$@"
fi

export NODE_ENV=production
export npm_config_fund=false npm_config_audit=false npm_config_update_notifier=false npm_config_loglevel=error
START=$SECONDS
log() { printf '[deploy %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
trap 'log "FAILED at line $LINENO: $BASH_COMMAND"' ERR

# Install a package's dependencies only when its lockfile changed since the last deploy.
install_deps() { # install_deps DIR [extra npm flags]
  local dir="$1"; shift
  local stamp="$dir/node_modules/.deploy-lock-hash"
  local hash
  hash="$(sha256sum "$dir/package-lock.json" | cut -d' ' -f1)"
  if [[ -f "$stamp" && "$(cat "$stamp")" == "$hash" ]]; then
    log "dependencies up to date: ${dir#"$ROOT"/}"
    return
  fi
  log "installing dependencies: ${dir#"$ROOT"/}"
  (cd "$dir" && npm ci "$@" >/dev/null)
  printf '%s' "$hash" > "$stamp"
}

# 1. Pull ---------------------------------------------------------------
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [[ -z "${DEPLOY_REEXEC:-}" ]]; then
    before="$(sha256sum "$ROOT/deploy.sh")"
    log "pulling origin/main"
    git -C "$ROOT" -c core.fileMode=false pull --ff-only --quiet origin main
    # Bash reads scripts incrementally: restart if this file was just updated.
    if [[ "$(sha256sum "$ROOT/deploy.sh")" != "$before" ]]; then
      log "deploy.sh changed — restarting it"
      DEPLOY_REEXEC=1 exec bash "$ROOT/deploy.sh" "$@"
    fi
  fi
  log "at $(git -C "$ROOT" log -1 --format='%h %s')"
fi

# 2. Dependencies -------------------------------------------------------
install_deps "$ROOT/server" --omit=dev
# The build needs Vite (a devDependency), so the client installs everything.
NODE_ENV=development install_deps "$ROOT/client"

# 3. Migrations ---------------------------------------------------------
log "running database migrations"
(cd "$ROOT/server" && npm run --silent db:migrate)

# 4. Build --------------------------------------------------------------
log "building client"
(cd "$ROOT/client" && npm run --silent build >/dev/null)
[[ -f "$ROOT/client/dist/index.html" ]] || { log "build produced no client/dist/index.html"; exit 1; }

# 5. Reload -------------------------------------------------------------
# Directory the running PM2 process was started from ("" when it is not running).
pm2_cwd() {
  pm2 jlist 2>/dev/null | node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => { raw += chunk; }).on("end", () => {
      try {
        // pm2 may print "[PM2] ..." notices before the JSON list; start at the list itself.
        const start = Math.min(...["[{", "[]"].map((token) => raw.indexOf(token)).filter((index) => index >= 0));
        const app = JSON.parse(raw.slice(start)).find((p) => p.name === process.argv[1]);
        process.stdout.write(app?.pm2_env?.pm_cwd ?? "");
      } catch { /* pm2 printed no process list */ }
    });' "$APP_NAME"
}
real_dir() { (cd "$1" 2>/dev/null && pwd -P) || printf '%s' "$1"; }

SERVER_DIR="$(real_dir "$ROOT/server")"
RUNNING_DIR="$(pm2_cwd)"
# PM2 keeps the directory a process was first started from: reloading a process that was started in
# another checkout (such as the old /var/www/school-system) would keep serving that old code.
if [[ -n "$RUNNING_DIR" && "$(real_dir "$RUNNING_DIR")" != "$SERVER_DIR" ]]; then
  log "$APP_NAME runs from $RUNNING_DIR, not $SERVER_DIR — recreating it from this checkout"
  pm2 delete "$APP_NAME" >/dev/null
  RUNNING_DIR=""
fi
if [[ -n "$RUNNING_DIR" ]]; then
  log "reloading $APP_NAME"
  pm2 reload "$APP_NAME" --update-env >/dev/null
else
  log "starting $APP_NAME from $ROOT/ecosystem.config.js"
  (cd "$ROOT" && pm2 start ecosystem.config.js --env production >/dev/null && pm2 save >/dev/null)
fi

# 6. Smoke check --------------------------------------------------------
if [[ "$(real_dir "$(pm2_cwd)")" != "$SERVER_DIR" ]]; then
  log "ERROR: $APP_NAME is not running from $SERVER_DIR (pm2 reports: $(pm2_cwd))"
  exit 1
fi
healthy=""
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${API_PORT:-5000}/api/v1/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 1
done
if [[ -z "$healthy" ]]; then
  log "ERROR: API did not answer /api/v1/health on port ${API_PORT:-5000} — check: pm2 logs $APP_NAME"
  exit 1
fi
log "API healthy, running from $SERVER_DIR"

# Nginx must serve this checkout's build; warn (without failing) when the live site points elsewhere.
for site in /etc/nginx/sites-enabled/*; do
  [[ -r "$site" ]] || continue
  served="$(grep -Eo 'root[[:space:]]+[^;]*client/dist' "$site" 2>/dev/null | awk '{print $2}' | head -n1)"
  if [[ -n "$served" && "$(real_dir "$served")" != "$(real_dir "$ROOT/client/dist")" ]]; then
    log "WARNING: nginx site $site serves $served — update its root to $ROOT/client/dist and run: sudo nginx -t && sudo systemctl reload nginx"
  fi
done

log "done in $((SECONDS - START))s"
