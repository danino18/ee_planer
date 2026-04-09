import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore';
import type { SapCourse, TrackDefinition } from '../types';
import { GENERAL_REQUIREMENTS_RULES } from '../data/generalRequirements/generalRules';
import { calculateGeneralRequirements } from '../domain/generalRequirements/rulesEngine';
import type { CourseRef, GeneralRequirementRule, GeneralRequirementProgress } from '../domain/generalRequirements/types';
import { isCourseTaughtInEnglish } from '../data/generalRequirements/courseClassification';

interface BuildParams {
  courses: Map<string, SapCourse>;
  trackDef: TrackDefinition;
  semesters: Record<number, string[]>;
  completedCourses: string[];
  englishTaughtCourses: string[];
  miluimCredits: number;
}

export function buildGeneralRequirementsProgress({
  courses,
  trackDef,
  semesters,
  completedCourses,
  englishTaughtCourses,
  miluimCredits,
}: BuildParams): GeneralRequirementProgress[] {
  const allPlacedIds = new Set<string>([
    ...completedCourses,
    ...Object.values(semesters).flat(),
  ]);

  const labPoolSet = new Set(trackDef.labPool?.courses ?? []);
  const courseRefs: CourseRef[] = [];

  for (const id of allPlacedIds) {
    const sap = courses.get(id);
    if (!sap) continue;

    courseRefs.push({
      courseId: id,
      name: sap.name,
      credits: sap.credits,
      language: isCourseTaughtInEnglish(sap, englishTaughtCourses) ? 'EN' : 'HE',
      isLab: labPoolSet.has(id),
    });
  }

  const rules: GeneralRequirementRule[] = GENERAL_REQUIREMENTS_RULES.map((rule) => {
    if (rule.id === 'labs' && trackDef.labPool) {
      return {
        ...rule,
        targetValue: trackDef.labPool.required,
        courseMatcher: {
          ids: trackDef.labPool.courses,
        },
      };
    }

    if (rule.id === 'general_electives') {
      return {
        ...rule,
        targetValue: Math.max(0, trackDef.generalCreditsRequired - miluimCredits),
      };
    }

    return rule;
  });

  const activeRules = rules.filter(
    (rule) => rule.id !== 'labs' || trackDef.labPool !== undefined
  );

  return calculateGeneralRequirements(courseRefs, activeRules);
}

export function useGeneralRequirements(
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null
): GeneralRequirementProgress[] {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const englishTaughtCourses = usePlanStore((s) => s.englishTaughtCourses ?? []);
  const miluimCredits = usePlanStore((s) => s.miluimCredits ?? 0);

  return useMemo(() => {
    if (!trackDef) return [];

    return buildGeneralRequirementsProgress({
      courses,
      trackDef,
      semesters,
      completedCourses,
      englishTaughtCourses,
      miluimCredits,
    });
  }, [courses, trackDef, semesters, completedCourses, englishTaughtCourses, miluimCredits]);
}
