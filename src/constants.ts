import type { SpecializationGroup } from './types';

// Deprecated legacy export retained only for compatibility during the refactor.
// Runtime specialization logic must come from src/domain/specializations.
export const TRACK_SPECIALIZATIONS: Record<string, SpecializationGroup[]> = {};
