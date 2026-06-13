/**
 * Grade-statistics domain types.
 *
 * Historical average/median grades imported from the public
 * `michael-maltsev/technion-histograms` data that CheeseFork consumes.
 * Statistics are stored per course + semester, keeping only the single
 * "primary" grade category selected at import time (see `select.ts`).
 */

/** Grade categories present in the technion-histograms data. */
export type GradeCategory =
  | 'Finals'
  | 'Final_A'
  | 'Final_B'
  | 'Final_C'
  | 'Exam_A'
  | 'Exam_B'
  | 'Exam_C';

/**
 * One stored statistics record: the primary category for a single
 * course + semester. Numeric fields are `null` when unavailable or invalid.
 */
export interface CourseGradeStatistics {
  /** Canonical 8-digit course number (`0XXX0XXX`). */
  courseNumber: string;
  /** CheeseFork semester code, e.g. `"202401"`. */
  semester: string;
  /** The grade category selected as the primary statistic for this semester. */
  category: GradeCategory;
  average: number | null;
  median: number | null;
  students: number | null;
  source: 'cheesefork';
}

/** The statistic resolved for display/filtering/sorting for one course. */
export interface ResolvedStatistic {
  /** `'general'` = aggregated across semesters; `'semester'` = a single semester. */
  kind: 'general' | 'semester';
  /** `null` for the general aggregate. */
  semester: string | null;
  /** `null` for the general aggregate (it spans categories). */
  category: GradeCategory | null;
  average: number | null;
  median: number | null;
  students: number | null;
  /** Number of semesters aggregated (general only). */
  semesterCount?: number;
}

/** Subject ids reuse the existing faculty-area classification. */
export type SubjectId = 'ee' | 'math' | 'physics' | 'cs' | 'humanities';

export type SortBy =
  | 'default'
  | 'courseNumber'
  | 'courseName'
  | 'credits'
  | 'average'
  | 'median';

export type SortDirection = 'asc' | 'desc';

/**
 * `'general'` aggregates across semesters (default), `'latest'` resolves per-course to its
 * newest semester with data, or a specific `YYYY0M` code.
 */
export type StatisticsSemesterSelection = string | 'latest' | 'general';

/** The full typed filter + sorting state for the course catalog. */
export interface CourseFilters {
  subjects: SubjectId[];
  // Academic-property toggles (preserve existing behavior).
  english: boolean;
  melag: boolean;
  freeElective: boolean;
  advancedDegree: boolean;
  winter: boolean;
  spring: boolean;
  minRating: number;
  // Grade statistics.
  statisticsSemester: StatisticsSemesterSelection;
  averageMin: number | null;
  medianMin: number | null;
  minStudents: number | null;
  // Sorting.
  sortBy: SortBy;
  sortDirection: SortDirection;
}
