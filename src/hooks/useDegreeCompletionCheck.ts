import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../store/planStore';
import type { SapCourse, TrackDefinition, TrackSpecializationCatalog } from '../types';
import { computeDegreeCompletionCheck } from '../domain/degreeCompletion';
import type { DegreeCompletionResult } from '../domain/degreeCompletion';

export type { DegreeCompletionResult };

export function useDegreeCompletionCheck(
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null,
  catalog: TrackSpecializationCatalog,
  weightedAverage: number | null,
): DegreeCompletionResult | null {
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
  })));

  return useMemo(() => {
    if (!trackDef) return null;
    return computeDegreeCompletionCheck(input, courses, trackDef, catalog, weightedAverage);
  }, [input, courses, trackDef, catalog, weightedAverage]);
}
