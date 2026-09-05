import type { SpecializationGroupYearVariant } from '../../types';

// Per-year requirement overrides for EE specialization groups.
// Key: specialization group name → entry year → override.
//
// New elective courses (e.g. the תשפ"ז/2026-27 additions) are added directly to the base
// group JSON files instead of here: a newly offered elective is available to every student
// currently enrolled, regardless of which catalog year they entered under — it isn't
// year-gated the way mandatory-rule/course-substitution changes are.
export const EE_SPECIALIZATION_YEAR_VARIANTS: Record<string, Record<number, SpecializationGroupYearVariant>> = {
  // 00460237 "מעגלים משולבים - מבוא ל-VLSI" (3 נק"ז) was renumbered/renamed to
  // 00460231 "מעגלים משולבים לשרשרת VLSI" (3.5 נק"ז) starting 2025/26 (תשפ"ו). This is a
  // real-world course-catalog change, not a cohort-specific curriculum change: every student
  // currently enrolled takes it under the new number regardless of entry year, so the
  // substitution is restated for every entry year the track offers (year-variant lookups are
  // exact-match, not cumulative).
  'מעגלים אלקטרוניים משולבים': {
    2021: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'mandatory_core' },
      }],
    },
    2022: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'mandatory_core' },
      }],
    },
    2023: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'mandatory_core' },
      }],
    },
    2025: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'mandatory_core' },
      }],
    },
    2026: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'mandatory_core' },
      }],
    },
  },
  'מיקרואלקטרוניקה וננואלקטרוניקה': {
    2021: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'elective' },
      }],
    },
    2022: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'elective' },
      }],
    },
    2023: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'elective' },
      }],
    },
    2025: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'elective' },
      }],
    },
    2026: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'elective' },
      }],
    },
  },
  'מחשבים': {
    2021: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'elective' },
      }],
    },
    2022: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'elective' },
      }],
    },
    2023: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'elective' },
      }],
    },
    2025: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'elective' },
      }],
    },
    2026: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים לשרשרת VLSI', category: 'elective' },
      }],
    },
  },
};
