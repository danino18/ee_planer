import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackId, StudentPlan } from '../types';

interface PlanState extends StudentPlan {
  // Ephemeral — NOT persisted
  _history: StudentPlan[];
  _initKey: number;
  // Persisted extra
  savedTracks: Record<string, StudentPlan>;

  setTrack: (trackId: TrackId) => void;
  addCourseToSemester: (courseId: string, semester: number) => void;
  removeCourseFromSemester: (courseId: string, semester: number) => void;
  moveCourse: (courseId: string, fromSemester: number, toSemester: number) => void;
  toggleCompleted: (courseId: string) => void;
  toggleSpecialization: (groupId: string) => void;
  toggleFavorite: (courseId: string) => void;
  setGrade: (courseId: string, grade: number | null) => void;
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

const DEFAULT_SEMESTERS = 8;
const DEFAULT_ORDER = Array.from({ length: DEFAULT_SEMESTERS }, (_, i) => i + 1);
const DEFAULT_SEMESTER_MAP: Record<number, string[]> = { 0: [] };
for (let i = 1; i <= DEFAULT_SEMESTERS; i++) DEFAULT_SEMESTER_MAP[i] = [];

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
};

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
            const saved = savedTracks[newTrackId];
            return {
              ...saved,
              savedTracks,
              _history: [],
              _initKey: state._initKey,
            };
          }
          // New track — reset plan fields
          return {
            trackId: newTrackId,
            semesters: { ...DEFAULT_SEMESTER_MAP },
            completedCourses: [],
            selectedSpecializations: [],
            maxSemester: DEFAULT_SEMESTERS,
            summerSemesters: [],
            currentSemester: null,
            semesterOrder: [...DEFAULT_ORDER],
            semesterTypeOverrides: {},
            semesterWarningsIgnored: [],
            doubleSpecializations: [],
            hasEnglishExemption: false,
            manualSapAverages: {},
            savedTracks,
            _history: [],
          };
        }),

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
          return { semesters: newSemesters, _history: history };
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
          return {
            semesters: { ...state.semesters, [semester]: newList },
            completedCourses: state.completedCourses.filter((id) => id !== courseId),
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
          return { semesters: newSemesters, _history: history };
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

      toggleSpecialization: (groupId) =>
        set((state) => ({
          selectedSpecializations: state.selectedSpecializations.includes(groupId)
            ? state.selectedSpecializations.filter((id) => id !== groupId)
            : [...state.selectedSpecializations, groupId],
        })),

      toggleFavorite: (courseId) =>
        set((state) => ({
          favorites: state.favorites.includes(courseId)
            ? state.favorites.filter((id) => id !== courseId)
            : [...state.favorites, courseId],
        })),

      setGrade: (courseId, grade) =>
        set((state) => {
          const newGrades = { ...state.grades };
          const newBinaryPass = { ...(state.binaryPass ?? {}) };
          if (grade === null) {
            delete newGrades[courseId];
            // removing grade → unmark completed (only if no binary pass either)
            const completedCourses = newBinaryPass[courseId]
              ? state.completedCourses
              : state.completedCourses.filter((id) => id !== courseId);
            return { grades: newGrades, binaryPass: newBinaryPass, completedCourses };
          }
          newGrades[courseId] = grade;
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
          if (next > 16) return state;
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
          if (next > 16) return state;
          const history = pushHistory(state);
          return {
            maxSemester: next,
            semesters: { ...state.semesters, [next]: [] },
            summerSemesters: [...state.summerSemesters, next],
            semesterOrder: [...state.semesterOrder, next],
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

      loadPlan: (plan) => set((state) => ({
        ...initialState,
        ...plan,
        semesterOrder: plan.semesterOrder?.length
          ? plan.semesterOrder
          : Array.from({ length: plan.maxSemester }, (_, i) => i + 1),
        semesterTypeOverrides: plan.semesterTypeOverrides ?? {},
        semesterWarningsIgnored: plan.semesterWarningsIgnored ?? [],
        doubleSpecializations: plan.doubleSpecializations ?? [],
        hasEnglishExemption: plan.hasEnglishExemption ?? false,
        manualSapAverages: plan.manualSapAverages ?? {},
        binaryPass: plan.binaryPass ?? {},
        miluimCredits: plan.miluimCredits,
        englishScore: plan.englishScore,
        englishTaughtCourses: plan.englishTaughtCourses ?? [],
        facultyColorOverrides: plan.facultyColorOverrides ?? {},
        // Cloud plan's savedTracks takes priority; fall back to local if cloud has none
        savedTracks: plan.savedTracks ?? state.savedTracks ?? {},
        _history: [],
        _initKey: state._initKey,
      })),

      resetPlan: () => set(() => ({ ...initialState, _history: [], _initKey: 0, savedTracks: {} })),

      resetToDefault: () =>
        set((state) => {
          // Remove saved state for current track so it re-initializes fresh
          const savedTracks = { ...state.savedTracks };
          if (state.trackId) delete savedTracks[state.trackId];
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
            savedTracks,
            _history: [],
            _initKey: state._initKey + 1,  // triggers re-initialization in App.tsx
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
          };
        }),
    }),
    {
      name: 'technion-ee-planner',
      partialize: (state) => {
        // Exclude ephemeral fields from localStorage
        const { _history: _h, _initKey: _ik, ...rest } = state as PlanState;
        void _h; void _ik;
        return rest;
      },
    }
  )
);
