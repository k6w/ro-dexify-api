import { parseHTML } from 'linkedom';
import { htmlToPlainText } from '../../http/sanitize.js';
import { deterministicId } from '../../lib/id.js';
import type { NormalizedEntry, Sense } from '../../schema/entry.js';

export function parseDlr(body: string, word: string): NormalizedEntry[] {
  if (!body) return [];
  const { document } = parseHTML(body);
  const entries = Array.from(
    document.querySelectorAll('div.entry, div#articol, article, .articol, .entry'),
  );
  if (entries.length === 0) return [];
  const out: NormalizedEntry[] = [];
  let idx = 0;
  for (const node of entries) {
    const text = htmlToPlainText(node.textContent ?? '');
    if (!text || text.length < 20) continue;
    const display = pickHeadword(node) ?? word;
    const lower = display.toLocaleLowerCase('ro-RO');
    const senses = extractSenses(node, text);
    if (senses.length === 0) continue;
    out.push({
      id: deterministicId(['dlr', lower, idx++]),
      headword: lower,
      displayHeadword: display,
      partOfSpeech: 'unknown',
      inflections: [],
      pronunciations: [],
      senses,
      source: {
        providerId: 'dlr',
        providerName: 'DLR / TEZAUR',
        url: `https://dlr1.solirom.ro/index.php?cuv=${encodeURIComponent(word)}`,
        license: 'academic',
        attribution: 'Dicționarul Limbii Române (Academia Română); via dlr1.solirom.ro',
        fetchedAt: new Date().toISOString(),
        cacheHit: false,
      },
    });
  }
  return out;
}

function pickHeadword(node: Element): string | undefined {
  const c = node.querySelector('h1, h2, h3.lemma, .lemma, .titlu');
  if (!c) return undefined;
  const t = (c.textContent ?? '').trim();
  return t.split(/\s/)[0] || undefined;
}

function extractSenses(node: Element, fallback: string): Sense[] {
  const out: Sense[] = [];
  const paragraphs = Array.from(node.querySelectorAll('p.def, p.sens, .definition'));
  let counter = 1;
  for (const p of paragraphs) {
    const t = htmlToPlainText(p.textContent ?? '');
    if (t)
      out.push({
        number: counter++,
        text: t,
        register: [],
        examples: [],
        synonyms: [],
        antonyms: [],
      });
  }
  if (out.length === 0) {
    const cleaned = fallback.replace(/\s+/g, ' ').trim();
    if (cleaned) {
      out.push({
        number: 1,
        text: cleaned,
        register: [],
        examples: [],
        synonyms: [],
        antonyms: [],
      });
    }
  }
  return out;
}
