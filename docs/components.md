# Component Conventions

## RTL / Hebrew
- All UI text is Hebrew. The root element has `dir="rtl"`.
- Never swap `left`/`right` Tailwind utilities when fixing RTL bugs — use `start`/`end` logical properties instead (e.g., `ps-4` not `pl-4`, `ms-2` not `ml-2`).
- Never translate or paraphrase Hebrew strings. Copy them exactly from existing code or task instructions.

## Tailwind v4
- Import style: `@import "tailwindcss"` in a CSS file. There is no `tailwind.config.js`.
- Dynamic class names must use complete strings (no string interpolation like `` `text-${color}-500` ``), or they won't be detected by the scanner.

## Project Structure
- `src/components/` — React UI components
- `src/hooks/` — custom React hooks (data fetching, derived state)
- `src/context/` — React context (Auth only)

## Key Components
- `SemesterGrid.tsx` — top-level semester layout, uses @dnd-kit for drag-and-drop
- `SemesterColumn.tsx` — individual semester column
- `CourseCard.tsx` — draggable course card
- `RequirementsPanel.tsx` — shows progress from domain/generalRequirements
- `GeneralRequirements/` — sub-panel for מל"גים, sport, English
- `SpecializationPanel.tsx` — elective specialization selector

## Do Not
- Do not add inline styles for layout/spacing — use Tailwind.
- Do not add new context providers except for genuinely global cross-tree state.
- Do not lift state into context that already lives in the Zustand store.
- No hooks in conditions or loops (react-hooks/rules-of-hooks).
