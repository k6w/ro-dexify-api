/**
 * Live upstream drift check.
 *
 * Fetches each source for real and runs the current parsers over the bytes,
 * asserting the invariants the golden tests assert against recorded fixtures.
 * When a site redesigns, this fails here rather than silently returning empty
 * entries to users.
 *
 * Deliberately NOT part of `pnpm test`: it makes real network requests, is
 * subject to upstream availability, and honours per-host crawl delays, so it
 * takes tens of seconds. Run it on a schedule.
 *
 *   pnpm check:live
 */
import { fetchText } from '../src/http/client.js';
import { getLogger } from '../src/lib/logger.js';
import { parseDexonline } from '../src/providers/dexonline/parse.js';
import { buildDexonlineJsonUrl } from '../src/providers/dexonline/url.js';
import { parseDoom } from '../src/providers/doom/parse.js';
import { buildDoomUrl } from '../src/providers/doom/url.js';
import { parseWiktionary } from '../src/providers/wiktionary/parse.js';
import { buildWiktionaryUrl } from '../src/providers/wiktionary/url.js';
import { liftEntries } from '../src/schema/adapters/lift.js';
import type { EntryV2 } from '../src/schema/entry-v2.js';

const UA = 'ro-dexify-api/2.0 (+drift-check; non-commercial)';

interface Check {
  name: string;
  url: string;
  minIntervalMs: number;
  parse: (body: string) => EntryV2[];
  /** Invariants that must hold; each returns an error message or undefined. */
  expect: Array<(entries: EntryV2[]) => string | undefined>;
}

const has = (label: string, ok: boolean): string | undefined =>
  ok ? undefined : `expected ${label}`;

const CHECKS: Check[] = [
  {
    name: 'doom/casă',
    url: buildDoomUrl('casă'),
    minIntervalMs: 1500,
    parse: (b) => liftEntries(parseDoom(b, 'casă'), { authority: 98 }),
    expect: [
      (e) => has('at least one entry', e.length > 0),
      (e) => has('headword casă', e[0]?.headword === 'casă'),
      (e) => has('partOfSpeech substantiv', e[0]?.partOfSpeech === 'substantiv'),
      (e) => has('gender feminin', e[0]?.gender === 'feminin'),
      (e) => has('stress mark', Boolean(e[0]?.pronunciations[0]?.stressMark)),
      (e) =>
        has(
          'inflections case + casei',
          ['case', 'casei'].every((f) => e[0]?.inflections.some((i) => i.form === f)),
        ),
      (e) =>
        has(
          'no abbreviation fragments as forms',
          !e.some((x) => x.inflections.some((i) => /^(s|art|pl|g)\.?$/i.test(i.form))),
        ),
    ],
  },
  {
    name: 'dexonline/casă',
    url: buildDexonlineJsonUrl('casă'),
    minIntervalMs: 2000,
    parse: (b) => parseDexonline(b, 'casă'),
    expect: [
      (e) => has('at least one entry', e.length > 0),
      (e) => has("DEX '09 ranked first", e[0]?.source.sourceName === "DEX '09"),
      (e) => has('several numbered senses', (e[0]?.senses.length ?? 0) >= 5),
      (e) => has('etymology', Boolean(e[0]?.etymology?.text)),
      (e) => has('stress mark', Boolean(e[0]?.pronunciations[0]?.stressMark)),
      (e) =>
        has(
          'no markup sigils in sense text',
          !e.some((x) => x.senses.some((s) => /[@$#%]/.test(s.text))),
        ),
    ],
  },
  {
    name: 'wiktionary/casă',
    url: buildWiktionaryUrl('casă'),
    minIntervalMs: 250,
    parse: (b) => liftEntries(parseWiktionary(b, 'casă'), { authority: 65 }),
    expect: [
      (e) => has('exactly one entry', e.length === 1),
      (e) => has('partOfSpeech substantiv', e[0]?.partOfSpeech === 'substantiv'),
      (e) => has('gender feminin', e[0]?.gender === 'feminin'),
      (e) => has('IPA', Boolean(e[0]?.pronunciations.some((p) => p.ipa?.includes('ka')))),
      (e) => has('etymology', Boolean(e[0]?.etymology?.text)),
      (e) => has('declension forms', (e[0]?.inflections.length ?? 0) >= 6),
      (e) =>
        has(
          'derived terms are not senses',
          !(e[0]?.senses.some((s) => s.text === 'acasă' || s.text === 'casnic') ?? false),
        ),
    ],
  },
];

async function main(): Promise<void> {
  const logger = getLogger();
  let failures = 0;

  for (const check of CHECKS) {
    await new Promise((r) => setTimeout(r, check.minIntervalMs));
    let body: string;
    try {
      const res = await fetchText({
        url: check.url,
        headers: { 'user-agent': UA, accept: '*/*', 'accept-language': 'ro,en;q=0.7' },
        retries: 1,
        logger,
      });
      if (res.status >= 400) {
        console.error(`FAIL ${check.name}: HTTP ${res.status}`);
        failures++;
        continue;
      }
      body = res.body;
    } catch (err) {
      console.error(`FAIL ${check.name}: ${(err as Error).message}`);
      failures++;
      continue;
    }

    let entries: EntryV2[];
    try {
      entries = check.parse(body);
    } catch (err) {
      console.error(`FAIL ${check.name}: parser threw — ${(err as Error).message}`);
      failures++;
      continue;
    }

    const problems = check.expect.map((fn) => fn(entries)).filter(Boolean);
    if (problems.length > 0) {
      console.error(`FAIL ${check.name} (${entries.length} entries)`);
      for (const p of problems) console.error(`       ${p}`);
      failures++;
    } else {
      console.log(`ok   ${check.name} (${entries.length} entries)`);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} of ${CHECKS.length} upstream checks failed — markup has drifted.`);
    console.error('Re-record fixtures with `pnpm fixtures:refresh` and inspect the diff.');
    process.exit(1);
  }
  console.log(`\nAll ${CHECKS.length} upstream checks passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
