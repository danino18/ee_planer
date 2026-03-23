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
  removeSemester: () => void;
  loadPlan: (plan: StudentPlan) => void;
  resetPlan: () => void;
}

const initialState: StudentPlan = {
  trackId: null,
  semesters: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
  completedCourses: [],
  selectedSpecializations: [],
  favorites: [],
  grades: {},
  substitutions: {},
  maxSemester: 7,
  selectedPrereqGroups: {},
};

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      ...initialState,

      setTrack: (trackId) =>
        set(() => ({
          trackId,
          semesters: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
          completedCourses: [],
          selectedSpecializations: [],
          maxSemester: 7,
        })),

      addCourseToSemester: (courseId, semester) =>
        set((state) => {
          const newSemesters: Record<number, string[]> = {};
          for (const [k, v] of Object.entries(state.semesters)) {
            newSemesters[Number(k)] = v.filter((id) => id !== courseId);
          }
          newSemesters[semester] = [...(newSemesters[semester] ?? []), courseId];
          return { semesters: newSemesters };
        }),

      removeCourseFromSemester: (courseId, semester) =>
        set((state) => ({
          semesters: {
            ...state.semesters,
            [semester]: (state.semesters[semester] ?? []).filter((id) => id !== courseId),
          },
          completedCourses: state.completedCourses.filter((id) => id !== courseId),
        })),

      moveCourse: (courseId, _from, toSemester) =>
        set((state) => {
          const newSemesters: Record<number, string[]> = {};
          for (const [k, v] of Object.entries(state.semesters)) {
            newSemesters[Number(k)] = v.filter((id) => id !== courseId);
          }
          newSemesters[toSemester] = [...(newSemesters[toSemester] ?? []), courseId];
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
          };
        }),

      removeSemester: () =>
        set((state) => {
          if (state.maxSemester <= 1) return state;
          const last = state.maxSemester;
          const coursesInLast = state.semesters[last] ?? [];
          const newSemesters = { ...state.semesters };
          newSemesters[0] = [...(newSemesters[0] ?? []), ...coursesInLast];
          delete newSemesters[last];
          return { maxSemester: last - 1, semesters: newSemesters };
        }),

      loadPlan: (plan) => set(() => ({ ...plan })),

      resetPlan: () => set(() => ({ ...initialState })),
    }),
    { name: 'technion-ee-planner' }
  )
);
