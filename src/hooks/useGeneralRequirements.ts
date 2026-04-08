import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore';
import type { SapCourse, TrackDefinition } from '../types';
import { GENERAL_REQUIREMENTS_RULES } from '../data/generalRequirements/generalRules';
import { calculateGeneralRequirements } from '../domain/generalRequirements/rulesEngine';
import type { CourseRef, GeneralRequirementRule, GeneralRequirementProgress } from '../domain/generalRequirements/types';

export function useGeneralRequirements(
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null
): GeneralRequirementProgress[] {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const englishTaughtCourses = usePlanStore((s) => s.englishTaughtCourses ?? []);

  return useMemo(() => {
    if (!trackDef) return [];

    // Collect all unique placed course IDs (semesters + completed)
    const allPlacedIds = new Set<string>([
      ...completedCourses,
      ...Object.values(semesters).flat(),
    ]);

    const labPoolSet = new Set(trackDef.labPool?.courses ?? []);

    // Build CourseRef list from placed courses
    const courseRefs: CourseRef[] = [];
    for (const id of allPlacedIds) {
      const sap = courses.get(id);
      if (!sap) continue;
      courseRefs.push({
        courseId: id,
        name: sap.name,
        credits: sap.credits,
        language: (sap.isEnglish || englishTaughtCourses.includes(id)) ? 'EN' : 'HE',
        isLab: labPoolSet.has(id),
      });
    }

    // Build rules, patching the LAB rule with track-specific data
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
      return rule;
    });

    // Filter out lab rule if track has no lab pool
    const activeRules = rules.filter(
      (r) => r.id !== 'labs' || trackDef.labPool !== undefined
    );

    return calculateGeneralRequirements(courseRefs, activeRules);
  }, [courses, trackDef, semesters, completedCourses, englishTaughtCourses]);
}
