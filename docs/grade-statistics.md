# Grade Statistics

Historical average/median grades per course and semester, imported from the public
`michael-maltsev/technion-histograms` data that [CheeseFork](https://cheesefork.cf/)
consumes. This is **separate from and does not affect** the SAP sync.

## Data source & format

- Discovery manifest: the `gh-pages` branch `README.md`, listing courses as
  `[<8digit> - <name>](<8digit>/)`.
- Per-course file: `<base>/<8digit>/index.min.json`.
  - Default base: `https://raw.githubusercontent.com/michael-maltsev/technion-histograms/gh-pages`
    (CheeseFork's `https://michael-maltsev.github.io/technion-histograms/...` serves the same
    data; override with `--base` or `GRADE_STATS_BASE`).
- Shape: top-level keyed by semester code (`YYYY01` winter / `YYYY02` spring / `YYYY03`
  summer); each semester maps category → fields, plus a non-grade `Staff` array (skipped).
- Fields are **JSON strings**: `students`, `passFail` (`"passed/failed"`), `passPercent`,
  `min`, `max`, `average`, `median`. `min`/`max` may exceed 100 (exam bonuses). `404` ⇒ no data.

## What we store

A **minimal** dataset in `public/grade-statistics.json` (generated — do not hand-edit),
keyed by canonical 8-digit course number, one record per semester holding only the
**primary** category:

```json
{ "semester": "202401", "category": "Finals", "average": 72.166, "median": 73, "students": 528 }
```

Primary-category priority: `Finals` → `Final_A` → `Exam_A` (CheeseFork convention; chosen
at import time per semester).

### Validation

- `average` / `median` / `passPercent` must be 0–100, else that **field** becomes `null`
  (reported, never `0`). Out-of-range `min`/`max` do **not** discard a record.
- A semester record is kept only if it has a valid average or median.
- `NaN` / `Infinity` / empty / placeholder values → `null`.
- Course numbers are normalized via `normalizeCourseNumberStrict` (`AAABBB → 0AAA0BBB`,
  never `padStart`); malformed identifiers are rejected and reported.

## Running the sync

```bash
npm run sync:grade-statistics            # full sync → writes public/grade-statistics.json
node scripts/sync-grade-statistics.mjs --dry-run            # report only, no write
node scripts/sync-grade-statistics.mjs --limit 50           # first 50 courses
node scripts/sync-grade-statistics.mjs --courses 234114,044101   # specific courses
node scripts/sync-grade-statistics.mjs --base <url> --concurrency 16
```

The script fetches with timeout, limited concurrency and retry/backoff, treats `404` as
"no data", and prints a report (courses checked / with stats / without, records
inserted/updated/unchanged, fields nulled, request failures with reasons, and the
generated-JSON raw/minified/gzip sizes). It is **not** part of `npm run build` so the
build never depends on GitHub.

## App usage

`src/services/gradeStatistics.ts` fetches the committed JSON once (same-origin) and indexes
it by course number. Pure logic lives in `src/domain/gradeStatistics/` (`parse`, `select`,
`semester`, `filters`, `index`). If the dataset fails to load, the catalog still works and
grade-dependent controls are hidden/disabled. The statistics semester selector
(`Latest available` default, or a specific semester) drives display, filtering and sorting
via one shared resolution function. `Latest available` may resolve to a different semester
per course, so the semester is always shown next to the value.
