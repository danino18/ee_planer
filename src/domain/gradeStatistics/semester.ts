/**
 * Canonical semester representation + conversion for grade statistics.
 *
 * Reuses the existing CheeseFork semester formatter so there is a single
 * source of semester parsing logic across the app. Semester codes follow the
 * Technion convention `YYYYMM` where MM ∈ {01 = winter, 02 = spring, 03 = summer}.
 * Because the codes are fixed-width zero-padded, lexical comparison orders them
 * chronologically.
 */
import { formatCheeseForkSemester } from '../../services/cheesefork';

const SEMESTER_CODE = /^(\d{4})(0[123])$/;

/** True iff `code` is a valid `YYYY01|02|03` semester code. */
export function isValidSemesterCode(code: string): boolean {
  return SEMESTER_CODE.test(code);
}

/** Human-readable Hebrew label for a semester code (e.g. `סמסטר חורף 2024-2025`). */
export function formatSemester(code: string): string {
  return formatCheeseForkSemester(code);
}

/**
 * Compare two semester codes chronologically.
 * Returns <0 when `a` is older than `b`, >0 when newer, 0 when equal.
 */
export function compareSemesters(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
