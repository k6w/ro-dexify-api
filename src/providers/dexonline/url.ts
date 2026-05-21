export function buildDexonlineUrl(word: string): string {
  return `https://dexonline.ro/definitie/${encodeURIComponent(word)}`;
}

/**
 * DEXonline's JSON endpoint: same path with `/json` appended.
 *
 * Returns `{ type: 'searchResults', word, definitions[] }` where each definition
 * carries a structured `internalRep` (DEXonline's own markup: `@bold@`,
 * `$italic$`, `#abbrev#`, `'` before the stressed vowel, `^n` homonym index)
 * plus an `htmlRep` with semantic classes. Far more reliable to parse than the
 * rendered page, and ~35% smaller on the wire.
 *
 * Unknown words return HTTP 404 with an empty `definitions` array.
 */
export function buildDexonlineJsonUrl(word: string): string {
  return `${buildDexonlineUrl(word)}/json`;
}
