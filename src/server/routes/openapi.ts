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
            ...viewParams(),
          ],
          responses: ok(),
        },
      },
      '/v2/word/{word}': {
        get: {
          summary: 'Aggregate entries, full v2 shape (recursive sense tree)',
          description:
            'Same lookup as /v1 but returns the entry as the providers built it: ' +
            'typed sense tree, per-sense relations and sources, paradigm, homonymIndex, ' +
            'inflection origin/confidence and source authority. /v1 is this, flattened.',
          parameters: [
            wordParam(),
            { name: 'sources', in: 'query', schema: { type: 'string' } },
            { name: 'refresh', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
            { name: 'include', in: 'query', schema: { type: 'string' } },
            ...viewParams(),
          ],
          responses: ok(),
        },
      },
      '/v1/word/{word}/{source}': {
        get: {
          summary: 'Single-provider lookup',
          parameters: [wordParam(), sourceParam(providers), ...viewParams()],
          responses: ok(),
        },
      },
      '/v2/word/{word}/{source}': {
        get: {
          summary: 'Single-provider lookup, full v2 shape',
          parameters: [wordParam(), sourceParam(providers), ...viewParams()],
          responses: ok(),
        },
      },
      '/v1/tts/{word}': {
        get: {
          summary: 'Pronunciation audio',
          description:
            'Returns a human recording from Wikimedia Commons / Lingua Libre when one ' +
            'exists, and espeak-ng synthesis driven by the derived IPA otherwise. ' +
            'Licence and attribution travel with the audio in X-Audio-* headers ' +
            '(percent-encoded, since HTTP headers are ASCII) and verbatim in ?meta.',
          parameters: [
            wordParam(),
            {
              name: 'meta',
              in: 'query',
              description: 'Return JSON describing the audio instead of the bytes.',
              schema: { type: 'boolean' },
            },
            {
              name: 'engine',
              in: 'query',
              description: "Force an engine; 'espeak' skips the Commons lookup.",
              schema: { type: 'string', enum: ['espeak'] },
            },
            {
              name: 'voice',
              in: 'query',
              description:
                'Synthesised voice. Defaults to female. Human recordings are unaffected, ' +
                'since Commons publishes no speaker gender to filter on.',
              schema: { type: 'string', enum: ['female', 'male'], default: 'female' },
            },
          ],
          responses: {
            '200': {
              description: 'Audio bytes, or JSON when ?meta is set',
              content: {
                'audio/wav': { schema: { type: 'string', format: 'binary' } },
                'application/ogg': { schema: { type: 'string', format: 'binary' } },
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      word: { type: 'string' },
                      engine: { type: 'string', enum: ['commons', 'piper', 'espeak'] },
                      voice: { type: 'string' },
                      mime: { type: 'string' },
                      license: { type: 'string' },
                      attribution: { type: 'string' },
                      sourceUrl: { type: 'string' },
                      ipa: { type: 'string' },
                      syllabification: { type: 'string' },
                      stressOrigin: { type: 'string', enum: ['attested', 'derived'] },
                    },
                  },
                },
              },
            },
          },
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

function sourceParam(providers: readonly string[]) {
  return {
    name: 'source',
    in: 'path',
    required: true,
    schema: { type: 'string', enum: providers },
  };
}

/**
 * Post-cache view options, shared by every /word route on both versions.
 * These filter the response; they never change what is fetched or cached.
 */
function viewParams() {
  return [
    {
      name: 'all',
      in: 'query',
      description: 'Skip ranking, deduplication and the per-provider cap.',
      schema: { type: 'boolean' },
    },
    {
      name: 'dict',
      in: 'query',
      description: 'Comma-separated contributing dictionaries, e.g. "DEX \'09,MDA2".',
      schema: { type: 'string' },
    },
    {
      name: 'limit',
      in: 'query',
      description: 'Cap on entries per provider.',
      schema: { type: 'integer', minimum: 1, maximum: 200, default: 8 },
    },
    {
      name: 'orthographic',
      in: 'query',
      description: 'Include DOOM/Ortografic entries, which carry inflection but no definitions.',
      schema: { type: 'boolean' },
    },
    {
      name: 'merge',
      in: 'query',
      description: 'Combine providers describing the same word into one entry.',
      schema: { type: 'boolean' },
    },
  ];
}

function ok() {
  return { '200': { description: 'OK' } };
}
