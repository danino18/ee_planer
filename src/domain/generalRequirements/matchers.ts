import type { CourseRef, GeneralRequirementRule } from './types';

export function matchCourse(
  course: CourseRef,
  matcher: GeneralRequirementRule['courseMatcher']
): boolean {
  if (matcher.ids?.includes(course.courseId)) return true;

  if (matcher.tags && course.tags) {
    if (matcher.tags.some((t) => course.tags!.includes(t))) return true;
  }

  if (matcher.predicate) {
    return matcher.predicate(course);
  }

  return false;
}
