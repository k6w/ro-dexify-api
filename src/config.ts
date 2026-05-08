import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DB_PATH: z.string().default('./vocabulary.db'),

  USER_AGENT: z
    .string()
    .default('ro-dexify-api/2.0 (+https://github.com/k6w/ro-dexify-api; non-commercial)'),

  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  TOTAL_BUDGET_MS: z.coerce.number().int().positive().default(12000),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),

  ENABLE_DLR: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  FORVO_API_KEY: z.string().optional(),
  FORVO_DAILY_QUOTA: z.coerce.number().int().positive().default(500),

  DEX_DUMP_URL: z
    .string()
    .url()
    .default('https://dexonline.ro/static/download/dex-database.sql.gz'),

  REQUIRE_API_KEY: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
});

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${parsed.error.message}`);
  }
  cached = Object.freeze(parsed.data);
  return cached;
}

export function resetConfigForTests(): void {
  cached = undefined;
}
