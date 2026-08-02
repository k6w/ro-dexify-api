import { Hono } from 'hono';
import { listProviders } from '../../providers/registry.js';

export const openapiRoutes = new Hono();

openapiRoutes.get('/openapi.json', (c) => c.json(buildOpenApi()));

openapiRoutes.get('/docs', (c) =>
  c.html(`<!doctype html>
<html><head><meta charset="utf-8" />
  <title>ro-dexify-api — API reference</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"
          data-configuration='{"theme":"purple","layout":"modern","defaultOpenAllTags":false,"hideDownloadButton":false}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body></html>`),
);

/**
 * Sidebar sections.
 *
 * Without `tags` every operation lands in one flat, ungrouped list, which is
 * unreadable once there are eleven of them — four of which are variations on
 * "look up a word" and indistinguishable by path alone.
 *
 * Order here is the order Scalar renders, so it runs most-used first.
 */
const TAGS = [
  {
    name: 'Look up a word',
    description:
      'The main endpoint. Returns what several dictionaries say about a word: ' +
      'definitions, grammar, inflections, etymology and pronunciation.\n\n' +
      '**Start with `GET /v1/word/{word}`.** Use the v2 variants when you want the ' +
      'full sense tree, relations and paradigms rather than a flattened list.',
  },
  {
    name: 'Pronunciation',
    description:
      'Audio and phonetics. `/v1/tts` returns a human recording where one exists ' +
      'and synthesises otherwise, so it always answers.',
  },
  {
    name: 'Grammar tools',
    description: 'Conjugate a verb or pluralise a noun. Computed locally, no network.',
  },
  {
    name: 'Search',
    description: 'Full-text search over words already cached locally.',
  },
  {
    name: 'Service',
    description: 'Health and provider status. Useful for monitoring, not for looking words up.',
  },
];

function buildOpenApi(): unknown {
  const providers = listProviders().map((p) => p.meta.id);
  return {
    openapi: '3.0.3',
    info: {
      title: 'ro-dexify-api',
      version: '2.0.0',
      description: [
        'Romanian dictionary API. Give it a word, get definitions, grammar, IPA and audio,',
        'drawn from DOOM 3, DEXonline and Wiktionary and normalised into one shape.',
        '',
        '### Where to start',
        '',
        '`GET /v1/word/casă` — everything about a word.  ',
        '`GET /v1/tts/casă` — hear it.',
        '',
        '### Two response shapes',
        '',
        '- **`/v1`** — senses are a flat list. Frozen; safe for existing clients.',
        '- **`/v2`** — the full entry: a nested sense tree with typed nodes, per-sense',
        '  relations and sources, declension tables, and `origin`/`confidence` markers.',
        '',
        'Only `/word` is versioned. Everything else lives under `/v1`.',
        '',
        '### Reading a response',
        '',
        'Lookups return `{ headword, entries[], cache, errors[] }`. A non-empty `errors`',
        'alongside non-empty `entries` is normal — one dictionary failed, the rest worked.',
        'Check `entries` first.',
        '',
        'Values are marked `attested` (a dictionary said it) or `derived` (a rule worked',
        'it out). Prefer attested.',
        '',
        'Full guides: [docs/](https://github.com/k6w/ro-dexify-api/tree/main/docs)',
      ].join('\n'),
      license: { name: 'MIT' },
    },
    externalDocs: {
      description: 'Written documentation — concepts, accuracy, sources',
      url: 'https://github.com/k6w/ro-dexify-api/tree/main/docs',
    },
    servers: [{ url: '/' }],
    tags: TAGS,
    paths: {
      '/v1/word/{word}': {
        get: {
          tags: ['Look up a word'],
          operationId: 'lookupWord',
          summary: 'Look up a word',
          description:
            'Asks every enabled dictionary and returns their entries, ranked by source ' +
            'authority and deduplicated.\n\nThis is the one to start with.',
          parameters: [wordParam(), ...lookupParams(), ...viewParams()],
          responses: ok(),
        },
      },
      '/v1/word/{word}/{source}': {
        get: {
          tags: ['Look up a word'],
          operationId: 'lookupWordFromSource',
          summary: 'Look up a word — one dictionary only',
          description: 'Same as above, restricted to a single provider.',
          parameters: [wordParam(), sourceParam(providers), ...viewParams()],
          responses: ok(),
        },
      },
      '/v2/word/{word}': {
        get: {
          tags: ['Look up a word'],
          operationId: 'lookupWordV2',
          summary: 'Look up a word — full shape (v2)',
          description:
            'The same lookup, returning the entry as the providers built it: a nested ' +
            'sense tree with typed nodes (`meaning`, `example`, `expression`, `locution`), ' +
            'per-sense `relations` and `sources`, `paradigm`, `homonymIndex`, and ' +
            '`origin`/`confidence` on every inflection.\n\n' +
            '`/v1` is this, flattened.',
          parameters: [wordParam(), ...lookupParams(), ...viewParams()],
          responses: ok(),
        },
      },
      '/v2/word/{word}/{source}': {
        get: {
          tags: ['Look up a word'],
          operationId: 'lookupWordFromSourceV2',
          summary: 'Look up a word — full shape, one dictionary',
          parameters: [wordParam(), sourceParam(providers), ...viewParams()],
          responses: ok(),
        },
      },

      '/v1/tts/{word}': {
        get: {
          tags: ['Pronunciation'],
          operationId: 'pronounce',
          summary: 'Hear a word (audio)',
          description:
            'Returns audio bytes, or JSON describing them with `?meta`.\n\n' +
            'Three tiers, best first: a **human recording** from Wikimedia Commons, ' +
            '**Piper** neural synthesis (`pnpm voices` to install), then **espeak-ng**, ' +
            'which always works.\n\n' +
            'Synthesis uses a female voice by default. `?voice` affects synthesis only — ' +
            'a human recording is whoever recorded that word.\n\n' +
            'Licence and attribution come back in the JSON and in `X-Audio-*` headers ' +
            '(percent-encoded, since HTTP headers are ASCII and IPA is not).',
          parameters: [
            wordParam(),
            {
              name: 'meta',
              in: 'query',
              description: 'Return JSON describing the audio instead of the bytes.',
              schema: { type: 'boolean' },
            },
            {
              name: 'voice',
              in: 'query',
              description: 'Synthesised voice. Human recordings are unaffected.',
              schema: { type: 'string', enum: ['female', 'male'], default: 'female' },
            },
            {
              name: 'engine',
              in: 'query',
              description:
                'Pin one tier instead of walking them. A pinned tier that cannot serve ' +
                'the word returns 503 rather than silently falling back.',
              schema: { type: 'string', enum: ['commons', 'piper', 'espeak'] },
            },
          ],
          responses: {
            '200': {
              description: 'Audio bytes, or JSON when `?meta` is set',
              content: {
                'audio/wav': { schema: { type: 'string', format: 'binary' } },
                'application/ogg': { schema: { type: 'string', format: 'binary' } },
                'application/json': { schema: { $ref: '#/components/schemas/Pronunciation' } },
              },
            },
            '503': { description: 'The pinned tier cannot serve this word' },
          },
        },
      },
      '/v1/audio/{word}': {
        get: {
          tags: ['Pronunciation'],
          operationId: 'forvoAudio',
          summary: 'Forvo recordings (needs an API key)',
          description:
            'Passthrough to Forvo. Requires `FORVO_API_KEY`; returns 503 without one.\n\n' +
            'Most people want `/v1/tts` instead — it is free and needs no key.',
          parameters: [wordParam()],
          responses: ok(),
        },
      },

      '/v1/conjugate/{verb}': {
        get: {
          tags: ['Grammar tools'],
          operationId: 'conjugate',
          summary: 'Conjugate a verb',
          description:
            'Accepts either citation form — `merge` and `a merge` are equivalent.\n\n' +
            '22 irregular verbs come from a table; the rest from a four-class rule engine. ' +
            '`source` says which.',
          parameters: [wordParam('verb')],
          responses: ok(),
        },
      },
      '/v1/pluralize/{noun}': {
        get: {
          tags: ['Grammar tools'],
          operationId: 'pluralize',
          summary: 'Pluralise a noun',
          description:
            'Rule-based, so irregulars (`ou` → `ouă`, `oaie` → `oi`) are where it fails. ' +
            'Prefer an attested plural from `/v2/word` when one exists.',
          parameters: [wordParam('noun')],
          responses: ok(),
        },
      },

      '/v1/search': {
        get: {
          tags: ['Search'],
          operationId: 'search',
          summary: 'Search cached words',
          description:
            'Searches words already in the local database — seeded, or cached by earlier ' +
            'lookups. It does not reach the internet.\n\n' +
            'Diacritics are folded, so `casa` finds `casă`. Every term is matched as a ' +
            'prefix.',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: true,
              description: 'Search terms. Diacritics optional.',
              schema: { type: 'string', example: 'casa' },
            },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: ok(),
        },
      },

      '/v1/sources': {
        get: {
          tags: ['Service'],
          operationId: 'listSources',
          summary: 'List dictionaries and their status',
          description:
            'Which providers exist, what each supplies, and whether its circuit breaker ' +
            'is open. Check here first if results suddenly get thinner.',
          responses: ok(),
        },
      },
      '/v1/healthz': {
        get: {
          tags: ['Service'],
          operationId: 'health',
          summary: 'Health check',
          description:
            'Does not touch the network, so an upstream outage cannot fail it. ' +
            '`degraded` means a provider is failing but lookups still work.',
          responses: ok(),
        },
      },
    },
    components: {
      schemas: {
        Pronunciation: {
          type: 'object',
          properties: {
            word: { type: 'string', example: 'casă' },
            engine: { type: 'string', enum: ['commons', 'piper', 'espeak'] },
            mime: { type: 'string', example: 'application/ogg' },
            bytes: { type: 'integer' },
            license: { type: 'string', example: 'Public domain' },
            attribution: { type: 'string' },
            sourceUrl: { type: 'string' },
            voice: { type: 'string', example: 'ro+f3' },
            ipa: { type: 'string', example: '/ˈka.sə/' },
            syllabification: { type: 'string', example: 'ca-să' },
            stressOrigin: { type: 'string', enum: ['attested', 'derived'] },
          },
        },
      },
    },
  };
}

function wordParam(name = 'word') {
  return {
    name,
    in: 'path',
    required: true,
    description: 'Romanian word. Diacritics are fine; percent-encode if your client needs it.',
    schema: { type: 'string', example: 'casă' },
  };
}

function sourceParam(providers: readonly string[]) {
  return {
    name: 'source',
    in: 'path',
    required: true,
    description: 'Which dictionary to ask.',
    schema: { type: 'string', enum: providers },
  };
}

/** Parameters that change which providers are consulted. */
function lookupParams() {
  return [
    {
      name: 'sources',
      in: 'query',
      description: 'Comma-separated provider ids, e.g. `doom,dexonline`.',
      schema: { type: 'string' },
    },
    {
      name: 'refresh',
      in: 'query',
      description: 'Bypass the cache and refetch. Slow; for debugging.',
      schema: { type: 'boolean' },
    },
    {
      name: 'include',
      in: 'query',
      description: 'Only providers with these capabilities, e.g. `definitions`.',
      schema: { type: 'string' },
    },
  ];
}

/**
 * Post-cache view options, shared by every /word route on both versions.
 * These shape the response; they never change what is fetched or cached.
 */
function viewParams() {
  return [
    {
      name: 'merge',
      in: 'query',
      description:
        'Combine every dictionary’s account of the same word into one entry. ' +
        'Usually what you want for display.',
      schema: { type: 'boolean' },
    },
    {
      name: 'all',
      in: 'query',
      description: 'Skip ranking, deduplication and the cap. Returns everything.',
      schema: { type: 'boolean' },
    },
    {
      name: 'dict',
      in: 'query',
      description: "Only these contributing dictionaries, e.g. `DEX '09,MDA2`.",
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
      description: 'Include entries that carry grammar but no definitions (DOOM inside DEXonline).',
      schema: { type: 'boolean' },
    },
  ];
}

function ok() {
  return { '200': { description: 'OK' } };
}
