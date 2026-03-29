import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { SemesterColumn } from './SemesterColumn';
import { CourseCard } from './CourseCard';
import type { SapCourse, TrackDefinition, SpecializationGroup } from '../types';
import { usePlanStore, REPEATABLE_COURSES } from '../store/planStore';
import { usePrerequisiteStatus } from '../hooks/usePlan';
import { getFacultyStyle, getFacultyShortName } from '../utils/faculty';

function computeSemesterAverage(
  courseIds: string[],
  grades: Record<string, number>,
  courses: Map<string, SapCourse>,
  binaryPass: Record<string, boolean>
): number | null {
  let weightedSum = 0;
  let totalCredits = 0;
  for (const id of courseIds) {
    if (binaryPass[id]) continue; // binary pass courses excluded from weighted average
    const grade = grades[id];
    const credits = courses.get(id)?.credits ?? 0;
    if (grade !== undefined && credits > 0) {
      weightedSum += grade * credits;
      totalCredits += credits;
    }
  }
  return totalCredits > 0 ? weightedSum / totalCredits : null;
}

interface Props {
  courses: Map<string, SapCourse>;
  trackDef: TrackDefinition;
  specializations?: SpecializationGroup[];
}

export function SemesterGrid({ courses, trackDef, specializations }: Props) {
  const {
    semesters, moveCourse, addCourseToSemester, completedCourses, maxSemester,
    addSemester, removeSemester, summerSemesters, currentSemester,
    setCurrentSemester, addSummerSemester, removeSummerSemester,
    semesterOrder, reorderSemesters,
    semesterTypeOverrides, semesterWarningsIgnored, setSemesterType, toggleSemesterWarnings,
    grades, binaryPass, selectedSpecializations,
  } = usePlanStore();
  const prereqStatus = usePrerequisiteStatus(courses, trackDef);
  const mandatoryIds = new Set(trackDef.semesterSchedule.flatMap((s) => s.courses));
  const completedSet = new Set(completedCourses);

  // Map courseId → chain name for selected specializations
  const courseChainMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!specializations) return map;
    for (const group of specializations) {
      if (!selectedSpecializations.includes(group.id)) continue;
      const shortName = group.name.length > 10 ? group.name.slice(0, 10) + '…' : group.name;
      for (const id of [...group.mandatoryCourses, ...group.electiveCourses]) {
        if (!map.has(id)) map.set(id, shortName);
      }
    }
    return map;
  }, [specializations, selectedSpecializations]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'rows'>('grid');
  const [showSummerSemesters, setShowSummerSemesters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [gridCols, setGridCols] = useState<3 | 4 | 5 | 6 | 7 | 8>(4);

  // Compute unique faculties from placed courses for legend
  const placedFaculties = useMemo(() => {
    const seen = new Map<string, string>(); // faculty → dot class
    for (const ids of Object.values(semesters)) {
      for (const id of ids) {
        const f = courses.get(id)?.faculty;
        if (f && !seen.has(f)) seen.set(f, getFacultyStyle(f, id).dot);
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
    const activeId = String(event.active.id);
    if (activeId.startsWith('col-')) return; // column drag — no course overlay
    const { courseId } = parseInstanceKey(activeId);
    setActiveCourseId(courseId);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCourseId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Semester column reordering
    if (activeId.startsWith('col-') && overId.startsWith('col-')) {
      const fromSem = parseInt(activeId.replace('col-', ''), 10);
      const toSem = parseInt(overId.replace('col-', ''), 10);
      if (fromSem !== toSem) {
        const fromIdx = displayOrder.indexOf(fromSem);
        const toIdx = displayOrder.indexOf(toSem);
        reorderSemesters(arrayMove([...displayOrder], fromIdx, toIdx));
      }
      return;
    }

    // Course card dragging
    const { courseId, semFrom } = parseInstanceKey(activeId);
    if (!overId.startsWith('semester-')) return;
    const toSem = parseInt(overId.replace('semester-', ''), 10);
    if (semFrom === toSem) return;
    // Repeatable courses dragged from unassigned stay in unassigned (copy, not move)
    if (REPEATABLE_COURSES.has(courseId) && semFrom === 0) {
      addCourseToSemester(courseId, toSem);
    } else {
      moveCourse(courseId, semFrom, toSem);
    }
  }

  // Migrate: use semesterOrder if available, else fall back to range
  const displayOrder = semesterOrder?.length
    ? semesterOrder
    : Array.from({ length: maxSemester }, (_, i) => i + 1);

  // Compute semester type: check manual overrides first, then even/odd position
  const nonSummerOrder = displayOrder.filter((s) => !summerSemesters.includes(s));
  const getSemesterType = (sem: number): 'winter' | 'spring' | 'summer' => {
    if (summerSemesters.includes(sem)) return 'summer';
    if (semesterTypeOverrides?.[sem]) return semesterTypeOverrides[sem];
    const pos = nonSummerOrder.indexOf(sem);
    return pos % 2 === 0 ? 'winter' : 'spring';
  };

  const semColProps = (sem: number) => {
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
      semesterType: getSemesterType(sem),
      onSetSemesterType: (type: 'winter' | 'spring') => setSemesterType(sem, type),
      warningsIgnored: !!(semesterWarningsIgnored ?? []).includes(sem),
      onToggleWarnings: () => toggleSemesterWarnings(sem),
      semesterAverage: sem > 0 ? computeSemesterAverage(semesters[sem] ?? [], grades, courses, binaryPass ?? {}) : null,
      courseChainMap,
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
              onClick={() => setGridCols(gridCols > 3 ? (gridCols - 1) as 3 | 4 | 5 | 6 | 7 | 8 : 3)}
              disabled={gridCols <= 3}
              className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              title="הצג יותר עמודות (קטן יותר)"
            >−</button>
            <span className="px-1 py-1.5 text-xs border-x border-gray-200 select-none">{gridCols}</span>
            <button
              onClick={() => setGridCols(gridCols < 8 ? (gridCols + 1) as 3 | 4 | 5 | 6 | 7 | 8 : 8)}
              disabled={gridCols >= 8}
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
          {placedFaculties.map(({ faculty, dot }) => (
            <div key={faculty} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
              <span className="text-xs text-gray-600">{getFacultyShortName(faculty)}</span>
            </div>
          ))}
        </div>
      )}

      <SortableContext items={semesterList.map(s => `col-${s}`)} strategy={rectSortingStrategy}>
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className={viewMode === 'grid'
              ? `grid gap-3 mb-3 ${{3:'grid-cols-3',4:'grid-cols-4',5:'grid-cols-5',6:'grid-cols-6',7:'grid-cols-7',8:'grid-cols-8'}[gridCols] ?? 'grid-cols-4'}`
              : 'flex flex-col gap-3 mb-3'}
          >
            {row.map((s) => <SemesterColumn key={s} {...semColProps(s)} />)}
          </div>
        ))}
      </SortableContext>

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
