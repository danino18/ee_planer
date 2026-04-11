import type { SpecializationGroup } from './types';
import { eeSpecializations } from './data/specializations/ee_specializations';
import { csSpecializations } from './data/specializations/cs_specializations';

// Maps each track ID to its list of specialization groups.
// Used by CourseDetailModal (chain membership display) and PlannerApp (requirements progress).
export const TRACK_SPECIALIZATIONS: Record<string, SpecializationGroup[]> = {
  ee:          eeSpecializations,
  cs:          csSpecializations,
  ee_math:     eeSpecializations,
  ee_physics:  eeSpecializations,
  ee_combined: eeSpecializations,
  ce:          eeSpecializations,
};
