import { describe, expect, it } from 'vitest';
import { enrichWithPage } from '../../src/providers/dexonline/enrich.js';
import { parseParadigms } from '../../src/providers/dexonline/paradigm.js';
import { parseDexonline } from '../../src/providers/dexonline/parse.js';
import { collectRelations, parseMeaningTrees } from '../../src/providers/dexonline/tree.js';
import { applyView } from '../../src/server/view.js';
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

describe('enrichWithPage', () => {
  const enriched = () => {
    const base = parseDexonline(fixture('dexonline', 'casă'), 'casă', {
      all: true,
      includeOrthographic: true,
    });
    return applyView(enrichWithPage(base, html()));
  };

  it('attaches the full declension the JSON API does not carry', () => {
    const e = firstOrThrow(enriched(), 'entry');
    expect(e.paradigm?.modelCode).toBe('F1');
    expect(e.inflections.map((i) => i.form)).toEqual(
      expect.arrayContaining(['casă', 'casa', 'case', 'casele', 'casei', 'caselor']),
    );
    expect(e.inflections.every((i) => i.origin === 'attested')).toBe(true);
  });

  it('adds examples with citations without dropping the JSON children', () => {
    const s1 = firstOrThrow(enriched(), 'entry').senses[0];
    const types = new Set(s1?.children.map((c) => c.type));
    // ◊/♦ items come from internalRep, examples from the page.
    expect(types).toContain('locution');
    expect(types).toContain('sub-meaning');
    expect(types).toContain('example');
    const cited = s1?.children.filter((c) => c.citation) ?? [];
    expect(cited.length).toBeGreaterThan(0);
    expect(cited[0]?.citation).toBe('STANCU, D. 19.');
  });

  it('adds relations the JSON API does not carry', () => {
    const rel = firstOrThrow(enriched(), 'entry').senses[0]?.relations;
    expect(rel?.diminutives).toEqual(expect.arrayContaining(['căscioară', 'căsuță']));
    expect(rel?.synonyms).toEqual(expect.arrayContaining(['cameră', 'odaie']));
  });

  it('is a no-op when the page is empty', () => {
    const base = parseDexonline(fixture('dexonline', 'casă'), 'casă');
    expect(enrichWithPage(base, '')).toEqual(base);
  });
});
