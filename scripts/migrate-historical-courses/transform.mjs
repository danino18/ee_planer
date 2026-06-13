// Maps a single historical course record's `general` block (technion-ug-info-fetcher
// format) to the subset of SapCourse fields the application actually uses.
//
// Deliberately NOT included:
// - syllabus (dropped to keep generated data small)
// - English name, corequisites (no corequisite field on SapCourse)
// - lecture/tutorial/lab/seminar hours, notes (no corresponding SapCourse fields)
// - examMoed1/examMoed2 and schedule (historical schedule/exam data must not be
//   presented as current information)
// - teachingSemester, isEnglish, sapAverage (unknown for historical courses;
//   isEnglish is derived automatically for all merged courses by sapApi.ts)

import { normalizeIdList, normalizePrerequisiteGroups } from './normalize.mjs';

export async function mapGeneralToSapCourse(general, normalizedId) {
  const creditsRaw = parseFloat(general?.['נקודות'] ?? '0');

  return {
    id: normalizedId,
    name: general?.['שם מקצוע'] ?? normalizedId,
    credits: Number.isNaN(creditsRaw) ? 0 : creditsRaw,
    prerequisites: await normalizePrerequisiteGroups(general?.['מקצועות קדם']),
    noAdditionalCreditIds: await normalizeIdList(general?.['מקצועות ללא זיכוי נוסף']),
    containedCourseIds: await normalizeIdList(general?.['מקצועות ללא זיכוי נוסף (מוכלים)']),
    faculty: general?.['פקולטה'] ?? '',
  };
}
