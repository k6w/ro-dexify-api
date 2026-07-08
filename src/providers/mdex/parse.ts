/**
 * m.dex.ro parser.
 *
 * m.dex.ro is a mobile mirror of DEXonline: same underlying corpus, rendered
 * into far less structured markup. Each definition is a `.mydef` block:
 *
 *   <strong>CÁSĂ</strong> s. v. <i>cameră, coș, încăpere…</i>
 *   (<span style='font-style:italic'>Sursa: Sinonime</span>)
 *   <button class='btn' data-clipboard-text='…'>Copy to clipboard</button>
 *
 * The previous parser flattened the block to text, guessed the part of speech
 * from its first 400 characters, and returned headwords like "CÁSĂ1," -- the
 * homonym digit fused on and the trailing comma kept.
 *
 * Because it duplicates the `dexonline` provider (which now reads structured
 * JSON), this provider is disabled by default and serves as a fallback.
 */
import { parseHTML } from 'linkedom';
import { readGrammar } from '../../extract/abbrev.js';
import { deterministicId } from '../../lib/id.js';
import type { Example, NormalizedEntry, Sense } from '../../schema/entry.js';

export function parseMdex(body: string, word: string): NormalizedEntry[] {
  if (!body.trim()) return [];
  const { document } = parseHTML(body);

  const blocks = Array.from(document.querySelectorAll('.mydef'));
  if (blocks.length === 0) return [];

  const out: NormalizedEntry[] = [];
  let idx = 0;

  for (const block of blocks) {
    // The clipboard button duplicates the whole definition; remove it before
    // reading text or it is counted twice.
    for (const btn of Array.from(block.querySelectorAll('button, script, style'))) {
      btn.remove();
    }

    const sourceName = readSourceName(block);
    // Remove the "(Sursa: X)" note so it cannot leak into the definition text.
    for (const span of Array.from(block.querySelectorAll('span'))) {
      if (/Sursa\s*:/i.test(span.textContent ?? '')) span.parentElement?.removeChild(span);
    }

    const strong = block.querySelector('strong');
    const display = cleanHeadword(strong?.textContent ?? '') || word;
    const text = collapse(block.textContent ?? '');
    if (!text || text.length < 8) continue;

    // Everything after the headword is the definition body.
    const bodyText = text.replace(
      new RegExp(`^${escapeRegex(strong?.textContent?.trim() ?? '')}\\s*`),
      '',
    );

    const grammar = readGrammar(bodyText.slice(0, 60));
    const senses = splitNumberedSenses(bodyText, block);
    if (senses.length === 0) continue;

    const lower = display.normalize('NFC').toLocaleLowerCase('ro-RO');
    const entry: NormalizedEntry = {
      id: deterministicId(['mdex', lower, idx]),
      headword: lower,
      displayHeadword: display,
      partOfSpeech: grammar.partOfSpeech,
      inflections: [],
      pronunciations: [],
      senses,
      source: {
        providerId: 'mdex',
        providerName: 'm.dex.ro',
        ...(sourceName ? { workTitle: sourceName } : {}),
        url: `https://m.dex.ro/?word=${encodeURIComponent(word)}`,
        license: 'GPL-2.0-or-later',
        attribution: `m.dex.ro (mirror of DEXonline)${sourceName ? ` — ${sourceName}` : ''}`,
        fetchedAt: new Date().toISOString(),
        cacheHit: false,
      },
    };
    if (grammar.gender) entry.gender = grammar.gender;
    out.push(entry);
    idx++;
  }
  return out;
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * m.dex.ro renders the headword with its tonic accent and homonym index fused
 * on ("CÁSĂ1,"). Strip both, and the trailing comma.
 */
function cleanHeadword(raw: string): string {
  // Order matters: "CÁSĂ1," needs the comma removed before the digit is at the
  // end, so strip punctuation and digits alternately until neither applies.
  let out = collapse(raw);
  for (;;) {
    const next = out.replace(/[,;:.\s]+$/, '').replace(/\d+$/, '');
    if (next === out) break;
    out = next;
  }
  return out.trim();
}

function readSourceName(block: Element): string | undefined {
  for (const span of Array.from(block.querySelectorAll('span'))) {
    const m = (span.textContent ?? '').match(/Sursa\s*:\s*(.+)/i);
    if (m?.[1]) return m[1].replace(/[)\s]+$/, '').trim();
  }
  return undefined;
}

function splitNumberedSenses(text: string, block: Element): Sense[] {
  const marks: Array<{ n: number; start: number; end: number }> = [];
  for (const m of text.matchAll(/(?:^|[\s(])(\d+)\.\s+/g)) {
    if (m.index === undefined || !m[1]) continue;
    marks.push({ n: Number(m[1]), start: m.index, end: m.index + m[0].length });
  }

  const examples = extractExamples(block);

  if (marks.length < 2) {
    const cleaned = stripGrammarPrefix(text);
    if (!cleaned) return [];
    return [
      {
        number: 1,
        text: cleaned,
        register: readGrammar(cleaned).register,
        examples: examples.slice(0, 3),
        synonyms: [],
        antonyms: [],
      },
    ];
  }

  const out: Sense[] = [];
  for (let i = 0; i < marks.length; i++) {
    const cur = marks[i];
    const next = marks[i + 1];
    if (!cur) continue;
    const slice = collapse(text.slice(cur.end, next?.start ?? text.length));
    if (!slice) continue;
    out.push({
      number: cur.n,
      text: slice,
      register: readGrammar(slice).register,
      examples: i === 0 ? examples.slice(0, 3) : [],
      synonyms: [],
      antonyms: [],
    });
  }
  return out;
}

/** Drop a leading grammatical label so the sense starts at the definition. */
function stripGrammarPrefix(text: string): string {
  return collapse(text.replace(/^(?:[a-zăâîșț]{1,6}\.\s*){1,4}/i, '').replace(/^[,;:.\s]+/, ''));
}

function extractExamples(block: Element): Example[] {
  const out: Example[] = [];
  for (const el of Array.from(block.querySelectorAll('i, em, blockquote'))) {
    const t = collapse(el.textContent ?? '');
    if (t.length > 4 && t.length < 200) out.push({ text: t });
  }
  return out;
}
