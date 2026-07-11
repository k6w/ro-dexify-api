/**
 * Human pronunciation recordings from Wikimedia Commons.
 *
 * This is the best audio the project can offer: real speakers, free, no API
 * key. Two naming conventions cover it —
 *
 *   File:Ro-<word>.oga|ogg|wav          hand-uploaded, e.g. Ro-casă.oga
 *   File:LL-Q7913 (ron)-<speaker>-<word>.wav   Lingua Libre mass recordings
 *
 * Category:Lingua Libre pronunciation-ron held 24,088 files when this was
 * written, so coverage of ordinary vocabulary is good.
 *
 * ro.wiktionary is *not* a source: of the eight recorded fixture words exactly
 * one had an {{audio}} template and it pointed at Fr-ou.ogg — the French word.
 *
 * Licences vary per file (public domain through CC BY-SA), so `license` and
 * `attribution` are read per result and must travel with the bytes.
 */
import { loadConfig } from '../config.js';
import { fetchText } from '../http/client.js';
import { runOnHost } from '../http/ratelimit.js';
import type { Logger } from '../lib/logger.js';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const HOST = 'commons.wikimedia.org';
const RATE = { minIntervalMs: 250, concurrency: 2 };

export interface HumanRecording {
  /** Direct upload.wikimedia.org URL. */
  url: string;
  mime: string;
  license: string;
  attribution: string;
  /** Commons page title, for provenance. */
  file: string;
}

interface ImageInfoResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        missing?: string;
        imageinfo?: Array<{
          url?: string;
          mime?: string;
          extmetadata?: Record<string, { value?: string }>;
        }>;
      }
    >;
  };
}

interface SearchResponse {
  query?: { search?: Array<{ title: string }> };
}

/** Commons keeps titles with the first letter capitalised and spaces as _. */
function fileTitle(name: string): string {
  return `File:${name.replace(/\s+/g, '_')}`;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function callApi(params: Record<string, string>, logger: Logger): Promise<string> {
  const url = new URL(COMMONS_API);
  for (const [k, v] of Object.entries({ ...params, format: 'json', formatversion: '2' })) {
    url.searchParams.set(k, v);
  }
  const res = await runOnHost(HOST, RATE, () =>
    fetchText({
      url: url.toString(),
      // Wikimedia returns 403 to requests without a descriptive User-Agent
      // (https://w.wiki/4wJS), so this is required, not politeness.
      headers: { accept: 'application/json', 'user-agent': loadConfig().USER_AGENT },
      retries: 1,
      logger,
    }),
  );
  return res.status < 400 ? res.body : '';
}

function readImageInfo(body: string): HumanRecording | undefined {
  let parsed: ImageInfoResponse;
  try {
    parsed = JSON.parse(body) as ImageInfoResponse;
  } catch {
    return undefined;
  }
  const pages = parsed.query?.pages;
  if (!pages) return undefined;

  for (const page of Object.values(pages)) {
    if (page.missing !== undefined) continue;
    const info = page.imageinfo?.[0];
    if (!info?.url) continue;
    const meta = info.extmetadata ?? {};
    return {
      url: info.url,
      mime: info.mime ?? 'application/ogg',
      license: stripHtml(meta.LicenseShortName?.value ?? '') || 'unknown',
      attribution: stripHtml(meta.Artist?.value ?? '') || 'Wikimedia Commons contributors',
      file: page.title ?? '',
    };
  }
  return undefined;
}

/**
 * Find a human recording of `word`, or undefined when Commons has none.
 *
 * Tries the direct `Ro-<word>` naming first because those files are curated
 * and usually the cleanest, then falls back to a search that also picks up the
 * Lingua Libre corpus.
 */
export async function findHumanRecording(
  word: string,
  logger: Logger,
): Promise<HumanRecording | undefined> {
  const w = word.normalize('NFC').trim();
  if (!w) return undefined;

  const direct = ['oga', 'ogg', 'wav', 'mp3'].map((ext) => fileTitle(`Ro-${w}.${ext}`));
  const byTitle = await callApi(
    {
      action: 'query',
      titles: direct.join('|'),
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
    },
    logger,
  );
  const found = byTitle ? readImageInfo(byTitle) : undefined;
  if (found) return found;

  // Lingua Libre titles embed a speaker name, so they can only be found by
  // search: "LL-Q7913 (ron)-<speaker>-<word>.wav".
  const searched = await callApi(
    {
      action: 'query',
      list: 'search',
      srsearch: `intitle:"(ron)" intitle:"${w}" filetype:audio`,
      srnamespace: '6',
      srlimit: '5',
    },
    logger,
  );
  if (!searched) return undefined;

  let hits: string[] = [];
  try {
    const parsed = JSON.parse(searched) as SearchResponse;
    hits = (parsed.query?.search ?? []).map((s) => s.title);
  } catch {
    return undefined;
  }

  // Only accept a file whose name ends with the exact word: an "intitle" match
  // on "casa" also returns "casandra" and "Ro-casă-căsuță".
  const exact = hits.find((t) => new RegExp(`[-_]${escapeRegex(w)}\\.[a-z0-9]+$`, 'i').test(t));
  if (!exact) return undefined;

  const info = await callApi(
    {
      action: 'query',
      titles: exact,
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
    },
    logger,
  );
  return info ? readImageInfo(info) : undefined;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
