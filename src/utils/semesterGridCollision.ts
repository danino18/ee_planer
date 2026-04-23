import type { Collision, CollisionDetection, DroppableContainer } from '@dnd-kit/core';

type CollisionDetectionArgs = Parameters<CollisionDetection>[0];
type CollisionAlgorithm = (args: CollisionDetectionArgs) => Collision[];

interface CollisionAlgorithms {
  closestCenter: CollisionAlgorithm;
  closestCorners: CollisionAlgorithm;
  pointerWithin: CollisionAlgorithm;
  rectIntersection: CollisionAlgorithm;
}

function filterDroppableContainers(
  droppableContainers: DroppableContainer[],
  prefix: string,
): DroppableContainer[] {
  return droppableContainers.filter((container) => String(container.id).startsWith(prefix));
}

function runCollisionAlgorithm(
  args: CollisionDetectionArgs,
  algorithm: CollisionAlgorithm,
  prefix: string,
): Collision[] {
  return algorithm({
    ...args,
    droppableContainers: filterDroppableContainers(args.droppableContainers, prefix),
  });
}

export function createSemesterGridCollisionDetection(
  algorithms: CollisionAlgorithms,
): CollisionDetection {
  return (args) => {
    if (String(args.active.id).startsWith('col-')) {
      return runCollisionAlgorithm(args, algorithms.closestCenter, 'col-');
    }

    const pointerCollisions = runCollisionAlgorithm(args, algorithms.pointerWithin, 'semester-');
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    const intersectingCollisions = runCollisionAlgorithm(args, algorithms.rectIntersection, 'semester-');
    if (intersectingCollisions.length > 0) {
      return intersectingCollisions;
    }

    return runCollisionAlgorithm(args, algorithms.closestCorners, 'semester-');
  };
}
