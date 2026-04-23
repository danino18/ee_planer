import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackId, StudentPlan, PlanVersion, VersionedPlanEnvelope } from '../types';
import { eeTrack } from '../data/tracks/ee';
import { csTrack } from '../data/tracks/cs';
import { eeMathTrack } from '../data/tracks/ee_math';
import { eePhysicsTrack } from '../data/tracks/ee_physics';
import { eeCombinedTrack } from '../data/tracks/ee_combined';
import { ceTrack } from '../data/tracks/ce';
import { getAllScheduledCourseIds } from '../data/tracks/semesterSchedule';
import {
  clearRepeatableCourseSemesterGrade,
  gradeKey,
  moveRepeatableCourseGrade,
  REPEATABLE_COURSES,
  sanitizeRepeatableCourseGrades,
} from '../utils/courseGrades';
import {
  getTrackSpecializationCatalog,
  sanitizeTrackSpecializationSelections,
} from '../domain/specializations';
import { serializePlanState } from '../services/planStateSerialization';

export { gradeKey, REPEATABLE_COURSES } from '../utils/courseGrades';

interface PlanState extends StudentPlan {
  // Ephemeral — NOT persisted
  _history: StudentPlan[];
  _initKey: number;
  isSwitchingTrack: boolean;
  // Persisted extra
  savedTracks: Record<string, StudentPlan>;
  versions: PlanVersion[];
  activeVersionId: string;
  hasPendingCloudSync: boolean;
  lastLocalEditAt: number;

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
  setCourseChainAssignment: (courseId: string, chainGroupId: string | null) => void;
  toggleRoboticsMinor: () => void;
  toggleEntrepreneurshipMinor: () => void;
  setEnglishScore: (score: number | null) => void;
  toggleEnglishTaughtCourse: (courseId: string) => void;
  setFacultyColorOverride: (faculty: string, colorKey: string) => void;
  reorderSemesters: (newOrder: number[]) => void;
  loadPlan: (plan: StudentPlan) => void;
  loadEnvelope: (envelope: VersionedPlanEnvelope) => void;
  resetPlan: () => void;
  resetToDefault: () => void;
  markTrackInitialized: (trackId: string) => void;
  undo: () => void;
  createVersion: () => void;
  switchVersion: (id: string) => void;
  renameVersion: (id: string, name: string) => void;
  deleteVersion: (id: string) => void;
  markCloudSyncPending: (editedAt?: number) => void;
  markCloudSyncSettled: (syncedAt?: number) => void;
}

// Maximum number of semesters a student can have (including summer semesters)
export const MAX_SEMESTERS = 16;

const DEFAULT_SEMESTERS = 8;
const DEFAULT_ORDER = Array.from({ length: DEFAULT_SEMESTERS }, (_, i) => i + 1);
const DEFAULT_SEMESTER_MAP: Record<number, string[]> = { 0: [] };
for (let i = 1; i <= DEFAULT_SEMESTERS; i++) DEFAULT_SEMESTER_MAP[i] = [];

const CE_REMOVED_RECOMMENDED_COURSES: Record<number, string[]> = {
  4: ['01140073'],
};

const CS_REMOVED_RECOMMENDED_COURSES: Record<number, string[]> = {
  1: ['01140032'],
};

const CS_ADDED_RECOMMENDED_COURSES: Record<number, string[]> = {
  4: ['00440101'],
};

const TRACKS = [eeTrack, csTrack, eeMathTrack, eePhysicsTrack, eeCombinedTrack, ceTrack];

// Sport/PE pool courses auto-placed in the unassigned column on first load.
// Empty: sport appears in the recommended schedule (semesterSchedule); נבחרת users add it manually.
export const AUTO_SEEDED_POOL_IDS: string[] = [];

const AUTO_SEEDED_COURSES_BY_TRACK = Object.fromEntries(
  TRACKS.map((track) => [
    track.id,
    new Set([
      ...getAllScheduledCourseIds(track),
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
  roboticsMinorEnabled: false,
  entrepreneurshipMinorEnabled: false,
  initializedTracks: [],
};

function removeRecommendedCourses(
  semesters: Record<number, string[]>,
  coursesBySemester: Record<number, string[]>,
): void {
  for (const [semester, courseIds] of Object.entries(coursesBySemester)) {
    const sem = Number(semester);
    const existing = semesters[sem] ?? [];
    semesters[sem] = existing.filter((id) => !courseIds.includes(id));
  }
}

function addRecommendedCourses(
  plan: StudentPlan,
  trackId: TrackId,
  coursesBySemester: Record<number, string[]>,
): void {
  const dismissedForTrack = new Set(plan.dismissedRecommendedCourses?.[trackId] ?? []);
  const allPlaced = new Set<string>([
    ...(plan.completedCourses ?? []),
    ...Object.values(plan.semesters).flat(),
  ]);

  for (const [semester, courseIds] of Object.entries(coursesBySemester)) {
    const sem = Number(semester);
    const existing = plan.semesters[sem] ?? [];

    for (const courseId of courseIds) {
      if (dismissedForTrack.has(courseId) || allPlaced.has(courseId)) {
        continue;
      }

      existing.push(courseId);
      allPlaced.add(courseId);
    }

    plan.semesters[sem] = existing;
  }
}

function applyPlanMigrations(plan: StudentPlan): StudentPlan {
  const migrated: StudentPlan = {
    ...plan,
    semesters: { ...plan.semesters },
    savedTracks: plan.savedTracks ? { ...plan.savedTracks } : plan.savedTracks,
    dismissedRecommendedCourses: { ...(plan.dismissedRecommendedCourses ?? {}) },
  };

  if (migrated.trackId === 'ce') {
    removeRecommendedCourses(migrated.semesters, CE_REMOVED_RECOMMENDED_COURSES);
  }

  if (migrated.trackId === 'cs') {
    removeRecommendedCourses(migrated.semesters, CS_REMOVED_RECOMMENDED_COURSES);
    addRecommendedCourses(migrated, 'cs', CS_ADDED_RECOMMENDED_COURSES);
  }

  if (migrated.savedTracks?.ce) {
    migrated.savedTracks.ce = applyPlanMigrations({
      ...migrated.savedTracks.ce,
      trackId: 'ce',
    });
  }

  if (migrated.savedTracks?.cs) {
    migrated.savedTracks.cs = applyPlanMigrations({
      ...migrated.savedTracks.cs,
      trackId: 'cs',
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
  return serializePlanState(state);
}

/** Build the state fields from a StudentPlan (used when loading/switching versions) */
function planToStateFields(plan: StudentPlan, current: PlanState): Partial<PlanState> {
  const p = sanitizeSpecializationStateForTrack(applyPlanMigrations(plan));
  return {
    ...initialState,
    ...p,
    grades: sanitizeRepeatableCourseGrades(p.semesters, p.grades ?? {}),
    semesterOrder: p.semesterOrder?.length
      ? p.semesterOrder
      : Array.from({ length: p.maxSemester }, (_, i) => i + 1),
    semesterTypeOverrides: p.semesterTypeOverrides ?? {},
    semesterWarningsIgnored: p.semesterWarningsIgnored ?? [],
    doubleSpecializations: p.doubleSpecializations ?? [],
    hasEnglishExemption: p.hasEnglishExemption ?? false,
    manualSapAverages: p.manualSapAverages ?? {},
    binaryPass: p.binaryPass ?? {},
    englishTaughtCourses: p.englishTaughtCourses ?? [],
    facultyColorOverrides: p.facultyColorOverrides ?? {},
    completedInstances: p.completedInstances ?? [],
    dismissedRecommendedCourses: p.dismissedRecommendedCourses ?? {},
    coreToChainOverrides: p.coreToChainOverrides ?? [],
    savedTracks: p.savedTracks ?? current.savedTracks ?? {},
    _history: [],
    _initKey: current._initKey,
    isSwitchingTrack: false,
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
      versions: [],
      activeVersionId: '',
      hasPendingCloudSync: false,
      lastLocalEditAt: 0,

      setTrack: (newTrackId) =>
        set((state) => {
          // Save current track state
          const savedTracks = { ...state.savedTracks };
          if (state.trackId) {
            savedTracks[state.trackId] = captureSnapshot(state);
          }
          // Restore previously saved state for this track
          if (savedTracks[newTrackId]) {
            return {
              ...planToStateFields(savedTracks[newTrackId], state),
              savedTracks,
              _history: [],
              _initKey: state._initKey,
              isSwitchingTrack: state.isSwitchingTrack,
              hasPendingCloudSync: state.hasPendingCloudSync,
              lastLocalEditAt: state.lastLocalEditAt,
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
            hasPendingCloudSync: state.hasPendingCloudSync,
            lastLocalEditAt: state.lastLocalEditAt,
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
            hasPendingCloudSync: state.hasPendingCloudSync,
            lastLocalEditAt: state.lastLocalEditAt,
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
          const nextGrades = sanitizeRepeatableCourseGrades(
            nextSemesters,
            clearRepeatableCourseSemesterGrade(state.grades, courseId, semester),
          );
          return {
            semesters: nextSemesters,
            grades: nextGrades,
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
          let nextGrades = state.grades;
          if (REPEATABLE_COURSES.has(courseId)) {
            nextGrades = from > 0 && toSemester > 0
              ? moveRepeatableCourseGrade(state.grades, courseId, from, toSemester)
              : clearRepeatableCourseSemesterGrade(state.grades, courseId, from);
          }
          nextGrades = sanitizeRepeatableCourseGrades(newSemesters, nextGrades);
          return {
            semesters: newSemesters,
            grades: nextGrades,
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
          const nextGrades = sanitizeRepeatableCourseGrades(newSemesters, state.grades);
          return {
            maxSemester: newMax,
            semesters: newSemesters,
            grades: nextGrades,
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
          const nextGrades = sanitizeRepeatableCourseGrades(newSemesters, state.grades);
          return {
            maxSemester: newMax,
            semesters: newSemesters,
            grades: nextGrades,
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

      setCourseChainAssignment: (courseId, chainGroupId) =>
        set((state) => {
          const current = state.courseChainAssignments ?? {};
          if (chainGroupId === null) {
            const { [courseId]: _removed, ...rest } = current;
            return { courseChainAssignments: rest };
          }
          return { courseChainAssignments: { ...current, [courseId]: chainGroupId } };
        }),

      toggleRoboticsMinor: () =>
        set((state) => ({ roboticsMinorEnabled: !state.roboticsMinorEnabled })),

      toggleEntrepreneurshipMinor: () =>
        set((state) => ({ entrepreneurshipMinorEnabled: !state.entrepreneurshipMinorEnabled })),

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
        ...planToStateFields(plan, state),
        versions: state.versions,
        activeVersionId: state.activeVersionId,
        hasPendingCloudSync: false,
      })),

      resetPlan: () => set(() => ({
        ...initialState,
        _history: [],
        _initKey: 0,
        isSwitchingTrack: false,
        savedTracks: {},
        versions: [],
        activeVersionId: '',
        hasPendingCloudSync: false,
        lastLocalEditAt: 0,
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
            initializedTracks: (state.initializedTracks ?? []).filter((id) => id !== state.trackId),
            hasPendingCloudSync: false,
            lastLocalEditAt: 0,
          };
        }),

      markTrackInitialized: (trackId) =>
        set((state) => ({
          initializedTracks: (state.initializedTracks ?? []).includes(trackId)
            ? state.initializedTracks
            : [...(state.initializedTracks ?? []), trackId],
        })),

      undo: () =>
        set((state) => {
          const history = state._history ?? [];
          if (history.length === 0) return state;
          const prev = history[history.length - 1];
          return {
            ...prev,
            savedTracks: state.savedTracks,
            versions: state.versions,
            activeVersionId: state.activeVersionId,
            _history: history.slice(0, -1),
            _initKey: state._initKey,
            isSwitchingTrack: false,
            hasPendingCloudSync: state.hasPendingCloudSync,
            lastLocalEditAt: state.lastLocalEditAt,
          };
        }),

      createVersion: () =>
        set((state) => {
          if (state.versions.length >= 4) return state;
          const now = Date.now();
          const newId = crypto.randomUUID();
          const snapshot = captureSnapshot(state);
          const updatedVersions = state.versions.map((v) =>
            v.id === state.activeVersionId ? { ...v, plan: snapshot, updatedAt: now } : v,
          );
          const nextNum = state.versions.length + 1;
          const newVersion: PlanVersion = {
            id: newId,
            name: `גרסה ${nextNum}`,
            plan: snapshot,
            createdAt: now,
            updatedAt: now,
          };
          return {
            versions: [...updatedVersions, newVersion],
            activeVersionId: newId,
            _history: [],
          };
        }),

      switchVersion: (id) =>
        set((state) => {
          if (id === state.activeVersionId) return state;
          const target = state.versions.find((v) => v.id === id);
          if (!target) return state;
          const now = Date.now();
          const snapshot = captureSnapshot(state);
          const updatedVersions = state.versions.map((v) =>
            v.id === state.activeVersionId ? { ...v, plan: snapshot, updatedAt: now } : v,
          );
          return {
            ...planToStateFields(target.plan, state),
            versions: updatedVersions,
            activeVersionId: id,
            hasPendingCloudSync: state.hasPendingCloudSync,
            lastLocalEditAt: state.lastLocalEditAt,
          };
        }),

      renameVersion: (id, name) =>
        set((state) => {
          const trimmedName = name.trim();
          if (!trimmedName) return state;
          const now = Date.now();
          return {
            versions: state.versions.map((v) => (
              v.id === id ? { ...v, name: trimmedName, updatedAt: now } : v
            )),
          };
        }),

      deleteVersion: (id) =>
        set((state) => {
          if (state.versions.length <= 1) return state;
          const remaining = state.versions.filter((v) => v.id !== id);
          if (state.activeVersionId !== id) {
            return { versions: remaining };
          }
          const target = remaining[0];
          return {
            ...planToStateFields(target.plan, state),
            versions: remaining,
            activeVersionId: target.id,
            hasPendingCloudSync: state.hasPendingCloudSync,
            lastLocalEditAt: state.lastLocalEditAt,
          };
        }),

      loadEnvelope: (envelope) =>
        set((state) => {
          const active =
            envelope.versions.find((v) => v.id === envelope.activeVersionId) ??
            envelope.versions[0];
          if (!active) return state;
          return {
            ...planToStateFields(active.plan, state),
            versions: envelope.versions,
            activeVersionId: envelope.activeVersionId,
            hasPendingCloudSync: false,
          };
        }),

      markCloudSyncPending: (editedAt) =>
        set((state) => {
          const nextEditedAt = editedAt ?? Date.now();
          if (state.hasPendingCloudSync && state.lastLocalEditAt === nextEditedAt) return state;
          return {
            hasPendingCloudSync: true,
            lastLocalEditAt: Math.max(state.lastLocalEditAt ?? 0, nextEditedAt),
          };
        }),

      markCloudSyncSettled: (syncedAt) =>
        set((state) => {
          const activeVersion = state.versions.find((version) => version.id === state.activeVersionId);
          if (!activeVersion) {
            return state.hasPendingCloudSync ? { hasPendingCloudSync: false } : state;
          }

          const finalizedAt = syncedAt ?? Math.max(state.lastLocalEditAt ?? 0, activeVersion.updatedAt);
          return {
            versions: state.versions.map((version) => (
              version.id === state.activeVersionId
                ? { ...version, plan: serializePlanState(state), updatedAt: Math.max(version.updatedAt, finalizedAt) }
                : version
            )),
            hasPendingCloudSync: false,
          };
        }),
    }),
    {
      name: 'technion-ee-planner',
      version: 2,
      migrate: (persistedState, fromVersion) => {
        const s = persistedState as PlanState;
        const migratedBase = {
          ...s,
          hasPendingCloudSync: s.hasPendingCloudSync ?? false,
          lastLocalEditAt: s.lastLocalEditAt ?? 0,
        };
        if (fromVersion === 0 || !s.versions || s.versions.length === 0) {
          // Wrap existing plan as the first version
          const vId = crypto.randomUUID();
          const plan: StudentPlan = { ...initialState, ...s };
          return {
            ...migratedBase,
            versions: [{
              id: vId,
              name: 'גרסה 1',
              plan,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }],
            activeVersionId: vId,
          };
        }
        return migratedBase;
      },
      partialize: (state) => {
        // Exclude ephemeral fields from localStorage.
        // hasPendingCloudSync and lastLocalEditAt are intentionally NOT persisted:
        // they track in-session cloud-sync state. If a previous session left them
        // as true/non-zero, persisting would cause the next session to reject
        // incoming cloud data from another device (believing it has "unsaved
        // local changes") and then overwrite the cloud with stale local state.
        const {
          _history: _h,
          _initKey: _ik,
          isSwitchingTrack: _st,
          hasPendingCloudSync: _hp,
          lastLocalEditAt: _le,
          ...rest
        } = state as PlanState;
        void _h; void _ik; void _st; void _hp; void _le;
        return rest;
      },
    }
  )
);
