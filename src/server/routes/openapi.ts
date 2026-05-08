import { Hono } from 'hono';
import { listProviders } from '../../providers/registry.js';

export const openapiRoutes = new Hono();

openapiRoutes.get('/openapi.json', (c) => c.json(buildOpenApi()));

openapiRoutes.get('/docs', (c) =>
  c.html(`<!doctype html>
<html><head><meta charset="utf-8" />
  <title>ro-dexify-api docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@scalar/api-reference/dist/style.css">
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body></html>`),
);

function buildOpenApi(): unknown {
  const providers = listProviders().map((p) => p.meta.id);
  return {
    openapi: '3.0.3',
    info: {
      title: 'ro-dexify-api',
      version: '2.0.0',
      description:
        'Aggregator API for Romanian dictionaries: DOOM, DEXonline, m.dex.ro, Wiktionary RO, Forvo, DLR, conjugation and pluralization helpers.',
      license: { name: 'MIT' },
    },
    servers: [{ url: '/' }],
    paths: {
      '/v1/word/{word}': {
        get: {
          summary: 'Aggregate dictionary entries across enabled providers',
          parameters: [
            wordParam(),
            { name: 'sources', in: 'query', schema: { type: 'string' } },
            { name: 'refresh', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
            { name: 'include', in: 'query', schema: { type: 'string' } },
          ],
          responses: ok(),
        },
      },
      '/v1/word/{word}/{source}': {
        get: {
          summary: 'Single-provider lookup',
          parameters: [
            wordParam(),
            {
              name: 'source',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: providers },
            },
          ],
          responses: ok(),
        },
      },
      '/v1/audio/{word}': {
        get: { summary: 'Forvo audio passthrough', parameters: [wordParam()], responses: ok() },
      },
      '/v1/conjugate/{verb}': {
        get: { summary: 'Verb conjugation', parameters: [wordParam('verb')], responses: ok() },
      },
      '/v1/pluralize/{noun}': {
        get: { summary: 'Pluralize a noun', parameters: [wordParam('noun')], responses: ok() },
      },
      '/v1/search': {
        get: {
          summary: 'FTS5 search across cached entries',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: ok(),
        },
      },
      '/v1/sources': { get: { summary: 'List providers and capabilities', responses: ok() } },
      '/v1/healthz': { get: { summary: 'Service health', responses: ok() } },
    },
  };
}

function wordParam(name = 'word') {
  return { name, in: 'path', required: true, schema: { type: 'string' } };
}

function ok() {
  return { '200': { description: 'OK' } };
}
