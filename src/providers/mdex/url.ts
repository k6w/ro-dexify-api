export function buildMdexUrl(word: string): string {
  const u = new URL('https://m.dex.ro/');
  u.searchParams.set('word', word);
  return u.toString();
}
