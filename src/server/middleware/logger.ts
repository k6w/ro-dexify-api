import type { MiddlewareHandler } from 'hono';
import { ulid } from 'ulid';
import type { Logger } from '../../lib/logger.js';

export const requestLogger = (logger: Logger): MiddlewareHandler => {
  return async (c, next) => {
    const id = ulid();
    c.set('requestId', id);
    c.set('logger', logger.child({ requestId: id }));
    const start = Date.now();
    await next();
    const dur = Date.now() - start;
    logger.info(
      {
        requestId: id,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: dur,
      },
      'request',
    );
    c.res.headers.set('x-request-id', id);
  };
};
