import type { SapCourse, TrackDefinition } from '../types';

export const CE_PROJECT_A_ID = '00440167';
export const CE_PROJECT_B_ID = '00440169';

const CE_CS_PROJECT_PREFIXES = ['0234', '0236'];
const HEBREW_PROJECT_WORD = 'פרויקט';

export interface CeProjectRequirementProfile {
  mandatoryCreditsRequired: number;
  electiveCreditsRequired: number;
  mandatoryProjectCourseIds: string[];
}

export function isCeCsProjectCourse(course: SapCourse | undefined): boolean {
  if (!course) return false;
  if (!CE_CS_PROJECT_PREFIXES.some((prefix) => course.id.startsWith(prefix))) {
    return false;
  }

  return course.name.trim().split(/\s+/)[0] === HEBREW_PROJECT_WORD;
}

export function getCeProjectRequirementProfile(
  trackDef: TrackDefinition,
  allPlaced: ReadonlySet<string>,
  courses: Map<string, SapCourse>,
): CeProjectRequirementProfile {
  const defaultProfile: CeProjectRequirementProfile = {
    mandatoryCreditsRequired: trackDef.mandatoryCredits,
    electiveCreditsRequired: trackDef.electiveCreditsRequired,
    mandatoryProjectCourseIds: [CE_PROJECT_A_ID, CE_PROJECT_B_ID].filter((id) => allPlaced.has(id)),
  };

  if (trackDef.id !== 'ce') return defaultProfile;

  const placedElectricalProjects = [CE_PROJECT_A_ID, CE_PROJECT_B_ID].filter((id) => allPlaced.has(id));
  const placedCsProjects = [...allPlaced].filter((id) => isCeCsProjectCourse(courses.get(id)));

  if (placedCsProjects.length >= 2) {
    return {
      mandatoryCreditsRequired: 112.5,
      electiveCreditsRequired: 28,
      mandatoryProjectCourseIds: placedCsProjects.slice(0, 2),
    };
  }

  if (placedElectricalProjects.length >= 1 && placedCsProjects.length >= 1) {
    return {
      mandatoryCreditsRequired: 113.5,
      electiveCreditsRequired: 27,
      mandatoryProjectCourseIds: [placedElectricalProjects[0], placedCsProjects[0]],
    };
  }

  if (placedElectricalProjects.length === 2) {
    return {
      mandatoryCreditsRequired: 114.5,
      electiveCreditsRequired: 26,
      mandatoryProjectCourseIds: placedElectricalProjects,
    };
  }

  return defaultProfile;
}

