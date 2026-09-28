/**
 * Production-ready logger utility.
 * Formats console output cleanly with timestamps and log levels.
 */

const formatMessage = (level: string, message: string): string => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
};

export const logger = {
  info: (msg: string, ...args: any[]): void => console.log(formatMessage('info', msg), ...args),
  warn: (msg: string, ...args: any[]): void => console.warn(formatMessage('warn', msg), ...args),
  error: (msg: string, ...args: any[]): void => console.error(formatMessage('error', msg), ...args),
  debug: (msg: string, ...args: any[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', msg), ...args);
    }
  },
};

export default logger;
