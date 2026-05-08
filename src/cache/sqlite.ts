import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { NormalizedEntry } from '../schema/entry.js';
import { newUlid } from '../lib/id.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(here, 'migrations');

let db: DatabaseType | undefined;
let dbPath: string | undefined;

export function openDatabase(path: string): DatabaseType {
  if (db && dbPath === path) return db;
  if (db) {
    db.close();
    db = undefined;
  }
  const dir = dirname(resolve(path));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const next = new Database(path);
  next.pragma('journal_mode = WAL');
  next.pragma('synchronous = NORMAL');
  next.pragma('foreign_keys = ON');
  next.pragma('temp_store = MEMORY');
  next.pragma('mmap_size = 268435456');
  applyMigrations(next);
  db = next;
  dbPath = path;
  return next;
}

export function getDb(): DatabaseType {
  if (!db) throw new Error('database not initialized; call openDatabase() first');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = undefined;
    dbPath = undefined;
  }
}

function applyMigrations(database: DatabaseType): void {
  database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    (database.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map(
      (r) => r.name,
    ),
  );
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const tx = database.transaction(() => {
      database.exec(sql);
      database
        .prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
        .run(file, new Date().toISOString());
    });
    tx();
  }
}

export interface PersistOpts {
  database: DatabaseType;
  providerId: string;
  headword: string;
  url: string;
  httpStatus: number;
  etag?: string | undefined;
  lastModified?: string | undefined;
  bodySha256: string;
  expiresAt: string;
  entries: NormalizedEntry[];
}

export function persistEntries(opts: PersistOpts): void {
  const { database, providerId, headword, entries } = opts;
  const now = new Date().toISOString();
  const tx = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO lookups (provider_id, headword, url, http_status, etag, last_modified, body_sha256, fetched_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider_id, headword) DO UPDATE SET
           url=excluded.url, http_status=excluded.http_status, etag=excluded.etag,
           last_modified=excluded.last_modified, body_sha256=excluded.body_sha256,
           fetched_at=excluded.fetched_at, expires_at=excluded.expires_at`,
      )
      .run(
        providerId,
        headword,
        opts.url,
        opts.httpStatus,
        opts.etag ?? null,
        opts.lastModified ?? null,
        opts.bodySha256,
        now,
        opts.expiresAt,
      );

    const oldIds = database
      .prepare('SELECT id FROM entries WHERE provider_id = ? AND headword = ?')
      .all(providerId, headword) as { id: string }[];
    if (oldIds.length > 0) {
      const del = database.prepare('DELETE FROM entries WHERE id = ?');
      for (const r of oldIds) del.run(r.id);
    }

    const insertEntry = database.prepare(
      `INSERT INTO entries (id, provider_id, headword, display_headword, pos, gender, source_url, fetched_at, ord)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertSense = database.prepare(
      `INSERT INTO senses (entry_id, number, text, register, domain, ord) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertExample = database.prepare(
      `INSERT INTO examples (sense_id, text, citation) VALUES (?, ?, ?)`,
    );
    const insertSyn = database.prepare(`INSERT INTO sense_synonyms (sense_id, word) VALUES (?, ?)`);
    const insertAnt = database.prepare(`INSERT INTO sense_antonyms (sense_id, word) VALUES (?, ?)`);
    const insertInfl = database.prepare(
      `INSERT INTO inflections (entry_id, form, tags) VALUES (?, ?, ?)`,
    );
    const insertPron = database.prepare(
      `INSERT INTO pronunciations (entry_id, ipa, syllabification, stress_mark, audio_url, audio_mime, audio_attribution)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertEtym = database.prepare(
      `INSERT INTO etymologies (entry_id, text, languages) VALUES (?, ?, ?)`,
    );
    const insertConj = database.prepare(
      `INSERT INTO conjugations (entry_id, class_roman, forms) VALUES (?, ?, ?)`,
    );
    const insertFts = database.prepare(
      `INSERT INTO entries_fts (headword, sense_text, provider_id, entry_id) VALUES (?, ?, ?, ?)`,
    );

    let ord = 0;
    for (const entry of entries) {
      const id = entry.id || newUlid();
      insertEntry.run(
        id,
        providerId,
        headword,
        entry.displayHeadword,
        entry.partOfSpeech,
        entry.gender ?? null,
        entry.source.url,
        entry.source.fetchedAt,
        ord++,
      );
      let sord = 0;
      const senseTexts: string[] = [];
      for (const sense of entry.senses) {
        const senseRow = insertSense.run(
          id,
          sense.number ?? null,
          sense.text,
          JSON.stringify(sense.register ?? []),
          sense.domain ?? null,
          sord++,
        );
        const senseId = Number(senseRow.lastInsertRowid);
        senseTexts.push(sense.text);
        for (const ex of sense.examples) {
          insertExample.run(senseId, ex.text, ex.citation ?? null);
        }
        for (const s of sense.synonyms) insertSyn.run(senseId, s);
        for (const a of sense.antonyms) insertAnt.run(senseId, a);
      }
      for (const inf of entry.inflections) {
        insertInfl.run(id, inf.form, JSON.stringify(inf.tags ?? []));
      }
      for (const p of entry.pronunciations) {
        insertPron.run(
          id,
          p.ipa ?? null,
          p.syllabification ?? null,
          p.stressMark ?? null,
          p.audioUrl ?? null,
          p.audioMime ?? null,
          p.audioAttribution ?? null,
        );
      }
      if (entry.etymology) {
        insertEtym.run(id, entry.etymology.text, JSON.stringify(entry.etymology.languages ?? []));
      }
      if (entry.conjugation) {
        insertConj.run(
          id,
          entry.conjugation.classRoman ?? null,
          JSON.stringify(entry.conjugation.forms ?? {}),
        );
      }
      insertFts.run(entry.displayHeadword, senseTexts.join(' '), providerId, id);
    }
  });
  tx();
}

export interface CachedLookup {
  url: string;
  httpStatus: number;
  etag?: string;
  lastModified?: string;
  bodySha256: string;
  fetchedAt: string;
  expiresAt: string;
}

export function getCachedLookup(
  database: DatabaseType,
  providerId: string,
  headword: string,
): CachedLookup | undefined {
  const row = database
    .prepare(
      `SELECT url, http_status as httpStatus, etag, last_modified as lastModified,
              body_sha256 as bodySha256, fetched_at as fetchedAt, expires_at as expiresAt
       FROM lookups WHERE provider_id = ? AND headword = ?`,
    )
    .get(providerId, headword) as CachedLookup | undefined;
  return row;
}

export function loadEntries(
  database: DatabaseType,
  providerId: string,
  headword: string,
): NormalizedEntry[] {
  const rows = database
    .prepare(
      `SELECT id, display_headword as displayHeadword, pos, gender, source_url as sourceUrl,
              fetched_at as fetchedAt
       FROM entries WHERE provider_id = ? AND headword = ? ORDER BY ord`,
    )
    .all(providerId, headword) as Array<{
    id: string;
    displayHeadword: string;
    pos: string | null;
    gender: string | null;
    sourceUrl: string;
    fetchedAt: string;
  }>;
  if (rows.length === 0) return [];

  const senseRows = database
    .prepare(
      `SELECT id, entry_id as entryId, number, text, register, domain, ord
       FROM senses WHERE entry_id IN (${rows.map(() => '?').join(',')}) ORDER BY entry_id, ord`,
    )
    .all(...rows.map((r) => r.id)) as Array<{
    id: number;
    entryId: string;
    number: number | null;
    text: string;
    register: string;
    domain: string | null;
    ord: number;
  }>;
  const senseIds = senseRows.map((s) => s.id);
  const exampleRows =
    senseIds.length > 0
      ? (database
          .prepare(
            `SELECT sense_id as senseId, text, citation FROM examples WHERE sense_id IN (${senseIds
              .map(() => '?')
              .join(',')})`,
          )
          .all(...senseIds) as Array<{ senseId: number; text: string; citation: string | null }>)
      : [];
  const synRows =
    senseIds.length > 0
      ? (database
          .prepare(
            `SELECT sense_id as senseId, word FROM sense_synonyms WHERE sense_id IN (${senseIds
              .map(() => '?')
              .join(',')})`,
          )
          .all(...senseIds) as Array<{ senseId: number; word: string }>)
      : [];
  const antRows =
    senseIds.length > 0
      ? (database
          .prepare(
            `SELECT sense_id as senseId, word FROM sense_antonyms WHERE sense_id IN (${senseIds
              .map(() => '?')
              .join(',')})`,
          )
          .all(...senseIds) as Array<{ senseId: number; word: string }>)
      : [];
  const inflRows = database
    .prepare(
      `SELECT entry_id as entryId, form, tags FROM inflections WHERE entry_id IN (${rows
        .map(() => '?')
        .join(',')})`,
    )
    .all(...rows.map((r) => r.id)) as Array<{ entryId: string; form: string; tags: string }>;
  const pronRows = database
    .prepare(
      `SELECT entry_id as entryId, ipa, syllabification, stress_mark as stressMark,
              audio_url as audioUrl, audio_mime as audioMime, audio_attribution as audioAttribution
       FROM pronunciations WHERE entry_id IN (${rows.map(() => '?').join(',')})`,
    )
    .all(...rows.map((r) => r.id)) as Array<{
    entryId: string;
    ipa: string | null;
    syllabification: string | null;
    stressMark: string | null;
    audioUrl: string | null;
    audioMime: string | null;
    audioAttribution: string | null;
  }>;
  const etymRows = database
    .prepare(
      `SELECT entry_id as entryId, text, languages FROM etymologies WHERE entry_id IN (${rows
        .map(() => '?')
        .join(',')})`,
    )
    .all(...rows.map((r) => r.id)) as Array<{ entryId: string; text: string; languages: string }>;
  const conjRows = database
    .prepare(
      `SELECT entry_id as entryId, class_roman as classRoman, forms FROM conjugations
       WHERE entry_id IN (${rows.map(() => '?').join(',')})`,
    )
    .all(...rows.map((r) => r.id)) as Array<{
    entryId: string;
    classRoman: string | null;
    forms: string;
  }>;

  const lookup = getCachedLookup(database, providerId, headword);
  return rows.map((row) => {
    const senses = senseRows
      .filter((s) => s.entryId === row.id)
      .map((s) => ({
        ...(s.number !== null ? { number: s.number } : {}),
        text: s.text,
        register: parseJsonArray(s.register),
        ...(s.domain ? { domain: s.domain } : {}),
        examples: exampleRows
          .filter((e) => e.senseId === s.id)
          .map((e) => ({ text: e.text, ...(e.citation ? { citation: e.citation } : {}) })),
        synonyms: synRows.filter((x) => x.senseId === s.id).map((x) => x.word),
        antonyms: antRows.filter((x) => x.senseId === s.id).map((x) => x.word),
      }));
    const inflections = inflRows
      .filter((i) => i.entryId === row.id)
      .map((i) => ({ form: i.form, tags: parseJsonArray(i.tags) }));
    const pronunciations = pronRows
      .filter((p) => p.entryId === row.id)
      .map((p) => ({
        ...(p.ipa ? { ipa: p.ipa } : {}),
        ...(p.syllabification ? { syllabification: p.syllabification } : {}),
        ...(p.stressMark ? { stressMark: p.stressMark } : {}),
        ...(p.audioUrl ? { audioUrl: p.audioUrl } : {}),
        ...(p.audioMime ? { audioMime: p.audioMime } : {}),
        ...(p.audioAttribution ? { audioAttribution: p.audioAttribution } : {}),
      }));
    const etymRow = etymRows.find((e) => e.entryId === row.id);
    const conjRow = conjRows.find((c) => c.entryId === row.id);
    return {
      id: row.id,
      headword,
      displayHeadword: row.displayHeadword,
      partOfSpeech: (row.pos ?? 'unknown') as NormalizedEntry['partOfSpeech'],
      ...(row.gender ? { gender: row.gender as NormalizedEntry['gender'] } : {}),
      inflections,
      pronunciations,
      senses,
      ...(etymRow
        ? {
            etymology: {
              text: etymRow.text,
              languages: parseJsonArray(etymRow.languages),
            },
          }
        : {}),
      ...(conjRow
        ? {
            conjugation: {
              ...(conjRow.classRoman ? { classRoman: conjRow.classRoman } : {}),
              forms: parseJsonRecord(conjRow.forms),
            },
          }
        : {}),
      source: {
        providerId,
        providerName: providerId,
        url: row.sourceUrl,
        license: '',
        attribution: '',
        fetchedAt: lookup?.fetchedAt ?? row.fetchedAt,
        cacheHit: true,
      },
    } as NormalizedEntry;
  });
}

function parseJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(s: string): Record<string, string> {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object') {
      const out: Record<string, string> = {};
      for (const k of Object.keys(v)) out[k] = String((v as Record<string, unknown>)[k]);
      return out;
    }
  } catch {}
  return {};
}

export function sweepExpired(database: DatabaseType): number {
  const now = new Date().toISOString();
  const r = database.prepare('DELETE FROM lookups WHERE expires_at < ?').run(now);
  return Number(r.changes);
}
