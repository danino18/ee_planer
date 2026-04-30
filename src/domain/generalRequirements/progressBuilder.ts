import type { SapCourse, TrackDefinition } from '../../types';
import { GENERAL_REQUIREMENTS_RULES } from '../../data/generalRequirements/generalRules';
import {
  isChoirOrOrchestraCourseId,
  isCourseTaughtInEnglish,
  isFreeElectiveCourseId,
  isRegularSportCourseId,
  isSportCourseId,
  isSportsTeamCourseId,
} from '../../data/generalRequirements/courseClassification';
import { gradeKey, REPEATABLE_COURSES } from '../../utils/courseGrades';
import { calculateGeneralRequirements } from './rulesEngine';
import type { CourseRef, GeneralRequirementRule, GeneralRequirementProgress } from './types';
import { calculateSpecialEnrichmentAllocation } from './specialAllocation';

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
  generalElectiveCourseIds?: Iterable<string>;
  generalElectiveCredits?: Iterable<[string, number]>;
  noAdditionalCreditCourseIds?: Iterable<string>;
}

function shouldCountCourseForGeneralRequirements(
  courseId: string,
  explicitSportCompletionSet: Set<string>,
): boolean {
  if (!isSportCourseId(courseId)) return true;
  return explicitSportCompletionSet.has(courseId);
}

function buildCourseRef(
  id: string,
  credits: number,
  courses: Map<string, SapCourse>,
  englishTaughtCourses: string[],
  labPoolSet: Set<string>,
): CourseRef | null {
  const sap = courses.get(id);
  if (!sap) return null;
  return {
    courseId: id,
    name: sap.name,
    credits,
    language: isCourseTaughtInEnglish(sap, englishTaughtCourses) ? 'EN' : 'HE',
    isLab: labPoolSet.has(id),
  };
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
  generalElectiveCourseIds = [],
  generalElectiveCredits = [],
  noAdditionalCreditCourseIds = [],
}: BuildGeneralRequirementsParams): GeneralRequirementProgress[] {
  const labPoolSet = new Set(trackDef.labPool?.courses ?? []);
  const explicitSportCompletionSet = new Set(explicitSportCompletions);
  const completedInstanceSet = new Set(completedInstances);
  const generalElectiveCourseIdSet = new Set(generalElectiveCourseIds);
  const generalElectiveCreditsByCourseId = new Map(generalElectiveCredits);
  const noAdditionalCreditCourseIdSet = new Set(noAdditionalCreditCourseIds);
  const courseRefs: CourseRef[] = [];
  const specialCourseRefs: CourseRef[] = [];
  const nonRepeatableSeen = new Set<string>([...completedCourses]);

  const pushCourseRef = (id: string, credits: number): void => {
    if (noAdditionalCreditCourseIdSet.has(id)) return;
    const courseRef = buildCourseRef(id, credits, courses, englishTaughtCourses, labPoolSet);
    if (!courseRef) return;
    if (isChoirOrOrchestraCourseId(id) || isSportsTeamCourseId(id)) {
      specialCourseRefs.push(courseRef);
    } else {
      courseRefs.push(courseRef);
    }
  };

  for (const id of nonRepeatableSeen) {
    if (REPEATABLE_COURSES.has(id) && isSportCourseId(id)) continue;
    if (!shouldCountCourseForGeneralRequirements(id, explicitSportCompletionSet)) continue;
    const sap = courses.get(id);
    if (!sap) continue;
    pushCourseRef(id, sap.credits);
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
        pushCourseRef(id, sap.credits);
      } else {
        if (!shouldCountCourseForGeneralRequirements(id, explicitSportCompletionSet)) continue;
        if (!isChoirOrOrchestraCourseId(id) && !isSportsTeamCourseId(id)) {
          if (nonRepeatableSeen.has(id)) continue;
          nonRepeatableSeen.add(id);
        }
        pushCourseRef(id, sap.credits);
      }
    }
  }

  const choirOrOrchestraCredits = specialCourseRefs.reduce(
    (sum, course) => sum + (isChoirOrOrchestraCourseId(course.courseId) ? course.credits : 0),
    0,
  );
  const sportsTeamCredits = specialCourseRefs.reduce(
    (sum, course) => sum + (isSportsTeamCourseId(course.courseId) ? course.credits : 0),
    0,
  );
  const specialAllocation = calculateSpecialEnrichmentAllocation({
    choirOrOrchestraCredits,
    sportsTeamCredits,
  });
  let remainingRecognizedChoirOrOrchestraCredits =
    specialAllocation.recognizedChoirOrOrchestraCredits;
  let remainingRecognizedSportsTeamCredits = specialAllocation.recognizedSportsTeamCredits;
  const recognizedSpecialRefs: CourseRef[] = [];
  for (const courseRef of specialCourseRefs) {
    if (isChoirOrOrchestraCourseId(courseRef.courseId)) {
      const credits = Math.min(courseRef.credits, remainingRecognizedChoirOrOrchestraCredits);
      remainingRecognizedChoirOrOrchestraCredits -= credits;
      if (credits > 0) recognizedSpecialRefs.push({ ...courseRef, credits });
    } else if (isSportsTeamCourseId(courseRef.courseId)) {
      const credits = Math.min(courseRef.credits, remainingRecognizedSportsTeamCredits);
      remainingRecognizedSportsTeamCredits -= credits;
      if (credits > 0) recognizedSpecialRefs.push({ ...courseRef, credits });
    }
  }
  const requirementCourseRefs = [...courseRefs, ...recognizedSpecialRefs];

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
        courseMatcher: {
          predicate: (course) =>
            generalElectiveCreditsByCourseId.has(course.courseId) ||
            generalElectiveCourseIdSet.has(course.courseId) ||
            isFreeElectiveCourseId(course.courseId) ||
            isRegularSportCourseId(course.courseId) ||
            isChoirOrOrchestraCourseId(course.courseId) ||
            isSportsTeamCourseId(course.courseId),
        },
        valueGetter: (course) => generalElectiveCreditsByCourseId.get(course.courseId) ?? course.credits,
      };
    }

    if (rule.id === 'free_elective') {
      return {
        ...rule,
        targetValue: specialAllocation.enrichmentRequired,
        courseMatcher: {
          predicate: (course) =>
            isFreeElectiveCourseId(course.courseId) &&
            !isChoirOrOrchestraCourseId(course.courseId) &&
            !isSportsTeamCourseId(course.courseId),
        },
      };
    }

    if (rule.id === 'sport') {
      return {
        ...rule,
        targetValue: specialAllocation.sportRequired,
        courseMatcher: {
          predicate: (course) => isRegularSportCourseId(course.courseId),
        },
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

  return calculateGeneralRequirements(requirementCourseRefs, activeRules);
}
