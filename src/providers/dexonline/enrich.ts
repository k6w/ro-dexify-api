/**
 * Fold the rendered DEXonline page into the entries parsed from the JSON API.
 *
 * The JSON is the authority on sense text (it is the stored representation);
 * the page adds what JSON omits: typed relations, examples with bibliographic
 * citations, per-sense dictionary attribution, and the full declension table.
 */
import type { EntryV2, SenseNode } from '../../schema/entry-v2.js';
import { parseParadigms } from './paradigm.js';
import { collectRelations, parseMeaningTrees } from './tree.js';

function foldKey(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Attach a tree's example/expression children to a matching JSON sense. */
function enrichSense(sense: SenseNode, treeNodes: readonly SenseNode[]): SenseNode {
  const match =
    treeNodes.find((n) => n.number === sense.number) ??
    treeNodes.find((n) => foldKey(n.text) === foldKey(sense.text));
  if (!match) return sense;

  // Children the JSON already produced (◊ locutions, ♦ sub-senses) are kept;
  // the tree contributes examples, which internalRep does not carry at all.
  const existing = new Set(sense.children.map((c) => foldKey(c.text)));
  const added = match.children.filter(
    (c) => c.type === 'example' && !existing.has(foldKey(c.text)),
  );

  return {
    ...sense,
    sources: sense.sources.length > 0 ? sense.sources : match.sources,
    relations: match.relations,
    children: [...sense.children, ...added],
  };
}

export function enrichWithPage(entries: EntryV2[], html: string): EntryV2[] {
  const trees = parseMeaningTrees(html);
  const paradigms = parseParadigms(html);
  if (trees.length === 0 && paradigms.length === 0) return entries;

  return entries.map((entry) => {
    const key = foldKey(entry.headword);

    // Pick the tree whose grammar agrees with the entry, falling back to the
    // first: a page carries one tree per lexeme (casă¹, casă², casă-muzeu…).
    const tree =
      trees.find(
        (t) =>
          t.posInfo !== undefined &&
          entry.gender !== undefined &&
          t.posInfo.includes(entry.partOfSpeech) &&
          t.posInfo.includes(entry.gender),
      ) ?? trees.find((t) => t.posInfo?.includes(entry.partOfSpeech));

    const senses = tree ? entry.senses.map((s) => enrichSense(s, tree.nodes)) : entry.senses;

    const paradigm = paradigms.find(
      (p) =>
        foldKey(p.lexeme) === key &&
        (p.posInfo === undefined || p.posInfo.includes(entry.partOfSpeech)),
    );

    const next: EntryV2 = { ...entry, senses };
    if (tree) {
      const all = collectRelations(tree.nodes);
      // Surface tree-wide synonyms on sense 1 when no sense claimed any, so a
      // caller reading only the first sense still sees them.
      const first = next.senses[0];
      if (first && first.relations.synonyms.length === 0 && all.synonyms.length > 0) {
        next.senses = [
          { ...first, relations: { ...first.relations, synonyms: all.synonyms } },
          ...next.senses.slice(1),
        ];
      }
    }
    if (paradigm) {
      next.paradigm = paradigm.paradigm;
      if (paradigm.inflections.length > 0) next.inflections = paradigm.inflections;
    }
    return next;
  });
}
