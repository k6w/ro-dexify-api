# Romanian Vocabulary API

Clean, structured JSON API for Romanian word lookups with SQLite caching. It fetches from:
- DOOM (doom.lingv.ro)
- DEXonline (dexonline.ro)
- m.dex.ro (DEX)

No raw HTML in responses. Definitions are normalized, deduplicated, and enriched with word type, gender, examples, and etymology.

## Highlights

- 🔎 Multiple sources: DOOM, DEXonline, m.dex.ro
- 🧼 Clean JSON: no `<sup>`, `<span>` or raw markup
- � SQLite caching (fast, offline-friendly)
- 🧠 Smart parsing and duplicate consolidation
- 📊 Search and stats endpoints
- 🌐 CORS-enabled REST API

## Quick start (Windows PowerShell)

```powershell
# Install dependencies
npm install

# Start the API (default: http://localhost:3000)
npm start

# Or run in dev mode with auto-restart
npm run dev

# Change port (e.g., 3001) for current shell session
$env:PORT = 3001; npm start
```

## Endpoints

### GET `/api/word/:word`
Query the dictionaries for a word.

Query params:
- `source` (optional): `doom` | `dexonline` | `mdex` (default: all)
- `refresh` (optional): `true` forces refetch (ignores cache)

Examples:
- `/api/word/casă`
- `/api/word/casă?source=dexonline`
- `/api/word/casă?refresh=true`

Response (sanitized example):
```json
{
  "word": "casă",
  "results": [
    {
      "word": "casă",
      "source": "dexonline",
      "definitions": [
        {
          "type": "dexonline_definition",
          "word": "casă",
          "wordType": "substantiv",
          "gender": "feminin",
          "grammaticalInfo": { "plural": "case" },
          "definitions": [
            "Clădire care servește drept locuință."
          ],
          "examples": [
            "A cumpărat o casă la țară."
          ],
          "etymology": "Lat. casa.",
          "notes": [] ,
          "source": "DEX '09 (2009)",
          "index": 0
        }
      ],
      "url": "https://dexonline.ro/definitie/casă",
      "parsedAt": "2025-09-21T10:00:00.000Z",
      "cached": false
    }
  ],
  "cached": false,
  "timestamp": "2025-09-21T10:00:00.000Z"
}
```

Notes:
- No `html` fields are returned.
- Headwords are normalized (e.g., `CASĂ1` → `casă`).
- Definitions and examples are plain text.

### GET `/api/search/:term`
Search cached words in SQLite.

Example: `/api/search/cas`

### GET `/api/stats`
Database stats (totals, by source, recent activity).

### GET `/api/test/parse/:word`
Test parsing with local HTML snapshots in the repository (`return-*.html`).

### GET `/api/docs`
Discover endpoints and usage.

### GET `/health`
Simple health check.

## How it works

1) First request for a word → fetch from sources → parse & clean → save to SQLite → return JSON.

2) Next requests for the same word → returned from cache instantly (unless `refresh=true`).

3) Normalized definition objects include:
- `word`, `wordType`, `gender`, `grammaticalInfo`
- `definitions[]`, `examples[]`, `etymology`, `notes[]`
- `source`, `index` (position within the page)

## Project structure

- `server.js` – Express server and endpoints
- `database.js` – SQLite helper and schema
- `parser.js` – Parsers for DOOM, DEXonline, m.dex.ro
- `return-*.html` – Local snapshots for parser testing
- `vocabulary.db` – Generated SQLite cache (gitignored)

## Development

```powershell
# Run tests (lightweight harness)
npm test

# Dev mode with hot reload
npm run dev
```

## Database & persistence

- SQLite file: `vocabulary.db` (created at project root)
- This file is not committed to git (see `.gitignore`).

## Contributing

Issues and PRs are welcome. If you add a source or tweak parsing, please:
- Keep responses HTML-free and normalized.
- Add a brief note in the README (sources/features).
- Avoid committing local DB files or secrets.

## License

MIT (see `LICENSE`).

## Acknowledgements

- DOOM (doom.lingv.ro)
- DEXonline (dexonline.ro)
- m.dex.ro