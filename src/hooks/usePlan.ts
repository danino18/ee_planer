import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore';
import type {
  SapCourse,
  TrackDefinition,
  SpecializationGroup,
  TrackSpecializationCatalog,
} from '../types';
import type { GeneralRequirementProgress } from '../domain/generalRequirements/types';
import { evaluateSpecializationGroup } from '../domain/specializations';
import { buildGeneralRequirementsProgress } from './useGeneralRequirements';
import {
  isCourseTaughtInEnglish,
  isFreeElectiveCourseId,
  isSportCourseId,
  isTechnicalEnglishCourseName,
} from '../data/generalRequirements/courseClassification';

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
  const grades = usePlanStore((s) => s.grades);

  return useMemo(() => {
    let totalWeightedSum = 0;
    let totalCredits = 0;
    for (const [key, grade] of Object.entries(grades)) {
      const courseId = key.includes('_') ? key.split('_')[0] : key;
      const credits = courses.get(courseId)?.credits ?? 0;
      if (credits > 0) {
        totalWeightedSum += grade * credits;
        totalCredits += credits;
      }
    }
    return totalCredits > 0 ? totalWeightedSum / totalCredits : null;
  }, [grades, courses]);
}

export type EnglishRequirementItem = {
  kind: 'advanced_a' | 'advanced_b' | 'content_course';
  label: string;
  done: boolean;
  courseNames: string[];
  neededCount?: number;
};

export function useRequirementsProgress(
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null,
  specializationCatalog: TrackSpecializationCatalog
) {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const selectedSpecializations = usePlanStore((s) => s.selectedSpecializations);
  const doubleSpecializations = usePlanStore((s) => s.doubleSpecializations ?? []);
  const hasEnglishExemption = usePlanStore((s) => s.hasEnglishExemption ?? false);
  const miluimCredits = usePlanStore((s) => s.miluimCredits ?? 0);
  const englishScore = usePlanStore((s) => s.englishScore);
  const englishTaughtCourses = usePlanStore((s) => s.englishTaughtCourses ?? []);
  const semesterOrder = usePlanStore((s) => s.semesterOrder);

  return useMemo(() => {
    if (!trackDef) return null;

    const allPlaced = new Set<string>([
      ...completedCourses,
      ...Object.values(semesters).flat(),
    ]);

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

    const mandatoryIds = new Set(trackDef.semesterSchedule.flatMap((semester) => semester.courses));
    let mandatoryDone = 0;
    for (const { courses: semesterCourseIds } of trackDef.semesterSchedule) {
      for (const id of semesterCourseIds) {
        if (allPlaced.has(id)) mandatoryDone += courses.get(id)?.credits ?? 0;
      }
    }
    for (const id of mandatoryLabIdSet) {
      mandatoryDone += courses.get(id)?.credits ?? 0;
    }

    let electiveCredits = 0;
    const counted = new Set<string>();
    for (const id of allPlaced) {
      if (
        !mandatoryIds.has(id) &&
        !mandatoryLabIdSet.has(id) &&
        !excessLabIdSet.has(id) &&
        !counted.has(id) &&
        !isSportCourseId(id) &&
        !isFreeElectiveCourseId(id)
      ) {
        electiveCredits += courses.get(id)?.credits ?? 0;
        counted.add(id);
      }
    }

    const selectedGroups = specializationCatalog.groups.filter((group) =>
      selectedSpecializations.includes(group.id)
    );
    const groupEvaluations = selectedGroups.map((group) => {
      const mode = group.canBeDouble && doubleSpecializations.includes(group.id)
        ? 'double'
        : 'single';
      const evaluation = evaluateSpecializationGroup(group, allPlaced, mode);
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

    const totalCredits = [...allPlaced].reduce((sum, id) => {
      return sum + (courses.get(id)?.credits ?? 0);
    }, 0);

    const groupDetails = groupEvaluations.map(({ group, mode, evaluation }) => ({
      id: group.id,
      name: group.name,
      done: evaluation.doneCount,
      min: evaluation.requiredCount,
      isDouble: mode === 'double',
      complete: evaluation.complete,
      issues: evaluation.issues,
    }));

    const generalRequirements = buildGeneralRequirementsProgress({
      courses,
      trackDef,
      semesters,
      completedCourses,
      miluimCredits,
      englishTaughtCourses,
    });
    const freeElectiveRequirement = getRequirement(generalRequirements, 'free_elective');
    const generalElectivesRequirement = getRequirement(generalRequirements, 'general_electives');
    const englishRequirement = getRequirement(generalRequirements, 'english');
    const sportRequirement = getRequirement(generalRequirements, 'sport');
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

    const coreProgress = trackDef.coreRequirement
      ? {
          completed: trackDef.coreRequirement.courses.filter((id) => allPlaced.has(id)).length,
          required: trackDef.coreRequirement.required,
          total: trackDef.coreRequirement.courses.length,
        }
      : null;

    return {
      mandatory: { earned: mandatoryDone, required: trackDef.mandatoryCredits },
      elective: { earned: electiveCredits, required: trackDef.electiveCreditsRequired },
      total: { earned: totalCredits, required: trackDef.totalCreditsRequired },
      specializationGroups: {
        completed: specializationCatalog.interactionDisabled ? 0 : completedCount,
        required: trackDef.specializationGroupsRequired,
        total: selectedGroups.length,
        unavailable: specializationCatalog.interactionDisabled,
        diagnostics: specializationCatalog.diagnostics,
      },
      groupDetails,
      sport: {
        earned: sportRequirement?.completedValue ?? 0,
        required: sportRequirement?.targetValue ?? 2,
      },
      general: {
        earned: generalElectivesRequirement?.completedValue ?? 0,
        required: generalElectivesRequirement?.targetValue ?? generalRequired,
      },
      freeElective: {
        earned: freeElectiveRequirement?.completedValue ?? 0,
        required: freeElectiveRequirement?.targetValue ?? 6,
      },
      generalRequirements,
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
      isReady:
        mandatoryDone >= trackDef.mandatoryCredits &&
        electiveCredits >= trackDef.electiveCreditsRequired &&
        (specializationCatalog.interactionDisabled
          ? false
          : completedCount >= trackDef.specializationGroupsRequired) &&
        totalCredits >= trackDef.totalCreditsRequired &&
        (!coreProgress || coreProgress.completed >= coreProgress.required),
    };
  }, [semesters, completedCourses, courses, trackDef, specializationCatalog, selectedSpecializations, doubleSpecializations, hasEnglishExemption, miluimCredits, englishScore, englishTaughtCourses, semesterOrder]);
}

export function useChainRecommendations(
  courses: Map<string, SapCourse>,
  specializationCatalog: TrackSpecializationCatalog
): RecommendedChain[] {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const selectedSpecializations = usePlanStore((s) => s.selectedSpecializations);

  return useMemo(() => {
    const allPlaced = new Set<string>([
      ...completedCourses,
      ...Object.values(semesters).flat(),
    ]);

    if (specializationCatalog.interactionDisabled) return [];

    const scored = specializationCatalog.groups
      .filter((group) => !selectedSpecializations.includes(group.id))
      .map((group) => {
        const evaluation = evaluateSpecializationGroup(group, allPlaced, 'single');
        const mandatory = group.mandatoryCourses.filter((id) => allPlaced.has(id));
        const score = evaluation.doneCount * 2 + mandatory.length * 3;
        return { group, score, matchingCourses: evaluation.matchedCourseNumbers };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 3).map((result) => ({
      ...result,
      matchingCourses: result.matchingCourses.map((id) => courses.get(id)?.name ?? id),
    }));
  }, [semesters, completedCourses, specializationCatalog, selectedSpecializations, courses]);
}
