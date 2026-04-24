import type { SapCourse, TrackDefinition } from '../../types';
import { GENERAL_REQUIREMENTS_RULES } from '../../data/generalRequirements/generalRules';
import { isCourseTaughtInEnglish, isSportCourseId } from '../../data/generalRequirements/courseClassification';
import { gradeKey, REPEATABLE_COURSES } from '../../utils/courseGrades';
import { calculateGeneralRequirements } from './rulesEngine';
import type { CourseRef, GeneralRequirementRule, GeneralRequirementProgress } from './types';

export interface BuildGeneralRequirementsParams {
  courses: Map<string, SapCourse>;
  trackDef: TrackDefinition;
  semesters: Record<number, string[]>;
  completedCourses: string[];
  explicitSportCompletions: string[];
  completedInstances: string[];
  grades: Record<string, number>;
  binaryPass: Record<string, boolean>;
  englishTaughtCourses: string[];
  miluimCredits: number;
  englishScore?: number;
}

function shouldCountCourseForGeneralRequirements(
  courseId: string,
  explicitSportCompletionSet: Set<string>,
): boolean {
  if (!isSportCourseId(courseId)) return true;
  return explicitSportCompletionSet.has(courseId);
}

export function buildGeneralRequirementsProgress({
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
}: BuildGeneralRequirementsParams): GeneralRequirementProgress[] {
  const labPoolSet = new Set(trackDef.labPool?.courses ?? []);
  const explicitSportCompletionSet = new Set(explicitSportCompletions);
  const completedInstanceSet = new Set(completedInstances);
  const courseRefs: CourseRef[] = [];
  const nonRepeatableSeen = new Set<string>([...completedCourses]);

  for (const id of nonRepeatableSeen) {
    if (REPEATABLE_COURSES.has(id) && isSportCourseId(id)) continue;
    if (!shouldCountCourseForGeneralRequirements(id, explicitSportCompletionSet)) continue;
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

  for (const [semesterKey, semCourses] of Object.entries(semesters)) {
    const semester = Number(semesterKey);
    for (const [index, id] of semCourses.entries()) {
      const sap = courses.get(id);
      if (!sap) continue;
      if (REPEATABLE_COURSES.has(id)) {
        if (isSportCourseId(id)) {
          const instanceKey = `${id}__${semester}__${index}`;
          const hasExplicitRepeatableSportCompletion =
            completedInstanceSet.has(instanceKey) ||
            grades[gradeKey(id, semester)] !== undefined ||
            !!binaryPass[id] ||
            explicitSportCompletionSet.has(id);
          if (!hasExplicitRepeatableSportCompletion) continue;
        } else if (!shouldCountCourseForGeneralRequirements(id, explicitSportCompletionSet)) {
          continue;
        }
        courseRefs.push({
          courseId: id,
          name: sap.name,
          credits: sap.credits,
          language: isCourseTaughtInEnglish(sap, englishTaughtCourses) ? 'EN' : 'HE',
          isLab: labPoolSet.has(id),
        });
      } else {
        if (!shouldCountCourseForGeneralRequirements(id, explicitSportCompletionSet)) continue;
        if (nonRepeatableSeen.has(id)) continue;
        nonRepeatableSeen.add(id);
        courseRefs.push({
          courseId: id,
          name: sap.name,
          credits: sap.credits,
          language: isCourseTaughtInEnglish(sap, englishTaughtCourses) ? 'EN' : 'HE',
          isLab: labPoolSet.has(id),
        });
      }
    }
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

    if (rule.id === 'english') {
      return {
        ...rule,
        courseMatcher: {
          predicate: (course) => {
            if (course.language !== 'EN') return false;
            const isTechnicalEnglish = course.name.includes('אנגלית');

            if (englishScore === undefined) {
              return true;
            }

            if (englishScore >= 104 && englishScore <= 119) {
              return isTechnicalEnglish;
            }

            if (englishScore >= 120 && englishScore <= 133) {
              return course.name.includes("מתקדמים ב'") ||
                course.name.includes('מתקדמים ב') ||
                !isTechnicalEnglish;
            }

            if (englishScore >= 134 && englishScore <= 150) {
              return !isTechnicalEnglish;
            }

            return true;
          },
        },
      };
    }

    return rule;
  });

  const activeRules = rules.filter(
    (rule) => rule.id !== 'labs' || trackDef.labPool !== undefined,
  );

  return calculateGeneralRequirements(courseRefs, activeRules);
}
