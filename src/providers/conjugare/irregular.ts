/**
 * Irregular Romanian verbs.
 *
 * These are a closed class whose forms no suffix rule derives: the stem itself
 * changes (`face` -> `făcut`, `vedea` -> `văzut`), or the paradigm is suppletive
 * (`fi` -> `sunt`/`ești`/`este`/`fost`). The rule engine produced `facut`,
 * `vedeat` and `a fesc` for exactly these.
 *
 * Only forms that genuinely differ from the regular pattern are listed; the
 * caller fills the rest from the rules for the verb's class.
 */
import type { FormKey, VerbConjugation } from './rules.js';

type IrregularForms = Partial<Record<FormKey, string>>;

interface IrregularEntry {
  classRoman: string;
  forms: IrregularForms;
}

/** Keyed by infinitive without the `a` particle. */
const IRREGULAR: Record<string, IrregularEntry> = {
  fi: {
    classRoman: 'IV',
    forms: {
      inf: 'fi',
      'inf.long': 'fire',
      'part.past': 'fost',
      gerund: 'fiind',
      'imperative.2sg': 'fii',
      'imperative.2pl': 'fiți',
      'ind.prez.1sg': 'sunt',
      'ind.prez.2sg': 'ești',
      'ind.prez.3sg': 'este',
      'ind.prez.1pl': 'suntem',
      'ind.prez.2pl': 'sunteți',
      'ind.prez.3pl': 'sunt',
      'ind.imperf.1sg': 'eram',
      'ind.imperf.2sg': 'erai',
      'ind.imperf.3sg': 'era',
      'ind.imperf.1pl': 'eram',
      'ind.imperf.2pl': 'erați',
      'ind.imperf.3pl': 'erau',
      'ind.perfsimp.1sg': 'fusei',
      'ind.perfsimp.2sg': 'fuseși',
      'ind.perfsimp.3sg': 'fu',
      'ind.perfsimp.1pl': 'fuserăm',
      'ind.perfsimp.2pl': 'fuserăți',
      'ind.perfsimp.3pl': 'fuseră',
      'conj.prez.3sg': 'fie',
      'conj.prez.3pl': 'fie',
    },
  },
  avea: {
    classRoman: 'II',
    forms: {
      inf: 'avea',
      'inf.long': 'avere',
      'part.past': 'avut',
      gerund: 'având',
      'imperative.2sg': 'ai',
      'imperative.2pl': 'aveți',
      'ind.prez.1sg': 'am',
      'ind.prez.2sg': 'ai',
      'ind.prez.3sg': 'are',
      'ind.prez.1pl': 'avem',
      'ind.prez.2pl': 'aveți',
      'ind.prez.3pl': 'au',
      'conj.prez.3sg': 'aibă',
      'conj.prez.3pl': 'aibă',
    },
  },
  vrea: {
    classRoman: 'II',
    forms: {
      inf: 'vrea',
      'part.past': 'vrut',
      gerund: 'vrând',
      'ind.prez.1sg': 'vreau',
      'ind.prez.2sg': 'vrei',
      'ind.prez.3sg': 'vrea',
      'ind.prez.1pl': 'vrem',
      'ind.prez.2pl': 'vreți',
      'ind.prez.3pl': 'vor',
      'conj.prez.3sg': 'vrea',
      'conj.prez.3pl': 'vrea',
    },
  },
  putea: {
    classRoman: 'II',
    forms: {
      inf: 'putea',
      'part.past': 'putut',
      gerund: 'putând',
      'ind.prez.1sg': 'pot',
      'ind.prez.2sg': 'poți',
      'ind.prez.3sg': 'poate',
      'ind.prez.1pl': 'putem',
      'ind.prez.2pl': 'puteți',
      'ind.prez.3pl': 'pot',
      'conj.prez.3sg': 'poată',
      'conj.prez.3pl': 'poată',
    },
  },
  vedea: {
    classRoman: 'II',
    forms: {
      inf: 'vedea',
      'part.past': 'văzut',
      gerund: 'văzând',
      'imperative.2sg': 'vezi',
      'imperative.2pl': 'vedeți',
      'ind.prez.1sg': 'văd',
      'ind.prez.2sg': 'vezi',
      'ind.prez.3sg': 'vede',
      'ind.prez.1pl': 'vedem',
      'ind.prez.2pl': 'vedeți',
      'ind.prez.3pl': 'văd',
      'conj.prez.3sg': 'vadă',
      'conj.prez.3pl': 'vadă',
    },
  },
  face: {
    classRoman: 'III',
    forms: {
      inf: 'face',
      'part.past': 'făcut',
      gerund: 'făcând',
      'imperative.2sg': 'fă',
      'imperative.2pl': 'faceți',
      'ind.prez.1sg': 'fac',
      'ind.prez.2sg': 'faci',
      'ind.prez.3sg': 'face',
      'ind.prez.1pl': 'facem',
      'ind.prez.2pl': 'faceți',
      'ind.prez.3pl': 'fac',
      'conj.prez.3sg': 'facă',
      'conj.prez.3pl': 'facă',
    },
  },
  merge: {
    classRoman: 'III',
    forms: {
      inf: 'merge',
      'part.past': 'mers',
      gerund: 'mergând',
      'imperative.2sg': 'mergi',
      'imperative.2pl': 'mergeți',
      'ind.prez.1sg': 'merg',
      'ind.prez.2sg': 'mergi',
      'ind.prez.3sg': 'merge',
      'ind.prez.1pl': 'mergem',
      'ind.prez.2pl': 'mergeți',
      'ind.prez.3pl': 'merg',
      'ind.perfsimp.3sg': 'merse',
      'conj.prez.3sg': 'meargă',
      'conj.prez.3pl': 'meargă',
    },
  },
  da: {
    classRoman: 'I',
    forms: {
      inf: 'da',
      'part.past': 'dat',
      gerund: 'dând',
      'imperative.2sg': 'dă',
      'ind.prez.1sg': 'dau',
      'ind.prez.2sg': 'dai',
      'ind.prez.3sg': 'dă',
      'ind.prez.1pl': 'dăm',
      'ind.prez.2pl': 'dați',
      'ind.prez.3pl': 'dau',
      'conj.prez.3sg': 'dea',
      'conj.prez.3pl': 'dea',
    },
  },
  sta: {
    classRoman: 'I',
    forms: {
      inf: 'sta',
      'part.past': 'stat',
      gerund: 'stând',
      'imperative.2sg': 'stai',
      'ind.prez.1sg': 'stau',
      'ind.prez.2sg': 'stai',
      'ind.prez.3sg': 'stă',
      'ind.prez.1pl': 'stăm',
      'ind.prez.2pl': 'stați',
      'ind.prez.3pl': 'stau',
      'conj.prez.3sg': 'stea',
      'conj.prez.3pl': 'stea',
    },
  },
  lua: {
    classRoman: 'I',
    forms: {
      inf: 'lua',
      'part.past': 'luat',
      gerund: 'luând',
      'imperative.2sg': 'ia',
      'ind.prez.1sg': 'iau',
      'ind.prez.2sg': 'iei',
      'ind.prez.3sg': 'ia',
      'ind.prez.1pl': 'luăm',
      'ind.prez.2pl': 'luați',
      'ind.prez.3pl': 'iau',
      'conj.prez.3sg': 'ia',
      'conj.prez.3pl': 'ia',
    },
  },
  bea: {
    classRoman: 'II',
    forms: {
      inf: 'bea',
      'part.past': 'băut',
      gerund: 'bând',
      'imperative.2sg': 'bea',
      'ind.prez.1sg': 'beau',
      'ind.prez.2sg': 'bei',
      'ind.prez.3sg': 'bea',
      'ind.prez.1pl': 'bem',
      'ind.prez.2pl': 'beți',
      'ind.prez.3pl': 'beau',
      'conj.prez.3sg': 'bea',
      'conj.prez.3pl': 'bea',
    },
  },
  ști: {
    classRoman: 'IV',
    forms: {
      inf: 'ști',
      'part.past': 'știut',
      gerund: 'știind',
      'ind.prez.1sg': 'știu',
      'ind.prez.2sg': 'știi',
      'ind.prez.3sg': 'știe',
      'ind.prez.1pl': 'știm',
      'ind.prez.2pl': 'știți',
      'ind.prez.3pl': 'știu',
      'conj.prez.3sg': 'știe',
      'conj.prez.3pl': 'știe',
    },
  },
  veni: {
    classRoman: 'IV',
    forms: {
      inf: 'veni',
      'part.past': 'venit',
      gerund: 'venind',
      'imperative.2sg': 'vino',
      'ind.prez.1sg': 'vin',
      'ind.prez.2sg': 'vii',
      'ind.prez.3sg': 'vine',
      'ind.prez.1pl': 'venim',
      'ind.prez.2pl': 'veniți',
      'ind.prez.3pl': 'vin',
      'conj.prez.3sg': 'vină',
      'conj.prez.3pl': 'vină',
    },
  },
  spune: {
    classRoman: 'III',
    forms: {
      inf: 'spune',
      'part.past': 'spus',
      gerund: 'spunând',
      'imperative.2sg': 'spune',
      'ind.prez.1sg': 'spun',
      'ind.prez.3sg': 'spune',
      'ind.prez.3pl': 'spun',
      'conj.prez.3sg': 'spună',
      'conj.prez.3pl': 'spună',
    },
  },
  zice: {
    classRoman: 'III',
    forms: {
      inf: 'zice',
      'part.past': 'zis',
      gerund: 'zicând',
      'imperative.2sg': 'zi',
      'ind.prez.1sg': 'zic',
      'ind.prez.3sg': 'zice',
      'ind.prez.3pl': 'zic',
      'conj.prez.3sg': 'zică',
      'conj.prez.3pl': 'zică',
    },
  },
  duce: {
    classRoman: 'III',
    forms: {
      inf: 'duce',
      'part.past': 'dus',
      gerund: 'ducând',
      'imperative.2sg': 'du',
      'ind.prez.1sg': 'duc',
      'ind.prez.3sg': 'duce',
      'ind.prez.3pl': 'duc',
      'conj.prez.3sg': 'ducă',
      'conj.prez.3pl': 'ducă',
    },
  },
  trece: {
    classRoman: 'III',
    forms: {
      inf: 'trece',
      'part.past': 'trecut',
      gerund: 'trecând',
      'ind.prez.1sg': 'trec',
      'ind.prez.3sg': 'trece',
      'ind.prez.3pl': 'trec',
      'conj.prez.3sg': 'treacă',
      'conj.prez.3pl': 'treacă',
    },
  },
  scrie: {
    classRoman: 'III',
    forms: {
      inf: 'scrie',
      'part.past': 'scris',
      gerund: 'scriind',
      'ind.prez.1sg': 'scriu',
      'ind.prez.3sg': 'scrie',
      'ind.prez.3pl': 'scriu',
      'conj.prez.3sg': 'scrie',
      'conj.prez.3pl': 'scrie',
    },
  },
  pune: {
    classRoman: 'III',
    forms: {
      inf: 'pune',
      'part.past': 'pus',
      gerund: 'punând',
      'imperative.2sg': 'pune',
      'ind.prez.1sg': 'pun',
      'ind.prez.3sg': 'pune',
      'ind.prez.3pl': 'pun',
      'conj.prez.3sg': 'pună',
      'conj.prez.3pl': 'pună',
    },
  },
  ține: {
    classRoman: 'III',
    forms: {
      inf: 'ține',
      'part.past': 'ținut',
      gerund: 'ținând',
      'ind.prez.1sg': 'țin',
      'ind.prez.3sg': 'ține',
      'ind.prez.3pl': 'țin',
      'conj.prez.3sg': 'țină',
      'conj.prez.3pl': 'țină',
    },
  },
  rămâne: {
    classRoman: 'III',
    forms: {
      inf: 'rămâne',
      'part.past': 'rămas',
      gerund: 'rămânând',
      'ind.prez.1sg': 'rămân',
      'ind.prez.3sg': 'rămâne',
      'ind.prez.3pl': 'rămân',
      'conj.prez.3sg': 'rămână',
      'conj.prez.3pl': 'rămână',
    },
  },
  mânca: {
    classRoman: 'I',
    forms: {
      inf: 'mânca',
      'part.past': 'mâncat',
      gerund: 'mâncând',
      'imperative.2sg': 'mănâncă',
      'ind.prez.1sg': 'mănânc',
      'ind.prez.2sg': 'mănânci',
      'ind.prez.3sg': 'mănâncă',
      'ind.prez.1pl': 'mâncăm',
      'ind.prez.2pl': 'mâncați',
      'ind.prez.3pl': 'mănâncă',
      'conj.prez.3sg': 'mănânce',
      'conj.prez.3pl': 'mănânce',
    },
  },
};

export function isIrregular(infinitive: string): boolean {
  return Object.hasOwn(IRREGULAR, infinitive);
}

/** Irregular overrides for a verb, or undefined when it is regular. */
export function irregularForms(infinitive: string): VerbConjugation | undefined {
  const entry = IRREGULAR[infinitive];
  if (!entry) return undefined;
  return { classRoman: entry.classRoman, forms: { ...entry.forms } };
}

/** Every lemma in the table, for tests and diagnostics. */
export function irregularLemmas(): string[] {
  return Object.keys(IRREGULAR);
}
