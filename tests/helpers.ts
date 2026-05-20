/**
 * Shared test helpers.
 */

/**
 * Return the first element, failing the test with a useful message when the
 * array is empty.
 *
 * Replaces the `entries[0]!` non-null assertions: when a parser regresses to
 * returning nothing, `entries[0]!` fails with "Cannot read properties of
 * undefined", which says nothing about which parser broke.
 */
export function firstOrThrow<T>(items: readonly T[], what = 'item'): T {
  const first = items[0];
  if (first === undefined) {
    throw new Error(`expected at least one ${what}, got an empty array`);
  }
  return first;
}
