/**
 * DEXonline declension/conjugation table parser.
 *
 * This is the only source of a *full* nominal paradigm: the JSON API carries
 * none, DOOM publishes only the cells it considers non-obvious, and Wiktionary
 * has eight cells when an editor filled the template in.
 *
 *   <div class="card mb-3 paradigmDiv">
 *     <div class="card-header"> Intrare: <strong>casă (clădire)</strong>
 *     <div class="paraLexeme">
 *       <span class="lexemeName">casă</span>
 *       <span class="tag"><a …>substantiv feminin</a></span>
 *       <table class="lexeme">
 *         <tr><td><div> nominativ-acuzativ singular nearticulat
 *                       (<a href="/model-flexiune/F1">F1</a>) </div></td>
 *             <td class="form"><ul class="commaList"><li>casă</li></ul></td>
 *
 * Entries with no table carry `<div class="noParadigm">` instead and are
 * skipped.
 */
import { parseHTML } from 'linkedom';
import type { InflectionV2, Paradigm } from '../../schema/entry-v2.js';

export interface LexemeParadigm {
  /** The lexeme this table belongs to, e.g. "casă". */
  lexeme: string;
  /** Disambiguating header, e.g. "casă (clădire)". */
  label?: string;
  /** Grammatical tag as DEXonline states it, e.g. "substantiv feminin". */
  posInfo?: string;
  paradigm: Paradigm;
  inflections: InflectionV2[];
}

/** Romanian cell labels -> our inflection tags. */
const LABEL_TAGS: Array<[RegExp, string[]]> = [
  [/nominativ[-\s]*acuzativ/i, ['nominative', 'accusative']],
  [/genitiv[-\s]*dativ/i, ['genitive', 'dative']],
  [/\bvocativ/i, ['vocative']],
  [/\bnominativ/i, ['nominative']],
  [/\bacuzativ/i, ['accusative']],
  [/\bgenitiv/i, ['genitive']],
  [/\bdativ/i, ['dative']],
  [/\binfinitiv/i, ['infinitive']],
  [/\bgerunziu/i, ['gerund']],
  [/\bparticipiu/i, ['participle']],
  [/\bimperativ/i, ['imperative']],
  [/\bconjunctiv/i, ['subjunctive']],
  [/\bindicativ/i, ['indicative']],
  [/\bprezent/i, ['present']],
  [/\bimperfect/i, ['imperfect']],
  [/perfect\s+simplu/i, ['simple-perfect']],
  [/mai\s+mult\s+ca\s+perfect/i, ['pluperfect']],
];

const NUMBER_TAGS: Array<[RegExp, string]> = [
  [/\bsingular\b/i, 'singular'],
  [/\bplural\b/i, 'plural'],
];

const ARTICLE_TAGS: Array<[RegExp, string]> = [
  [/\bnearticulat\b/i, 'unarticulated'],
  [/\barticulat\b/i, 'articulated'],
];

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Turn a cell label into tags.
 *
 * "nearticulat" must be tested before "articulat", since the former contains
 * the latter as a substring.
 */
export function tagsFromCellLabel(label: string): string[] {
  const out: string[] = [];
  for (const [re, tags] of LABEL_TAGS) {
    if (re.test(label)) {
      for (const t of tags) if (!out.includes(t)) out.push(t);
    }
  }
  for (const [re, tag] of NUMBER_TAGS) if (re.test(label)) out.push(tag);
  for (const [re, tag] of ARTICLE_TAGS) {
    if (re.test(label)) {
      out.push(tag);
      break;
    }
  }
  const person = label.match(/\b(persoana|pers\.)\s*(I{1,3}|[123])\b/i)?.[2];
  if (person) {
    const n = { I: '1', II: '2', III: '3' }[person.toUpperCase()] ?? person;
    out.push(`person:${n}`);
  }
  return out;
}

export function parseParadigms(html: string): LexemeParadigm[] {
  if (!html.trim()) return [];
  const { document } = parseHTML(html);

  const out: LexemeParadigm[] = [];
  for (const div of Array.from(document.querySelectorAll('.paradigmDiv'))) {
    if (div.querySelector('.noParadigm')) continue;

    const lexeme = collapse(div.querySelector('.lexemeName')?.textContent ?? '');
    if (!lexeme) continue;

    const label = collapse(div.querySelector('.card-header strong')?.textContent ?? '');
    const posInfo = collapse(div.querySelector('.tag a')?.textContent ?? '');

    const table = div.querySelector('table.lexeme');
    if (!table) continue;

    const modelCode = table.querySelector('a[href*="/model-flexiune/"]')?.textContent?.trim();

    const { cells, inflections } = readMatrix(table);
    if (cells.length === 0) continue;

    // Verb tables are a multi-block grid: several header rows, each governing
    // the block beneath it, with form cells spanning rows. The single-header
    // mapping used here reads nominal tables correctly but mislabels verb
    // cells ("casare" came out as `infinitive` rather than infinitive+long).
    //
    // Rather than publish wrong tags, verb paradigms keep their cells -- the
    // forms themselves are correct and readable -- but contribute no
    // inflections, so nothing downstream treats a mislabelled cell as fact.
    const isNominal = /substantiv|adjectiv|articol|pronume|numeral/i.test(posInfo);
    const usableInflections = isNominal ? inflections : [];

    out.push({
      lexeme,
      paradigm: { cells, ...(modelCode ? { modelCode } : {}) },
      inflections: usableInflections,
      ...(label ? { label } : {}),
      ...(posInfo ? { posInfo } : {}),
    });
  }
  return out;
}

/**
 * Read the declension matrix.
 *
 * The table is a grid, not a list of label/value rows:
 *
 *   <tr><td colspan=2>substantiv feminin (F1)</td>
 *       <td class="inflection">nearticulat</td><td class="inflection">articulat</td>
 *   <tr><td rowspan=2 class="inflection">nominativ-acuzativ</td>
 *       <td class="inflection">singular</td>
 *       <td class="form">casă</td><td class="form">casa</td>
 *   <tr><td class="inflection">plural</td>
 *       <td class="form">case</td><td class="form">casele</td>
 *
 * A cell's tags are its row labels plus the column header above it, so
 * "casele" comes out as plural + articulated. `rowspan` carries a row label
 * down; reading rows independently would lose "nominativ-acuzativ" from every
 * row but the first.
 */
function readMatrix(table: Element): {
  cells: Paradigm['cells'];
  inflections: InflectionV2[];
} {
  const rows = Array.from(table.querySelectorAll('tr'));
  const cells: Paradigm['cells'] = [];
  const inflections: InflectionV2[] = [];
  const seen = new Set<string>();

  let columnHeaders: string[] = [];
  /** Row labels still in force from an earlier `rowspan`, by remaining count. */
  let carried: Array<{ label: string; rowsLeft: number }> = [];

  for (const row of rows) {
    const tds = Array.from(row.querySelectorAll(':scope > td'));
    const formCells = tds.filter((td) => td.classList.contains('form'));

    if (formCells.length === 0) {
      // Header row: its inflection cells name the columns. A header may span
      // several columns ("imperativ pers. a II-a" covers two), so it is
      // repeated to keep the positional mapping to form cells honest.
      const headers: string[] = [];
      for (const td of tds) {
        if (!td.classList.contains('inflection')) continue;
        const text = collapse(td.textContent ?? '');
        if (!text) continue;
        const span = Number(td.getAttribute('colspan') ?? '1');
        for (let i = 0; i < Math.max(1, span); i++) headers.push(text);
      }
      if (headers.length > 0) columnHeaders = headers;
      continue;
    }

    const ownLabels: string[] = [];
    for (const td of tds) {
      if (td.classList.contains('form')) break;
      // Only `.inflection` cells are row labels. The first cell of a verb table
      // holds the model info ("verb (VT201) Surse flexiune: DOR") with a
      // rowspan, and reading it as a label tagged every form with it.
      if (!td.classList.contains('inflection')) continue;
      const label = collapse(td.textContent ?? '');
      if (!label) continue;
      ownLabels.push(label);
      // rowsLeft counts this row too, because every carried entry is
      // decremented at the end of the row it was declared in. Storing span - 1
      // here made a rowspan=2 label expire immediately, so "genitiv-dativ"
      // never reached its plural row.
      const span = Number(td.getAttribute('rowspan') ?? '1');
      if (span > 1) carried.push({ label, rowsLeft: span });
    }

    const carriedLabels = carried.filter((c) => !ownLabels.includes(c.label)).map((c) => c.label);
    const rowLabels = [...carriedLabels, ...ownLabels];

    formCells.forEach((td, i) => {
      const forms = Array.from(td.querySelectorAll('li'))
        .map((li) => collapse(li.textContent ?? ''))
        .filter(Boolean);
      if (forms.length === 0) return;

      const header = columnHeaders[i];
      const label = [...rowLabels, ...(header ? [header] : [])].join(' ');
      const tags = tagsFromCellLabel(label);
      cells.push({ tags: tags.length > 0 ? tags : [label], forms });

      for (const form of forms) {
        const key = `${form}|${tags.join(',')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        inflections.push({ form, tags, origin: 'attested', confidence: 'high' });
      }
    });

    carried = carried
      .map((c) => ({ ...c, rowsLeft: c.rowsLeft - 1 }))
      .filter((c) => c.rowsLeft > 0);
  }

  return { cells, inflections };
}
