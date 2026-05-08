export function buildDexonlineUrl(word: string): string {
  return `https://dexonline.ro/definitie/${encodeURIComponent(word)}`;
}
