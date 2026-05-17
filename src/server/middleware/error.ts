import type { Context, MiddlewareHandler } from 'hono';
import type { Logger } from '../../lib/logger.js';
import { ApiException, httpStatusForCode } from '../../schema/errors.js';

export const errorMiddleware = (logger: Logger): MiddlewareHandler => {
  return async (c, next) => {
    try {
      await next();
    } catch (e) {
      const requestId = c.get('requestId') ?? '';
      if (e instanceof ApiException) {
        logger.warn({ requestId, code: e.code, msg: e.message }, 'api_exception');
        return jsonError(c, e.code, e.message, e.httpStatus, e.details, requestId);
      }
      const message = e instanceof Error ? e.message : String(e);
      logger.error({ requestId, err: message }, 'unhandled_error');
      return jsonError(c, 'INTERNAL', 'internal server error', 500, undefined, requestId);
    }
  };
};

function jsonError(
  c: Context,
  code: string,
  message: string,
  status: number,
  details: Record<string, unknown> | undefined,
  requestId: string,
) {
  return c.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        ...(requestId ? { requestId } : {}),
      },
    },
    status as 400 | 401 | 403 | 404 | 408 | 429 | 500 | 502 | 503 | 504,
  );
}

export function httpStatusOf(code: keyof typeof httpStatusForCode): number {
  return httpStatusForCode[code];
}
