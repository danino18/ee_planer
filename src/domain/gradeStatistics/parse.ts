/**
 * Defensive parsing of technion-histograms course JSON into minimal
 * `CourseGradeStatistics` records (one primary category per semester).
 *
 * Source quirks handled here:
 *  - All numeric fields arrive as JSON strings (e.g. `"68.67"`).
 *  - Empty strings / placeholders mean "unavailable" → `null` (never `0`).
 *  - `average` / `median` / `passPercent` are validated to 0–100; an
 *    out-of-range value for one field becomes `null` and is reported — it does
 *    NOT discard the whole record.
 *  - `min` / `max` may legitimately exceed 100 (exam bonuses) and are not stored.
 *  - Non-grade keys such as `"Staff"` (an array) are skipped.
 *  - A semester record is emitted only when it has a valid average or median.
 */
import type { CourseGradeStatistics, GradeCategory } from './types';
import { selectPrimaryCategory } from './select';

export interface ParseWarning {
  semester: string;
  category: GradeCategory | null;
  field: string;
  reason: string;
}

export interface SemesterParseResult {
  record: CourseGradeStatistics;
  warnings: ParseWarning[];
}

export interface HistogramParseResult {
  records: CourseGradeStatistics[];
  warnings: ParseWarning[];
}

const PLACEHOLDERS = new Set(['', '-', '—', 'n/a', 'na', 'null', 'none']);

function rawToNumber(raw: unknown): { value: number | null; empty: boolean } {
  if (raw === null || raw === undefined) return { value: null, empty: true };
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { value: raw, empty: false } : { value: null, empty: false };
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (PLACEHOLDERS.has(trimmed.toLowerCase())) return { value: null, empty: true };
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return { value: null, empty: false };
    return { value: n, empty: false };
  }
  return { value: null, empty: false };
}

/**
 * Parse a grade-like value (average / median / pass percent) bounded to 0–100.
 * Out-of-range / non-finite → `null`. `empty` distinguishes "absent" from
 * "present but invalid" so callers can decide whether to warn.
 */
export function parseGradeValue(raw: unknown): { value: number | null; empty: boolean; invalid: boolean } {
  const { value, empty } = rawToNumber(raw);
  if (value === null) return { value: null, empty, invalid: !empty };
  if (value < 0 || value > 100) return { value: null, empty: false, invalid: true };
  // Preserve source precision (do not round here; format in the UI).
  return { value, empty: false, invalid: false };
}

/** Parse a non-negative integer student count. */
export function parseStudents(raw: unknown): { value: number | null; invalid: boolean } {
  const { value, empty } = rawToNumber(raw);
  if (value === null) return { value: null, invalid: !empty };
  if (value < 0 || !Number.isInteger(value)) return { value: null, invalid: true };
  return { value, invalid: false };
}

/** Parse `"passed/failed"` (e.g. `"311/62"`). */
export function parsePassFail(raw: unknown): { passed: number; failed: number } | null {
  if (typeof raw !== 'string') return null;
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(raw);
  if (!m) return null;
  return { passed: Number(m[1]), failed: Number(m[2]) };
}

/** Parse a pass percentage bounded to 0–100 (kept for completeness; not stored). */
export function parsePassPercent(raw: unknown): { value: number | null; invalid: boolean } {
  const { value, empty, invalid } = parseGradeValue(raw);
  return { value, invalid: invalid && !empty };
}

/**
 * Parse a single semester object into one minimal primary-category record.
 * Returns `null` when there is no supported category or neither average nor
 * median is valid.
 */
export function parseCourseSemester(
  courseNumber: string,
  semesterCode: string,
  semesterObj: unknown,
): SemesterParseResult | null {
  if (!semesterObj || typeof semesterObj !== 'object' || Array.isArray(semesterObj)) {
    return null;
  }
  const obj = semesterObj as Record<string, unknown>;
  const category = selectPrimaryCategory(obj);
  if (!category) return null;

  const cat = obj[category] as Record<string, unknown>;
  const warnings: ParseWarning[] = [];

  const avg = parseGradeValue(cat.average);
  if (avg.invalid) {
    warnings.push({ semester: semesterCode, category, field: 'average', reason: `out-of-range/invalid: ${JSON.stringify(cat.average)}` });
  }
  const med = parseGradeValue(cat.median);
  if (med.invalid) {
    warnings.push({ semester: semesterCode, category, field: 'median', reason: `out-of-range/invalid: ${JSON.stringify(cat.median)}` });
  }
  const stu = parseStudents(cat.students);
  if (stu.invalid) {
    warnings.push({ semester: semesterCode, category, field: 'students', reason: `invalid: ${JSON.stringify(cat.students)}` });
  }

  if (avg.value === null && med.value === null) {
    return null;
  }

  const record: CourseGradeStatistics = {
    courseNumber,
    semester: semesterCode,
    category,
    average: avg.value,
    median: med.value,
    students: stu.value,
    source: 'cheesefork',
  };
  return { record, warnings };
}

/**
 * Parse a full course histogram object (`{ "<semester>": { "<category>": {...} } }`)
 * into minimal records. Never throws on shape drift; returns `[]` for empty data.
 */
export function parseCourseHistogram(
  courseNumber: string,
  json: unknown,
): HistogramParseResult {
  const records: CourseGradeStatistics[] = [];
  const warnings: ParseWarning[] = [];
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { records, warnings };
  }
  for (const [semesterCode, semesterObj] of Object.entries(json as Record<string, unknown>)) {
    const result = parseCourseSemester(courseNumber, semesterCode, semesterObj);
    if (!result) continue;
    records.push(result.record);
    warnings.push(...result.warnings);
  }
  return { records, warnings };
}
