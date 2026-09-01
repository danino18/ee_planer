import type { SpecializationGroupYearVariant } from '../../types';

// Per-year requirement overrides for CS specialization groups.
// Key: specialization group name → entry year → override.
export const CS_SPECIALIZATION_YEAR_VARIANTS: Record<string, Record<number, SpecializationGroupYearVariant>> = {
  'בקרה ורובוטיקה': {
    2021: {
      // 2021/22: 046192 is unconditionally mandatory, no choice between 046192 and 046212
      mandatoryCourseIds: ['00440191', '00460192'],
      mandatoryChoiceGroups: [],
    },
  },
  // 2025/26 (תשפ"ו): 00460237 "מעגלים משולבים - מבוא ל-VLSI" (3 נק"ז) renumbered to
  // 00460231 "מעגלים משולבים – מבוא ל- VLSI" (3.5 נק"ז). Restated for 2026/27 (תשפ"ז) since
  // year-variant lookups are exact-match, not cumulative.
  'מעגלים אלקטרוניים משולבים': {
    2025: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים – מבוא ל- VLSI', category: 'mandatory_core' },
      }],
    },
    2026: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים – מבוא ל- VLSI', category: 'mandatory_core' },
      }],
    },
  },
  'רשתות מחשבים, מערכות מבוזרות ומבנה מחשבים': {
    2025: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים – מבוא ל- VLSI', category: 'elective' },
      }],
    },
    2026: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים – מבוא ל- VLSI', category: 'elective' },
      }],
    },
  },
  // 2026/27 (תשפ"ז): "מבוא לאנליזה פונקציונלית ואנליזת פורייה" added as elective.
  'מתמטית לסטודנטים מצטיינים': {
    2026: {
      additionalElectiveCourses: [
        { courseNumber: '01040273', courseName: 'מבוא לאנליזה פונקציונלית ואנליזת פורייה', category: 'elective' },
      ],
    },
  },
};
