# Concepts

The words used throughout these docs and in every response.

## Word, headword, lemma

- **Word**: what you asked for, exactly as you typed it.
- **Lemma**: the dictionary form of a word. `case`, `casei` and `casele` are
  all forms of the lemma `casă`.
- **Headword**: the lemma as this API keys it: lowercased and Unicode-normalised.
  `displayHeadword` keeps the original capitalisation, which is why you will see
  `CASĂ` from DEX and `casă` from DOOM for the same word.

## Entry

One dictionary's account of one word. A lookup returns **several entries**,
because several dictionaries have something to say.

An entry is not a word, it is *a source's description of a word*. Two entries
for `casă` from DEX '09 and DOOM 3 are both correct and differ in what they
cover: DOOM has stress and inflections but no definitions, DEX has definitions
but no stress.

Use [`?merge`](api/word-lookup.md#merge) to get one combined entry instead.

## Sense

One meaning. `casă` has senses for the building, the household, the dynasty and
the cash desk. Senses are numbered as the dictionary numbered them.

In `/v2` a sense is a **tree**: a sense can have children that are examples,
expressions, locutions or narrower sub-senses. In `/v1` that tree is flattened
into a list. See [Versions](api/versions.md).

## Homonym

Two different words spelled the same. Dictionaries write these `casă¹`, `casă²`.
Where a source distinguishes them, the entry carries `homonymIndex`.

`casă¹` (building) and `casă²` (cash desk) are different words, not different
senses of one word.

## Inflection

A grammatical form of the lemma: `case` (plural), `casei` (genitive/dative),
`casele` (plural articulated). Each carries `tags` naming what it is, plus
`origin` and `confidence`: see [Accuracy](data/accuracy.md).

Romanian nouns take a suffixed definite article, so `casa` ("the house") is an
inflected form, not a separate word. That is what the `articulated` tag means.

## Paradigm

The complete table of a word's forms. `paradigm.cells` is that table; each cell
has `tags` and one or more `forms`.

`inflections` is the flat list, `paradigm` the structured table. Both come from
the same data when a source publishes a full table.

## Provider vs source

- **Provider**: a piece of this software that talks to one website
  (`doom`, `dexonline`, `wiktionary`…). What `?sources=` selects.
- **Source / contributing dictionary**: the actual dictionary a definition came
  from (`DEX '09`, `MDA2`, `Scriban`). What `?dict=` selects.

One provider can return many sources: DEXonline aggregates 32 dictionaries.
This trips people up constantly, so: `?sources=dexonline&dict=DEX '09` means
"ask the DEXonline provider, but only give me DEX '09 definitions".

## Attested vs derived

- **Attested**: a dictionary said this.
- **Derived**: a rule in this software worked it out.

Both are useful; conflating them is not. Every field that can be either says
which. [Accuracy](data/accuracy.md) covers this properly.

## Authority

A 0–100 score for how much weight a contributing dictionary carries. DOOM 3 and
DEX '09 are current and normative (95+); Șăineanu (1929) and Scriban (1939) are
historical (12–14). Used to order results and to decide which value wins when
entries merge. See [Ranking](data/ranking.md).

## IPA, stress, syllabification

- **IPA**: the International Phonetic Alphabet: `/ˈka.sə/`. One symbol, one sound.
- **Stress**: which syllable is emphasised. The `ˈ` mark goes *before* the
  stressed syllable. Romanian stress is not predictable from spelling, which is
  why it is taken from a dictionary where possible.
- **Syllabification**: where the word divides: `ca-să`.

See [Phonetics](phonetics/README.md).
