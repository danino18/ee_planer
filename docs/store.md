# Zustand Store Rules

## Location
`src/store/planStore.ts` — uses `zustand/middleware` `persist` to serialize state to localStorage.

## Critical: Do Not Break Persistence

### Rules
- The `_history`, `_initKey`, and `isSwitchingTrack` fields are ephemeral — intentionally excluded via the `partialize` option. Never add them to the persisted shape.
- `savedTracks: Record<string, StudentPlan>` IS persisted. Changing its type or key shape will silently lose user data on reload.
- Never rename persisted top-level fields without providing a migration function in the `persist` config.
- `REPEATABLE_COURSES` is a `Set` of course IDs that may appear in multiple semesters simultaneously. These require special handling in `addCourseToSemester` and related actions.
- Grade storage key for repeatable courses: `courseId_semester`. For regular courses: `courseId`.

### Safe Changes
- Adding new ephemeral fields (excluded via `partialize`) is safe.
- Adding new actions (functions) is always safe.
- Adding a new persisted field is safe only if you provide a default value so existing stored state still deserializes correctly.

### Do Not
- **Never change** the `name` option in `persist({ name: ... })` — that is the localStorage key. Changing it clears all user plans.
- Do not wrap or replace the `persist` middleware without preserving existing behavior.
