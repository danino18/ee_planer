import type { GeneralRequirementRule } from '../../domain/generalRequirements/types';
import { isMelagCourseId } from './courseClassification';

// Seed rules for Technion general requirements.
// Course lists are synced from Technion UG Portal at build time.
// Sport still relies on the existing 039xxx convention.
export const GENERAL_REQUIREMENTS_RULES: GeneralRequirementRule[] = [
  {
    id: 'melag',
    type: 'MELAG',
    title: 'מל"ג / לימודי העשרה',
    scope: 'global',
    targetValue: 6,
    targetUnit: 'credits',
    courseMatcher: {
      predicate: (c) => isMelagCourseId(c.courseId),
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
    targetValue: 3,
    targetUnit: 'courses',
    courseMatcher: {
      predicate: (c) => c.isLab === true,
    },
  },
];
