/**
 * Shared test helpers.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { asciiFold } from '../src/lib/headword.js';

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

/** Mirrors the slug rule in scripts/refresh-fixtures.ts. */
function slug(word: string): string {
  const folded =
    asciiFold(word)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'word';
  if (folded === word) return folded;
  return `${folded}-${createHash('sha256').update(word.normalize('NFC')).digest('hex').slice(0, 6)}`;
}

const EXT: Record<string, 'html' | 'json'> = {
  doom: 'html',
  dexonline: 'json',
  'dexonline-html': 'html',
  mdex: 'html',
  wiktionary: 'json',
};

/**
 * Read a recorded fixture by provider and word.
 *
 * Addressing by word rather than filename keeps tests readable and keeps the
 * `casă` / `casa` pair (which fold to the same ASCII slug) unambiguous.
 */
export function fixture(provider: keyof typeof EXT | string, word: string): string {
  const ext = EXT[provider];
  if (!ext) throw new Error(`unknown fixture provider "${provider}"`);
  const path = resolve('tests/fixtures', provider, `${slug(word)}.${ext}`);
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `missing fixture for ${provider}/${word} at ${path} -- run: pnpm fixtures:refresh`,
    );
  }
}
