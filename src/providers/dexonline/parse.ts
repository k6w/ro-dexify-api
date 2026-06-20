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
import { senseNode } from '../../schema/entry-v2.js';
import type { SenseNode } from '../../schema/entry-v2.js';
import type { EntryV2 } from '../../schema/entry-v2.js';
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
): EntryV2[] {
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
  //
  // Prefer an exact match before falling back to diacritic-insensitive folding:
  // "casă" (house) and "casa" (to quash) are distinct lemmas that fold together,
  // so folding alone returned the verb under the noun's query. Folding still
  // applies when the query itself is unaccented, which is the case it exists for.
  if (!options.includeRelated) {
    const exactWord = word.normalize('NFC').toLocaleLowerCase('ro-RO');
    const exact = built.filter((b) => b.entry.headword === exactWord);
    if (exact.length > 0) {
      built = exact;
    } else {
      const folded = built.filter((b) => foldKey(b.entry.headword) === target);
      if (folded.length > 0) built = folded;
    }
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
  entry: EntryV2;
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

  // "◊" items are locutions/expressions and "♦" items are sub-senses; keeping
  // them as typed children means /v1 can still flatten them into examples while
  // /v2 preserves what they actually are.
  const senses: SenseNode[] = repSenses.map((s) =>
    senseNode(s.text, {
      number: s.number,
      register: readGrammar(s.text).register,
      sources: [sourceName],
      children: s.subItems.map((item) =>
        senseNode(item.text, {
          type:
            item.marker === '**'
              ? 'sub-meaning'
              : /\bexpr\b/i.test(item.text)
                ? 'expression'
                : 'locution',
          register: readGrammar(item.text).register,
          sources: [sourceName],
        }),
      ),
    }),
  );

  if (senses.length === 0) return undefined;

  const etymology = readEtymology(rendered);

  const entry: EntryV2 = {
    id: deterministicId(['dexonline', lower, definition.id ?? idx]),
    headword: lower,
    displayHeadword: display,
    partOfSpeech: grammar.partOfSpeech,
    inflections: [],
    pronunciations: headword?.stressed ? [{ stressMark: headword.stressed }] : [],
    senses,
    derived: [],
    compounds: [],
    ...(headword?.homonymIndex !== undefined ? { homonymIndex: headword.homonymIndex } : {}),
    source: {
      providerId: 'dexonline',
      providerName: 'DEXonline',
      sourceName,
      workTitle: sourceName,
      authority,
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
