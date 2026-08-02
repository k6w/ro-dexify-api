# Phonetics

How the API produces IPA, syllables and stress.

## Why compute anything

Wiktionary is the only source that publishes IPA, and it covers a small fraction
of the language, of the eight words in the test corpus, five had usable Romanian
IPA.

Romanian orthography is close to phonemic: given the spelling, the pronunciation
is almost always derivable. So a transcription is computed for **every** word,
and it also drives the [espeak TTS tier](../api/pronunciation.md), which is fed
these phonemes rather than the raw spelling.

## It is checked against real data

The rules are verified against the IPA Wiktionary independently records:

| word | computed | ro.wiktionary |
|---|---|---|
| casă | `/ˈka.sə/` | `/ˈka.sə/` |
| copil | `/koˈpil/` | `/koˈpil/` |
| oaie | `/ˈo̯a.je/` | `/ˈo̯a.je/` |
| merge | `/ˈmer.d͡ʒe/` | `/ˈmer.ʤe/` |

Matching a human-edited source is the point: it means the rules agree with
someone else, not just with themselves.

## The rules

### Vowels

`a→a`  `ă→ə`  `â→ɨ`  `î→ɨ`  `e→e`  `i→i`  `o→o`  `u→u`

`â` and `î` are the same sound; the spelling differs by position in the word.

### Consonants

Mostly one-to-one. The ones that are not:

| Spelling | Sound | Note |
|---|---|---|
| `c` before `e`, `i` | `t͡ʃ` | `ceas` = `/t͡ʃas/` |
| `c` elsewhere | `k` | |
| `g` before `e`, `i` | `d͡ʒ` | `ger` |
| `g` elsewhere | `ɡ` | |
| `ch`, `gh` | `k`, `ɡ` | the `h` is never a sound |
| `ș` | `ʃ` | |
| `ț` | `t͡s` | |
| `j` | `ʒ` | |
| `x` | `ks` | |

**The softening vowel disappears.** In `ceas`, the `e` only tells you the `c` is
soft, it is not pronounced. `/t͡ʃas/`, not `/t͡ʃeas/`.

### Diphthongs

**Rising**: the first vowel becomes a glide, before an open vowel:

`ea → e̯a`  `oa → o̯a`  `ia → ja`  `ie → je`  `iu → ju`

`floare` = `/ˈflo̯a.re/`

**Falling**: a close vowel *after* a nucleus becomes the glide:

`ou → ow`  `ui → uj`  `ai → aj`  `au → aw`

`ou` = `/ow/`, `lui` = `/luj/`

Getting this backwards is the classic mistake: treating every vowel-before-vowel
as rising gives `/ˈo̯u/` for `ou`, which is wrong.

**Identical adjacent vowels are hiatus, not a diphthong.** `știință` is
`/ʃtiˈin.t͡sə/`: three syllables.

### Final `-i`

A word-final `i` after a consonant is not a syllable. It palatalises:

`lupi` = `/lupʲ/`, `pomi` = `/pomʲ/`: one syllable each.

### Initial `e`

In a closed set of pronouns and forms of *a fi*: `eu, el, ea, ei, ele, este,
era…`: initial `e` is `/je/`. Everywhere else it is `/e/`.

## Syllabification

Applied to phonemes, not letters, which avoids the traps: `ch` is one sound,
`ea` is one syllable, final `-i` is none.

- **V-CV**: one consonant between vowels joins the following syllable: `ca-să`
- **VC-CV**: two consonants split…
- **…except muta cum liquida**: a stop or fricative plus `l`/`r` stays together:
  `ta-blou`, not `tab-lou`
- **VC-CCV**: with three or more, the first joins the preceding syllable

A semivowel between two nuclei is the onset of the following syllable: `oaie`
divides `oa-ie`.

## Stress

**Romanian stress is not predictable from spelling.** This is the least reliable
thing the API produces, and it says so.

Where a dictionary marks it, that is used:

- DOOM underlines the stressed vowel in its markup
- DEXonline writes an apostrophe before it: `C'ASĂ`

Both are parsed into `stressMark` (the lemma with an acute accent: `cásă`), and
the transcription reports `stressOrigin: "attested"`.

Otherwise the common pattern applies, penultimate for vowel-final words, final
for consonant-final ones, and the result is `stressOrigin: "derived"`. Treat
those as a guess.

The mark is placed by character index, not by counting vowels: in `oaie` the
letter `o` is the second vowel but the glide `/o̯/`, so counting vowels puts the
stress on the wrong syllable.

Monosyllables carry no stress mark, by convention: `/ow/`, not `/ˈow/`.

## Derived transcriptions never overwrite attested ones

If Wiktionary published IPA for a word, that is what you get. The computed
transcription is not added alongside it.

## Using it

```bash
curl -s 'localhost:3000/v2/word/oaie?merge' | jq '.entries[0].pronunciations'
```

```json
[{ "ipa": "/ˈo̯a.je/", "syllabification": "oa-ie", "stressMark": "oáie" }]
```
