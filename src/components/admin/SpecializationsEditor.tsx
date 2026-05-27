import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { clearDegreeRulesCache } from '../../services/degreeRulesService';
import type { SapCourse, TrackId } from '../../types';
import type { FirestoreSpecializationGroup } from '../../types/firestoreRules';

type CourseCategory = 'mandatory_core' | 'mandatory_choice_option' | 'elective';

interface SpecCourse {
  course_number: string;
  course_name: string;
  category: CourseCategory;
}

interface Props {
  trackId: TrackId;
  courses: Map<string, SapCourse>;
}

interface SpecDoc extends FirestoreSpecializationGroup {
  slug: string;
}

const CATEGORY_LABELS: Record<CourseCategory, string> = {
  mandatory_core: 'חובה',
  mandatory_choice_option: 'חובת בחירה',
  elective: 'בחירה',
};

const CATEGORY_COLORS: Record<CourseCategory, string> = {
  mandatory_core: 'bg-blue-100 text-blue-700',
  mandatory_choice_option: 'bg-amber-100 text-amber-700',
  elective: 'bg-gray-100 text-gray-600',
};

function normalizeCategory(raw: string | undefined): CourseCategory {
  if (raw === 'mandatory_core') return 'mandatory_core';
  if (raw === 'mandatory_choice_option' || raw === 'mandatory_choice_option_with_mutual_exclusion') return 'mandatory_choice_option';
  return 'elective';
}

function parseSpecDoc(spec: FirestoreSpecializationGroup): {
  courses: SpecCourse[];
  requirements: Record<string, unknown>;
  mutualExclusionGroups: string[][];
} {
  const normalizedCourses: SpecCourse[] = (spec.courses ?? []).map((c) => ({
    course_number: c.course_number,
    course_name: c.course_name,
    category: normalizeCategory(c.category),
  }));

  const mutualExclusionGroups: string[][] = (spec.mutual_exclusion_rules ?? [])
    .filter((r) => Array.isArray(r.options) && r.options.length > 1)
    .map((r) => r.options.map((o) => o.course_number));

  return {
    courses: normalizedCourses,
    requirements: (spec.requirements as Record<string, unknown> | undefined) ?? {},
    mutualExclusionGroups,
  };
}

// ── Display helpers ───────────────────────────────────────────────────────────

interface ChoiceGroup { count: number; courses: SpecCourse[] }

interface DisplayStructure {
  mandatory: SpecCourse[];
  choiceGroups: ChoiceGroup[];
  electives: SpecCourse[];
  electiveOrGroups: string[][];
}

function parseDisplayStructure(
  courses: SpecCourse[],
  requirements: Record<string, unknown>,
  mutualExclusionGroups: string[][]
): DisplayStructure {
  const req = Object.keys(requirements).length > 0 ? requirements : null;
  const courseById = new Map(courses.map((c) => [c.course_number, c]));

  if (!req) {
    // Fallback: use category field
    const byCat: Record<CourseCategory, SpecCourse[]> = { mandatory_core: [], mandatory_choice_option: [], elective: [] };
    for (const c of courses) (byCat[c.category] ?? byCat.elective).push(c);
    return {
      mandatory: byCat.mandatory_core,
      choiceGroups: byCat.mandatory_choice_option.length > 0 ? [{ count: 1, courses: byCat.mandatory_choice_option }] : [],
      electives: byCat.elective,
      electiveOrGroups: mutualExclusionGroups,
    };
  }

  const reqObj = req;

  // Mandatory courses
  const mandatoryIds = new Set<string>();
  if (Array.isArray(reqObj.mandatory_courses)) {
    for (const c of reqObj.mandatory_courses as Array<{ course_number?: string }>) {
      if (typeof c.course_number === 'string') mandatoryIds.add(c.course_number);
    }
  }

  // Choice groups (each rule is independent — must satisfy ALL rules)
  function parseRule(rule: unknown): ChoiceGroup | null {
    if (!rule || typeof rule !== 'object') return null;
    const r = rule as Record<string, unknown>;
    const match = (typeof r.type === 'string' ? r.type : '').match(/choose_(\d+)_from/);
    const count = match ? parseInt(match[1]) : 1;
    const opts = Array.isArray(r.options) ? r.options as Array<{ course_number?: string }> : [];
    const cs = opts.map((o) => o.course_number).filter((id): id is string => typeof id === 'string').map((id) => courseById.get(id)).filter((c): c is SpecCourse => c !== undefined);
    return cs.length > 0 ? { count, courses: cs } : null;
  }

  const choiceGroups: ChoiceGroup[] = [];
  const single = reqObj.mandatory_choice_rule;
  const multi = reqObj.mandatory_choice_rules ?? reqObj.mandatory_choice_groups;
  if (single !== undefined) {
    const g = parseRule(single); if (g) choiceGroups.push(g);
  } else if (Array.isArray(multi)) {
    for (const rule of multi) { const g = parseRule(rule); if (g) choiceGroups.push(g); }
  }

  const choiceIds = new Set(choiceGroups.flatMap((g) => g.courses.map((c) => c.course_number)));
  const electives = courses.filter((c) => !mandatoryIds.has(c.course_number) && !choiceIds.has(c.course_number));

  return {
    mandatory: courses.filter((c) => mandatoryIds.has(c.course_number)),
    choiceGroups,
    electives,
    electiveOrGroups: mutualExclusionGroups,
  };
}

// ── Read-only course list ─────────────────────────────────────────────────────

function SpecCourseRow({
  course,
  sapCourses,
  showCategory = false,
}: {
  course: SpecCourse;
  sapCourses: Map<string, SapCourse>;
  showCategory?: boolean;
}) {
  const sap = sapCourses.get(course.course_number);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <span className="flex-1 text-gray-700 truncate">{sap?.name ?? course.course_name}</span>
      <span className="text-gray-400 font-mono text-xs shrink-0">{course.course_number}</span>
      {sap?.credits != null
        ? <span className="text-gray-400 text-xs shrink-0">{sap.credits} נ"ז</span>
        : <span className="text-gray-300 text-xs shrink-0">—</span>
      }
      {showCategory && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLORS[course.category]}`}>
          {CATEGORY_LABELS[course.category]}
        </span>
      )}
    </div>
  );
}

function OrBlock({ label, courses, sapCourses }: { label: string; courses: SpecCourse[]; sapCourses: Map<string, SapCourse> }) {
  return (
    <div className="bg-amber-50 border-r-2 border-amber-300">
      <div className="px-3 pt-1.5 pb-0.5 text-xs font-medium text-amber-600">{label}</div>
      {courses.map((course, ci) => (
        <div key={course.course_number} className={ci < courses.length - 1 ? 'border-b border-amber-100' : ''}>
          <SpecCourseRow course={course} sapCourses={sapCourses} />
        </div>
      ))}
    </div>
  );
}

function CourseListView({
  courses,
  sapCourses,
  requirements,
  mutualExclusionGroups = [],
}: {
  courses: SpecCourse[];
  sapCourses: Map<string, SapCourse>;
  requirements: Record<string, unknown>;
  mutualExclusionGroups?: string[][];
}) {
  if (courses.length === 0) return <p className="text-xs text-gray-400 italic pr-1">אין קורסים</p>;

  const { mandatory, choiceGroups, electives, electiveOrGroups } = parseDisplayStructure(courses, requirements, mutualExclusionGroups);

  const electiveById = new Map(electives.map((c) => [c.course_number, c]));
  const elIdToGroup = new Map<string, number>();
  electiveOrGroups.forEach((g, i) => g.forEach((id) => elIdToGroup.set(id, i)));
  const renderedElOr = new Set<number>();

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden divide-y divide-gray-100">
      {mandatory.map((c) => (
        <div key={c.course_number} className="bg-gray-50"><SpecCourseRow course={c} sapCourses={sapCourses} /></div>
      ))}
      {choiceGroups.map((g, gi) => (
        <OrBlock
          key={`choice-${gi}`}
          label={`בחר ${g.count === 1 ? 'אחד' : g.count} מבין:`}
          courses={g.courses}
          sapCourses={sapCourses}
        />
      ))}
      {electives.map((course) => {
        const gi = elIdToGroup.get(course.course_number);
        if (gi !== undefined) {
          if (renderedElOr.has(gi)) return null;
          renderedElOr.add(gi);
          const gCourses = electiveOrGroups[gi].map((id) => electiveById.get(id)).filter((c): c is SpecCourse => c !== undefined);
          return <OrBlock key={`or-${gi}`} label="אחד מבין:" courses={gCourses} sapCourses={sapCourses} />;
        }
        return <div key={course.course_number} className="bg-gray-50"><SpecCourseRow course={course} sapCourses={sapCourses} /></div>;
      })}
    </div>
  );
}

// ── Edit course list with OR grouping ─────────────────────────────────────────

type EditItem =
  | { type: 'single'; idx: number; course: SpecCourse }
  | { type: 'or_group'; items: Array<{ idx: number; course: SpecCourse }> };

function buildEditItems(courses: SpecCourse[], mutualExclusionGroups: string[][]): EditItem[] {
  const idToGroup = new Map<string, number>();
  mutualExclusionGroups.forEach((g, i) => g.forEach((id) => idToGroup.set(id, i)));
  const idToIdx = new Map(courses.map((c, i) => [c.course_number, i]));
  const rendered = new Set<number>();
  const items: EditItem[] = [];
  for (let idx = 0; idx < courses.length; idx++) {
    const course = courses[idx];
    const gi = idToGroup.get(course.course_number);
    if (gi !== undefined) {
      if (!rendered.has(gi)) {
        rendered.add(gi);
        const groupItems = mutualExclusionGroups[gi]
          .map((id) => { const i = idToIdx.get(id); return i !== undefined ? { idx: i, course: courses[i] } : null; })
          .filter((x): x is { idx: number; course: SpecCourse } => x !== null);
        items.push({ type: 'or_group', items: groupItems });
      }
    } else {
      items.push({ type: 'single', idx, course });
    }
  }
  return items;
}

// ── Add-course search ─────────────────────────────────────────────────────────

function AddCourseSearch({
  courses,
  excludeIds,
  onAdd,
}: {
  courses: Map<string, SapCourse>;
  excludeIds: string[];
  onAdd: (course: { course_number: string; course_name: string }, category: CourseCategory) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<CourseCategory>('elective');
  const containerRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);
  const q = deferredQuery.trim().toLowerCase();

  const results = useMemo(() => {
    if (q.length < 2) return [];
    const out: SapCourse[] = [];
    for (const course of courses.values()) {
      if (excludeIds.includes(course.id)) continue;
      if (course.id.includes(q) || course.name.toLowerCase().includes(q)) {
        out.push(course);
        if (out.length >= 30) break;
      }
    }
    return out;
  }, [courses, q, excludeIds]);

  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
  }

  function handleAdd(course: SapCourse) {
    onAdd({ course_number: course.id, course_name: course.name }, newCategory);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={containerRef} onBlur={handleBlur} className="flex gap-2 items-start">
      <div className="relative flex-1">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="חפש קורס לפי שם או מספר..."
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          dir="rtl"
        />
        {open && results.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto">
            {results.map((course) => (
              <button
                key={course.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleAdd(course); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 text-right border-b border-gray-50 last:border-0"
              >
                <span className="text-blue-500 text-base leading-none shrink-0">+</span>
                <span className="flex-1 text-gray-800 truncate">{course.name}</span>
                <span className="text-gray-400 font-mono text-xs shrink-0">{course.id}</span>
                {course.credits != null && (
                  <span className="text-gray-400 text-xs shrink-0">{course.credits} נ"ז</span>
                )}
              </button>
            ))}
          </div>
        )}
        {open && q.length >= 2 && results.length === 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 px-3 py-4 text-center text-xs text-gray-400">
            לא נמצאו קורסים
          </div>
        )}
      </div>
      <select
        value={newCategory}
        onChange={(e) => setNewCategory(e.target.value as CourseCategory)}
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white shrink-0"
      >
        {(Object.keys(CATEGORY_LABELS) as CourseCategory[]).map((cat) => (
          <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
        ))}
      </select>
    </div>
  );
}

// ── Choice groups editor ("בחר N מבין") ──────────────────────────────────────

interface ChoiceGroupState { count: number; courseIds: string[] }

function GroupChipList({
  ids,
  getName,
  onRemove,
}: {
  ids: string[];
  getName: (id: string) => string;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <span key={id} className="flex items-center gap-1 bg-white border border-amber-200 rounded-full text-xs px-2 py-0.5">
          <span className="text-gray-700 max-w-[180px] truncate" title={getName(id)}>{getName(id)}</span>
          <button type="button" onClick={() => onRemove(id)} className="text-gray-300 hover:text-red-500 transition-colors leading-none">✕</button>
        </span>
      ))}
    </div>
  );
}

function ChoiceGroupsEditor({
  groups,
  editedCourses,
  sapCourses,
  onChange,
}: {
  groups: ChoiceGroupState[];
  editedCourses: SpecCourse[];
  sapCourses: Map<string, SapCourse>;
  onChange: (groups: ChoiceGroupState[]) => void;
}) {
  const allGrouped = new Set(groups.flatMap((g) => g.courseIds));
  const ungrouped = editedCourses.filter((c) => !allGrouped.has(c.course_number));

  function getName(id: string) {
    return sapCourses.get(id)?.name ?? editedCourses.find((c) => c.course_number === id)?.course_name ?? id;
  }

  return (
    <div className="space-y-1.5 pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">קבוצות "בחר מבין" (חובת בחירה)</span>
        <button type="button" onClick={() => onChange([...groups, { count: 1, courseIds: [] }])} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
          <span className="text-base leading-none">+</span> הוסף קבוצה
        </button>
      </div>
      {groups.length === 0 && <p className="text-xs text-gray-400 italic">אין קבוצות בחירה חובה מוגדרות</p>}
      {groups.map((group, gi) => (
        <div key={gi} className="border border-amber-200 rounded-lg bg-amber-50 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-amber-700">קבוצה {gi + 1}</span>
            <span className="text-xs text-amber-600">בחר</span>
            <input
              type="number" min={1} max={Math.max(1, group.courseIds.length)} value={group.count}
              onChange={(e) => { const next = [...groups]; next[gi] = { ...group, count: Math.max(1, Number(e.target.value)) }; onChange(next); }}
              className="w-10 text-center border border-amber-200 rounded px-1 py-0.5 text-xs bg-white"
            />
            <span className="text-xs text-amber-600">מבין:</span>
            <button type="button" onClick={() => onChange(groups.filter((_, i) => i !== gi))} className="text-gray-300 hover:text-red-500 text-xs transition-colors mr-auto">✕ מחק</button>
          </div>
          <GroupChipList ids={group.courseIds} getName={getName} onRemove={(id) => {
            const next = [...groups]; next[gi] = { ...group, courseIds: group.courseIds.filter((x) => x !== id) }; onChange(next);
          }} />
          {ungrouped.length > 0 && (
            <select defaultValue="" onChange={(e) => {
              if (!e.target.value) return;
              const next = [...groups]; next[gi] = { ...group, courseIds: [...group.courseIds, e.target.value] }; onChange(next); e.target.value = '';
            }} className="text-xs border border-amber-200 rounded-lg px-2 py-1 bg-white w-full">
              <option value="">+ הוסף קורס לקבוצה...</option>
              {ungrouped.map((c) => <option key={c.course_number} value={c.course_number}>{getName(c.course_number)} ({c.course_number})</option>)}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Mutual exclusion groups editor ("אחד מבין") ───────────────────────────────

function MutualExclusionEditor({
  groups,
  editedCourses,
  sapCourses,
  onChange,
}: {
  groups: string[][];
  editedCourses: SpecCourse[];
  sapCourses: Map<string, SapCourse>;
  onChange: (groups: string[][]) => void;
}) {
  const allGrouped = new Set(groups.flat());
  const ungrouped = editedCourses.filter((c) => !allGrouped.has(c.course_number));

  function getName(id: string) {
    return sapCourses.get(id)?.name ?? editedCourses.find((c) => c.course_number === id)?.course_name ?? id;
  }

  return (
    <div className="space-y-1.5 pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">קבוצות "אחד מבין" (אי-כפילות)</span>
        <button type="button" onClick={() => onChange([...groups, []])} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
          <span className="text-base leading-none">+</span> הוסף קבוצה
        </button>
      </div>
      {groups.length === 0 && <p className="text-xs text-gray-400 italic">אין קבוצות אחד-מבין מוגדרות</p>}
      {groups.map((group, gi) => (
        <div key={gi} className="border border-amber-200 rounded-lg bg-amber-50 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700">קבוצה {gi + 1}</span>
            <button type="button" onClick={() => onChange(groups.filter((_, i) => i !== gi))} className="text-gray-300 hover:text-red-500 text-xs transition-colors">✕ מחק קבוצה</button>
          </div>
          <GroupChipList ids={group} getName={getName} onRemove={(id) => {
            const next = groups.map((g, i) => i === gi ? g.filter((x) => x !== id) : g).filter((g) => g.length > 0);
            onChange(next);
          }} />
          {ungrouped.length > 0 && (
            <select defaultValue="" onChange={(e) => {
              if (!e.target.value) return;
              const next = groups.map((g, i) => i === gi ? [...g, e.target.value] : g); onChange(next); e.target.value = '';
            }} className="text-xs border border-amber-200 rounded-lg px-2 py-1 bg-white w-full">
              <option value="">+ הוסף קורס לקבוצה...</option>
              {ungrouped.map((c) => <option key={c.course_number} value={c.course_number}>{getName(c.course_number)} ({c.course_number})</option>)}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SpecializationsEditor({ trackId, courses }: Props) {
  const [specs, setSpecs] = useState<SpecDoc[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editedCourses, setEditedCourses] = useState<SpecCourse[]>([]);
  const [requirements, setRequirements] = useState<Record<string, unknown>>({});
  const [mutualExclusionGroups, setMutualExclusionGroups] = useState<string[][]>([]);
  const [choiceGroups, setChoiceGroups] = useState<ChoiceGroupState[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    setEditing(false);
    getDocs(collection(db, 'degreeRules', trackId, 'specializations'))
      .then((snap) => {
        const docs = snap.docs.map((d) => ({ slug: d.id, ...d.data() } as SpecDoc));
        docs.sort((a, b) => a.name.localeCompare(b.name, 'he'));
        setSpecs(docs);
      })
      .finally(() => setLoading(false));
  }, [trackId]);

  function selectSpec(slug: string) {
    const spec = specs.find((s) => s.slug === slug);
    if (!spec) return;
    const { courses: parsedCourses, requirements: parsedReq, mutualExclusionGroups: meg } = parseSpecDoc(spec);

    // Parse choice groups from requirements
    const parsedChoiceGroups: ChoiceGroupState[] = [];
    function parseChoiceRule(rule: unknown): ChoiceGroupState | null {
      if (!rule || typeof rule !== 'object') return null;
      const r = rule as Record<string, unknown>;
      const match = (typeof r.type === 'string' ? r.type : '').match(/choose_(\d+)_from/);
      const count = match ? parseInt(match[1]) : 1;
      const opts = Array.isArray(r.options) ? r.options as Array<{ course_number?: string }> : [];
      const courseIds = opts.map((o) => o.course_number).filter((id): id is string => typeof id === 'string');
      return courseIds.length > 0 ? { count, courseIds } : null;
    }
    const single = parsedReq.mandatory_choice_rule;
    const multi = parsedReq.mandatory_choice_rules ?? parsedReq.mandatory_choice_groups;
    if (single !== undefined) { const g = parseChoiceRule(single); if (g) parsedChoiceGroups.push(g); }
    else if (Array.isArray(multi)) { for (const rule of multi) { const g = parseChoiceRule(rule); if (g) parsedChoiceGroups.push(g); } }

    setSelected(slug);
    setEditedCourses(parsedCourses);
    setRequirements(parsedReq);
    setMutualExclusionGroups(meg);
    setChoiceGroups(parsedChoiceGroups);
    setEditing(false);
    setSaved(false);
    setSaveError(null);
  }

  function updateCategory(idx: number, category: CourseCategory) {
    setEditedCourses((prev) => prev.map((c, i) => i === idx ? { ...c, category } : c));
    setSaved(false);
  }

  function removeCourse(idx: number) {
    setEditedCourses((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  function addCourse(course: { course_number: string; course_name: string }, category: CourseCategory) {
    setEditedCourses((prev) => [...prev, { ...course, category }]);
    setSaved(false);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      const courseById = new Map(editedCourses.map((c) => [c.course_number, c]));
      function ref(id: string) {
        return { course_number: id, course_name: courses.get(id)?.name ?? courseById.get(id)?.course_name ?? id };
      }

      // Rebuild requirements: preserve all fields except choice-rule keys, then add rebuilt ones
      const updatedRequirements: Record<string, unknown> = {
        ...Object.fromEntries(
          Object.entries(requirements).filter(([k]) =>
            !['mandatory_choice_rule', 'mandatory_choice_groups', 'mandatory_choice_rules'].includes(k),
          ),
        ),
        ...(choiceGroups.length > 0 ? {
          mandatory_choice_rules: choiceGroups.map((g) => ({
            type: `choose_${g.count}_from`,
            options: g.courseIds.map(ref),
          })),
        } : {}),
      };

      const updatedMutualExclusionRules = mutualExclusionGroups.map((g) => ({
        type: 'choose_at_most_1_from' as const,
        options: g.map(ref),
      }));

      const spec = specs.find((s) => s.slug === selected);
      if (!spec) return;

      const updated: FirestoreSpecializationGroup = {
        name: spec.name,
        ...(spec.title !== undefined ? { title: spec.title } : {}),
        ...(spec.type !== undefined ? { type: spec.type } : {}),
        courses: editedCourses,
        requirements: updatedRequirements,
        mutual_exclusion_rules: updatedMutualExclusionRules,
        ...(spec.notes !== undefined ? { notes: spec.notes } : {}),
        ...(spec.yearVariants !== undefined ? { yearVariants: spec.yearVariants } : {}),
      };

      await setDoc(doc(db, 'degreeRules', trackId, 'specializations', selected), JSON.parse(JSON.stringify(updated)));
      clearDegreeRulesCache();
      setSpecs((prev) => prev.map((s) => s.slug === selected ? { ...s, ...updated } : s));
      setRequirements(updatedRequirements);
      setSaved(true);
      setEditing(false);
    } catch (e) {
      setSaveError('שגיאה בשמירה: ' + String(e));
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

  const excludeIds = editedCourses.map((c) => c.course_number);
  const currentSpec = specs.find((s) => s.slug === selected);

  return (
    <div className="flex gap-4" style={{ minHeight: 400 }}>
      {/* Sidebar */}
      <div className="w-52 shrink-0 border border-gray-200 rounded-xl overflow-y-auto bg-white">
        {specs.length === 0 && (
          <p className="text-gray-400 text-sm p-4 text-center">אין קבוצות</p>
        )}
        {specs.map((s) => (
          <button
            key={s.slug}
            onClick={() => selectSpec(s.slug)}
            className={`w-full text-right px-3 py-2 text-sm border-b border-gray-100 hover:bg-blue-50 transition-colors ${
              selected === s.slug ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Main panel */}
      <div className="flex-1 min-w-0">
        {!selected && (
          <p className="text-gray-400 text-sm text-center mt-8">בחר קבוצת התמחות לעריכה</p>
        )}

        {selected && !editing && (
          /* ── Read-only view ── */
          <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex-1 font-medium text-gray-800">{currentSpec?.name}</span>
              <span className="text-xs text-gray-400">{editedCourses.length} קורסים</span>
              {saved && <span className="text-green-600 text-sm">נשמר ✓</span>}
              <button
                onClick={() => setEditing(true)}
                title="עריכה"
                className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.364-6.364a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                </svg>
              </button>
            </div>
            <CourseListView courses={editedCourses} sapCourses={courses} requirements={requirements} mutualExclusionGroups={mutualExclusionGroups} />
          </div>
        )}

        {selected && editing && (
          /* ── Edit view ── */
          <div className="border-2 border-blue-400 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex-1 font-medium text-gray-800">{currentSpec?.name}</span>
              <span className="text-xs text-gray-400">{editedCourses.length} קורסים</span>
              {saveError && <span className="text-red-500 text-sm">{saveError}</span>}
              <button
                onClick={() => { selectSpec(selected); }}
                title="בטל שינויים"
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                title="שמור"
                className="text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors p-1 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>

            {/* Editable course list */}
            {editedCourses.length > 0 && (() => {
              const editItems = buildEditItems(editedCourses, mutualExclusionGroups);
              function CourseEditRow({ idx, course }: { idx: number; course: SpecCourse }) {
                const sap = courses.get(course.course_number);
                return (
                  <div className="flex items-center gap-3 px-3 py-2 bg-white">
                    <button type="button" onClick={() => removeCourse(idx)} className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none shrink-0" title="הסר">✕</button>
                    <div className="flex-1 flex items-baseline gap-2 min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate">{sap?.name ?? course.course_name}</span>
                      <span className="text-xs text-gray-400 font-mono shrink-0">{course.course_number}</span>
                    </div>
                    {sap?.credits != null
                      ? <span className="text-xs text-gray-400 shrink-0">{sap.credits} נ"ז</span>
                      : <span className="text-xs text-gray-300 shrink-0">—</span>
                    }
                    <select value={course.category} onChange={(e) => updateCategory(idx, e.target.value as CourseCategory)} className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium shrink-0 ${CATEGORY_COLORS[course.category]}`}>
                      {(Object.keys(CATEGORY_LABELS) as CourseCategory[]).map((cat) => (
                        <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              return (
                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                  {editItems.map((item, ii) => {
                    if (item.type === 'single') {
                      return <CourseEditRow key={item.course.course_number} idx={item.idx} course={item.course} />;
                    }
                    return (
                      <div key={`or-${ii}`} className="bg-amber-50 border-r-2 border-amber-300">
                        <div className="px-3 pt-1.5 pb-0.5 text-xs font-medium text-amber-600">אחד מבין:</div>
                        {item.items.map((x, ci) => (
                          <div key={x.course.course_number} className={ci < item.items.length - 1 ? 'border-b border-amber-100' : ''}>
                            <CourseEditRow idx={x.idx} course={x.course} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {editedCourses.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-3 border border-dashed border-gray-200 rounded-xl">
                אין קורסים בקבוצה זו
              </p>
            )}

            <ChoiceGroupsEditor
              groups={choiceGroups}
              editedCourses={editedCourses}
              sapCourses={courses}
              onChange={(g) => { setChoiceGroups(g); setSaved(false); }}
            />
            <MutualExclusionEditor
              groups={mutualExclusionGroups}
              editedCourses={editedCourses}
              sapCourses={courses}
              onChange={(g) => { setMutualExclusionGroups(g); setSaved(false); }}
            />
            <AddCourseSearch courses={courses} excludeIds={excludeIds} onAdd={addCourse} />
          </div>
        )}
      </div>
    </div>
  );
}
