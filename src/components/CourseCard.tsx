import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { SapCourse } from '../types';
import { usePlanStore } from '../store/planStore';
import { CourseDetailModal } from './CourseDetailModal';

interface Props {
  course: SapCourse;
  isMandatory: boolean;
  hasPrereqWarning?: boolean;
  isCompleted?: boolean;
  missingPrereqGroups?: string[][];  // OR-groups of unsatisfied prereqs
  courses?: Map<string, SapCourse>;
  semester?: number;
}

export function CourseCard({ course, isMandatory, hasPrereqWarning, isCompleted, missingPrereqGroups = [], courses = new Map(), semester }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: course.id,
    data: { course },
  });
  const { favorites, toggleFavorite, toggleCompleted, grades, removeCourseFromSemester } = usePlanStore();
  const isFavorite = favorites.includes(course.id);
  const grade = grades[course.id];
  const [modalOpen, setModalOpen] = useState(false);

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 999 }
    : undefined;

  let colorClass = 'bg-white border-gray-200 hover:border-gray-300';
  if (isCompleted) colorClass = 'bg-green-50 border-green-300';
  else if (hasPrereqWarning) colorClass = 'bg-orange-50 border-orange-300';
  else if (isMandatory) colorClass = 'bg-blue-50 border-blue-200 hover:border-blue-300';

  // Inline prereq display: prefer groups where all courses have known names, then pick fewest
  const namedGroups = missingPrereqGroups.filter(g =>
    g.every(id => courses.get(id)?.name !== undefined)
  );
  const candidateGroups = namedGroups.length > 0 ? namedGroups : missingPrereqGroups;
  const bestGroup = missingPrereqGroups.length > 0
    ? candidateGroups.reduce((min, g) => g.length < min.length ? g : min, candidateGroups[0])
    : [];
  const displayedNames = bestGroup.slice(0, 2).map(id => courses.get(id)?.name ?? id);
  const hasMoreInGroup = bestGroup.length > 2;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={() => setModalOpen(true)}
        className={`
          ${colorClass} border rounded-lg p-2.5 relative
          cursor-grab active:cursor-grabbing select-none
          ${isDragging ? 'opacity-50 shadow-2xl' : 'hover:shadow-sm'}
          transition-all
        `}
      >
        {/* Favorite star — top physical-left */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); toggleFavorite(course.id); }}
          className={`absolute top-1.5 left-1.5 text-sm leading-none ${isFavorite ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
          title={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
        >
          {isFavorite ? '★' : '☆'}
        </button>

        {/* Completed toggle — top physical-right */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); toggleCompleted(course.id); }}
          className={`absolute top-1.5 right-1.5 text-sm leading-none font-bold ${isCompleted ? 'text-green-600' : 'text-gray-300 hover:text-green-500'}`}
          title={isCompleted ? 'סמן כלא הושלם' : 'סמן כהושלם'}
        >
          {isCompleted ? '✓' : '○'}
        </button>

        {/* Course name */}
        <p className="text-xs font-medium text-gray-900 leading-snug px-4">{course.name}</p>

        {/* Inline missing prereqs — show easiest path */}
        {missingPrereqGroups.length > 0 && bestGroup.length > 0 && (
          <p className="text-xs text-orange-500 mt-1 px-4 leading-tight">
            נותר: {displayedNames.join(', ')}{hasMoreInGroup ? '...' : ''}
          </p>
        )}

        {/* Bottom row: ID | grade badge + warning + credits */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-gray-400">{course.id}</span>
          <div className="flex items-center gap-1">
            {grade !== undefined && (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">{grade}</span>
            )}
            {hasPrereqWarning && <span className="text-xs" title="קדמים חסרים">⚠️</span>}
            <span className="text-xs font-bold text-gray-600">{course.credits} נ״ז</span>
          </div>
        </div>

        {/* Remove (X) — shown in all semesters including לא משובץ */}
        {semester !== undefined && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); removeCourseFromSemester(course.id, semester); }}
            className="absolute bottom-1.5 left-1.5 text-gray-300 hover:text-red-500 text-xs leading-none transition-colors"
            title="הסר מהסמסטר"
          >
            ✕
          </button>
        )}
      </div>

      {modalOpen && (
        <CourseDetailModal
          course={course}
          courses={courses}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
