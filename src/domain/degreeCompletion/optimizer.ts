import type {
  SapCourse,
  SpecializationGroup,
  TrackDefinition,
  TrackSpecializationCatalog,
  SpecializationMode,
} from '../../types';
import { evaluateSpecializationGroup } from '../specializations';
import { getAllScheduledCourseIds } from '../../data/tracks/semesterSchedule';

export interface OptimizerInput {
  completedCourses: string[];
  semesters: Record<number, string[]>;
  selectedSpecializations: string[];
  courseChainAssignments?: Record<string, string>;
  doubleSpecializations: string[];
}

export interface SchedulingContext {
  semesterOrder: number[];
  summerSemesters: number[];
  semesterTypeOverrides: Record<number, 'winter' | 'spring'>;
  semesters: Record<number, string[]>;
  targetGraduationSemesterId: number | null;
  loadProfile: 'working' | 'fulltime';
  semesterLabels: Map<number, string>;
}

export interface ChainAssignmentSuggestion {
  courseId: string;
  courseName: string;
  candidateGroupIds: string[];
  suggestedGroupId: string;
  suggestedGroupName: string;
  reason: string;
}

export interface CourseRecommendation {
  courseId: string;
  courseName: string;
  credits: number;
  requirementId: string;
  requirementTitle: string;
  priority: 'mandatory' | 'choice' | 'elective';
  suggestedSemesterId: number | null;
  suggestedSemesterLabel: string | null;
  semesterLoadWarning: boolean;
}

const PROJECT_A_ID = '00440167';
const PROJECT_B_ID = '00440169';

function buildAllPlaced(input: OptimizerInput): Set<string> {
  return new Set([
    ...input.completedCourses,
    ...Object.values(input.semesters).flat(),
  ]);
}

function getMode(group: SpecializationGroup, doubleSpecializations: string[]): SpecializationMode {
  return group.canBeDouble && doubleSpecializations.includes(group.id) ? 'double' : 'single';
}

export function suggestChainAssignments(
  input: OptimizerInput,
  courses: Map<string, SapCourse>,
  catalog: TrackSpecializationCatalog,
): ChainAssignmentSuggestion[] {
  const allPlaced = buildAllPlaced(input);
  const selectedGroups = catalog.groups.filter(
    (g) => input.selectedSpecializations.includes(g.id),
  );

  if (selectedGroups.length < 2) return [];

  // courseId → selected group IDs it belongs to (only placed courses)
  const courseToGroups = new Map<string, string[]>();
  for (const group of selectedGroups) {
    for (const course of group.courses) {
      if (!allPlaced.has(course.courseNumber)) continue;
      if (!courseToGroups.has(course.courseNumber)) courseToGroups.set(course.courseNumber, []);
      courseToGroups.get(course.courseNumber)!.push(group.id);
    }
  }

  const suggestions: ChainAssignmentSuggestion[] = [];

  for (const [courseId, groupIds] of courseToGroups) {
    if (groupIds.length < 2) continue;
    if (input.courseChainAssignments?.[courseId]) continue;

    let bestGroupId: string | null = null;
    let bestMarginalGain = -1;
    let bestEvalDone = 0;
    let bestEvalRequired = 1;

    // Remove course from placed set to evaluate "without" it
    const allPlacedWithout = new Set([...allPlaced].filter((id) => id !== courseId));

    for (const gid of groupIds) {
      const group = selectedGroups.find((g) => g.id === gid);
      if (!group) continue;
      const mode = getMode(group, input.doubleSpecializations);

      const evWith = evaluateSpecializationGroup(
        group,
        allPlaced,
        mode,
        { ...(input.courseChainAssignments ?? {}), [courseId]: gid },
      );
      const evWithout = evaluateSpecializationGroup(
        group,
        allPlacedWithout,
        mode,
        input.courseChainAssignments,
      );

      const marginal = evWith.doneCount - evWithout.doneCount;

      if (marginal > bestMarginalGain) {
        bestMarginalGain = marginal;
        bestGroupId = gid;
        bestEvalDone = evWith.doneCount;
        bestEvalRequired = evWith.requiredCount;
      }
    }

    if (bestGroupId === null || bestMarginalGain <= 0) continue;

    const bestGroup = selectedGroups.find((g) => g.id === bestGroupId)!;
    const courseName = courses.get(courseId)?.name ?? courseId;

    suggestions.push({
      courseId,
      courseName,
      candidateGroupIds: groupIds,
      suggestedGroupId: bestGroupId,
      suggestedGroupName: bestGroup.title,
      reason: `${bestGroup.title}: ${bestEvalDone}/${bestEvalRequired} — הכי קרובה לסגירה`,
    });
  }

  return suggestions;
}

function getSemesterType(
  semId: number,
  context: SchedulingContext,
): 'winter' | 'spring' | 'summer' {
  if (context.summerSemesters.includes(semId)) return 'summer';
  if (context.semesterTypeOverrides[semId]) return context.semesterTypeOverrides[semId];
  const summerSet = new Set(context.summerSemesters);
  let regularIdx = 0;
  for (const s of context.semesterOrder) {
    if (s === semId) return regularIdx % 2 === 0 ? 'winter' : 'spring';
    if (!summerSet.has(s)) regularIdx++;
  }
  return 'winter';
}

function getSemesterCredits(
  semId: number,
  semesters: Record<number, string[]>,
  courses: Map<string, SapCourse>,
): number {
  return (semesters[semId] ?? []).reduce((sum, id) => sum + (courses.get(id)?.credits ?? 0), 0);
}

function buildCoursesBeforeSemester(
  context: SchedulingContext,
  completedCourses: string[],
): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();
  for (let i = 0; i < context.semesterOrder.length; i++) {
    const semId = context.semesterOrder[i];
    const available = new Set<string>(completedCourses);
    for (let j = 0; j < i; j++) {
      for (const id of context.semesters[context.semesterOrder[j]] ?? []) {
        available.add(id);
      }
    }
    map.set(semId, available);
  }
  return map;
}

function findBestSemester(
  courseId: string,
  course: SapCourse | undefined,
  context: SchedulingContext,
  courses: Map<string, SapCourse>,
  coursesBeforeSemester: Map<number, Set<string>>,
): { semId: number | null; label: string | null; warning: boolean } {
  const { semesterOrder, targetGraduationSemesterId, loadProfile, semesterLabels } = context;

  const gradIdx = targetGraduationSemesterId !== null
    ? semesterOrder.indexOf(targetGraduationSemesterId)
    : semesterOrder.length - 1;
  const maxIdx = gradIdx >= 0 ? gradIdx : semesterOrder.length - 1;

  let targetPosition: number | null = null;
  if (courseId === PROJECT_A_ID && gradIdx >= 2) targetPosition = gradIdx - 2;
  if (courseId === PROJECT_B_ID && gradIdx >= 1) targetPosition = gradIdx - 1;

  const softCreditLimit = loadProfile === 'working' ? 20 : 23;
  const softCourseLimit = loadProfile === 'working' ? 6 : 8;

  type Candidate = { semId: number; score: number; warning: boolean };
  const candidates: Candidate[] = [];

  for (let idx = 0; idx <= maxIdx; idx++) {
    const semId = semesterOrder[idx];

    // Season check (skip for summer semesters)
    if (!context.summerSemesters.includes(semId) && course?.teachingSemester) {
      const semType = getSemesterType(semId, context);
      if (semType !== 'summer' && semType !== course.teachingSemester) continue;
    }

    // Prerequisite check
    const prereqs = course?.prerequisites;
    if (prereqs && prereqs.length > 0) {
      const takenBefore = coursesBeforeSemester.get(semId) ?? new Set<string>();
      const satisfied = prereqs.some(
        (andGroup) => andGroup.length === 0 || andGroup.every((pid) => takenBefore.has(pid)),
      );
      if (!satisfied) continue;
    }

    const semCredits = getSemesterCredits(semId, context.semesters, courses);
    const semCourseCount = (context.semesters[semId] ?? []).length;
    let score = maxIdx - idx; // prefer spreading — earlier = higher base

    if (targetPosition !== null) {
      score += idx === targetPosition ? 100 : -Math.abs(idx - targetPosition) * 10;
    }

    let warning = false;
    if (idx >= 4 && !context.summerSemesters.includes(semId)) {
      const newCredits = semCredits + (course?.credits ?? 0);
      if (newCredits > softCreditLimit) {
        score -= (newCredits - softCreditLimit) * 2;
        warning = true;
      }
      if (semCourseCount >= softCourseLimit) {
        score -= (semCourseCount - softCourseLimit + 1) * 3;
        warning = true;
      }
    }

    candidates.push({ semId, score, warning });
  }

  if (candidates.length === 0) return { semId: null, label: null, warning: false };

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return { semId: best.semId, label: semesterLabels.get(best.semId) ?? null, warning: best.warning };
}

export function suggestMissingCourses(
  input: OptimizerInput,
  courses: Map<string, SapCourse>,
  catalog: TrackSpecializationCatalog,
  context: SchedulingContext,
): CourseRecommendation[] {
  const allPlaced = buildAllPlaced(input);
  const selectedGroups = catalog.groups.filter(
    (g) => input.selectedSpecializations.includes(g.id),
  );

  if (selectedGroups.length === 0) return [];

  const coursesBeforeSemester = buildCoursesBeforeSemester(context, input.completedCourses);
  const recommendations: CourseRecommendation[] = [];
  const addedCourseIds = new Set<string>();

  for (const group of selectedGroups) {
    const mode = getMode(group, input.doubleSpecializations);
    const evaluation = evaluateSpecializationGroup(group, allPlaced, mode, input.courseChainAssignments);

    if (evaluation.complete) continue;

    let groupRecommendations = 0;
    for (const block of evaluation.ruleBlocks) {
      if (block.isSatisfied) continue;

      let priority: 'mandatory' | 'choice' | 'elective';
      switch (block.kind) {
        case 'mandatory_courses': priority = 'mandatory'; break;
        case 'mandatory_choice': priority = 'choice'; break;
        default: priority = 'elective';
      }

      const needed = block.requiredCount - block.satisfiedCount;
      let added = 0;

      for (const option of block.options) {
        if (added >= needed || groupRecommendations >= 5) break;
        const courseId = option.courseNumber;
        if (allPlaced.has(courseId) || addedCourseIds.has(courseId)) continue;

        const courseData = courses.get(courseId);
        const sem = findBestSemester(courseId, courseData, context, courses, coursesBeforeSemester);

        recommendations.push({
          courseId,
          courseName: courseData?.name ?? option.courseName,
          credits: courseData?.credits ?? 0,
          requirementId: `chain:${group.id}`,
          requirementTitle: group.title,
          priority,
          suggestedSemesterId: sem.semId,
          suggestedSemesterLabel: sem.label,
          semesterLoadWarning: sem.warning,
        });
        addedCourseIds.add(courseId);
        added++;
        groupRecommendations++;
      }
    }
  }

  const priorityOrder: Record<string, number> = { mandatory: 0, choice: 1, elective: 2 };
  recommendations.sort(
    (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2) || b.credits - a.credits,
  );

  return recommendations;
}

export function suggestTrackScheduleCourses(
  input: OptimizerInput,
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition,
  context: SchedulingContext,
): CourseRecommendation[] {
  const allPlaced = buildAllPlaced(input);
  const coursesBeforeSemester = buildCoursesBeforeSemester(context, input.completedCourses);
  const recommendations: CourseRecommendation[] = [];

  // Mandatory courses from semester schedule
  const scheduledIds = getAllScheduledCourseIds(trackDef);
  let mandatoryCount = 0;
  for (const courseId of scheduledIds) {
    if (mandatoryCount >= 10) break;
    if (allPlaced.has(courseId)) continue;
    const courseData = courses.get(courseId);
    if (!courseData) continue;
    const sem = findBestSemester(courseId, courseData, context, courses, coursesBeforeSemester);
    recommendations.push({
      courseId,
      courseName: courseData.name,
      credits: courseData.credits,
      requirementId: 'mandatory_schedule',
      requirementTitle: 'קורסי חובה',
      priority: 'mandatory',
      suggestedSemesterId: sem.semId,
      suggestedSemesterLabel: sem.label,
      semesterLoadWarning: sem.warning,
    });
    mandatoryCount++;
  }

  // Lab pool courses (if track has one)
  if (trackDef.labPool && trackDef.labPool.required > 0) {
    let labCount = 0;
    for (const courseId of trackDef.labPool.courses) {
      if (labCount >= 5) break;
      if (allPlaced.has(courseId)) continue;
      const courseData = courses.get(courseId);
      if (!courseData) continue;
      const sem = findBestSemester(courseId, courseData, context, courses, coursesBeforeSemester);
      recommendations.push({
        courseId,
        courseName: courseData.name,
        credits: courseData.credits,
        requirementId: 'lab_pool',
        requirementTitle: 'מעבדות',
        priority: 'choice',
        suggestedSemesterId: sem.semId,
        suggestedSemesterLabel: sem.label,
        semesterLoadWarning: sem.warning,
      });
      labCount++;
    }
  }

  return recommendations;
}
