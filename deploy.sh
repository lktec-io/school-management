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
#   5. PM2 reload               (school-system-api, zero-downtime)
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
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  log "reloading $APP_NAME"
  pm2 reload "$APP_NAME" --update-env >/dev/null
else
  log "$APP_NAME not running — starting it from ecosystem.config.js"
  (cd "$ROOT" && pm2 start ecosystem.config.js --env production >/dev/null && pm2 save >/dev/null)
fi

log "done in $((SECONDS - START))s"
