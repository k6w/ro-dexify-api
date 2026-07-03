/**
 * DEXonline meaning-tree parser.
 *
 * The JSON API carries definitions but no relations, no citations and no
 * per-sense provenance. The rendered page carries all three in a clean nested
 * structure:
 *
 *   <ul class="meaningTree">
 *     <li class="type-meaning depth-0">
 *       <div class="meaningContainer">
 *         <div class="meaning-row">
 *           <span class="bc">1.</span>
 *           <span class="tree-def html">Clădire care servește drept locuință.</span>
 *           <span class="meaning-sources tag-group">
 *             <span class="badge badge-source" title="Dicționarul explicativ…">DEX '09</span>
 *         <div class="meaning-relations">
 *           <span class="tag-group"><span class="text-muted">diminutive:</span>
 *             <span class="badge-relation"><a href="/intrare/căscioară/8928">căscioară</a>
 *       <ul class="meaningTree">          <- children, same shape
 *         <li class="type-example depth-1">
 *           <span class="tree-def html"><i>Casa e așezată…</i> STANCU, D. 19. </span>
 *
 * Children are nested `<ul>`s, so the tree is walked structurally; the
 * `depth-N` class is redundant and not relied on.
 */
import { parseHTML } from 'linkedom';
import { emptyRelations, senseNode } from '../../schema/entry-v2.js';
import type { SenseNode, SenseNodeType, SenseRelations } from '../../schema/entry-v2.js';

/** `li.type-<name>` -> node type. */
const NODE_TYPES: Record<string, SenseNodeType> = {
  meaning: 'meaning',
  example: 'example',
  expression: 'expression',
  etymology: 'etymology',
};

/** The Romanian labels DEXonline puts before a relation list. */
const RELATION_LABELS: Record<string, keyof SenseRelations> = {
  sinonime: 'synonyms',
  antonime: 'antonyms',
  diminutive: 'diminutives',
  augmentative: 'augmentatives',
  hiperonime: 'hypernyms',
};

export interface MeaningTree {
  nodes: SenseNode[];
  /** "substantiv feminin" from `.tree-pos-info`, when present. */
  posInfo?: string;
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function nodeTypeOf(li: Element): SenseNodeType | undefined {
  for (const cls of Array.from(li.classList)) {
    if (!cls.startsWith('type-')) continue;
    const type = NODE_TYPES[cls.slice('type-'.length)];
    if (type) return type;
  }
  return undefined;
}

/**
 * Split an example's text into quote and citation.
 *
 * `.tree-def` for an example holds `<i>Casa e așezată în dreptul ariei.</i>
 * STANCU, D. 19.` -- the italic run is the quotation and whatever trails it is
 * the bibliographic reference.
 */
function splitExample(def: Element): { text: string; citation?: string } {
  const italic = def.querySelector('i, em');
  const full = collapse(def.textContent ?? '');
  if (!italic) return { text: full };

  const quote = collapse(italic.textContent ?? '');
  if (!quote) return { text: full };

  const rest = collapse(full.slice(full.indexOf(quote) + quote.length));
  return rest ? { text: quote, citation: rest } : { text: quote };
}

function readRelations(container: Element | null): SenseRelations {
  const relations = emptyRelations();
  if (!container) return relations;

  for (const group of Array.from(container.querySelectorAll('.tag-group'))) {
    const label = collapse(group.querySelector('.text-muted')?.textContent ?? '')
      .replace(/:$/, '')
      .toLocaleLowerCase('ro-RO');
    const key = RELATION_LABELS[label];
    if (!key) continue;
    for (const link of Array.from(group.querySelectorAll('.badge-relation a'))) {
      const word = collapse(link.textContent ?? '');
      if (word && !relations[key].includes(word)) relations[key].push(word);
    }
  }
  return relations;
}

function readSources(row: Element | null): string[] {
  if (!row) return [];
  const out: string[] = [];
  for (const badge of Array.from(row.querySelectorAll('.badge-source'))) {
    const name = collapse(badge.textContent ?? '');
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

function readNumber(row: Element | null): number | undefined {
  const raw = collapse(row?.querySelector('.bc')?.textContent ?? '');
  const m = raw.match(/^(\d+)/);
  return m?.[1] ? Number(m[1]) : undefined;
}

/** Build a SenseNode from one `<li>`, recursing into its nested `<ul>`. */
function buildNode(li: Element): SenseNode | undefined {
  const type = nodeTypeOf(li);
  if (!type) return undefined;

  // Only this node's own row -- a descendant's row must not be read as ours.
  const container = li.querySelector(':scope > .meaningContainer');
  const row = container?.querySelector(':scope > .meaning-row') ?? null;
  const def = row?.querySelector('.tree-def') ?? null;
  if (!def) return undefined;

  const { text, citation } =
    type === 'example' ? splitExample(def) : { text: collapse(def.textContent ?? '') };
  if (!text) return undefined;

  const children: SenseNode[] = [];
  for (const nested of Array.from(li.querySelectorAll(':scope > ul.meaningTree > li'))) {
    const child = buildNode(nested);
    if (child) children.push(child);
  }

  const number = readNumber(row);
  return senseNode(text, {
    type,
    sources: readSources(row),
    relations: readRelations(container?.querySelector(':scope > .meaning-relations') ?? null),
    children,
    ...(number !== undefined ? { number } : {}),
    ...(citation !== undefined ? { citation } : {}),
  });
}

/**
 * Parse every meaning tree on a DEXonline page.
 *
 * A page carries one tree per lexeme (casă¹, casă², casă-muzeu…), so the caller
 * matches them to entries rather than assuming a single tree.
 */
export function parseMeaningTrees(html: string): MeaningTree[] {
  if (!html.trim()) return [];
  const { document } = parseHTML(html);

  const out: MeaningTree[] = [];
  // Top-level trees only: nested ones are reached through buildNode.
  for (const ul of Array.from(document.querySelectorAll('ul.meaningTree'))) {
    if (ul.closest('li')) continue;

    const nodes: SenseNode[] = [];
    for (const li of Array.from(ul.querySelectorAll(':scope > li'))) {
      const node = buildNode(li);
      if (node) nodes.push(node);
    }
    if (nodes.length === 0) continue;

    // The grammatical header sits above the tree body, in the same card.
    const posInfo = collapse(
      ul.closest('.tree-body')?.parentElement?.querySelector('.tree-pos-info')?.textContent ?? '',
    );

    out.push(posInfo ? { nodes, posInfo } : { nodes });
  }
  return out;
}

/** Every relation on a tree, flattened -- used to enrich a matching entry. */
export function collectRelations(nodes: readonly SenseNode[]): SenseRelations {
  const out = emptyRelations();
  const walk = (list: readonly SenseNode[]): void => {
    for (const node of list) {
      for (const key of Object.keys(out) as Array<keyof SenseRelations>) {
        for (const word of node.relations[key]) {
          if (!out[key].includes(word)) out[key].push(word);
        }
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
