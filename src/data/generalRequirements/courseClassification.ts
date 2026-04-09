import type { SapCourse } from '../../types';
import {
  englishCourseIds,
  melagCourseIds,
  sometimesEnglishMelagCourseIds,
} from './generatedCourseLists';

function normalizeCourseName(name: string): string {
  return name.replace(/['׳"]/g, '');
}

export function isTechnicalEnglishCourseName(name: string): boolean {
  const normalized = normalizeCourseName(name);
  return normalized.includes('אנגלית טכנית') && (
    normalized.includes('מתקדמים א') ||
    normalized.includes('מתקדמים ב')
  );
}

export function isManualEnglishEligible(courseId: string): boolean {
  return sometimesEnglishMelagCourseIds.has(courseId);
}

export function isCourseTaughtInEnglish(
  course: Pick<SapCourse, 'id' | 'isEnglish' | 'name'>,
  englishTaughtCourses: string[]
): boolean {
  return !!course.isEnglish ||
    isTechnicalEnglishCourseName(course.name) || (
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
