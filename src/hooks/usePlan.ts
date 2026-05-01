import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore';
import type {
  SapCourse,
  TrackDefinition,
  SpecializationGroup,
  TrackSpecializationCatalog,
  ElectiveCreditArea,
} from '../types';
import type { RequirementsInput } from '../domain/degreeCompletion/types';
export type { RequirementsInput };
import type { GeneralRequirementProgress } from '../domain/generalRequirements/types';
import { evaluateSpecializationGroup } from '../domain/specializations/engine';
import { buildGeneralRequirementsProgress } from './useGeneralRequirements';
import { computeRoboticsMinorProgress } from './useRoboticsMinor';
import type { RoboticsMinorProgress } from './useRoboticsMinor';
import { ROBOTICS_MINOR_EXTRA_CREDITS } from '../data/roboticsMinor';
import { computeEntrepreneurshipMinorProgress } from './useEntrepreneurshipMinor';
import type { EntrepreneurshipMinorProgress } from './useEntrepreneurshipMinor';
import { ENTREPRENEURSHIP_MINOR_EXTRA_CREDITS } from '../data/entrepreneurshipMinor';
import {
  isCourseTaughtInEnglish,
  isChoirOrOrchestraCourseId,
  isFreeElectiveCourseId,
  isSportCourseId,
  isSportsTeamCourseId,
  isTechnicalEnglishCourseName,
} from '../data/generalRequirements/courseClassification';
import {
  getSatisfiedAlternativeCourseId,
  getVisibleMandatoryCourseIds,
} from '../data/tracks/semesterSchedule';
import { computeWeightedAverage } from '../utils/courseGrades';
import {
  allocateElectiveCredits,
  ELECTIVE_AREA_LABELS,
  EXTERNAL_FACULTY_ELECTIVE_MAX_CREDITS,
  getElectiveCreditAssignmentOptions,
  resolveElectiveCreditArea,
} from '../domain/electives';
import { calculateSpecialEnrichmentAllocation } from '../domain/generalRequirements/specialAllocation';
import { buildChainEligibleCourseSet, buildCoreLockedSet } from '../domain/degreeCompletion/helpers';

const PREREQ_EQUIVALENCES: string[][] = [
  ['01040064', '01040065', '01040016'],
  ['01040012', '01040031', '01040041', '01040042', '01040018'],
  ['01140071', '01130013'],
  ['01140075', '01130014'],
];

function expandWithEquivalents(taken: Set<string>): Set<string> {
  const expanded = new Set(taken);
  for (const group of PREREQ_EQUIVALENCES) {
    if (group.some((id) => taken.has(id))) {
      for (const id of group) expanded.add(id);
    }
  }
  return expanded;
}

export interface RecommendedChain {
  group: SpecializationGroup;
  score: number;
  matchingCourses: string[];
}

function getRequirement(
  requirements: GeneralRequirementProgress[],
  requirementId: string
): GeneralRequirementProgress | undefined {
  return requirements.find((requirement) => requirement.requirementId === requirementId);
}

function getCountedTotalCredits(
  completedCourses: string[],
  semesters: Record<number, string[]>,
  courses: Map<string, SapCourse>,
): number {
  const seenRegularCourseIds = new Set<string>();
  let regularCredits = 0;
  let choirOrOrchestraCredits = 0;
  let sportsTeamCredits = 0;

  const visit = (id: string): void => {
    const credits = courses.get(id)?.credits ?? 0;
    if (isChoirOrOrchestraCourseId(id)) {
      choirOrOrchestraCredits += credits;
      return;
    }
    if (isSportsTeamCourseId(id)) {
      sportsTeamCredits += credits;
      return;
    }
    if (seenRegularCourseIds.has(id)) return;
    seenRegularCourseIds.add(id);
    regularCredits += credits;
  };

  for (const id of completedCourses) {
    if (isChoirOrOrchestraCourseId(id) || isSportsTeamCourseId(id)) continue;
    visit(id);
  }
  for (const ids of Object.values(semesters)) {
    for (const id of ids) {
      visit(id);
    }
  }

  const allocation = calculateSpecialEnrichmentAllocation({
    choirOrOrchestraCredits,
    sportsTeamCredits,
  });
  return regularCredits + allocation.recognizedSpecialCredits;
}

function iteratePlacedCourseIds(
  completedCourses: string[],
  semesters: Record<number, string[]>,
  semesterOrder: number[],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const visit = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    ordered.push(id);
  };

  for (const id of completedCourses) visit(id);
  for (const semester of semesterOrder) {
    for (const id of semesters[semester] ?? []) visit(id);
  }
  for (const [semesterKey, ids] of Object.entries(semesters)) {
    if (semesterOrder.includes(Number(semesterKey))) continue;
    for (const id of ids) visit(id);
  }

  return ordered;
}

function buildSpecializationCourseIds(catalog: TrackSpecializationCatalog): Set<string> {
  const result = new Set<string>();
  for (const group of catalog.groups) {
    for (const course of group.courses) {
      result.add(course.courseNumber);
    }
  }
  return result;
}

export function usePrerequisiteStatus(
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null
): Map<string, string[][]> {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const substitutions = usePlanStore((s) => s.substitutions);
  const selectedPrereqGroups = usePlanStore((s) => s.selectedPrereqGroups);
  const currentSemester = usePlanStore((s) => s.currentSemester);
  const semesterOrder = usePlanStore((s) => s.semesterOrder);

  return useMemo(() => {
    const missingMap = new Map<string, string[][]>();
    if (!trackDef) return missingMap;

    const baseTaken = new Set<string>(completedCourses);
    if (currentSemester !== null) {
      const currentIdx = semesterOrder.indexOf(currentSemester);
      for (let i = 0; i < currentIdx; i++) {
        for (const id of semesters[semesterOrder[i]] ?? []) baseTaken.add(id);
      }
    }

    for (const [semStr, courseIds] of Object.entries(semesters)) {
      const sem = Number(semStr);
      const alreadyTaken = new Set<string>(baseTaken);

      if (sem === 0) {
        for (const [k, ids] of Object.entries(semesters)) {
          if (Number(k) !== 0) {
            for (const id of ids) alreadyTaken.add(id);
          }
        }
      } else {
        const semIdx = semesterOrder.indexOf(sem);
        for (let i = 0; i < semIdx; i++) {
          for (const id of semesters[semesterOrder[i]] ?? []) {
            alreadyTaken.add(id);
          }
        }
      }

      for (const [from, to] of Object.entries(substitutions)) {
        if (alreadyTaken.has(from)) alreadyTaken.add(to);
      }

      const expanded = expandWithEquivalents(alreadyTaken);
      for (const id of expanded) alreadyTaken.add(id);

      for (const courseId of courseIds) {
        const course = courses.get(courseId);
        if (!course || course.prerequisites.length === 0) {
          missingMap.set(courseId, []);
          continue;
        }

        const selectedGroup = selectedPrereqGroups[courseId];
        if (selectedGroup !== undefined) {
          const satisfied = selectedGroup.every((prereqId) => alreadyTaken.has(prereqId));
          missingMap.set(courseId, satisfied ? [] : [selectedGroup]);
          continue;
        }

        const isSatisfied = course.prerequisites.some(
          (orGroup) => orGroup.every((prereqId) => alreadyTaken.has(prereqId))
        );

        if (isSatisfied) {
          missingMap.set(courseId, []);
        } else {
          const unsatisfied = course.prerequisites.filter(
            (orGroup) => !orGroup.every((prereqId) => alreadyTaken.has(prereqId))
          );
          missingMap.set(courseId, unsatisfied);
        }
      }
    }

    return missingMap;
  }, [semesters, completedCourses, substitutions, selectedPrereqGroups, courses, trackDef, currentSemester, semesterOrder]);
}

export function useWeightedAverage(courses: Map<string, SapCourse>): number | null {
  const semesters = usePlanStore((s) => s.semesters);
  const grades = usePlanStore((s) => s.grades);
  const binaryPass = usePlanStore((s) => s.binaryPass);

  return useMemo(
    () => computeWeightedAverage({ semesters, grades, binaryPass }, courses),
    [semesters, grades, binaryPass, courses],
  );
}

export type EnglishRequirementItem = {
  kind: 'advanced_a' | 'advanced_b' | 'content_course';
  label: string;
  done: boolean;
  courseNames: string[];
  neededCount?: number;
};

export interface CoreSlot {
  ids: string[];        // 1 ID normally; 2 IDs for OR pair
  names: string[];      // corresponding course names
  done: boolean;        // locked in core AND placed
  released: boolean;    // placed but released to chain by user
  activeId?: string;    // which specific ID is placed (for OR pairs)
  availableIds: string[]; // courses in the slot that are not yet placed/completed
}

export interface ElectiveAreaProgress {
  area: Exclude<ElectiveCreditArea, 'general'>;
  label: string;
  earned: number;
  required: number;
  courseIds: string[];
  requiredAnyOfCourseIds?: string[];
  requiredAnyOfCourseNames?: string[];
  requiredAnyOfDone?: boolean;
}

export interface ElectiveAssignmentChoice {
  courseId: string;
  courseName: string;
  selectedArea: ElectiveCreditArea;
  options: ElectiveCreditArea[];
}


export function computeRequirementsProgress(
  input: RequirementsInput,
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null,
  specializationCatalog: TrackSpecializationCatalog,
  weightedAverage: number | null,
) {
  const {
    semesters,
    completedCourses,
    selectedSpecializations,
    doubleSpecializations,
    hasEnglishExemption,
    miluimCredits,
    englishScore,
    englishTaughtCourses,
    semesterOrder,
    coreToChainOverrides,
    courseChainAssignments,
    electiveCreditAssignments,
    roboticsMinorEnabled,
    entrepreneurshipMinorEnabled,
  } = input;

  if (!trackDef) return null;

    const allPlaced = new Set<string>([
      ...completedCourses,
      ...Object.values(semesters).flat(),
    ]);

    // Core-locked courses count toward core only. Released core courses are
    // removed from this set by buildCoreLockedSet and may count toward chains.
    const coreLockedSet = buildCoreLockedSet(input, trackDef);
    const chainEligibleCourseIds = buildChainEligibleCourseSet(input, trackDef);
    const orderedLabPool: string[] = [];
    if (trackDef.labPool) {
      const labSet = new Set(trackDef.labPool.courses);
      const max = trackDef.labPool.max ?? trackDef.labPool.courses.length;
      const seen = new Set<string>();

      for (const id of completedCourses) {
        if (labSet.has(id) && !seen.has(id)) {
          orderedLabPool.push(id);
          seen.add(id);
        }
      }

      for (const sem of semesterOrder) {
        for (const id of semesters[sem] ?? []) {
          if (labSet.has(id) && !seen.has(id)) {
            orderedLabPool.push(id);
            seen.add(id);
          }
        }
        if (orderedLabPool.length >= max) break;
      }

      if (orderedLabPool.length > max) orderedLabPool.splice(max);
    }

    const mandatoryLabIdSet = new Set<string>();
    const excessLabIdSet = new Set<string>();
    if (trackDef.labPool) {
      const required = trackDef.labPool.required;
      if (trackDef.labPool.mandatory) {
        for (let i = 0; i < Math.min(required, orderedLabPool.length); i++) {
          mandatoryLabIdSet.add(orderedLabPool[i]);
        }
      }

      const labSet = new Set(trackDef.labPool.courses);
      for (const id of allPlaced) {
        if (labSet.has(id) && !orderedLabPool.includes(id)) {
          excessLabIdSet.add(id);
        }
      }
    }

    const mandatoryIds = getVisibleMandatoryCourseIds(trackDef, courses, englishScore);
    let mandatoryDone = 0;
    for (const semesterEntry of trackDef.semesterSchedule) {
      for (const id of semesterEntry.courses) {
        if (mandatoryIds.has(id) && allPlaced.has(id)) {
          mandatoryDone += courses.get(id)?.credits ?? 0;
        }
      }

      for (const group of semesterEntry.alternativeGroups ?? []) {
        const satisfiedCourseId = getSatisfiedAlternativeCourseId(group, allPlaced, courses, englishScore);
        if (satisfiedCourseId) {
          mandatoryDone += courses.get(satisfiedCourseId)?.credits ?? 0;
        }
      }
    }
    for (const id of mandatoryLabIdSet) {
      mandatoryDone += courses.get(id)?.credits ?? 0;
    }

    let electiveCredits = 0;
    const counted = new Set<string>();
    const generalElectiveCourseIds = new Set<string>();
    const generalElectiveCredits = new Map<string, number>();
    const externalFacultyElectiveCourseIds = new Set<string>();
    const specializationCourseIds = buildSpecializationCourseIds(specializationCatalog);
    let externalFacultyElectiveCredits = 0;
    const electiveAreaCredits = new Map<Exclude<ElectiveCreditArea, 'general'>, number>();
    const electiveAreaCourseIds = new Map<Exclude<ElectiveCreditArea, 'general'>, Set<string>>();
    const electiveAssignmentChoices: ElectiveAssignmentChoice[] = [];

    const addAreaCredit = (area: Exclude<ElectiveCreditArea, 'general'>, id: string, credits: number) => {
      electiveAreaCredits.set(area, (electiveAreaCredits.get(area) ?? 0) + credits);
      const ids = electiveAreaCourseIds.get(area) ?? new Set<string>();
      ids.add(id);
      electiveAreaCourseIds.set(area, ids);
    };

    const addGeneralCredit = (id: string, credits: number) => {
      if (credits <= 0) return;
      generalElectiveCourseIds.add(id);
      generalElectiveCredits.set(id, (generalElectiveCredits.get(id) ?? 0) + credits);
    };

    for (const id of iteratePlacedCourseIds(completedCourses, semesters, semesterOrder)) {
      if (
        !mandatoryIds.has(id) &&
        !mandatoryLabIdSet.has(id) &&
        !excessLabIdSet.has(id) &&
        !counted.has(id) &&
        !isSportCourseId(id) &&
        !isFreeElectiveCourseId(id)
      ) {
        const course = courses.get(id);
        if (!course) continue;

        const selectedArea = resolveElectiveCreditArea(course, trackDef, electiveCreditAssignments);
        const options = getElectiveCreditAssignmentOptions(course, trackDef);
        if (options.length > 1) {
          electiveAssignmentChoices.push({
            courseId: id,
            courseName: course.name,
            selectedArea,
            options,
          });
        }

        const split = allocateElectiveCredits(
          course,
          selectedArea,
          specializationCourseIds.has(id),
          EXTERNAL_FACULTY_ELECTIVE_MAX_CREDITS - externalFacultyElectiveCredits,
        );
        electiveCredits += split.facultyCredits;
        addGeneralCredit(id, split.generalCredits);

        if (split.externalFacultyCredits > 0) {
          externalFacultyElectiveCredits += split.externalFacultyCredits;
          externalFacultyElectiveCourseIds.add(id);
        }

        for (const [area, credits] of Object.entries(split.areaCredits ?? {}) as [Exclude<ElectiveCreditArea, 'general'>, number][]) {
          addAreaCredit(area, id, credits);
        }
        counted.add(id);
      }
    }

    const electiveAreaRequirements: ElectiveAreaProgress[] = (trackDef.electivePolicy?.areaRequirements ?? [])
      .map((requirement) => {
        const courseIds = [...(electiveAreaCourseIds.get(requirement.area) ?? new Set<string>())];
        const requiredAnyOfDone = requirement.requiredAnyOfCourseIds
          ? requirement.requiredAnyOfCourseIds.some((courseId) => courseIds.includes(courseId))
          : undefined;

        return {
          area: requirement.area,
          label: ELECTIVE_AREA_LABELS[requirement.area],
          earned: electiveAreaCredits.get(requirement.area) ?? 0,
          required: requirement.minCredits,
          courseIds,
          requiredAnyOfCourseIds: requirement.requiredAnyOfCourseIds,
          requiredAnyOfCourseNames: requirement.requiredAnyOfCourseIds?.map((courseId) =>
            courses.get(courseId)?.name ?? courseId
          ),
          requiredAnyOfDone,
        };
      });
    const electiveAreaRequirementsSatisfied = electiveAreaRequirements.every((requirement) =>
      requirement.earned >= requirement.required &&
      requirement.requiredAnyOfDone !== false
    );

    const selectedGroups = specializationCatalog.groups.filter((group) =>
      selectedSpecializations.includes(group.id)
    );
    const groupEvaluations = selectedGroups.map((group) => {
      const mode = group.canBeDouble && doubleSpecializations.includes(group.id)
        ? 'double'
        : 'single';
      const evaluation = evaluateSpecializationGroup(group, chainEligibleCourseIds, mode, courseChainAssignments);
      return {
        group,
        mode,
        evaluation,
      };
    });

    const completedCount = specializationCatalog.interactionDisabled
      ? 0
      : groupEvaluations.reduce(
        (sum, result) => sum + (result.evaluation.complete ? (result.mode === 'double' ? 2 : 1) : 0),
        0,
      );

    const totalCredits = getCountedTotalCredits(
      completedCourses,
      semesters,
      courses,
    );

    const roboticsMinorProgress: RoboticsMinorProgress | null = roboticsMinorEnabled
      ? computeRoboticsMinorProgress(allPlaced, courses, weightedAverage, totalCredits)
      : null;

    const entrepreneurshipMinorProgress: EntrepreneurshipMinorProgress | null = entrepreneurshipMinorEnabled
      ? computeEntrepreneurshipMinorProgress(allPlaced, courses, weightedAverage, totalCredits)
      : null;

    const groupDetails = groupEvaluations.map(({ group, mode, evaluation }) => {
      const ruleRequired = evaluation.ruleBlocks.reduce((sum, block) => sum + block.requiredCount, 0);
      const ruleDone = evaluation.ruleBlocks.reduce(
        (sum, block) => sum + Math.min(block.satisfiedCount, block.requiredCount),
        0,
      );

      return {
        id: group.id,
        name: group.name,
        done: ruleDone,
        min: ruleRequired,
        isDouble: mode === 'double',
        complete: evaluation.complete,
        summaries: evaluation.ruleBlocks.map((block) => ({
          id: block.id,
          label: block.title,
          done: block.satisfiedCount,
          required: block.requiredCount,
        })),
        issues: evaluation.issues,
      };
    });

    const { progress: generalRequirements, generalElectivesBreakdown } = buildGeneralRequirementsProgress({
      courses,
      trackDef,
      semesters,
      completedCourses,
      miluimCredits,
      englishTaughtCourses,
      englishScore,
      generalElectiveCourseIds,
      generalElectiveCredits,
    });
    const generalElectivesRequirement = getRequirement(generalRequirements, 'general_electives');
    const englishRequirement = getRequirement(generalRequirements, 'english');
    const labsRequirement = getRequirement(generalRequirements, 'labs');

    const englishPlaced: { id: string; name: string }[] = [];
    const seenEnglishPlaced = new Set<string>();
    for (const id of allPlaced) {
      if (seenEnglishPlaced.has(id)) continue;
      const course = courses.get(id);
      if (!course) continue;

      if (
        course.name.includes('אנגלית') ||
        (isCourseTaughtInEnglish(course, englishTaughtCourses) && course.name.includes('מתקדמים'))
      ) {
        englishPlaced.push({ id, name: course.name });
        seenEnglishPlaced.add(id);
      }
    }

    const englishInPlan = englishRequirement?.countedCourses.map((course) => course.courseId) ?? [];
    const englishContentCourseNamesInPlan = englishRequirement?.countedCourses
      .filter((course) => !isTechnicalEnglishCourseName(course.name))
      .map((course) => course.name) ?? [];
    let englishRequirements: EnglishRequirementItem[] = [];
    if (englishScore !== undefined) {
      const advancedAName = englishPlaced.find((course) =>
        course.name.includes("מתקדמים א'") || course.name.includes('מתקדמים א')
      )?.name;
      const advancedBName = englishPlaced.find((course) =>
        course.name.includes("מתקדמים ב'") || course.name.includes('מתקדמים ב')
      )?.name;

      if (englishScore >= 104 && englishScore <= 119) {
        englishRequirements = [
          { kind: 'advanced_a', label: "מתקדמים א'", done: !!advancedAName, courseNames: advancedAName ? [advancedAName] : [] },
          { kind: 'advanced_b', label: "מתקדמים ב'", done: !!advancedBName, courseNames: advancedBName ? [advancedBName] : [] },
        ];
      } else if (englishScore >= 120 && englishScore <= 133) {
        englishRequirements = [
          { kind: 'advanced_b', label: "מתקדמים ב'", done: !!advancedBName, courseNames: advancedBName ? [advancedBName] : [] },
          { kind: 'content_course', label: 'קורס תוכן באנגלית', done: englishContentCourseNamesInPlan.length >= 1, courseNames: englishContentCourseNamesInPlan.slice(0, 1), neededCount: 1 },
        ];
      } else if (englishScore >= 134 && englishScore <= 150) {
        englishRequirements = [
          { kind: 'content_course', label: 'קורסי תוכן באנגלית', done: englishContentCourseNamesInPlan.length >= 2, courseNames: englishContentCourseNamesInPlan.slice(0, 2), neededCount: 2 },
        ];
      }
    }

    const generalRequired = Math.max(0, trackDef.generalCreditsRequired - miluimCredits);

    let coreProgress: {
      completed: number;
      required: number;
      total: number;
      slots: CoreSlot[];
      canRelease: string[];
    } | null = null;
    if (trackDef.coreRequirement) {
      const { courses: coreCourseIds, required: coreRequired, orGroups = [] } = trackDef.coreRequirement;
      const orGroupedIds = new Set(orGroups.flat());

      // Count completed slots (OR-group aware) using the locked set
      let slotsDone = 0;
      const processedGroupsCount = new Set<number>();
      for (const id of coreLockedSet) {
        if (orGroupedIds.has(id)) {
          const gi = orGroups.findIndex((g) => g.includes(id));
          if (!processedGroupsCount.has(gi)) {
            processedGroupsCount.add(gi);
            slotsDone++;
          }
        } else {
          slotsDone++;
        }
      }

      // Count total slots (OR-group aware)
      let totalSlots = 0;
      const processedGroupsTotal = new Set<number>();
      for (const id of coreCourseIds) {
        if (orGroupedIds.has(id)) {
          const gi = orGroups.findIndex((g) => g.includes(id));
          if (!processedGroupsTotal.has(gi)) {
            processedGroupsTotal.add(gi);
            totalSlots++;
          }
        } else {
          totalSlots++;
        }
      }

      // Build display slots (one row per slot, OR pairs merged)
      const processedGroupsDisplay = new Set<number>();
      const slots: CoreSlot[] = [];
      for (const id of coreCourseIds) {
        if (orGroupedIds.has(id)) {
          const gi = orGroups.findIndex((g) => g.includes(id));
          if (processedGroupsDisplay.has(gi)) continue;
          processedGroupsDisplay.add(gi);
          const group = orGroups[gi];
          const activeId = group.find((gid) => coreLockedSet.has(gid));
          const releasedId = group.find((gid) => coreToChainOverrides.includes(gid) && allPlaced.has(gid));
          slots.push({
            ids: group,
            names: group.map((gid) => courses.get(gid)?.name ?? gid),
            done: !!activeId,
            released: !activeId && !!releasedId,
            activeId,
            availableIds: group.filter((gid) => !allPlaced.has(gid)),
          });
        } else {
          const isLocked = coreLockedSet.has(id);
          const isReleased = coreToChainOverrides.includes(id) && allPlaced.has(id);
          slots.push({
            ids: [id],
            names: [courses.get(id)?.name ?? id],
            done: isLocked,
            released: isReleased,
            activeId: isLocked ? id : undefined,
            availableIds: allPlaced.has(id) ? [] : [id],
          });
        }
      }

      // canRelease: released courses (always shown for un-release) + locked overflow courses
      const releasedCoreIds = coreCourseIds.filter(
        (id) => coreToChainOverrides.includes(id) && allPlaced.has(id),
      );
      const lockedOverflow = slotsDone > coreRequired
        ? [...coreLockedSet].filter((id) => !orGroups.flat().some((oid) => oid !== id && coreLockedSet.has(oid) && orGroups.some((g) => g.includes(id) && g.includes(oid))))
        : [];
      const canRelease = [...new Set([...releasedCoreIds, ...lockedOverflow])];

      coreProgress = {
        completed: slotsDone,
        required: coreRequired,
        total: totalSlots,
        slots,
        canRelease,
      };
    }

    return {
      mandatory: { earned: mandatoryDone, required: trackDef.mandatoryCredits },
      elective: { earned: electiveCredits, required: trackDef.electiveCreditsRequired },
      electiveBreakdown: {
        areaRequirements: electiveAreaRequirements,
        assignmentChoices: electiveAssignmentChoices,
        generalCourseIds: [...generalElectiveCourseIds],
        generalCreditsByCourseId: Object.fromEntries(generalElectiveCredits),
        externalFaculty: {
          earned: externalFacultyElectiveCredits,
          limit: EXTERNAL_FACULTY_ELECTIVE_MAX_CREDITS,
          courseIds: [...externalFacultyElectiveCourseIds],
        },
      },
      total: { earned: totalCredits, required: trackDef.totalCreditsRequired + (roboticsMinorEnabled ? ROBOTICS_MINOR_EXTRA_CREDITS : 0) + (entrepreneurshipMinorEnabled ? ENTREPRENEURSHIP_MINOR_EXTRA_CREDITS : 0) },
      specializationGroups: {
        completed: specializationCatalog.interactionDisabled ? 0 : completedCount,
        required: trackDef.specializationGroupsRequired,
        total: selectedGroups.length,
        unavailable: specializationCatalog.interactionDisabled,
        diagnostics: specializationCatalog.diagnostics,
      },
      groupDetails,
      general: {
        earned: generalElectivesRequirement?.completedValue ?? 0,
        required: generalElectivesRequirement?.targetValue ?? generalRequired,
      },
      generalRequirements,
      generalElectivesBreakdown,
      labPoolProgress: trackDef.labPool && labsRequirement
        ? {
            earned: labsRequirement.completedValue,
            required: labsRequirement.targetValue,
            mandatory: trackDef.labPool.mandatory ?? false,
            max: trackDef.labPool.max,
          }
        : null,
      coreRequirementProgress: coreProgress,
      english: {
        placed: englishPlaced,
        hasExemption: hasEnglishExemption,
        score: englishScore,
        requirements: englishRequirements,
        taughtCourses: englishTaughtCourses,
        englishInPlan,
      },
      roboticsMinorProgress,
      entrepreneurshipMinorProgress,
      isReady:
        mandatoryDone >= trackDef.mandatoryCredits &&
        electiveCredits >= trackDef.electiveCreditsRequired &&
        electiveAreaRequirementsSatisfied &&
        (specializationCatalog.interactionDisabled
          ? false
          : completedCount >= trackDef.specializationGroupsRequired) &&
        totalCredits >= trackDef.totalCreditsRequired &&
        (!coreProgress || coreProgress.completed >= coreProgress.required),
    };
}

export function useRequirementsProgress(
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null,
  specializationCatalog: TrackSpecializationCatalog,
  weightedAverage: number | null,
) {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const completedInstances = usePlanStore((s) => s.completedInstances ?? []);
  const grades = usePlanStore((s) => s.grades);
  const binaryPass = usePlanStore((s) => s.binaryPass ?? {});
  const selectedSpecializations = usePlanStore((s) => s.selectedSpecializations);
  const doubleSpecializations = usePlanStore((s) => s.doubleSpecializations ?? []);
  const hasEnglishExemption = usePlanStore((s) => s.hasEnglishExemption ?? false);
  const miluimCredits = usePlanStore((s) => s.miluimCredits ?? 0);
  const englishScore = usePlanStore((s) => s.englishScore);
  const englishTaughtCourses = usePlanStore((s) => s.englishTaughtCourses ?? []);
  const semesterOrder = usePlanStore((s) => s.semesterOrder);
  const coreToChainOverrides = usePlanStore((s) => s.coreToChainOverrides ?? []);
  const courseChainAssignments = usePlanStore((s) => s.courseChainAssignments);
  const electiveCreditAssignments = usePlanStore((s) => s.electiveCreditAssignments);
  const roboticsMinorEnabled = usePlanStore((s) => s.roboticsMinorEnabled ?? false);
  const entrepreneurshipMinorEnabled = usePlanStore((s) => s.entrepreneurshipMinorEnabled ?? false);

  return useMemo(
    () =>
      computeRequirementsProgress(
        {
          semesters,
          completedCourses,
          completedInstances,
          grades,
          binaryPass,
          selectedSpecializations,
          doubleSpecializations,
          hasEnglishExemption,
          miluimCredits,
          englishScore,
          englishTaughtCourses,
          semesterOrder,
          coreToChainOverrides,
          courseChainAssignments,
          electiveCreditAssignments,
          roboticsMinorEnabled,
          entrepreneurshipMinorEnabled,
        },
        courses,
        trackDef,
        specializationCatalog,
        weightedAverage,
      ),
    [semesters, completedCourses, completedInstances, grades, binaryPass, courses, trackDef, specializationCatalog, selectedSpecializations, doubleSpecializations, hasEnglishExemption, miluimCredits, englishScore, englishTaughtCourses, semesterOrder, coreToChainOverrides, courseChainAssignments, electiveCreditAssignments, roboticsMinorEnabled, entrepreneurshipMinorEnabled, weightedAverage],
  );
}

export function useChainRecommendations(
  courses: Map<string, SapCourse>,
  specializationCatalog: TrackSpecializationCatalog,
  trackDef: TrackDefinition | null,
): RecommendedChain[] {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const selectedSpecializations = usePlanStore((s) => s.selectedSpecializations);
  const courseChainAssignments = usePlanStore((s) => s.courseChainAssignments);
  const coreToChainOverrides = usePlanStore((s) => s.coreToChainOverrides ?? []);

  return useMemo(() => {
    const allPlaced = new Set<string>([
      ...completedCourses,
      ...Object.values(semesters).flat(),
    ]);
    const chainEligibleCourseIds = trackDef
      ? buildChainEligibleCourseSet({ completedCourses, semesters, coreToChainOverrides }, trackDef)
      : allPlaced;

    if (specializationCatalog.interactionDisabled) return [];

    const scored = specializationCatalog.groups
      .filter((group) => !selectedSpecializations.includes(group.id))
      .map((group) => {
        const evaluation = evaluateSpecializationGroup(group, chainEligibleCourseIds, 'single', courseChainAssignments);
        const mandatory = group.mandatoryCourses.filter((id) => chainEligibleCourseIds.has(id));
        const score = evaluation.doneCount * 2 + mandatory.length * 3;
        return { group, score, matchingCourses: evaluation.matchedCourseNumbers };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 3).map((result) => ({
      ...result,
      matchingCourses: result.matchingCourses.map((id) => courses.get(id)?.name ?? id),
    }));
  }, [semesters, completedCourses, specializationCatalog, selectedSpecializations, courseChainAssignments, courses, trackDef, coreToChainOverrides]);
}
