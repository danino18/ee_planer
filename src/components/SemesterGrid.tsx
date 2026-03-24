import { useMemo, useState } from 'react';
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
import { getFacultyStyle, getFacultyShortName } from '../utils/faculty';

interface Props {
  courses: Map<string, SapCourse>;
  trackDef: TrackDefinition;
}

export function SemesterGrid({ courses, trackDef }: Props) {
  const {
    semesters, moveCourse, completedCourses, maxSemester,
    addSemester, removeSemester, summerSemesters, currentSemester,
    setCurrentSemester, addSummerSemester, removeSummerSemester,
    semesterOrder, moveSemesterInOrder,
  } = usePlanStore();
  const prereqStatus = usePrerequisiteStatus(courses, trackDef);
  const mandatoryIds = new Set(trackDef.semesterSchedule.flatMap((s) => s.courses));
  const completedSet = new Set(completedCourses);
  const [activeId, setActiveId] = useState<string | null>(null);  // may be instanceKey
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null); // base course ID
  const [activeSemFrom, setActiveSemFrom] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'grid' | 'rows'>('grid');
  const [showSummerSemesters, setShowSummerSemesters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [gridCols, setGridCols] = useState<3 | 4 | 5>(4);

  // Compute unique faculties from placed courses for legend
  const placedFaculties = useMemo(() => {
    const seen = new Map<string, string>(); // faculty → dot class
    for (const ids of Object.values(semesters)) {
      for (const id of ids) {
        const f = courses.get(id)?.faculty;
        if (f && !seen.has(f)) seen.set(f, getFacultyStyle(f).dot);
      }
    }
    return [...seen.entries()].map(([faculty, dot]) => ({ faculty, dot }));
  }, [semesters, courses]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Effective completed: explicit completedCourses + all courses in semesters before currentSemester
  const effectiveCompleted = new Set<string>(completedCourses);
  if (currentSemester !== null) {
    for (let s = 1; s < currentSemester; s++) {
      for (const id of semesters[s] ?? []) effectiveCompleted.add(id);
    }
  }

  function parseInstanceKey(rawId: string): { courseId: string; semFrom: number } {
    // instanceKey format: `${courseId}__${semester}__${idx}`
    const parts = rawId.split('__');
    return {
      courseId: parts[0],
      semFrom: parts.length >= 2 ? parseInt(parts[1], 10) : 0,
    };
  }

  function handleDragStart(event: DragStartEvent) {
    const rawId = String(event.active.id);
    setActiveId(rawId);
    const { courseId, semFrom } = parseInstanceKey(rawId);
    setActiveCourseId(courseId);
    setActiveSemFrom(semFrom);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const { courseId, semFrom } = parseInstanceKey(String(active.id));
    const target = String(over.id);
    if (!target.startsWith('semester-')) return;
    const toSem = parseInt(target.replace('semester-', ''), 10);
    if (semFrom !== toSem) moveCourse(courseId, semFrom, toSem);
  }

  // Migrate: use semesterOrder if available, else fall back to range
  const displayOrder = semesterOrder?.length
    ? semesterOrder
    : Array.from({ length: maxSemester }, (_, i) => i + 1);

  // Compute semester type: among non-summer semesters, 0-indexed even = winter, odd = spring
  const nonSummerOrder = displayOrder.filter((s) => !summerSemesters.includes(s));
  const getSemesterType = (sem: number): 'winter' | 'spring' | 'summer' => {
    if (summerSemesters.includes(sem)) return 'summer';
    const pos = nonSummerOrder.indexOf(sem);
    return pos % 2 === 0 ? 'winter' : 'spring';
  };

  const semColProps = (sem: number) => {
    const posInOrder = displayOrder.indexOf(sem);
    return {
      semester: sem,
      courseIds: semesters[sem] ?? [],
      courses,
      mandatoryCourseIds: mandatoryIds,
      prereqStatus,
      completedCourses: completedSet,
      effectiveCompleted,
      isSummer: summerSemesters.includes(sem),
      isCurrent: currentSemester === sem,
      isPast: currentSemester !== null && sem < currentSemester,
      isFuture: currentSemester !== null && sem > currentSemester,
      onSetCurrentSemester: setCurrentSemester,
      summerIndex: summerSemesters.includes(sem) ? summerSemesters.indexOf(sem) + 1 : undefined,
      isRowMode: viewMode === 'rows',
      canMoveLeft: summerSemesters.includes(sem) && posInOrder > 0,
      canMoveRight: summerSemesters.includes(sem) && posInOrder < displayOrder.length - 1,
      onMoveLeft: () => moveSemesterInOrder(sem, 'right'),
      onMoveRight: () => moveSemesterInOrder(sem, 'left'),
      semesterType: getSemesterType(sem),
    };
  };

  // Build semester list, filtering out summer semesters when hidden
  const semesterList = displayOrder
    .filter((s) => showSummerSemesters || !summerSemesters.includes(s));

  // Build rows based on view mode
  const rows: number[][] = [];
  if (viewMode === 'grid') {
    for (let i = 0; i < semesterList.length; i += gridCols) {
      rows.push(semesterList.slice(i, i + gridCols));
    }
  } else {
    for (const s of semesterList) {
      rows.push([s]);
    }
  }

  const activeCourse = activeCourseId ? courses.get(activeCourseId) : null;
  const hasSummers = summerSemesters.length > 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button
          onClick={() => setViewMode(viewMode === 'grid' ? 'rows' : 'grid')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          title={viewMode === 'grid' ? 'עבור לתצוגת שורות' : 'עבור לתצוגת גריד'}
        >
          <span>{viewMode === 'grid' ? '☰' : '⊞'}</span>
          <span>{viewMode === 'grid' ? 'תצוגת שורות' : 'תצוגת גריד'}</span>
        </button>

        <button
          onClick={() => setShowSummerSemesters(!showSummerSemesters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
            showSummerSemesters
              ? 'border-amber-400 bg-amber-50 text-amber-700'
              : 'border-gray-300 text-gray-500 hover:bg-gray-100'
          }`}
          title={showSummerSemesters ? 'הסתר סמסטרי קיץ' : 'הצג סמסטרי קיץ'}
        >
          <span>☀️</span>
          <span>{showSummerSemesters ? 'הסתר קיץ' : 'הצג קיץ'}</span>
        </button>

        {viewMode === 'grid' && (
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden text-sm text-gray-600">
            <button
              onClick={() => setGridCols(gridCols > 3 ? (gridCols - 1) as 3 | 4 | 5 : 3)}
              disabled={gridCols <= 3}
              className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              title="הצג יותר עמודות (קטן יותר)"
            >−</button>
            <span className="px-1 py-1.5 text-xs border-x border-gray-200 select-none">{gridCols}</span>
            <button
              onClick={() => setGridCols(gridCols < 5 ? (gridCols + 1) as 3 | 4 | 5 : 5)}
              disabled={gridCols >= 5}
              className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              title="הצג פחות עמודות (גדול יותר)"
            >+</button>
          </div>
        )}

        {placedFaculties.length > 0 && (
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
              showLegend
                ? 'border-gray-400 bg-gray-100 text-gray-700'
                : 'border-gray-300 text-gray-500 hover:bg-gray-100'
            }`}
            title="מקרא פקולטות"
          >
            <span className="flex gap-0.5">
              {placedFaculties.slice(0, 3).map(({ faculty, dot }) => (
                <span key={faculty} className={`w-2 h-2 rounded-full inline-block ${dot}`} />
              ))}
            </span>
            <span>מקרא</span>
          </button>
        )}
      </div>

      {/* Faculty legend */}
      {showLegend && placedFaculties.length > 0 && (
        <div className="mb-3 p-2.5 bg-white border border-gray-200 rounded-xl flex flex-wrap gap-x-4 gap-y-1.5">
          {placedFaculties.map(({ faculty }) => {
            const s = getFacultyStyle(faculty);
            return (
              <div key={faculty} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                <span className="text-xs text-gray-600">{getFacultyShortName(faculty)}</span>
              </div>
            );
          })}
        </div>
      )}

      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={viewMode === 'grid'
            ? `grid gap-3 mb-3 ${gridCols === 3 ? 'grid-cols-3' : gridCols === 5 ? 'grid-cols-5' : 'grid-cols-4'}`
            : 'flex flex-col gap-3 mb-3'}
        >
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
              className="flex flex-col items-center justify-center gap-1 px-5 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors min-h-14 text-sm font-medium"
            >
              <span className="text-xl leading-none">+</span>
              <span>הוסף סמסטר</span>
            </button>
          )}
          {maxSemester > 1 && (
            <button
              onClick={removeSemester}
              className="flex flex-col items-center justify-center gap-1 px-5 border-2 border-dashed border-red-200 rounded-xl text-red-300 hover:border-red-400 hover:text-red-500 transition-colors min-h-14 text-sm font-medium"
            >
              <span className="text-xl leading-none">−</span>
              <span>הסר סמסטר</span>
            </button>
          )}
          {maxSemester < 16 && (
            <button
              onClick={addSummerSemester}
              className="flex flex-col items-center justify-center gap-1 px-5 border-2 border-dashed border-amber-300 rounded-xl text-amber-400 hover:border-amber-500 hover:text-amber-600 transition-colors min-h-14 text-sm font-medium"
            >
              <span className="text-lg leading-none">☀️</span>
              <span>הוסף קיץ</span>
            </button>
          )}
          {hasSummers && (
            <button
              onClick={removeSummerSemester}
              className="flex flex-col items-center justify-center gap-1 px-5 border-2 border-dashed border-orange-200 rounded-xl text-orange-300 hover:border-orange-400 hover:text-orange-500 transition-colors min-h-14 text-sm font-medium"
            >
              <span className="text-lg leading-none">🌤️</span>
              <span>הסר קיץ</span>
            </button>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCourse && activeCourseId && (
          <div className="rotate-2 scale-105 shadow-2xl">
            <CourseCard
              course={activeCourse}
              courses={courses}
              isMandatory={mandatoryIds.has(activeCourseId)}
              isCompleted={completedSet.has(activeCourseId)}
              missingPrereqGroups={prereqStatus.get(activeCourseId) ?? []}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
