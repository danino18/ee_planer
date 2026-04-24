import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore';
import type { SapCourse, TrackDefinition } from '../types';
import type { GeneralRequirementProgress } from '../domain/generalRequirements/types';
import { buildGeneralRequirementsProgress } from '../domain/generalRequirements/progressBuilder';

export { buildGeneralRequirementsProgress } from '../domain/generalRequirements/progressBuilder';

export function useGeneralRequirements(
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null,
): GeneralRequirementProgress[] {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const explicitSportCompletions = usePlanStore((s) => s.explicitSportCompletions ?? []);
  const completedInstances = usePlanStore((s) => s.completedInstances ?? []);
  const grades = usePlanStore((s) => s.grades);
  const binaryPass = usePlanStore((s) => s.binaryPass ?? {});
  const englishTaughtCourses = usePlanStore((s) => s.englishTaughtCourses ?? []);
  const miluimCredits = usePlanStore((s) => s.miluimCredits ?? 0);
  const englishScore = usePlanStore((s) => s.englishScore);

  return useMemo(() => {
    if (!trackDef) return [];

    return buildGeneralRequirementsProgress({
      courses,
      trackDef,
      semesters,
      completedCourses,
      explicitSportCompletions,
      completedInstances,
      grades,
      binaryPass,
      englishTaughtCourses,
      miluimCredits,
      englishScore,
    });
  }, [courses, trackDef, semesters, completedCourses, explicitSportCompletions, completedInstances, grades, binaryPass, englishTaughtCourses, miluimCredits, englishScore]);
}
