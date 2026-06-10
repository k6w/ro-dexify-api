import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { etag } from 'hono/etag';
import { secureHeaders } from 'hono/secure-headers';
import { ZodError } from 'zod';
import './server/context.js';
import { loadConfig } from './config.js';
import type { Logger } from './lib/logger.js';
import { ApiException } from './schema/errors.js';
import { errorMiddleware } from './server/middleware/error.js';
import { requestLogger } from './server/middleware/logger.js';
import { rateLimitMiddleware } from './server/middleware/ratelimit.js';
import { audioRoutes } from './server/routes/audio.js';
import { conjugateRoutes } from './server/routes/conjugate.js';
import { healthRoutes } from './server/routes/health.js';
import { openapiRoutes } from './server/routes/openapi.js';
import { pluralizeRoutes } from './server/routes/pluralize.js';
import { searchRoutes } from './server/routes/search.js';
import { sourcesRoutes } from './server/routes/sources.js';
import { wordRoutes, wordRoutesV2 } from './server/routes/word.js';

export interface AppOptions {
  logger: Logger;
}

export function buildApp(opts: AppOptions): Hono {
  const cfg = loadConfig();
  const app = new Hono();

  app.use('*', cors());
  app.use('*', secureHeaders());
  app.use('*', etag());
  app.use('*', requestLogger(opts.logger));
  app.use('*', errorMiddleware(opts.logger));
  app.use('/v1/*', rateLimitMiddleware(cfg.RATE_LIMIT_PER_MIN));

  app.route('/v1', wordRoutes);
  // /v2 serves the full entry: sense tree, relations, paradigm, authority.
  app.route('/v2', wordRoutesV2);
  app.route('/v1', searchRoutes);
  app.route('/v1', audioRoutes);
  app.route('/v1', conjugateRoutes);
  app.route('/v1', pluralizeRoutes);
  app.route('/v1', sourcesRoutes);
  app.route('/v1', healthRoutes);
  app.route('/', openapiRoutes);

  app.get('/', (c) =>
    c.json({
      name: 'ro-dexify-api',
      version: '2.0.0',
      docs: '/docs',
      openapi: '/openapi.json',
      v1: '/v1',
    }),
  );

  app.onError((err, c) => {
    const requestId = c.get('requestId') ?? '';
    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'request validation failed',
            details: { issues: err.issues },
            ...(requestId ? { requestId } : {}),
          },
        },
        400,
      );
    }
    if (err instanceof ApiException) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
            ...(requestId ? { requestId } : {}),
          },
        },
        err.httpStatus as 400 | 401 | 403 | 404 | 408 | 429 | 500 | 502 | 503 | 504,
      );
    }
    opts.logger.error({ err: err.message, stack: err.stack, requestId }, 'unhandled');
    return c.json(
      {
        error: {
          code: 'INTERNAL',
          message: 'internal server error',
          ...(requestId ? { requestId } : {}),
        },
      },
      500,
    );
  });

  return app;
}
