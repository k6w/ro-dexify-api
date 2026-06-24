import { irregularForms } from './irregular.js';
export type FormKey =
  | 'inf'
  | 'inf.long'
  | 'part.past'
  | 'gerund'
  | 'imperative.2sg'
  | 'imperative.2pl'
  | `ind.prez.${1 | 2 | 3}${'sg' | 'pl'}`
  | `ind.imperf.${1 | 2 | 3}${'sg' | 'pl'}`
  | `ind.perfsimp.${1 | 2 | 3}${'sg' | 'pl'}`
  | `conj.prez.${3}${'sg' | 'pl'}`;

export interface VerbConjugation {
  classRoman: string;
  forms: Partial<Record<FormKey, string>>;
}

/**
 * Strip the infinitive particle: Romanian cites verbs as "a merge", and users
 * type it that way. Treating it as part of the stem produced "a fesc"/"a fit".
 */
export function stripInfinitiveParticle(input: string): string {
  return input.replace(/^\s*a\s+/i, '').trim();
}

export function conjugateRomanianVerb(infinitive: string): VerbConjugation | undefined {
  const w = stripInfinitiveParticle(infinitive.normalize('NFC').toLocaleLowerCase('ro-RO').trim());
  if (!w || w.length < 2) return undefined;

  // The irregular table wins: no suffix rule derives "făcut" from "face" or
  // "sunt" from "fi".
  const irregular = irregularForms(w);
  if (irregular) {
    const base = regularFor(w);
    // Fill any cell the table leaves out from the regular pattern for its class.
    return base
      ? { classRoman: irregular.classRoman, forms: { ...base.forms, ...irregular.forms } }
      : irregular;
  }

  return regularFor(w);
}

/**
 * Apply the regular pattern for the verb's conjugation class.
 *
 * Suffixes are tested longest-first. Testing `endsWith('a')` before
 * `endsWith('ea')` put every class II verb (vedea, putea, avea, plăcea) in
 * class I and conjugated it with the wrong endings.
 */
function regularFor(w: string): VerbConjugation | undefined {
  if (w.endsWith('ea')) return classII(w);
  if (w.endsWith('a')) return classI(w);
  if (w.endsWith('e')) return classIII(w);
  if (w.endsWith('i')) return classIVi(w);
  if (w.endsWith('î')) return classIVa(w);
  return undefined;
}

function classI(inf: string): VerbConjugation {
  const stem = inf.slice(0, -1);
  return {
    classRoman: 'I',
    forms: {
      inf,
      'inf.long': `${stem}are`,
      'part.past': `${stem}at`,
      gerund: `${stem}ând`,
      'imperative.2sg': `${stem}ă`,
      'imperative.2pl': `${stem}ați`,
      'ind.prez.1sg': stem,
      'ind.prez.2sg': `${stem}i`,
      'ind.prez.3sg': `${stem}ă`,
      'ind.prez.1pl': `${stem}ăm`,
      'ind.prez.2pl': `${stem}ați`,
      'ind.prez.3pl': `${stem}ă`,
      'ind.imperf.1sg': `${stem}am`,
      'ind.imperf.2sg': `${stem}ai`,
      'ind.imperf.3sg': `${stem}a`,
      'ind.imperf.1pl': `${stem}am`,
      'ind.imperf.2pl': `${stem}ați`,
      'ind.imperf.3pl': `${stem}au`,
      'ind.perfsimp.1sg': `${stem}ai`,
      'ind.perfsimp.2sg': `${stem}ași`,
      'ind.perfsimp.3sg': `${stem}ă`,
      'ind.perfsimp.1pl': `${stem}arăm`,
      'ind.perfsimp.2pl': `${stem}arăți`,
      'ind.perfsimp.3pl': `${stem}ară`,
      'conj.prez.3sg': `să ${stem}e`,
      'conj.prez.3pl': `să ${stem}e`,
    },
  };
}

function classII(inf: string): VerbConjugation {
  const stem = inf.slice(0, -2);
  return {
    classRoman: 'II',
    forms: {
      inf,
      'inf.long': `${stem}ere`,
      'part.past': `${stem}ut`,
      gerund: `${stem}ând`,
      'imperative.2sg': `${stem}e`,
      'imperative.2pl': `${stem}eți`,
      'ind.prez.1sg': stem,
      'ind.prez.2sg': `${stem}i`,
      'ind.prez.3sg': `${stem}e`,
      'ind.prez.1pl': `${stem}em`,
      'ind.prez.2pl': `${stem}eți`,
      'ind.prez.3pl': stem,
      'conj.prez.3sg': `să ${stem}ă`,
      'conj.prez.3pl': `să ${stem}ă`,
    },
  };
}

function classIII(inf: string): VerbConjugation {
  const stem = inf.slice(0, -1);
  return {
    classRoman: 'III',
    forms: {
      inf,
      'inf.long': `${stem}ere`,
      'part.past': `${stem}ut`,
      gerund: `${stem}ând`,
      'imperative.2sg': `${stem}e`,
      'imperative.2pl': `${stem}eți`,
      'ind.prez.1sg': stem,
      'ind.prez.2sg': `${stem}i`,
      'ind.prez.3sg': `${stem}e`,
      'ind.prez.1pl': `${stem}em`,
      'ind.prez.2pl': `${stem}eți`,
      'ind.prez.3pl': stem,
      'conj.prez.3sg': `să ${stem}ă`,
      'conj.prez.3pl': `să ${stem}ă`,
    },
  };
}

function classIVi(inf: string): VerbConjugation {
  const stem = inf.slice(0, -1);
  return {
    classRoman: 'IV',
    forms: {
      inf,
      'inf.long': `${stem}ire`,
      'part.past': `${stem}it`,
      gerund: `${stem}ind`,
      'imperative.2sg': `${stem}ește`,
      'imperative.2pl': `${stem}iți`,
      'ind.prez.1sg': `${stem}esc`,
      'ind.prez.2sg': `${stem}ești`,
      'ind.prez.3sg': `${stem}ește`,
      'ind.prez.1pl': `${stem}im`,
      'ind.prez.2pl': `${stem}iți`,
      'ind.prez.3pl': `${stem}esc`,
      'conj.prez.3sg': `să ${stem}ească`,
      'conj.prez.3pl': `să ${stem}ească`,
    },
  };
}

function classIVa(inf: string): VerbConjugation {
  const stem = inf.slice(0, -1);
  return {
    classRoman: 'IV',
    forms: {
      inf,
      'inf.long': `${stem}âre`,
      'part.past': `${stem}ât`,
      gerund: `${stem}ând`,
      'imperative.2sg': `${stem}ăște`,
      'imperative.2pl': `${stem}âți`,
      'ind.prez.1sg': `${stem}ăsc`,
      'ind.prez.2sg': `${stem}ăști`,
      'ind.prez.3sg': `${stem}ăște`,
      'ind.prez.1pl': `${stem}âm`,
      'ind.prez.2pl': `${stem}âți`,
      'ind.prez.3pl': `${stem}ăsc`,
      'conj.prez.3sg': `să ${stem}ască`,
      'conj.prez.3pl': `să ${stem}ască`,
    },
  };
}
