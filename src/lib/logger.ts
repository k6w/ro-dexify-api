import pino from 'pino';

export type Logger = pino.Logger;

let rootLogger: Logger | undefined;

export function getLogger(): Logger {
  if (!rootLogger) {
    const level = process.env.LOG_LEVEL ?? 'info';
    rootLogger = pino({
      level,
      base: { service: 'ro-dexify-api' },
    });
  }
  return rootLogger;
}

export function resetLoggerForTests(): void {
  rootLogger = undefined;
}
