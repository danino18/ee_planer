export type DegreeBucket =
  | 'mandatory'
  | 'mandatory_lab'
  | 'optional_lab'
  | 'excess_lab'
  | 'core'
  | 'sport'
  | 'melag'
  | 'faculty_elective'
  | 'uncounted';

export type DegreeRequirementStatus = 'completed' | 'partial' | 'missing';

export type DegreeRequirementUnit = 'credits' | 'courses' | 'groups';

export interface CourseAssignment {
  courseId: string;
  bucket: DegreeBucket;
  credits: number;
  specializationGroupIds: string[];
}

export interface DegreeRequirementCheck {
  id: string;
  title: string;
  earned: number;
  required: number;
  unit: DegreeRequirementUnit;
  status: DegreeRequirementStatus;
  missingValue: number;
  countedCourseIds: string[];
}

export interface DegreeCompletionResult {
  isComplete: boolean;
  courseAssignments: CourseAssignment[];
  requirements: DegreeRequirementCheck[];
  missingRequirements: DegreeRequirementCheck[];
}
