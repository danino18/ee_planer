import { memo, useDeferredValue, useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  semesterType?: 'winter' | 'spring' | 'summer';
  onSetSemesterType?: (type: 'winter' | 'spring') => void;
  warningsIgnored?: boolean;
  onToggleWarnings?: () => void;
  semesterAverage?: number | null;
  courseChainMap?: Map<string, string>;
  isDragging?: boolean;
  ruleWarnings?: ('melag' | 'sport')[];
  mutualExclusionWarnings?: string[];
}

function getColumnStyle(isOver: boolean, isDragging: boolean, isSummer: boolean, isCurrent: boolean, isPast: boolean, isFuture: boolean): string {
  if (isOver)     return 'border-blue-500 bg-blue-100/70 ring-2 ring-blue-400 ring-offset-1';
  if (isDragging) return isSummer ? 'border-amber-400 border-dashed bg-amber-50/60' : 'border-blue-300 border-dashed bg-blue-50/20';
  if (isSummer)   return 'border-amber-300 bg-amber-50/40';
  if (isCurrent)  return 'border-blue-500 bg-blue-50/30';
  if (isPast)     return 'border-green-300 bg-green-50/30';
  if (isFuture)   return 'border-gray-200 bg-gray-50/20 opacity-80';
  return 'border-gray-200 bg-gray-50/50';
}

export const SemesterColumn = memo(function SemesterColumn({
  semester, courseIds, courses, mandatoryCourseIds, prereqStatus,
  completedCourses, effectiveCompleted, isSummer, isCurrent, isPast, isFuture, onSetCurrentSemester,
  summerIndex, isRowMode,
  semesterType, onSetSemesterType, warningsIgnored, onToggleWarnings, semesterAverage, courseChainMap, isDragging: isDraggingActive,
  ruleWarnings = [],
  mutualExclusionWarnings = [],
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `semester-${semester}` });
  const {
    attributes, listeners,
    setNodeRef: setSortableRef,
    transform, transition, isDragging,
  } = useSortable({ id: `col-${semester}` });
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const totalCredits = courseIds.reduce((s, id) => s + (courses.get(id)?.credits ?? 0), 0);
  const columnStyle = getColumnStyle(isOver, !!(isDraggingActive && semester > 0), isSummer, isCurrent, isPast, isFuture);

  const semesterLabel = semester === 0
    ? 'לא משובץ'
    : isSummer
      ? `קיץ ${SEM_LABELS[summerIndex ?? semester]}`
      : `סמסטר ${SEM_LABELS[semester]}`;

  // Filter for search in the unassigned column
  const filteredIds = useMemo(() => {
    const trimmedSearch = deferredSearch.trim();
    if (semester !== 0 || !trimmedSearch) {
      return courseIds;
    }

    const normalizedSearch = trimmedSearch.toLowerCase();
    return courseIds.filter((id) => {
      const course = courses.get(id);
      return id.includes(trimmedSearch) || course?.name.toLowerCase().includes(normalizedSearch);
    });
  }, [semester, deferredSearch, courseIds, courses]);

  const sortableStyle = semester > 0 ? {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  } : undefined;

  return (
    <div
      ref={semester > 0 ? setSortableRef : undefined}
      style={sortableStyle}
      className={`flex flex-col rounded-xl border-2 min-h-40 transition-colors ${columnStyle}`}
    >
      <div className={`px-3 py-2 rounded-t-xl border-b border-gray-200 ${isSummer ? 'bg-amber-50' : 'bg-white'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Drag handle for reordering */}
            {semester > 0 && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 text-base select-none leading-none"
                title="גרור לשינוי סדר"
              >⠿</div>
            )}
            {isSummer && <span className="text-sm">☀️</span>}
            {!isSummer && semester > 0 && semesterType && semesterType !== 'summer' && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onSetSemesterType?.(semesterType === 'winter' ? 'spring' : 'winter'); }}
                className="text-sm leading-none opacity-60 hover:opacity-100 transition-opacity"
                title={semesterType === 'winter' ? 'לחץ לשנות לאביב' : 'לחץ לשנות לחורף'}
              >
                {semesterType === 'winter' ? '❄️' : '🌸'}
              </button>
            )}
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
            {semester > 0 && semesterAverage !== null && semesterAverage !== undefined && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full" title="ממוצע סמסטר משוקלל">
                ∅ {semesterAverage.toFixed(1)}
              </span>
            )}
            {isSummer && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleWarnings?.(); }}
                className={`text-xs px-1 py-0.5 rounded border transition-colors ${warningsIgnored ? 'text-gray-300 border-gray-200 hover:text-amber-400' : 'text-amber-500 border-amber-200 bg-amber-50 hover:bg-amber-100'}`}
                title={warningsIgnored ? 'הצג אזהרות עונה' : 'התעלם מאזהרות עונה'}
              >⚠️</button>
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

      {/* Technion rule warnings */}
      {ruleWarnings.length > 0 && semester > 0 && (
        <div className="px-2 pb-1 space-y-1">
          {ruleWarnings.includes('melag') && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              ⚠️ בטכניון ניתן לקחת עד 2 מל&quot;גים בסמסטר אחד
            </p>
          )}
          {ruleWarnings.includes('sport') && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              ⚠️ בטכניון ניתן לקחת קורס ספורט אחד בסמסטר
            </p>
          )}
        </div>
      )}

      {mutualExclusionWarnings.length > 0 && semester > 0 && (
        <div className="px-2 pb-1 space-y-1">
          {mutualExclusionWarnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              {warning}
            </p>
          ))}
        </div>
      )}

      <div ref={setNodeRef} className={`gap-1.5 p-2 flex-1 ${isRowMode ? 'grid grid-cols-3' : 'flex flex-col'}`}>
        {filteredIds.map((id, idx) => {
          const course = courses.get(id);
          if (!course) return null;
          const missingPrereqGroups = prereqStatus.get(id) ?? [];
          const wrongSemesterType = !!(
            semesterType
            && course.teachingSemester
            && !warningsIgnored
            && (semesterType === 'summer' || course.teachingSemester !== semesterType)
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
              chainName={courseChainMap?.get(id)}
            />
          );
        })}
        {filteredIds.length === 0 && !isOver && (
          <p className="text-xs text-gray-400 text-center py-6 italic">
            {semester === 0
              ? (search.trim() ? 'אין קורסים תואמים' : 'כל הקורסים משובצים')
              : isDraggingActive ? '' : 'גרור קורסים לכאן'}
          </p>
        )}
        {isDraggingActive && isOver && (
          <div className="mt-1 mb-1 flex items-center justify-center gap-1.5 text-blue-600 text-xs font-semibold py-2 bg-blue-100 rounded-lg border-2 border-blue-400 border-dashed">
            <span>📥</span>
            <span>שחרר כאן</span>
          </div>
        )}
        {isDraggingActive && !isOver && semester > 0 && filteredIds.length === 0 && (
          <p className="text-xs text-blue-400 text-center py-6 italic">גרור לכאן</p>
        )}
      </div>
    </div>
  );
});

SemesterColumn.displayName = 'SemesterColumn';
