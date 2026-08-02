# Wiktionary (ro.wiktionary.org)

The Romanian Wiktionary — community-edited, freely licensed.

- Site: <https://ro.wiktionary.org>
- Licence: CC BY-SA 4.0
- Cache: 3 days · Rate limit: 250 ms
- Provider id: `wiktionary`

## What it gives

- definitions
- **IPA** — the only source that publishes a human-written transcription
- etymology
- full declension / conjugation from templates
- gender
- synonyms, and separately derived terms and compounds

## Example

```bash
curl -s 'localhost:3000/v2/word/casă/wiktionary' | jq '.entries[0] | {
  partOfSpeech, gender,
  ipa: .pronunciations[0].ipa,
  etymology: .etymology.text,
  inflections: (.inflections|length),
  senses: (.senses|length)
}'
```

```json
{
  "partOfSpeech": "substantiv",
  "gender": "feminin",
  "ipa": "/ˈka.sə/",
  "etymology": "Din latină casa.",
  "inflections": 8,
  "senses": 10
}
```

## Only the Romanian section

Wiktionary puts every language sharing a spelling on one page. `ou` has Romanian,
Catalan, English and French sections. Only `=={{limba|ron}}==` is read — without
that, the Romanian word came back with English and French IPA.

## Senses vs derived terms

A Wiktionary page lists senses, and separately derived terms, compounds,
synonyms and hypernyms. **Only the `#` lines under the part-of-speech section
are senses.**

For `casă` that is 10 senses. `acasă`, `casnic`, `căscioară`, `casă de bani` are
derived terms and compounds — they appear in `derived` and `compounds`, never in
`senses`.

## The markup it actually uses

Romanian Wiktionary uses Romanian template names, not the English ones:

| Purpose | Template |
|---|---|
| Part of speech | `{{-substantiv-\|ron}}`, `{{-verb-\|ron}}` |
| Gender | `{{f}}`, `{{m}}`, `{{n}}` |
| IPA | `{{AFI\|/'ka.sə/}}` — *Alfabetul Fonetic Internațional*, **not** `{{IPA}}` |
| Etymology | `{{-etimologie-}}` |
| Declension | `{{substantiv-ron\|nom-sg=casă\|nom-pl=case\|…}}` |
| Conjugation | `{{verb-ron\|inf=merge\|ind=merg\|conj=meargă\|part=mers\|cj=III}}` |
| Synonyms | `{{-sin-}}` |

## IPA normalisation

Editors type an ASCII apostrophe for stress; IPA uses `ˈ` (U+02C8). Transcriptions
are normalised on the way in, so `{{AFI|/'ka.sə/}}` becomes `/ˈka.sə/`.

## No audio

Romanian Wiktionary almost never carries pronunciation audio — of the eight words
in the test corpus, exactly one had an `{{audio}}` template and it pointed at the
**French** recording. Audio comes from Wikimedia Commons instead; see
[Pronunciation](../api/pronunciation.md).

## robots.txt

Wikimedia's `robots.txt` disallows `/w/` and `/api/`, which covers the API this
provider uses. That rule stops search engines indexing dynamic wiki pages;
`api.php` is the interface Wikimedia documents for programmatic access and
rate-limits itself.

This provider is therefore marked `robotsPolicy: 'official-api'` and skips the
robots check for that one endpoint. The descriptive User-Agent and rate limit
still apply. It is the only such exemption, and a test enforces that.

**Wikimedia returns 403 without a descriptive User-Agent**, so `USER_AGENT` is
required, not merely polite.

## Caveats

- Community-edited: coverage and quality vary by word.
- Some words have no Romanian section at all.
- Sense text can be terse compared with DEXonline.
