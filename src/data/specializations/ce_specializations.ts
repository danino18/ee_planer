import type { SpecializationGroupYearVariant } from '../../types';

// Per-year requirement overrides for CE (הנדסת מחשבים) specialization groups.
// Key: specialization group name → entry year → override.
//
// New elective courses (e.g. the תשפ"ז/2026-27 additions) are added directly to the base
// group JSON files instead of here: a newly offered elective is available to every student
// currently enrolled, regardless of which catalog year they entered under — it isn't
// year-gated the way mandatory-rule/course-substitution changes are.
export const CE_SPECIALIZATION_YEAR_VARIANTS: Record<string, Record<number, SpecializationGroupYearVariant>> = {
  // 2025/26 (תשפ"ו): 00460237 "מעגלים משולבים - מבוא ל-VLSI" (3 נק"ז) renumbered to
  // 00460231 "מעגלים משולבים – מבוא ל- VLSI" (3.5 נק"ז). Restated for 2026/27 (תשפ"ז) since
  // year-variant lookups are exact-match, not cumulative.
  'מעגלים אלקטרוניים משולבים': {
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
  'רשתות מחשבים, מערכות מבוזרות ומבנה מחשבים': {
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
  'יסודות פיזיקליים בהנדסת מחשבים': {
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
