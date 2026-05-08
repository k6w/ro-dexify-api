import { parseHTML } from 'linkedom';
import type { Example, NormalizedEntry, PartOfSpeech, Sense } from '../../schema/entry.js';
import { deterministicId } from '../../lib/id.js';
import { htmlToPlainText } from '../../http/sanitize.js';

const POS_HINTS: Array<[RegExp, PartOfSpeech]> = [
  [/\bs\.\s*[fmn]\.|\bsubstantiv\b/i, 'substantiv'],
  [/\bvb\.|\bverb\b/i, 'verb'],
  [/\badj\.|\badjectiv\b/i, 'adjectiv'],
  [/\badv\.|\badverb\b/i, 'adverb'],
  [/\bpron\.|\bpronume\b/i, 'pronume'],
  [/\bnum\.|\bnumeral\b/i, 'numeral'],
  [/\bprep\./i, 'prepoziție'],
  [/\bconj\./i, 'conjuncție'],
  [/\binterj\./i, 'interjecție'],
];

export function parseMdex(body: string, word: string): NormalizedEntry[] {
  if (!body) return [];
  const { document } = parseHTML(body);
  const defs = Array.from(document.querySelectorAll('.mydef, div.def, article.def'));
  if (defs.length === 0) {
    const fallback = document.querySelector('main, body');
    if (fallback) defs.push(fallback);
  }
  const out: NormalizedEntry[] = [];
  let idx = 0;
  for (const node of defs) {
    const text = htmlToPlainText(node.textContent ?? '');
    if (!text || text.length < 12) continue;
    const display = pickHeadword(node) ?? word;
    const lower = display.toLocaleLowerCase('ro-RO');
    const pos = inferPos(text);
    const senses = splitNumberedSenses(text);
    if (senses.length === 0) {
      senses.push({
        number: 1,
        text,
        register: [],
        examples: extractExamples(node).slice(0, 3),
        synonyms: [],
        antonyms: [],
      });
    } else {
      const exs = extractExamples(node);
      if (exs.length > 0 && senses[0]) {
        const first = senses[0];
        senses[0] = { ...first, examples: [...first.examples, ...exs].slice(0, 3) };
      }
    }
    const id = deterministicId(['mdex', lower, idx]);
    const fetchedAt = new Date().toISOString();
    out.push({
      id,
      headword: lower,
      displayHeadword: display,
      partOfSpeech: pos,
      inflections: [],
      pronunciations: [],
      senses,
      source: {
        providerId: 'mdex',
        providerName: 'm.dex.ro',
        url: `https://m.dex.ro/?word=${encodeURIComponent(word)}`,
        license: 'GPL-2.0-or-later',
        attribution: 'm.dex.ro (mirror of DEXonline)',
        fetchedAt,
        cacheHit: false,
      },
    });
    idx++;
  }
  return out;
}

function pickHeadword(node: Element): string | undefined {
  const c = node.querySelector('h1, h2, .cuvant, strong');
  if (!c) return undefined;
  const t = (c.textContent ?? '').trim();
  return t.split(/\s/)[0] || undefined;
}

function inferPos(text: string): PartOfSpeech {
  const sample = text.slice(0, 400);
  for (const [re, pos] of POS_HINTS) if (re.test(sample)) return pos;
  return 'unknown';
}

function splitNumberedSenses(text: string): Sense[] {
  const out: Sense[] = [];
  const re = /(?:^|\s)(\d+)\.\s+/g;
  const marks: { n: number; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    marks.push({ n: Number(m[1]), start: m.index + (m[0].startsWith(' ') ? 1 : 0) });
  }
  if (marks.length < 2) return out;
  for (let i = 0; i < marks.length; i++) {
    const cur = marks[i];
    const nxt = marks[i + 1];
    if (!cur) continue;
    const slice = text.slice(cur.start, nxt?.start ?? text.length).replace(/^\s*\d+\.\s*/, '').trim();
    if (slice) {
      out.push({ number: cur.n, text: slice, register: [], examples: [], synonyms: [], antonyms: [] });
    }
  }
  return out;
}

function extractExamples(node: Element): Example[] {
  const out: Example[] = [];
  for (const ex of Array.from(node.querySelectorAll('em, i, blockquote'))) {
    const t = htmlToPlainText(ex.textContent ?? '');
    if (t && t.length > 4 && t.length < 200) out.push({ text: t });
  }
  return out;
}
