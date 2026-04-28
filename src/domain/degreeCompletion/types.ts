import type { ElectiveCreditArea } from '../../types';

export interface RequirementsInput {
  semesters: Record<number, string[]>;
  completedCourses: string[];
  explicitSportCompletions: string[];
  completedInstances: string[];
  grades: Record<string, number>;
  binaryPass: Record<string, boolean>;
  selectedSpecializations: string[];
  doubleSpecializations: string[];
  hasEnglishExemption: boolean;
  miluimCredits: number;
  englishScore: number | undefined;
  englishTaughtCourses: string[];
  semesterOrder: number[];
  coreToChainOverrides: string[];
  courseChainAssignments?: Record<string, string>;
  electiveCreditAssignments?: Record<string, ElectiveCreditArea>;
  roboticsMinorEnabled: boolean;
  entrepreneurshipMinorEnabled: boolean;
}

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
