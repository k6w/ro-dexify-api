import { describe, expect, it } from 'vitest';
import { parseParadigms } from '../../src/providers/dexonline/paradigm.js';
import { collectRelations, parseMeaningTrees } from '../../src/providers/dexonline/tree.js';
import { firstOrThrow, fixture } from '../helpers.js';

const html = () => fixture('dexonline-html', 'casă');

describe('parseMeaningTrees', () => {
  const trees = () => parseMeaningTrees(html());

  it('finds one tree per lexeme on the page', () => {
    expect(trees().length).toBeGreaterThan(1);
  });

  it('reads the grammatical header', () => {
    expect(firstOrThrow(trees(), 'tree').posInfo).toBe('substantiv feminin');
  });

  it('numbers the top-level senses', () => {
    const t = firstOrThrow(trees(), 'tree');
    expect(t.nodes[0]?.number).toBe(1);
    expect(t.nodes[0]?.text).toBe('Clădire care servește drept locuință.');
  });

  it('attributes each sense to the dictionaries that attest it', () => {
    expect(firstOrThrow(trees(), 'tree').nodes[0]?.sources).toEqual(
      expect.arrayContaining(["DEX '09", 'DLRLC']),
    );
  });

  it('extracts examples with their bibliographic citation', () => {
    const example = firstOrThrow(trees(), 'tree').nodes[0]?.children.find(
      (c) => c.type === 'example',
    );
    expect(example?.text).toBe('Casa e așezată în dreptul ariei.');
    expect(example?.citation).toBe('STANCU, D. 19.');
  });

  it('keeps the citation out of the quotation text', () => {
    const example = firstOrThrow(trees(), 'tree').nodes[0]?.children.find(
      (c) => c.type === 'example',
    );
    expect(example?.text).not.toMatch(/STANCU/);
  });

  it('reads typed relations off the sense', () => {
    const rel = firstOrThrow(trees(), 'tree').nodes[0]?.relations;
    expect(rel?.diminutives).toEqual(expect.arrayContaining(['căscioară', 'căsuță']));
    expect(rel?.augmentatives).toContain('căsoaie');
  });

  it('collects synonyms across the whole tree', () => {
    const all = collectRelations(firstOrThrow(trees(), 'tree').nodes);
    expect(all.synonyms).toEqual(expect.arrayContaining(['cameră', 'odaie', 'gospodărie']));
  });

  it('returns [] for an empty document', () => {
    expect(parseMeaningTrees('')).toEqual([]);
  });
});

describe('parseParadigms', () => {
  const paradigms = () => parseParadigms(html());

  it('skips lexemes marked noParadigm', () => {
    // The fixture has 10 .paradigmDiv blocks, 2 of them empty.
    expect(paradigms()).toHaveLength(8);
  });

  it('reads the full eight-cell noun declension', () => {
    const noun = paradigms().find((p) => p.paradigm.modelCode === 'F1');
    expect(noun?.posInfo).toBe('substantiv feminin');
    const byForm = (f: string) => noun?.paradigm.cells.find((c) => c.forms.includes(f))?.tags;
    expect(byForm('casă')).toEqual(
      expect.arrayContaining(['nominative', 'singular', 'unarticulated']),
    );
    expect(byForm('casa')).toEqual(expect.arrayContaining(['nominative', 'articulated']));
    expect(byForm('casele')).toEqual(expect.arrayContaining(['plural', 'articulated']));
    expect(byForm('caselor')).toEqual(
      expect.arrayContaining(['genitive', 'dative', 'plural', 'articulated']),
    );
  });

  it('carries a rowspan label down to the rows it covers', () => {
    // "genitiv-dativ" spans two rows; without the carry its plural row lost it.
    const noun = paradigms().find((p) => p.paradigm.modelCode === 'F1');
    const caselor = noun?.paradigm.cells.find((c) => c.forms.includes('caselor'));
    expect(caselor?.tags).toEqual(expect.arrayContaining(['genitive', 'dative']));
  });

  it('emits attested inflections for nominals', () => {
    const noun = paradigms().find((p) => p.paradigm.modelCode === 'F1');
    expect(noun?.inflections).toHaveLength(8);
    expect(noun?.inflections.every((i) => i.origin === 'attested')).toBe(true);
  });

  it('keeps verb cells but publishes no verb inflections', () => {
    // The verb table is a multi-block grid this mapping does not yet read
    // correctly; the forms are kept, the (unreliable) tags are not published.
    const verb = paradigms().find((p) => p.posInfo === 'verb');
    expect(verb?.paradigm.cells.length).toBeGreaterThan(20);
    expect(verb?.inflections).toEqual([]);
  });

  it('returns [] for an empty document', () => {
    expect(parseParadigms('')).toEqual([]);
  });
});
