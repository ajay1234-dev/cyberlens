/// <reference types="vite/client" />

/**
 * GuardianEye — Logger Utility
 * Production-safe logging that strips console calls in production builds.
 * Import this instead of using console.* directly anywhere in the codebase.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

const IS_DEV = import.meta.env.DEV === true;

class Logger {
  private readonly module: string;

  constructor(module: string) {
    this.module = module;
  }

  private format(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      level,
      module: this.module,
      message,
      data,
      timestamp: Date.now(),
    };
  }

  debug(message: string, data?: unknown): void {
    if (!IS_DEV) return;
    const entry = this.format('debug', message, data);
    // eslint-disable-next-line no-console
    console.debug(`[GuardianEye:${entry.module}]`, entry.message, entry.data ?? '');
  }

  info(message: string, data?: unknown): void {
    if (!IS_DEV) return;
    const entry = this.format('info', message, data);
    // eslint-disable-next-line no-console
    console.info(`[GuardianEye:${entry.module}]`, entry.message, entry.data ?? '');
  }

  warn(message: string, data?: unknown): void {
    const entry = this.format('warn', message, data);
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[GuardianEye:${entry.module}]`, entry.message, entry.data ?? '');
    }
  }

  error(message: string, data?: unknown): void {
    const entry = this.format('error', message, data);
    // Errors always surface, even in production
    // eslint-disable-next-line no-console
    console.error(`[GuardianEye:${entry.module}]`, entry.message, entry.data ?? '');
  }
}

/**
 * Create a named logger for a module.
 * @example const log = createLogger('psych-detector');
 */
export function createLogger(module: string): Logger {
  return new Logger(module);
}
