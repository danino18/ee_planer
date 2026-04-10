# SAP Data Sync

## Source
Live course data: `https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages/`

Files follow the pattern: `courses_{year}_{semester}.json`
- Semester codes: 200 = winter, 201 = spring, 202 = summer

## In-App Fetching
`src/services/sapApi.ts` fetches the JSON at runtime (not bundled). Results are cached in a module-level `Map`. Do not add persistent caching (IndexedDB, localStorage) without discussing cache invalidation.

## Prerequisite Parsing
SAP data encodes prerequisites in Hebrew: split on `" או "` (OR), then extract 8-digit IDs within each group (AND). The parsing function is `parsePrerequisites` in `sapApi.ts`. Do not change this without verifying against real SAP data.

## General Requirements Sync Script
`scripts/sync-general-requirements.mjs` fetches from Technion UG portal and writes to `src/data/generalRequirements/`. Run via `npm run sync:general-requirements` or automatically as part of `npm run build`.

## Do Not
- Do not hardcode course lists that come from SAP — they change each semester.
- Do not change the BASE_URL without updating the allowed domains in `.claude/settings.local.json`.
