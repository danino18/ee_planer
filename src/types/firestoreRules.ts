import type {
  CourseFacultyArea,
  ElectiveAreaRequirement,
  SemesterScheduleEntry,
  SpecializationGroupYearVariant,
  TrackId,
} from './index';

/**
 * How courses are selected for a requirement group.
 * Multiple selectors can coexist — a course matches if it satisfies ANY of them.
 */
export interface CourseSelector {
  /** Named faculty areas using the code-level mapping (004→ee, 010→math, 011→physics, 023→cs) */
  facultyAreas?: CourseFacultyArea[];
  /** Course ID prefix matching, e.g. ["004", "023"] to accept all EE + CS courses.
   *  NOTE: currently the app resolves these via code-level mapping; prefix support in the
   *  engine is scheduled as a follow-up (the data is stored here for forward-compatibility). */
  idPrefixes?: string[];
  /** Explicit course IDs (used for lab pools, core requirement pools, custom lists) */
  ids?: string[];
  /** Named classifier function in code (sport, free_elective, english, general_elective) */
  classifierKey?: ClassifierKey;
  /** Per-area minimum credit sub-requirements within a faculty elective group */
  areaRequirements?: ElectiveAreaRequirement[];
}

export type ClassifierKey =
  | 'sport'
  | 'free_elective'
  | 'english'
  | 'general_elective';

export type RequirementGroupType =
  | 'mandatory_schedule'    // mandatory courses listed in semesterSchedule
  | 'elective_faculty'      // faculty elective credits (ee/cs/math/physics areas)
  | 'predefined_classifier' // sport / free_elective / english / general_elective
  | 'course_pool'           // choose ≥poolRequired from pool (labs, core)
  | 'specialization_groups' // complete N specialization groups (counts as electives)
  | 'custom_list';          // admin-defined arbitrary course list

/**
 * Which panel section this requirement appears in.
 * Defaults: mandatory_schedule→mandatory, elective_faculty+specialization_groups→elective,
 *           predefined_classifier→general.
 */
export type RequirementDisplaySection = 'mandatory' | 'elective' | 'general';

export interface RequirementGroupDef {
  id: string;
  title: string;
  targetValue: number;
  targetUnit: 'credits' | 'courses';
  groupType: RequirementGroupType;
  /** Where this requirement appears in the UI; inferred from groupType when omitted */
  displaySection?: RequirementDisplaySection;

  /** Course selector — which courses qualify. Used by most group types. */
  courseSelector?: CourseSelector;

  /** Pool-specific constraints (course_pool: labs, core requirements) */
  poolRequired?: number;     // min courses/credits from pool
  poolMax?: number;          // max that count (beyond = uncredited)
  poolMandatory?: boolean;   // first poolRequired count as mandatory credits
  /** Mutually exclusive alternatives in pool (core courses).
   *  Stored as objects because Firestore forbids nested arrays. */
  orGroups?: { courses: string[] }[];

  /** Whether courses from other faculties can count toward this elective group (elective_faculty) */
  externalFacultyElectiveEnabled?: boolean;
}

/** Stored at /degreeRules/{trackId}/catalogYears/{year} */
export interface CatalogYearRules {
  totalCreditsRequired: number;
  semesterSchedule: SemesterScheduleEntry[];
  requirementGroups: RequirementGroupDef[];
}

/** Stored at /degreeRules/{trackId} */
export interface FirestoreTrackMeta {
  id: TrackId;
  name: string;
  description: string;
  availableYears: number[];
}

/**
 * Stored at /globalSettings/courseClassification
 * Controls sport course detection and faculty area prefix matching.
 */
export interface GlobalCourseSettings {
  sport: {
    /** Inclusive ID ranges that identify sport courses */
    ranges: { start: string; end: string }[];
    /** Specific course IDs counted as sport-team (counted separately in some tracks) */
    teamCourseIds: string[];
  };
  /** Maps faculty area key → list of course ID prefixes that qualify */
  facultyAreaPrefixes: Record<string, string[]>;
}

export const DEFAULT_GLOBAL_COURSE_SETTINGS: GlobalCourseSettings = {
  sport: {
    ranges: [
      { start: '03940800', end: '03940820' },
      { start: '03940900', end: '03940999' },
    ],
    teamCourseIds: ['03940902', '03940800'],
  },
  facultyAreaPrefixes: {
    ee: ['004'],
    cs: ['234', '236'],
    math: ['010'],
    physics: ['011'],
    humanities: ['032'],
  },
};

/** A course entry inside a specialization group */
export interface SpecCourseEntry {
  course_number: string;
  course_name: string;
  category: string;
  note?: string;
}

/** A lightweight course reference (used inside requirements rules) */
export interface SpecCourseRef {
  course_number: string;
  course_name: string;
  note?: string;
}

/** A "choose N from" rule inside requirements */
export interface SpecChoiceRule {
  type: string;           // e.g. "choose_1_from"
  options: (SpecCourseRef | SpecChoiceRule)[];
  note?: string;
  group_name?: string;
}

/** A mutual-exclusion rule */
export interface SpecMutualExclusionRule {
  type: string;           // "choose_at_most_1_from"
  options: SpecCourseRef[];
}

/**
 * Stored at /degreeRules/{trackId}/specializations/{slug}
 * Fields mirror the original JSON file structure so Firestore holds real data,
 * not a raw JSON blob.
 */
export interface FirestoreSpecializationGroup {
  name: string;
  title?: string;
  type?: string;
  courses?: SpecCourseEntry[];
  requirements?: Record<string, unknown>;
  mutual_exclusion_rules?: SpecMutualExclusionRule[];
  notes?: string[];
  yearVariants?: Record<string, SpecializationGroupYearVariant>;
}
