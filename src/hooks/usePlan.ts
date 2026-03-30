import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore';
import type { SapCourse, TrackDefinition, SpecializationGroup } from '../types';

// Bidirectional equivalences: having ANY course in a group satisfies prereqs for ALL in the group.
// Handles Technion's parallel course numbering for the same subject across tracks.
const PREREQ_EQUIVALENCES: string[][] = [
  // Linear Algebra 1 variants
  ['01040064', '01040065', '01040016'],
  // Calculus 1 variants
  ['01040012', '01040031', '01040041', '01040042', '01040018'],
  // Physics 1 variants
  ['01140071', '01130013'],
  // Physics 2 variants
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

// Returns Map<courseId, unsatisfiedOrGroups[][]>.
// Empty array [] = prereqs satisfied (or no prereqs).
// Non-empty = the OR-groups that are not yet fully satisfied.
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

    // Build base set: completedCourses + all courses in semesters before currentSemester
    // Use semesterOrder to correctly handle summer semesters (which may have non-sequential IDs)
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
        // For unassigned courses, consider ALL placed courses as available prereqs
        for (const [k, ids] of Object.entries(semesters)) {
          if (Number(k) !== 0) for (const id of ids) alreadyTaken.add(id);
        }
      } else {
        // Use semesterOrder to include summer semesters in prereq chain
        const semIdx = semesterOrder.indexOf(sem);
        for (let i = 0; i < semIdx; i++) {
          for (const id of semesters[semesterOrder[i]] ?? []) {
            alreadyTaken.add(id);
          }
        }
      }
      // Expand with substitutions: if course A substitutes for course B, treat B as taken
      for (const [from, to] of Object.entries(substitutions)) {
        if (alreadyTaken.has(from)) alreadyTaken.add(to);
      }
      // Expand with system equivalences (bidirectional: having any variant satisfies all)
      const expanded = expandWithEquivalents(alreadyTaken);
      for (const id of expanded) alreadyTaken.add(id);

      for (const courseId of courseIds) {
        const course = courses.get(courseId);
        if (!course || course.prerequisites.length === 0) {
          missingMap.set(courseId, []);
          continue;
        }

        // If user selected a specific prereq path, use only that
        const selectedGroup = selectedPrereqGroups[courseId];
        if (selectedGroup !== undefined) {
          const satisfied = selectedGroup.every(p => alreadyTaken.has(p));
          missingMap.set(courseId, satisfied ? [] : [selectedGroup]);
          continue;
        }

        // OR-logic: satisfied if ANY group has ALL its courses in alreadyTaken
        const isSatisfied = course.prerequisites.some(
          orGroup => orGroup.every(p => alreadyTaken.has(p))
        );
        if (isSatisfied) {
          missingMap.set(courseId, []);
        } else {
          const unsatisfied = course.prerequisites.filter(
            orGroup => !orGroup.every(p => alreadyTaken.has(p))
          );
          missingMap.set(courseId, unsatisfied);
        }
      }
    }

    return missingMap;
  }, [semesters, completedCourses, substitutions, selectedPrereqGroups, courses, trackDef, currentSemester, semesterOrder]);
}

export function useWeightedAverage(courses: Map<string, SapCourse>): number | null {
  const { grades } = usePlanStore();

  return useMemo(() => {
    let totalWeightedSum = 0;
    let totalCredits = 0;
    for (const [id, grade] of Object.entries(grades)) {
      const credits = courses.get(id)?.credits ?? 0;
      if (credits > 0) {
        totalWeightedSum += grade * credits;
        totalCredits += credits;
      }
    }
    return totalCredits > 0 ? totalWeightedSum / totalCredits : null;
  }, [grades, courses]);
}

export function useRequirementsProgress(
  courses: Map<string, SapCourse>,
  trackDef: TrackDefinition | null,
  specializations: SpecializationGroup[]
) {
  const semesters = usePlanStore((s) => s.semesters);
  const completedCourses = usePlanStore((s) => s.completedCourses);
  const selectedSpecializations = usePlanStore((s) => s.selectedSpecializations);
  const doubleSpecializations = usePlanStore((s) => s.doubleSpecializations ?? []);
  const hasEnglishExemption = usePlanStore((s) => s.hasEnglishExemption ?? false);
  const miluimCredits = usePlanStore((s) => s.miluimCredits ?? 0);
  const englishScore = usePlanStore((s) => s.englishScore);
  const englishTaughtCourses = usePlanStore((s) => s.englishTaughtCourses ?? []);

  return useMemo(() => {
    if (!trackDef) return null;

    const allPlaced = new Set<string>([
      ...completedCourses,
      ...Object.values(semesters).flat(),
    ]);

    const mandatoryIds = new Set(trackDef.semesterSchedule.flatMap((s) => s.courses));
    let mandatoryDone = 0;
    for (const { courses: semCourseIds } of trackDef.semesterSchedule) {
      for (const id of semCourseIds) {
        if (allPlaced.has(id)) mandatoryDone += courses.get(id)?.credits ?? 0;
      }
    }

    let electiveCredits = 0;
    const counted = new Set<string>();
    for (const id of allPlaced) {
      if (!mandatoryIds.has(id) && !counted.has(id)) {
        electiveCredits += courses.get(id)?.credits ?? 0;
        counted.add(id);
      }
    }

    const selectedGroups = specializations.filter((g) =>
      selectedSpecializations.includes(g.id)
    );

    // #12: chain complete only when ALL mandatory courses done first, then min count met
    // #4: double specialization uses doubleMinCoursesToComplete
    // mandatoryOptions: at least 1 from each inner array must be completed
    const completedGroupsList = selectedGroups.filter((g) => {
      const allMandatoryDone = g.mandatoryCourses.length === 0 ||
        g.mandatoryCourses.every((id) => allPlaced.has(id));
      if (!allMandatoryDone) return false;
      const mandatoryOptionsDone = !g.mandatoryOptions ||
        g.mandatoryOptions.every((opts) => opts.some((id) => allPlaced.has(id)));
      if (!mandatoryOptionsDone) return false;
      const effectiveMin = (doubleSpecializations.includes(g.id) && g.doubleMinCoursesToComplete)
        ? g.doubleMinCoursesToComplete
        : g.minCoursesToComplete;
      const n = [...g.mandatoryCourses, ...g.electiveCourses].filter((id) => allPlaced.has(id)).length;
      return n >= effectiveMin;
    });

    // Double groups count as 2 towards the requirement
    const completedCount = completedGroupsList.reduce(
      (sum, g) => sum + (doubleSpecializations.includes(g.id) ? 2 : 1), 0
    );

    const totalCredits = [...allPlaced].reduce((sum, id) => {
      return sum + (courses.get(id)?.credits ?? 0);
    }, 0);

    const groupDetails = selectedGroups.map((g) => {
      const all = [...g.mandatoryCourses, ...g.electiveCourses];
      const done = all.filter((id) => allPlaced.has(id)).length;
      const effectiveMin = (doubleSpecializations.includes(g.id) && g.doubleMinCoursesToComplete)
        ? g.doubleMinCoursesToComplete
        : g.minCoursesToComplete;
      const mandatoryOptionsDone = !g.mandatoryOptions ||
        g.mandatoryOptions.every((opts) => opts.some((id) => allPlaced.has(id)));
      return { id: g.id, name: g.name, done, min: effectiveMin, isDouble: doubleSpecializations.includes(g.id), mandatoryOptionsDone };
    });

    // Lab pool: count how many pool labs the student has placed
    const labPoolTaken = trackDef.labPool
      ? trackDef.labPool.courses.filter((id) => allPlaced.has(id)).length
      : 0;

    // #13: Sport credits (039xxx courses)
    let sportCredits = 0;
    for (const id of allPlaced) {
      if (id.startsWith('039')) sportCredits += courses.get(id)?.credits ?? 0;
    }

    // #13: General / מל"גים credits (032xxx courses — humanities, English, general education)
    let generalCredits = 0;
    for (const id of allPlaced) {
      if (id.startsWith('032')) generalCredits += courses.get(id)?.credits ?? 0;
    }

    // #13: English courses placed (courses whose name contains "אנגלית")
    const englishPlaced: { id: string; name: string }[] = [];
    const seenEng = new Set<string>();
    for (const id of allPlaced) {
      if (!seenEng.has(id)) {
        const c = courses.get(id);
        if (c && c.name.includes('אנגלית')) {
          englishPlaced.push({ id, name: c.name });
          seenEng.add(id);
        }
      }
    }

    // English requirements based on Amiram/Psychometric score (Technion regulation 1.3.3)
    const englishInPlan = [...allPlaced].filter((id) => {
      const c = courses.get(id);
      return c && (c.isEnglish || englishTaughtCourses.includes(id));
    });
    let englishRequirements: { label: string; done: boolean }[] = [];
    if (englishScore !== undefined) {
      const advancedA = englishPlaced.some((c) => c.name.includes("מתקדמים א'") || c.name.includes('מתקדמים א'));
      const advancedB = englishPlaced.some((c) => c.name.includes("מתקדמים ב'") || c.name.includes('מתקדמים ב'));
      if (englishScore >= 104 && englishScore <= 119) {
        englishRequirements = [
          { label: "מתקדמים א'", done: advancedA },
          { label: "מתקדמים ב'", done: advancedB },
        ];
      } else if (englishScore >= 120 && englishScore <= 133) {
        englishRequirements = [
          { label: "מתקדמים ב'", done: advancedB },
          { label: 'קורס 1 בנלמד באנגלית', done: englishInPlan.length >= 1 },
        ];
      } else if (englishScore >= 134 && englishScore <= 150) {
        englishRequirements = [
          { label: `קורסים נלמדים באנגלית (${englishInPlan.length}/2)`, done: englishInPlan.length >= 2 },
        ];
      }
    }

    // Miluim reduction: reduce generalCreditsRequired (but not sport/מלג courses)
    const generalRequired = Math.max(0, trackDef.generalCreditsRequired - miluimCredits);

    return {
      mandatory: { earned: mandatoryDone, required: trackDef.mandatoryCredits },
      elective: { earned: electiveCredits, required: trackDef.electiveCreditsRequired },
      total: { earned: totalCredits, required: trackDef.totalCreditsRequired },
      specializationGroups: {
        completed: completedCount,
        required: trackDef.specializationGroupsRequired,
        total: selectedGroups.length,
      },
      groupDetails,
      // #13 extended:
      sport: { earned: sportCredits, required: 2 },
      general: { earned: generalCredits, required: generalRequired },
      labPoolProgress: trackDef.labPool
        ? { earned: labPoolTaken, required: trackDef.labPool.required }
        : null,
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
        completedCount >= trackDef.specializationGroupsRequired &&
        totalCredits >= trackDef.totalCreditsRequired,
    };
  }, [semesters, completedCourses, courses, trackDef, specializations, selectedSpecializations, doubleSpecializations, hasEnglishExemption, miluimCredits, englishScore, englishTaughtCourses]);
}

export function useChainRecommendations(
  courses: Map<string, SapCourse>,
  specializations: SpecializationGroup[]
): RecommendedChain[] {
  const { semesters, completedCourses, selectedSpecializations } = usePlanStore();

  return useMemo(() => {
    const allPlaced = new Set<string>([
      ...completedCourses,
      ...Object.values(semesters).flat(),
    ]);

    const scored = specializations
      .filter((g) => !selectedSpecializations.includes(g.id))
      .map((group) => {
        const mandatory = group.mandatoryCourses.filter((id) => allPlaced.has(id));
        const elective = group.electiveCourses.filter((id) => allPlaced.has(id));
        const matching = [...mandatory, ...elective];
        const score = matching.length * 2 + mandatory.length * 3;
        return { group, score, matchingCourses: matching };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 3).map((r) => ({
      ...r,
      matchingCourses: r.matchingCourses.map((id) => courses.get(id)?.name ?? id),
    }));
  }, [semesters, completedCourses, specializations, selectedSpecializations, courses]);
}
