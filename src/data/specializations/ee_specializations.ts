import type { SpecializationGroupYearVariant } from '../../types';

// Per-year requirement overrides for EE specialization groups.
// Key: specialization group name → entry year → override.
export const EE_SPECIALIZATION_YEAR_VARIANTS: Record<string, Record<number, SpecializationGroupYearVariant>> = {
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
  'מיקרואלקטרוניקה וננואלקטרוניקה': {
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
  'מחשבים': {
    2025: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים – מבוא ל- VLSI', category: 'elective' },
      }],
    },
    // 2026/27 (תשפ"ז): VLSI substitution restated, plus "מתמטיקה דיסקרטית ח'" added as elective.
    2026: {
      courseSubstitutions: [{
        from: '00460237',
        to: { courseNumber: '00460231', courseName: 'מעגלים משולבים – מבוא ל- VLSI', category: 'elective' },
      }],
      additionalElectiveCourses: [
        { courseNumber: '00440114', courseName: 'מתמטיקה דיסקרטית ח\'', category: 'elective' },
      ],
    },
  },
  // 2026/27 (תשפ"ז) additions:
  'רשתות מחשבים': {
    2026: {
      additionalElectiveCourses: [
        { courseNumber: '00440114', courseName: 'מתמטיקה דיסקרטית ח\'', category: 'elective' },
      ],
    },
  },
  'תקשורת ואינפורמציה': {
    2026: {
      additionalElectiveCourses: [
        { courseNumber: '00460735', courseName: 'סודיות קוונטית', category: 'elective' },
      ],
    },
  },
  'אלקטרומגנטיות ופוטוניקה': {
    2026: {
      additionalElectiveCourses: [
        { courseNumber: '00460343', courseName: 'לייזרים אולטרה-מהירים', category: 'elective' },
      ],
    },
  },
  'מתמטית למצטיינים': {
    2026: {
      additionalElectiveCourses: [
        { courseNumber: '00460868', courseName: 'יסודות תהליכים אקראיים', category: 'elective' },
        { courseNumber: '01060429', courseName: 'תהליכים סטוכסטיים', category: 'elective' },
        { courseNumber: '01040273', courseName: 'מבוא לאנליזה פונקציונלית ואנליזת פורייה', category: 'elective' },
      ],
    },
  },
  'טכנולוגיות קוונטיות': {
    2026: {
      additionalElectiveCourses: [
        { courseNumber: '00460735', courseName: 'סודיות קוונטית', category: 'elective' },
      ],
    },
  },
};
