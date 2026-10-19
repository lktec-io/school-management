import env from './config/env.js';
import app from './app.js';
import { closePool, pingDatabase } from './config/db.js';
import { credentialDiagnostics, isSmsConfigured, recoverInterruptedMessages } from './services/smsService.js';
import logger from './utils/logger.js';

async function start() {
  try {
    await pingDatabase();
    logger.info('Database connection established', { host: env.db.host, database: env.db.name });
  } catch (error) {
    logger.error('Unable to connect to the database', { error: error.message });
    process.exit(1);
  }

  try {
    await recoverInterruptedMessages();
  } catch (error) {
    logger.error('Could not recover interrupted SMS messages', { error: error.message });
  }
  if (!isSmsConfigured()) {
    logger.warn('Beem SMS is not configured; messages will be logged as failed until BEEM_* variables are set');
  } else {
    const { apiKey, secretKey, senderId } = credentialDiagnostics();
    logger.info('Beem SMS configured', { apiKey, secretKey, senderId });
  }
  if (env.beem.overriddenFromFile.length) {
    logger.warn('Stale SMS credentials in the process environment were replaced by server/.env', { keys: env.beem.overriddenFromFile });
  }

  const server = app.listen(env.port, () => {
    logger.info(`API server listening on port ${env.port}`, { env: env.nodeEnv });
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10000);
    forceExit.unref();

    server.close(async () => {
      try {
        await closePool();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error while closing database pool', { error: error.message });
        process.exit(1);
      }
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { error: reason instanceof Error ? reason.stack : String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception, exiting', { error: error.stack });
  process.exit(1);
});

start();
