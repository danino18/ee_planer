import type { SapCourse, StudentPlan } from '../types';
import {
  isChoirOrOrchestraCourseId,
  isSportCourseId,
} from '../data/generalRequirements/courseClassification';
import { bareId, isOccurrenceId } from './occurrenceId';

export const REPEATABLE_COURSES: Pick<Set<string>, 'has'> = {
  has: (id) => {
    const cid = bareId(id);
    return isSportCourseId(cid) || isChoirOrOrchestraCourseId(cid);
  },
};

/**
 * Returns the grade-map key for a course.
 * For occurrence IDs (repeatable courses), the occurrence ID itself is the
 * stable key — no semester suffix needed.
 * For regular courses, just the courseId.
 */
export function gradeKey(courseId: string, _semester?: number): string {
  return courseId;
}

/** No-op: occurrence-ID grade keys are stable across semester moves. */
export function moveRepeatableCourseGrade(
  grades: Record<string, number>,
  _courseId: string,
  _fromSemester: number,
  _toSemester: number,
): Record<string, number> {
  return grades;
}

/** No-op: with occurrence IDs the grade key doesn't encode a semester. */
export function clearRepeatableCourseSemesterGrade(
  grades: Record<string, number>,
  _courseId: string,
  _semester: number,
): Record<string, number> {
  return grades;
}

/**
 * Removes grade entries whose occurrence ID is no longer present in any
 * semester. Old-format `courseId_semester` keys are also cleaned up here.
 */
export function sanitizeRepeatableCourseGrades(
  semesters: Record<number, string[]>,
  grades: Record<string, number>,
): Record<string, number> {
  const validOccurrenceIds = new Set<string>();
  for (const ids of Object.values(semesters)) {
    for (const id of ids) {
      if (REPEATABLE_COURSES.has(id)) validOccurrenceIds.add(id);
    }
  }

  let changed = false;
  const nextGrades = { ...grades };
  for (const key of Object.keys(grades)) {
    if (!REPEATABLE_COURSES.has(key)) continue;
    if (!validOccurrenceIds.has(key)) {
      delete nextGrades[key];
      changed = true;
    }
  }

  // Also purge legacy courseId_semester keys that may exist in migrated data.
  for (const key of Object.keys(nextGrades)) {
    if (key.includes('_') && !isOccurrenceId(key)) {
      const [base] = key.split('_');
      if (REPEATABLE_COURSES.has(base)) {
        delete nextGrades[key];
        changed = true;
      }
    }
  }

  return changed ? nextGrades : grades;
}

export interface WeightedAverageInput {
  semesters: StudentPlan['semesters'];
  grades: StudentPlan['grades'];
  binaryPass?: StudentPlan['binaryPass'];
  noAdditionalCreditCourseIds?: Iterable<string>;
}

function getPlacedGradeEntries(
  input: WeightedAverageInput,
  courses: Map<string, SapCourse>,
  semester?: number,
) {
  const entries: Array<{ grade: number; credits: number }> = [];
  const seenGradeKeys = new Set<string>();
  const semesterEntries = semester !== undefined
    ? [[semester, input.semesters[semester] ?? []] as const]
    : Object.entries(input.semesters).map(([sem, courseIds]) => [Number(sem), courseIds] as const);
  const binaryPass = input.binaryPass ?? {};
  const noAdditionalCreditCourseIds = new Set(input.noAdditionalCreditCourseIds ?? []);

  for (const [sem, courseIds] of semesterEntries) {
    if (sem <= 0) continue;

    for (const courseId of courseIds) {
      const key = gradeKey(courseId, sem);
      if (seenGradeKeys.has(key) || binaryPass[courseId] || noAdditionalCreditCourseIds.has(courseId)) continue;
      seenGradeKeys.add(key);

      const grade = input.grades[key];
      const credits = courses.get(bareId(courseId))?.credits ?? 0;
      if (grade === undefined || credits <= 0) continue;

      entries.push({ grade, credits });
    }
  }

  return entries;
}

export function computeWeightedAverage(
  input: WeightedAverageInput,
  courses: Map<string, SapCourse>,
  semester?: number,
): number | null {
  let totalWeightedSum = 0;
  let totalCredits = 0;

  for (const entry of getPlacedGradeEntries(input, courses, semester)) {
    totalWeightedSum += entry.grade * entry.credits;
    totalCredits += entry.credits;
  }

  return totalCredits > 0 ? totalWeightedSum / totalCredits : null;
}
