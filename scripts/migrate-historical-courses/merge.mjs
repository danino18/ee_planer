// Merges historical course records across semester files into a single map
// keyed by normalized 8-digit course id.
//
// - Files are processed oldest -> newest.
// - The newest semester's record becomes the primary record for a course.
// - Fields that are "missing" in the newest record (undefined, '', or []) are
//   filled in from the most recent older record that has a value.
// - Non-missing fields that differ between the kept (newer) record and an
//   older record are reported as conflicts (newer value is kept).

import { mapGeneralToSapCourse } from './transform.mjs';
import { convertCourseNumber } from './normalize.mjs';

function isMissing(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function valuesDiffer(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/**
 * @param {Array<{ label: string, semesterKey: number, records: Array<{ general?: Record<string, string> }> }>} semesterFiles
 */
export async function mergeSemesters(semesterFiles) {
  const sorted = [...semesterFiles].sort((a, b) => a.semesterKey - b.semesterKey);

  const courses = new Map();
  const latestSemesterById = new Map();
  const rejections = [];
  const conversions = [];
  const conflicts = [];

  for (const file of sorted) {
    for (const record of file.records) {
      const rawId = record.general?.['מספר מקצוע'];
      const conv = await convertCourseNumber(rawId);

      if (!conv.ok) {
        rejections.push({ original: rawId ?? null, reason: conv.reason, semester: file.label });
        continue;
      }

      if (conv.original !== conv.normalized) {
        conversions.push({ original: conv.original, normalized: conv.normalized, semester: file.label });
      }

      const mapped = await mapGeneralToSapCourse(record.general, conv.normalized);
      const existing = courses.get(conv.normalized);

      if (!existing) {
        courses.set(conv.normalized, mapped);
      } else {
        const merged = { ...mapped };
        const fieldConflicts = [];

        for (const key of Object.keys(existing)) {
          if (isMissing(merged[key]) && !isMissing(existing[key])) {
            merged[key] = existing[key];
          } else if (
            !isMissing(merged[key])
            && !isMissing(existing[key])
            && valuesDiffer(merged[key], existing[key])
          ) {
            fieldConflicts.push({ field: key, kept: merged[key], discarded: existing[key] });
          }
        }

        if (fieldConflicts.length > 0) {
          conflicts.push({ id: conv.normalized, semester: file.label, fields: fieldConflicts });
        }

        courses.set(conv.normalized, merged);
      }

      latestSemesterById.set(conv.normalized, file.label);
    }
  }

  return { courses, latestSemesterById, rejections, conversions, conflicts };
}
