import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore';
import type { SapCourse, TrackDefinition, SpecializationGroup } from '../types';

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

  return useMemo(() => {
    const missingMap = new Map<string, string[][]>();
    if (!trackDef) return missingMap;

    // Build base set: completedCourses + all courses in semesters before currentSemester
    const baseTaken = new Set<string>(completedCourses);
    if (currentSemester !== null) {
      for (let s = 1; s < currentSemester; s++) {
        for (const id of semesters[s] ?? []) baseTaken.add(id);
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
        for (let s = 1; s < sem; s++) {
          for (const id of semesters[s] ?? []) {
            alreadyTaken.add(id);
          }
        }
      }
      // Expand with substitutions: if course A substitutes for course B, treat B as taken
      for (const [from, to] of Object.entries(substitutions)) {
        if (alreadyTaken.has(from)) alreadyTaken.add(to);
      }

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
  }, [semesters, completedCourses, substitutions, selectedPrereqGroups, courses, trackDef, currentSemester]);
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
    const completedGroupsList = selectedGroups.filter((g) => {
      const n = [...g.mandatoryCourses, ...g.electiveCourses].filter((id) => allPlaced.has(id)).length;
      return n >= g.minCoursesToComplete;
    });

    const totalCredits = [...allPlaced].reduce((sum, id) => {
      return sum + (courses.get(id)?.credits ?? 0);
    }, 0);

    const groupDetails = selectedGroups.map((g) => {
      const all = [...g.mandatoryCourses, ...g.electiveCourses];
      const done = all.filter((id) => allPlaced.has(id)).length;
      return { id: g.id, name: g.name, done, min: g.minCoursesToComplete };
    });

    return {
      mandatory: { earned: mandatoryDone, required: trackDef.mandatoryCredits },
      elective: { earned: electiveCredits, required: trackDef.electiveCreditsRequired },
      total: { earned: totalCredits, required: trackDef.totalCreditsRequired },
      specializationGroups: {
        completed: completedGroupsList.length,
        required: trackDef.specializationGroupsRequired,
        total: selectedGroups.length,
      },
      groupDetails,
      isReady:
        mandatoryDone >= trackDef.mandatoryCredits &&
        electiveCredits >= trackDef.electiveCreditsRequired &&
        completedGroupsList.length >= trackDef.specializationGroupsRequired &&
        totalCredits >= trackDef.totalCreditsRequired,
    };
  }, [semesters, completedCourses, courses, trackDef, specializations, selectedSpecializations]);
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
