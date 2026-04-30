type TrackId = "ee" | "cs" | "ee_math" | "ee_physics" | "ee_combined" | "ce";

type PlanDocument = Record<string, unknown>;

const TRACK_IDS = new Set<TrackId>(["ee", "cs", "ee_math", "ee_physics", "ee_combined", "ce"]);
const MAX_COURSES = 600;
const MAX_SPECIALIZATIONS = 100;
const MAX_SAVED_TRACKS = 6;
const MAX_SEMESTERS = 16;
const COURSE_ID_MAX_LENGTH = 32;
const STRING_VALUE_MAX_LENGTH = 128;
const ELECTIVE_CREDIT_AREAS = new Set(["ee", "physics", "math", "general"]);

export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new PlanValidationError(`${fieldName} must be an object`);
  }
  return value;
}

function optionalRecord(value: unknown, fieldName: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  return asRecord(value, fieldName);
}

function cleanString(value: unknown, fieldName: string, maxLength = STRING_VALUE_MAX_LENGTH): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new PlanValidationError(`${fieldName} must be a non-empty string up to ${maxLength} chars`);
  }
  return value;
}

function cleanCourseId(value: unknown, fieldName: string): string {
  return cleanString(value, fieldName, COURSE_ID_MAX_LENGTH);
}

function cleanStringArray(
  value: unknown,
  fieldName: string,
  maxItems: number,
  maxLength = COURSE_ID_MAX_LENGTH
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new PlanValidationError(`${fieldName} must be an array with at most ${maxItems} items`);
  }
  return value.map((item, index) => cleanString(item, `${fieldName}[${index}]`, maxLength));
}

function cleanNumberArray(value: unknown, fieldName: string, maxItems = MAX_SEMESTERS): number[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new PlanValidationError(`${fieldName} must be an array with at most ${maxItems} items`);
  }
  return value.map((item, index) => cleanInteger(item, `${fieldName}[${index}]`, 0, MAX_SEMESTERS));
}

function cleanInteger(value: unknown, fieldName: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new PlanValidationError(`${fieldName} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function cleanOptionalInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): number | undefined {
  if (value === undefined) return undefined;
  return cleanInteger(value, fieldName, min, max);
}

function cleanNullableInteger(value: unknown, fieldName: string, min: number, max: number): number | null {
  if (value === undefined || value === null) return null;
  return cleanInteger(value, fieldName, min, max);
}

function cleanBoolean(value: unknown, fieldName: string, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value !== "boolean") {
    throw new PlanValidationError(`${fieldName} must be a boolean`);
  }
  return value;
}

function cleanLoadProfile(value: unknown): "working" | "fulltime" {
  if (value === undefined) return "fulltime";
  if (value !== "working" && value !== "fulltime") {
    throw new PlanValidationError("loadProfile must be working or fulltime");
  }
  return value;
}

function cleanNumberRecord(
  value: unknown,
  fieldName: string,
  min: number,
  max: number,
  maxEntries = MAX_COURSES
): Record<string, number> {
  const source = optionalRecord(value, fieldName);
  if (!source) return {};
  const entries = Object.entries(source);
  if (entries.length > maxEntries) {
    throw new PlanValidationError(`${fieldName} has too many entries`);
  }

  const result: Record<string, number> = {};
  for (const [key, rawValue] of entries) {
    const courseId = cleanCourseId(key, `${fieldName} key`);
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue < min || rawValue > max) {
      throw new PlanValidationError(`${fieldName}.${courseId} must be a number between ${min} and ${max}`);
    }
    result[courseId] = rawValue;
  }
  return result;
}

function cleanBooleanRecord(value: unknown, fieldName: string, maxEntries = MAX_COURSES): Record<string, boolean> {
  const source = optionalRecord(value, fieldName);
  if (!source) return {};
  const entries = Object.entries(source);
  if (entries.length > maxEntries) {
    throw new PlanValidationError(`${fieldName} has too many entries`);
  }

  const result: Record<string, boolean> = {};
  for (const [key, rawValue] of entries) {
    const courseId = cleanCourseId(key, `${fieldName} key`);
    if (typeof rawValue !== "boolean") {
      throw new PlanValidationError(`${fieldName}.${courseId} must be a boolean`);
    }
    result[courseId] = rawValue;
  }
  return result;
}

function cleanStringRecord(
  value: unknown,
  fieldName: string,
  maxEntries = MAX_COURSES,
  maxValueLength = COURSE_ID_MAX_LENGTH
): Record<string, string> {
  const source = optionalRecord(value, fieldName);
  if (!source) return {};
  const entries = Object.entries(source);
  if (entries.length > maxEntries) {
    throw new PlanValidationError(`${fieldName} has too many entries`);
  }

  const result: Record<string, string> = {};
  for (const [key, rawValue] of entries) {
    const cleanKey = cleanString(key, `${fieldName} key`, STRING_VALUE_MAX_LENGTH);
    result[cleanKey] = cleanString(rawValue, `${fieldName}.${cleanKey}`, maxValueLength);
  }
  return result;
}

function cleanElectiveCreditAssignmentRecord(
  value: unknown,
  fieldName = "electiveCreditAssignments",
  maxEntries = MAX_COURSES
): Record<string, string> {
  const source = optionalRecord(value, fieldName);
  if (!source) return {};
  const entries = Object.entries(source);
  if (entries.length > maxEntries) {
    throw new PlanValidationError(`${fieldName} has too many entries`);
  }

  const result: Record<string, string> = {};
  for (const [key, rawValue] of entries) {
    const courseId = cleanCourseId(key, `${fieldName} key`);
    if (typeof rawValue !== "string" || !ELECTIVE_CREDIT_AREAS.has(rawValue)) {
      throw new PlanValidationError(`${fieldName}.${courseId} is invalid`);
    }
    result[courseId] = rawValue;
  }
  return result;
}

function cleanSelectedPrereqGroups(value: unknown): Record<string, string[]> {
  const source = optionalRecord(value, "selectedPrereqGroups");
  if (!source) return {};
  const entries = Object.entries(source);
  if (entries.length > MAX_COURSES) {
    throw new PlanValidationError("selectedPrereqGroups has too many entries");
  }

  const result: Record<string, string[]> = {};
  for (const [courseId, rawGroup] of entries) {
    const cleanId = cleanCourseId(courseId, "selectedPrereqGroups key");
    result[cleanId] = cleanStringArray(rawGroup, `selectedPrereqGroups.${cleanId}`, 20);
  }
  return result;
}

function cleanSemesters(value: unknown): Record<string, string[]> {
  const source = asRecord(value ?? {}, "semesters");
  const entries = Object.entries(source);
  if (entries.length > MAX_SEMESTERS + 1) {
    throw new PlanValidationError("semesters has too many entries");
  }

  const result: Record<string, string[]> = {};
  for (const [semesterKey, rawCourses] of entries) {
    const semester = Number(semesterKey);
    if (!Number.isInteger(semester) || semester < 0 || semester > MAX_SEMESTERS) {
      throw new PlanValidationError(`Invalid semester key: ${semesterKey}`);
    }
    result[String(semester)] = cleanStringArray(rawCourses, `semesters.${semester}`, MAX_COURSES);
  }
  return result;
}

function cleanSemesterTypes(value: unknown): Record<string, "winter" | "spring"> {
  const source = optionalRecord(value, "semesterTypeOverrides");
  if (!source) return {};

  const result: Record<string, "winter" | "spring"> = {};
  for (const [semesterKey, rawType] of Object.entries(source)) {
    const semester = Number(semesterKey);
    if (!Number.isInteger(semester) || semester < 1 || semester > MAX_SEMESTERS) {
      throw new PlanValidationError(`Invalid semesterTypeOverrides key: ${semesterKey}`);
    }
    if (rawType !== "winter" && rawType !== "spring") {
      throw new PlanValidationError(`semesterTypeOverrides.${semesterKey} must be winter or spring`);
    }
    result[String(semester)] = rawType;
  }
  return result;
}

function cleanTrackId(value: unknown): TrackId | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !TRACK_IDS.has(value as TrackId)) {
    throw new PlanValidationError("trackId is invalid");
  }
  return value as TrackId;
}

function cleanSavedTracks(value: unknown): Record<string, PlanDocument> {
  const source = optionalRecord(value, "savedTracks");
  if (!source) return {};

  const entries = Object.entries(source);
  if (entries.length > MAX_SAVED_TRACKS) {
    throw new PlanValidationError("savedTracks has too many entries");
  }

  const result: Record<string, PlanDocument> = {};
  for (const [trackId, rawPlan] of entries) {
    if (!TRACK_IDS.has(trackId as TrackId)) {
      throw new PlanValidationError(`Invalid savedTracks key: ${trackId}`);
    }
    result[trackId] = sanitizePlanPayload(rawPlan, false);
  }
  return result;
}

function cleanDismissedRecommendedCourses(value: unknown): Record<string, string[]> {
  const source = optionalRecord(value, "dismissedRecommendedCourses");
  if (!source) return {};

  const entries = Object.entries(source);
  if (entries.length > MAX_SAVED_TRACKS) {
    throw new PlanValidationError("dismissedRecommendedCourses has too many entries");
  }

  const result: Record<string, string[]> = {};
  for (const [trackId, rawCourseIds] of entries) {
    if (!TRACK_IDS.has(trackId as TrackId)) {
      throw new PlanValidationError(`Invalid dismissedRecommendedCourses key: ${trackId}`);
    }
    result[trackId] = cleanStringArray(
      rawCourseIds,
      `dismissedRecommendedCourses.${trackId}`,
      MAX_COURSES
    );
  }

  return result;
}

export function sanitizePlanPayload(payload: unknown, allowSavedTracks = true): PlanDocument {
  const source = asRecord(payload, "plan");
  const maxSemester = cleanInteger(source.maxSemester ?? 8, "maxSemester", 1, MAX_SEMESTERS);
  const miluimCredits = cleanOptionalInteger(source.miluimCredits, "miluimCredits", 0, 10);
  const englishScore = cleanOptionalInteger(source.englishScore, "englishScore", 0, 150);
  const sanitized: PlanDocument = {
    trackId: cleanTrackId(source.trackId),
    semesters: cleanSemesters(source.semesters),
    completedCourses: cleanStringArray(source.completedCourses, "completedCourses", MAX_COURSES),
    selectedSpecializations: cleanStringArray(
      source.selectedSpecializations,
      "selectedSpecializations",
      MAX_SPECIALIZATIONS,
      STRING_VALUE_MAX_LENGTH
    ),
    favorites: cleanStringArray(source.favorites, "favorites", MAX_COURSES),
    grades: cleanNumberRecord(source.grades, "grades", 0, 100),
    substitutions: cleanStringRecord(source.substitutions, "substitutions"),
    maxSemester,
    selectedPrereqGroups: cleanSelectedPrereqGroups(source.selectedPrereqGroups),
    summerSemesters: cleanNumberArray(source.summerSemesters, "summerSemesters"),
    currentSemester: cleanNullableInteger(source.currentSemester, "currentSemester", 0, MAX_SEMESTERS),
    semesterOrder: cleanNumberArray(source.semesterOrder, "semesterOrder"),
    semesterTypeOverrides: cleanSemesterTypes(source.semesterTypeOverrides),
    semesterWarningsIgnored: cleanNumberArray(source.semesterWarningsIgnored, "semesterWarningsIgnored"),
    doubleSpecializations: cleanStringArray(
      source.doubleSpecializations,
      "doubleSpecializations",
      MAX_SPECIALIZATIONS,
      STRING_VALUE_MAX_LENGTH
    ),
    hasEnglishExemption: cleanBoolean(source.hasEnglishExemption, "hasEnglishExemption"),
    manualSapAverages: cleanNumberRecord(source.manualSapAverages, "manualSapAverages", 0, 100),
    binaryPass: cleanBooleanRecord(source.binaryPass, "binaryPass"),
    explicitSportCompletions: cleanStringArray(
      source.explicitSportCompletions,
      "explicitSportCompletions",
      MAX_COURSES
    ),
    completedInstances: cleanStringArray(source.completedInstances, "completedInstances", MAX_COURSES, 64),
    englishTaughtCourses: cleanStringArray(source.englishTaughtCourses, "englishTaughtCourses", MAX_COURSES),
    dismissedRecommendedCourses: cleanDismissedRecommendedCourses(source.dismissedRecommendedCourses),
    facultyColorOverrides: cleanStringRecord(
      source.facultyColorOverrides,
      "facultyColorOverrides",
      MAX_SPECIALIZATIONS,
      STRING_VALUE_MAX_LENGTH
    ),
    coreToChainOverrides: cleanStringArray(
      source.coreToChainOverrides,
      "coreToChainOverrides",
      MAX_COURSES
    ),
    courseChainAssignments: cleanStringRecord(
      source.courseChainAssignments,
      "courseChainAssignments",
      200,
      64
    ),
    electiveCreditAssignments: cleanElectiveCreditAssignmentRecord(source.electiveCreditAssignments),
    noAdditionalCreditOverrides: cleanStringRecord(
      source.noAdditionalCreditOverrides,
      "noAdditionalCreditOverrides",
      MAX_COURSES,
      COURSE_ID_MAX_LENGTH
    ),
    roboticsMinorEnabled: cleanBoolean(source.roboticsMinorEnabled, "roboticsMinorEnabled"),
    entrepreneurshipMinorEnabled: cleanBoolean(
      source.entrepreneurshipMinorEnabled,
      "entrepreneurshipMinorEnabled"
    ),
    initializedTracks: cleanStringArray(source.initializedTracks, "initializedTracks", 20),
    targetGraduationSemesterId: cleanNullableInteger(
      source.targetGraduationSemesterId,
      "targetGraduationSemesterId",
      1,
      MAX_SEMESTERS
    ),
    loadProfile: cleanLoadProfile(source.loadProfile),
  };

  if (allowSavedTracks) {
    sanitized.savedTracks = cleanSavedTracks(source.savedTracks);
  }
  if (miluimCredits !== undefined) {
    sanitized.miluimCredits = miluimCredits;
  }
  if (englishScore !== undefined) {
    sanitized.englishScore = englishScore;
  }

  return sanitized;
}
