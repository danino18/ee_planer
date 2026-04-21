import type { SapCourse, StudentPlan } from '../types';

export const REPEATABLE_COURSES = new Set([
  '03940900', '03940901', '03940902', '03940800',
]);

export function gradeKey(courseId: string, semester?: number): string {
  return REPEATABLE_COURSES.has(courseId) && semester !== undefined && semester > 0
    ? `${courseId}_${semester}`
    : courseId;
}

export function moveRepeatableCourseGrade(
  grades: Record<string, number>,
  courseId: string,
  fromSemester: number,
  toSemester: number,
): Record<string, number> {
  if (
    !REPEATABLE_COURSES.has(courseId)
    || fromSemester <= 0
    || toSemester <= 0
  ) {
    return grades;
  }

  const fromKey = gradeKey(courseId, fromSemester);
  const toKey = gradeKey(courseId, toSemester);
  if (fromKey === toKey || grades[fromKey] === undefined) return grades;

  const nextGrades = { ...grades };
  nextGrades[toKey] = grades[fromKey];
  delete nextGrades[fromKey];
  return nextGrades;
}

export function clearRepeatableCourseSemesterGrade(
  grades: Record<string, number>,
  courseId: string,
  semester: number,
): Record<string, number> {
  if (!REPEATABLE_COURSES.has(courseId) || semester <= 0) return grades;

  const key = gradeKey(courseId, semester);
  if (grades[key] === undefined) return grades;

  const nextGrades = { ...grades };
  delete nextGrades[key];
  return nextGrades;
}

export function sanitizeRepeatableCourseGrades(
  semesters: Record<number, string[]>,
  grades: Record<string, number>,
): Record<string, number> {
  const validGradeKeys = new Set<string>();
  for (const [semesterKey, courseIds] of Object.entries(semesters)) {
    const semester = Number(semesterKey);
    if (semester <= 0) continue;

    for (const courseId of courseIds) {
      if (!REPEATABLE_COURSES.has(courseId)) continue;
      validGradeKeys.add(gradeKey(courseId, semester));
    }
  }

  let changed = false;
  const nextGrades = { ...grades };
  for (const key of Object.keys(grades)) {
    if (!key.includes('_')) continue;
    const [courseId] = key.split('_');
    if (!REPEATABLE_COURSES.has(courseId) || validGradeKeys.has(key)) continue;

    delete nextGrades[key];
    changed = true;
  }

  return changed ? nextGrades : grades;
}

export interface WeightedAverageInput {
  semesters: StudentPlan['semesters'];
  grades: StudentPlan['grades'];
  binaryPass?: StudentPlan['binaryPass'];
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

  for (const [sem, courseIds] of semesterEntries) {
    if (sem <= 0) continue;

    for (const courseId of courseIds) {
      const key = gradeKey(courseId, sem);
      if (seenGradeKeys.has(key) || binaryPass[courseId]) continue;
      seenGradeKeys.add(key);

      const grade = input.grades[key];
      const credits = courses.get(courseId)?.credits ?? 0;
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
