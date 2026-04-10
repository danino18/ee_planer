# Deploy Workflow

## Firebase Hosting + Cloud Functions

### Prerequisites
- `.env.local` must exist with all `VITE_FIREBASE_*` keys
- Firebase CLI available via `npx firebase-tools`

### Full Deploy (hosting + functions)
```bash
npm run build
npx firebase-tools deploy
```

### Hosting Only
```bash
npm run build
npx firebase-tools deploy --only hosting
```

### Functions Only
```bash
cd functions && npm run build
npx firebase-tools deploy --only functions
```

### Build Details
`npm run build` runs two steps:
1. `node scripts/sync-general-requirements.mjs` — fetches latest requirement lists from Technion UG portal
2. `npx tsc -b && npx vite build` — TypeScript compile + Vite bundle

### Notes
- Output goes to `dist/`. Never commit `dist/`.
- Functions source is in `functions/src/`, built to `functions/lib/`.
- `firestore.rules` and `firestore.indexes.json` are deployed separately via `--only firestore`.
- If TypeScript errors appear in the build output, fix them before deploying.
