import type { GeneralRequirementRule } from '../../domain/generalRequirements/types';
import { isFreeElectiveCourseId, isSportCourseId } from './courseClassification';

// Seed rules for Technion general requirements.
// Course lists are synced from Technion data sources at build time.
export const GENERAL_REQUIREMENTS_RULES: GeneralRequirementRule[] = [
  {
    id: 'free_elective',
    type: 'FREE_ELECTIVE',
    title: 'בחירה חופשית',
    scope: 'global',
    targetValue: 6,
    targetUnit: 'credits',
    courseMatcher: {
      predicate: (c) => isFreeElectiveCourseId(c.courseId),
    },
  },
  {
    id: 'general_electives',
    type: 'GENERAL_ELECTIVE',
    title: 'קורסי בחירה כלל טכניונים',
    scope: 'global',
    targetValue: 12,
    targetUnit: 'credits',
    courseMatcher: {
      predicate: (c) => isFreeElectiveCourseId(c.courseId) || isSportCourseId(c.courseId),
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
      predicate: (c) => isSportCourseId(c.courseId),
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
