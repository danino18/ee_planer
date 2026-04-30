import type {
  PlanVersion,
  SapCourse,
  StudentPlan,
  TrackDefinition,
  TrackId,
  TrackSpecializationCatalog,
  VersionedPlanEnvelope,
} from '../types';
import { buildEnvelopeFromState } from './planSync';
import { sanitizeEnvelope } from './planValidation';
import { computeRequirementsProgress } from '../hooks/usePlan';
import { computeWeightedAverage, gradeKey } from '../utils/courseGrades';
import { ELECTIVE_AREA_LABELS } from '../domain/electives';

export interface ExportOptions {
  includeGrades: boolean;
  versionIds?: string[];
}

export type ImportResult =
  | { ok: true; envelope: VersionedPlanEnvelope }
  | { ok: false; error: string };

type StateLike = StudentPlan & {
  versions?: PlanVersion[];
  activeVersionId?: string;
};

function stripGradesFromPlan(plan: StudentPlan): StudentPlan {
  const next: StudentPlan = {
    ...plan,
    grades: {},
    binaryPass: {},
    manualSapAverages: {},
  };
  if (plan.savedTracks) {
    next.savedTracks = Object.fromEntries(
      Object.entries(plan.savedTracks).map(([trackId, trackPlan]) => [
        trackId,
        stripGradesFromPlan(trackPlan),
      ]),
    );
  }
  return next;
}

export function buildExportEnvelope(
  state: StateLike,
  options: ExportOptions,
): VersionedPlanEnvelope {
  const fullEnvelope = buildEnvelopeFromState(state);
  const requestedIds = options.versionIds && options.versionIds.length > 0
    ? new Set(options.versionIds)
    : null;

  let versions = requestedIds
    ? fullEnvelope.versions.filter((v) => requestedIds.has(v.id))
    : fullEnvelope.versions;
  if (versions.length === 0) versions = fullEnvelope.versions;

  let activeVersionId = fullEnvelope.activeVersionId;
  if (!versions.some((v) => v.id === activeVersionId)) {
    activeVersionId = versions[0].id;
  }

  if (!options.includeGrades) {
    versions = versions.map((v) => ({ ...v, plan: stripGradesFromPlan(v.plan) }));
  }

  return { schemaVersion: 2, versions, activeVersionId };
}

export function envelopeToJsonString(envelope: VersionedPlanEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

export function parseImportedEnvelope(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'הקובץ אינו JSON תקין' };
  }
  const sanitized = sanitizeEnvelope(parsed);
  if (!sanitized) {
    return { ok: false, error: 'הקובץ אינו מייצג תוכנית לימודים תקינה' };
  }
  return { ok: true, envelope: sanitized };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' && Number.isFinite(value) ? String(value) : String(value);
  if (s === '') return '';
  if (/[",\n\r]/.test(s) || s.startsWith(' ') || s.endsWith(' ')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

const TRACK_NAMES: Record<TrackId, string> = {
  ee: 'חשמל',
  cs: 'מחשבים',
  ee_math: 'חשמל + מתמטיקה',
  ee_physics: 'חשמל + פיזיקה',
  ee_combined: 'חשמל משולב',
  ce: 'הנדסת מחשבים',
};

function seasonLabel(
  semester: number,
  summerSemesters: number[],
  overrides: Record<number, 'winter' | 'spring'> | undefined,
): string {
  if (semester === 0) return 'הושלם קודם';
  if (summerSemesters.includes(semester)) return 'קיץ';
  const override = overrides?.[semester];
  if (override === 'winter') return 'חורף';
  if (override === 'spring') return 'אביב';
  return semester % 2 === 1 ? 'חורף' : 'אביב';
}

function semesterLabel(semester: number): string {
  if (semester === 0) return 'הושלם מראש';
  return `סמסטר ${semester}`;
}

interface CsvBuildContext {
  envelope: VersionedPlanEnvelope;
  courses: Map<string, SapCourse>;
  trackDef: TrackDefinition | null;
  catalog: TrackSpecializationCatalog | null;
  includeGrades: boolean;
}

function buildMetadataRows(ctx: CsvBuildContext): string[] {
  const { envelope, trackDef, courses, includeGrades } = ctx;
  const active = envelope.versions.find((v) => v.id === envelope.activeVersionId);
  const plan = active?.plan;

  const placed = plan
    ? new Set<string>([...plan.completedCourses, ...Object.values(plan.semesters).flat()])
    : new Set<string>();
  const totalCredits = [...placed].reduce(
    (sum, id) => sum + (courses.get(id)?.credits ?? 0),
    0,
  );

  let weightedAverage: number | null = null;
  if (includeGrades && plan) {
    weightedAverage = computeWeightedAverage(
      { semesters: plan.semesters, grades: plan.grades, binaryPass: plan.binaryPass ?? {} },
      courses,
    );
  }

  const trackName = plan?.trackId ? TRACK_NAMES[plan.trackId] : '';
  const rows: string[] = [];
  rows.push(csvRow(['# מטא-נתונים']));
  rows.push(csvRow(['מפתח', 'ערך']));
  rows.push(csvRow(['תאריך יצוא', new Date().toISOString().slice(0, 10)]));
  rows.push(csvRow(['מסלול (קוד)', plan?.trackId ?? '']));
  rows.push(csvRow(['מסלול (שם)', trackDef?.name ?? trackName]));
  rows.push(csvRow(['גרסה פעילה', active?.name ?? '']));
  rows.push(csvRow(['סה"כ גרסאות ביצוא', envelope.versions.length]));
  rows.push(csvRow(['סה"כ נ"ז מתוכננות', totalCredits]));
  if (includeGrades) {
    rows.push(csvRow([
      'ממוצע משוקלל',
      weightedAverage !== null ? weightedAverage.toFixed(2) : '',
    ]));
  }
  rows.push(csvRow(['ציון אנגלית', plan?.englishScore ?? '']));
  rows.push(csvRow(['פטור אנגלית', plan?.hasEnglishExemption ? 'כן' : 'לא']));
  rows.push(csvRow(['חודשי מילואים', plan?.miluimCredits ?? 0]));
  rows.push(csvRow(['מינור רובוטיקה', plan?.roboticsMinorEnabled ? 'כן' : 'לא']));
  rows.push(csvRow(['מינור יזמות', plan?.entrepreneurshipMinorEnabled ? 'כן' : 'לא']));
  return rows;
}

function buildSemesterRows(ctx: CsvBuildContext): string[] {
  const { envelope, courses, includeGrades } = ctx;
  const rows: string[] = [];
  rows.push(csvRow(['# סמסטרים']));
  const header = [
    'גרסה',
    'סמסטר',
    'כותרת סמסטר',
    'עונה',
    'מס\' קורס',
    'שם קורס',
    'נ"ז',
    'פקולטה',
    'סטטוס',
  ];
  if (includeGrades) header.push('ציון', 'עובר בינארי');
  rows.push(csvRow(header));

  for (const version of envelope.versions) {
    const plan = version.plan;
    const completed = new Set(plan.completedCourses);
    const order = plan.semesterOrder.length > 0
      ? plan.semesterOrder
      : Object.keys(plan.semesters).map(Number).sort((a, b) => a - b);
    const semesters = [0, ...order.filter((n) => n !== 0)];

    for (const semester of semesters) {
      const courseIds = plan.semesters[semester] ?? [];
      if (courseIds.length === 0) continue;
      const season = seasonLabel(semester, plan.summerSemesters ?? [], plan.semesterTypeOverrides);
      const title = semesterLabel(semester);
      for (const courseId of courseIds) {
        const course = courses.get(courseId);
        const status = completed.has(courseId) ? 'הושלם' : 'מתוכנן';
        const row: unknown[] = [
          version.name,
          semester,
          title,
          season,
          courseId,
          course?.name ?? '',
          course?.credits ?? '',
          course?.faculty ?? '',
          status,
        ];
        if (includeGrades) {
          const grade = plan.grades[gradeKey(courseId, semester)] ?? plan.grades[courseId];
          const isBinary = !!(plan.binaryPass ?? {})[courseId];
          row.push(grade !== undefined ? grade : '');
          row.push(isBinary ? 'כן' : '');
        }
        rows.push(csvRow(row));
      }
    }
  }
  return rows;
}

function buildRequirementsRows(ctx: CsvBuildContext): string[] {
  const { envelope, courses, trackDef, catalog, includeGrades } = ctx;
  const active = envelope.versions.find((v) => v.id === envelope.activeVersionId);
  if (!active || !trackDef || !catalog) return [];
  const plan = active.plan;

  const weightedAverage = includeGrades
    ? computeWeightedAverage(
        { semesters: plan.semesters, grades: plan.grades, binaryPass: plan.binaryPass ?? {} },
        courses,
      )
    : null;

  const progress = computeRequirementsProgress(
    {
      semesters: plan.semesters,
      completedCourses: plan.completedCourses,
      completedInstances: plan.completedInstances ?? [],
      grades: plan.grades ?? {},
      binaryPass: plan.binaryPass ?? {},
      selectedSpecializations: plan.selectedSpecializations,
      doubleSpecializations: plan.doubleSpecializations ?? [],
      hasEnglishExemption: plan.hasEnglishExemption ?? false,
      miluimCredits: plan.miluimCredits ?? 0,
      englishScore: plan.englishScore,
      englishTaughtCourses: plan.englishTaughtCourses ?? [],
      semesterOrder: plan.semesterOrder,
      coreToChainOverrides: plan.coreToChainOverrides ?? [],
      courseChainAssignments: plan.courseChainAssignments,
      electiveCreditAssignments: plan.electiveCreditAssignments,
      roboticsMinorEnabled: plan.roboticsMinorEnabled ?? false,
      entrepreneurshipMinorEnabled: plan.entrepreneurshipMinorEnabled ?? false,
    },
    courses,
    trackDef,
    catalog,
    weightedAverage,
  );

  const rows: string[] = [];
  rows.push(csvRow(['# דרישות (גרסה פעילה)']));
  rows.push(csvRow(['קטגוריה', 'הושלם', 'נדרש', 'יחידה', 'סטטוס']));

  if (!progress) {
    rows.push(csvRow(['—', '', '', '', 'לא ניתן לחשב דרישות למסלול']));
    return rows;
  }

  const pushMetric = (
    label: string,
    earned: number,
    required: number,
    unit: string,
  ) => {
    const done = earned >= required ? 'הושלם' : 'בתהליך';
    rows.push(csvRow([label, earned, required, unit, done]));
  };

  pushMetric('נ"ז חובה', progress.mandatory.earned, progress.mandatory.required, 'נ"ז');
  pushMetric('נ"ז בחירה', progress.elective.earned, progress.elective.required, 'נ"ז');
  for (const requirement of progress.electiveBreakdown.areaRequirements) {
    pushMetric(requirement.label, requirement.earned, requirement.required, 'נ"ז');
    if (requirement.requiredAnyOfCourseIds) {
      const done = requirement.requiredAnyOfDone ? '\u05d4\u05d5\u05e9\u05dc\u05dd' : '\u05d1\u05ea\u05d4\u05dc\u05d9\u05da';
      rows.push(csvRow([
        `${requirement.label} - \u05dc\u05e4\u05d7\u05d5\u05ea \u05e7\u05d5\u05e8\u05e1 \u05d0\u05d7\u05d3 \u05de\u05d4\u05e8\u05e9\u05d9\u05de\u05d4`,
        requirement.requiredAnyOfDone ? 1 : 0,
        1,
        '\u05ea\u05e0\u05d0\u05d9',
        done,
      ]));
    }
  }
  for (const choice of progress.electiveBreakdown.assignmentChoices) {
    rows.push(csvRow([
      `\u05e9\u05d9\u05d5\u05da \u05d1\u05d7\u05d9\u05e8\u05d4 - ${choice.courseName}`,
      ELECTIVE_AREA_LABELS[choice.selectedArea],
      '',
      '',
      '',
    ]));
  }
  pushMetric('נ"ז סה"כ', progress.total.earned, progress.total.required, 'נ"ז');
  pushMetric(
    'כלל טכניוניים (סה"כ)',
    progress.generalElectivesBreakdown.total.recognized,
    progress.generalElectivesBreakdown.total.target,
    'נ"ז',
  );
  pushMetric(
    'כלל טכניוניים — ספורט',
    progress.generalElectivesBreakdown.sportFloor.recognized,
    progress.generalElectivesBreakdown.sportFloor.target,
    'נ"ז',
  );
  pushMetric(
    'כלל טכניוניים — העשרה / מל"ג',
    progress.generalElectivesBreakdown.enrichmentFloor.recognized,
    progress.generalElectivesBreakdown.enrichmentFloor.target,
    'נ"ז',
  );
  pushMetric(
    'כלל טכניוניים — בחירה חופשית',
    progress.generalElectivesBreakdown.freeChoice.recognized,
    progress.generalElectivesBreakdown.freeChoice.target,
    'נ"ז',
  );
  pushMetric(
    'שרשראות התמחות',
    progress.specializationGroups.completed,
    progress.specializationGroups.required,
    'שרשראות',
  );
  if (progress.labPoolProgress) {
    pushMetric(
      'מעבדות',
      progress.labPoolProgress.earned,
      progress.labPoolProgress.required,
      'נ"ז',
    );
  }
  if (progress.coreRequirementProgress) {
    pushMetric(
      'קורסי ליבה',
      progress.coreRequirementProgress.completed,
      progress.coreRequirementProgress.required,
      'קורסים',
    );
  }
  if (progress.roboticsMinorProgress) {
    const r = progress.roboticsMinorProgress;
    pushMetric('מינור רובוטיקה — נ"ז מאגר', r.poolEarned, r.poolRequired, 'נ"ז');
  }
  if (progress.entrepreneurshipMinorProgress) {
    const e = progress.entrepreneurshipMinorProgress;
    pushMetric('מינור יזמות — נ"ז', e.creditsEarned, e.creditsRequired, 'נ"ז');
    pushMetric(
      'מינור יזמות — חובה',
      e.mandatoryCompleted,
      e.mandatoryRequired,
      'קורסים',
    );
  }

  rows.push(csvRow([
    'אנגלית',
    progress.english.hasExemption ? 'פטור' : (progress.english.score ?? ''),
    '',
    '',
    progress.english.hasExemption ? 'פטור' : '',
  ]));

  return rows;
}

function buildSpecializationRows(ctx: CsvBuildContext): string[] {
  const { envelope, courses, trackDef, catalog, includeGrades } = ctx;
  const active = envelope.versions.find((v) => v.id === envelope.activeVersionId);
  if (!active || !trackDef || !catalog) return [];
  const plan = active.plan;

  const weightedAverage = includeGrades
    ? computeWeightedAverage(
        { semesters: plan.semesters, grades: plan.grades, binaryPass: plan.binaryPass ?? {} },
        courses,
      )
    : null;

  const progress = computeRequirementsProgress(
    {
      semesters: plan.semesters,
      completedCourses: plan.completedCourses,
      completedInstances: plan.completedInstances ?? [],
      grades: plan.grades ?? {},
      binaryPass: plan.binaryPass ?? {},
      selectedSpecializations: plan.selectedSpecializations,
      doubleSpecializations: plan.doubleSpecializations ?? [],
      hasEnglishExemption: plan.hasEnglishExemption ?? false,
      miluimCredits: plan.miluimCredits ?? 0,
      englishScore: plan.englishScore,
      englishTaughtCourses: plan.englishTaughtCourses ?? [],
      semesterOrder: plan.semesterOrder,
      coreToChainOverrides: plan.coreToChainOverrides ?? [],
      courseChainAssignments: plan.courseChainAssignments,
      electiveCreditAssignments: plan.electiveCreditAssignments,
      roboticsMinorEnabled: plan.roboticsMinorEnabled ?? false,
      entrepreneurshipMinorEnabled: plan.entrepreneurshipMinorEnabled ?? false,
    },
    courses,
    trackDef,
    catalog,
    weightedAverage,
  );

  const rows: string[] = [];
  rows.push(csvRow(['# התמחויות (גרסה פעילה)']));
  rows.push(csvRow(['שם', 'מצב', 'הושלם', 'נדרש', 'סטטוס']));

  if (!progress || progress.groupDetails.length === 0) {
    rows.push(csvRow(['—', '', '', '', 'לא נבחרו שרשראות']));
    return rows;
  }

  for (const detail of progress.groupDetails) {
    rows.push(csvRow([
      detail.name,
      detail.isDouble ? 'כפולה' : 'יחיד',
      detail.done,
      detail.min,
      detail.complete ? 'הושלם' : 'בתהליך',
    ]));
  }

  return rows;
}

function buildSubstitutionRows(ctx: CsvBuildContext): string[] {
  const { envelope, courses } = ctx;
  const active = envelope.versions.find((v) => v.id === envelope.activeVersionId);
  if (!active) return [];
  const subs = active.plan.substitutions ?? {};
  const entries = Object.entries(subs);
  const rows: string[] = [];
  rows.push(csvRow(['# החלפות קדם (גרסה פעילה)']));
  rows.push(csvRow(['מ-מס\' קורס', 'מ-שם', 'אל-מס\' קורס', 'אל-שם']));
  if (entries.length === 0) {
    rows.push(csvRow(['—', '', '', '']));
    return rows;
  }
  for (const [fromId, toId] of entries) {
    rows.push(csvRow([
      fromId,
      courses.get(fromId)?.name ?? '',
      toId,
      courses.get(toId)?.name ?? '',
    ]));
  }
  return rows;
}

export function envelopeToCsv(
  envelope: VersionedPlanEnvelope,
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null,
  catalog: TrackSpecializationCatalog | null,
  options: { includeGrades: boolean },
): string {
  const ctx: CsvBuildContext = {
    envelope,
    courses,
    trackDef,
    catalog,
    includeGrades: options.includeGrades,
  };
  const sections: string[][] = [
    buildMetadataRows(ctx),
    buildSemesterRows(ctx),
    buildRequirementsRows(ctx),
    buildSpecializationRows(ctx),
    buildSubstitutionRows(ctx),
  ];
  const body = sections
    .filter((rows) => rows.length > 0)
    .map((rows) => rows.join('\r\n'))
    .join('\r\n\r\n');
  return `\uFEFF${body}\r\n`;
}

export function buildExportFilename(
  trackId: TrackId | null,
  kind: 'json' | 'csv',
  date: Date = new Date(),
): string {
  const iso = date.toISOString().slice(0, 10);
  const slug = trackId ?? 'plan';
  return `ee-planner_${slug}_${iso}.${kind}`;
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
