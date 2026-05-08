export function buildDlrUrl(word: string): string {
  return `https://dlr1.solirom.ro/index.php?cuv=${encodeURIComponent(word)}`;
}
