import type { MiluimCreditsAllocation, StoredStudentPlan, StudentPlan, StudentPlanVersion, TrackId } from '../types';

const TRACK_IDS: TrackId[] = ['ee', 'cs', 'ee_math', 'ee_physics', 'ee_combined', 'ce'];
const TRACK_ID_SET = new Set<TrackId>(TRACK_IDS);
const ALLOWED_PLAN_KEYS = new Set<string>([
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
  'completedInstances',
  'miluimCredits',
  'englishScore',
  'englishTaughtCourses',
  'dismissedRecommendedCourses',
  'facultyColorOverrides',
  'coreToChainOverrides',
  'roboticsMinorEnabled',
  'entrepreneurshipMinorEnabled',
]);

const ALLOWED_DOCUMENT_KEYS = new Set<string>([
  ...ALLOWED_PLAN_KEYS,
  'activeVersionId',
  'versions',
  'savedTracks',
]);

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

function validateMiluimCreditsAllocation(value: unknown): MiluimCreditsAllocation | null {
  if (value === undefined) {
    return null;
  }

  if (isIntegerInRange(value, 0, 10)) {
    return {
      generalElectives: value,
      freeElective: 0,
    };
  }

  if (!isPlainObject(value)) {
    return null;
  }

  const generalElectives = value.generalElectives;
  const freeElective = value.freeElective;
  if (!isIntegerInRange(generalElectives, 0, 10) || !isIntegerInRange(freeElective, 0, 10)) {
    return null;
  }

  if (generalElectives + freeElective > 10) {
    return null;
  }

  return { generalElectives, freeElective };
}

function sanitizeStudentPlanRecord(
  value: unknown,
  options: { allowSavedTracks: boolean; allowVersions: boolean; expectedTrackId?: TrackId },
): StudentPlan | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const keys = Object.keys(value);
  const allowedKeys = options.allowVersions ? ALLOWED_DOCUMENT_KEYS : ALLOWED_PLAN_KEYS;
  if (keys.some((key) => !allowedKeys.has(key))) {
    return null;
  }

  if (!options.allowSavedTracks && 'savedTracks' in value) {
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

  if ('completedInstances' in value) {
    const completedInstances = validateStringArray(value.completedInstances, 600, 64);
    if (!completedInstances) return null;
    sanitized.completedInstances = completedInstances;
  }

  if ('savedTracks' in value) {
    if (!options.allowSavedTracks || !isPlainObject(value.savedTracks)) {
      return null;
    }

    const savedTracks: Record<string, StudentPlan> = {};
    for (const [trackId, trackPlan] of Object.entries(value.savedTracks)) {
      if (!isTrackId(trackId)) {
        return null;
      }

      const sanitizedTrack = sanitizeStudentPlanRecord(trackPlan, {
        allowSavedTracks: false,
        allowVersions: false,
        expectedTrackId: trackId,
      });
      if (!sanitizedTrack) {
        return null;
      }

      savedTracks[trackId] = sanitizedTrack;
    }

  }

  if ('miluimCredits' in value) {
    const miluimCredits = validateMiluimCreditsAllocation(value.miluimCredits);
    if (!miluimCredits) return null;
    sanitized.miluimCredits = miluimCredits;
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

  if ('roboticsMinorEnabled' in value) {
    if (typeof value.roboticsMinorEnabled !== 'boolean') return null;
    sanitized.roboticsMinorEnabled = value.roboticsMinorEnabled;
  }

  if ('entrepreneurshipMinorEnabled' in value) {
    if (typeof value.entrepreneurshipMinorEnabled !== 'boolean') return null;
    sanitized.entrepreneurshipMinorEnabled = value.entrepreneurshipMinorEnabled;
  }

  return sanitized as StudentPlan;
}

function sanitizeStudentPlanVersion(value: unknown): StudentPlanVersion | null {
  if (!isPlainObject(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.id.length > 64 ||
    typeof value.name !== 'string' ||
    value.name.length === 0 ||
    value.name.length > 128
  ) {
    return null;
  }

  if (value.trackId !== null && value.trackId !== undefined && !isTrackId(value.trackId)) {
    return null;
  }

  const plan = sanitizeStudentPlanRecord(value.plan, {
    allowSavedTracks: false,
    allowVersions: false,
    expectedTrackId: value.trackId as TrackId | undefined,
  });
  if (!plan) {
    return null;
  }

  let trackPlans: Record<string, StudentPlan> | undefined;
  if ('trackPlans' in value) {
    if (!isPlainObject(value.trackPlans)) {
      return null;
    }

    trackPlans = {};
    for (const [trackId, trackPlan] of Object.entries(value.trackPlans)) {
      if (!isTrackId(trackId)) {
        return null;
      }

      const sanitizedTrack = sanitizeStudentPlanRecord(trackPlan, {
        allowSavedTracks: false,
        allowVersions: false,
        expectedTrackId: trackId,
      });
      if (!sanitizedTrack) {
        return null;
      }

      trackPlans[trackId] = sanitizedTrack;
    }
  }

  return {
    id: value.id,
    name: value.name,
    trackId: (value.trackId as TrackId | null | undefined) ?? null,
    plan,
    trackPlans,
  };
}

export function sanitizeStudentPlan(value: unknown): StoredStudentPlan | null {
  const sanitizedPlan = sanitizeStudentPlanRecord(value, { allowSavedTracks: true, allowVersions: true });
  if (!sanitizedPlan) {
    return null;
  }

  const document = sanitizedPlan as StoredStudentPlan;
  if (!isPlainObject(value)) {
    return null;
  }

  if ('activeVersionId' in value) {
    if (value.activeVersionId !== null && (typeof value.activeVersionId !== 'string' || value.activeVersionId.length === 0 || value.activeVersionId.length > 64)) {
      return null;
    }
    document.activeVersionId = value.activeVersionId as string | null;
  }

  if ('versions' in value) {
    if (!Array.isArray(value.versions) || value.versions.length > 4) {
      return null;
    }

    const versions: StudentPlanVersion[] = [];
    for (const version of value.versions) {
      const sanitizedVersion = sanitizeStudentPlanVersion(version);
      if (!sanitizedVersion) {
        return null;
      }
      versions.push(sanitizedVersion);
    }

    document.versions = versions;
  }

  if ('savedTracks' in value && isPlainObject(value.savedTracks)) {
    const savedTracks: Record<string, StudentPlan> = {};
    for (const [trackId, trackPlan] of Object.entries(value.savedTracks)) {
      if (!isTrackId(trackId)) {
        return null;
      }

      const sanitizedTrack = sanitizeStudentPlanRecord(trackPlan, {
        allowSavedTracks: false,
        allowVersions: false,
        expectedTrackId: trackId,
      });
      if (!sanitizedTrack) {
        return null;
      }

      savedTracks[trackId] = sanitizedTrack;
    }
    document.savedTracks = savedTracks;
  }

  return document;
}
