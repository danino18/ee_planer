import type { SapCourse } from '../../types';
import {
  englishCourseIds,
  humanitiesFreeElectiveCourses,
  melagCourseIds,
  sometimesEnglishMelagCourseIds,
} from './generatedCourseLists';

const SPORT_RANGE_START = '03940800';
const SPORT_RANGE_END = '03940820';
const TECHNICAL_ENGLISH_NAME = '\u05d0\u05e0\u05d2\u05dc\u05d9\u05ea \u05d8\u05db\u05e0\u05d9\u05ea';
const ADVANCED_A_NAME = '\u05de\u05ea\u05e7\u05d3\u05de\u05d9\u05dd \u05d0';
const ADVANCED_B_NAME = '\u05de\u05ea\u05e7\u05d3\u05de\u05d9\u05dd \u05d1';

function normalizeCourseName(name: string): string {
  return name.replace(/['\u05F3"]/g, '');
}

function isCourseIdInInclusiveRange(courseId: string, start: string, end: string): boolean {
  return courseId >= start && courseId <= end;
}

export function isTechnicalEnglishAdvancedAName(name: string): boolean {
  const normalized = normalizeCourseName(name);
  return normalized.includes(TECHNICAL_ENGLISH_NAME) && normalized.includes(ADVANCED_A_NAME);
}

export function isTechnicalEnglishAdvancedBName(name: string): boolean {
  const normalized = normalizeCourseName(name);
  return normalized.includes(TECHNICAL_ENGLISH_NAME) && normalized.includes(ADVANCED_B_NAME);
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
  const isSportRangeCourse = isCourseIdInInclusiveRange(courseId, SPORT_RANGE_START, SPORT_RANGE_END);
  return (isSportRangeCourse || /^039409/.test(courseId)) && !isHumanitiesFreeElectiveCourseId(courseId);
}

export { humanitiesFreeElectiveCourses };
