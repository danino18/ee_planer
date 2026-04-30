import type { SapCourse } from '../types';

export interface NoAdditionalCreditConflict {
  courseId: string;
  conflictingCourseId: string;
  pairKey: string;
  defaultUncreditedCourseId: string;
  uncreditedCourseId: string;
  isOverride: boolean;
}

export interface NoAdditionalCreditInput {
  completedCourses: string[];
  semesters: Record<number, string[]>;
  semesterOrder: number[];
  noAdditionalCreditOverrides?: Record<string, string>;
}

export function getNoAdditionalCreditPairKey(courseIdA: string, courseIdB: string): string {
  return [courseIdA, courseIdB].sort().join('__');
}

export function hasNoAdditionalCreditConflict(
  courseA: SapCourse | undefined,
  courseB: SapCourse | undefined,
): boolean {
  if (!courseA || !courseB || courseA.id === courseB.id) return false;
  return (
    (courseA.noAdditionalCreditIds ?? []).includes(courseB.id) ||
    (courseB.noAdditionalCreditIds ?? []).includes(courseA.id)
  );
}

export function getRecognizedCredits(
  course: SapCourse | undefined,
  noAdditionalCreditCourseIds?: ReadonlySet<string>,
): number {
  if (!course) return 0;
  return noAdditionalCreditCourseIds?.has(course.id) ? 0 : course.credits;
}

export function buildOrderedPlacedCourseIds(
  input: Pick<NoAdditionalCreditInput, 'completedCourses' | 'semesters' | 'semesterOrder'>,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const visit = (courseId: string): void => {
    if (!courseId || seen.has(courseId)) return;
    seen.add(courseId);
    ordered.push(courseId);
  };

  for (const courseId of input.completedCourses) visit(courseId);

  for (const semester of input.semesterOrder) {
    if (semester === 0) continue;
    for (const courseId of input.semesters[semester] ?? []) visit(courseId);
  }

  const orderedSemesterSet = new Set(input.semesterOrder);
  const remainingSemesters = Object.keys(input.semesters)
    .map(Number)
    .filter((semester) => semester !== 0 && !orderedSemesterSet.has(semester))
    .sort((a, b) => a - b);

  for (const semester of remainingSemesters) {
    for (const courseId of input.semesters[semester] ?? []) visit(courseId);
  }

  for (const courseId of input.semesters[0] ?? []) visit(courseId);

  return ordered;
}

export function computeNoAdditionalCreditConflicts(
  courses: Map<string, SapCourse>,
  input: NoAdditionalCreditInput,
): Map<string, NoAdditionalCreditConflict[]> {
  const conflicts = new Map<string, NoAdditionalCreditConflict[]>();
  const orderedCourseIds = buildOrderedPlacedCourseIds(input);
  const previousCourseIds: string[] = [];
  const overrides = input.noAdditionalCreditOverrides ?? {};

  for (const courseId of orderedCourseIds) {
    const course = courses.get(courseId);
    for (const previousCourseId of previousCourseIds) {
      const previousCourse = courses.get(previousCourseId);
      if (!hasNoAdditionalCreditConflict(course, previousCourse)) continue;

      const pairKey = getNoAdditionalCreditPairKey(courseId, previousCourseId);
      const overrideCourseId = overrides[pairKey];
      const uncreditedCourseId =
        overrideCourseId === courseId || overrideCourseId === previousCourseId
          ? overrideCourseId
          : courseId;
      const conflictingCourseId = uncreditedCourseId === courseId ? previousCourseId : courseId;
      const conflict: NoAdditionalCreditConflict = {
        courseId: uncreditedCourseId,
        conflictingCourseId,
        pairKey,
        defaultUncreditedCourseId: courseId,
        uncreditedCourseId,
        isOverride: uncreditedCourseId !== courseId,
      };
      const existing = conflicts.get(uncreditedCourseId) ?? [];
      if (!existing.some((item) => item.pairKey === pairKey)) {
        conflicts.set(uncreditedCourseId, [...existing, conflict]);
      }
    }
    previousCourseIds.push(courseId);
  }

  return conflicts;
}

export function getNoAdditionalCreditCourseIds(
  conflicts: Map<string, NoAdditionalCreditConflict[]>,
): Set<string> {
  return new Set(conflicts.keys());
}
