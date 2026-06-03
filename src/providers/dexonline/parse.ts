/**
 * DEXonline parser, reading the JSON API rather than scraping the rendered page.
 *
 * `/definitie/<word>/json` returns `{ type, word, definitions[] }`, and each
 * definition carries DEXonline's own `internalRep` markup, in which sense
 * numbering, grammatical labels and the tonic accent are explicit. The old
 * HTML-scraping parser produced 120 entries for "casă", each with exactly one
 * "sense" holding the entire definition as an undivided blob, and an etymology
 * regex that matched "Din" inside "Dinastie" and returned "astie; neam".
 *
 * A single word draws on up to 32 different dictionaries, so results are ranked
 * by source authority and near-duplicates are collapsed. See ./rank.ts.
 */
import { readGrammar } from '../../extract/abbrev.js';
import {
  readEtymology,
  readHeadword,
  renderInternalRep,
  splitSenses,
} from '../../extract/internal-rep.js';
import { deterministicId } from '../../lib/id.js';
import type { Example, NormalizedEntry, Sense } from '../../schema/entry.js';
import { byAuthority, dropDuplicates, isOrthographicSource, sourceAuthority } from './rank.js';

export interface DexonlineDefinition {
  id?: string;
  internalRep?: string;
  htmlRep?: string;
  sourceName?: string;
  userNick?: string;
}

interface DexonlineJson {
  type?: string;
  word?: string;
  definitions?: DexonlineDefinition[];
}

export interface ParseDexonlineOptions {
  /** Return every definition instead of the ranked, deduplicated subset. */
  all?: boolean;
  /** Restrict to these dictionaries (matched on sourceName, case-insensitive). */
  dictionaries?: readonly string[];
  /** Cap on the number of entries returned when `all` is not set. */
  limit?: number;
  /** Keep entries whose lemma differs from the queried word. */
  includeRelated?: boolean;
  /** Keep DOOM/Ortografic entries, which carry no definitions. */
  includeOrthographic?: boolean;
}

const DEFAULT_LIMIT = 8;

/** Diacritic-insensitive comparison key for lemma matching. */
function foldKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[șş]/gi, 's')
    .replace(/[țţ]/gi, 't')
    .toLowerCase()
    .trim();
}

export function parseDexonline(
  body: string,
  word: string,
  options: ParseDexonlineOptions = {},
): NormalizedEntry[] {
  if (!body.trim()) return [];

  let payload: DexonlineJson;
  try {
    payload = JSON.parse(body) as DexonlineJson;
  } catch {
    return [];
  }
  const definitions = payload.definitions ?? [];
  if (definitions.length === 0) return [];

  const wanted = options.dictionaries?.map((d) => d.toLowerCase());
  const target = foldKey(word);

  let built = definitions
    .filter((d) => !wanted || wanted.includes((d.sourceName ?? '').toLowerCase()))
    .filter((d) => options.includeOrthographic || !isOrthographicSource(d.sourceName ?? ''))
    .map((d, idx) => buildEntry(d, word, idx))
    .filter((e): e is BuiltEntry => e !== undefined);

  // A search for "casă" also returns casă-muzeu, molie-de-casă and gândac, which
  // are different lemmas. Keep them only on request.
  if (!options.includeRelated) {
    const exact = built.filter((b) => foldKey(b.entry.headword) === target);
    if (exact.length > 0) built = exact;
  }

  if (built.length === 0) return [];
  if (options.all) return byAuthority(built).map((b) => b.entry);

  const ranked = dropDuplicates(byAuthority(built));
  const limit = options.limit ?? DEFAULT_LIMIT;
  return ranked.slice(0, limit).map((b) => b.entry);
}

interface BuiltEntry {
  sourceName: string;
  authority: number;
  senseTexts: string[];
  entry: NormalizedEntry;
}

function buildEntry(
  definition: DexonlineDefinition,
  word: string,
  idx: number,
): BuiltEntry | undefined {
  const raw = definition.internalRep;
  if (!raw?.trim()) return undefined;

  const rendered = renderInternalRep(raw);
  if (!rendered.text) return undefined;

  const headword = readHeadword(raw);
  const display = headword?.lemma ?? word;
  const lower = display.normalize('NFC').toLocaleLowerCase('ro-RO');

  const sourceName = definition.sourceName ?? 'DEXonline';
  const authority = sourceAuthority(sourceName);

  // The grammatical preamble is everything before the first sense; reading the
  // whole text would let a "(reg.)" deep in sense 9 set the entry's register.
  const repSenses = splitSenses(rendered);
  const preamble = rendered.text.slice(0, firstSenseOffset(rendered, repSenses));
  const grammar = readGrammar(preamble || rendered.text.slice(0, 120));

  const senses: Sense[] = repSenses.map((s) => {
    const examples: Example[] = s.subItems
      .map((text) => ({ text }))
      .filter((e) => e.text.length > 0);
    return {
      number: s.number,
      text: s.text,
      register: readGrammar(s.text).register,
      examples,
      synonyms: [],
      antonyms: [],
    };
  });

  if (senses.length === 0) return undefined;

  const etymology = readEtymology(rendered);

  const entry: NormalizedEntry = {
    id: deterministicId(['dexonline', lower, definition.id ?? idx]),
    headword: lower,
    displayHeadword: display,
    partOfSpeech: grammar.partOfSpeech,
    inflections: [],
    pronunciations: headword?.stressed ? [{ stressMark: headword.stressed }] : [],
    senses,
    source: {
      providerId: 'dexonline',
      providerName: 'DEXonline',
      workTitle: sourceName,
      url: `https://dexonline.ro/definitie/${encodeURIComponent(word)}`,
      license: 'GPL-2.0-or-later',
      attribution: `DEXonline.ro — ${sourceName}`,
      fetchedAt: new Date().toISOString(),
      cacheHit: false,
    },
  };
  if (grammar.gender) entry.gender = grammar.gender;
  if (etymology) entry.etymology = etymology;

  return { sourceName, authority, senseTexts: senses.map((s) => s.text), entry };
}

/** Offset of the first sense body, used to isolate the grammatical preamble. */
function firstSenseOffset(
  rendered: ReturnType<typeof renderInternalRep>,
  senses: ReturnType<typeof splitSenses>,
): number {
  const first = senses[0];
  if (!first) return rendered.text.length;
  const at = rendered.text.indexOf(first.text);
  return at > 0 ? at : Math.min(120, rendered.text.length);
}
