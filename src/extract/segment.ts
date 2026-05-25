/**
 * Bracket-aware splitting for dictionary prose.
 *
 * Dictionary entries nest parentheticals inside comma-separated lists, so a
 * naive `split(',')` tears them apart. DOOM's entry for `casă` is the canonical
 * example:
 *
 *   casă s. f., g.-d. art. casei; pl. case (dar: Casa Corpului Didactic,
 *   Casa Regală a României s. proprii f. art.)
 *
 * Splitting that on "," put "Casa Corpului Didactic" in the same token as
 * "pl. case", and the plural-form rule then emitted `case`, `dar:`, `Casa`,
 * `Corpului` and `Didactic` as five plural forms of "casă".
 *
 * These helpers only split at depth 0.
 */

const OPENERS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '„': '”',
  '«': '»',
};
const CLOSERS = new Set(Object.values(OPENERS));

/**
 * Split `input` on any of `separators`, ignoring separators nested inside
 * brackets or quotes. Empty segments are dropped and each result is trimmed.
 */
export function splitTopLevel(input: string, separators: readonly string[]): string[] {
  const seps = new Set(separators);
  const out: string[] = [];
  const stack: string[] = [];
  let inDoubleQuote = false;
  let current = '';

  for (const ch of input) {
    if (ch === '"') {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }
    if (!inDoubleQuote) {
      if (OPENERS[ch]) {
        stack.push(OPENERS[ch]);
        current += ch;
        continue;
      }
      if (CLOSERS.has(ch)) {
        // Tolerate unbalanced input: only pop when it actually matches.
        if (stack[stack.length - 1] === ch) stack.pop();
        current += ch;
        continue;
      }
      if (stack.length === 0 && seps.has(ch)) {
        const trimmed = current.trim();
        if (trimmed) out.push(trimmed);
        current = '';
        continue;
      }
    }
    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) out.push(trimmed);
  return out;
}

/**
 * Remove every bracketed group, leaving the surrounding text.
 *
 * Used to strip editorial asides ("(dar: ...)", "(insectă)", "(crustaceu)")
 * before a token is read as a word form.
 */
export function stripBracketed(input: string): string {
  const stack: string[] = [];
  let out = '';
  for (const ch of input) {
    if (OPENERS[ch]) {
      stack.push(OPENERS[ch]);
      continue;
    }
    if (CLOSERS.has(ch) && stack[stack.length - 1] === ch) {
      stack.pop();
      continue;
    }
    if (stack.length === 0) out += ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Return the contents of each top-level bracketed group, in order.
 *
 * DOOM puts syllabification and domain hints in these: "(desp. -li-e-)",
 * "(insectă)".
 */
export function bracketedGroups(input: string): string[] {
  const out: string[] = [];
  const stack: string[] = [];
  let current = '';
  for (const ch of input) {
    if (OPENERS[ch]) {
      if (stack.length > 0) current += ch;
      stack.push(OPENERS[ch]);
      continue;
    }
    if (CLOSERS.has(ch) && stack[stack.length - 1] === ch) {
      stack.pop();
      if (stack.length === 0) {
        const t = current.trim();
        if (t) out.push(t);
        current = '';
      } else {
        current += ch;
      }
      continue;
    }
    if (stack.length > 0) current += ch;
  }
  return out;
}
