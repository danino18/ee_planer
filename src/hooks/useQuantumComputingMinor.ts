import {
  QUANTUM_MINOR_ADVISOR_GPA,
  QUANTUM_MINOR_G2_OPTIONS,
  QUANTUM_MINOR_GROUPS,
  QUANTUM_MINOR_MIN_GPA,
  QUANTUM_MINOR_MIN_TOTAL_CREDITS,
} from '../data/quantumComputingMinor';
import type { SapCourse } from '../types';

export interface QuantumGroupProgress {
  id: string;
  title: string;
  minCourses: number;
  satisfiedCount: number;
  satisfied: boolean;
  matchedCourseIds: string[];
}

export interface QuantumG2OptionProgress {
  id: string;
  title: string;
  requiredCourseIds: string[];
  matchedCourseIds: string[];
  satisfied: boolean;
}

export interface QuantumComputingMinorProgress {
  option1Satisfied: boolean;
  option2Satisfied: boolean;
  complete: boolean;
  groupProgress: QuantumGroupProgress[];
  g2OptionProgress: QuantumG2OptionProgress[];
  advancedGroupsSatisfiedCount: number;
  advancedGroupsRequiredForOption1: number;
  gpaStatus: 'missing' | 'advisor' | 'eligible';
  missingTotalCredits: boolean;
  recognizedCourseIds: string[];
  recognizedCredits: number;
}

export function computeQuantumComputingMinorProgress(
  allPlaced: Set<string>,
  courses: Map<string, SapCourse>,
  weightedAverage: number | null,
  totalCredits: number,
  noAdditionalCreditCourseIds: ReadonlySet<string> = new Set(),
): QuantumComputingMinorProgress {
  const recognizedCourseIds = new Set<string>();
  let recognizedCredits = 0;

  const isRecognized = (courseId: string): boolean => (
    allPlaced.has(courseId) && !noAdditionalCreditCourseIds.has(courseId)
  );

  const registerRecognized = (courseId: string, fallbackCredits: number): void => {
    if (recognizedCourseIds.has(courseId)) return;
    recognizedCourseIds.add(courseId);
    recognizedCredits += courses.get(courseId)?.credits ?? fallbackCredits;
  };

  const groupProgress = QUANTUM_MINOR_GROUPS.map((group) => {
    const matchedCourseIds: string[] = [];
    for (const course of group.courses) {
      if (!isRecognized(course.id)) continue;
      matchedCourseIds.push(course.id);
      registerRecognized(course.id, course.credits);
    }

    return {
      id: group.id,
      title: group.title,
      minCourses: group.minCourses,
      satisfiedCount: matchedCourseIds.length,
      satisfied: matchedCourseIds.length >= group.minCourses,
      matchedCourseIds,
    };
  });

  const g2OptionProgress = QUANTUM_MINOR_G2_OPTIONS.map((option) => {
    const matchedCourseIds = option.courses
      .filter((course) => isRecognized(course.id))
      .map((course) => course.id);

    for (const course of option.courses) {
      if (matchedCourseIds.includes(course.id)) {
        registerRecognized(course.id, course.credits);
      }
    }

    return {
      id: option.id,
      title: option.title,
      requiredCourseIds: option.courses.map((course) => course.id),
      matchedCourseIds,
      satisfied: matchedCourseIds.length === option.courses.length,
    };
  });

  const isGroupSatisfied = (id: QuantumGroupProgress['id']) =>
    groupProgress.find((group) => group.id === id)?.satisfied ?? false;

  const advancedGroupsSatisfiedCount = ['d', 'e', 'f'].filter(isGroupSatisfied).length;
  const option1Satisfied =
    isGroupSatisfied('a') &&
    isGroupSatisfied('b') &&
    isGroupSatisfied('g1') &&
    advancedGroupsSatisfiedCount >= 2;
  const option2Satisfied =
    isGroupSatisfied('a') &&
    isGroupSatisfied('b') &&
    g2OptionProgress.some((option) => option.satisfied) &&
    isGroupSatisfied('d') &&
    isGroupSatisfied('e') &&
    isGroupSatisfied('f');

  const gpaStatus =
    weightedAverage !== null && weightedAverage >= QUANTUM_MINOR_MIN_GPA
      ? 'eligible'
      : weightedAverage !== null && weightedAverage >= QUANTUM_MINOR_ADVISOR_GPA
        ? 'advisor'
        : 'missing';

  return {
    option1Satisfied,
    option2Satisfied,
    complete: option1Satisfied || option2Satisfied,
    groupProgress,
    g2OptionProgress,
    advancedGroupsSatisfiedCount,
    advancedGroupsRequiredForOption1: 2,
    gpaStatus,
    missingTotalCredits: totalCredits < QUANTUM_MINOR_MIN_TOTAL_CREDITS,
    recognizedCourseIds: [...recognizedCourseIds],
    recognizedCredits,
  };
}

