import { useState } from 'react';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SemesterColumn } from './SemesterColumn';
import { CourseCard } from './CourseCard';
import type { SapCourse, TrackDefinition } from '../types';
import { usePlanStore } from '../store/planStore';
import { usePrerequisiteStatus } from '../hooks/usePlan';

interface Props {
  courses: Map<string, SapCourse>;
  trackDef: TrackDefinition;
}

export function SemesterGrid({ courses, trackDef }: Props) {
  const { semesters, moveCourse, completedCourses, maxSemester, addSemester, removeSemester } = usePlanStore();
  const prereqStatus = usePrerequisiteStatus(courses, trackDef);
  const mandatoryIds = new Set(trackDef.semesterSchedule.flatMap((s) => s.courses));
  const completedSet = new Set(completedCourses);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const courseId = String(active.id);
    const target = String(over.id);
    if (!target.startsWith('semester-')) return;
    const toSem = parseInt(target.replace('semester-', ''), 10);
    let fromSem = 0;
    for (const [k, ids] of Object.entries(semesters)) {
      if (ids.includes(courseId)) { fromSem = Number(k); break; }
    }
    if (fromSem !== toSem) moveCourse(courseId, fromSem, toSem);
  }

  const semColProps = (sem: number) => ({
    semester: sem,
    courseIds: semesters[sem] ?? [],
    courses,
    mandatoryCourseIds: mandatoryIds,
    prereqStatus,
    completedCourses: completedSet,
  });

  // Build rows of 4 semesters
  const semesterList = Array.from({ length: maxSemester }, (_, i) => i + 1);
  const rows: number[][] = [];
  for (let i = 0; i < semesterList.length; i += 4) {
    rows.push(semesterList.slice(i, i + 4));
  }

  const activeCourse = activeId ? courses.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-4 gap-3 mb-3">
          {row.map((s) => <SemesterColumn key={s} {...semColProps(s)} />)}
        </div>
      ))}

      <div className="flex gap-3 items-stretch mb-3">
        <div className="flex-1">
          <SemesterColumn {...semColProps(0)} />
        </div>
        <div className="flex flex-col gap-2">
          {maxSemester < 16 && (
            <button
              onClick={addSemester}
              className="flex flex-col items-center justify-center gap-1 px-5 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors min-h-16 text-sm font-medium"
            >
              <span className="text-2xl leading-none">+</span>
              <span>הוסף סמסטר</span>
            </button>
          )}
          {maxSemester > 1 && (
            <button
              onClick={removeSemester}
              className="flex flex-col items-center justify-center gap-1 px-5 border-2 border-dashed border-red-200 rounded-xl text-red-300 hover:border-red-400 hover:text-red-500 transition-colors min-h-16 text-sm font-medium"
            >
              <span className="text-2xl leading-none">−</span>
              <span>הסר סמסטר</span>
            </button>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCourse && (
          <div className="rotate-2 scale-105 shadow-2xl">
            <CourseCard
              course={activeCourse}
              courses={courses}
              isMandatory={mandatoryIds.has(activeId!)}
              isCompleted={completedSet.has(activeId!)}
              missingPrereqGroups={prereqStatus.get(activeId!) ?? []}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
