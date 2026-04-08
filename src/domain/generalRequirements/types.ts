export type GeneralRequirementType =
  | 'MELAG'
  | 'ENGLISH'
  | 'SPORT'
  | 'LAB';

export type RequirementStatus =
  | 'completed'
  | 'partial'
  | 'missing'
  | 'unknown';

export interface CourseRef {
  courseId: string;
  name: string;
  credits: number;
  tags?: string[];
  language?: 'HE' | 'EN';
  isLab?: boolean;
}

export interface GeneralRequirementRule {
  id: string;
  type: GeneralRequirementType;
  title: string;

  scope: 'global' | 'faculty' | 'program' | 'track';

  targetValue: number;
  targetUnit: 'credits' | 'courses';

  courseMatcher: {
    tags?: string[];
    ids?: string[];
    predicate?: (course: CourseRef) => boolean;
  };

  allowManualOverride?: boolean;
}

export interface CountedCourse {
  courseId: string;
  name: string;
  countedValue: number;
  reason: string;
}

export interface GeneralRequirementProgress {
  requirementId: string;
  type: GeneralRequirementType;
  title: string;

  completedValue: number;
  targetValue: number;
  targetUnit: 'credits' | 'courses';

  status: RequirementStatus;

  countedCourses: CountedCourse[];

  missingValue: number;

  explanation?: string;
}
