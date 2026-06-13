// Compares the merged historical course collection against the set of course
// ids currently available in the application and decides what should be
// inserted.

import { convertCourseNumber } from './normalize.mjs';

/**
 * @param {object} args
 * @param {{ courses: Map<string, object>, latestSemesterById: Map<string,string>,
 *   rejections: any[], conversions: any[], conflicts: any[] }} args.historical
 *   Result of mergeSemesters().
 * @param {Iterable<string>} args.existingIds
 *   Course ids currently available in the application (current SAP + existing
 *   static fallback lists), in whatever format they're stored.
 * @param {Set<string>} [args.existingHistoricalIds]
 *   Ids already present in a previously-generated historical fallback file
 *   (idempotency safety net for re-runs).
 */
export async function buildMigrationPlan({ historical, existingIds, existingHistoricalIds = new Set() }) {
  const normalizedExisting = new Set();
  for (const id of existingIds) {
    const conv = await convertCourseNumber(id);
    if (conv.ok) normalizedExisting.add(conv.normalized);
  }

  const alreadyExists = [];
  const missingFromCurrent = [];
  const toInsert = [];

  for (const [id, course] of historical.courses) {
    if (normalizedExisting.has(id)) {
      alreadyExists.push(id);
      continue;
    }

    missingFromCurrent.push(course);

    if (!existingHistoricalIds.has(id)) {
      toInsert.push(course);
    }
  }

  missingFromCurrent.sort((a, b) => a.id.localeCompare(b.id));
  toInsert.sort((a, b) => a.id.localeCompare(b.id));
  alreadyExists.sort();

  return {
    toInsert,
    missingFromCurrent,
    alreadyExists,
    uniqueHistoricalCount: historical.courses.size,
    rejections: historical.rejections,
    conversions: historical.conversions,
    conflicts: historical.conflicts,
    latestSemesterById: historical.latestSemesterById,
  };
}
