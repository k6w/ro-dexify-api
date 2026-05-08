import type { Logger } from '../lib/logger.js';

export type AppVariables = {
  requestId: string;
  logger: Logger;
};

declare module 'hono' {
  interface ContextVariableMap extends AppVariables {}
}

export {};
