import type { SapCourse } from '../../types';
import {
  englishCourseIds,
  humanitiesFreeElectiveCourses,
  melagCourseIds,
  sometimesEnglishMelagCourseIds,
} from './generatedCourseLists';
import { bareId } from '../../utils/occurrenceId';
import { DEFAULT_GLOBAL_COURSE_SETTINGS } from '../../types/firestoreRules';
import type { GlobalCourseSettings } from '../../types/firestoreRules';

const CHOIR_ORCHESTRA_COURSE_IDS = new Set(['03940587', '03940582']);

// Runtime-configurable sport settings (overridden by Firestore on startup)
let _sportConfig: GlobalCourseSettings['sport'] = DEFAULT_GLOBAL_COURSE_SETTINGS.sport;
let _teamCourseIds = new Set(_sportConfig.teamCourseIds);

export function applyGlobalCourseSettings(settings: GlobalCourseSettings): void {
  _sportConfig = settings.sport;
  _teamCourseIds = new Set(settings.sport.teamCourseIds);
  _facultyAreaPrefixes = settings.facultyAreaPrefixes;
}

export function getActiveFacultyAreaPrefixes(): Record<string, string[]> {
  // Returns the currently active faculty→prefix mapping.
  // After startup, this reflects Firestore settings; before load, defaults.
  return _facultyAreaPrefixes;
}

let _facultyAreaPrefixes: Record<string, string[]> = DEFAULT_GLOBAL_COURSE_SETTINGS.facultyAreaPrefixes;
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

export function isManualEnglishEligible(id: string): boolean {
  return sometimesEnglishMelagCourseIds.has(bareId(id));
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

export function isEnglishCourseId(id: string): boolean {
  return englishCourseIds.has(bareId(id));
}

export function isMelagCourseId(id: string): boolean {
  return melagCourseIds.has(bareId(id));
}

export function isHumanitiesFreeElectiveCourseId(id: string): boolean {
  const cid = bareId(id);
  return humanitiesFreeElectiveCourses.some((course) => course.id === cid);
}

export function isFreeElectiveCourseId(id: string): boolean {
  return isMelagCourseId(id) || isHumanitiesFreeElectiveCourseId(id);
}

export function isChoirOrOrchestraCourseId(id: string): boolean {
  return CHOIR_ORCHESTRA_COURSE_IDS.has(bareId(id));
}

export function isSportsTeamCourseId(id: string): boolean {
  return _teamCourseIds.has(bareId(id));
}

export function isSportCourseId(id: string): boolean {
  const cid = bareId(id);
  const inRange = _sportConfig.ranges.some((r) => isCourseIdInInclusiveRange(cid, r.start, r.end));
  return inRange && !isHumanitiesFreeElectiveCourseId(cid);
}

export function isRegularSportCourseId(id: string): boolean {
  return isSportCourseId(id) && !isSportsTeamCourseId(id);
}

export function isAdvancedDegreeCourseId(id: string): boolean {
  return bareId(id).startsWith('0048');
}

export { humanitiesFreeElectiveCourses };
