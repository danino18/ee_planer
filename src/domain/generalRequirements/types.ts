export type GeneralRequirementType =
  | 'MELAG'
  | 'FREE_ELECTIVE'
  | 'GENERAL_ELECTIVE'
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

  valueGetter?: (course: CourseRef) => number;

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

export interface GeneralElectivesBreakdown {
  total: { recognized: number; target: number };
  sportFloor: { recognized: number; target: number };
  enrichmentFloor: { recognized: number; target: number };
  freeChoice: { recognized: number; target: number };
  contributors: {
    regularSportToFloor: number;
    regularSportToFreeChoice: number;
    melagToFloor: number;
    melagToFreeChoice: number;
    externalFacultyToFreeChoice: number;
    choirRecognized: number;
    sportsTeamRecognized: number;
    choirToEnrichmentFloor: number;
    choirToFreeChoice: number;
    sportsTeamToSportFloor: number;
    sportsTeamToEnrichmentFloor: number;
    sportsTeamToFreeChoice: number;
    unrecognizedSpecialCredits: number;
    surplusBeyond12: number;
  };
}

export interface GeneralRequirementsResult {
  progress: GeneralRequirementProgress[];
  generalElectivesBreakdown: GeneralElectivesBreakdown;
}
