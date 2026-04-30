import type {
  CourseFacultyArea,
  ElectiveAreaRequirement,
  ElectiveCreditArea,
  ElectiveCreditSplit,
  SapCourse,
  TrackDefinition,
  TrackElectivePolicy,
} from '../types';
import {
  EXTERNAL_FACULTY_ELECTIVE_MAX_CREDITS,
  getExternalFacultyElectiveCourse,
} from '../data/externalFacultyElectives';

export const ELECTIVE_AREA_LABELS: Record<ElectiveCreditArea, string> = {
  ee: '\u05d1\u05d7\u05d9\u05e8\u05d4 \u05d1\u05d4\u05e0\u05d3\u05e1\u05ea \u05d7\u05e9\u05de\u05dc',
  physics: '\u05d1\u05d7\u05d9\u05e8\u05d4 \u05d1\u05e4\u05d9\u05d6\u05d9\u05e7\u05d4',
  math: '\u05d1\u05d7\u05d9\u05e8\u05d4 \u05d1\u05de\u05ea\u05de\u05d8\u05d9\u05e7\u05d4',
  general: '\u05db\u05dc\u05dc-\u05d8\u05db\u05e0\u05d9\u05d5\u05e0\u05d9',
};

const DEFAULT_ELECTIVE_POLICY: TrackElectivePolicy = {
  facultyCourseAreas: ['ee'],
};

const FACULTY_KEYWORDS: Record<CourseFacultyArea, string[]> = {
  ee: ['\u05d7\u05e9\u05de\u05dc'],
  math: ['\u05de\u05ea\u05de\u05d8\u05d9\u05e7\u05d4'],
  physics: ['\u05e4\u05d9\u05d6\u05d9\u05e7\u05d4', '\u05e4\u05d9\u05e1\u05d9\u05e7\u05d4'],
  cs: ['\u05de\u05d7\u05e9\u05d1'],
  humanities: ['\u05d4\u05d5\u05de\u05e0\u05d9\u05e1\u05d8\u05d9', '\u05d7\u05d9\u05e0\u05d5\u05da'],
  other: [],
  unknown: [],
};

export function getCourseFacultyArea(course: Pick<SapCourse, 'id' | 'faculty'>): CourseFacultyArea {
  const prefix = course.id.slice(0, 3);
  if (prefix === '004') return 'ee';
  if (prefix === '010') return 'math';
  if (prefix === '011') return 'physics';
  if (prefix === '023') return 'cs';
  if (prefix === '032') return 'humanities';

  const faculty = course.faculty.trim();
  if (!faculty) return 'unknown';

  for (const [area, keywords] of Object.entries(FACULTY_KEYWORDS) as [CourseFacultyArea, string[]][]) {
    if (keywords.some((keyword) => faculty.includes(keyword))) {
      return area;
    }
  }

  return 'other';
}

export function getTrackElectivePolicy(trackDef: TrackDefinition): TrackElectivePolicy {
  return trackDef.electivePolicy ?? DEFAULT_ELECTIVE_POLICY;
}

function getAreaRequirement(
  policy: TrackElectivePolicy,
  area: Exclude<ElectiveCreditArea, 'general'>,
): ElectiveAreaRequirement | undefined {
  return policy.areaRequirements?.find((requirement) => requirement.area === area);
}

function courseMatchesAreaRequirement(
  course: Pick<SapCourse, 'id'>,
  requirement: ElectiveAreaRequirement | undefined,
): boolean {
  if (!requirement) return false;
  if (requirement.allowedCourseIds && !requirement.allowedCourseIds.includes(course.id)) {
    return false;
  }
  return true;
}

export function getAutomaticElectiveCreditArea(
  course: Pick<SapCourse, 'id' | 'faculty'>,
  trackDef: TrackDefinition,
): ElectiveCreditArea {
  const policy = getTrackElectivePolicy(trackDef);
  const facultyArea = getCourseFacultyArea(course);

  if (facultyArea === 'ee' && policy.facultyCourseAreas.includes('ee')) {
    return 'ee';
  }

  if (facultyArea === 'cs' && policy.facultyCourseAreas.includes('cs')) {
    return 'ee';
  }

  if (
    facultyArea === 'physics' &&
    courseMatchesAreaRequirement(course, getAreaRequirement(policy, 'physics'))
  ) {
    return 'physics';
  }

  if (
    facultyArea === 'math' &&
    courseMatchesAreaRequirement(course, getAreaRequirement(policy, 'math'))
  ) {
    return 'math';
  }

  return 'general';
}

function canAssignToArea(
  area: ElectiveCreditArea,
  course: Pick<SapCourse, 'id' | 'faculty'>,
  trackDef: TrackDefinition,
): boolean {
  if (area === 'general') return true;

  const policy = getTrackElectivePolicy(trackDef);
  const facultyArea = getCourseFacultyArea(course);

  if (area === 'ee') {
    if (facultyArea === 'ee' && policy.facultyCourseAreas.includes('ee')) return true;
    if (facultyArea === 'cs' && policy.facultyCourseAreas.includes('cs')) return true;
    return policy.manualAssignmentAreas?.[facultyArea]?.includes('ee') ?? false;
  }

  return courseMatchesAreaRequirement(course, getAreaRequirement(policy, area));
}

export function getElectiveCreditAssignmentOptions(
  course: Pick<SapCourse, 'id' | 'faculty'>,
  trackDef: TrackDefinition,
): ElectiveCreditArea[] {
  const policy = getTrackElectivePolicy(trackDef);
  const facultyArea = getCourseFacultyArea(course);
  const options = new Set<ElectiveCreditArea>([getAutomaticElectiveCreditArea(course, trackDef)]);

  for (const area of policy.manualAssignmentAreas?.[facultyArea] ?? []) {
    if (canAssignToArea(area, course, trackDef)) {
      options.add(area);
    }
  }

  return [...options];
}

export function resolveElectiveCreditArea(
  course: Pick<SapCourse, 'id' | 'faculty'>,
  trackDef: TrackDefinition,
  assignments: Record<string, ElectiveCreditArea> | undefined,
): ElectiveCreditArea {
  const selected = assignments?.[course.id];
  const options = getElectiveCreditAssignmentOptions(course, trackDef);
  return selected && options.includes(selected)
    ? selected
    : getAutomaticElectiveCreditArea(course, trackDef);
}

export function allocateElectiveCredits(
  course: Pick<SapCourse, 'id' | 'credits'>,
  selectedArea: ElectiveCreditArea,
  isSpecializationCourse: boolean,
  remainingExternalFacultyCredits: number,
): ElectiveCreditSplit {
  if (selectedArea !== 'general') {
    return {
      facultyCredits: course.credits,
      generalCredits: 0,
      areaCredits: { [selectedArea]: course.credits },
      externalFacultyCredits: 0,
    };
  }

  if (isSpecializationCourse) {
    return {
      facultyCredits: course.credits,
      generalCredits: 0,
      externalFacultyCredits: 0,
    };
  }

  const externalCourse = getExternalFacultyElectiveCourse(course.id);
  if (!externalCourse) {
    return {
      facultyCredits: 0,
      generalCredits: course.credits,
      externalFacultyCredits: 0,
    };
  }

  const eligibleFacultyCredits = Math.min(
    course.credits,
    externalCourse.facultyCreditLimit ?? course.credits,
  );
  const externalFacultyCredits = Math.min(
    eligibleFacultyCredits,
    Math.max(0, remainingExternalFacultyCredits),
  );

  return {
    facultyCredits: externalFacultyCredits,
    generalCredits: Math.max(0, course.credits - externalFacultyCredits),
    externalFacultyCredits,
  };
}

export { EXTERNAL_FACULTY_ELECTIVE_MAX_CREDITS };
