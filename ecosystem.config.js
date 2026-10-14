/**
 * PM2 process definition — School Management System API (school.clixworks.co.tz).
 *
 *   pm2 startOrReload ecosystem.config.js --env production   # zero-downtime reload
 *   pm2 save                                                 # persist across reboots
 *
 * Log rotation is handled by the pm2-logrotate module (deploy.sh configures 20 MB per file,
 * 14 files kept, compressed).
 *
 * Note: API rate limits are kept in memory per worker, so the effective limit is
 * RATE_LIMIT_MAX × instances. Nginx applies one shared per-IP limit in front of all workers.
 */
const path = require('node:path');

const LOG_DIR = process.env.PM2_LOG_DIR || '/var/log/school-system';

module.exports = {
  apps: [
    {
      name: 'school-system-api',
      cwd: path.join(__dirname, 'server'),
      script: 'src/server.js',
      exec_mode: 'cluster',
      instances: Number(process.env.PM2_INSTANCES) || 2,
      node_args: '--max-old-space-size=448',
      // Restart a worker that grows beyond 500 MB (leak protection).
      max_memory_restart: '500M',

      // Restart policy: exponential back-off avoids a crash loop hammering MySQL.
      autorestart: true,
      exp_backoff_restart_delay: 200,
      min_uptime: '20s',
      max_restarts: 30,
      // server.js drains connections for up to 10 s on SIGTERM/SIGINT before exiting.
      kill_timeout: 12000,
      listen_timeout: 15000,

      // Timestamped, merged logs across both workers.
      time: true,
      out_file: path.join(LOG_DIR, 'api-out.log'),
      error_file: path.join(LOG_DIR, 'api-error.log'),
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        DOMAIN: process.env.DEPLOY_DOMAIN || 'school.clixworks.co.tz',
        TZ: 'Africa/Dar_es_Salaam',
      },
    },
  ],
};
