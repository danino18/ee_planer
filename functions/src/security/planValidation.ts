const TRACK_IDS = ["ee", "cs", "ee_math", "ee_physics", "ee_combined", "ce"] as const;
const ELECTIVE_CREDIT_AREAS = new Set(["ee", "physics", "math", "general"]);
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "trackId",
  "semesters",
  "completedCourses",
  "selectedSpecializations",
  "favorites",
  "grades",
  "substitutions",
  "maxSemester",
  "selectedPrereqGroups",
  "summerSemesters",
  "currentSemester",
  "semesterOrder",
  "semesterTypeOverrides",
  "semesterWarningsIgnored",
  "doubleSpecializations",
  "hasEnglishExemption",
  "manualSapAverages",
  "binaryPass",
  "explicitSportCompletions",
  "completedInstances",
  "savedTracks",
  "miluimCredits",
  "englishScore",
  "englishTaughtCourses",
  "facultyColorOverrides",
  "dismissedRecommendedCourses",
  "coreToChainOverrides",
  "courseChainAssignments",
  "electiveCreditAssignments",
  "noAdditionalCreditOverrides",
  "roboticsMinorEnabled",
  "entrepreneurshipMinorEnabled",
  "quantumComputingMinorEnabled",
  "initializedTracks",
  "targetGraduationSemesterId",
  "loadProfile",
]);

interface ValidationSuccess {
  ok: true;
  value: Record<string, unknown>;
}

interface ValidationFailure {
  ok: false;
  error: string;
}

type ValidationResult = ValidationSuccess | ValidationFailure;

interface PlanValidationOptions {
  allowSavedTracks: boolean;
  expectedTrackId?: string;
}

function fail(error: string): ValidationFailure {
  return { ok: false, error };
}

function success(value: Record<string, unknown>): ValidationSuccess {
  return { ok: true, value };
}

function isValidationFailure<T>(value: T | ValidationFailure): value is ValidationFailure {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= min && value <= max;
}

function isTrackId(value: unknown): value is string {
  return typeof value === "string" && TRACK_IDS.includes(value as (typeof TRACK_IDS)[number]);
}

function isNonEmptyString(value: unknown, maxLength = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function validateStringArray(
  field: string,
  value: unknown,
  maxItems: number,
  maxItemLength = 128
): string[] | ValidationFailure {
  if (!Array.isArray(value) || value.length > maxItems) {
    return fail(`Invalid ${field}`);
  }

  const result: string[] = [];
  for (const item of value) {
    if (!isNonEmptyString(item, maxItemLength)) {
      return fail(`Invalid ${field}`);
    }
    result.push(item);
  }

  return result;
}

function validateIntegerArray(
  field: string,
  value: unknown,
  maxItems: number,
  min: number,
  max: number
): number[] | ValidationFailure {
  if (!Array.isArray(value) || value.length > maxItems) {
    return fail(`Invalid ${field}`);
  }

  const result: number[] = [];
  for (const item of value) {
    if (!isIntegerInRange(item, min, max)) {
      return fail(`Invalid ${field}`);
    }
    result.push(item);
  }

  return result;
}

function validateNumberMap(
  field: string,
  value: unknown,
  maxEntries: number,
  min?: number,
  max?: number
): Record<string, number> | ValidationFailure {
  if (!isPlainObject(value) || Object.keys(value).length > maxEntries) {
    return fail(`Invalid ${field}`);
  }

  const result: Record<string, number> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (!isNonEmptyString(key, 128) || !isFiniteNumber(entryValue)) {
      return fail(`Invalid ${field}`);
    }

    if ((min !== undefined && entryValue < min) || (max !== undefined && entryValue > max)) {
      return fail(`Invalid ${field}`);
    }

    result[key] = entryValue;
  }

  return result;
}

function validateBooleanMap(
  field: string,
  value: unknown,
  maxEntries: number
): Record<string, boolean> | ValidationFailure {
  if (!isPlainObject(value) || Object.keys(value).length > maxEntries) {
    return fail(`Invalid ${field}`);
  }

  const result: Record<string, boolean> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (!isNonEmptyString(key, 128) || typeof entryValue !== "boolean") {
      return fail(`Invalid ${field}`);
    }
    result[key] = entryValue;
  }

  return result;
}

function validateStringMap(
  field: string,
  value: unknown,
  maxEntries: number,
  maxValueLength = 128
): Record<string, string> | ValidationFailure {
  if (!isPlainObject(value) || Object.keys(value).length > maxEntries) {
    return fail(`Invalid ${field}`);
  }

  const result: Record<string, string> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (!isNonEmptyString(key, 128) || !isNonEmptyString(entryValue, maxValueLength)) {
      return fail(`Invalid ${field}`);
    }
    result[key] = entryValue;
  }

  return result;
}

function validateElectiveCreditAssignmentMap(
  field: string,
  value: unknown,
  maxEntries: number
): Record<string, string> | ValidationFailure {
  if (!isPlainObject(value) || Object.keys(value).length > maxEntries) {
    return fail(`Invalid ${field}`);
  }

  const result: Record<string, string> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (
      !isNonEmptyString(key, 128) ||
      typeof entryValue !== "string" ||
      !ELECTIVE_CREDIT_AREAS.has(entryValue)
    ) {
      return fail(`Invalid ${field}`);
    }
    result[key] = entryValue;
  }

  return result;
}

function validateSemesterMap(value: unknown): Record<string, string[]> | ValidationFailure {
  if (!isPlainObject(value) || Object.keys(value).length > 17) {
    return fail("Invalid semesters");
  }

  const result: Record<string, string[]> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (!isIntegerInRange(Number(key), 0, 16)) {
      return fail("Invalid semesters");
    }

    const validatedCourses = validateStringArray("semesters", entryValue, 600, 32);
    if (isValidationFailure(validatedCourses)) {
      return validatedCourses;
    }

    result[key] = validatedCourses;
  }

  return result;
}

function validateStringArrayMap(
  field: string,
  value: unknown,
  maxEntries: number,
  maxItemsPerEntry: number,
  maxItemLength = 128
): Record<string, string[]> | ValidationFailure {
  if (!isPlainObject(value) || Object.keys(value).length > maxEntries) {
    return fail(`Invalid ${field}`);
  }

  const result: Record<string, string[]> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (!isNonEmptyString(key, 128)) {
      return fail(`Invalid ${field}`);
    }

    const validatedArray = validateStringArray(field, entryValue, maxItemsPerEntry, maxItemLength);
    if (isValidationFailure(validatedArray)) {
      return validatedArray;
    }

    result[key] = validatedArray;
  }

  return result;
}

function validateSemesterTypeOverrides(
  value: unknown
): Record<string, "winter" | "spring"> | ValidationFailure {
  if (!isPlainObject(value) || Object.keys(value).length > 16) {
    return fail("Invalid semesterTypeOverrides");
  }

  const result: Record<string, "winter" | "spring"> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (!isIntegerInRange(Number(key), 1, 16)) {
      return fail("Invalid semesterTypeOverrides");
    }

    if (entryValue !== "winter" && entryValue !== "spring") {
      return fail("Invalid semesterTypeOverrides");
    }

    result[key] = entryValue;
  }

  return result;
}

function validateSavedTracks(
  value: unknown
): Record<string, Record<string, unknown>> | ValidationFailure {
  if (!isPlainObject(value) || Object.keys(value).length > TRACK_IDS.length) {
    return fail("Invalid savedTracks");
  }

  const result: Record<string, Record<string, unknown>> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (!isTrackId(key)) {
      return fail("Invalid savedTracks");
    }

    const validatedTrack = validateStudentPlanRecord(entryValue, {
      allowSavedTracks: false,
      expectedTrackId: key,
    });

    if (!validatedTrack.ok) {
      return validatedTrack;
    }

    result[key] = validatedTrack.value;
  }

  return result;
}

function validateStudentPlanRecord(
  value: unknown,
  options: PlanValidationOptions
): ValidationResult {
  if (!isPlainObject(value)) {
    return fail("Plan payload must be an object");
  }

  const payloadKeys = Object.keys(value);
  if (payloadKeys.some((key) => !ALLOWED_TOP_LEVEL_KEYS.has(key))) {
    return fail("Plan payload contains unsupported fields");
  }

  if (!options.allowSavedTracks && "savedTracks" in value) {
    return fail("Nested savedTracks are not allowed");
  }

  const sanitized: Record<string, unknown> = {};

  if ("trackId" in value) {
    const trackId = value.trackId;
    if (trackId !== null && !isTrackId(trackId)) {
      return fail("Invalid trackId");
    }
    if (options.expectedTrackId && trackId !== undefined && trackId !== options.expectedTrackId) {
      return fail("Saved track payload does not match its track key");
    }
    sanitized.trackId = trackId;
  }

  if ("semesters" in value) {
    const semesters = validateSemesterMap(value.semesters);
    if (isValidationFailure(semesters)) {
      return semesters;
    }
    sanitized.semesters = semesters;
  }

  if ("completedCourses" in value) {
    const completedCourses = validateStringArray("completedCourses", value.completedCourses, 600, 32);
    if (isValidationFailure(completedCourses)) {
      return completedCourses;
    }
    sanitized.completedCourses = completedCourses;
  }

  if ("selectedSpecializations" in value) {
    const selectedSpecializations = validateStringArray(
      "selectedSpecializations",
      value.selectedSpecializations,
      100,
      128
    );
    if (isValidationFailure(selectedSpecializations)) {
      return selectedSpecializations;
    }
    sanitized.selectedSpecializations = selectedSpecializations;
  }

  if ("favorites" in value) {
    const favorites = validateStringArray("favorites", value.favorites, 600, 32);
    if (isValidationFailure(favorites)) {
      return favorites;
    }
    sanitized.favorites = favorites;
  }

  if ("grades" in value) {
    const grades = validateNumberMap("grades", value.grades, 600, 0, 100);
    if (isValidationFailure(grades)) {
      return grades;
    }
    sanitized.grades = grades;
  }

  if ("substitutions" in value) {
    const substitutions = validateStringMap("substitutions", value.substitutions, 600, 64);
    if (isValidationFailure(substitutions)) {
      return substitutions;
    }
    sanitized.substitutions = substitutions;
  }

  if ("maxSemester" in value) {
    if (!isIntegerInRange(value.maxSemester, 1, 16)) {
      return fail("Invalid maxSemester");
    }
    sanitized.maxSemester = value.maxSemester;
  }

  if ("selectedPrereqGroups" in value) {
    const selectedPrereqGroups = validateStringArrayMap(
      "selectedPrereqGroups",
      value.selectedPrereqGroups,
      600,
      16,
      32
    );
    if (isValidationFailure(selectedPrereqGroups)) {
      return selectedPrereqGroups;
    }
    sanitized.selectedPrereqGroups = selectedPrereqGroups;
  }

  if ("summerSemesters" in value) {
    const summerSemesters = validateIntegerArray("summerSemesters", value.summerSemesters, 16, 1, 16);
    if (isValidationFailure(summerSemesters)) {
      return summerSemesters;
    }
    sanitized.summerSemesters = summerSemesters;
  }

  if ("currentSemester" in value) {
    const currentSemester = value.currentSemester;
    if (currentSemester !== null && !isIntegerInRange(currentSemester, 0, 16)) {
      return fail("Invalid currentSemester");
    }
    sanitized.currentSemester = currentSemester;
  }

  if ("semesterOrder" in value) {
    const semesterOrder = validateIntegerArray("semesterOrder", value.semesterOrder, 16, 1, 16);
    if (isValidationFailure(semesterOrder)) {
      return semesterOrder;
    }
    sanitized.semesterOrder = semesterOrder;
  }

  if ("semesterTypeOverrides" in value) {
    const semesterTypeOverrides = validateSemesterTypeOverrides(value.semesterTypeOverrides);
    if (isValidationFailure(semesterTypeOverrides)) {
      return semesterTypeOverrides;
    }
    sanitized.semesterTypeOverrides = semesterTypeOverrides;
  }

  if ("semesterWarningsIgnored" in value) {
    const semesterWarningsIgnored = validateIntegerArray(
      "semesterWarningsIgnored",
      value.semesterWarningsIgnored,
      16,
      1,
      16
    );
    if (isValidationFailure(semesterWarningsIgnored)) {
      return semesterWarningsIgnored;
    }
    sanitized.semesterWarningsIgnored = semesterWarningsIgnored;
  }

  if ("doubleSpecializations" in value) {
    const doubleSpecializations = validateStringArray(
      "doubleSpecializations",
      value.doubleSpecializations,
      100,
      128
    );
    if (isValidationFailure(doubleSpecializations)) {
      return doubleSpecializations;
    }
    sanitized.doubleSpecializations = doubleSpecializations;
  }

  if ("hasEnglishExemption" in value) {
    if (typeof value.hasEnglishExemption !== "boolean") {
      return fail("Invalid hasEnglishExemption");
    }
    sanitized.hasEnglishExemption = value.hasEnglishExemption;
  }

  if ("manualSapAverages" in value) {
    const manualSapAverages = validateNumberMap("manualSapAverages", value.manualSapAverages, 600, 0, 100);
    if (isValidationFailure(manualSapAverages)) {
      return manualSapAverages;
    }
    sanitized.manualSapAverages = manualSapAverages;
  }

  if ("binaryPass" in value) {
    const binaryPass = validateBooleanMap("binaryPass", value.binaryPass, 600);
    if (isValidationFailure(binaryPass)) {
      return binaryPass;
    }
    sanitized.binaryPass = binaryPass;
  }

  if ("explicitSportCompletions" in value) {
    const explicitSportCompletions = validateStringArray(
      "explicitSportCompletions",
      value.explicitSportCompletions,
      600,
      32
    );
    if (isValidationFailure(explicitSportCompletions)) {
      return explicitSportCompletions;
    }
    sanitized.explicitSportCompletions = explicitSportCompletions;
  }

  if ("completedInstances" in value) {
    const completedInstances = validateStringArray("completedInstances", value.completedInstances, 600, 64);
    if (isValidationFailure(completedInstances)) {
      return completedInstances;
    }
    sanitized.completedInstances = completedInstances;
  }

  if ("savedTracks" in value) {
    const savedTracks = validateSavedTracks(value.savedTracks);
    if (isValidationFailure(savedTracks)) {
      return savedTracks;
    }
    sanitized.savedTracks = savedTracks;
  }

  if ("miluimCredits" in value) {
    if (!isIntegerInRange(value.miluimCredits, 0, 10)) {
      return fail("Invalid miluimCredits");
    }
    sanitized.miluimCredits = value.miluimCredits;
  }

  if ("englishScore" in value) {
    if (!isIntegerInRange(value.englishScore, 0, 150)) {
      return fail("Invalid englishScore");
    }
    sanitized.englishScore = value.englishScore;
  }

  if ("englishTaughtCourses" in value) {
    const englishTaughtCourses = validateStringArray(
      "englishTaughtCourses",
      value.englishTaughtCourses,
      600,
      32
    );
    if (isValidationFailure(englishTaughtCourses)) {
      return englishTaughtCourses;
    }
    sanitized.englishTaughtCourses = englishTaughtCourses;
  }

  if ("facultyColorOverrides" in value) {
    const facultyColorOverrides = validateStringMap(
      "facultyColorOverrides",
      value.facultyColorOverrides,
      100,
      32
    );
    if (isValidationFailure(facultyColorOverrides)) {
      return facultyColorOverrides;
    }
    sanitized.facultyColorOverrides = facultyColorOverrides;
  }

  if ("dismissedRecommendedCourses" in value) {
    const dismissedRecommendedCourses = validateStringArrayMap(
      "dismissedRecommendedCourses",
      value.dismissedRecommendedCourses,
      TRACK_IDS.length,
      600,
      32
    );
    if (isValidationFailure(dismissedRecommendedCourses)) {
      return dismissedRecommendedCourses;
    }
    sanitized.dismissedRecommendedCourses = dismissedRecommendedCourses;
  }

  if ("coreToChainOverrides" in value) {
    const coreToChainOverrides = validateStringArray(
      "coreToChainOverrides",
      value.coreToChainOverrides,
      600,
      32
    );
    if (isValidationFailure(coreToChainOverrides)) {
      return coreToChainOverrides;
    }
    sanitized.coreToChainOverrides = coreToChainOverrides;
  }

  if ("courseChainAssignments" in value) {
    const courseChainAssignments = validateStringMap(
      "courseChainAssignments",
      value.courseChainAssignments,
      200,
      64
    );
    if (isValidationFailure(courseChainAssignments)) {
      return courseChainAssignments;
    }
    sanitized.courseChainAssignments = courseChainAssignments;
  }

  if ("electiveCreditAssignments" in value) {
    const electiveCreditAssignments = validateElectiveCreditAssignmentMap(
      "electiveCreditAssignments",
      value.electiveCreditAssignments,
      600
    );
    if (isValidationFailure(electiveCreditAssignments)) {
      return electiveCreditAssignments;
    }
    sanitized.electiveCreditAssignments = electiveCreditAssignments;
  }

  if ("noAdditionalCreditOverrides" in value) {
    const noAdditionalCreditOverrides = validateStringMap(
      "noAdditionalCreditOverrides",
      value.noAdditionalCreditOverrides,
      600,
      32
    );
    if (isValidationFailure(noAdditionalCreditOverrides)) {
      return noAdditionalCreditOverrides;
    }
    sanitized.noAdditionalCreditOverrides = noAdditionalCreditOverrides;
  }

  if ("roboticsMinorEnabled" in value) {
    if (typeof value.roboticsMinorEnabled !== "boolean") {
      return fail("Invalid roboticsMinorEnabled");
    }
    sanitized.roboticsMinorEnabled = value.roboticsMinorEnabled;
  }

  if ("entrepreneurshipMinorEnabled" in value) {
    if (typeof value.entrepreneurshipMinorEnabled !== "boolean") {
      return fail("Invalid entrepreneurshipMinorEnabled");
    }
    sanitized.entrepreneurshipMinorEnabled = value.entrepreneurshipMinorEnabled;
  }

  if ("quantumComputingMinorEnabled" in value) {
    if (typeof value.quantumComputingMinorEnabled !== "boolean") {
      return fail("Invalid quantumComputingMinorEnabled");
    }
    sanitized.quantumComputingMinorEnabled = value.quantumComputingMinorEnabled;
  }

  if ("initializedTracks" in value) {
    const initializedTracks = validateStringArray("initializedTracks", value.initializedTracks, 20, 32);
    if (isValidationFailure(initializedTracks)) return initializedTracks;
    sanitized.initializedTracks = initializedTracks;
  }

  if ("targetGraduationSemesterId" in value) {
    const targetGraduationSemesterId = value.targetGraduationSemesterId;
    if (
      targetGraduationSemesterId !== null &&
      !isIntegerInRange(targetGraduationSemesterId, 1, 16)
    ) {
      return fail("Invalid targetGraduationSemesterId");
    }
    sanitized.targetGraduationSemesterId = targetGraduationSemesterId;
  }

  if ("loadProfile" in value) {
    if (value.loadProfile !== "working" && value.loadProfile !== "fulltime") {
      return fail("Invalid loadProfile");
    }
    sanitized.loadProfile = value.loadProfile;
  }

  return success(sanitized);
}

function validateVersionedEnvelope(value: unknown): ValidationResult {
  if (!isPlainObject(value)) return fail("Envelope must be an object");
  if (value.schemaVersion !== 2) return fail("Invalid schemaVersion");
  if (!Array.isArray(value.versions) || value.versions.length === 0 || value.versions.length > 4) {
    return fail("Invalid versions array");
  }
  if (!isNonEmptyString(value.activeVersionId, 128)) return fail("Invalid activeVersionId");

  const sanitizedVersions: Record<string, unknown>[] = [];
  for (const v of value.versions as unknown[]) {
    if (!isPlainObject(v)) return fail("Invalid version entry");
    if (!isNonEmptyString(v.id, 128)) return fail("Invalid version id");
    if (!isNonEmptyString(v.name, 128)) return fail("Invalid version name");
    if (!isFiniteNumber(v.createdAt) || !isFiniteNumber(v.updatedAt)) return fail("Invalid version timestamps");
    const planResult = validateStudentPlanRecord(v.plan, { allowSavedTracks: true });
    if (!planResult.ok) return planResult;
    sanitizedVersions.push({ id: v.id, name: v.name, plan: planResult.value, createdAt: v.createdAt, updatedAt: v.updatedAt });
  }

  const hasActive = sanitizedVersions.some((v) => v.id === value.activeVersionId);
  if (!hasActive) return fail("activeVersionId not found in versions");

  return success({ schemaVersion: 2, versions: sanitizedVersions, activeVersionId: value.activeVersionId });
}

export function validateStudentPlanPayload(value: unknown): ValidationResult {
  if (isPlainObject(value) && value.schemaVersion === 2) {
    return validateVersionedEnvelope(value);
  }
  return validateStudentPlanRecord(value, { allowSavedTracks: true });
}
