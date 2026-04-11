import { memo, useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { useShallow } from 'zustand/react/shallow';
import { SemesterColumn } from './SemesterColumn';
import { CourseCard } from './CourseCard';
import type { SapCourse, TrackDefinition, SpecializationGroup } from '../types';
import { usePlanStore, REPEATABLE_COURSES, gradeKey, MAX_SEMESTERS } from '../store/planStore';
import { usePrerequisiteStatus } from '../hooks/usePlan';
import { getFacultyStyle, getFacultyShortName, COLOR_OPTIONS } from '../utils/faculty';
import { isFreeElectiveCourseId, isSportCourseId } from '../data/generalRequirements/courseClassification';

function computeSemesterAverage(
  courseIds: string[],
  grades: Record<string, number>,
  courses: Map<string, SapCourse>,
  binaryPass: Record<string, boolean>,
  semester?: number
): number | null {
  let weightedSum = 0;
  let totalCredits = 0;
  for (const id of courseIds) {
    if (binaryPass[id]) continue; // binary pass courses excluded from weighted average
    const key = gradeKey(id, semester);
    const grade = grades[key];
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

export const SemesterGrid = memo(function SemesterGrid({ courses, trackDef, specializations }: Props) {
  const {
    semesters, moveCourse, addCourseToSemester, completedCourses, maxSemester,
    addSemester, removeSemester, summerSemesters, currentSemester,
    setCurrentSemester, addSummerSemester, removeSummerSemester,
    semesterOrder, reorderSemesters,
    semesterTypeOverrides, semesterWarningsIgnored, setSemesterType, toggleSemesterWarnings,
    grades, binaryPass, selectedSpecializations, facultyColorOverrides, setFacultyColorOverride,
  } = usePlanStore(useShallow((state) => ({
    semesters: state.semesters,
    moveCourse: state.moveCourse,
    addCourseToSemester: state.addCourseToSemester,
    completedCourses: state.completedCourses,
    maxSemester: state.maxSemester,
    addSemester: state.addSemester,
    removeSemester: state.removeSemester,
    summerSemesters: state.summerSemesters,
    currentSemester: state.currentSemester,
    setCurrentSemester: state.setCurrentSemester,
    addSummerSemester: state.addSummerSemester,
    removeSummerSemester: state.removeSummerSemester,
    semesterOrder: state.semesterOrder,
    reorderSemesters: state.reorderSemesters,
    semesterTypeOverrides: state.semesterTypeOverrides,
    semesterWarningsIgnored: state.semesterWarningsIgnored,
    setSemesterType: state.setSemesterType,
    toggleSemesterWarnings: state.toggleSemesterWarnings,
    grades: state.grades,
    binaryPass: state.binaryPass,
    selectedSpecializations: state.selectedSpecializations,
    facultyColorOverrides: state.facultyColorOverrides,
    setFacultyColorOverride: state.setFacultyColorOverride,
  })));
  const prereqStatus = usePrerequisiteStatus(courses, trackDef);

  // Mandatory lab IDs: first `required` placed lab pool courses in semester order
  const mandatoryLabIds = useMemo(() => {
    const result = new Set<string>();
    if (!trackDef.labPool?.mandatory || trackDef.labPool.required <= 0) return result;
    const labSet = new Set(trackDef.labPool.courses);
    const required = trackDef.labPool.required;
    for (const sem of (semesterOrder?.length ? semesterOrder : [])) {
      for (const id of semesters[sem] ?? []) {
        if (labSet.has(id) && !result.has(id)) {
          result.add(id);
          if (result.size >= required) return result;
        }
      }
    }
    return result;
  }, [trackDef, semesters, semesterOrder]);

  const mandatoryIds = useMemo(() => new Set([
    ...trackDef.semesterSchedule.flatMap((s) => s.courses),
    ...mandatoryLabIds,
  ]), [trackDef.semesterSchedule, mandatoryLabIds]);
  const completedSet = useMemo(() => new Set(completedCourses), [completedCourses]);

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
  const [showLegend, setShowLegend] = useState(false);
  const [gridCols, setGridCols] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(4);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

  // Compute unique faculties from placed courses for legend
  const placedFaculties = useMemo(() => {
    const seen = new Map<string, string>(); // faculty → first courseId (for prefix lookup)
    for (const ids of Object.values(semesters)) {
      for (const id of ids) {
        const f = courses.get(id)?.faculty;
        if (f && !seen.has(f)) seen.set(f, id);
      }
    }
    return [...seen.entries()].map(([faculty, firstId]) => ({
      faculty,
      dot: getFacultyStyle(faculty, firstId, facultyColorOverrides ?? {}).dot,
    }));
  }, [semesters, courses, facultyColorOverrides]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  // Effective completed: explicit completedCourses + all courses in semesters before currentSemester
  const effectiveCompleted = useMemo(() => {
    const completed = new Set<string>(completedCourses);
    if (currentSemester !== null) {
      for (let s = 1; s < currentSemester; s++) {
        for (const id of semesters[s] ?? []) completed.add(id);
      }
    }
    return completed;
  }, [completedCourses, currentSemester, semesters]);

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

  // Per-semester Technion rule warnings
  const semesterRuleWarnings = useMemo(() => {
    const warnings: Record<number, ('melag' | 'sport')[]> = {};
    for (const [semStr, ids] of Object.entries(semesters)) {
      const sem = Number(semStr);
      if (sem === 0) continue; // skip unassigned pool
      const w: ('melag' | 'sport')[] = [];
      const melagCount = ids.filter((id) => isFreeElectiveCourseId(id)).length;
      const sportCount = ids.filter((id) => isSportCourseId(id)).length;
      if (melagCount > 2) w.push('melag');
      if (sportCount > 1) w.push('sport');
      if (w.length > 0) warnings[sem] = w;
    }
    return warnings;
  }, [semesters]);

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
      semesterAverage: sem > 0 ? computeSemesterAverage(semesters[sem] ?? [], grades, courses, binaryPass ?? {}, sem) : null,
      courseChainMap,
      isDragging: !!activeCourseId,
      ruleWarnings: semesterRuleWarnings[sem] ?? [],
    };
  };

  // Summer semesters auto-show when added (no manual toggle needed)
  const semesterList = displayOrder;

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

        {viewMode === 'grid' && (
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden text-sm text-gray-600">
            <button
              onClick={() => setGridCols(gridCols > 1 ? (gridCols - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 : 1)}
              disabled={gridCols <= 1}
              className="px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              title="הצג יותר עמודות (קטן יותר)"
            >−</button>
            <span className="px-1 py-1.5 text-xs border-x border-gray-200 select-none">{gridCols}</span>
            <button
              onClick={() => setGridCols(gridCols < 8 ? (gridCols + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 : 8)}
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
        <div className="mb-3 p-2.5 bg-white border border-gray-200 rounded-xl">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {placedFaculties.map(({ faculty, dot }) => (
              <div key={faculty} className="relative flex items-center gap-1.5">
                <button
                  onClick={() => setColorPickerFor(colorPickerFor === faculty ? null : faculty)}
                  className={`w-3 h-3 rounded-full shrink-0 ${dot} hover:ring-2 hover:ring-offset-1 hover:ring-gray-400 transition-all`}
                  title="לחץ לשינוי צבע"
                />
                <span className="text-xs text-gray-600">{getFacultyShortName(faculty)}</span>
                {colorPickerFor === faculty && (
                  <div className="absolute top-5 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2 flex flex-wrap gap-1.5 w-44">
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => { setFacultyColorOverride(faculty, opt.key); setColorPickerFor(null); }}
                        className={`w-5 h-5 rounded-full ${opt.dot} hover:ring-2 hover:ring-offset-1 hover:ring-gray-400 transition-all ${(facultyColorOverrides ?? {})[faculty] === opt.key ? 'ring-2 ring-offset-1 ring-gray-600' : ''}`}
                        title={opt.key}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {colorPickerFor && (
            <p className="text-xs text-gray-400 mt-1.5">לחץ על עיגול צבע לשינוי · לחץ שוב לסגירה</p>
          )}
        </div>
      )}

      <SortableContext items={semesterList.map(s => `col-${s}`)} strategy={rectSortingStrategy}>
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className={viewMode === 'grid'
              ? `grid gap-3 mb-3 ${{1:'grid-cols-1',2:'grid-cols-2',3:'grid-cols-3',4:'grid-cols-4',5:'grid-cols-5',6:'grid-cols-6',7:'grid-cols-7',8:'grid-cols-8'}[gridCols] ?? 'grid-cols-4'}`
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
          {maxSemester < MAX_SEMESTERS && (
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
          {maxSemester < MAX_SEMESTERS && (
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
          <div className="w-44 shadow-xl opacity-90 pointer-events-none">
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
});

SemesterGrid.displayName = 'SemesterGrid';
