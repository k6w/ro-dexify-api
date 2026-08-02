# DOOM 3

**Dicționarul ortografic, ortoepic și morfologic al limbii române**: the
normative Romanian orthographic dictionary, published by the Institutul de
Lingvistică „Iorgu Iordan – Al. Rosetti".

- Site: <https://doom.lingv.ro>
- Licence: **CC BY-NC-SA 4.0, non-commercial only**
- Cache: 30 days · Rate limit: 1500 ms
- Provider id: `doom`

## What it gives

The authority on **how a word is written, stressed and inflected**:

- stress (which vowel is emphasised)
- syllabification, where non-obvious
- inflected forms, declensions and verb paradigms
- part of speech and gender

## What it does not give

**Definitions.** DOOM entries always have `senses: []`. That is correct, not a
bug, it is an orthographic dictionary. Meanings come from
[DEXonline](dexonline.md) or [Wiktionary](wiktionary.md).

## Example

```bash
curl -s 'localhost:3000/v1/word/casă/doom' | jq '.entries[0]'
```

```json
{
  "headword": "casă",
  "partOfSpeech": "substantiv",
  "inflections": [
    { "form": "casei", "tags": ["genitive", "dative", "articulated"] },
    { "form": "case",  "tags": ["plural"] }
  ],
  "pronunciations": [
    { "ipa": "/ˈka.sə/", "syllabification": "ca-să", "stressMark": "cásă" }
  ],
  "senses": []
}
```

## How it is read

The page is a normal HTML document with **TEI XML embedded inline**, one
`<root><entry>` block per result. Everything useful is in the markup rather than
the prose:

- the lemma is the first bold span; a `<sup>` carries the homonym index
- each inflected form is its own italic span
- **the stressed vowel is wrapped in an underline span**: this is the only
  place DOOM states stress, and flattening the HTML to text destroys it
- syllabification is a `title` attribute on a tooltip span

Forms are matched to their grammatical labels by position, with bracket depth
tracked over the text so editorial asides are excluded. DOOM writes things like:

```
casă s. f., g.-d. art. casei; pl. case (dar: Casa Corpului Didactic, …)
```

That parenthetical is a note about proper nouns, not a list of plurals.

DOOM also elides a repeated tense: `perf. s. 1 sg. mersei, 1 pl. merserăm` -
so mood and tense carry forward into bare person/number labels.

## Matching

Lemma matching is **exact**. A search for `casă` returns `casă` only, not
`casă-muzeu` or `molie-de-casă`, even though the site lists them.

## Caveats

- DOOM marks syllabification only where it is non-obvious. `casă` has none; the
  value you see comes from [derived phonetics](../phonetics/README.md).
- The result page may report more matches than it serves.
- **Non-commercial licence.** Check before using commercially.
