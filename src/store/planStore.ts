import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackId, StudentPlan } from '../types';

interface PlanState extends StudentPlan {
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
  loadPlan: (plan: StudentPlan) => void;
  resetPlan: () => void;
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
};

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      ...initialState,

      setTrack: (trackId) =>
        set(() => ({
          trackId,
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
        })),

      addCourseToSemester: (courseId, semester) =>
        set((state) => {
          const newSemesters: Record<number, string[]> = {};
          if (REPEATABLE_COURSES.has(courseId)) {
            // Repeatable: just add to target, never remove from other semesters
            for (const [k, v] of Object.entries(state.semesters)) {
              newSemesters[Number(k)] = v;
            }
            newSemesters[semester] = [...(newSemesters[semester] ?? []), courseId];
          } else {
            // Regular: remove from all semesters first, then add
            for (const [k, v] of Object.entries(state.semesters)) {
              newSemesters[Number(k)] = v.filter((id) => id !== courseId);
            }
            newSemesters[semester] = [...(newSemesters[semester] ?? []), courseId];
          }
          return { semesters: newSemesters };
        }),

      removeCourseFromSemester: (courseId, semester) =>
        set((state) => {
          const list = state.semesters[semester] ?? [];
          // For repeatable: remove only first occurrence; for others: remove all
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
          };
        }),

      moveCourse: (courseId, from, toSemester) =>
        set((state) => {
          const newSemesters: Record<number, string[]> = {};
          if (REPEATABLE_COURSES.has(courseId)) {
            // Repeatable: remove one copy from source, add to target
            for (const [k, v] of Object.entries(state.semesters)) {
              newSemesters[Number(k)] = v;
            }
            const fromList = newSemesters[from] ?? [];
            const idx = fromList.indexOf(courseId);
            if (idx >= 0) {
              newSemesters[from] = [...fromList.slice(0, idx), ...fromList.slice(idx + 1)];
            }
            newSemesters[toSemester] = [...(newSemesters[toSemester] ?? []), courseId];
          } else {
            for (const [k, v] of Object.entries(state.semesters)) {
              newSemesters[Number(k)] = v.filter((id) => id !== courseId);
            }
            newSemesters[toSemester] = [...(newSemesters[toSemester] ?? []), courseId];
          }
          return { semesters: newSemesters };
        }),

      toggleCompleted: (courseId) =>
        set((state) => ({
          completedCourses: state.completedCourses.includes(courseId)
            ? state.completedCourses.filter((id) => id !== courseId)
            : [...state.completedCourses, courseId],
        })),

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
          if (grade === null) {
            delete newGrades[courseId];
          } else {
            newGrades[courseId] = grade;
          }
          return { grades: newGrades };
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
          return {
            maxSemester: next,
            semesters: { ...state.semesters, [next]: [] },
            semesterOrder: [...state.semesterOrder, next],
          };
        }),

      addSummerSemester: () =>
        set((state) => {
          const next = state.maxSemester + 1;
          if (next > 16) return state;
          return {
            maxSemester: next,
            semesters: { ...state.semesters, [next]: [] },
            summerSemesters: [...state.summerSemesters, next],
            semesterOrder: [...state.semesterOrder, next],
          };
        }),

      removeSemester: () =>
        set((state) => {
          // Remove the last non-summer semester from semesterOrder
          const lastRegular = [...state.semesterOrder].reverse().find(
            (s) => !state.summerSemesters.includes(s)
          );
          if (lastRegular === undefined) return state;
          const coursesInLast = state.semesters[lastRegular] ?? [];
          const newSemesters = { ...state.semesters };
          newSemesters[0] = [...(newSemesters[0] ?? []), ...coursesInLast];
          delete newSemesters[lastRegular];
          // Compact: renumber if lastRegular === maxSemester
          const newMax = lastRegular === state.maxSemester ? state.maxSemester - 1 : state.maxSemester;
          return {
            maxSemester: newMax,
            semesters: newSemesters,
            semesterOrder: state.semesterOrder.filter((s) => s !== lastRegular),
            summerSemesters: state.summerSemesters.filter((s) => s !== lastRegular),
            currentSemester: state.currentSemester === lastRegular ? null : state.currentSemester,
          };
        }),

      removeSummerSemester: () =>
        set((state) => {
          if (state.summerSemesters.length === 0) return state;
          // Remove the last summer semester
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

      loadPlan: (plan) => set(() => ({
        ...initialState,
        ...plan,
        // Migrate old plans without semesterOrder
        semesterOrder: plan.semesterOrder?.length
          ? plan.semesterOrder
          : Array.from({ length: plan.maxSemester }, (_, i) => i + 1),
        semesterTypeOverrides: plan.semesterTypeOverrides ?? {},
        semesterWarningsIgnored: plan.semesterWarningsIgnored ?? [],
        doubleSpecializations: plan.doubleSpecializations ?? [],
      })),

      resetPlan: () => set(() => ({ ...initialState })),
    }),
    { name: 'technion-ee-planner' }
  )
);
