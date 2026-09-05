import type {
  SapCourse,
  SemesterScheduleAlternativeGroup,
  SemesterScheduleEntry,
  TrackDefinition,
} from '../../types';
import {
  isTechnicalEnglishAdvancedAName,
  isTechnicalEnglishAdvancedBName,
} from '../generalRequirements/courseClassification';

/**
 * A score of 120+ fully exempts the student from Advanced English A, and a
 * score of 134+ additionally exempts from Advanced English B (see the
 * bracket rules in usePlan.ts/progressBuilder.ts) — so a fixed-schedule
 * course matching either name should stop being recommended/counted as
 * mandatory once the corresponding threshold is reached.
 */
export function shouldHideRecommendedCourse(
  courseId: string,
  courses: Map<string, SapCourse>,
  englishScore?: number,
): boolean {
  if (englishScore === undefined || englishScore < 120 || englishScore > 150) {
    return false;
  }

  const course = courses.get(courseId);
  if (!course) return false;

  if (isTechnicalEnglishAdvancedAName(course.name)) return true;
  if (englishScore >= 134 && isTechnicalEnglishAdvancedBName(course.name)) return true;
  return false;
}

export function getAllSemesterEntryCourseIds(entry: SemesterScheduleEntry): string[] {
  return [
    ...entry.courses,
    ...(entry.alternativeGroups?.flatMap((group) => group.courseIds) ?? []),
  ];
}

export function getAllScheduledCourseIds(trackDef: TrackDefinition): string[] {
  return trackDef.semesterSchedule.flatMap(getAllSemesterEntryCourseIds);
}

export function getRecommendedCourseIdsForEntry(
  entry: SemesterScheduleEntry,
  courses: Map<string, SapCourse>,
  englishScore?: number,
): string[] {
  const ids: string[] = [];

  for (const courseId of entry.courses) {
    if (!shouldHideRecommendedCourse(courseId, courses, englishScore)) {
      ids.push(courseId);
    }
  }

  for (const group of entry.alternativeGroups ?? []) {
    const preferredIds = group.showBoth
      ? group.courseIds
      : [group.defaultCourseId ?? group.courseIds[0]];

    for (const courseId of preferredIds) {
      if (!shouldHideRecommendedCourse(courseId, courses, englishScore)) {
        ids.push(courseId);
      }
    }
  }

  return ids;
}

export function getVisibleMandatoryCourseIds(
  trackDef: TrackDefinition,
  courses: Map<string, SapCourse>,
  englishScore?: number,
): Set<string> {
  return new Set(
    getAllScheduledCourseIds(trackDef).filter((courseId) => (
      !shouldHideRecommendedCourse(courseId, courses, englishScore)
    )),
  );
}

export function getSatisfiedAlternativeCourseId(
  group: SemesterScheduleAlternativeGroup,
  placedCourseIds: Set<string>,
  courses: Map<string, SapCourse>,
  englishScore?: number,
): string | null {
  for (const courseId of group.courseIds) {
    if (shouldHideRecommendedCourse(courseId, courses, englishScore)) {
      continue;
    }

    if (placedCourseIds.has(courseId)) {
      return courseId;
    }
  }

  return null;
}
