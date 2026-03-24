import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { CourseCard } from './CourseCard';
import type { SapCourse } from '../types';

const SEM_LABELS = [
  'לא משובץ',
  'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳',
  'ח׳', 'ט׳', 'י׳', 'יא׳', 'יב׳', 'יג׳', 'יד׳', 'טו׳', 'טז׳',
];

interface Props {
  semester: number;
  courseIds: string[];
  courses: Map<string, SapCourse>;
  mandatoryCourseIds: Set<string>;
  prereqStatus: Map<string, string[][]>;
  completedCourses: Set<string>;
  effectiveCompleted: Set<string>;
  isSummer: boolean;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  onSetCurrentSemester: (n: number | null) => void;
  summerIndex?: number;
  isRowMode?: boolean;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  semesterType?: 'winter' | 'spring' | 'summer';
}

function getColumnStyle(isOver: boolean, isSummer: boolean, isCurrent: boolean, isPast: boolean, isFuture: boolean): string {
  if (isOver)    return 'border-blue-400 bg-blue-50/50';
  if (isSummer)  return 'border-amber-300 bg-amber-50/40';
  if (isCurrent) return 'border-blue-500 bg-blue-50/30';
  if (isPast)    return 'border-green-300 bg-green-50/30';
  if (isFuture)  return 'border-gray-200 bg-gray-50/20 opacity-80';
  return 'border-gray-200 bg-gray-50/50';
}

export function SemesterColumn({
  semester, courseIds, courses, mandatoryCourseIds, prereqStatus,
  completedCourses, effectiveCompleted, isSummer, isCurrent, isPast, isFuture, onSetCurrentSemester,
  summerIndex, isRowMode, canMoveLeft, canMoveRight, onMoveLeft, onMoveRight, semesterType,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `semester-${semester}` });
  const [search, setSearch] = useState('');

  const totalCredits = courseIds.reduce((s, id) => s + (courses.get(id)?.credits ?? 0), 0);
  const columnStyle = getColumnStyle(isOver, isSummer, isCurrent, isPast, isFuture);

  const semesterLabel = semester === 0
    ? 'לא משובץ'
    : isSummer
      ? `קיץ ${SEM_LABELS[summerIndex ?? semester]}`
      : `סמסטר ${SEM_LABELS[semester]}`;

  // Filter for search in the unassigned column
  const filteredIds = (semester === 0 && search.trim())
    ? courseIds.filter((id) => {
        const c = courses.get(id);
        const q = search.trim();
        return c?.name.includes(q) || id.includes(q);
      })
    : courseIds;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border-2 min-h-40 transition-colors ${columnStyle}`}
    >
      <div className={`px-3 py-2 rounded-t-xl border-b border-gray-200 ${isSummer ? 'bg-amber-50' : 'bg-white'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isSummer && <span className="text-sm">☀️</span>}
            <span className="font-semibold text-gray-800 text-sm">{semesterLabel}</span>
            {isCurrent && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                נוכחי
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {semester > 0 && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {totalCredits.toFixed(1)} נ״ז
              </span>
            )}
            {isSummer && canMoveRight && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onMoveRight?.(); }}
                className="text-xs text-gray-400 hover:text-amber-600 transition-colors leading-none px-0.5"
                title="הזז ימינה"
              >◀</button>
            )}
            {isSummer && canMoveLeft && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onMoveLeft?.(); }}
                className="text-xs text-gray-400 hover:text-amber-600 transition-colors leading-none px-0.5"
                title="הזז שמאלה"
              >▶</button>
            )}
            {semester > 0 && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetCurrentSemester(isCurrent ? null : semester);
                }}
                className={`text-base leading-none transition-colors ${isCurrent ? 'text-blue-500' : 'text-gray-300 hover:text-blue-400'}`}
                title={isCurrent ? 'בטל סמסטר נוכחי' : 'הגדר כסמסטר נוכחי'}
              >
                📍
              </button>
            )}
          </div>
        </div>

        {/* Search input for unassigned column */}
        {semester === 0 && (
          <div className="mt-1.5 relative">
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש קורס..."
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full text-xs pr-6 pl-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-300"
            />
          </div>
        )}
      </div>

      <div className={`gap-1.5 p-2 flex-1 ${isRowMode ? 'grid grid-cols-3' : 'flex flex-col'}`}>
        {filteredIds.map((id, idx) => {
          const course = courses.get(id);
          if (!course) return null;
          const missingPrereqGroups = prereqStatus.get(id) ?? [];
          const wrongSemesterType = !!(
            semesterType && semesterType !== 'summer' && course.teachingSemester
            && course.teachingSemester !== semesterType
          );
          return (
            <CourseCard
              key={`${id}_${idx}`}
              course={course}
              courses={courses}
              isMandatory={mandatoryCourseIds.has(id)}
              hasPrereqWarning={missingPrereqGroups.length > 0}
              missingPrereqGroups={missingPrereqGroups}
              isCompleted={effectiveCompleted.has(id)}
              isPlanned={isFuture && !completedCourses.has(id)}
              semester={semester}
              instanceKey={`${id}__${semester}__${idx}`}
              wrongSemesterType={wrongSemesterType}
            />
          );
        })}
        {filteredIds.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6 italic">
            {semester === 0
              ? (search.trim() ? 'אין קורסים תואמים' : 'כל הקורסים משובצים')
              : 'גרור קורסים לכאן'}
          </p>
        )}
      </div>
    </div>
  );
}
