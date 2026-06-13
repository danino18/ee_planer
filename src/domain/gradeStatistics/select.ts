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

/**
 * Resolve the statistic to use for one course given the semester selection.
 *
 * - `'latest'`  → the newest semester that has a record (records already store
 *   only the primary category, one per semester).
 * - specific code → only that exact semester; never falls back to another.
 *
 * Returns `null` when no matching record exists.
 */
export function resolveStatistic(
  records: CourseGradeStatistics[] | undefined,
  selection: StatisticsSemesterSelection,
): ResolvedStatistic | null {
  if (!records || records.length === 0) return null;

  let chosen: CourseGradeStatistics | null = null;
  if (selection === 'latest') {
    for (const record of records) {
      if (!chosen || compareSemesters(record.semester, chosen.semester) > 0) {
        chosen = record;
      }
    }
  } else {
    for (const record of records) {
      if (record.semester === selection) {
        chosen = record;
        break;
      }
    }
  }

  if (!chosen) return null;
  return {
    semester: chosen.semester,
    category: chosen.category,
    average: chosen.average,
    median: chosen.median,
    students: chosen.students,
  };
}
