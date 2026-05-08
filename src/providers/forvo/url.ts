export function buildForvoUrl(word: string, apiKey: string): string {
  return `https://apifree.forvo.com/key/${encodeURIComponent(apiKey)}/format/json/action/word-pronunciations/word/${encodeURIComponent(word)}/language/ro`;
}
