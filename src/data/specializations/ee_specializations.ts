import type { SpecializationGroupYearVariant } from '../../types';

// Per-year requirement overrides for EE specialization groups.
// Key: specialization group name → entry year → override.
export const EE_SPECIALIZATION_YEAR_VARIANTS: Record<string, Record<number, SpecializationGroupYearVariant>> = {
  // 2025/26 (תשפ"ו): 00460237 "מעגלים משולבים - מבוא ל-VLSI" (3 נק"ז) renumbered to
  // 00460231 "מעגלים משולבים – מבוא ל- VLSI" (3.5 נק"ז).
  'מעגלים אלקטרוניים משולבים': {
    2025: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים – מבוא ל- VLSI', category: 'mandatory_core' },
      }],
    },
  },
  'מיקרואלקטרוניקה וננואלקטרוניקה': {
    2025: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים – מבוא ל- VLSI', category: 'elective' },
      }],
    },
  },
  'מחשבים': {
    2025: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים – מבוא ל- VLSI', category: 'elective' },
      }],
    },
  },
};
