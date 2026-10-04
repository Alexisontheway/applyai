/** Structured logging: human-readable in dev, JSON lines in production. */
import { env } from '../env';

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function enabled(level: Level): boolean {
  return LEVELS[level] >= LEVELS[env.logLevel];
}

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  if (!enabled(level)) return;
  const time = new Date().toISOString();
  if (env.isProduction) {
    console.log(JSON.stringify({ time, level, message, ...context }));
    return;
  }
  const tag = level.toUpperCase().padEnd(5);
  const ctx = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  console.log(`${time.slice(11, 19)} ${tag} ${message}${ctx}`);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
  child(bindings: Record<string, unknown>) {
    return {
      debug: (m: string, c?: Record<string, unknown>) => emit('debug', m, { ...bindings, ...c }),
      info: (m: string, c?: Record<string, unknown>) => emit('info', m, { ...bindings, ...c }),
      warn: (m: string, c?: Record<string, unknown>) => emit('warn', m, { ...bindings, ...c }),
      error: (m: string, c?: Record<string, unknown>) => emit('error', m, { ...bindings, ...c }),
    };
  },
};
