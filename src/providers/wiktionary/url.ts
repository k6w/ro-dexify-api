export function buildWiktionaryUrl(word: string): string {
  const u = new URL('https://ro.wiktionary.org/w/api.php');
  u.searchParams.set('action', 'parse');
  u.searchParams.set('page', word);
  u.searchParams.set('prop', 'wikitext|sections');
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  u.searchParams.set('redirects', '1');
  return u.toString();
}
