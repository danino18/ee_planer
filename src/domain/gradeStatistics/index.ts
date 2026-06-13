/**
 * Index grade-statistics records by canonical 8-digit course number.
 * Building the index once (rather than scanning all records per render) keeps
 * lookups O(1) during filtering/sorting.
 */
import type { CourseGradeStatistics } from './types';

export type GradeStatisticsIndex = Map<string, CourseGradeStatistics[]>;

export function buildIndex(records: CourseGradeStatistics[]): GradeStatisticsIndex {
  const index: GradeStatisticsIndex = new Map();
  for (const record of records) {
    const list = index.get(record.courseNumber);
    if (list) list.push(record);
    else index.set(record.courseNumber, [record]);
  }
  return index;
}

/** All distinct semester codes present in the dataset, newest first. */
export function collectSemesters(records: CourseGradeStatistics[]): string[] {
  const set = new Set<string>();
  for (const record of records) set.add(record.semester);
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

export type { CourseGradeStatistics } from './types';
