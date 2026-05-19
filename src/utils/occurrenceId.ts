export const OCCURRENCE_SEP = '~';

/** Returns true iff id ends with ~N (N is a positive integer) */
export function isOccurrenceId(id: string): boolean {
  const i = id.lastIndexOf(OCCURRENCE_SEP);
  if (i < 1) return false;
  return /^\d+$/.test(id.slice(i + 1));
}

/** Strips the ~N suffix to return the raw SAP courseId */
export function bareId(id: string): string {
  if (!isOccurrenceId(id)) return id;
  return id.slice(0, id.lastIndexOf(OCCURRENCE_SEP));
}

export function makeOccurrenceId(courseId: string, n: number): string {
  return `${courseId}${OCCURRENCE_SEP}${n}`;
}

/**
 * Returns the next available occurrence ID for courseId, given all IDs
 * currently in the plan (semesters + completedCourses etc.).
 */
export function nextOccurrenceId(courseId: string, allExistingIds: Iterable<string>): string {
  let max = 0;
  const prefix = courseId + OCCURRENCE_SEP;
  for (const id of allExistingIds) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return makeOccurrenceId(courseId, max + 1);
}

/** Flattens all semester course arrays into a single iterable */
export function allSemesterIds(semesters: Record<number, string[]>): string[] {
  return Object.values(semesters).flat();
}
