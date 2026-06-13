/**
 * Primary-statistic selection.
 *
 * A semester can contain several grade categories; we pick exactly one as the
 * representative ("primary") statistic for display/filtering/sorting. Priority
 * follows the CheeseFork convention: combined `Finals` first, then the first
 * final moed, then the first exam moed.
 */
import type {
  CourseGradeStatistics,
  GradeCategory,
  ResolvedStatistic,
  StatisticsSemesterSelection,
} from './types';
import { compareSemesters } from './semester';

export const PRIMARY_CATEGORY_PRIORITY: GradeCategory[] = ['Finals', 'Final_A', 'Exam_A'];

/**
 * Given the category-keyed object for a single semester, return the highest
 * priority category present (regardless of whether its values are valid).
 * Returns `null` when none of the supported categories exist.
 */
export function selectPrimaryCategory(
  semesterObj: Record<string, unknown>,
): GradeCategory | null {
  for (const category of PRIMARY_CATEGORY_PRIORITY) {
    const value = semesterObj[category];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return category;
    }
  }
  return null;
}

/** Minimum number of semesters with data required for the `כללי` aggregate. */
export const GENERAL_MIN_SEMESTERS = 3;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

function meanInt(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function toSemesterResolved(record: CourseGradeStatistics): ResolvedStatistic {
  return {
    kind: 'semester',
    semester: record.semester,
    category: record.category,
    average: record.average,
    median: record.median,
    students: record.students,
  };
}

function latest(records: CourseGradeStatistics[]): CourseGradeStatistics | null {
  let chosen: CourseGradeStatistics | null = null;
  for (const record of records) {
    if (!chosen || compareSemesters(record.semester, chosen.semester) > 0) chosen = record;
  }
  return chosen;
}

/**
 * The `כללי` aggregate: mean of all available semester averages and mean of all available
 * semester medians. Requires at least `GENERAL_MIN_SEMESTERS` semester records, and at
 * least one valid average or median. Returns `null` otherwise (caller falls back to latest).
 */
export function computeGeneralStatistic(
  records: CourseGradeStatistics[] | undefined,
): ResolvedStatistic | null {
  if (!records || records.length < GENERAL_MIN_SEMESTERS) return null;
  const averages = records.map((r) => r.average).filter((v): v is number => v !== null);
  const medians = records.map((r) => r.median).filter((v): v is number => v !== null);
  const studentCounts = records.map((r) => r.students).filter((v): v is number => v !== null);
  const average = mean(averages);
  const median = mean(medians);
  if (average === null && median === null) return null;
  return {
    kind: 'general',
    semester: null,
    category: null,
    average,
    median,
    // Average number of examinees per semester — keeps the min-students filter and the
    // card display meaningful (and comparable to per-semester mode) in general mode.
    students: meanInt(studentCounts),
    semesterCount: records.length,
  };
}

/**
 * Resolve the statistic to use for one course given the selection.
 *
 * - `'general'` → the `כללי` aggregate across semesters; for courses with fewer than
 *   `GENERAL_MIN_SEMESTERS` semesters of data it falls back to the latest semester.
 * - `'latest'`  → the newest semester that has a record.
 * - specific code → only that exact semester; never falls back to another.
 *
 * Returns `null` when no matching record exists.
 */
export function resolveStatistic(
  records: CourseGradeStatistics[] | undefined,
  selection: StatisticsSemesterSelection,
): ResolvedStatistic | null {
  if (!records || records.length === 0) return null;

  if (selection === 'general') {
    const general = computeGeneralStatistic(records);
    if (general) return general;
    const newest = latest(records); // fewer than the threshold → latest available
    return newest ? toSemesterResolved(newest) : null;
  }

  if (selection === 'latest') {
    const newest = latest(records);
    return newest ? toSemesterResolved(newest) : null;
  }

  const exact = records.find((record) => record.semester === selection);
  return exact ? toSemesterResolved(exact) : null;
}
