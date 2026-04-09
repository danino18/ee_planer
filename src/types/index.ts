export type TrackId = 'ee' | 'cs' | 'ee_math' | 'ee_physics' | 'ee_combined' | 'ce';

export interface SapCourse {
  id: string;
  name: string;
  credits: number;
  prerequisites: string[][];  // OR groups: [[A,B],[C]] = "(A AND B) OR C"
  examMoed1?: string;
  examMoed2?: string;
  faculty: string;
  syllabus?: string;
  teachingSemester?: 'winter' | 'spring';  // undefined = both
  isEnglish?: boolean;
  sapAverage?: number;  // grade average from SAP data, if available
}

export interface TrackDefinition {
  id: TrackId;
  name: string;
  totalCreditsRequired: number;
  mandatoryCredits: number;
  electiveCreditsRequired: number;
  generalCreditsRequired: number;
  semesterSchedule: { semester: number; courses: string[] }[];
  specializationGroupsRequired: number;
  description: string;
  labPool?: {
    courses: string[];
    required: number;     // mandatory minimum (0 = purely optional)
    mandatory?: boolean;  // true → first `required` placed labs count as mandatory credits
    max?: number;         // max labs that count for any credit (beyond this = uncredited)
  };
}

export interface SpecializationGroup {
  id: string;
  trackId: TrackId | TrackId[];
  name: string;
  mandatoryCourses: string[];
  mandatoryOptions?: string[][];  // at least 1 from each inner array must be completed
  electiveCourses: string[];
  minCoursesToComplete: number;
  doubleMinCoursesToComplete?: number;
  canBeDouble?: boolean;
}

export interface StudentPlan {
  trackId: TrackId | null;
  semesters: Record<number, string[]>;
  completedCourses: string[];
  selectedSpecializations: string[];
  favorites: string[];
  grades: Record<string, number>;
  substitutions: Record<string, string>;
  maxSemester: number;
  selectedPrereqGroups: Record<string, string[]>; // courseId → chosen AND-group; absent = auto OR-logic
  summerSemesters: number[];
  currentSemester: number | null;
  semesterOrder: number[];  // display order of semesters 1..maxSemester
  semesterTypeOverrides?: Record<number, 'winter' | 'spring'>;  // manual winter/spring override per semester
  semesterWarningsIgnored?: number[];  // semester IDs where season warnings are suppressed
  doubleSpecializations?: string[];  // specialization group IDs selected as double (כפולה)
  hasEnglishExemption?: boolean;  // student has English language exemption
  manualSapAverages?: Record<string, number>;  // manual SAP average overrides per courseId
  binaryPass?: Record<string, boolean>;  // courseId → true = passed, not counted in weighted average
  completedInstances?: string[];  // instance keys for repeatable courses: "courseId__semester__idx"
  savedTracks?: Record<string, StudentPlan>;  // per-track saved state for track switching
  miluimCredits?: number;  // 0–10: reserve duty credit reduction for כלל-טכניוני requirement
  englishScore?: number;   // 104–150: Amiram/Psychometric English score
  englishTaughtCourses?: string[];  // course IDs student marked as taught in English
  facultyColorOverrides?: Record<string, string>;  // faculty name → color key override
}
