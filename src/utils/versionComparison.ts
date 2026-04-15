import type { PlanVersion, StudentPlan } from '../types';

type VersionWithPlan = Pick<PlanVersion, 'plan'>;

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
