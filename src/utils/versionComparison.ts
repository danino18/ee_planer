import type { PlanVersion, StudentPlan } from '../types';

type VersionWithPlan = Pick<PlanVersion, 'plan'>;

const SEMESTER_LABELS = [
  "א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'", "ח'",
  "ט'", "י'", 'י"א', 'י"ב', 'י"ג', 'י"ד', 'ט"ו', 'ט"ז',
];

function getScheduledCourseIds(plan: Pick<StudentPlan, 'semesters'>): Set<string> {
  const courseIds = new Set<string>();

  for (const semesterCourseIds of Object.values(plan.semesters ?? {})) {
    for (const courseId of semesterCourseIds ?? []) {
      courseIds.add(courseId);
    }
  }

  return courseIds;
}

export function getDifferingCourseIds(versions: VersionWithPlan[]): Set<string> {
  if (versions.length <= 1) return new Set();

  const coursePresenceCounts = new Map<string, number>();

  for (const version of versions) {
    const versionCourseIds = getScheduledCourseIds(version.plan);
    for (const courseId of versionCourseIds) {
      coursePresenceCounts.set(courseId, (coursePresenceCounts.get(courseId) ?? 0) + 1);
    }
  }

  const differingCourseIds = new Set<string>();
  for (const [courseId, presenceCount] of coursePresenceCounts) {
    if (presenceCount < versions.length) {
      differingCourseIds.add(courseId);
    }
  }

  return differingCourseIds;
}

function formatSemesterIndex(index: number): string {
  return SEMESTER_LABELS[index - 1] ?? String(index);
}

export function getComparisonSemesterLabel(
  semester: number,
  semesterOrder: number[],
  summerSemesters: number[],
): string {
  if (summerSemesters.includes(semester)) {
    const summerIndex = summerSemesters.indexOf(semester) + 1;
    return `קיץ ${formatSemesterIndex(summerIndex)}`;
  }

  const summerSet = new Set(summerSemesters);
  let regularIndex = 0;
  for (const orderedSemester of semesterOrder) {
    if (!summerSet.has(orderedSemester)) {
      regularIndex++;
    }

    if (orderedSemester === semester) {
      return `סמ' ${formatSemesterIndex(regularIndex)}`;
    }
  }

  const summersBefore = summerSemesters.filter((summerSemester) => summerSemester <= semester).length;
  return `סמ' ${formatSemesterIndex(Math.max(1, semester - summersBefore))}`;
}
