import type { SapCourse, TrackDefinition, TrackSpecializationCatalog } from '../../types';
import type { RequirementsInput } from '../../hooks/usePlan';
import { computeRequirementsProgress } from '../../hooks/usePlan';
import { buildCourseAssignments, buildRequirementChecks } from './helpers';
import type { DegreeCompletionResult } from './types';

/**
 * Pure backend computation: given a student's plan inputs, returns a
 * structured degree-completion check — bucket assignment per placed
 * course, status of every requirement, and the list of still-missing
 * requirements.
 */
export function computeDegreeCompletionCheck(
  input: RequirementsInput,
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null,
  specializationCatalog: TrackSpecializationCatalog,
  weightedAverage: number | null = null,
): DegreeCompletionResult {
  const progress = computeRequirementsProgress(
    input,
    courses,
    trackDef,
    specializationCatalog,
    weightedAverage,
  );

  if (!progress || !trackDef) {
    return {
      isComplete: false,
      courseAssignments: [],
      requirements: [],
      missingRequirements: [],
    };
  }

  const courseAssignments = buildCourseAssignments(
    input,
    courses,
    trackDef,
    specializationCatalog,
  );
  const requirements = buildRequirementChecks(progress, courseAssignments);
  const missingRequirements = requirements.filter((r) => r.status !== 'completed');

  return {
    isComplete: progress.isReady && missingRequirements.length === 0,
    courseAssignments,
    requirements,
    missingRequirements,
  };
}
