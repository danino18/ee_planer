import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { SapCourse } from '../types';
import { usePlanStore, gradeKey, REPEATABLE_COURSES } from '../store/planStore';
import { CourseDetailModal } from './CourseDetailModal';
import { getFacultyStyle } from '../utils/faculty';

interface Props {
  course: SapCourse;
  isMandatory: boolean;
  hasPrereqWarning?: boolean;
  isCompleted?: boolean;
  isPlanned?: boolean;
  missingPrereqGroups?: string[][];  // OR-groups of unsatisfied prereqs
  courses?: Map<string, SapCourse>;
  semester?: number;
  instanceKey?: string;       // unique draggable ID (for repeated courses)
  wrongSemesterType?: boolean; // true if placed in wrong teaching semester
  chainName?: string;          // specialization chain name (replaces 'בחירה')
}

export function CourseCard({
  course, isMandatory, hasPrereqWarning, isCompleted, isPlanned,
  missingPrereqGroups = [], courses = new Map(), semester,
  instanceKey, wrongSemesterType, chainName,
}: Props) {
  const draggableId = instanceKey ?? course.id;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { course },
  });
  const { favorites, toggleFavorite, toggleCompleted, toggleCompletedInstance, grades, binaryPass, removeCourseFromSemester, completedInstances } = usePlanStore();
  const facultyColorOverrides = usePlanStore((s) => s.facultyColorOverrides ?? {});
  const isFavorite = favorites.includes(course.id);
  const grade = grades[gradeKey(course.id, semester)];
  const isBinaryPass = !!(binaryPass ?? {})[course.id];
  const isRepeatable = REPEATABLE_COURSES.has(course.id);
  const effectiveIsCompleted = isRepeatable && instanceKey
    ? (completedInstances ?? []).includes(instanceKey)
    : isCompleted;
  const [modalOpen, setModalOpen] = useState(false);

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 999 }
    : undefined;

  let colorClass = 'bg-white border-gray-200 hover:border-gray-300';
  if (wrongSemesterType) colorClass = 'bg-red-50 border-red-200 hover:border-red-300';
  else if (effectiveIsCompleted) colorClass = 'bg-green-50 border-green-300';
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

  const facultyStyle = course.faculty ? getFacultyStyle(course.faculty, course.id, facultyColorOverrides) : null;

  const seasonLabel = course.teachingSemester === 'winter' ? '❄️' : course.teachingSemester === 'spring' ? '🌸' : null;

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
          ${isDragging ? 'opacity-50 shadow-2xl scale-105' : 'hover:shadow-sm active:scale-95'}
          ${isPlanned && !isDragging ? 'opacity-60' : ''}
          transition-all duration-100
        `}
      >
        {/* Favorite star — 44×44px hit area, top physical-left */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); toggleFavorite(course.id); }}
          className={`absolute top-0 left-0 w-11 h-11 flex items-center justify-center text-sm leading-none ${isFavorite ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
          title={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
        >
          {isFavorite ? '★' : '☆'}
        </button>

        {/* Completed toggle — only shown when course is in a semester */}
        {semester !== undefined && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              isRepeatable && instanceKey ? toggleCompletedInstance(instanceKey) : toggleCompleted(course.id);
            }}
            className={`absolute top-0 right-0 w-11 h-11 flex items-center justify-center text-sm leading-none font-bold ${effectiveIsCompleted ? 'text-green-600' : 'text-gray-300 hover:text-green-500'}`}
            title={effectiveIsCompleted ? 'סמן כלא הושלם' : 'סמן כהושלם'}
          >
            {effectiveIsCompleted ? '✓' : '○'}
          </button>
        )}

        {/* Course name — padded to avoid 44px button overlap */}
        <p className="text-xs font-medium text-gray-900 leading-snug px-11 pt-0.5">{course.name}</p>

        {/* Wrong semester warning */}
        {wrongSemesterType && (
          <p className="text-xs text-red-500 mt-0.5 px-4 leading-tight">
            {course.teachingSemester === 'winter' ? '❄️ קורס חורף בלבד' : '🌸 קורס אביב בלבד'}
          </p>
        )}

        {/* Inline missing prereqs — each on its own line */}
        {missingPrereqGroups.length > 0 && bestGroup.length > 0 && (
          <div className="mt-1 px-4 space-y-0.5">
            {displayedNames.map((name, i) => (
              <p key={i} className="text-xs text-orange-500 leading-tight">נותר: {name}</p>
            ))}
            {hasMoreInGroup && <p className="text-xs text-orange-400 leading-tight">...</p>}
          </div>
        )}

        {/* Bottom row: ID | tags + grade + warning + credits */}
        <div className="flex items-center justify-between mt-1.5 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">{course.id}</span>
            {/* Faculty colored dot */}
            {facultyStyle && (
              <span
                className={`inline-block w-2 h-2 rounded-full shrink-0 ${facultyStyle.dot}`}
                title={course.faculty}
              />
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Season badge */}
            {seasonLabel && (
              <span className="text-xs leading-none" title={course.teachingSemester === 'winter' ? 'חורף בלבד' : 'אביב בלבד'}>
                {seasonLabel}
              </span>
            )}
            {/* English badge */}
            {course.isEnglish && (
              <span className="text-xs bg-sky-50 text-sky-600 px-1 py-0.5 rounded font-semibold leading-none" title="קורס באנגלית">
                EN
              </span>
            )}
            {/* Mandatory / elective / chain badge */}
            <span
              className={`text-xs px-1 py-0.5 rounded font-medium leading-none ${
                isMandatory ? 'bg-blue-100 text-blue-600' : chainName ? 'bg-indigo-50 text-indigo-600' : 'bg-teal-50 text-teal-600'
              }`}
              title={!isMandatory && chainName ? chainName : undefined}
            >
              {isMandatory ? 'חובה' : (chainName ?? 'בחירה')}
            </span>
            {isBinaryPass && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">עובר</span>
            )}
            {grade !== undefined && !isBinaryPass && (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">{grade}</span>
            )}
            {hasPrereqWarning && <span className="text-xs" title="קדמים חסרים">⚠️</span>}
            <span className="text-xs font-bold text-gray-600">{course.credits} נ״ז</span>
          </div>
        </div>

        {/* Remove (X) */}
        {semester !== undefined && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); removeCourseFromSemester(course.id, semester); }}
            className="absolute bottom-0 left-0 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 text-sm transition-colors"
            title={semester === 0 ? 'הסר מהתכנית' : 'הסר מהסמסטר'}
          >
            ✕
          </button>
        )}
      </div>

      {modalOpen && (
        <CourseDetailModal
          course={course}
          courses={courses}
          semester={semester}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
