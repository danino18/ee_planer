import type { GeneralRequirementRule } from '../../domain/generalRequirements/types';

// Seed rules for Technion general requirements.
// Predicates use course ID prefix conventions from the existing codebase:
//   032xxx = humanities / מל"ג courses
//   039xxx = sport / physical education
// Labs and English are injected/patched by useGeneralRequirements based on track definition
// and student plan settings (isEnglish flag, englishTaughtCourses).
export const GENERAL_REQUIREMENTS_RULES: GeneralRequirementRule[] = [
  {
    id: 'melag',
    type: 'MELAG',
    title: 'מל"ג / לימודי העשרה',
    scope: 'global',
    targetValue: 6,
    targetUnit: 'credits',
    courseMatcher: {
      // Exclude English language courses: by isEnglish flag (language === 'EN') OR by name
      // containing "אנגלית" (e.g. "אנגלית טכנית-מתקדמים ב'" has a 032 prefix but is not a מל"ג)
      predicate: (c) => c.courseId.startsWith('032') && c.language !== 'EN' && !c.name.includes('אנגלית'),
    },
  },
  {
    id: 'english',
    type: 'ENGLISH',
    title: 'קורסים באנגלית',
    scope: 'global',
    targetValue: 2,
    targetUnit: 'courses',
    courseMatcher: {
      predicate: (c) => c.language === 'EN',
    },
  },
  {
    id: 'sport',
    type: 'SPORT',
    title: 'ספורט / חינוך גופני',
    scope: 'global',
    targetValue: 2,
    targetUnit: 'credits',
    courseMatcher: {
      predicate: (c) => c.courseId.startsWith('039'),
    },
  },
  {
    id: 'labs',
    type: 'LAB',
    title: 'מעבדות',
    scope: 'program',
    // targetValue is overridden at runtime from trackDef.labPool.required
    targetValue: 3,
    targetUnit: 'courses',
    courseMatcher: {
      // ids are injected at runtime from trackDef.labPool.courses
      predicate: (c) => c.isLab === true,
    },
  },
];
