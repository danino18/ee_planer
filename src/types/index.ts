export type TrackId = 'ee' | 'cs' | 'ee_math' | 'ee_physics';

export interface SapCourse {
  id: string;
  name: string;
  credits: number;
  prerequisites: string[][];  // OR groups: [[A,B],[C]] = "(A AND B) OR C"
  examMoed1?: string;
  examMoed2?: string;
  faculty: string;
  syllabus?: string;
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
}

export interface SpecializationGroup {
  id: string;
  trackId: TrackId | TrackId[];
  name: string;
  mandatoryCourses: string[];
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
}
