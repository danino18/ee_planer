import type { SapCourse, TrackDefinition } from '../types';
import { getAutomaticElectiveCreditArea } from './electives';

export interface DownstreamIndirectEntry {
  course: SapCourse;
  viaName: string;
}

export interface DownstreamDependents {
  direct: SapCourse[];
  indirect: DownstreamIndirectEntry[];
}

const MAX_VISITED_NODES = 500;

const reverseGraphCache = new WeakMap<Map<string, SapCourse>, Map<string, string[]>>();

function buildReverseGraph(courses: Map<string, SapCourse>): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const course of courses.values()) {
    const prereqIds = new Set(course.prerequisites.flat());
    for (const prereqId of prereqIds) {
      const dependents = graph.get(prereqId);
      if (dependents) dependents.push(course.id);
      else graph.set(prereqId, [course.id]);
    }
  }
  return graph;
}

function getReverseGraph(courses: Map<string, SapCourse>): Map<string, string[]> {
  let graph = reverseGraphCache.get(courses);
  if (!graph) {
    graph = buildReverseGraph(courses);
    reverseGraphCache.set(courses, graph);
  }
  return graph;
}

/** Uncapped BFS over the reverse prerequisite graph. Caller is responsible for filtering/capping for display. */
export function getDownstreamDependents(
  courseId: string,
  courses: Map<string, SapCourse>,
): DownstreamDependents {
  const graph = getReverseGraph(courses);

  const direct: SapCourse[] = [];
  const indirectById = new Map<string, DownstreamIndirectEntry>();
  const visited = new Set<string>([courseId]);
  let queue = graph.get(courseId) ?? [];
  let depth = 1;
  let viaNames = new Map<string, string>();
  for (const id of queue) viaNames.set(id, courses.get(courseId)?.name ?? courseId);

  while (queue.length > 0 && visited.size < MAX_VISITED_NODES) {
    const nextQueue: string[] = [];
    const nextViaNames = new Map<string, string>();
    for (const id of queue) {
      if (visited.has(id)) continue;
      visited.add(id);
      const course = courses.get(id);
      if (!course) continue;

      if (depth === 1) {
        direct.push(course);
      } else if (!indirectById.has(id)) {
        indirectById.set(id, { course, viaName: viaNames.get(id) ?? '' });
      }

      for (const childId of graph.get(id) ?? []) {
        if (!visited.has(childId)) {
          nextQueue.push(childId);
          if (!nextViaNames.has(childId)) {
            nextViaNames.set(childId, depth === 1 ? course.name : viaNames.get(id) ?? course.name);
          }
        }
      }
    }
    queue = nextQueue;
    viaNames = nextViaNames;
    depth += 1;
  }

  direct.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  const indirect = Array.from(indirectById.values()).sort((a, b) =>
    a.course.name.localeCompare(b.course.name, 'he'),
  );

  return { direct, indirect };
}

export function hasPlannedDownstreamDependent(
  courseId: string,
  courses: Map<string, SapCourse>,
  plannedIds: Set<string>,
): boolean {
  const graph = getReverseGraph(courses);
  const visited = new Set<string>([courseId]);
  let queue = graph.get(courseId) ?? [];

  while (queue.length > 0 && visited.size < MAX_VISITED_NODES) {
    const nextQueue: string[] = [];
    for (const id of queue) {
      if (visited.has(id)) continue;
      visited.add(id);
      if (plannedIds.has(id)) return true;
      for (const childId of graph.get(id) ?? []) {
        if (!visited.has(childId)) nextQueue.push(childId);
      }
    }
    queue = nextQueue;
  }
  return false;
}

/** Number of semesters a placed course could move forward before hitting its nearest already-placed downstream dependent. 0 = no slack (next semester already blocks it). */
export function getPostponeSlack(
  courseId: string,
  currentSemesterId: number,
  courses: Map<string, SapCourse>,
  courseSemesterMap: Map<string, number>,
  semesterOrder: number[],
): number {
  const graph = getReverseGraph(courses);
  const visited = new Set<string>([courseId]);
  let queue = graph.get(courseId) ?? [];
  const currentIdx = semesterOrder.indexOf(currentSemesterId);
  let minDependentIdx = Infinity;

  while (queue.length > 0 && visited.size < MAX_VISITED_NODES) {
    const nextQueue: string[] = [];
    for (const id of queue) {
      if (visited.has(id)) continue;
      visited.add(id);
      const placedSemesterId = courseSemesterMap.get(id);
      if (placedSemesterId !== undefined) {
        const idx = semesterOrder.indexOf(placedSemesterId);
        if (idx >= 0 && idx < minDependentIdx) minDependentIdx = idx;
      }
      for (const childId of graph.get(id) ?? []) {
        if (!visited.has(childId)) nextQueue.push(childId);
      }
    }
    queue = nextQueue;
  }

  if (minDependentIdx === Infinity || currentIdx < 0) return 0;
  return Math.max(0, minDependentIdx - currentIdx - 1);
}

export interface RelevanceContext {
  mandatoryIds: Set<string>;
  specializationIds: Set<string>;
  trackDef: TrackDefinition | null;
}

/** Whether a not-yet-placed course is relevant enough to surface in a downstream-dependents list: mandatory, a specialization/chain course, or a usable faculty elective. */
export function isCourseRelevantToTrack(
  course: SapCourse,
  { mandatoryIds, specializationIds, trackDef }: RelevanceContext,
): boolean {
  if (mandatoryIds.has(course.id)) return true;
  if (specializationIds.has(course.id)) return true;
  if (trackDef && getAutomaticElectiveCreditArea(course, trackDef) !== 'general') return true;
  return false;
}
