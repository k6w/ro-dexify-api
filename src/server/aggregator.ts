import { loadConfig } from '../config.js';
import type { Logger } from '../lib/logger.js';
import { getProvider, listProviders } from '../providers/registry.js';
import type { Provider } from '../providers/types.js';
import type { Capability, NormalizedEntry, ProviderId } from '../schema/entry.js';
import { ApiException, type ErrorCode, type ProviderError } from '../schema/errors.js';

export interface AggregateOpts {
  word: string;
  sources?: ReadonlyArray<ProviderId>;
  refresh?: boolean;
  include?: ReadonlyArray<Capability>;
  logger: Logger;
}

export interface AggregateResult {
  entries: NormalizedEntry[];
  errors: ProviderError[];
  cache: { hits: number; misses: number };
}

export async function aggregate(opts: AggregateOpts): Promise<AggregateResult> {
  const cfg = loadConfig();
  const all = listProviders();
  const selected = filterProviders(all, opts.sources, opts.include);

  const totalAbort = new AbortController();
  const totalTimer = setTimeout(() => totalAbort.abort(), cfg.TOTAL_BUDGET_MS);

  const settled = await Promise.allSettled(
    selected.map((p) => callOne(p, opts, totalAbort.signal, cfg.REQUEST_TIMEOUT_MS)),
  );
  clearTimeout(totalTimer);

  const entries: NormalizedEntry[] = [];
  const errors: ProviderError[] = [];
  let hits = 0;
  let misses = 0;
  selected.forEach((provider, i) => {
    const r = settled[i];
    if (!r) return;
    if (r.status === 'fulfilled') {
      for (const e of r.value) {
        entries.push(e);
        if (e.source.cacheHit) hits++;
        else misses++;
      }
    } else {
      const reason = r.reason;
      const err: ProviderError =
        reason instanceof ApiException
          ? { providerId: provider.meta.id, code: reason.code, message: reason.message }
          : {
              providerId: provider.meta.id,
              code: classifyError(reason),
              message: reason instanceof Error ? reason.message : String(reason),
            };
      errors.push(err);
    }
  });
  return { entries, errors, cache: { hits, misses } };
}

export async function aggregateOne(
  providerId: ProviderId,
  opts: AggregateOpts,
): Promise<AggregateResult> {
  const provider = getProvider(providerId);
  if (!provider) {
    return {
      entries: [],
      errors: [{ providerId, code: 'WORD_NOT_FOUND', message: `unknown provider ${providerId}` }],
      cache: { hits: 0, misses: 0 },
    };
  }
  return aggregate({ ...opts, sources: [providerId] });
}

async function callOne(
  provider: Provider,
  opts: AggregateOpts,
  parentSignal: AbortSignal,
  perProviderTimeoutMs: number,
): Promise<NormalizedEntry[]> {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  parentSignal.addEventListener('abort', onAbort, { once: true });
  const t = setTimeout(() => ac.abort(), perProviderTimeoutMs);
  try {
    const lookupOpts = {
      signal: ac.signal,
      ...(opts.refresh !== undefined ? { refresh: opts.refresh } : {}),
      ...(opts.include ? { include: opts.include } : {}),
      logger: opts.logger,
    };
    return await provider.lookup(opts.word, lookupOpts);
  } finally {
    clearTimeout(t);
    parentSignal.removeEventListener('abort', onAbort);
  }
}

function filterProviders(
  all: Provider[],
  sources: ReadonlyArray<ProviderId> | undefined,
  include: ReadonlyArray<Capability> | undefined,
): Provider[] {
  let out = all.filter((p) => p.meta.enabled);
  if (sources && sources.length > 0) {
    const set = new Set<string>(sources);
    out = out.filter((p) => set.has(p.meta.id));
  }
  if (include && include.length > 0) {
    out = out.filter((p) => include.some((c) => p.meta.capabilities.has(c)));
  }
  return out;
}

function classifyError(reason: unknown): ErrorCode {
  if (reason instanceof Error) {
    const m = reason.message.toLowerCase();
    if (m.includes('aborted') || m.includes('timeout')) return 'PROVIDER_TIMEOUT';
    if (m.includes('robots')) return 'PROVIDER_BLOCKED_BY_ROBOTS';
  }
  return 'PROVIDER_UPSTREAM_ERROR';
}
