/**
 * Single source of truth for the "מקצועות" (Subjects) classification used by the
 * course filter. Reuses the existing course-id prefix mapping (the same prefixes
 * `getFacultyStyle` keys on) — it does NOT infer subjects from course names.
 */
import type { SubjectId } from '../domain/gradeStatistics/types';
import { toSapEightDigitCourseIdForStorage } from './courseNumberNormalize';
import { bareId } from './occurrenceId';

export interface SubjectOption {
  id: SubjectId;
  label: string;
  /** 3-char canonical 8-digit prefix. */
  prefix: string;
  /** Tailwind classes used when the subject chip is active. */
  activeClass: string;
  dotClass: string;
}

export const SUBJECT_OPTIONS: SubjectOption[] = [
  { id: 'ee',         label: 'חשמל',     prefix: '004', activeClass: 'bg-blue-100 text-blue-700 border-blue-300',     dotClass: 'bg-blue-500'   },
  { id: 'math',       label: 'מתמטיקה',  prefix: '010', activeClass: 'bg-green-100 text-green-700 border-green-300',  dotClass: 'bg-green-500'  },
  { id: 'physics',    label: 'פיזיקה',   prefix: '011', activeClass: 'bg-orange-100 text-orange-700 border-orange-300', dotClass: 'bg-orange-500' },
  { id: 'cs',         label: 'מדמ"ח',    prefix: '023', activeClass: 'bg-purple-100 text-purple-700 border-purple-300', dotClass: 'bg-purple-500' },
  { id: 'humanities', label: 'הומניסטי', prefix: '032', activeClass: 'bg-yellow-100 text-yellow-700 border-yellow-300', dotClass: 'bg-yellow-500' },
];

const PREFIX_BY_ID = new Map<SubjectId, string>(SUBJECT_OPTIONS.map((o) => [o.id, o.prefix]));

/** True iff the course id belongs to the given subject (by canonical prefix). */
export function courseMatchesSubject(courseId: string, subject: SubjectId): boolean {
  const prefix = PREFIX_BY_ID.get(subject);
  if (!prefix) return false;
  const canonical = toSapEightDigitCourseIdForStorage(bareId(courseId));
  return canonical.startsWith(prefix);
}
