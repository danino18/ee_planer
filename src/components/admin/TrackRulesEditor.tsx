import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { DndContext, DragOverlay, useDroppable, useDraggable } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { db } from '../../services/firebase';
import { fetchCatalogYearRules, clearDegreeRulesCache } from '../../services/degreeRulesService';
import type { SapCourse, SemesterScheduleAlternativeGroup, SemesterScheduleEntry, TrackId } from '../../types';
import type { CatalogYearRules, RequirementGroupDef } from '../../types/firestoreRules';
import { AdminCourseSearch } from './AdminCourseSearch';

interface Props {
  trackId: TrackId;
  year: string;
  courses: Map<string, SapCourse>;
}


const CLASSIFIER_LABELS: Record<string, string> = {
  sport: 'ספורט',
  free_elective: 'בחירה חופשית (מלג)',
  english: 'קורסים באנגלית',
  general_elective: 'בחירה כלל טכניונים',
};

const CLASSIFIER_OPTIONS = Object.entries(CLASSIFIER_LABELS).map(([value, label]) => ({ value, label }));

const FACULTY_AREA_OPTIONS = [
  { value: 'ee',      label: 'חשמל',      prefix: '004' },
  { value: 'cs',      label: 'מדמ"ח',     prefix: '023' },
  { value: 'math',    label: 'מתמטיקה',   prefix: '010' },
  { value: 'physics', label: 'פיזיקה',    prefix: '011' },
];

// ── Read-only course list ────────────────────────────────────────────────────

type RenderItem =
  | { type: 'single'; id: string }
  | { type: 'or'; courses: string[] };

function buildCourseItems(ids: string[], orGroups: { courses: string[] }[]): RenderItem[] {
  const idToGroup = new Map<string, number>();
  orGroups.forEach((g, i) => g.courses.forEach((id) => idToGroup.set(id, i)));
  const rendered = new Set<number>();
  const items: RenderItem[] = [];
  for (const id of ids) {
    const gi = idToGroup.get(id);
    if (gi !== undefined) {
      if (!rendered.has(gi)) {
        rendered.add(gi);
        items.push({ type: 'or', courses: orGroups[gi].courses });
      }
    } else {
      items.push({ type: 'single', id });
    }
  }
  return items;
}

function CourseRow({ id, sapCourses }: { id: string; sapCourses: Map<string, SapCourse> }) {
  const course = sapCourses.get(id);
  return (
    <div className="flex items-baseline gap-2 px-3 py-1.5 bg-gray-50 text-sm">
      <span className="flex-1 text-gray-700">{course?.name ?? id}</span>
      <span className="text-gray-400 font-mono text-xs shrink-0">{id}</span>
      {course?.credits != null && (
        <span className="text-gray-400 text-xs shrink-0">{course.credits} נ"ז</span>
      )}
    </div>
  );
}

function CourseList({
  ids,
  courses,
  orGroups = [],
}: {
  ids: string[];
  courses: Map<string, SapCourse>;
  orGroups?: { courses: string[] }[];
}) {
  if (ids.length === 0) return <p className="text-xs text-gray-400 italic">אין קורסים</p>;
  const items = buildCourseItems(ids, orGroups);
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden divide-y divide-gray-100">
      {items.map((item, idx) => {
        if (item.type === 'single') {
          return <CourseRow key={item.id} id={item.id} sapCourses={courses} />;
        }
        return (
          <div key={`or-${idx}`} className="bg-amber-50 border-r-2 border-amber-300">
            <div className="px-3 pt-1.5 pb-0.5 text-xs font-medium text-amber-600">אחד מבין:</div>
            {item.courses.map((id, ci) => (
              <div key={id} className={ci < item.courses.length - 1 ? 'border-b border-amber-100' : ''}>
                <CourseRow id={id} sapCourses={courses} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Card view (read-only) ───────────────────────────────────────────────────

function GroupCardView({
  group,
  courses,
  semesterSchedule,
  onEdit,
}: {
  group: RequirementGroupDef;
  courses: Map<string, SapCourse>;
  semesterSchedule?: SemesterScheduleEntry[];
  onEdit: () => void;
}) {
  const areas = (group.courseSelector?.facultyAreas ?? []) as string[];
  const classifierKey = group.courseSelector?.classifierKey;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium text-gray-800">{group.title}</span>
        {group.groupType !== 'mandatory_schedule' && (
          <span className="text-gray-500 text-sm shrink-0">
            {group.targetValue} {group.targetUnit === 'credits' ? 'נ"ז' : 'קורסים'}
          </span>
        )}
        <button
          onClick={onEdit}
          title="עריכה"
          className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.364-6.364a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
          </svg>
        </button>
      </div>

      {/* Semester schedule grid for mandatory_schedule */}
      {group.groupType === 'mandatory_schedule' && semesterSchedule && semesterSchedule.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {semesterSchedule.map((entry) => (
            <div key={entry.semester} className="border border-gray-100 rounded-lg bg-gray-50 p-2 space-y-1">
              <p className="text-xs font-semibold text-blue-700 text-center border-b border-gray-200 pb-1">
                סמסטר {semLabel(entry.semester)}
              </p>
              {entry.courses.map((id) => {
                const c = courses.get(id);
                return (
                  <div key={id} className="text-xs text-gray-700 bg-white border border-gray-100 rounded px-1.5 py-1 leading-tight">
                    <p className="truncate">{c?.name ?? id}</p>
                    <p className="text-gray-400 font-mono">{id}</p>
                  </div>
                );
              })}
              {(entry.alternativeGroups ?? []).map((grp, gi) => (
                <div key={gi} className="border border-amber-200 rounded bg-amber-50 px-1.5 py-1">
                  <p className="text-[10px] font-medium text-amber-600 mb-0.5">חלופות:</p>
                  {grp.courseIds.map((id) => (
                    <div key={id} className="text-xs text-gray-700 leading-tight truncate">
                      {courses.get(id)?.name ?? id}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Details for other types */}
      {classifierKey && (
        <p className="text-xs text-gray-500 pr-1">{CLASSIFIER_LABELS[classifierKey] ?? classifierKey}</p>
      )}

      {areas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pr-1">
          {areas.map((a) => {
            const opt = FACULTY_AREA_OPTIONS.find((o) => o.value === a);
            return (
              <span key={a} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                {opt?.label ?? a}
              </span>
            );
          })}
        </div>
      )}

      {(group.groupType === 'course_pool' || group.groupType === 'custom_list') && (
        <div className="space-y-1">
          <CourseList
            ids={group.courseSelector?.ids ?? []}
            courses={courses}
            orGroups={group.orGroups ?? []}
          />
          <div className="flex gap-3 text-xs text-gray-400 pr-1">
            {group.poolRequired != null && <span>מינימום: {group.poolRequired}</span>}
            {group.poolMax != null && <span>מקסימום: {group.poolMax}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── OR groups editor ─────────────────────────────────────────────────────────

function OrGroupsEditor({
  poolIds,
  orGroups,
  sapCourses,
  onChange,
}: {
  poolIds: string[];
  orGroups: { courses: string[] }[];
  sapCourses: Map<string, SapCourse>;
  onChange: (orGroups: { courses: string[] }[]) => void;
}) {
  const allGrouped = new Set(orGroups.flatMap((g) => g.courses));
  const ungrouped = poolIds.filter((id) => !allGrouped.has(id));

  function addGroup() {
    onChange([...orGroups, { courses: [] }]);
  }

  function removeGroup(gi: number) {
    onChange(orGroups.filter((_, i) => i !== gi));
  }

  function addToGroup(gi: number, id: string) {
    onChange(orGroups.map((g, i) => i === gi ? { courses: [...g.courses, id] } : g));
  }

  function removeFromGroup(gi: number, id: string) {
    const next = orGroups
      .map((g, i) => i === gi ? { courses: g.courses.filter((c) => c !== id) } : g)
      .filter((g) => g.courses.length > 0);
    onChange(next);
  }

  return (
    <div className="space-y-1.5 pt-1 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">קבוצות "אחד מבין"</span>
        <button
          type="button"
          onClick={addGroup}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
        >
          <span className="text-base leading-none">+</span> הוסף קבוצה
        </button>
      </div>

      {orGroups.length === 0 && (
        <p className="text-xs text-gray-400 italic">אין קבוצות בחירה מוגדרות</p>
      )}

      {orGroups.map((group, gi) => (
        <div key={gi} className="border border-amber-200 rounded-lg bg-amber-50 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700">קבוצה {gi + 1}</span>
            <button
              type="button"
              onClick={() => removeGroup(gi)}
              className="text-gray-300 hover:text-red-500 text-xs transition-colors"
            >
              ✕ מחק קבוצה
            </button>
          </div>

          {/* Courses in this group */}
          <div className="flex flex-wrap gap-1.5">
            {group.courses.map((id) => {
              const name = sapCourses.get(id)?.name ?? id;
              return (
                <span key={id} className="flex items-center gap-1 bg-white border border-amber-200 rounded-full text-xs px-2 py-0.5">
                  <span className="text-gray-700 max-w-[160px] truncate" title={name}>{name}</span>
                  <button
                    type="button"
                    onClick={() => removeFromGroup(gi, id)}
                    className="text-gray-300 hover:text-red-500 transition-colors leading-none"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>

          {/* Add course to this group */}
          {ungrouped.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) { addToGroup(gi, e.target.value); e.target.value = ''; } }}
              className="text-xs border border-amber-200 rounded-lg px-2 py-1 bg-white w-full"
            >
              <option value="">+ הוסף קורס לקבוצה...</option>
              {ungrouped.map((id) => (
                <option key={id} value={id}>
                  {sapCourses.get(id)?.name ?? id} ({id})
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Card edit ───────────────────────────────────────────────────────────────

function GroupCardEdit({
  group,
  courses,
  semesterSchedule,
  onScheduleChange,
  onChange,
  onDone,
}: {
  group: RequirementGroupDef;
  courses: Map<string, SapCourse>;
  semesterSchedule?: SemesterScheduleEntry[];
  onScheduleChange?: (s: SemesterScheduleEntry[]) => void;
  onChange: (updates: Partial<RequirementGroupDef>) => void;
  onDone: () => void;
}) {
  const isMandatory = group.groupType === 'mandatory_schedule';

  return (
    <div className="border-2 border-blue-300 rounded-xl p-4 bg-white space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={group.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="flex-1 border rounded-lg px-2 py-1 text-sm min-w-[160px]"
          placeholder="שם הדרישה"
        />
        {!isMandatory && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={group.targetValue}
              onChange={(e) => onChange({ targetValue: Number(e.target.value) })}
              className="w-16 border rounded-lg px-2 py-1 text-sm text-center"
            />
            <select
              value={group.targetUnit}
              onChange={(e) => onChange({ targetUnit: e.target.value as 'credits' | 'courses' })}
              className="border rounded-lg px-2 py-1 text-sm"
            >
              <option value="credits">נ"ז</option>
              <option value="courses">קורסים</option>
            </select>
          </div>
        )}
        <button
          onClick={onDone}
          title="סיום עריכה"
          className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>

      {/* Semester schedule DnD editor for mandatory_schedule */}
      {isMandatory && semesterSchedule && onScheduleChange && (
        <SemesterScheduleEditGrid
          schedule={semesterSchedule}
          sapCourses={courses}
          onChange={onScheduleChange}
        />
      )}

      {group.groupType === 'predefined_classifier' && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">מסווג:</label>
          <select
            value={group.courseSelector?.classifierKey ?? ''}
            onChange={(e) =>
              onChange({
                courseSelector: {
                  ...group.courseSelector,
                  classifierKey: e.target.value as never,
                },
              })
            }
            className="border rounded-lg px-2 py-1 text-sm"
          >
            <option value="">-- בחר --</option>
            {CLASSIFIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {group.groupType === 'elective_faculty' && (
        <div className="flex flex-wrap gap-3">
          <span className="text-xs text-gray-500 self-center">אזורי פקולטה:</span>
          {FACULTY_AREA_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={(group.courseSelector?.facultyAreas ?? []).includes(opt.value as never)}
                onChange={(e) => {
                  const current = (group.courseSelector?.facultyAreas ?? []) as string[];
                  const next = e.target.checked
                    ? [...current, opt.value]
                    : current.filter((a) => a !== opt.value);
                  onChange({ courseSelector: { ...group.courseSelector, facultyAreas: next as never } });
                }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}

      {(group.groupType === 'course_pool' || group.groupType === 'custom_list') && (
        <div className="space-y-2">
          <AdminCourseSearch
            courses={courses}
            selectedIds={group.courseSelector?.ids ?? []}
            onChange={(ids) => onChange({ courseSelector: { ...group.courseSelector, ids } })}
          />
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <label>
              מינימום:{' '}
              <input
                type="number"
                value={group.poolRequired ?? ''}
                onChange={(e) => onChange({ poolRequired: e.target.value ? Number(e.target.value) : undefined })}
                className="w-14 border rounded px-1 py-0.5 text-center"
              />
            </label>
            <label>
              מקסימום:{' '}
              <input
                type="number"
                value={group.poolMax ?? ''}
                onChange={(e) => onChange({ poolMax: e.target.value ? Number(e.target.value) : undefined })}
                className="w-14 border rounded px-1 py-0.5 text-center"
              />
            </label>
          </div>

          {/* OR groups editor */}
          <OrGroupsEditor
            poolIds={group.courseSelector?.ids ?? []}
            orGroups={group.orGroups ?? []}
            sapCourses={courses}
            onChange={(orGroups) => onChange({ orGroups })}
          />
        </div>
      )}
    </div>
  );
}

// ── Semester schedule editor ─────────────────────────────────────────────────

const HEBREW_ORDINALS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳'];
function semLabel(n: number) { return HEBREW_ORDINALS[n - 1] ?? String(n); }

/** Tiny course-search dropdown (no selected-list rendering) */
function CoursePickerDropdown({
  sapCourses,
  excludeIds,
  onSelect,
  placeholder = 'הוסף קורס...',
}: {
  sapCourses: Map<string, SapCourse>;
  excludeIds: Set<string>;
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);
  const q = deferredQuery.trim().toLowerCase();

  const results = useMemo(() => {
    if (q.length < 2) return [];
    const out: SapCourse[] = [];
    for (const c of sapCourses.values()) {
      if (excludeIds.has(c.id)) continue;
      if (c.id.includes(q) || c.name.toLowerCase().includes(q)) {
        out.push(c);
        if (out.length >= 20) break;
      }
    }
    return out;
  }, [sapCourses, q, excludeIds]);

  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full border border-dashed border-blue-300 rounded-lg px-2 py-1 text-xs bg-white"
        dir="rtl"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full mt-0.5 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(c.id); setQuery(''); setOpen(false); }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-blue-50 text-right border-b border-gray-50 last:border-0"
            >
              <span className="text-blue-500 shrink-0">+</span>
              <span className="flex-1 text-gray-800 truncate">{c.name}</span>
              <span className="text-gray-400 font-mono shrink-0">{c.id}</span>
            </button>
          ))}
        </div>
      )}
      {open && q.length >= 2 && results.length === 0 && (
        <div className="absolute top-full mt-0.5 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 px-2 py-3 text-center text-xs text-gray-400">
          לא נמצאו קורסים
        </div>
      )}
    </div>
  );
}

/** The DnD grid content shared by GroupCardEdit (mandatory_schedule) */
function SemesterScheduleEditGrid({
  schedule,
  sapCourses,
  onChange,
}: {
  schedule: SemesterScheduleEntry[];
  sapCourses: Map<string, SapCourse>;
  onChange: (s: SemesterScheduleEntry[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const allScheduledIds = useMemo(
    () => new Set(schedule.flatMap((e) => [
      ...e.courses,
      ...(e.alternativeGroups?.flatMap((g) => g.courseIds) ?? []),
    ])),
    [schedule],
  );

  function updateEntry(si: number, updater: (e: SemesterScheduleEntry) => SemesterScheduleEntry) {
    onChange(schedule.map((e, i) => i === si ? updater(e) : e));
  }

  function removeCourse(si: number, id: string) {
    updateEntry(si, (e) => ({ ...e, courses: e.courses.filter((c) => c !== id) }));
  }

  function addCourse(si: number, id: string) {
    updateEntry(si, (e) => ({ ...e, courses: [...e.courses, id] }));
  }

  function addSemester() {
    const next = schedule.length > 0 ? Math.max(...schedule.map((e) => e.semester)) + 1 : 1;
    onChange([...schedule, { semester: next, courses: [] }]);
  }

  function removeSemester(si: number) {
    onChange(schedule.filter((_, i) => i !== si));
  }

  function addAltGroup(si: number) {
    updateEntry(si, (e) => ({ ...e, alternativeGroups: [...(e.alternativeGroups ?? []), { courseIds: [] }] }));
  }

  function removeAltGroup(si: number, gi: number) {
    updateEntry(si, (e) => ({
      ...e,
      alternativeGroups: (e.alternativeGroups ?? []).filter((_, i) => i !== gi),
    }));
  }

  function addToAltGroup(si: number, gi: number, id: string) {
    updateEntry(si, (e) => ({
      ...e,
      alternativeGroups: (e.alternativeGroups ?? []).map((g, i) =>
        i === gi ? { ...g, courseIds: [...g.courseIds, id] } : g,
      ),
    }));
  }

  function removeFromAltGroup(si: number, gi: number, id: string) {
    updateEntry(si, (e) => ({
      ...e,
      alternativeGroups: (e.alternativeGroups ?? [])
        .map((g, i) => i === gi ? { ...g, courseIds: g.courseIds.filter((c) => c !== id) } : g)
        .filter((g) => g.courseIds.length > 0),
    }));
  }

  function setDefaultAltCourse(si: number, gi: number, id: string) {
    updateEntry(si, (e) => ({
      ...e,
      alternativeGroups: (e.alternativeGroups ?? []).map((g, i) =>
        i === gi ? { ...g, defaultCourseId: id } : g,
      ),
    }));
  }

  // drag ID: "course:{semIdx}:{courseId}"
  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const [, fromSiStr, courseId] = String(active.id).split(':');
    const toSiStr = String(over.id).replace('sem:', '');
    const fromSi = parseInt(fromSiStr);
    const toSi = parseInt(toSiStr);
    if (fromSi === toSi || isNaN(fromSi) || isNaN(toSi)) return;

    const next = schedule.map((e, i) => {
      if (i === fromSi) return { ...e, courses: e.courses.filter((c) => c !== courseId) };
      if (i === toSi)   return { ...e, courses: [...e.courses, courseId] };
      return e;
    });
    onChange(next);
  }

  // Draggable course tile
  function DraggableCourseTile({ id, si }: { id: string; si: number }) {
    const c = sapCourses.get(id);
    const dragId = `course:${si}:${id}`;
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: dragId,
      data: { courseId: id, si },
    });
    return (
      <div
        ref={setNodeRef}
        style={{ transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined }}
        className={`flex items-start gap-1 bg-white border border-gray-100 rounded px-1.5 py-1 ${isDragging ? 'opacity-40' : ''}`}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 mt-0.5 shrink-0 select-none leading-none"
          style={{ touchAction: 'none' }}
        >
          ⠿
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-700 leading-tight truncate">{c?.name ?? id}</p>
          <p className="text-[10px] text-gray-400 font-mono">{id}</p>
        </div>
        <button
          type="button"
          onClick={() => removeCourse(si, id)}
          className="text-gray-200 hover:text-red-500 transition-colors leading-none shrink-0 mt-0.5"
        >✕</button>
      </div>
    );
  }

  // Droppable semester column wrapper
  function DroppableCol({ si, children, isAnyDragging }: { si: number; children: React.ReactNode; isAnyDragging: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: `sem:${si}` });
    return (
      <div
        ref={setNodeRef}
        className={`border rounded-xl p-2 space-y-1.5 transition-colors ${
          isOver
            ? 'border-blue-400 bg-blue-50 border-2'
            : isAnyDragging
            ? 'border-blue-200 bg-blue-50/20 border-dashed'
            : 'border-blue-200 bg-blue-50/30'
        }`}
      >
        {children}
      </div>
    );
  }

  const activeCourseId = activeId ? activeId.split(':')[2] : null;
  const activeCourse = activeCourseId ? sapCourses.get(activeCourseId) : null;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid gap-3 items-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {schedule.map((entry, si) => (
          <DroppableCol key={entry.semester} si={si} isAnyDragging={!!activeId}>
            <div className="flex items-center justify-between pb-1 border-b border-blue-100">
              <p className="text-xs font-semibold text-blue-700">סמסטר {semLabel(entry.semester)}</p>
              <button type="button" onClick={() => removeSemester(si)} title="מחק סמסטר" className="text-gray-300 hover:text-red-500 text-xs transition-colors">✕</button>
            </div>

            {entry.courses.map((id) => (
              <DraggableCourseTile key={id} id={id} si={si} />
            ))}

            {!!activeId && entry.courses.length === 0 && (
              <p className="text-xs text-blue-400 text-center py-3 italic">גרור לכאן</p>
            )}

            {(entry.alternativeGroups ?? []).map((grp: SemesterScheduleAlternativeGroup, gi: number) => (
              <div key={gi} className="border border-amber-200 rounded-lg bg-amber-50 p-1.5 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-amber-700">קבוצת חלופות {gi + 1}</p>
                  <button type="button" onClick={() => removeAltGroup(si, gi)} className="text-gray-300 hover:text-red-500 text-[10px] transition-colors">✕</button>
                </div>
                {grp.courseIds.map((id) => {
                  const c = sapCourses.get(id);
                  return (
                    <div key={id} className="flex items-start gap-1 bg-white border border-amber-100 rounded px-1 py-0.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 leading-tight truncate">{c?.name ?? id}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{id}</p>
                      </div>
                      <button type="button" onClick={() => removeFromAltGroup(si, gi, id)} className="text-gray-200 hover:text-red-500 transition-colors leading-none shrink-0">✕</button>
                    </div>
                  );
                })}
                {grp.courseIds.length > 1 && (
                  <select value={grp.defaultCourseId ?? grp.courseIds[0]} onChange={(e) => setDefaultAltCourse(si, gi, e.target.value)} className="w-full text-[10px] border border-amber-200 rounded px-1 py-0.5 bg-white">
                    {grp.courseIds.map((id) => (
                      <option key={id} value={id}>{sapCourses.get(id)?.name ?? id} (ברירת מחדל)</option>
                    ))}
                  </select>
                )}
                <CoursePickerDropdown sapCourses={sapCourses} excludeIds={allScheduledIds} onSelect={(id) => addToAltGroup(si, gi, id)} placeholder="הוסף חלופה..." />
              </div>
            ))}

            <CoursePickerDropdown sapCourses={sapCourses} excludeIds={allScheduledIds} onSelect={(id) => addCourse(si, id)} />
            <button type="button" onClick={() => addAltGroup(si)} className="w-full text-[10px] text-amber-600 hover:text-amber-800 border border-dashed border-amber-300 rounded px-1 py-0.5 bg-amber-50/50">
              + קבוצת חלופות
            </button>
          </DroppableCol>
        ))}

        <button type="button" onClick={addSemester} className="border-2 border-dashed border-blue-200 rounded-xl py-8 text-xs text-blue-400 hover:border-blue-400 hover:text-blue-600 transition-colors flex flex-col items-center gap-1">
          <span className="text-2xl leading-none">+</span>
          הוסף סמסטר
        </button>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCourse && (
          <div className="bg-white border border-blue-300 rounded px-2 py-1 shadow-lg opacity-90 pointer-events-none max-w-[200px]">
            <p className="text-xs text-gray-700 font-medium truncate">{activeCourse.name}</p>
            <p className="text-[10px] text-gray-400 font-mono">{activeCourse.id}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function TrackRulesEditor({ trackId, year, courses }: Props) {
  const [rules, setRules] = useState<CatalogYearRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIndices, setEditingIndices] = useState<Set<number>>(new Set());
  const [editingTotalCredits, setEditingTotalCredits] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setEditingIndices(new Set());
    setEditingTotalCredits(false);
    const yearNum = year === 'base' ? null : Number(year);
    fetchCatalogYearRules(trackId, yearNum)
      .then((r) => {
        if (r) setRules(r);
        else setError('לא נמצאו חוקים לשנה זו. הרץ את סקריפט הזריעה תחילה.');
      })
      .catch(() => setError('שגיאה בטעינת הנתונים.'))
      .finally(() => setLoading(false));
  }, [trackId, year]);

  function updateGroup(index: number, updates: Partial<RequirementGroupDef>) {
    if (!rules) return;
    setRules({
      ...rules,
      requirementGroups: rules.requirementGroups.map((g, i) => i === index ? { ...g, ...updates } : g),
    });
    setSaved(false);
  }

  function toggleEdit(index: number) {
    setEditingIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }

  async function handleSave() {
    if (!rules) return;
    setSaving(true);
    setError(null);
    try {
      await setDoc(doc(db, 'degreeRules', trackId, 'catalogYears', year), JSON.parse(JSON.stringify(rules)));
      clearDegreeRulesCache();
      setSaved(true);
      setEditingIndices(new Set());
      setEditingTotalCredits(false);
    } catch (e) {
      setError('שגיאה בשמירה: ' + String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error && !rules) return <p className="text-red-600 text-sm py-8 text-center">{error}</p>;
  if (!rules) return null;

  const hasEdits = editingIndices.size > 0 || editingTotalCredits;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Total credits */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">סה"כ נקודות נדרשות:</span>
          {editingTotalCredits ? (
            <>
              <input
                type="number"
                value={rules.totalCreditsRequired}
                onChange={(e) => {
                  setRules({ ...rules, totalCreditsRequired: Number(e.target.value) });
                  setSaved(false);
                }}
                className="w-20 border rounded-lg px-2 py-1 text-sm text-center"
                autoFocus
              />
              <button onClick={() => setEditingTotalCredits(false)} className="text-blue-600 hover:text-blue-800 p-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <span className="font-semibold text-gray-800">{rules.totalCreditsRequired}</span>
              <button
                onClick={() => setEditingTotalCredits(true)}
                className="text-gray-400 hover:text-blue-600 transition-colors p-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.364-6.364a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Save */}
        <div className="flex items-center gap-2">
          {saved && !hasEdits && <span className="text-green-600 text-sm">נשמר ✓</span>}
          {error && <span className="text-red-600 text-sm">{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
      </div>

      {/* Requirement group cards */}
      <div className="space-y-3">
        {rules.requirementGroups.map((group, i) =>
          editingIndices.has(i) ? (
            <GroupCardEdit
              key={group.id}
              group={group}
              courses={courses}
              semesterSchedule={group.groupType === 'mandatory_schedule' ? rules.semesterSchedule : undefined}
              onScheduleChange={group.groupType === 'mandatory_schedule'
                ? (s) => { setRules({ ...rules, semesterSchedule: s }); setSaved(false); }
                : undefined}
              onChange={(updates) => updateGroup(i, updates)}
              onDone={() => toggleEdit(i)}
            />
          ) : (
            <GroupCardView
              key={group.id}
              group={group}
              courses={courses}
              semesterSchedule={group.groupType === 'mandatory_schedule' ? rules.semesterSchedule : undefined}
              onEdit={() => toggleEdit(i)}
            />
          ),
        )}
      </div>
    </div>
  );
}
