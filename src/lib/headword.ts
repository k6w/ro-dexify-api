export function normalizeHeadword(input: string): string {
  return input.normalize('NFC').trim().toLocaleLowerCase('ro-RO');
}

export function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ș/g, 's')
    .replace(/ş/g, 's')
    .replace(/ț/g, 't')
    .replace(/ţ/g, 't')
    .replace(/Ș/g, 'S')
    .replace(/Ş/g, 'S')
    .replace(/Ț/g, 'T')
    .replace(/Ţ/g, 'T');
}

export function asciiFold(input: string): string {
  return stripDiacritics(input).toLowerCase();
}

export function isValidHeadword(input: string): boolean {
  if (!input || input.length > 64) return false;
  return /^[\p{L}\p{M}'\-\s]+$/u.test(input);
}

export interface SplitHeadword {
  /** The lemma with its homonym index and trailing punctuation removed. */
  lemma: string;
  /** 1-based homonym index where the source distinguished them, e.g. casă¹. */
  homonymIndex?: number;
}

/**
 * Separate a lemma from the homonym index fused onto it.
 *
 * Every source writes this differently and each provider had grown its own
 * version: DOOM puts it in a `<sup>`, DEXonline writes `casă^1` or `casă^{3}`
 * in internalRep, and m.dex.ro renders it straight into the text as `CÁSĂ1,`.
 * The last of those also carries trailing punctuation, and stripping the digits
 * before the comma leaves the digit in place -- which is how "CÁSĂ1," survived
 * as a headword.
 */
export function splitHomonym(raw: string): SplitHeadword {
  let text = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  let index: number | undefined;

  // Alternate until neither a trailing digit nor trailing punctuation applies,
  // so any order of "casă1," and "casă,1" resolves.
  for (;;) {
    const trimmed = text.replace(/[,;:.\s]+$/, '');
    // The index must follow a letter. Allowing any non-digit turned
    // "COVID-19" into lemma "COVID-" with homonym 19.
    const m = trimmed.match(/^(.*\p{L})(\d+)$/u);
    if (m?.[1] !== undefined && m[2] !== undefined) {
      index ??= Number(m[2]);
      text = m[1];
      continue;
    }
    if (trimmed === text) break;
    text = trimmed;
  }

  const lemma = text.trim();
  return index !== undefined && lemma ? { lemma, homonymIndex: index } : { lemma };
}
