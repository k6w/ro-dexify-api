import type { Readable } from 'node:stream';
import type Database from 'better-sqlite3';
import { ulid } from 'ulid';
import { normalizeHeadword } from '../lib/headword.js';
import type { Logger } from '../lib/logger.js';
import { liftEntry } from '../schema/adapters/lift.js';
import type { NormalizedEntry } from '../schema/entry.js';
import { TOP_RO_WORDS } from './frequency-list.js';
import { MysqlInsertStream, readGzippedSqlDump } from './mysql-stream.js';
import { dexInternalRepToText } from './normalize.js';
import { TABLE_COLUMNS } from './schema-map.js';

export interface ImportOptions {
  dumpPath: string;
  database: Database.Database;
  mode: 'lite' | 'full';
  logger?: Logger;
}

export interface ImportSummary {
  lexemes: number;
  definitions: number;
  inflectedForms: number;
  entries: number;
  durationMs: number;
}

export async function importDexDump(opts: ImportOptions): Promise<ImportSummary> {
  const start = Date.now();
  const allowFilter =
    opts.mode === 'lite' ? new Set<string>(TOP_RO_WORDS.map(normalizeHeadword)) : undefined;

  const entriesByHead = new Map<number, { headword: string; pos?: string }>();
  const lexemes = new Map<number, { headword: string }>();
  const sources = new Map<number, string>();
  const definitions = new Map<number, { sourceId?: number; text: string }>();
  const entryDefLinks: Array<{ entryId: number; defId: number }> = [];
  const inflectedForms: Array<{ lexemId: number; form: string; inflectionId: number }> = [];

  const stream = readGzippedSqlDump(opts.dumpPath);
  const inserter = new MysqlInsertStream();
  const pipeline = stream.pipe(inserter as unknown as NodeJS.WritableStream) as unknown as Readable;
  for await (const obj of pipeline) {
    const { table, values } = obj as { table: string; values: (string | number | null)[] };
    const cols = inserter.getColumns(table) ?? TABLE_COLUMNS[table] ?? [];
    const row = rowFromValues(cols, values);
    if (table === 'Entry') {
      const id = numOrUndef(row.id);
      const head = strOrUndef(row.description);
      if (typeof id === 'number' && head) {
        const norm = normalizeHeadword(head.split(/\s/)[0] ?? head);
        if (!allowFilter || allowFilter.has(norm)) {
          const e: { headword: string; pos?: string } = { headword: head };
          const pos = strOrUndef(row.partOfSpeech);
          if (pos !== undefined) e.pos = pos;
          entriesByHead.set(id, e);
        }
      }
    } else if (table === 'Lexem' || table === 'Lexeme') {
      const id = numOrUndef(row.id);
      const head = strOrUndef(row.formUtf8General ?? row.formNoAccent ?? row.description);
      if (typeof id === 'number' && head) lexemes.set(id, { headword: head });
    } else if (table === 'Definition') {
      const id = numOrUndef(row.id);
      if (typeof id !== 'number') continue;
      const text = dexInternalRepToText(strOrUndef(row.internalRep) ?? '');
      if (!text) continue;
      const def: { sourceId?: number; text: string } = { text };
      const sid = numOrUndef(row.sourceId);
      if (sid !== undefined) def.sourceId = sid;
      definitions.set(id, def);
    } else if (table === 'Source') {
      const id = numOrUndef(row.id);
      const name = strOrUndef(row.shortName ?? row.name);
      if (typeof id === 'number' && name) sources.set(id, name);
    } else if (table === 'InflectedForm' && opts.mode === 'full') {
      const lexemId = numOrUndef(row.lexemeId);
      const form = strOrUndef(row.form);
      const inflectionId = numOrUndef(row.inflectionId);
      if (typeof lexemId === 'number' && form && typeof inflectionId === 'number') {
        inflectedForms.push({ lexemId, form, inflectionId });
      }
    } else if (table === 'EntryDefinition') {
      const entryId = numOrUndef(row.entryId);
      const defId = numOrUndef(row.definitionId);
      if (typeof entryId === 'number' && typeof defId === 'number') {
        entryDefLinks.push({ entryId, defId });
      }
    }
  }

  const summary = persist(
    opts.database,
    entriesByHead,
    definitions,
    entryDefLinks,
    sources,
    inflectedForms,
    lexemes,
  );
  opts.logger?.info(summary, 'import_complete');
  return { ...summary, durationMs: Date.now() - start };
}

function rowFromValues(
  cols: string[],
  values: (string | number | null)[],
): Record<string, string | number | null | undefined> {
  const row: Record<string, string | number | null | undefined> = {};
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (col) row[col] = values[i] ?? undefined;
  }
  return row;
}

function strOrUndef(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return String(v);
}

function numOrUndef(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function persist(
  db: Database.Database,
  entriesByHead: Map<number, { headword: string; pos?: string }>,
  definitions: Map<number, { sourceId?: number; text: string }>,
  links: Array<{ entryId: number; defId: number }>,
  sources: Map<number, string>,
  inflectedForms: Array<{ lexemId: number; form: string; inflectionId: number }>,
  lexemes: Map<number, { headword: string }>,
): Omit<ImportSummary, 'durationMs'> {
  const insertEntry = db.prepare(
    `INSERT INTO entries (id, provider_id, headword, display_headword, pos, gender, source_url, fetched_at, ord)
     VALUES (?, 'dexonline', ?, ?, ?, NULL, ?, ?, 0)`,
  );
  const insertSense = db.prepare(
    `INSERT INTO senses (entry_id, number, text, register, domain, ord) VALUES (?, ?, ?, '[]', NULL, ?)`,
  );
  const insertLookup = db.prepare(
    `INSERT INTO lookups (provider_id, headword, url, http_status, etag, last_modified, body_sha256, fetched_at, expires_at)
     VALUES ('dexonline', ?, ?, 200, NULL, NULL, '', ?, '9999-12-31T23:59:59.000Z')
     ON CONFLICT(provider_id, headword) DO UPDATE SET fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at`,
  );
  const insertFts = db.prepare(
    `INSERT INTO entries_fts (headword, sense_text, provider_id, entry_id) VALUES (?, ?, 'dexonline', ?)`,
  );
  // Written in a second pass: senses are inserted after entries, so the full
  // entry is not known at insert time. Without it, loadEntriesV2 rebuilds every
  // seeded word from the relational tables on each read.
  const setPayload = db.prepare(`UPDATE entries SET payload_json = ? WHERE id = ?`);
  const insertVerb = db.prepare(
    `INSERT OR REPLACE INTO verb_forms (lemma, form_key, form, class_roman) VALUES (?, ?, ?, ?)`,
  );
  const fetchedAt = new Date().toISOString();

  const tx = db.transaction(() => {
    let entries = 0;
    const entryRowId = new Map<number, string>();
    for (const [id, e] of entriesByHead) {
      const display = e.headword;
      const headword = normalizeHeadword(display.split(/\s/)[0] ?? display);
      const url = `https://dexonline.ro/definitie/${encodeURIComponent(display)}`;
      insertLookup.run(headword, url, fetchedAt);
      const rowId = ulid();
      insertEntry.run(rowId, headword, display, e.pos ?? null, url, fetchedAt);
      entryRowId.set(id, rowId);
      entries++;
    }

    const ordPerEntry = new Map<string, number>();
    const sensesByRow = new Map<string, Array<{ number: number; text: string }>>();
    let senseCount = 0;
    for (const link of links) {
      const rowId = entryRowId.get(link.entryId);
      if (!rowId) continue;
      const def = definitions.get(link.defId);
      if (!def) continue;
      const sourceName = def.sourceId ? sources.get(def.sourceId) : undefined;
      const senseText = sourceName ? `[${sourceName}] ${def.text}` : def.text;
      const ord = (ordPerEntry.get(rowId) ?? 0) + 1;
      ordPerEntry.set(rowId, ord);
      insertSense.run(rowId, ord, senseText, ord - 1);
      const bucket = sensesByRow.get(rowId);
      if (bucket) bucket.push({ number: ord, text: senseText });
      else sensesByRow.set(rowId, [{ number: ord, text: senseText }]);
      const e = entriesByHead.get(link.entryId);
      if (e) insertFts.run(e.headword, senseText, rowId);
      senseCount++;
    }

    // Store the v2 payload now that each entry's senses are known.
    for (const [id, e] of entriesByHead) {
      const rowId = entryRowId.get(id);
      if (!rowId) continue;
      const display = e.headword;
      const headword = normalizeHeadword(display.split(/\s/)[0] ?? display);
      const payload = liftEntry(
        {
          id: rowId,
          headword,
          displayHeadword: display,
          partOfSpeech: (e.pos ?? 'unknown') as NormalizedEntry['partOfSpeech'],
          inflections: [],
          pronunciations: [],
          senses: (sensesByRow.get(rowId) ?? []).map((x) => ({
            number: x.number,
            text: x.text,
            register: [],
            examples: [],
            synonyms: [],
            antonyms: [],
          })),
          source: {
            providerId: 'dexonline',
            providerName: 'DEXonline',
            url: `https://dexonline.ro/definitie/${encodeURIComponent(display)}`,
            license: 'GPL-2.0-or-later',
            attribution: 'DEXonline.ro (GPL dump)',
            fetchedAt,
            cacheHit: false,
          },
        },
        { authority: 80, sourceName: 'DEX dump' },
      );
      setPayload.run(JSON.stringify(payload), rowId);
    }

    let infl = 0;
    if (inflectedForms.length > 0) {
      const seededLemmas = new Set<string>();
      for (const e of entriesByHead.values()) {
        seededLemmas.add(normalizeHeadword(e.headword.split(/\s/)[0] ?? e.headword));
      }
      for (const i of inflectedForms) {
        const lex = lexemes.get(i.lexemId);
        if (!lex) continue;
        const lemma = normalizeHeadword(lex.headword);
        if (!seededLemmas.has(lemma)) continue;
        insertVerb.run(lemma, `inflection.${i.inflectionId}`, i.form, null);
        infl++;
      }
    }
    return { entries, senses: senseCount, inflections: infl };
  });
  const r = tx();

  db.exec('VACUUM');
  return {
    lexemes: entriesByHead.size,
    definitions: r.senses,
    inflectedForms: r.inflections,
    entries: r.entries,
  };
}
