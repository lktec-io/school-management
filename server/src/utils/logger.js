const isProduction = process.env.NODE_ENV === 'production';

function write(level, message, meta) {
  const entry = { time: new Date().toISOString(), level, message, ...(meta || {}) };
  const line = isProduction
    ? JSON.stringify(entry)
    : `[${entry.time}] ${level.toUpperCase()} ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`;
  if (level === 'error' || level === 'warn') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};

export default logger;
