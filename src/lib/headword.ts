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
