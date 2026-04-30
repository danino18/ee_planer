import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../store/planStore';
import type { SapCourse, TrackDefinition, TrackSpecializationCatalog } from '../types';
import {
  computeDegreeCompletionCheck,
  suggestChainAssignments,
  suggestMissingCourses,
  suggestTrackScheduleCourses,
} from '../domain/degreeCompletion';
import type {
  DegreeCompletionResult,
  ChainAssignmentSuggestion,
  CourseRecommendation,
  SchedulingContext,
} from '../domain/degreeCompletion';

export type { DegreeCompletionResult };

export interface DegreeCompletionData {
  result: DegreeCompletionResult;
  chainSuggestions: ChainAssignmentSuggestion[];
  courseRecommendations: CourseRecommendation[];
}

const SEM_LABELS = [
  "א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'",
  "ח'", "ט'", "י'", 'י"א', 'י"ב', 'י"ג', 'י"ד', 'ט"ו', 'ט"ז',
];

export function useDegreeCompletionCheck(
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null,
  catalog: TrackSpecializationCatalog,
  weightedAverage: number | null,
): DegreeCompletionData | null {
  const input = usePlanStore(useShallow((s) => ({
    semesters: s.semesters,
    completedCourses: s.completedCourses,
    explicitSportCompletions: s.explicitSportCompletions ?? [],
    completedInstances: s.completedInstances ?? [],
    grades: s.grades,
    binaryPass: s.binaryPass ?? {},
    selectedSpecializations: s.selectedSpecializations,
    doubleSpecializations: s.doubleSpecializations ?? [],
    hasEnglishExemption: s.hasEnglishExemption ?? false,
    miluimCredits: s.miluimCredits ?? 0,
    englishScore: s.englishScore,
    englishTaughtCourses: s.englishTaughtCourses ?? [],
    semesterOrder: s.semesterOrder,
    coreToChainOverrides: s.coreToChainOverrides ?? [],
    courseChainAssignments: s.courseChainAssignments,
    roboticsMinorEnabled: s.roboticsMinorEnabled ?? false,
    entrepreneurshipMinorEnabled: s.entrepreneurshipMinorEnabled ?? false,
    // Scheduling context fields
    summerSemesters: s.summerSemesters,
    semesterTypeOverrides: s.semesterTypeOverrides ?? {},
    targetGraduationSemesterId: s.targetGraduationSemesterId ?? null,
    loadProfile: s.loadProfile ?? 'fulltime' as const,
  })));

  return useMemo(() => {
    if (!trackDef) return null;

    const result = computeDegreeCompletionCheck(input, courses, trackDef, catalog, weightedAverage);

    const optimizerInput = {
      completedCourses: input.completedCourses,
      semesters: input.semesters,
      selectedSpecializations: input.selectedSpecializations,
      courseChainAssignments: input.courseChainAssignments,
      doubleSpecializations: input.doubleSpecializations,
      coreToChainOverrides: input.coreToChainOverrides,
      trackDef,
    };

    // Build semester labels map
    const semesterLabels = new Map<number, string>();
    const summerSet = new Set(input.summerSemesters);
    let regularIdx = 0;
    let summerIdx = 0;
    for (const semId of input.semesterOrder) {
      if (summerSet.has(semId)) {
        semesterLabels.set(semId, `קיץ ${SEM_LABELS[summerIdx] ?? semId}`);
        summerIdx++;
      } else {
        semesterLabels.set(semId, `סמסטר ${SEM_LABELS[regularIdx] ?? semId}`);
        regularIdx++;
      }
    }

    const context: SchedulingContext = {
      semesterOrder: input.semesterOrder,
      summerSemesters: input.summerSemesters,
      semesterTypeOverrides: input.semesterTypeOverrides,
      semesters: input.semesters,
      targetGraduationSemesterId: input.targetGraduationSemesterId,
      loadProfile: input.loadProfile,
      semesterLabels,
    };

    const chainSuggestions = suggestChainAssignments(optimizerInput, courses, catalog);

    // Chain recs (choice/elective from selected specializations)
    const chainRecs = suggestMissingCourses(optimizerInput, courses, catalog, context);

    // Mandatory/lab recs from the track schedule (base layer)
    const trackRecs = trackDef
      ? suggestTrackScheduleCourses(optimizerInput, courses, trackDef, context)
      : [];

    // Chain recs win when a course appears in both (more context)
    const chainCourseIds = new Set(chainRecs.map((r) => r.courseId));
    const dedupedTrackRecs = trackRecs.filter((r) => !chainCourseIds.has(r.courseId));

    const courseRecommendations = [...dedupedTrackRecs, ...chainRecs];

    return { result, chainSuggestions, courseRecommendations };
  }, [input, courses, trackDef, catalog, weightedAverage]);
}
