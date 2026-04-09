# Technion EE Study Planner — Project Rules

## What This Is
Hebrew React + TypeScript web app for Technion Faculty 04 (EE & CS) students to plan their degree.
Location: `C:\Users\eyald\OneDrive - Technion\planer_ee`

## Tech Stack (exact versions matter)
- React 19 + TypeScript, Vite 8
- Tailwind CSS v4 — uses `@import "tailwindcss"` in CSS + `@tailwindcss/vite` plugin
  - NO tailwind.config.js. Do not create one.
- Zustand with localStorage persistence
- @dnd-kit for drag-and-drop
- Firebase (Firestore + Cloud Functions)

## Dev Server
```
node node_modules/vite/bin/vite.js   # port 5173
```

## Data Sources
- Static track data bundled in app (from Technion PDF catalog)
- Live SAP course data: `https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages/`

## Key Constraints
- UI is in Hebrew (RTL). Preserve Hebrew text exactly.
- 4 degree tracks: חשמל, מחשבים, חשמל+מתמטיקה, חשמל+פיזיקה
- Requirements tracker must correctly categorize: mandatory, elective, מל"גים, sport, English
- Do not break localStorage persistence logic (Zustand store)

## Session Start
- Check memory/current_focus.md for current task and blockers before starting.
- Update current_focus.md when done or when switching context.
