import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { liftEntry } from '../../src/schema/adapters/lift.js';
import { EntryV2 } from '../../src/schema/entry-v2.js';

/**
 * The seeder writes entries and senses in two passes, so the v2 payload can
 * only be built once both are known. Without it, loadEntriesV2 falls back to
 * rebuilding every seeded word from the relational tables on each read.
 */
describe('seeded payload_json', () => {
  it('round-trips through the column as a valid v2 entry', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE entries (id TEXT PRIMARY KEY, payload_json TEXT)');

    const payload = liftEntry(
      {
        id: 'seed-1',
        headword: 'casă',
        displayHeadword: 'casă',
        partOfSpeech: 'substantiv',
        inflections: [],
        pronunciations: [],
        senses: [
          {
            number: 1,
            text: "[DEX '09] Clădire care servește drept locuință.",
            register: [],
            examples: [],
            synonyms: [],
            antonyms: [],
          },
        ],
        source: {
          providerId: 'dexonline',
          providerName: 'DEXonline',
          url: 'https://dexonline.ro/definitie/cas%C4%83',
          license: 'GPL-2.0-or-later',
          attribution: 'DEXonline.ro (GPL dump)',
          fetchedAt: new Date().toISOString(),
          cacheHit: false,
        },
      },
      { authority: 80, sourceName: 'DEX dump' },
    );

    db.prepare('INSERT INTO entries (id, payload_json) VALUES (?, ?)').run(
      'seed-1',
      JSON.stringify(payload),
    );
    const row = db.prepare('SELECT payload_json as p FROM entries WHERE id = ?').get('seed-1') as {
      p: string;
    };
    const parsed = EntryV2.parse(JSON.parse(row.p));

    expect(parsed.headword).toBe('casă');
    expect(parsed.senses).toHaveLength(1);
    expect(parsed.source.sourceName).toBe('DEX dump');
    expect(parsed.source.authority).toBe(80);
    db.close();
  });
});
