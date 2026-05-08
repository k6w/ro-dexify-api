export function buildDoomUrl(word: string): string {
  return `https://doom.lingv.ro/cautare/q/${encodeURIComponent(word)}`;
}
