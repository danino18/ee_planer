import {
  ENTREPRENEURSHIP_COURSES,
  ENTREPRENEURSHIP_MINOR_MIN_CREDITS,
  ENTREPRENEURSHIP_MINOR_MIN_GPA,
  ENTREPRENEURSHIP_MINOR_MIN_TOTAL_CREDITS,
} from '../data/entrepreneurshipMinor';
import type { SapCourse } from '../types';

export interface EntrepreneurshipMinorProgress {
  creditsEarned: number;
  creditsRequired: number;
  creditsSatisfied: boolean;
  mandatoryCompleted: number;
  mandatoryRequired: number;
  placedMandatoryIds: string[];
  placedElectiveIds: string[];
  electivesCompleted: number;
  missingGpa: boolean;
  missingTotalCredits: boolean;
  hasUnknownMandatory: boolean;
}

export function computeEntrepreneurshipMinorProgress(
  allPlaced: Set<string>,
  courses: Map<string, SapCourse>,
  weightedAverage: number | null,
  totalCredits: number,
): EntrepreneurshipMinorProgress {
  let creditsEarned = 0;
  let mandatoryCompleted = 0;
  let electivesCompleted = 0;
  const placedMandatoryIds: string[] = [];
  const placedElectiveIds: string[] = [];
  const hasUnknownMandatory = ENTREPRENEURSHIP_COURSES.some((c) => c.mandatory && c.id === null);

  for (const course of ENTREPRENEURSHIP_COURSES) {
    if (course.id === null) continue;
    if (!allPlaced.has(course.id)) continue;

    const credits = courses.get(course.id)?.credits ?? course.credits;
    creditsEarned += credits;

    if (course.mandatory) {
      mandatoryCompleted++;
      placedMandatoryIds.push(course.id);
    } else {
      electivesCompleted++;
      placedElectiveIds.push(course.id);
    }
  }

  return {
    creditsEarned,
    creditsRequired: ENTREPRENEURSHIP_MINOR_MIN_CREDITS,
    creditsSatisfied: creditsEarned >= ENTREPRENEURSHIP_MINOR_MIN_CREDITS,
    mandatoryCompleted,
    mandatoryRequired: ENTREPRENEURSHIP_COURSES.filter((c) => c.mandatory).length,
    placedMandatoryIds,
    placedElectiveIds,
    electivesCompleted,
    missingGpa: weightedAverage === null || weightedAverage < ENTREPRENEURSHIP_MINOR_MIN_GPA,
    missingTotalCredits: totalCredits < ENTREPRENEURSHIP_MINOR_MIN_TOTAL_CREDITS,
    hasUnknownMandatory,
  };
}
