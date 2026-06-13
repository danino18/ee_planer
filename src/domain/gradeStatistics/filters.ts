/**
 * Pure, testable filtering + sorting for the course catalog.
 *
 * The whole visible-course pipeline lives here so the card, filter panel and
 * sort control all share one implementation. Academic-property and free-text
 * query matching are injected by the caller (they depend on generated data /
 * remote rating state), keeping this module dependency-light and deterministic.
 */
import type {
  CourseFilters,
  ResolvedStatistic,
  SortBy,
  SortDirection,
  SubjectId,
} from './types';
import { courseMatchesSubject } from '../../utils/subjects';
import { toSapEightDigitCourseIdForStorage } from '../../utils/courseNumberNormalize';
import { bareId } from '../../utils/occurrenceId';

export interface CourseLike {
  id: string;
  name: string;
  credits: number;
}

export function defaultFilters(): CourseFilters {
  return {
    subjects: [],
    english: false,
    melag: false,
    freeElective: false,
    advancedDegree: false,
    winter: false,
    spring: false,
    minRating: 0,
    statisticsSemester: 'general',
    averageMin: null,
    medianMin: null,
    minStudents: null,
    sortBy: 'default',
    sortDirection: 'asc',
  };
}

/** Reset only filter/sort state to its clean default. */
export const resetFilters = defaultFilters;

export function matchesSubjects(courseId: string, subjects: SubjectId[]): boolean {
  if (subjects.length === 0) return true; // no subject filter
  return subjects.some((subject) => courseMatchesSubject(courseId, subject));
}

function atLeast(value: number | null, min: number | null): boolean {
  if (min === null) return true; // filter inactive
  if (value === null) return false; // active filter excludes missing data
  return value >= min;
}

export function matchesAverageMin(stat: ResolvedStatistic | null, min: number | null): boolean {
  return atLeast(stat?.average ?? null, min);
}

export function matchesMedianMin(stat: ResolvedStatistic | null, min: number | null): boolean {
  return atLeast(stat?.median ?? null, min);
}

export function matchesMinStudents(stat: ResolvedStatistic | null, min: number | null): boolean {
  if (min === null) return true;
  if (stat?.students == null) return false;
  return stat.students >= min;
}

function canonical(id: string): string {
  return toSapEightDigitCourseIdForStorage(bareId(id));
}

/** Deterministic secondary key so equal primaries sort consistently. */
function secondaryCompare(a: CourseLike, b: CourseLike): number {
  const ca = canonical(a.id);
  const cb = canonical(b.id);
  return ca < cb ? -1 : ca > cb ? 1 : 0;
}

function gradeOf(stat: ResolvedStatistic | null, sortBy: SortBy): number | null {
  if (sortBy === 'average') return stat?.average ?? null;
  if (sortBy === 'median') return stat?.median ?? null;
  return null;
}

/**
 * Sort a copy of `courses`. Missing grade values are always placed last
 * regardless of direction; equal values fall back to course number. `default`
 * preserves the incoming order (stable).
 */
export function sortCourses<T extends CourseLike>(
  courses: T[],
  getStat: (course: T) => ResolvedStatistic | null,
  sortBy: SortBy,
  direction: SortDirection,
): T[] {
  const decorated = courses.map((course, index) => ({ course, index }));
  const dir = direction === 'asc' ? 1 : -1;

  decorated.sort((x, y) => {
    let primary = 0;
    switch (sortBy) {
      case 'default':
        primary = 0;
        break;
      case 'courseNumber': {
        const cmp = secondaryCompare(x.course, y.course);
        primary = cmp * dir;
        break;
      }
      case 'courseName': {
        const cmp = x.course.name.localeCompare(y.course.name, 'he');
        primary = cmp * dir;
        break;
      }
      case 'credits':
        primary = (x.course.credits - y.course.credits) * dir;
        break;
      case 'average':
      case 'median': {
        const gx = gradeOf(getStat(x.course), sortBy);
        const gy = gradeOf(getStat(y.course), sortBy);
        if (gx === null && gy === null) primary = 0;
        else if (gx === null) return 1; // x missing → after y
        else if (gy === null) return -1; // y missing → after x
        else primary = (gx - gy) * dir;
        break;
      }
    }
    if (primary !== 0) return primary;
    // `default` keeps the incoming order; explicit sorts get a deterministic
    // course-number tiebreak before falling back to original index.
    if (sortBy !== 'default') {
      const sec = secondaryCompare(x.course, y.course);
      if (sec !== 0) return sec;
    }
    return x.index - y.index; // stable
  });

  return decorated.map((d) => d.course);
}

export interface PipelineHooks<T extends CourseLike> {
  /** Academic-property predicate (english/מל"ג/winter/…); default: always true. */
  matchesAcademic?: (course: T) => boolean;
  /** Free-text query predicate; default: always true. */
  matchesQuery?: (course: T) => boolean;
  /** Cap the result list (the catalog currently shows 50). */
  limit?: number;
}

/**
 * The single visible-course pipeline:
 * resolve stats → subjects (OR) → academic → grade ranges + min students →
 * query → stable sort → limit. Never mutates `courses`.
 */
export function computeVisibleCourses<T extends CourseLike>(
  courses: T[],
  getStat: (course: T) => ResolvedStatistic | null,
  filters: CourseFilters,
  hooks: PipelineHooks<T> = {},
): T[] {
  const matchesAcademic = hooks.matchesAcademic ?? (() => true);
  const matchesQuery = hooks.matchesQuery ?? (() => true);

  const filtered: T[] = [];
  for (const course of courses) {
    if (!matchesSubjects(course.id, filters.subjects)) continue;
    if (!matchesAcademic(course)) continue;
    const stat = getStat(course);
    if (!matchesAverageMin(stat, filters.averageMin)) continue;
    if (!matchesMedianMin(stat, filters.medianMin)) continue;
    if (!matchesMinStudents(stat, filters.minStudents)) continue;
    if (!matchesQuery(course)) continue;
    filtered.push(course);
  }

  const sorted = sortCourses(filtered, getStat, filters.sortBy, filters.sortDirection);
  if (hooks.limit !== undefined && sorted.length > hooks.limit) {
    return sorted.slice(0, hooks.limit);
  }
  return sorted;
}
