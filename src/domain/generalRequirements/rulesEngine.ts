import { matchCourse } from './matchers';
import type {
  CourseRef,
  GeneralRequirementRule,
  GeneralRequirementProgress,
  CountedCourse,
  RequirementStatus,
} from './types';

export function calculateRequirement(
  courses: CourseRef[],
  rule: GeneralRequirementRule
): GeneralRequirementProgress {
  const countedCourses: CountedCourse[] = [];
  let total = 0;

  for (const course of courses) {
    if (matchCourse(course, rule.courseMatcher)) {
      const value = rule.valueGetter?.(course) ?? (rule.targetUnit === 'credits' ? course.credits : 1);
      total += value;
      countedCourses.push({
        courseId: course.courseId,
        name: course.name,
        countedValue: value,
        reason: 'Matched rule',
      });
    }
  }

  let status: RequirementStatus;
  if (total >= rule.targetValue) status = 'completed';
  else if (total > 0) status = 'partial';
  else status = 'missing';

  return {
    requirementId: rule.id,
    type: rule.type,
    title: rule.title,
    completedValue: total,
    targetValue: rule.targetValue,
    targetUnit: rule.targetUnit,
    status,
    countedCourses,
    missingValue: Math.max(0, rule.targetValue - total),
  };
}

export function calculateGeneralRequirements(
  studentCourses: CourseRef[],
  rules: GeneralRequirementRule[]
): GeneralRequirementProgress[] {
  return rules.map((rule) => calculateRequirement(studentCourses, rule));
}
