/**
 * Production-ready logger utility.
 * Formats console output cleanly with timestamps and log levels.
 */

const formatMessage = (level, message) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
};

export const logger = {
  info: (msg, ...args) => console.log(formatMessage('info', msg), ...args),
  warn: (msg, ...args) => console.warn(formatMessage('warn', msg), ...args),
  error: (msg, ...args) => console.error(formatMessage('error', msg), ...args),
  debug: (msg, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', msg), ...args);
    }
  },
};

export default logger;
