/**
 * Minimal wikitext rendering, scoped to what ro.wiktionary entries contain.
 *
 * wtf_wikipedia renders prose well but flattens the structure this parser needs
 * (which section a list belongs to, whether a line is `#` or `#:`), which is how
 * derived terms and compounds ended up in the sense list. These helpers keep the
 * structure and only render the inline markup.
 */

/** Strip inline wikitext markup, leaving readable plain text. */
export function renderWikitext(input: string): string {
  let s = input;

  // [[target|label]] -> label ; [[target]] -> target
  s = s.replace(/\[\[([^\]|]+)\|([^\]]*)\]\]/g, '$2');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1');

  // Inline templates that render as their own text or as nothing useful.
  s = s.replace(/\{\{\s*AFI\s*\}\}/gi, '');
  s = s.replace(/\{\{\s*(?:trad|trad\+)\s*\|[^|}]*\|([^}|]*)[^}]*\}\}/gi, '$1');
  s = s.replace(/\{\{[^{}]*\}\}/g, '');

  // Bold/italic quotes.
  s = s.replace(/'{2,5}/g, '');

  // HTML comments and refs.
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  s = s.replace(/<\/?[a-z][^>]*>/gi, '');

  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Parse the named parameters of a template invocation, e.g.
 * `{{substantiv-ron|gen={{f}}|nom-sg=casă|…}}`.
 *
 * Returns undefined when the template is not present. Nested braces are
 * tracked so `gen={{f}}` yields `{{f}}` rather than terminating the scan.
 */
export function templateParams(
  wikitext: string,
  templateName: string,
): Record<string, string> | undefined {
  const start = wikitext.search(
    new RegExp(`\\{\\{\\s*${templateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  );
  if (start === -1) return undefined;

  let depth = 0;
  let end = -1;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') {
      depth++;
      i++;
      continue;
    }
    if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--;
      i++;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return undefined;

  const body = wikitext.slice(start + 2, end - 2);
  const params: Record<string, string> = {};

  // Split on top-level "|" only.
  const segments: string[] = [];
  let current = '';
  let d = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{' && body[i + 1] === '{') {
      d++;
      current += '{{';
      i++;
      continue;
    }
    if (ch === '}' && body[i + 1] === '}') {
      d--;
      current += '}}';
      i++;
      continue;
    }
    if (ch === '|' && d === 0) {
      segments.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  segments.push(current);

  for (const seg of segments.slice(1)) {
    const eq = seg.indexOf('=');
    if (eq === -1) continue;
    const key = seg.slice(0, eq).trim();
    const value = seg.slice(eq + 1).trim();
    if (key) params[key] = value;
  }
  return params;
}

/**
 * Return only the `=={{limba|<code>}}==` section of a page.
 *
 * ro.wiktionary documents every language that shares a spelling on one page:
 * `ou` carries ron, cat, eng and fra sections. Scanning the whole page made the
 * English and French IPA come back as pronunciations of the Romanian word.
 *
 * Falls back to the whole text when the page has no language headings.
 */
export function languageSection(wikitext: string, code = 'ron'): string {
  const heading = /^==\s*\{\{\s*limba\s*\|\s*([a-z]{2,3})\s*\}\}\s*==\s*$/gim;
  const marks: Array<{ code: string; start: number; end: number }> = [];
  for (const m of wikitext.matchAll(heading)) {
    if (m.index === undefined || !m[1]) continue;
    marks.push({ code: m[1].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  if (marks.length === 0) return wikitext;

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    if (!mark || mark.code !== code) continue;
    const next = marks[i + 1];
    return wikitext.slice(mark.end, next?.start ?? wikitext.length);
  }
  return '';
}

export interface WikiSection {
  /** Section marker without the delimiters, e.g. "-substantiv-" or "-sin-". */
  name: string;
  /** Argument after the pipe, e.g. "ron" in {{-substantiv-|ron}}. */
  arg?: string;
  lines: string[];
}

/**
 * Split ro.wiktionary wikitext into its `{{-name-}}` sections.
 *
 * Content before the first marker is returned under the name "" so nothing is
 * silently dropped.
 */
export function splitSections(wikitext: string): WikiSection[] {
  const out: WikiSection[] = [];
  let current: WikiSection = { name: '', lines: [] };

  for (const line of wikitext.split('\n')) {
    const m = line.match(/^\{\{(-[a-zăâîșț0-9]+-)(?:\|([^}]*))?\}\}\s*$/i);
    if (m?.[1]) {
      out.push(current);
      current = m[2] ? { name: m[1], arg: m[2], lines: [] } : { name: m[1], lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  out.push(current);
  return out.filter((s) => s.name !== '' || s.lines.some((l) => l.trim()));
}
