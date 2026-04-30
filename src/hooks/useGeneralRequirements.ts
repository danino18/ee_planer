import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore';
import type { SapCourse, TrackDefinition } from '../types';
import type { GeneralRequirementsResult } from '../domain/generalRequirements/types';
import { buildGeneralRequirementsProgress } from '../domain/generalRequirements/progressBuilder';

export { buildGeneralRequirementsProgress } from '../domain/generalRequirements/progressBuilder';

const EMPTY_RESULT: GeneralRequirementsResult = {
  progress: [],
  generalElectivesBreakdown: {
    total: { recognized: 0, target: 0 },
    sportFloor: { recognized: 0, target: 0 },
    enrichmentFloor: { recognized: 0, target: 0 },
    freeChoice: { recognized: 0, target: 0 },
    contributors: {
      regularSportToFloor: 0,
      regularSportToFreeChoice: 0,
      melagToFloor: 0,
      melagToFreeChoice: 0,
      externalFacultyToFreeChoice: 0,
      choirRecognized: 0,
      sportsTeamRecognized: 0,
      unrecognizedSpecialCredits: 0,
      surplusBeyond12: 0,
    },
  },
};

export function useGeneralRequirements(
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null,
): GeneralRequirementsResult {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const completedInstances = usePlanStore((s) => s.completedInstances ?? []);
  const grades = usePlanStore((s) => s.grades);
  const binaryPass = usePlanStore((s) => s.binaryPass ?? {});
  const englishTaughtCourses = usePlanStore((s) => s.englishTaughtCourses ?? []);
  const miluimCredits = usePlanStore((s) => s.miluimCredits ?? 0);
  const englishScore = usePlanStore((s) => s.englishScore);

  return useMemo(() => {
    if (!trackDef) return EMPTY_RESULT;

    return buildGeneralRequirementsProgress({
      courses,
      trackDef,
      semesters,
      completedCourses,
      completedInstances,
      grades,
      binaryPass,
      englishTaughtCourses,
      miluimCredits,
      englishScore,
    });
  }, [courses, trackDef, semesters, completedCourses, completedInstances, grades, binaryPass, englishTaughtCourses, miluimCredits, englishScore]);
}
