import { TTL_SECONDS } from '../../cache/ttl.js';
import { liftEntry } from '../../schema/adapters/lift.js';
import { BaseProvider } from '../base.js';
import type { ProviderMeta } from '../types.js';
import { parseDexonline } from './parse.js';
import { sourceAuthority } from './rank.js';
import { buildDexonlineJsonUrl } from './url.js';

export class DexonlineProvider extends BaseProvider {
  readonly meta: ProviderMeta = {
    id: 'dexonline',
    name: 'DEXonline',
    homepage: 'https://dexonline.ro',
    license: 'GPL-2.0-or-later',
    attribution: 'DEXonline.ro contributors; aggregated from DEX, DOOM, DLR and others.',
    capabilities: new Set([
      'definitions',
      'etymology',
      'examples',
      'inflections',
      'register_notes',
    ]),
    ttlSeconds: TTL_SECONDS.dexonline,
    rateLimit: { minIntervalMs: 2000, concurrency: 1 },
    enabled: true,
  };

  // The JSON endpoint carries DEXonline's structured internalRep markup and is
  // ~35% smaller than the rendered page.
  buildUrl(word: string): string {
    return buildDexonlineJsonUrl(word);
  }

  protected override extraHeaders(): Record<string, string> {
    return { accept: 'application/json' };
  }

  parse(body: string, word: string) {
    // Authority is per contributing dictionary, not per provider: one lookup
    // mixes DEX '09 (95) with Șăineanu 1929 (12).
    return parseDexonline(body, word).map((entry) => {
      const sourceName = entry.source.workTitle ?? '';
      return liftEntry(entry, { authority: sourceAuthority(sourceName), sourceName });
    });
  }
}
