# Accuracy

What to trust, and how the API tells you.

## The one rule

**A dictionary said it, or software worked it out.** Those are different things
and every field that could be either says which.

| Marker | Meaning |
|---|---|
| `origin: "attested"` | A dictionary published this |
| `origin: "derived"` | A rule in this API produced it |
| `confidence: "high"` / `"low"` | How much the rule trusts itself |
| `stressOrigin` | Same distinction, for stress |

If you display data to users, prefer attested values, and consider labelling
derived ones.

```bash
curl -s 'localhost:3000/v2/word/casă?merge' \
  | jq '.entries[0].inflections[] | { form, origin, confidence }'
```

## What is attested

- **Definitions, senses, examples, citations**: always from a dictionary. This
  API never writes a definition.
- **Etymology**: from a dictionary.
- **Relations** (synonyms, diminutives, …): from DEXonline's curated tree.
- **Inflections from DOOM, DEXonline or Wiktionary**: published forms.
- **Paradigm tables**: DEXonline's own tables, read as a grid.
- **Stress**: DOOM marks the stressed vowel; DEXonline uses an apostrophe.
  Where either is present, `stressOrigin` is `"attested"`.
- **IPA from Wiktionary**: where an editor wrote one.

## What is derived

- **IPA for words no source transcribes.** Romanian spelling is near-phonemic,
  so a transcription is computed. Verified against every IPA in the test corpus
 : see [Phonetics](../phonetics/README.md): but it is a rule, not a record.
- **Syllabification**, unless DOOM published it.
- **Stress with `stressOrigin: "derived"`.** Romanian stress is not predictable
  from spelling. The common pattern is applied and marked low confidence. **This
  is the single least reliable thing the API produces.**
- **`/v1/pluralize` output** and **`/v1/conjugate` where `source` is `rules`**.
- **Conjugations for irregular verbs outside the table** -
  see [Conjugation](../api/conjugation.md).

## Attested beats derived

A derived value never overwrites an attested one:

- If Wiktionary published IPA, the computed one is not added.
- If a dictionary marked the stress, that placement is used.
- Under [`?merge`](../api/word-lookup.md#merge), an attested inflection displaces
  a derived duplicate, and a known `partOfSpeech` beats `unknown`.

## Which source wins

When entries disagree, the higher `authority` supplies the scalar fields
(part of speech, gender, etymology). Lists are combined. See
[Ranking](ranking.md).

Authority is about *currency and normative status*, not correctness: DOOM 3
(2021) outranks Șăineanu (1929) because it reflects today's standard, not
because Șăineanu was wrong for its time.

## Known limits

- **Derived stress is a guess** where no dictionary marks it.
- **Rule-based conjugation** misses stem alternations for irregular verbs not in
  the table.
- **Search only covers cached entries**: see [Search](../api/search.md).
- **Human audio is whoever recorded it.** Commons has no speaker-gender
  metadata, so `?voice` cannot filter it, see
  [Pronunciation](../api/pronunciation.md#choosing-a-voice).

## Checking for yourself

Every entry carries `source.url`. Open it and compare.

```bash
curl -s 'localhost:3000/v2/word/casă' | jq -r '.entries[] | "\(.source.sourceName // .source.providerName)\t\(.source.url)"'
```
