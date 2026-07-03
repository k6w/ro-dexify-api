import { createHash } from 'node:crypto';
import { getMem, setMem } from '../cache/memory.js';
import { getCachedLookup, getDb, loadEntriesV2, persistEntries } from '../cache/sqlite.js';
import { TTL_SECONDS, expiresAtIso } from '../cache/ttl.js';
import { loadConfig } from '../config.js';
import { getBreaker } from '../http/breaker.js';
import { fetchText } from '../http/client.js';
import { runOnHost } from '../http/ratelimit.js';
import { isAllowed } from '../http/robots.js';
import type { EntryV2 } from '../schema/entry-v2.js';
import { ApiException } from '../schema/errors.js';
import type { LookupOpts, Provider, ProviderMeta } from './types.js';

export abstract class BaseProvider implements Provider {
  abstract readonly meta: ProviderMeta;
  abstract buildUrl(word: string): string;
  abstract parse(body: string, word: string): EntryV2[];

  protected extraHeaders(): Record<string, string> {
    return {};
  }

  /**
   * A second document to fetch for the same word, or undefined for none.
   *
   * DEXonline needs this: the JSON API carries definitions while relations,
   * citations and declension tables live on the rendered page. The second
   * request goes through the same rate limiter and breaker, and both results
   * are stored as one cache entry, so a cache hit still serves everything.
   */
  protected secondaryUrl(_word: string): string | undefined {
    return undefined;
  }

  /** Fold the secondary document into the entries parsed from the primary. */
  protected mergeSecondary(entries: EntryV2[], _body: string, _word: string): EntryV2[] {
    return entries;
  }

  async lookup(word: string, opts: LookupOpts): Promise<EntryV2[]> {
    const config = loadConfig();
    const headword = word;
    const meta = this.meta;
    if (!meta.enabled) {
      throw new ApiException('PROVIDER_DISABLED', `${meta.id} is not enabled`);
    }

    if (!opts.refresh) {
      const mem = getMem(meta.id, headword);
      if (mem) {
        return mem.map((e) => stampSourceForCacheHit(e));
      }
    }

    const db = getDb();
    const cached = !opts.refresh ? getCachedLookup(db, meta.id, headword) : undefined;
    const now = new Date();
    if (cached && new Date(cached.expiresAt) > now) {
      const entries = loadEntriesV2(db, meta.id, headword).map((e) =>
        attachMetaToCachedEntry(e, meta),
      );
      setMem(meta.id, headword, entries, 5 * 60 * 1000);
      return entries;
    }

    const url = this.buildUrl(headword);
    const host = new URL(url).host;
    // robots.txt governs crawling. A provider marked 'official-api' talks to an
    // endpoint its operator documents for programmatic use and polices through
    // User-Agent and rate-limit policy instead; the rate limit below still
    // applies. See ProviderMeta.robotsPolicy.
    if (meta.robotsPolicy !== 'official-api') {
      const allowed = await isAllowed(url, config.USER_AGENT, opts.logger);
      if (!allowed) {
        throw new ApiException('PROVIDER_BLOCKED_BY_ROBOTS', `${meta.id} disallowed by robots.txt`);
      }
    }

    const breaker = getBreaker(meta.id);
    const headers: Record<string, string> = {
      'user-agent': config.USER_AGENT,
      accept: 'text/html, application/json, application/xml;q=0.9, */*;q=0.8',
      'accept-language': 'ro,en;q=0.7',
      ...this.extraHeaders(),
    };
    if (cached?.etag) headers['if-none-match'] = cached.etag;
    if (cached?.lastModified) headers['if-modified-since'] = cached.lastModified;

    const fetched = await runOnHost(host, meta.rateLimit, () =>
      breaker.execute(() =>
        fetchText({
          url,
          headers,
          signal: opts.signal,
          logger: opts.logger,
        }),
      ),
    );

    if (fetched.status === 304 && cached) {
      const ttl = expiresAtIso(meta.ttlSeconds, now);
      db.prepare(
        'UPDATE lookups SET fetched_at = ?, expires_at = ? WHERE provider_id = ? AND headword = ?',
      ).run(now.toISOString(), ttl, meta.id, headword);
      const entries = loadEntriesV2(db, meta.id, headword).map((e) =>
        attachMetaToCachedEntry(e, meta),
      );
      setMem(meta.id, headword, entries, 5 * 60 * 1000);
      return entries;
    }

    if (fetched.status >= 400) {
      throw new ApiException(
        'PROVIDER_UPSTREAM_ERROR',
        `${meta.id} returned HTTP ${fetched.status}`,
        {
          status: fetched.status,
        },
      );
    }

    let parsed = this.parse(fetched.body, headword);

    // A secondary document enriches the primary result. It must never be able
    // to fail the lookup: a redesign or an outage on that URL degrades to the
    // primary entries rather than returning nothing.
    const secondary = this.secondaryUrl(headword);
    if (secondary && parsed.length > 0) {
      try {
        const secondHost = new URL(secondary).host;
        const extra = await runOnHost(secondHost, meta.rateLimit, () =>
          breaker.execute(() =>
            fetchText({
              url: secondary,
              headers,
              signal: opts.signal,
              logger: opts.logger,
            }),
          ),
        );
        if (extra.status < 400) {
          parsed = this.mergeSecondary(parsed, extra.body, headword);
        } else {
          opts.logger.warn(
            { provider: meta.id, url: secondary, status: extra.status },
            'secondary_fetch_failed',
          );
        }
      } catch (err) {
        opts.logger.warn(
          { provider: meta.id, url: secondary, err: String(err) },
          'secondary_fetch_error',
        );
      }
    }

    const fetchedAtIso = now.toISOString();
    const stamped = parsed.map((entry) =>
      stampNewEntry(entry, {
        providerId: meta.id,
        providerName: meta.name,
        url,
        license: meta.license,
        attribution: meta.attribution,
        fetchedAt: fetchedAtIso,
      }),
    );

    persistEntries({
      database: db,
      providerId: meta.id,
      headword,
      url,
      httpStatus: fetched.status,
      etag: fetched.etag,
      lastModified: fetched.lastModified,
      bodySha256: createHash('sha256').update(fetched.body).digest('hex'),
      expiresAt: expiresAtIso(meta.ttlSeconds, now),
      entries: stamped,
    });
    setMem(meta.id, headword, stamped, 5 * 60 * 1000);
    return stamped;
  }
}

export const TTL = TTL_SECONDS;

function stampNewEntry(
  entry: EntryV2,
  source: {
    providerId: ProviderMeta['id'];
    providerName: string;
    url: string;
    license: string;
    attribution: string;
    fetchedAt: string;
  },
): EntryV2 {
  return {
    ...entry,
    source: {
      ...entry.source,
      providerId: source.providerId,
      providerName: source.providerName,
      url: entry.source?.url || source.url,
      license: entry.source?.license || source.license,
      attribution: entry.source?.attribution || source.attribution,
      fetchedAt: source.fetchedAt,
      cacheHit: false,
    },
  };
}

function stampSourceForCacheHit(entry: EntryV2): EntryV2 {
  return { ...entry, source: { ...entry.source, cacheHit: true } };
}

function attachMetaToCachedEntry(entry: EntryV2, meta: ProviderMeta): EntryV2 {
  return {
    ...entry,
    source: {
      ...entry.source,
      providerId: meta.id,
      providerName: meta.name,
      license: meta.license,
      attribution: meta.attribution,
      cacheHit: true,
    },
  };
}
