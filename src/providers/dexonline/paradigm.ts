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
  [/infinitiv\s+lung/i, ['infinitive', 'long']],
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
  const person =
    label.match(/\b(?:persoana|pers\.)\s*(?:a\s*)?(I{1,3}|[123])/i)?.[1] ??
    // The "persoana" column of a verb table holds the numeral on its own,
    // written "I (eu)", "a II-a (tu)", "a III-a (el, ea)".
    label.match(/(?:^|\s)a?\s*(I{1,3})(?:-a)?\s*\(/)?.[1] ??
    label.match(/(?:^|\s)([123])(?:\s|$)/)?.[1];
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

    out.push({
      lexeme,
      paradigm: { cells, ...(modelCode ? { modelCode } : {}) },
      inflections,
      ...(label ? { label } : {}),
      ...(posInfo ? { posInfo } : {}),
    });
  }
  return out;
}

/**
 * Read the paradigm table.
 *
 * It is a real HTML grid with rowspan and colspan, so it is materialised into
 * an occupancy matrix first. Reading rows positionally is what mislabelled verb
 * forms: a verb table is several stacked blocks, each with its own header row,
 * and cells span both directions.
 *
 *   ROW 0  [model, colspan2 rowspan3] [infinitiv] [infinitiv lung] [participiu]
 *                                     [gerunziu] [imperativ pers. a II-a, colspan2]
 *   ROW 1  [(a) casa, rowspan2] [casare, rowspan2] [casat, rowspan2]
 *          [casând, rowspan2] [singular] [plural]        <- sub-headers, on the right
 *   ROW 2  [casează] [casați]                            <- fills the spanned columns
 *   ROW 3  [spacer, colspan8]
 *   ROW 4  [numărul] [persoana] [prezent] [conjunctiv prezent] ...   <- a new block
 *
 * Once the grid exists the labelling rule is simple:
 *   - a row with no form cells is a header row; its cells set the label of every
 *     column they cover, replacing whatever the previous block put there
 *   - in a row that does have form cells, `.inflection` cells to the LEFT of the
 *     first form are row labels, and those to the right are column sub-headers
 *   - a form cell's tags are its column label plus its row labels
 *
 * Row labels carried by rowspan need no special handling: a spanned cell is
 * recorded in every position it covers.
 */

interface GridCell {
  text: string;
  isForm: boolean;
  isInflection: boolean;
  forms: string[];
  /** True only at the cell's own origin, so spanned copies are not re-read. */
  origin: boolean;
}

function buildGrid(table: Element): GridCell[][] {
  const grid: GridCell[][] = [];
  const rows = Array.from(table.querySelectorAll('tr'));

  rows.forEach((row, r) => {
    grid[r] ??= [];
    let col = 0;
    for (const td of Array.from(row.querySelectorAll(':scope > td'))) {
      // Skip past columns already claimed by a rowspan from an earlier row.
      while (grid[r]?.[col] !== undefined) col++;

      const isForm = td.classList.contains('form');
      const cell: GridCell = {
        text: collapse(td.textContent ?? ''),
        isForm,
        isInflection: td.classList.contains('inflection'),
        forms: isForm
          ? Array.from(td.querySelectorAll('li'))
              .map((li) => collapse(li.textContent ?? ''))
              .filter(Boolean)
          : [],
        origin: true,
      };

      const colspan = Math.max(1, Number(td.getAttribute('colspan') ?? '1'));
      const rowspan = Math.max(1, Number(td.getAttribute('rowspan') ?? '1'));
      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          const rr = r + dr;
          grid[rr] ??= [];
          const target = grid[rr];
          if (target) target[col + dc] = dr === 0 && dc === 0 ? cell : { ...cell, origin: false };
        }
      }
      col += colspan;
    }
  });

  return grid;
}

function readMatrix(table: Element): {
  cells: Paradigm['cells'];
  inflections: InflectionV2[];
} {
  const grid = buildGrid(table);
  const columnLabel: string[] = [];
  // Sub-headers sit to the right of the forms in a mixed row and qualify the
  // spanning header above them ("imperativ pers. a II-a" + "singular").
  // Overwriting columnLabel lost the tense and left only "singular".
  let columnSub: string[] = [];
  const cells: Paradigm['cells'] = [];
  const inflections: InflectionV2[] = [];
  const seen = new Set<string>();

  for (const row of grid) {
    if (!row) continue;
    const formCols = row.map((c, i) => (c?.isForm ? i : -1)).filter((i) => i >= 0);

    if (formCols.length === 0) {
      // Header row: (re)label the columns it covers. This is what starts a new
      // block in a verb table.
      row.forEach((cell, i) => {
        if (cell?.isInflection && cell.text) columnLabel[i] = cell.text;
      });
      columnSub = [];
      continue;
    }

    const firstForm = formCols[0] ?? 0;
    const rowLabels: string[] = [];
    row.forEach((cell, i) => {
      if (!cell?.isInflection || !cell.text) return;
      if (i < firstForm) {
        if (!rowLabels.includes(cell.text)) rowLabels.push(cell.text);
      } else if (!row[i]?.isForm) {
        // To the right of the forms: a sub-header qualifying that column.
        columnSub[i] = cell.text;
      }
    });

    for (const i of formCols) {
      const cell = row[i];
      if (!cell?.origin || cell.forms.length === 0) continue;
      const label = [columnLabel[i], columnSub[i], ...rowLabels].filter(Boolean).join(' ');
      const tags = tagsFromCellLabel(label);
      cells.push({ tags: tags.length > 0 ? tags : [label || cell.text], forms: cell.forms });

      for (const form of cell.forms) {
        const key = `${form}|${tags.join(',')}`;
        if (seen.has(key) || tags.length === 0) continue;
        seen.add(key);
        inflections.push({ form, tags, origin: 'attested', confidence: 'high' });
      }
    }
  }

  return { cells, inflections };
}
