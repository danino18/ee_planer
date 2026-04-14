import type { SapCourse } from '../../types';
import {
  englishCourseIds,
  humanitiesFreeElectiveCourses,
  melagCourseIds,
  sometimesEnglishMelagCourseIds,
} from './generatedCourseLists';

function normalizeCourseName(name: string): string {
  return name.replace(/['׳"]/g, '');
}

export function isTechnicalEnglishAdvancedAName(name: string): boolean {
  const normalized = normalizeCourseName(name);
  return normalized.includes('אנגלית טכנית') && normalized.includes('מתקדמים א');
}

export function isTechnicalEnglishAdvancedBName(name: string): boolean {
  const normalized = normalizeCourseName(name);
  return normalized.includes('אנגלית טכנית') && normalized.includes('מתקדמים ב');
}

export function isTechnicalEnglishCourseName(name: string): boolean {
  return isTechnicalEnglishAdvancedAName(name) || isTechnicalEnglishAdvancedBName(name);
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

export function isHumanitiesFreeElectiveCourseId(courseId: string): boolean {
  return humanitiesFreeElectiveCourses.some((course) => course.id === courseId);
}

export function isFreeElectiveCourseId(courseId: string): boolean {
  return isMelagCourseId(courseId) || isHumanitiesFreeElectiveCourseId(courseId);
}

export function isSportCourseId(courseId: string): boolean {
  return /^(039408|039409)/.test(courseId) && !isHumanitiesFreeElectiveCourseId(courseId);
}

export { humanitiesFreeElectiveCourses };
