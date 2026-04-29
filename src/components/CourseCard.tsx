import { lazy, memo, Suspense, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useShallow } from 'zustand/react/shallow';
import type { SapCourse } from '../types';
import { usePlanStore, gradeKey, REPEATABLE_COURSES } from '../store/planStore';
import { getFacultyStyle } from '../utils/faculty';
import { getTeachingSemesterBadge } from '../utils/teachingSemester';
import { isCourseTaughtInEnglish, isFreeElectiveCourseId } from '../data/generalRequirements/courseClassification';

interface Props {
  course: SapCourse;
  isMandatory: boolean;
  hasPrereqWarning?: boolean;
  isCompleted?: boolean;
  isPlanned?: boolean;
  missingPrereqGroups?: string[][];
  courses?: Map<string, SapCourse>;
  semester?: number;
  instanceKey?: string;
  wrongSemesterType?: boolean;
  chainName?: string;
  draggable?: boolean;
  showActions?: boolean;
}

const LazyCourseDetailModal = lazy(async () => {
  const module = await import('./CourseDetailModal');
  return { default: module.CourseDetailModal };
});

export const CourseCard = memo(function CourseCard({
  course,
  isMandatory,
  hasPrereqWarning,
  isCompleted,
  isPlanned,
  missingPrereqGroups = [],
  courses = new Map(),
  semester,
  instanceKey,
  wrongSemesterType,
  chainName,
  draggable = true,
  showActions = true,
}: Props) {
  const draggableId = instanceKey ?? course.id;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { course },
    disabled: !draggable,
  });
  const {
    toggleFavorite,
    toggleCompleted,
    toggleCompletedInstance,
    removeCourseFromSemester,
    isFavorite,
    grade,
    isBinaryPass,
    isCompletedInstance,
    facultyColorOverrides,
    englishTaughtCourses,
  } = usePlanStore(useShallow((state) => ({
    toggleFavorite: state.toggleFavorite,
    toggleCompleted: state.toggleCompleted,
    toggleCompletedInstance: state.toggleCompletedInstance,
    removeCourseFromSemester: state.removeCourseFromSemester,
    isFavorite: state.favorites.includes(course.id),
    grade: state.grades[gradeKey(course.id, semester)],
    isBinaryPass: !!(state.binaryPass ?? {})[course.id],
    isCompletedInstance: instanceKey ? (state.completedInstances ?? []).includes(instanceKey) : false,
    facultyColorOverrides: state.facultyColorOverrides ?? {},
    englishTaughtCourses: state.englishTaughtCourses ?? [],
  })));
  const isRepeatable = REPEATABLE_COURSES.has(course.id);
  const effectiveIsCompleted = isRepeatable && instanceKey
    ? isCompletedInstance
    : isCompleted;
  const [modalOpen, setModalOpen] = useState(false);
  const showsEnglishBadge = isCourseTaughtInEnglish(course, englishTaughtCourses);
  const showsFreeElectiveBadge = isFreeElectiveCourseId(course.id);
  const showCardActions = showActions && !isDragging;

  const style: React.CSSProperties = {
    ...(draggable ? { touchAction: 'none' } : {}),
    ...(draggable && transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 999 } : {}),
  };

  let colorClass = 'bg-white border-gray-200 hover:border-gray-300';
  if (wrongSemesterType) colorClass = 'bg-red-50 border-red-200 hover:border-red-300';
  else if (effectiveIsCompleted) colorClass = 'bg-green-50 border-green-300';
  else if (hasPrereqWarning) colorClass = 'bg-orange-50 border-orange-300';
  else if (isMandatory) colorClass = 'bg-blue-50 border-blue-200 hover:border-blue-300';

  const namedGroups = missingPrereqGroups.filter((group) =>
    group.every((id) => courses.get(id)?.name !== undefined)
  );
  const candidateGroups = namedGroups.length > 0 ? namedGroups : missingPrereqGroups;
  const bestGroup = missingPrereqGroups.length > 0
    ? candidateGroups.reduce((min, group) => group.length < min.length ? group : min, candidateGroups[0])
    : [];
  const displayedNames = bestGroup.slice(0, 2).map((id) => courses.get(id)?.name ?? id);
  const hasMoreInGroup = bestGroup.length > 2;

  const facultyStyle = course.faculty
    ? getFacultyStyle(course.faculty, course.id, facultyColorOverrides)
    : null;
  const seasonBadge = getTeachingSemesterBadge(course.teachingSemester);

  return (
    <>
      <div
        ref={draggable ? setNodeRef : undefined}
        style={style}
        {...(draggable ? listeners : {})}
        {...(draggable ? attributes : {})}
        onClick={() => {
          if (draggable) setModalOpen(true);
        }}
        className={`
          ${colorClass} border rounded-lg p-2.5 relative
          ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} select-none
          ${isDragging ? 'opacity-50 shadow-2xl scale-105' : draggable ? 'hover:shadow-sm active:scale-95' : ''}
          ${isPlanned && !isDragging ? 'opacity-60' : ''}
          transition-all duration-100
        `}
      >
        {showCardActions && (
          <div className="absolute top-0 left-0 z-10 flex items-center">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(course.id);
            }}
            className={`w-11 h-11 flex items-center justify-center text-sm leading-none ${isFavorite ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
            title={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          >
            {isFavorite ? '★' : '☆'}
          </button>
          {semester !== undefined && (
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                removeCourseFromSemester(course.id, semester, instanceKey);
              }}
              className="w-11 h-11 flex items-center justify-center text-xl leading-none font-semibold text-gray-300 hover:text-red-500 transition-colors"
              title={semester === 0 ? 'הסר מהתכנית' : 'הסר מהסמסטר'}
              aria-label={semester === 0 ? 'הסר מהתכנית' : 'הסר מהסמסטר'}
            >
              ×
            </button>
          )}
          </div>
        )}

        {showCardActions && semester !== undefined && (
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isRepeatable && instanceKey) {
                toggleCompletedInstance(instanceKey);
              } else {
                toggleCompleted(course.id);
              }
            }}
            className={`absolute top-0 right-0 w-11 h-11 flex items-center justify-center text-sm leading-none font-bold ${effectiveIsCompleted ? 'text-green-600' : 'text-gray-300 hover:text-green-500'}`}
            title={effectiveIsCompleted ? 'סמן כלא הושלם' : 'סמן כהושלם'}
          >
            {effectiveIsCompleted ? '✓' : '○'}
          </button>
        )}

        <p className={`text-xs font-medium text-gray-900 leading-snug pt-0.5 ${showCardActions ? 'pr-11 pl-[5.5rem]' : ''}`}>{course.name}</p>

        {wrongSemesterType && (
          <p className="text-xs text-red-500 mt-0.5 px-4 leading-tight">
            {course.teachingSemester === 'winter' ? '❄️ קורס חורף בלבד' : '🌸 קורס אביב בלבד'}
          </p>
        )}

        {missingPrereqGroups.length > 0 && bestGroup.length > 0 && (
          <div className="mt-1 px-4 space-y-0.5">
            {displayedNames.map((name, index) => (
              <p key={index} className="text-xs text-orange-500 leading-tight">נותר: {name}</p>
            ))}
            {hasMoreInGroup && <p className="text-xs text-orange-400 leading-tight">...</p>}
          </div>
        )}

        <div className="flex items-center justify-between mt-1.5 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs text-gray-400 shrink-0">{course.id}</span>
            {facultyStyle && (
              <span
                className={`inline-block w-2 h-2 rounded-full shrink-0 ${facultyStyle.dot}`}
                title={course.faculty}
              />
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {seasonBadge && (
              <span className="text-xs leading-none" title={seasonBadge.title}>
                {seasonBadge.emoji}
              </span>
            )}
            {showsEnglishBadge && (
              <span className="text-xs bg-sky-50 text-sky-600 px-1 py-0.5 rounded font-semibold leading-none" title="קורס באנגלית">
                EN
              </span>
            )}
            {showsFreeElectiveBadge && (
              <span className="text-xs bg-amber-50 text-amber-700 px-1 py-0.5 rounded font-semibold leading-none" title="בחירה חופשית">
                ב"ח
              </span>
            )}
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
            <span className="text-xs font-bold text-gray-600">{course.credits} נק"ז</span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <Suspense
          fallback={(
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        >
          <LazyCourseDetailModal
            course={course}
            courses={courses}
            semester={semester}
            instanceKey={instanceKey}
            onClose={() => setModalOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
});

CourseCard.displayName = 'CourseCard';
