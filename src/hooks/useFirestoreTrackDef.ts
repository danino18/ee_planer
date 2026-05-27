import { useState, useEffect } from 'react';
import type { CourseFacultyArea, TrackDefinition, TrackId } from '../types';
import type { CatalogYearRules, RequirementGroupDef } from '../types/firestoreRules';
import { fetchCatalogYearRules } from '../services/degreeRulesService';

/**
 * Converts a Firestore CatalogYearRules document back into the shape the
 * existing requirements engine expects (TrackDefinition). Fields not stored
 * in Firestore fall through to the static base definition.
 */
function mergeFirestoreRules(base: TrackDefinition, rules: CatalogYearRules): TrackDefinition {
  const byId = (id: string): RequirementGroupDef | undefined =>
    rules.requirementGroups.find((g) => g.id === id);

  const mandatory = byId('mandatory');
  const electiveFaculty = byId('elective_faculty');
  const generalElective = byId('general_elective');
  const labs = byId('labs');
  const core = byId('core');
  const specGroups = byId('specialization_groups');

  return {
    ...base,
    totalCreditsRequired: rules.totalCreditsRequired,
    semesterSchedule: rules.semesterSchedule,
    mandatoryCredits: mandatory?.targetValue ?? base.mandatoryCredits,
    electiveCreditsRequired: electiveFaculty?.targetValue ?? base.electiveCreditsRequired,
    generalCreditsRequired: generalElective?.targetValue ?? base.generalCreditsRequired,
    specializationGroupsRequired: specGroups?.targetValue ?? base.specializationGroupsRequired,
    labPool: labs
      ? {
          courses: labs.courseSelector?.ids ?? base.labPool?.courses ?? [],
          required: labs.poolRequired ?? base.labPool?.required ?? 0,
          max: labs.poolMax ?? base.labPool?.max,
          mandatory: labs.poolMandatory ?? base.labPool?.mandatory,
        }
      : base.labPool,
    coreRequirement: core
      ? {
          courses: core.courseSelector?.ids ?? base.coreRequirement?.courses ?? [],
          required: core.poolRequired ?? base.coreRequirement?.required ?? 0,
          orGroups: core.orGroups
            ? core.orGroups.map((g) => g.courses)
            : base.coreRequirement?.orGroups,
        }
      : base.coreRequirement,
    electivePolicy: electiveFaculty?.courseSelector?.facultyAreas
      ? {
          ...base.electivePolicy,
          facultyCourseAreas: electiveFaculty.courseSelector.facultyAreas as CourseFacultyArea[],
          areaRequirements: electiveFaculty.courseSelector.areaRequirements,
        }
      : base.electivePolicy,
    externalFacultyElectiveEnabled:
      electiveFaculty?.externalFacultyElectiveEnabled ?? base.externalFacultyElectiveEnabled,
  };
}

/**
 * Returns a TrackDefinition populated from Firestore when available.
 * Falls back to the static base definition (from TypeScript files) on error
 * or while loading, so the app always renders something immediately.
 */
export function useFirestoreTrackDef(
  staticDef: TrackDefinition,
  catalogYear: number | null,
): TrackDefinition {
  const [firestoreRules, setFirestoreRules] = useState<CatalogYearRules | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCatalogYearRules(staticDef.id as TrackId, catalogYear)
      .then((rules) => {
        if (!cancelled && rules) setFirestoreRules(rules);
      })
      .catch(() => {
        // Keep static definition on Firestore error
      });
    return () => { cancelled = true; };
  }, [staticDef.id, catalogYear]);

  if (!firestoreRules) return staticDef;
  return mergeFirestoreRules(staticDef, firestoreRules);
}
