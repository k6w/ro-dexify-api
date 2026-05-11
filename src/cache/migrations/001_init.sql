-- Initial schema for ro-dexify-api.
--
-- Every table here is one that src/ already issues SQL against; this file was
-- missing entirely, so applyMigrations() threw ENOENT on readdirSync and no
-- table was ever created.

-- ---------------------------------------------------------------------------
-- HTTP lookup cache (one row per provider+headword; drives TTL and ETag replay)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lookups (
  provider_id   TEXT    NOT NULL,
  headword      TEXT    NOT NULL,
  url           TEXT    NOT NULL,
  http_status   INTEGER NOT NULL,
  etag          TEXT,
  last_modified TEXT,
  body_sha256   TEXT    NOT NULL,
  fetched_at    TEXT    NOT NULL,
  expires_at    TEXT    NOT NULL,
  PRIMARY KEY (provider_id, headword)
);

CREATE INDEX IF NOT EXISTS idx_lookups_expires ON lookups (expires_at);

-- ---------------------------------------------------------------------------
-- Normalized entries and their children
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entries (
  id               TEXT PRIMARY KEY,
  provider_id      TEXT    NOT NULL,
  headword         TEXT    NOT NULL,
  display_headword TEXT    NOT NULL,
  pos              TEXT,
  gender           TEXT,
  source_url       TEXT    NOT NULL,
  fetched_at       TEXT    NOT NULL,
  ord              INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entries_lookup ON entries (provider_id, headword, ord);
CREATE INDEX IF NOT EXISTS idx_entries_headword ON entries (headword);

CREATE TABLE IF NOT EXISTS senses (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT    NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  number   INTEGER,
  text     TEXT    NOT NULL,
  register TEXT    NOT NULL DEFAULT '[]',
  domain   TEXT,
  ord      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_senses_entry ON senses (entry_id, ord);

CREATE TABLE IF NOT EXISTS examples (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  sense_id INTEGER NOT NULL REFERENCES senses (id) ON DELETE CASCADE,
  text     TEXT    NOT NULL,
  citation TEXT
);

CREATE INDEX IF NOT EXISTS idx_examples_sense ON examples (sense_id);

CREATE TABLE IF NOT EXISTS sense_synonyms (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  sense_id INTEGER NOT NULL REFERENCES senses (id) ON DELETE CASCADE,
  word     TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sense_synonyms_sense ON sense_synonyms (sense_id);

CREATE TABLE IF NOT EXISTS sense_antonyms (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  sense_id INTEGER NOT NULL REFERENCES senses (id) ON DELETE CASCADE,
  word     TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sense_antonyms_sense ON sense_antonyms (sense_id);

CREATE TABLE IF NOT EXISTS inflections (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  form     TEXT NOT NULL,
  tags     TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_inflections_entry ON inflections (entry_id);
CREATE INDEX IF NOT EXISTS idx_inflections_form ON inflections (form);

CREATE TABLE IF NOT EXISTS pronunciations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id           TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  ipa                TEXT,
  syllabification    TEXT,
  stress_mark        TEXT,
  audio_url          TEXT,
  audio_mime         TEXT,
  audio_attribution  TEXT
);

CREATE INDEX IF NOT EXISTS idx_pronunciations_entry ON pronunciations (entry_id);

CREATE TABLE IF NOT EXISTS etymologies (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id  TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  text      TEXT NOT NULL,
  languages TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_etymologies_entry ON etymologies (entry_id);

CREATE TABLE IF NOT EXISTS conjugations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id    TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  class_roman TEXT,
  forms       TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_conjugations_entry ON conjugations (entry_id);

-- ---------------------------------------------------------------------------
-- Verb forms seeded from the DEX dump (conjugare provider reads these).
-- UNIQUE covers `form` too: one (lemma, form_key) legitimately has several
-- variant forms, so keying on (lemma, form_key) alone would silently collapse
-- them under INSERT OR REPLACE.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verb_forms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lemma       TEXT NOT NULL,
  form_key    TEXT NOT NULL,
  form        TEXT NOT NULL,
  class_roman TEXT,
  UNIQUE (lemma, form_key, form)
);

CREATE INDEX IF NOT EXISTS idx_verb_forms_lemma ON verb_forms (lemma);

-- ---------------------------------------------------------------------------
-- Per-provider daily quota (Forvo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_quota (
  provider_id TEXT    NOT NULL,
  ymd         TEXT    NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider_id, ymd)
);

-- ---------------------------------------------------------------------------
-- Full-text search.
--
-- `remove_diacritics 2` is what makes a query for "casa" match "casă" and
-- "stiinta" match "știință" -- it folds precomposed Romanian characters
-- (ă â î ș ț) that `remove_diacritics 1` leaves alone. Callers must apply the
-- same folding to the query side.
--
-- provider_id/entry_id are UNINDEXED: they are carried for retrieval only and
-- must not dilute bm25() scoring.
-- ---------------------------------------------------------------------------
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5 (
  headword,
  sense_text,
  provider_id UNINDEXED,
  entry_id    UNINDEXED,
  tokenize = "unicode61 remove_diacritics 2"
);
