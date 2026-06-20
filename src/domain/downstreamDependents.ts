import type { SapCourse } from '../types';

export interface DownstreamIndirectEntry {
  course: SapCourse;
  viaName: string;
}

export interface DownstreamDependents {
  direct: SapCourse[];
  indirect: DownstreamIndirectEntry[];
  indirectTruncated: number;
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

export function getDownstreamDependents(
  courseId: string,
  courses: Map<string, SapCourse>,
  opts?: { indirectCap?: number },
): DownstreamDependents {
  const indirectCap = opts?.indirectCap ?? 15;
  const graph = getReverseGraph(courses);

  const direct: SapCourse[] = [];
  const indirectByName = new Map<string, DownstreamIndirectEntry>();
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
      } else if (!indirectByName.has(id)) {
        indirectByName.set(id, { course, viaName: viaNames.get(id) ?? '' });
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

  const sortedIndirect = Array.from(indirectByName.values()).sort((a, b) =>
    a.course.name.localeCompare(b.course.name, 'he'),
  );
  direct.sort((a, b) => a.name.localeCompare(b.name, 'he'));

  const indirect = sortedIndirect.slice(0, indirectCap);
  const indirectTruncated = sortedIndirect.length - indirect.length;

  return { direct, indirect, indirectTruncated };
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
