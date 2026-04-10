# Technion EE Study Planner — Project Rules

## Tech Stack
- React 19 + TypeScript, Vite 8
- Tailwind CSS v4 — `@import "tailwindcss"` in CSS + `@tailwindcss/vite` plugin. NO tailwind.config.js.
- Zustand 5 with localStorage persistence
- @dnd-kit for drag-and-drop
- Firebase (Firestore + Cloud Functions) — keys in `.env.local`

## Commands
- `npm run dev` — dev server (port 5173)
- `npm run build` — sync requirements + tsc + vite build
- `npm run lint` — ESLint

## Key Constraints (Things That Will Bite You)
- UI is in Hebrew (RTL). **Never touch Hebrew strings.**
- 4 tracks: חשמל, מחשבים, חשמל+מתמטיקה, חשמל+פיזיקה
- **Never rename** the `persist({ name: ... })` key in the Zustand store — that is the localStorage key.
- `src/data/generalRequirements/` is script-generated. Do not hand-edit it.
- Tailwind v4: no string interpolation in class names (dynamic classes won't scan).

## Detailed Docs
- Store + persistence → `docs/store.md`
- Requirements engine → `docs/domain.md`
- Component/RTL conventions → `docs/components.md`
- Deploy workflow → `docs/deploy.md`
- SAP data sync → `docs/data-sync.md`

## Memory
- Session state lives in the auto-memory system at:
  `~/.claude/projects/C--Users-eyald-OneDrive---Technion-planer-ee/memory/current_focus.md`
- Check it at session start. Update before ending or switching context.
- Do NOT look for `memory/current_focus.md` at the project root — it does not exist there.
