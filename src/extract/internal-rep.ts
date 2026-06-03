/**
 * Parser for DEXonline's `internalRep` markup.
 *
 * DEXonline stores every definition in its own lightweight markup and serves it
 * verbatim from /definitie/<word>/json. It is a far better source than the
 * rendered page: sense numbering, grammatical labels and the tonic accent are
 * all explicit rather than inferred.
 *
 *   @C&#039;ASĂ^1,@ $case,$ #s. f.# @1.@ Clădire care servește drept locuință.
 *   * #Loc. adj.# $De casă$ = făcut în casă^1. ** (#Reg.#) Cameră, odaie.
 *   @2.@ Încăpere specială … - #Lat.# @casa.@
 *
 * Grammar (sigil counts measured across the 120 definitions of "casă"):
 *
 *   @…@   bold      headword, and sense numbers "@1.@"          (990)
 *   $…$   italic    inflection list, expressions, collocations (1264)
 *   #…#   abbrev    grammar "#s. f.#", register "#Reg.#"       (1567)
 *   %…%   spaced                                                 (42)
 *   {…}   nested emphasis                                         (18)
 *   '     tonic accent, immediately before the stressed vowel
 *   ^n    superscript homonym index
 *   *     sub-marker (rendered ◊): locution or expression
 *   **    sub-sense marker (rendered ♦)
 */

export type SpanKind = 'bold' | 'italic' | 'abbrev' | 'spaced';

export interface MarkupSpan {
  kind: SpanKind;
  text: string;
  /** Offsets into the rendered plain text. */
  start: number;
  end: number;
}

export interface RenderedRep {
  text: string;
  spans: MarkupSpan[];
}

const SIGILS: Record<string, SpanKind> = {
  '@': 'bold',
  $: 'italic',
  '#': 'abbrev',
  '%': 'spaced',
};

/** Decode the numeric and named entities DEXonline stores in internalRep. */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#0*39;/g, "'")
    .replace(/&#0*34;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

/**
 * Render internalRep to plain text, recording where each marked-up span landed.
 *
 * Sigils nest only shallowly in practice (`@$casse$@`), so an open span of the
 * same kind is closed rather than nested.
 */
export function renderInternalRep(raw: string): RenderedRep {
  const input = decodeEntities(raw);
  const spans: MarkupSpan[] = [];
  const open = new Map<SpanKind, number>();
  let text = '';

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (!ch) continue;

    // "^{3}" and "^1" are homonym indices; keep the digits out of the text so
    // "casă^1" does not become the headword "casă1".
    if (ch === '^') {
      const braced = input.slice(i).match(/^\^\{(\d+)\}/);
      if (braced) {
        i += braced[0].length - 1;
        continue;
      }
      const plain = input.slice(i).match(/^\^(\d+)/);
      if (plain) {
        i += plain[0].length - 1;
        continue;
      }
      continue;
    }

    const kind = SIGILS[ch];
    if (kind) {
      const started = open.get(kind);
      if (started === undefined) {
        open.set(kind, text.length);
      } else {
        open.delete(kind);
        const value = text.slice(started).trim();
        if (value) spans.push({ kind, text: value, start: started, end: text.length });
      }
      continue;
    }

    // Braces are emphasis wrappers with no separate meaning for us.
    if (ch === '{' || ch === '}') continue;

    text += ch;
  }

  return { text: text.replace(/[ \t]+/g, ' ').trim(), spans };
}

export interface Headword {
  /** Lemma with the accent marker removed. */
  lemma: string;
  /** Lemma with an acute accent on the stressed vowel, when marked. */
  stressed?: string;
  homonymIndex?: number;
}

/**
 * Read the headword out of a raw internalRep string.
 *
 * The tonic accent is an apostrophe immediately before the stressed vowel
 * (`C'ASĂ` -> stress on the first A), which is also why a naive apostrophe
 * strip loses the only stress information DEXonline carries.
 */
export function readHeadword(raw: string): Headword | undefined {
  const decoded = decodeEntities(raw);
  const boldMatch = decoded.match(/@([^@]+)@/);
  if (!boldMatch?.[1]) return undefined;

  let block = boldMatch[1];
  const homonym = block.match(/\^\{?(\d+)\}?/)?.[1];
  block = block
    .replace(/\^\{?\d+\}?/g, '')
    .replace(/[$#%{}]/g, '')
    // NODEX appends the plural hint to the headword block ("CASĂ ~e"); "~"
    // stands in for the lemma and is not part of it.
    .replace(/\s*~\S*/g, '')
    .replace(/[,;:]\s*$/, '')
    .trim();
  if (!block) return undefined;

  const accentAt = block.indexOf("'");
  const lemma = block.replace(/'/g, '');
  const out: Headword = { lemma };

  if (accentAt >= 0 && accentAt < lemma.length) {
    const vowel = lemma[accentAt];
    if (vowel) {
      out.stressed = `${lemma.slice(0, accentAt)}${vowel}́${lemma.slice(accentAt + 1)}`.normalize(
        'NFC',
      );
    }
  }
  if (homonym) out.homonymIndex = Number(homonym);
  return out;
}

export interface RepSense {
  number: number;
  text: string;
  /** "◊" locutions and "♦" sub-senses attached to this sense. */
  subItems: string[];
}

/**
 * Split the rendered definition into numbered senses.
 *
 * Sense numbers are bold spans of the form "1." (DEX, DLRLC) or bare "1)"
 * markers (NODEX). Text before the first number is the grammatical preamble and
 * is not a sense.
 */
export function splitSenses(rendered: RenderedRep): RepSense[] {
  const marks: Array<{ number: number; start: number; end: number }> = [];

  for (const span of rendered.spans) {
    if (span.kind !== 'bold') continue;
    const m = span.text.match(/^(\d+)[.)]$/);
    if (m?.[1]) marks.push({ number: Number(m[1]), start: span.start, end: span.end });
  }

  if (marks.length === 0) {
    for (const m of rendered.text.matchAll(/(?:^|\s)(\d+)\)\s/g)) {
      if (m.index === undefined || !m[1]) continue;
      marks.push({ number: Number(m[1]), start: m.index, end: m.index + m[0].length });
    }
  }

  // Many definitions (MDA2, DCR2, Argou, most single-sense entries) carry no
  // numbering at all. Returning [] there dropped the definition entirely.
  if (marks.length === 0) {
    const body = unnumberedBody(rendered);
    return body ? [{ number: 1, text: stripTrailingEtymology(body), subItems: [] }] : [];
  }

  const out: RepSense[] = [];
  for (let i = 0; i < marks.length; i++) {
    const cur = marks[i];
    const next = marks[i + 1];
    if (!cur) continue;
    const body = rendered.text.slice(cur.end, next?.start ?? rendered.text.length).trim();
    if (!body) continue;

    // "*" and "**" introduce locutions/expressions and sub-senses; keep them
    // out of the sense text but retain them.
    const parts = body.split(/\s*\*{1,2}\s*/);
    const head = (parts[0] ?? '').trim();
    const subItems = parts
      .slice(1)
      .map((p) => p.trim())
      .filter(Boolean);

    out.push({
      number: cur.number,
      text: stripTrailingEtymology(head),
      subItems,
    });
  }
  return out;
}

/**
 * The definition body of an unnumbered entry: everything after the headword and
 * the bracketed grammatical block MDA2-style sources put in front of it, e.g.
 * "[#At:# LTR / #Pl:# $~se$ / #E:# #fr# @$casse$@]".
 */
function unnumberedBody(rendered: RenderedRep): string {
  let text = rendered.text;

  const firstBold = rendered.spans.find((s) => s.kind === 'bold');
  if (firstBold && firstBold.start === 0) text = text.slice(firstBold.end);

  // Drop a leading bracketed metadata block.
  text = text.replace(/^[^[]{0,40}\[[^\]]*\]\s*/, '').trim();
  // Drop any leading grammatical abbreviations left over ("sf", "s. f.").
  text = text.replace(/^(?:[a-zăâîșț]{1,5}\.?\s+){0,3}(?=[A-ZĂÂÎȘȚ])/, '').trim();

  return text.replace(/^[,;:.\s]+/, '').trim();
}

/** DEX appends "- Lat. casa." to the final sense; that is not part of it. */
function stripTrailingEtymology(text: string): string {
  return text.replace(/\s+-\s+[^-]*$/, (match) => (ETY_TAIL.test(match) ? '' : match)).trim();
}

const ETY_TAIL = /\s+-\s+(lat|fr|it|germ|engl|gr|sl|tc|magh|rus|bg|srb|ucr|ngr|vsl)\b/i;

/**
 * Extract the etymology note.
 *
 * DEXonline writes it three ways depending on the source dictionary:
 *   DEX    "- #Lat.# @casa.@"
 *   NODEX  "/<lat. $casa$"
 *   MDA2   "[… / #E:# #fr# @$casse$@]"
 *
 * The previous regex was `/(?:Etim\.?|Etymol\.?|Din)\s*[:\-]?\s*([^.]+)/` with
 * no word boundary, so "Din" matched inside "Dinastie" and the etymology came
 * back as "astie; neam".
 */
export function readEtymology(
  rendered: RenderedRep,
): { text: string; languages: string[] } | undefined {
  const text = rendered.text;

  const patterns = [
    /(?:^|\s)-\s*((?:lat|fr|it|germ|engl|gr|sl|tc|magh|rus|bg|srb|ucr|ngr|vsl)\.?\s+[^.]{1,120}\.?)\s*$/i,
    // NODEX: "/<lat. casa" -- the language code's own dot must not end it.
    /\/\s*<\s*((?:[a-zăâîșț]+\.?\s*)+)/i,
    /\bE:\s*([^\]/]{1,120})/i,
    /\bDin\s+((?:lat|fr|it|germ|engl|gr|sl|tc|magh|rus)[^.]{0,120})\./i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    const captured = m?.[1]?.trim();
    if (!captured) continue;
    const cleaned = captured.replace(/\s+/g, ' ').replace(/[,;]\s*$/, '');
    if (cleaned.length < 2) continue;
    return { text: cleaned, languages: languageCodes(cleaned) };
  }
  return undefined;
}

const LANGUAGE_CODES: Array<[RegExp, string]> = [
  [/\blat\b/i, 'lat.'],
  [/\bfr\b/i, 'fr.'],
  [/\bit\b/i, 'it.'],
  [/\bgerm\b/i, 'germ.'],
  [/\bengl\b/i, 'engl.'],
  [/\bgr\b/i, 'gr.'],
  [/\bsl\b/i, 'sl.'],
  [/\btc\b/i, 'tc.'],
  [/\bmagh\b/i, 'magh.'],
  [/\brus\b/i, 'rus.'],
  [/\bbg\b/i, 'bg.'],
];

function languageCodes(text: string): string[] {
  const out: string[] = [];
  for (const [re, code] of LANGUAGE_CODES) {
    if (re.test(text) && !out.includes(code)) out.push(code);
  }
  return out;
}
