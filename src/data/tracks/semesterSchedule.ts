import type {
  SapCourse,
  SemesterScheduleAlternativeGroup,
  SemesterScheduleEntry,
  TrackDefinition,
} from '../../types';
import { isTechnicalEnglishCourseName } from '../generalRequirements/courseClassification';

function isTechnicalEnglishAdvancedB(
  course: Pick<SapCourse, 'name'> | undefined,
): boolean {
  if (!course) return false;
  const normalized = course.name.replace(/['׳"]/g, '');
  return isTechnicalEnglishCourseName(course.name) && normalized.includes('מתקדמים ב');
}

export function shouldHideRecommendedCourse(
  courseId: string,
  courses: Map<string, SapCourse>,
  englishScore?: number,
): boolean {
  if (englishScore === undefined || englishScore < 134 || englishScore > 150) {
    return false;
  }

  return isTechnicalEnglishAdvancedB(courses.get(courseId));
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
