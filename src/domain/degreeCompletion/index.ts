export { computeDegreeCompletionCheck } from './engine';
export {
  buildCourseAssignments,
  buildCoreLockedSet,
  buildLabSets,
  buildPreciseMandatorySet,
  buildRequirementChecks,
} from './helpers';
export type { DegreeProgressShape } from './helpers';
export type {
  CourseAssignment,
  DegreeBucket,
  DegreeCompletionResult,
  DegreeRequirementCheck,
  DegreeRequirementStatus,
  DegreeRequirementUnit,
  RequirementsInput,
} from './types';
export { suggestChainAssignments, suggestMissingCourses, suggestTrackScheduleCourses } from './optimizer';
export type {
  ChainAssignmentSuggestion,
  CourseRecommendation,
  OptimizerInput,
  SchedulingContext,
} from './optimizer';
