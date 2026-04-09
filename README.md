# Technion Planner EE

A visual degree planner for Technion students that helps build, review, and sync a personalized study plan across semesters.

The app is focused on Electrical Engineering and related tracks, with a drag-and-drop semester board, requirement progress tracking, specialization planning, cloud sync, and live course data pulled from Technion SAP sources.

## What The App Includes

- Semester planning with drag-and-drop course placement
- Support for multiple tracks:
  - Electrical Engineering
  - Computer Science
  - Electrical Engineering + Mathematics
  - Electrical Engineering + Physics
  - Combined Electrical Engineering track
  - Computer Engineering
- Course search by name or course number
- Favorites and quick add-to-semester flow
- Automatic prerequisite parsing and prerequisite warnings
- Progress tracking for mandatory, elective, total-credit, lab, sport, English, and general requirements
- Weighted average calculation
- Specialization selection and matching recommendations based on the current plan
- Cloud save and real-time sync with Firebase
- Google and Microsoft sign-in
- Firestore rules and backend validation for plan data

## Tech Stack

| Layer | Main Tools |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| State | Zustand |
| UI interactions | dnd-kit |
| Auth + Database | Firebase Auth, Firestore |
| Backend | Firebase Functions, Express |
| Hosting | Firebase Hosting |

## How It Works

The frontend loads course data from the Technion SAP course dataset, lets the user organize courses into semesters, and computes plan progress locally.

When a user signs in, the planner saves the current plan to Firestore and keeps it synchronized in real time across sessions and devices. The Firebase Functions layer provides API routes, admin endpoints, AI-related routes, and security middleware for hosted environments.

## Repository Structure

```text
.
|-- src/                 Frontend application
|   |-- components/      Planner UI, semester grid, search, requirements panels
|   |-- context/         Authentication context
|   |-- data/            Track definitions, specialization data, general requirement rules
|   |-- hooks/           Progress, average, and recommendation logic
|   |-- services/        SAP fetcher, Firebase setup, cloud sync
|   `-- store/           Zustand planner state
|-- functions/           Firebase Functions backend
|   |-- src/routes/      plans, admin, and ai endpoints
|   |-- src/security/    HTTP hardening and plan validation
|   `-- src/services/    Backend helpers
|-- public/              Static assets
|-- firestore.rules      Firestore access rules
`-- firebase.json        Hosting, Functions, and rewrite configuration
```

## Local Development

### Prerequisites

- Node.js 20+ for the frontend
- Node.js 24 for Firebase Functions, matching `functions/package.json`
- Firebase CLI if you want to run emulators or deploy

### 1. Install dependencies

```bash
npm install
npm --prefix functions install
```

### 2. Configure environment variables

Create a local `.env.local` file in the project root for the frontend:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FUNCTIONS_BASE_URL=...
```

For Firebase Functions, copy `functions/.env.example` to `functions/.env` and fill in the relevant values for local work.

### 3. Run the app

Frontend:

```bash
npm run dev
```

Functions emulator:

```bash
npm --prefix functions run serve
```

Build the frontend:

```bash
npm run build
```

## Deployment Notes

- The frontend is built into `dist/`
- Firebase Hosting serves the SPA and rewrites `/api/**` to the `api` Cloud Function
- Firestore security rules live in `firestore.rules`
- Production secrets for AI providers should be managed through Firebase Secret Manager, not committed files

## Product Notes

- The interface content is primarily in Hebrew
- Course data is fetched from the public Technion SAP data mirror used by the app
- Some legacy and special-case courses are patched locally so older plans remain usable

## Status

This repository already contains both the planner frontend and the Firebase backend needed to run it as a real application, not just a UI mockup.
