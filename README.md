# Technion Planner EE

![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-ffca28?logo=firebase&logoColor=black)
![License](https://img.shields.io/badge/License-Private-lightgrey)

An interactive degree-planning app for Technion students, focused on Electrical Engineering and related tracks.

Technion Planner EE turns a static curriculum sheet into a working planning environment: students can build semester plans with drag and drop, track degree progress in real time, compare multiple plan versions, and keep everything synced across devices with Firebase. The product UI is primarily in Hebrew, while the codebase and documentation are maintained in English.

## Features

- Drag-and-drop semester planning with an unassigned pool, summer semesters, undo, and reset-to-recommended-plan flows.
- Multiple supported tracks with track-specific defaults and saved state when switching between tracks.
- Fast course search by name or course number, favorites, and quick add-to-semester actions.
- Search filters for English-taught courses, MELAG, free electives, and teaching semester availability.
- Course detail modal with prerequisites, manual prerequisite-path selection, course substitutions, grades, binary pass/fail, SAP deep links, and CheeseFork review summaries.
- Real-time degree tracking for mandatory credits, faculty electives, total credits, labs, sport/PE, general electives, free electives, and English requirements.
- Weighted average calculation from entered grades, including support for binary courses that should not affect the GPA.
- Track-specific specialization catalogs, completion progress, double specialization support, and recommendation hints based on the current plan.
- Support for the robotics minor and the entrepreneurship minor, including eligibility and progress feedback.
- Up to 4 named plan versions with side-by-side comparison and an option to show only the differences.
- Google and Microsoft sign-in with Firebase Auth.
- Real-time cloud sync with Firestore, including payload sanitization, migration handling, and conflict-safe hydration.

## Supported Tracks

- Electrical Engineering
- Computer Science
- Electrical Engineering + Mathematics
- Electrical Engineering + Physics
- Combined Electrical Engineering
- Computer Engineering

## Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8 |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| State | Zustand 5 with localStorage persistence |
| Interaction | `@dnd-kit` |
| Auth + Cloud Data | Firebase Auth, Firestore |
| Backend | Firebase Functions, Express |
| Hosting | Firebase Hosting |

## What The App Does

### Planning workspace

- Lets students organize courses into semester columns with drag and drop.
- Supports regular and summer semesters, semester reordering, and per-semester warnings.
- Keeps an unassigned pool for courses that are relevant but not yet scheduled.

### Degree intelligence

- Computes requirement coverage across core degree categories.
- Handles English requirements using score-based rules and course-level tracking.
- Supports lab pools, core-release overrides to specialization chains, and repeatable-course handling.
- Surfaces specialization and minor progress directly in the main planning flow.

### Versioning and sync

- Stores the plan as a versioned envelope instead of a single flat plan.
- Lets users branch their plan into multiple named variants and compare them side by side.
- Syncs signed-in users through Firestore snapshots for cross-device updates.

### Backend and security

- Uses Firestore rules and client-side sanitization for direct planner persistence.
- Includes Firebase Functions routes for protected `/api/plans`, `/api/admin`, `/api/ai`, and `/api/health` endpoints.
- Applies rate limiting, auth checks, admin checks, request validation, and security headers in the Functions layer.

Note: the main planner sync path currently writes directly to Firestore from the client. The Functions API is used for protected backend routes and extensibility, not as the primary save path for the planner UI.

## Repository Layout

```text
.
|-- src/
|   |-- components/      Planner UI, semester board, search, requirements, versions
|   |-- context/         Authentication context
|   |-- data/            Tracks, requirement lists, minors, teaching-semester overrides
|   |-- domain/          Requirement and specialization engines
|   |-- hooks/           Progress, averages, minors, recommendations
|   |-- services/        SAP fetcher, Firebase setup, sync, validation, external data
|   |-- store/           Zustand planner state
|   |-- types/           Shared app types
|   `-- utils/           Comparison, grades, faculty colors, helper logic
|-- functions/
|   `-- src/
|       |-- middleware/  Auth and admin checks
|       |-- routes/      plans, admin, ai
|       |-- security/    HTTP hardening and payload validation
|       `-- services/    Firestore and AI helpers
|-- scripts/             Validation, bundle checks, generated-data sync
|-- tests/               Automated test coverage
|-- firestore.rules      Firestore access rules
`-- firebase.json        Hosting, headers, rewrites, and Functions config
```

## Data Sources

- Course catalog data is fetched client-side from the public [technion-sap-info-fetcher](https://github.com/michael-maltsev/technion-sap-info-fetcher) dataset.
- The app adds local overrides for legacy courses, semester availability, course-credit fixes, and requirement-specific edge cases so older or irregular plans remain usable.
- Course detail cards can also show CheeseFork review aggregates when that public data is available.

## Getting Started

### Prerequisites

- Node.js 20+ for the frontend toolchain
- Node.js 24 for Firebase Functions, matching `functions/package.json`
- Firebase CLI for emulators and deployment

### Install dependencies

```bash
npm ci
npm --prefix functions ci
```

### Configure environment variables

Create `.env.local` in the project root:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
# Optional: override the Functions base URL for custom deployments or local setups
VITE_FUNCTIONS_BASE_URL=...
```

For Firebase Functions:

1. Copy `functions/.env.example` to `functions/.env`
2. Fill in the values you need for local development

The Functions env template includes:

- `ADMIN_UIDS`
- `ALLOWED_ORIGINS`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

### Run locally

Frontend:

```bash
npm run dev
```

Functions emulator:

```bash
npm --prefix functions run serve
```

### Production build

```bash
npm run build
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run typecheck` | Type-check the frontend |
| `npm run build` | Sync generated requirement data, type-check, and build the app |
| `npm run lint` | Lint the frontend |
| `npm run test` | Run tests |
| `npm run perf:bundle` | Build and enforce the bundle budget |
| `npm run build:functions` | Build Firebase Functions |
| `npm run lint:functions` | Lint Firebase Functions |
| `npm run check` | Run the repo's full local validation workflow |
| `npm run sync:general-requirements` | Regenerate `generatedCourseLists.ts` from the source rules |

## Deployment

- Firebase Hosting serves the frontend from `dist/`.
- `/api/**` requests are rewritten to the `api` Firebase Function.
- Global security headers are configured in `firebase.json`.
- Firestore rules and indexes are defined in `firestore.rules` and `firestore.indexes.json`.

## Notes

- The UI is primarily Hebrew because the app is built for Technion students.
- The planner includes frontend, backend, data-processing logic, and deployment configuration in one repo.
- The README is intentionally aligned with the current codebase rather than a wishlist of planned features.
