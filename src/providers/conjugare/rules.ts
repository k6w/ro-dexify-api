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

export function conjugateRomanianVerb(infinitive: string): VerbConjugation | undefined {
  const w = infinitive.normalize('NFC').toLocaleLowerCase('ro-RO').trim();
  if (!w || w.length < 2) return undefined;

  if (w.endsWith('a')) {
    return classI(w);
  }
  if (w.endsWith('ea')) {
    return classII(w);
  }
  if (w.endsWith('e')) {
    return classIII(w);
  }
  if (w.endsWith('i')) {
    return classIVi(w);
  }
  if (w.endsWith('î')) {
    return classIVa(w);
  }
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
