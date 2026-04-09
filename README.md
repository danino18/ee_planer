# Technion Planner EE

A production-style study planner for Technion students that turns degree planning into a visual, interactive workflow.

The project is built for Electrical Engineering and related tracks at the Technion, with a semester board, live requirement tracking, specialization guidance, and cloud-synced plans. The interface itself is primarily in Hebrew, while the codebase and project documentation are ready for GitHub and collaboration.

## Overview

Technion Planner EE helps students answer practical planning questions:

- What should I place in each semester?
- Am I meeting mandatory, elective, English, sport, and general requirements?
- Which specialization chains already fit the courses in my plan?
- What happens if I move a course or add a summer semester?
- Can I keep the same plan synced across devices?

Instead of treating the degree sheet as a static document, the app turns it into a working planning environment.

## Core Features

- Drag-and-drop semester planning
- Multiple supported tracks:
  - Electrical Engineering
  - Computer Science
  - Electrical Engineering + Mathematics
  - Electrical Engineering + Physics
  - Combined Electrical Engineering
  - Computer Engineering
- Search by course name or course number
- Favorite courses and quick add flow
- Automatic prerequisite parsing and warnings
- Credit progress tracking across core degree requirement categories
- Weighted average calculation from entered grades
- English requirement tracking based on score and selected courses
- Specialization selection plus recommendation hints from the current plan
- Real-time cloud save and sync with Firebase
- Google and Microsoft authentication
- Firestore rules and backend-side validation for safer persistence

## Why This Project Feels Serious

- It includes both the frontend planner and the Firebase backend, not just a UI shell
- It uses live course data aggregation from Technion SAP-derived public datasets
- It handles legacy-course edge cases and local overrides for real academic planning
- It includes authentication, persistence, security rules, API routing, and deployment config
- It is structured as an actual maintainable app, with separated state, domain logic, hooks, services, and backend routes

## Stack

| Layer | Main Tools |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| State | Zustand |
| Interaction | dnd-kit |
| Auth + Data | Firebase Auth, Firestore |
| Backend | Firebase Functions, Express |
| Hosting | Firebase Hosting |

## How The App Works

1. The frontend fetches course information from a Technion SAP-based public data source.
2. The user selects a track and organizes courses into semester columns.
3. Planner logic computes prerequisites, progress, averages, specializations, and other degree signals locally.
4. When signed in, the plan is stored in Firestore and synchronized in real time.
5. Firebase Hosting serves the frontend, while `/api/**` requests are routed to the backend function.

## Project Structure

```text
.
|-- src/                 Frontend application
|   |-- components/      Planner UI, semester grid, search, requirement panels
|   |-- context/         Authentication context
|   |-- data/            Track definitions, specialization data, rule tables
|   |-- domain/          Planning/domain-specific helpers
|   |-- hooks/           Progress, averages, recommendations
|   |-- services/        SAP fetcher, Firebase setup, cloud sync
|   `-- store/           Zustand planner state
|-- functions/           Firebase Functions backend
|   |-- src/routes/      plans, admin, ai endpoints
|   |-- src/security/    HTTP hardening and plan validation
|   `-- src/services/    Backend helpers
|-- public/              Static assets
|-- firestore.rules      Firestore access rules
`-- firebase.json        Hosting, Functions, and rewrite configuration
```

## Running Locally

### Prerequisites

- Node.js 20+ for the frontend
- Node.js 24 for Firebase Functions, matching `functions/package.json`
- Firebase CLI for emulators and deployment work

### Install dependencies

```bash
npm install
npm --prefix functions install
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
VITE_FUNCTIONS_BASE_URL=...
```

For the backend, copy `functions/.env.example` to `functions/.env` and fill in the relevant values for local development.

### Start development servers

Frontend:

```bash
npm run dev
```

Functions emulator:

```bash
npm --prefix functions run serve
```

Production build:

```bash
npm run build
```

## Deployment

- Frontend output is generated into `dist/`
- Firebase Hosting serves the single-page app
- Requests to `/api/**` are rewritten to the `api` Cloud Function
- Firestore access control is defined in `firestore.rules`
- Provider secrets should be stored via Firebase Secret Manager, not committed into the repository

## Notes

- The UI is primarily Hebrew because the target audience is Technion students
- Course metadata is assembled from a public Technion SAP mirror
- Some legacy courses and special academic cases are patched locally so older plans stay usable
- The repository currently includes frontend, backend, hosting, and security configuration in one place
