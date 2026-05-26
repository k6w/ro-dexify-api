/**
 * Romanian dictionary abbreviations -> part of speech, gender, register.
 *
 * Every provider previously carried its own partial, divergent copy of this
 * mapping (four separate POS tables across dexonline, doom, mdex and
 * wiktionary), which is why the same word could come back as `substantiv` from
 * one source and `unknown` from another.
 *
 * The expansions are the ones DEXonline itself ships: its rendered pages carry
 * <abbr class="abbrev" data-bs-content="..."> on every abbreviation, e.g.
 * "s. f." -> "substantiv feminin", "reg." -> "regional", "vb. tr." ->
 * "verb tranzitiv".
 */
import type { Gender, PartOfSpeech } from '../schema/entry.js';

export interface GrammarReading {
  partOfSpeech: PartOfSpeech;
  gender?: Gender;
  /** Register / usage labels found in the text, normalised to full words. */
  register: string[];
  /** True when a verb is marked transitive/intransitive/reflexive. */
  verbFlags: string[];
}

/**
 * Part-of-speech markers, longest-first so that "s. f." wins over "s." and
 * "loc. adj." over "adj.".
 */
const POS_PATTERNS: Array<[RegExp, PartOfSpeech]> = [
  [/\bloc\.\s*(adj|adv|vb|subst|prep|conj|interj)\b/i, 'locuțiune'],
  [/\blocuțiun\w*/i, 'locuțiune'],
  [/\bexpr\b\.?|\bexpresie\b/i, 'expresie'],
  [/\bs\.\s*[fmn]\b\.?|\bsubstantiv\w*/i, 'substantiv'],
  [/\bsubst\b\.?/i, 'substantiv'],
  [/\bvb\b\.?|\bverb\w*/i, 'verb'],
  [/\badj\b\.?|\badjectiv\w*/i, 'adjectiv'],
  [/\badv\b\.?|\badverb\w*/i, 'adverb'],
  [/\bpron\b\.?|\bpronume\b/i, 'pronume'],
  [/\bnum\b\.?|\bnumeral\w*/i, 'numeral'],
  [/\bprep\b\.?|\bprepoziți\w*/i, 'prepoziție'],
  [/\bconj\b\.?|\bconjuncți\w*/i, 'conjuncție'],
  [/\binterj\b\.?|\binterjecți\w*/i, 'interjecție'],
  [/\bart\b\.?|\barticol\w*/i, 'articol'],
];

const GENDER_PATTERNS: Array<[RegExp, Gender]> = [
  [/\bs\.\s*f\b\.?|\bsubstantiv\s+feminin\b|\bfeminin\b|\bf\.\s*pl\b/i, 'feminin'],
  [/\bs\.\s*m\b\.?|\bsubstantiv\s+masculin\b|\bmasculin\b/i, 'masculin'],
  [/\bs\.\s*n\b\.?|\bsubstantiv\s+neutru\b|\bneutru\b/i, 'neutru'],
];

/**
 * Register/usage labels. Key is the abbreviation as it appears in text; value
 * is the expansion DEXonline uses.
 */
export const REGISTER_LABELS: ReadonlyMap<string, string> = new Map([
  ['fig.', 'figurat'],
  ['pop.', 'popular'],
  ['fam.', 'familiar'],
  ['reg.', 'regional'],
  ['înv.', 'învechit'],
  ['arh.', 'arhaic'],
  ['rar', 'rar'],
  ['lit.', 'literar'],
  ['spec.', 'specializat'],
  ['tehn.', 'tehnic'],
  ['jur.', 'juridic'],
  ['med.', 'medical'],
  ['mar.', 'marină'],
  ['mil.', 'militar'],
  ['rel.', 'religios'],
  ['ling.', 'lingvistică'],
  ['bot.', 'botanică'],
  ['zool.', 'zoologie'],
  ['anat.', 'anatomie'],
  ['chim.', 'chimie'],
  ['fiz.', 'fizică'],
  ['mat.', 'matematică'],
  ['muz.', 'muzică'],
  ['geol.', 'geologie'],
  ['gram.', 'gramatică'],
  ['peior.', 'peiorativ'],
  ['depr.', 'depreciativ'],
  ['iron.', 'ironic'],
  ['glumeț', 'glumeț'],
  ['arg.', 'argou'],
  ['vulg.', 'vulgar'],
  ['ieșit din uz', 'ieșit din uz'],
]);

const VERB_FLAGS: ReadonlyMap<string, string> = new Map([
  ['tranz.', 'tranzitiv'],
  ['tr.', 'tranzitiv'],
  ['intranz.', 'intranzitiv'],
  ['intr.', 'intranzitiv'],
  ['refl.', 'reflexiv'],
  ['pas.', 'pasiv'],
  ['impers.', 'impersonal'],
  ['unipers.', 'unipersonal'],
]);

/** Escape a literal for embedding in a RegExp. */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Read grammatical information out of a dictionary label string.
 *
 * Accepts either raw abbreviations ("s. f.", "vb. tr.") or already-expanded
 * glosses ("substantiv feminin"), so it works both on scraped text and on
 * DEXonline's `data-bs-content` expansions.
 */
export function readGrammar(text: string): GrammarReading {
  const lower = text.toLocaleLowerCase('ro-RO');

  let partOfSpeech: PartOfSpeech = 'unknown';
  for (const [re, pos] of POS_PATTERNS) {
    if (re.test(lower)) {
      partOfSpeech = pos;
      break;
    }
  }

  let gender: Gender | undefined;
  for (const [re, g] of GENDER_PATTERNS) {
    if (re.test(lower)) {
      gender = g;
      break;
    }
  }
  // Gender markers only mean anything on a nominal.
  if (gender && partOfSpeech !== 'substantiv' && partOfSpeech !== 'adjectiv') {
    gender = undefined;
  }

  const register: string[] = [];
  for (const [abbr, expansion] of REGISTER_LABELS) {
    const re = new RegExp(`(^|[\\s(\\[])${esc(abbr)}`, 'i');
    if (re.test(lower) && !register.includes(expansion)) register.push(expansion);
  }

  const verbFlags: string[] = [];
  if (partOfSpeech === 'verb') {
    for (const [abbr, expansion] of VERB_FLAGS) {
      const re = new RegExp(`(^|[\\s(\\[])${esc(abbr)}`, 'i');
      if (re.test(lower) && !verbFlags.includes(expansion)) verbFlags.push(expansion);
    }
  }

  return gender
    ? { partOfSpeech, gender, register, verbFlags }
    : { partOfSpeech, register, verbFlags };
}

/**
 * True when a token is a grammatical abbreviation rather than a word form.
 *
 * Guards against emitting fragments like "s.", "art." or "pl." as headwords or
 * inflected forms -- the exact failure the DOOM parser exhibited.
 */
export function isAbbreviationToken(token: string): boolean {
  const t = token.trim().toLocaleLowerCase('ro-RO');
  if (!t) return true;
  if (/^[a-zăâîșț]{1,6}\.$/.test(t)) return true; // s. art. pl. vb. adj. tranz.
  if (/^[a-zăâîșț]\.-?[a-zăâîșț]\.$/.test(t)) return true; // g.-d.
  if (/^\d+$/.test(t)) return true;
  return false;
}
