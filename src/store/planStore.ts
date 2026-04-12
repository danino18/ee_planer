import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackId, StudentPlan } from '../types';
import { eeTrack } from '../data/tracks/ee';
import { csTrack } from '../data/tracks/cs';
import { eeMathTrack } from '../data/tracks/ee_math';
import { eePhysicsTrack } from '../data/tracks/ee_physics';
import { eeCombinedTrack } from '../data/tracks/ee_combined';
import { ceTrack } from '../data/tracks/ce';
import {
  getTrackSpecializationCatalog,
  sanitizeTrackSpecializationSelections,
} from '../domain/specializations';

interface PlanState extends StudentPlan {
  // Ephemeral — NOT persisted
  _history: StudentPlan[];
  _initKey: number;
  isSwitchingTrack: boolean;
  // Persisted extra
  savedTracks: Record<string, StudentPlan>;

  setTrack: (trackId: TrackId) => void;
  beginTrackSwitch: () => void;
  finishTrackSwitch: () => void;
  addCourseToSemester: (courseId: string, semester: number) => void;
  removeCourseFromSemester: (courseId: string, semester: number) => void;
  moveCourse: (courseId: string, fromSemester: number, toSemester: number) => void;
  toggleCompleted: (courseId: string) => void;
  toggleCompletedInstance: (instanceKey: string) => void;
  toggleSpecialization: (groupId: string) => void;
  toggleFavorite: (courseId: string) => void;
  setGrade: (courseId: string, grade: number | null, semester?: number) => void;
  setSubstitution: (fromId: string, toId: string | null) => void;
  setSelectedPrereqGroup: (courseId: string, group: string[] | null) => void;
  addSemester: () => void;
  addSummerSemester: () => void;
  removeSemester: () => void;
  removeSummerSemester: () => void;
  setCurrentSemester: (n: number | null) => void;
  moveSemesterInOrder: (sem: number, direction: 'left' | 'right') => void;
  setSemesterType: (sem: number, type: 'winter' | 'spring') => void;
  toggleSemesterWarnings: (sem: number) => void;
  toggleDoubleSpecialization: (groupId: string) => void;
  toggleEnglishExemption: () => void;
  setBinaryPass: (courseId: string, value: boolean | null) => void;
  setMiluimCredits: (n: number | null) => void;
  setCoreToChainOverrides: (ids: string[]) => void;
  setEnglishScore: (score: number | null) => void;
  toggleEnglishTaughtCourse: (courseId: string) => void;
  setFacultyColorOverride: (faculty: string, colorKey: string) => void;
  reorderSemesters: (newOrder: number[]) => void;
  loadPlan: (plan: StudentPlan) => void;
  resetPlan: () => void;
  resetToDefault: () => void;
  undo: () => void;
}

// Courses that can appear in multiple semesters simultaneously (pool-style)
export const REPEATABLE_COURSES = new Set([
  '03940900', '03940901', '03940902', '03940800',
]);

// Maximum number of semesters a student can have (including summer semesters)
export const MAX_SEMESTERS = 16;

// Returns the grade storage key for a course.
// For repeatable courses placed in a specific semester, uses courseId_semester
// so each instance can have its own grade.
export function gradeKey(courseId: string, semester?: number): string {
  return REPEATABLE_COURSES.has(courseId) && semester !== undefined && semester > 0
    ? `${courseId}_${semester}`
    : courseId;
}

const DEFAULT_SEMESTERS = 8;
const DEFAULT_ORDER = Array.from({ length: DEFAULT_SEMESTERS }, (_, i) => i + 1);
const DEFAULT_SEMESTER_MAP: Record<number, string[]> = { 0: [] };
for (let i = 1; i <= DEFAULT_SEMESTERS; i++) DEFAULT_SEMESTER_MAP[i] = [];

const CE_REMOVED_RECOMMENDED_COURSES: Record<number, string[]> = {
  4: ['01140073'],
};

const TRACKS = [eeTrack, csTrack, eeMathTrack, eePhysicsTrack, eeCombinedTrack, ceTrack];

// Sport/PE pool courses auto-placed in the unassigned column on first load.
// Empty: sport appears in the recommended schedule (semesterSchedule); נבחרת users add it manually.
export const AUTO_SEEDED_POOL_IDS: string[] = [];

const AUTO_SEEDED_COURSES_BY_TRACK = Object.fromEntries(
  TRACKS.map((track) => [
    track.id,
    new Set([
      ...track.semesterSchedule.flatMap(({ courses }) => courses),
      ...AUTO_SEEDED_POOL_IDS,
    ]),
  ]),
) as Record<TrackId, Set<string>>;

function clearDismissedCourse(
  dismissedRecommendedCourses: Record<string, string[]> | undefined,
  trackId: TrackId | null,
  courseId: string,
): Record<string, string[]> {
  if (!trackId) return dismissedRecommendedCourses ?? {};

  const current = dismissedRecommendedCourses?.[trackId] ?? [];
  if (!current.includes(courseId)) return dismissedRecommendedCourses ?? {};

  const next = { ...(dismissedRecommendedCourses ?? {}) };
  const filtered = current.filter((id) => id !== courseId);
  if (filtered.length > 0) next[trackId] = filtered;
  else delete next[trackId];
  return next;
}

function markDismissedCourse(
  dismissedRecommendedCourses: Record<string, string[]> | undefined,
  trackId: TrackId | null,
  courseId: string,
): Record<string, string[]> {
  if (!trackId) return dismissedRecommendedCourses ?? {};
  const autoSeeded = AUTO_SEEDED_COURSES_BY_TRACK[trackId];
  if (!autoSeeded?.has(courseId)) return dismissedRecommendedCourses ?? {};

  const current = dismissedRecommendedCourses?.[trackId] ?? [];
  if (current.includes(courseId)) return dismissedRecommendedCourses ?? {};

  return {
    ...(dismissedRecommendedCourses ?? {}),
    [trackId]: [...current, courseId],
  };
}

const initialState: StudentPlan = {
  trackId: null,
  semesters: { ...DEFAULT_SEMESTER_MAP },
  completedCourses: [],
  selectedSpecializations: [],
  favorites: [],
  grades: {},
  substitutions: {},
  maxSemester: DEFAULT_SEMESTERS,
  selectedPrereqGroups: {},
  summerSemesters: [],
  currentSemester: null,
  semesterOrder: [...DEFAULT_ORDER],
  semesterTypeOverrides: {},
  semesterWarningsIgnored: [],
  doubleSpecializations: [],
  hasEnglishExemption: false,
  manualSapAverages: {},
  binaryPass: {},
  miluimCredits: undefined,
  englishScore: undefined,
  englishTaughtCourses: [],
  facultyColorOverrides: {},
  completedInstances: [],
  dismissedRecommendedCourses: {},
  coreToChainOverrides: [],
};

function applyPlanMigrations(plan: StudentPlan): StudentPlan {
  const migrated: StudentPlan = {
    ...plan,
    semesters: { ...plan.semesters },
    savedTracks: plan.savedTracks ? { ...plan.savedTracks } : plan.savedTracks,
    dismissedRecommendedCourses: { ...(plan.dismissedRecommendedCourses ?? {}) },
  };

  if (migrated.trackId === 'ce') {
    for (const [semester, courseIds] of Object.entries(CE_REMOVED_RECOMMENDED_COURSES)) {
      const sem = Number(semester);
      const existing = migrated.semesters[sem] ?? [];
      migrated.semesters[sem] = existing.filter((id) => !courseIds.includes(id));
    }
  }

  if (migrated.savedTracks?.ce) {
    migrated.savedTracks.ce = applyPlanMigrations({
      ...migrated.savedTracks.ce,
      trackId: 'ce',
    });
  }

  return migrated;
}

function sanitizeSpecializationStateForTrack(plan: StudentPlan): StudentPlan {
  if (!plan.trackId) return plan;

  const catalog = getTrackSpecializationCatalog(plan.trackId);
  const sanitizedSelections = sanitizeTrackSpecializationSelections(catalog, {
    selectedSpecializations: plan.selectedSpecializations ?? [],
    doubleSpecializations: plan.doubleSpecializations ?? [],
  });

  return {
    ...plan,
    selectedSpecializations: sanitizedSelections.selectedSpecializations,
    doubleSpecializations: sanitizedSelections.doubleSpecializations,
  };
}

/** Shallow snapshot of all plan fields for undo history */
function captureSnapshot(state: PlanState): StudentPlan {
  return {
    trackId: state.trackId,
    semesters: Object.fromEntries(Object.entries(state.semesters).map(([k, v]) => [k, [...v]])),
    completedCourses: [...state.completedCourses],
    selectedSpecializations: [...state.selectedSpecializations],
    favorites: [...state.favorites],
    grades: { ...state.grades },
    substitutions: { ...state.substitutions },
    maxSemester: state.maxSemester,
    selectedPrereqGroups: { ...state.selectedPrereqGroups },
    summerSemesters: [...state.summerSemesters],
    currentSemester: state.currentSemester,
    semesterOrder: [...state.semesterOrder],
    semesterTypeOverrides: { ...(state.semesterTypeOverrides ?? {}) },
    semesterWarningsIgnored: [...(state.semesterWarningsIgnored ?? [])],
    doubleSpecializations: [...(state.doubleSpecializations ?? [])],
    hasEnglishExemption: state.hasEnglishExemption ?? false,
    manualSapAverages: { ...(state.manualSapAverages ?? {}) },
    binaryPass: { ...(state.binaryPass ?? {}) },
    miluimCredits: state.miluimCredits,
    englishScore: state.englishScore,
    englishTaughtCourses: [...(state.englishTaughtCourses ?? [])],
    facultyColorOverrides: { ...(state.facultyColorOverrides ?? {}) },
    completedInstances: [...(state.completedInstances ?? [])],
    dismissedRecommendedCourses: { ...(state.dismissedRecommendedCourses ?? {}) },
    coreToChainOverrides: [...(state.coreToChainOverrides ?? [])],
  };
}

function pushHistory(state: PlanState): StudentPlan[] {
  return [...(state._history ?? []).slice(-19), captureSnapshot(state)];
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      ...initialState,
      _history: [],
      _initKey: 0,
      isSwitchingTrack: false,
      savedTracks: {},

      setTrack: (newTrackId) =>
        set((state) => {
          // Save current track state
          const savedTracks = { ...state.savedTracks };
          if (state.trackId) {
            savedTracks[state.trackId] = captureSnapshot(state);
          }
          // Restore previously saved state for this track
          if (savedTracks[newTrackId]) {
            const saved = sanitizeSpecializationStateForTrack(
              applyPlanMigrations(savedTracks[newTrackId]),
            );
            return {
              ...initialState,
              ...saved,
              savedTracks,
              _history: [],
              _initKey: state._initKey,
              isSwitchingTrack: state.isSwitchingTrack,
            };
          }
          // New track — reset plan fields
          return {
            ...initialState,
            trackId: newTrackId,
            semesters: { ...DEFAULT_SEMESTER_MAP },
            semesterOrder: [...DEFAULT_ORDER],
            savedTracks,
            _history: [],
            _initKey: state._initKey,
            isSwitchingTrack: state.isSwitchingTrack,
          };
        }),

      beginTrackSwitch: () =>
        set((state) => {
          const savedTracks = { ...state.savedTracks };
          if (state.trackId) {
            savedTracks[state.trackId] = captureSnapshot(state);
          }

          return {
            ...initialState,
            savedTracks,
            _history: [],
            _initKey: 0,
            isSwitchingTrack: true,
          };
        }),

      finishTrackSwitch: () => set(() => ({ isSwitchingTrack: false })),

      addCourseToSemester: (courseId, semester) =>
        set((state) => {
          const history = pushHistory(state);
          const newSemesters: Record<number, string[]> = {};
          if (REPEATABLE_COURSES.has(courseId)) {
            for (const [k, v] of Object.entries(state.semesters)) newSemesters[Number(k)] = v;
            newSemesters[semester] = [...(newSemesters[semester] ?? []), courseId];
          } else {
            for (const [k, v] of Object.entries(state.semesters)) {
              newSemesters[Number(k)] = v.filter((id) => id !== courseId);
            }
            newSemesters[semester] = [...(newSemesters[semester] ?? []), courseId];
          }
          return {
            semesters: newSemesters,
            dismissedRecommendedCourses: clearDismissedCourse(
              state.dismissedRecommendedCourses,
              state.trackId,
              courseId,
            ),
            _history: history,
          };
        }),

      removeCourseFromSemester: (courseId, semester) =>
        set((state) => {
          const history = pushHistory(state);
          const list = state.semesters[semester] ?? [];
          let newList: string[];
          if (REPEATABLE_COURSES.has(courseId)) {
            const idx = list.indexOf(courseId);
            newList = idx >= 0 ? [...list.slice(0, idx), ...list.slice(idx + 1)] : list;
          } else {
            newList = list.filter((id) => id !== courseId);
          }
          const nextSemesters = { ...state.semesters, [semester]: newList };
          const stillPlaced = Object.values(nextSemesters).some((ids) => ids.includes(courseId));
          return {
            semesters: nextSemesters,
            completedCourses: state.completedCourses.filter((id) => id !== courseId),
            dismissedRecommendedCourses: stillPlaced
              ? state.dismissedRecommendedCourses ?? {}
              : markDismissedCourse(
                state.dismissedRecommendedCourses,
                state.trackId,
                courseId,
              ),
            _history: history,
          };
        }),

      moveCourse: (courseId, from, toSemester) =>
        set((state) => {
          const history = pushHistory(state);
          const newSemesters: Record<number, string[]> = {};
          if (REPEATABLE_COURSES.has(courseId)) {
            for (const [k, v] of Object.entries(state.semesters)) newSemesters[Number(k)] = v;
            const fromList = newSemesters[from] ?? [];
            const idx = fromList.indexOf(courseId);
            if (idx >= 0) newSemesters[from] = [...fromList.slice(0, idx), ...fromList.slice(idx + 1)];
            newSemesters[toSemester] = [...(newSemesters[toSemester] ?? []), courseId];
          } else {
            for (const [k, v] of Object.entries(state.semesters)) {
              newSemesters[Number(k)] = v.filter((id) => id !== courseId);
            }
            newSemesters[toSemester] = [...(newSemesters[toSemester] ?? []), courseId];
          }
          return {
            semesters: newSemesters,
            dismissedRecommendedCourses: clearDismissedCourse(
              state.dismissedRecommendedCourses,
              state.trackId,
              courseId,
            ),
            _history: history,
          };
        }),

      toggleCompleted: (courseId) =>
        set((state) => {
          const history = pushHistory(state);
          const isCompleted = state.completedCourses.includes(courseId);
          if (isCompleted) {
            return { completedCourses: state.completedCourses.filter((id) => id !== courseId), _history: history };
          }
          const inAnySemester = Object.values(state.semesters).some((ids) => ids.includes(courseId));
          const newSemesters = inAnySemester
            ? state.semesters
            : { ...state.semesters, 0: [...(state.semesters[0] ?? []), courseId] };
          return { completedCourses: [...state.completedCourses, courseId], semesters: newSemesters, _history: history };
        }),

      toggleCompletedInstance: (instanceKey) =>
        set((state) => {
          const list = state.completedInstances ?? [];
          return {
            completedInstances: list.includes(instanceKey)
              ? list.filter((k) => k !== instanceKey)
              : [...list, instanceKey],
          };
        }),

      toggleSpecialization: (groupId) =>
        set((state) => {
          const isSelected = state.selectedSpecializations.includes(groupId);
          const selectedSpecializations = isSelected
            ? state.selectedSpecializations.filter((id) => id !== groupId)
            : [...state.selectedSpecializations, groupId];

          return {
            selectedSpecializations,
            doubleSpecializations: isSelected
              ? (state.doubleSpecializations ?? []).filter((id) => id !== groupId)
              : state.doubleSpecializations,
          };
        }),

      toggleFavorite: (courseId) =>
        set((state) => ({
          favorites: state.favorites.includes(courseId)
            ? state.favorites.filter((id) => id !== courseId)
            : [...state.favorites, courseId],
        })),

      setGrade: (courseId, grade, semester) =>
        set((state) => {
          const key = gradeKey(courseId, semester);
          const newGrades = { ...state.grades };
          const newBinaryPass = { ...(state.binaryPass ?? {}) };
          if (grade === null) {
            delete newGrades[key];
            // removing grade → unmark completed (only if no binary pass either)
            const completedCourses = newBinaryPass[courseId]
              ? state.completedCourses
              : state.completedCourses.filter((id) => id !== courseId);
            return { grades: newGrades, binaryPass: newBinaryPass, completedCourses };
          }
          newGrades[key] = grade;
          delete newBinaryPass[courseId]; // grade and binary pass are mutually exclusive
          // auto-mark completed; if not in any semester, add to unassigned pool
          const alreadyCompleted = state.completedCourses.includes(courseId);
          const inAnySemester = Object.values(state.semesters).some((ids) => ids.includes(courseId));
          const newSemesters = (!alreadyCompleted && !inAnySemester)
            ? { ...state.semesters, 0: [...(state.semesters[0] ?? []), courseId] }
            : state.semesters;
          const completedCourses = alreadyCompleted
            ? state.completedCourses
            : [...state.completedCourses, courseId];
          return { grades: newGrades, binaryPass: newBinaryPass, completedCourses, semesters: newSemesters };
        }),

      setSubstitution: (fromId, toId) =>
        set((state) => {
          const s = { ...state.substitutions };
          if (toId === null) delete s[fromId];
          else s[fromId] = toId;
          return { substitutions: s };
        }),

      setSelectedPrereqGroup: (courseId, group) =>
        set((state) => {
          const g = { ...state.selectedPrereqGroups };
          if (group === null) delete g[courseId];
          else g[courseId] = group;
          return { selectedPrereqGroups: g };
        }),

      addSemester: () =>
        set((state) => {
          const next = state.maxSemester + 1;
          if (next > MAX_SEMESTERS) return state;
          const history = pushHistory(state);
          return {
            maxSemester: next,
            semesters: { ...state.semesters, [next]: [] },
            semesterOrder: [...state.semesterOrder, next],
            _history: history,
          };
        }),

      addSummerSemester: () =>
        set((state) => {
          const next = state.maxSemester + 1;
          if (next > MAX_SEMESTERS) return state;
          const history = pushHistory(state);
          // Insert summer BEFORE the last regular (non-summer) semester so that
          // courses placed in it are recognized as prereqs by subsequent semesters.
          // Appending at the end (old behavior) put summer after sem 8, making it
          // invisible to prereq checks for semesters 1-8.
          const order = [...state.semesterOrder];
          let insertAt = order.length; // fallback: append
          for (let i = order.length - 1; i >= 0; i--) {
            if (!state.summerSemesters.includes(order[i])) {
              insertAt = i; // just before this last regular semester
              break;
            }
          }
          order.splice(insertAt, 0, next);
          return {
            maxSemester: next,
            semesters: { ...state.semesters, [next]: [] },
            summerSemesters: [...state.summerSemesters, next],
            semesterOrder: order,
            _history: history,
          };
        }),

      removeSemester: () =>
        set((state) => {
          const lastRegular = [...state.semesterOrder].reverse().find(
            (s) => !state.summerSemesters.includes(s)
          );
          if (lastRegular === undefined) return state;
          const history = pushHistory(state);
          const coursesInLast = state.semesters[lastRegular] ?? [];
          const newSemesters = { ...state.semesters };
          newSemesters[0] = [...(newSemesters[0] ?? []), ...coursesInLast];
          delete newSemesters[lastRegular];
          const newMax = lastRegular === state.maxSemester ? state.maxSemester - 1 : state.maxSemester;
          return {
            maxSemester: newMax,
            semesters: newSemesters,
            semesterOrder: state.semesterOrder.filter((s) => s !== lastRegular),
            summerSemesters: state.summerSemesters.filter((s) => s !== lastRegular),
            currentSemester: state.currentSemester === lastRegular ? null : state.currentSemester,
            _history: history,
          };
        }),

      removeSummerSemester: () =>
        set((state) => {
          if (state.summerSemesters.length === 0) return state;
          const history = pushHistory(state);
          const lastSummer = state.summerSemesters[state.summerSemesters.length - 1];
          const coursesInLast = state.semesters[lastSummer] ?? [];
          const newSemesters = { ...state.semesters };
          newSemesters[0] = [...(newSemesters[0] ?? []), ...coursesInLast];
          delete newSemesters[lastSummer];
          const newMax = lastSummer === state.maxSemester ? state.maxSemester - 1 : state.maxSemester;
          return {
            maxSemester: newMax,
            semesters: newSemesters,
            semesterOrder: state.semesterOrder.filter((s) => s !== lastSummer),
            summerSemesters: state.summerSemesters.filter((s) => s !== lastSummer),
            currentSemester: state.currentSemester === lastSummer ? null : state.currentSemester,
            _history: history,
          };
        }),

      setCurrentSemester: (n) => set(() => ({ currentSemester: n })),

      moveSemesterInOrder: (sem, direction) =>
        set((state) => {
          const order = [...state.semesterOrder];
          const idx = order.indexOf(sem);
          if (idx < 0) return state;
          const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= order.length) return state;
          [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
          return { semesterOrder: order };
        }),

      setSemesterType: (sem, type) =>
        set((state) => ({
          semesterTypeOverrides: { ...(state.semesterTypeOverrides ?? {}), [sem]: type },
        })),

      toggleSemesterWarnings: (sem) =>
        set((state) => {
          const ignored = state.semesterWarningsIgnored ?? [];
          return {
            semesterWarningsIgnored: ignored.includes(sem)
              ? ignored.filter((s) => s !== sem)
              : [...ignored, sem],
          };
        }),

      toggleDoubleSpecialization: (groupId) =>
        set((state) => {
          if (!state.trackId) return state;
          const catalog = getTrackSpecializationCatalog(state.trackId);
          if (catalog.interactionDisabled) return state;
          const group = catalog.groups.find((entry) => entry.id === groupId);
          if (!group?.canBeDouble) return state;
          const doubles = state.doubleSpecializations ?? [];
          return {
            doubleSpecializations: doubles.includes(groupId)
              ? doubles.filter((id) => id !== groupId)
              : [...doubles, groupId],
          };
        }),

      toggleEnglishExemption: () =>
        set((state) => ({ hasEnglishExemption: !state.hasEnglishExemption })),

      setMiluimCredits: (n) =>
        set(() => ({ miluimCredits: n === null ? undefined : Math.max(0, Math.min(10, n)) })),

      setEnglishScore: (score) =>
        set(() => ({ englishScore: score === null ? undefined : score })),

      toggleEnglishTaughtCourse: (courseId) =>
        set((state) => {
          const list = state.englishTaughtCourses ?? [];
          return {
            englishTaughtCourses: list.includes(courseId)
              ? list.filter((id) => id !== courseId)
              : [...list, courseId],
          };
        }),

      setCoreToChainOverrides: (ids) =>
        set(() => ({ coreToChainOverrides: ids })),

      setFacultyColorOverride: (faculty, colorKey) =>
        set((state) => ({
          facultyColorOverrides: { ...(state.facultyColorOverrides ?? {}), [faculty]: colorKey },
        })),

      setBinaryPass: (courseId, value) =>
        set((state) => {
          const bp = { ...(state.binaryPass ?? {}) };
          const newGrades = { ...state.grades };
          if (value === null) {
            delete bp[courseId];
            // removing pass → unmark completed (only if no numeric grade either)
            const completedCourses = newGrades[courseId] !== undefined
              ? state.completedCourses
              : state.completedCourses.filter((id) => id !== courseId);
            return { binaryPass: bp, grades: newGrades, completedCourses };
          }
          bp[courseId] = value;
          delete newGrades[courseId]; // binary pass and grade are mutually exclusive
          // auto-mark completed; if not in any semester, add to unassigned pool
          const alreadyCompleted = state.completedCourses.includes(courseId);
          const inAnySemester = Object.values(state.semesters).some((ids) => ids.includes(courseId));
          const newSemesters = (!alreadyCompleted && !inAnySemester)
            ? { ...state.semesters, 0: [...(state.semesters[0] ?? []), courseId] }
            : state.semesters;
          const completedCourses = alreadyCompleted
            ? state.completedCourses
            : [...state.completedCourses, courseId];
          return { binaryPass: bp, grades: newGrades, completedCourses, semesters: newSemesters };
        }),

      reorderSemesters: (newOrder) => set(() => ({ semesterOrder: newOrder })),

      loadPlan: (plan) => set((state) => {
        const migratedPlan = sanitizeSpecializationStateForTrack(applyPlanMigrations(plan));
        return {
          ...initialState,
          ...migratedPlan,
          semesterOrder: migratedPlan.semesterOrder?.length
            ? migratedPlan.semesterOrder
            : Array.from({ length: migratedPlan.maxSemester }, (_, i) => i + 1),
          semesterTypeOverrides: migratedPlan.semesterTypeOverrides ?? {},
          semesterWarningsIgnored: migratedPlan.semesterWarningsIgnored ?? [],
          doubleSpecializations: migratedPlan.doubleSpecializations ?? [],
          hasEnglishExemption: migratedPlan.hasEnglishExemption ?? false,
          manualSapAverages: migratedPlan.manualSapAverages ?? {},
          binaryPass: migratedPlan.binaryPass ?? {},
          miluimCredits: migratedPlan.miluimCredits,
          englishScore: migratedPlan.englishScore,
          englishTaughtCourses: migratedPlan.englishTaughtCourses ?? [],
          facultyColorOverrides: migratedPlan.facultyColorOverrides ?? {},
          completedInstances: migratedPlan.completedInstances ?? [],
          dismissedRecommendedCourses: migratedPlan.dismissedRecommendedCourses ?? {},
          coreToChainOverrides: migratedPlan.coreToChainOverrides ?? [],
          // Cloud plan's savedTracks takes priority; fall back to local if cloud has none
          savedTracks: migratedPlan.savedTracks ?? state.savedTracks ?? {},
          _history: [],
          _initKey: state._initKey,
          isSwitchingTrack: false,
        };
      }),

      resetPlan: () => set(() => ({
        ...initialState,
        _history: [],
        _initKey: 0,
        isSwitchingTrack: false,
        savedTracks: {},
      })),

      resetToDefault: () =>
        set((state) => {
          // Remove saved state for current track so it re-initializes fresh
          const savedTracks = { ...state.savedTracks };
          if (state.trackId) delete savedTracks[state.trackId];
          const dismissedRecommendedCourses = { ...(state.dismissedRecommendedCourses ?? {}) };
          if (state.trackId) delete dismissedRecommendedCourses[state.trackId];
          return {
            trackId: state.trackId,
            semesters: { ...DEFAULT_SEMESTER_MAP },
            completedCourses: [],
            selectedSpecializations: [],
            favorites: [],
            grades: {},
            substitutions: {},
            maxSemester: DEFAULT_SEMESTERS,
            selectedPrereqGroups: {},
            summerSemesters: [],
            currentSemester: null,
            semesterOrder: [...DEFAULT_ORDER],
            semesterTypeOverrides: {},
            semesterWarningsIgnored: [],
            doubleSpecializations: [],
            hasEnglishExemption: false,
            manualSapAverages: {},
            binaryPass: {},
            miluimCredits: undefined,
            englishScore: undefined,
            englishTaughtCourses: [],
            facultyColorOverrides: {},
            completedInstances: [],
            dismissedRecommendedCourses,
            savedTracks,
            _history: [],
            _initKey: state._initKey + 1,
            isSwitchingTrack: false,
          };
        }),

      undo: () =>
        set((state) => {
          const history = state._history ?? [];
          if (history.length === 0) return state;
          const prev = history[history.length - 1];
          return {
            ...prev,
            savedTracks: state.savedTracks,
            _history: history.slice(0, -1),
            _initKey: state._initKey,
            isSwitchingTrack: false,
          };
        }),
    }),
    {
      name: 'technion-ee-planner',
      partialize: (state) => {
        // Exclude ephemeral fields from localStorage
        const { _history: _h, _initKey: _ik, isSwitchingTrack: _st, ...rest } = state as PlanState;
        void _h; void _ik; void _st;
        return rest;
      },
    }
  )
);
