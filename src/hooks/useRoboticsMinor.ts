import {
  ROBOTICS_MINOR_LISTS,
  ROBOTICS_MINOR_POOL_REQUIRED,
  ROBOTICS_LIST5_MIN_COURSES,
  ROBOTICS_LIST5_MIN_OUTSIDE_EE,
} from '../data/roboticsMinor';
import type { SapCourse } from '../types';

export interface RoboticsListProgress {
  listNumber: number;
  title: string;
  minCourses: number;
  satisfiedCount: number;
  satisfied: boolean;
  matchedCourseIds: string[];
}

export interface RoboticsMinorProgress {
  poolEarned: number;
  poolRequired: number;
  poolSatisfied: boolean;
  listProgress: RoboticsListProgress[];
  list5TotalCourses: number;
  list5OutsideEECourses: number;
  list5Satisfied: boolean;
  missingGpa: boolean;
  missingTotalCredits: boolean;
}

export function computeRoboticsMinorProgress(
  allPlaced: Set<string>,
  courses: Map<string, SapCourse>,
  weightedAverage: number | null,
  totalCredits: number,
): RoboticsMinorProgress {
  let poolEarned = 0;
  const listProgress: RoboticsListProgress[] = [];

  for (const list of ROBOTICS_MINOR_LISTS) {
    const matchedCourseIds: string[] = [];

    for (const rc of list.courses) {
      if (!allPlaced.has(rc.id)) continue;
      matchedCourseIds.push(rc.id);
      poolEarned += courses.get(rc.id)?.credits ?? rc.credits;
    }

    listProgress.push({
      listNumber: list.listNumber,
      title: list.title,
      minCourses: list.minCourses,
      satisfiedCount: matchedCourseIds.length,
      satisfied: matchedCourseIds.length >= list.minCourses,
      matchedCourseIds,
    });
  }

  const list5Data = ROBOTICS_MINOR_LISTS.find((l) => l.listNumber === 5)!;
  const list5Progress = listProgress.find((l) => l.listNumber === 5)!;
  let list5OutsideEE = 0;
  for (const courseId of list5Progress.matchedCourseIds) {
    const courseData = list5Data.courses.find((c) => c.id === courseId);
    if (courseData?.outsideEE) list5OutsideEE++;
  }

  return {
    poolEarned,
    poolRequired: ROBOTICS_MINOR_POOL_REQUIRED,
    poolSatisfied: poolEarned >= ROBOTICS_MINOR_POOL_REQUIRED,
    listProgress,
    list5TotalCourses: list5Progress.satisfiedCount,
    list5OutsideEECourses: list5OutsideEE,
    list5Satisfied:
      list5Progress.satisfiedCount >= ROBOTICS_LIST5_MIN_COURSES &&
      list5OutsideEE >= ROBOTICS_LIST5_MIN_OUTSIDE_EE,
    missingGpa: weightedAverage === null || weightedAverage < 87.0,
    missingTotalCredits: totalCredits < 60,
  };
}
