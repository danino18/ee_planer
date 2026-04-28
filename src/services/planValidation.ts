import type { StudentPlan, TrackId, PlanVersion, VersionedPlanEnvelope, ElectiveCreditArea } from '../types';

const TRACK_IDS: TrackId[] = ['ee', 'cs', 'ee_math', 'ee_physics', 'ee_combined', 'ce'];
const TRACK_ID_SET = new Set<TrackId>(TRACK_IDS);
const ALLOWED_TOP_LEVEL_KEYS = new Set<keyof StudentPlan>([
  'trackId',
  'semesters',
  'completedCourses',
  'selectedSpecializations',
  'favorites',
  'grades',
  'substitutions',
  'maxSemester',
  'selectedPrereqGroups',
  'summerSemesters',
  'currentSemester',
  'semesterOrder',
  'semesterTypeOverrides',
  'semesterWarningsIgnored',
  'doubleSpecializations',
  'hasEnglishExemption',
  'manualSapAverages',
  'binaryPass',
  'explicitSportCompletions',
  'completedInstances',
  'savedTracks',
  'miluimCredits',
  'englishScore',
  'englishTaughtCourses',
  'dismissedRecommendedCourses',
  'facultyColorOverrides',
  'coreToChainOverrides',
  'courseChainAssignments',
  'electiveCreditAssignments',
  'roboticsMinorEnabled',
  'entrepreneurshipMinorEnabled',
  'initializedTracks',
  'targetGraduationSemesterId',
  'loadProfile',
]);
const ELECTIVE_CREDIT_AREAS = new Set<ElectiveCreditArea>(['ee', 'physics', 'math', 'general']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= min && value <= max;
}

function isTrackId(value: unknown): value is TrackId {
  return typeof value === 'string' && TRACK_ID_SET.has(value as TrackId);
}

function validateStringArray(
  value: unknown,
  maxItems: number,
  maxItemLength = 128,
): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) {
    return null;
  }

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > maxItemLength) {
      return null;
    }
    result.push(item);
  }

  return result;
}

function validateIntegerArray(
  value: unknown,
  maxItems: number,
  min: number,
  max: number,
): number[] | null {
  if (!Array.isArray(value) || value.length > maxItems) {
    return null;
  }

  const result: number[] = [];
  for (const item of value) {
    if (!isIntegerInRange(item, min, max)) {
      return null;
    }
    result.push(item);
  }

  return result;
}

function validateNumberMap(
  value: unknown,
  maxEntries: number,
  min?: number,
  max?: number,
): Record<string, number> | null {
  if (!isPlainObject(value) || Object.keys(value).length > maxEntries) {
    return null;
  }

  const result: Record<string, number> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 128 || !isFiniteNumber(entryValue)) {
      return null;
    }

    if ((min !== undefined && entryValue < min) || (max !== undefined && entryValue > max)) {
      return null;
    }

    result[key] = entryValue;
  }

  return result;
}

function validateStringMap(
  value: unknown,
  maxEntries: number,
  maxValueLength = 128,
): Record<string, string> | null {
  if (!isPlainObject(value) || Object.keys(value).length > maxEntries) {
    return null;
  }

  const result: Record<string, string> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (
      typeof key !== 'string' ||
      key.length === 0 ||
      key.length > 128 ||
      typeof entryValue !== 'string' ||
      entryValue.length === 0 ||
      entryValue.length > maxValueLength
    ) {
      return null;
    }
    result[key] = entryValue;
  }

  return result;
}

function validateElectiveCreditAssignmentMap(
  value: unknown,
  maxEntries: number,
): Record<string, ElectiveCreditArea> | null {
  if (!isPlainObject(value) || Object.keys(value).length > maxEntries) {
    return null;
  }

  const result: Record<string, ElectiveCreditArea> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (
      typeof key !== 'string' ||
      key.length === 0 ||
      key.length > 128 ||
      typeof entryValue !== 'string' ||
      !ELECTIVE_CREDIT_AREAS.has(entryValue as ElectiveCreditArea)
    ) {
      return null;
    }
    result[key] = entryValue as ElectiveCreditArea;
  }

  return result;
}

function validateBooleanMap(
  value: unknown,
  maxEntries: number,
): Record<string, boolean> | null {
  if (!isPlainObject(value) || Object.keys(value).length > maxEntries) {
    return null;
  }

  const result: Record<string, boolean> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (
      typeof key !== 'string' ||
      key.length === 0 ||
      key.length > 128 ||
      typeof entryValue !== 'boolean'
    ) {
      return null;
    }
    result[key] = entryValue;
  }

  return result;
}

function validateStringArrayMap(
  value: unknown,
  maxEntries: number,
  maxItemsPerEntry: number,
  maxItemLength = 128,
): Record<string, string[]> | null {
  if (!isPlainObject(value) || Object.keys(value).length > maxEntries) {
    return null;
  }

  const result: Record<string, string[]> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 128) {
      return null;
    }

    const validatedArray = validateStringArray(entryValue, maxItemsPerEntry, maxItemLength);
    if (!validatedArray) {
      return null;
    }

    result[key] = validatedArray;
  }

  return result;
}

function validateTrackStringArrayMap(
  value: unknown,
  maxItemsPerEntry: number,
  maxItemLength = 128,
): Record<string, string[]> | null {
  if (!isPlainObject(value) || Object.keys(value).length > TRACK_IDS.length) {
    return null;
  }

  const result: Record<string, string[]> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (!isTrackId(key)) {
      return null;
    }

    const validatedArray = validateStringArray(entryValue, maxItemsPerEntry, maxItemLength);
    if (!validatedArray) {
      return null;
    }

    result[key] = validatedArray;
  }

  return result;
}

function validateSemesterMap(value: unknown): Record<number, string[]> | null {
  if (!isPlainObject(value) || Object.keys(value).length > 17) {
    return null;
  }

  const result: Record<number, string[]> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    const semester = Number(key);
    if (!isIntegerInRange(semester, 0, 16)) {
      return null;
    }

    const validatedCourses = validateStringArray(entryValue, 600, 32);
    if (!validatedCourses) {
      return null;
    }

    result[semester] = validatedCourses;
  }

  return result;
}

function validateSemesterTypeOverrides(
  value: unknown,
): Record<number, 'winter' | 'spring'> | null {
  if (!isPlainObject(value) || Object.keys(value).length > 16) {
    return null;
  }

  const result: Record<number, 'winter' | 'spring'> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    const semester = Number(key);
    if (!isIntegerInRange(semester, 1, 16) || (entryValue !== 'winter' && entryValue !== 'spring')) {
      return null;
    }

    result[semester] = entryValue;
  }

  return result;
}

function sanitizeStudentPlanRecord(
  value: unknown,
  options: { allowSavedTracks: boolean; expectedTrackId?: TrackId },
): StudentPlan | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (keys.some((key) => !ALLOWED_TOP_LEVEL_KEYS.has(key as keyof StudentPlan))) {
    return null;
  }

  const sanitized: Partial<StudentPlan> = {};

  if ('trackId' in value) {
    const { trackId } = value;
    if (trackId !== null && !isTrackId(trackId)) {
      return null;
    }

    if (options.expectedTrackId && trackId !== undefined && trackId !== options.expectedTrackId) {
      return null;
    }

    sanitized.trackId = trackId as TrackId | null;
  }

  if ('semesters' in value) {
    const semesters = validateSemesterMap(value.semesters);
    if (!semesters) return null;
    sanitized.semesters = semesters;
  }

  if ('completedCourses' in value) {
    const completedCourses = validateStringArray(value.completedCourses, 600, 32);
    if (!completedCourses) return null;
    sanitized.completedCourses = completedCourses;
  }

  if ('selectedSpecializations' in value) {
    const selectedSpecializations = validateStringArray(value.selectedSpecializations, 100, 128);
    if (!selectedSpecializations) return null;
    sanitized.selectedSpecializations = selectedSpecializations;
  }

  if ('favorites' in value) {
    const favorites = validateStringArray(value.favorites, 600, 32);
    if (!favorites) return null;
    sanitized.favorites = favorites;
  }

  if ('grades' in value) {
    const grades = validateNumberMap(value.grades, 600, 0, 100);
    if (!grades) return null;
    sanitized.grades = grades;
  }

  if ('substitutions' in value) {
    const substitutions = validateStringMap(value.substitutions, 600, 64);
    if (!substitutions) return null;
    sanitized.substitutions = substitutions;
  }

  if ('maxSemester' in value) {
    if (!isIntegerInRange(value.maxSemester, 1, 16)) return null;
    sanitized.maxSemester = value.maxSemester;
  }

  if ('selectedPrereqGroups' in value) {
    const selectedPrereqGroups = validateStringArrayMap(value.selectedPrereqGroups, 600, 16, 32);
    if (!selectedPrereqGroups) return null;
    sanitized.selectedPrereqGroups = selectedPrereqGroups;
  }

  if ('summerSemesters' in value) {
    const summerSemesters = validateIntegerArray(value.summerSemesters, 16, 1, 16);
    if (!summerSemesters) return null;
    sanitized.summerSemesters = summerSemesters;
  }

  if ('currentSemester' in value) {
    const { currentSemester } = value;
    if (currentSemester !== null && !isIntegerInRange(currentSemester, 0, 16)) {
      return null;
    }
    sanitized.currentSemester = currentSemester as number | null;
  }

  if ('semesterOrder' in value) {
    const semesterOrder = validateIntegerArray(value.semesterOrder, 16, 1, 16);
    if (!semesterOrder) return null;
    sanitized.semesterOrder = semesterOrder;
  }

  if ('semesterTypeOverrides' in value) {
    const semesterTypeOverrides = validateSemesterTypeOverrides(value.semesterTypeOverrides);
    if (!semesterTypeOverrides) return null;
    sanitized.semesterTypeOverrides = semesterTypeOverrides;
  }

  if ('semesterWarningsIgnored' in value) {
    const semesterWarningsIgnored = validateIntegerArray(value.semesterWarningsIgnored, 16, 1, 16);
    if (!semesterWarningsIgnored) return null;
    sanitized.semesterWarningsIgnored = semesterWarningsIgnored;
  }

  if ('doubleSpecializations' in value) {
    const doubleSpecializations = validateStringArray(value.doubleSpecializations, 100, 128);
    if (!doubleSpecializations) return null;
    sanitized.doubleSpecializations = doubleSpecializations;
  }

  if ('hasEnglishExemption' in value) {
    if (typeof value.hasEnglishExemption !== 'boolean') return null;
    sanitized.hasEnglishExemption = value.hasEnglishExemption;
  }

  if ('manualSapAverages' in value) {
    const manualSapAverages = validateNumberMap(value.manualSapAverages, 600, 0, 100);
    if (!manualSapAverages) return null;
    sanitized.manualSapAverages = manualSapAverages;
  }

  if ('binaryPass' in value) {
    const binaryPass = validateBooleanMap(value.binaryPass, 600);
    if (!binaryPass) return null;
    sanitized.binaryPass = binaryPass;
  }

  if ('explicitSportCompletions' in value) {
    const explicitSportCompletions = validateStringArray(value.explicitSportCompletions, 600, 32);
    if (!explicitSportCompletions) return null;
    sanitized.explicitSportCompletions = explicitSportCompletions;
  }

  if ('completedInstances' in value) {
    const completedInstances = validateStringArray(value.completedInstances, 600, 64);
    if (!completedInstances) return null;
    sanitized.completedInstances = completedInstances;
  }

  if ('savedTracks' in value && options.allowSavedTracks) {
    if (!isPlainObject(value.savedTracks)) {
      return null;
    }

    const savedTracks: Record<string, StudentPlan> = {};
    for (const [trackId, trackPlan] of Object.entries(value.savedTracks)) {
      if (!isTrackId(trackId)) {
        return null;
      }

      const sanitizedTrack = sanitizeStudentPlanRecord(trackPlan, {
        allowSavedTracks: false,
        expectedTrackId: trackId,
      });
      if (!sanitizedTrack) {
        return null;
      }

      savedTracks[trackId] = sanitizedTrack;
    }

    sanitized.savedTracks = savedTracks;
  }

  if ('miluimCredits' in value) {
    if (!isIntegerInRange(value.miluimCredits, 0, 10)) return null;
    sanitized.miluimCredits = value.miluimCredits;
  }

  if ('englishScore' in value) {
    if (!isIntegerInRange(value.englishScore, 0, 150)) return null;
    sanitized.englishScore = value.englishScore;
  }

  if ('englishTaughtCourses' in value) {
    const englishTaughtCourses = validateStringArray(value.englishTaughtCourses, 600, 32);
    if (!englishTaughtCourses) return null;
    sanitized.englishTaughtCourses = englishTaughtCourses;
  }

  if ('dismissedRecommendedCourses' in value) {
    const dismissedRecommendedCourses = validateTrackStringArrayMap(value.dismissedRecommendedCourses, 600, 32);
    if (!dismissedRecommendedCourses) return null;
    sanitized.dismissedRecommendedCourses = dismissedRecommendedCourses;
  }

  if ('facultyColorOverrides' in value) {
    const facultyColorOverrides = validateStringMap(value.facultyColorOverrides, 100, 32);
    if (!facultyColorOverrides) return null;
    sanitized.facultyColorOverrides = facultyColorOverrides;
  }

  if ('coreToChainOverrides' in value) {
    const coreToChainOverrides = validateStringArray(value.coreToChainOverrides, 600, 32);
    if (!coreToChainOverrides) return null;
    sanitized.coreToChainOverrides = coreToChainOverrides;
  }

  if ('courseChainAssignments' in value) {
    // keys = courseIds (≤32 chars), values = chainGroupIds (≤64 chars), max 200 entries
    const courseChainAssignments = validateStringMap(value.courseChainAssignments, 200, 64);
    if (!courseChainAssignments) return null;
    sanitized.courseChainAssignments = courseChainAssignments;
  }

  if ('electiveCreditAssignments' in value) {
    const electiveCreditAssignments = validateElectiveCreditAssignmentMap(value.electiveCreditAssignments, 600);
    if (!electiveCreditAssignments) return null;
    sanitized.electiveCreditAssignments = electiveCreditAssignments;
  }

  if ('roboticsMinorEnabled' in value) {
    if (typeof value.roboticsMinorEnabled !== 'boolean') return null;
    sanitized.roboticsMinorEnabled = value.roboticsMinorEnabled;
  }

  if ('entrepreneurshipMinorEnabled' in value) {
    if (typeof value.entrepreneurshipMinorEnabled !== 'boolean') return null;
    sanitized.entrepreneurshipMinorEnabled = value.entrepreneurshipMinorEnabled;
  }

  if ('initializedTracks' in value) {
    const initializedTracks = validateStringArray(value.initializedTracks, 20, 32);
    if (!initializedTracks) return null;
    sanitized.initializedTracks = initializedTracks;
  }

  if ('targetGraduationSemesterId' in value) {
    const { targetGraduationSemesterId } = value;
    if (targetGraduationSemesterId !== null && !isIntegerInRange(targetGraduationSemesterId, 1, 16)) {
      return null;
    }
    sanitized.targetGraduationSemesterId = targetGraduationSemesterId as number | null;
  }

  if ('loadProfile' in value) {
    if (value.loadProfile !== 'working' && value.loadProfile !== 'fulltime') {
      return null;
    }
    sanitized.loadProfile = value.loadProfile;
  }

  return sanitized as StudentPlan;
}

export function sanitizeStudentPlan(value: unknown): StudentPlan | null {
  return sanitizeStudentPlanRecord(value, { allowSavedTracks: true });
}

export function sanitizeEnvelope(value: unknown): VersionedPlanEnvelope | null {
  if (!isPlainObject(value)) return null;
  if (value.schemaVersion !== 2) return null;
  if (!Array.isArray(value.versions) || value.versions.length === 0 || value.versions.length > 4) return null;
  if (typeof value.activeVersionId !== 'string' || value.activeVersionId.length === 0) return null;

  const versions: PlanVersion[] = [];
  for (const v of value.versions as unknown[]) {
    if (!isPlainObject(v)) return null;
    if (typeof v.id !== 'string' || v.id.length === 0 || v.id.length > 128) return null;
    if (typeof v.name !== 'string' || v.name.length === 0 || v.name.length > 128) return null;
    if (!isPlainObject(v.plan)) return null;
    if (typeof v.createdAt !== 'number' || typeof v.updatedAt !== 'number') return null;

    const plan = sanitizeStudentPlan(v.plan);
    if (!plan) return null;

    versions.push({ id: v.id, name: v.name, plan, createdAt: v.createdAt, updatedAt: v.updatedAt });
  }

  const hasActive = versions.some((v) => v.id === value.activeVersionId);
  if (!hasActive) return null;

  return { schemaVersion: 2, versions, activeVersionId: value.activeVersionId as string };
}
