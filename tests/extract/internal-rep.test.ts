import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  readEtymology,
  readHeadword,
  renderInternalRep,
  splitSenses,
} from '../../src/extract/internal-rep.js';

const DEX09 =
  '@C&#039;ASĂ^1,@ $case,$ #s. f.# @1.@ Clădire care servește drept locuință. * #Loc. adj.# $De casă$ = făcut în casă^1. ** (#Reg.#) Cameră, odaie. @2.@ Încăpere specială într-o clădire. @3.@ Gospodărie. - #Lat.# @casa.@';

describe('decodeEntities', () => {
  it('decodes the numeric apostrophe DEXonline stores', () => {
    expect(decodeEntities('C&#039;ASĂ')).toBe("C'ASĂ");
  });

  it('decodes &lt; used by NODEX etymologies', () => {
    expect(decodeEntities('/&lt;lat. casa')).toBe('/<lat. casa');
  });

  it('decodes &amp; last so it cannot double-decode', () => {
    expect(decodeEntities('&amp;#039;')).toBe('&#039;');
  });
});

describe('renderInternalRep', () => {
  it('strips sigils from the text but records the spans', () => {
    const r = renderInternalRep(DEX09);
    expect(r.text).not.toMatch(/[@$#%]/);
    expect(r.spans.filter((s) => s.kind === 'abbrev').map((s) => s.text)).toEqual(
      expect.arrayContaining(['s. f.', 'Loc. adj.', 'Reg.', 'Lat.']),
    );
  });

  it('drops the homonym index rather than gluing it to the word', () => {
    // "casă^1" must not render as "casă1".
    expect(renderInternalRep('@casă^1@').text).toBe('casă');
    expect(renderInternalRep('@casă^{3}@').text).toBe('casă');
  });
});

describe('readHeadword', () => {
  it('reads lemma, tonic accent and homonym index', () => {
    expect(readHeadword(DEX09)).toEqual({
      lemma: 'CASĂ',
      stressed: 'CÁSĂ',
      homonymIndex: 1,
    });
  });

  it('drops the NODEX "~" inflection hint from the headword block', () => {
    expect(readHeadword('@CASĂ ~e@')?.lemma).toBe('CASĂ');
  });

  it('returns undefined when there is no bold block', () => {
    expect(readHeadword('no markup here')).toBeUndefined();
  });
});

describe('splitSenses', () => {
  it('splits on the bold @n.@ markers', () => {
    const senses = splitSenses(renderInternalRep(DEX09));
    expect(senses.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(senses[0]?.text).toBe('Clădire care servește drept locuință.');
  });

  it('keeps locutions and sub-senses out of the sense text', () => {
    const senses = splitSenses(renderInternalRep(DEX09));
    expect(senses[0]?.text).not.toMatch(/Loc\. adj\.|Cameră, odaie/);
    expect(senses[0]?.subItems.length).toBeGreaterThanOrEqual(2);
  });

  it('does not leave the trailing etymology inside the last sense', () => {
    const senses = splitSenses(renderInternalRep(DEX09));
    expect(senses[senses.length - 1]?.text).not.toMatch(/Lat\./);
  });

  it('returns a single sense for unnumbered definitions', () => {
    // MDA2 and Argou entries carry no @n.@ markers at all; returning [] here
    // dropped the whole definition.
    const r = renderInternalRep('@$c&#039;asă^{3}$@ $#sf#$ Boală a vinurilor.');
    expect(splitSenses(r)).toHaveLength(1);
  });

  it('handles NODEX bare "n)" numbering', () => {
    const r = renderInternalRep('#s. f.# 1) Construcție. 2) Gospodărie.');
    expect(splitSenses(r).map((s) => s.number)).toEqual([1, 2]);
  });
});

describe('readEtymology', () => {
  it('reads the DEX trailing form', () => {
    expect(readEtymology(renderInternalRep(DEX09))).toEqual({
      text: 'Lat. casa.',
      languages: ['lat.'],
    });
  });

  it('reads the NODEX "/<lat. casa" form without truncating at the dot', () => {
    const r = renderInternalRep('Unitate economică. /&lt;lat. $casa$');
    expect(readEtymology(r)?.text).toMatch(/^lat\.\s*casa/);
  });

  it('reads the MDA2 "E:" form', () => {
    const r = renderInternalRep('[#At:# LTR / #Pl:# $~se$ / #E:# #fr# @$casse$@] Boală.');
    expect(readEtymology(r)?.text).toMatch(/fr/);
  });

  it('does not match "Din" inside an ordinary word', () => {
    // Regression: /(?:Etim\.?|Etymol\.?|Din)…/ had no word boundary, so
    // "Dinastie; neam" produced the etymology "astie; neam".
    const r = renderInternalRep('Totalitatea celor care locuiesc împreună. Dinastie; neam.');
    expect(readEtymology(r)).toBeUndefined();
  });

  it('returns undefined when there is no etymology', () => {
    expect(readEtymology(renderInternalRep('Simple text.'))).toBeUndefined();
  });
});

describe('sub-item markers', () => {
  it('distinguishes ◊ locutions from ♦ sub-senses', () => {
    const senses = splitSenses(renderInternalRep(DEX09));
    const markers = senses[0]?.subItems.map((s) => s.marker);
    // "* Loc. adj. …", "* Expr. …" and "** (Reg.) Cameră, odaie."
    expect(markers).toContain('*');
    expect(markers).toContain('**');
  });

  it('keeps the sub-sense text with its marker', () => {
    const sub = splitSenses(renderInternalRep(DEX09))[0]?.subItems.find((s) => s.marker === '**');
    expect(sub?.text).toMatch(/Cameră, odaie/);
  });
});
