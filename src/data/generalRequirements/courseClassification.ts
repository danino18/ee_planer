import type { SapCourse } from '../../types';
import {
  englishCourseIds,
  melagCourseIds,
  sometimesEnglishMelagCourseIds,
} from './generatedCourseLists';

export function isManualEnglishEligible(courseId: string): boolean {
  return sometimesEnglishMelagCourseIds.has(courseId);
}

export function isCourseTaughtInEnglish(
  course: Pick<SapCourse, 'id' | 'isEnglish'>,
  englishTaughtCourses: string[]
): boolean {
  return !!course.isEnglish || (
    isManualEnglishEligible(course.id) && englishTaughtCourses.includes(course.id)
  );
}

export function isEnglishCourseId(courseId: string): boolean {
  return englishCourseIds.has(courseId);
}

export function isMelagCourseId(courseId: string): boolean {
  return melagCourseIds.has(courseId);
}

export function isSportCourseId(courseId: string): boolean {
  return courseId.startsWith('039');
}
