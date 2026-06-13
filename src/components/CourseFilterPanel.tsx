import { useEffect, useId, useRef, useState } from 'react';
import type { CourseFilters, SortBy, SortDirection, SubjectId } from '../domain/gradeStatistics/types';
import { SUBJECT_OPTIONS } from '../utils/subjects';
import { formatSemester } from '../domain/gradeStatistics/semester';

const FILTER_LINKS: Record<string, { href: string; label: string; tooltip?: string }> = {
  english: { href: 'https://ugportal.technion.ac.il/%d7%94%d7%95%d7%a8%d7%90%d7%94-%d7%95%d7%91%d7%97%d7%99%d7%a0%d7%95%d7%aa/%d7%aa%d7%a7%d7%a0%d7%94-1-3-3-%d7%97%d7%95%d7%91%d7%aa-%d7%9c%d7%99%d7%9e%d7%95%d7%93-%d7%a7%d7%95%d7%a8%d7%a1%d7%99%d7%9d-%d7%91%d7%a9%d7%a4%d7%94-%d7%94%d7%90%d7%a0%d7%92%d7%9c%d7%99%d7%aa-compuls/', label: 'קורסי אנגלית' },
  melag: { href: 'https://ugportal.technion.ac.il/%D7%94%D7%95%D7%A8%D7%90%D7%94-%D7%95%D7%91%D7%97%D7%99%D7%A0%D7%95%D7%AA/%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99-%D7%94%D7%A2%D7%A9%D7%A8%D7%94/', label: 'מל"גים' },
  freeElective: { href: 'https://humanities.technion.ac.il/courses/%d7%a7%d7%95%d7%a8%d7%a1-%d7%94%d7%a2%d7%a9%d7%a8%d7%94/', label: 'קורסי העשרה' },
  winter: { href: 'https://ece.technion.ac.il/degree-studies-programs/undergraduate-studies/study-programs-courses/?lang=he', label: 'קורסי אביב וחורף', tooltip: 'לרדת למטה בדף עד לטבלת הקורסים לפי סמסטר' },
};

const RATING_FILTER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'כל הדירוגים' },
  { value: 3, label: '⭐ 3 ומעלה' },
  { value: 4, label: '⭐ 4 ומעלה' },
  { value: 4.5, label: '⭐ 4.5 ומעלה' },
  { value: 5, label: '⭐ 5 בלבד' },
];

const TOGGLE_FILTERS: { key: keyof CourseFilters; label: string; active: string }[] = [
  { key: 'english', label: 'אנגלית', active: 'bg-sky-100 text-sky-700 border-sky-300' },
  { key: 'melag', label: 'מל"ג', active: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'freeElective', label: 'בחירה חופשית', active: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'advancedDegree', label: 'תארים מתקדמים', active: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { key: 'winter', label: 'חורף', active: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
  { key: 'spring', label: 'אביב', active: 'bg-pink-100 text-pink-700 border-pink-300' },
];

const SORT_OPTIONS: { value: string; label: string; sortBy: SortBy; dir: SortDirection; needsStats?: boolean }[] = [
  { value: 'default:asc', label: 'סדר ברירת מחדל', sortBy: 'default', dir: 'asc' },
  { value: 'courseNumber:asc', label: 'מספר קורס ↑', sortBy: 'courseNumber', dir: 'asc' },
  { value: 'courseNumber:desc', label: 'מספר קורס ↓', sortBy: 'courseNumber', dir: 'desc' },
  { value: 'courseName:asc', label: 'שם קורס א-ת', sortBy: 'courseName', dir: 'asc' },
  { value: 'courseName:desc', label: 'שם קורס ת-א', sortBy: 'courseName', dir: 'desc' },
  { value: 'credits:desc', label: 'נק"ז: מהגבוה לנמוך', sortBy: 'credits', dir: 'desc' },
  { value: 'credits:asc', label: 'נק"ז: מהנמוך לגבוה', sortBy: 'credits', dir: 'asc' },
  { value: 'average:desc', label: 'ממוצע: מהגבוה לנמוך', sortBy: 'average', dir: 'desc', needsStats: true },
  { value: 'average:asc', label: 'ממוצע: מהנמוך לגבוה', sortBy: 'average', dir: 'asc', needsStats: true },
  { value: 'median:desc', label: 'חציון: מהגבוה לנמוך', sortBy: 'median', dir: 'desc', needsStats: true },
  { value: 'median:asc', label: 'חציון: מהנמוך לגבוה', sortBy: 'median', dir: 'asc', needsStats: true },
];

interface Props {
  filters: CourseFilters;
  onChange: (partial: Partial<CourseFilters>) => void;
  onReset: () => void;
  availableSemesters: string[];
  statsAvailable: boolean;
  statsLoading: boolean;
  ratingLoading?: boolean;
}

function clampGrade(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-500 mb-1.5">{children}</p>;
}

function SubjectsMultiSelect({ filters, onChange }: Pick<Props, 'filters' | 'onChange'>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = filters.subjects;

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle(id: SubjectId) {
    onChange({
      subjects: selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    });
  }

  const label = selected.length === 0
    ? 'מקצועות'
    : selected.length === 1
      ? `מקצועות: ${SUBJECT_OPTIONS.find((o) => o.id === selected[0])?.label}`
      : `מקצועות (${selected.length})`;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={`text-xs border px-2.5 py-1 rounded-full transition-colors ${
          selected.length > 0
            ? 'bg-blue-100 text-blue-700 border-blue-300'
            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
        }`}
      >
        {label} <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="absolute z-[60] mt-1 min-w-44 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 text-xs end-0"
        >
          <div className="flex items-center justify-between gap-2 px-1 pb-1.5 mb-1 border-b border-gray-100">
            <button type="button" className="text-blue-600 hover:text-blue-800" onClick={() => onChange({ subjects: SUBJECT_OPTIONS.map((o) => o.id) })}>בחר הכל</button>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => onChange({ subjects: [] })}>נקה</button>
          </div>
          {SUBJECT_OPTIONS.map((opt) => {
            const isOn = selected.includes(opt.id);
            return (
              <button
                type="button"
                role="option"
                aria-selected={isOn}
                key={opt.id}
                onClick={() => toggle(opt.id)}
                className={`flex w-full items-center gap-2 px-2 py-1 rounded text-start ${
                  isOn ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={`inline-block w-3.5 h-3.5 border rounded-sm shrink-0 text-center leading-3 ${isOn ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`} aria-hidden>
                  {isOn && <span className="text-[10px]">✓</span>}
                </span>
                <span className={`inline-block w-2 h-2 rounded-full ${opt.dotClass}`} aria-hidden />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GradeRange({
  label, min, max, onMin, onMax,
}: { label: string; min: number | null; max: number | null; onMin: (v: number | null) => void; onMax: (v: number | null) => void }) {
  const invalid = min !== null && max !== null && min > max;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-600 w-12 shrink-0">{label}</span>
        <input
          type="number" inputMode="numeric" min={0} max={100} placeholder="מ-"
          aria-label={`${label} מינימום`}
          value={min ?? ''}
          onChange={(e) => onMin(clampGrade(e.target.value))}
          className="w-16 text-xs border border-gray-200 rounded-md px-1.5 py-1 text-center focus:border-blue-400 outline-none"
        />
        <span className="text-gray-400 text-xs">–</span>
        <input
          type="number" inputMode="numeric" min={0} max={100} placeholder="עד"
          aria-label={`${label} מקסימום`}
          value={max ?? ''}
          onChange={(e) => onMax(clampGrade(e.target.value))}
          className="w-16 text-xs border border-gray-200 rounded-md px-1.5 py-1 text-center focus:border-blue-400 outline-none"
        />
      </div>
      {invalid && <span className="text-[11px] text-red-500">המינימום גדול מהמקסימום</span>}
    </div>
  );
}

export function CourseFilterPanel({
  filters, onChange, onReset, availableSemesters, statsAvailable, statsLoading, ratingLoading,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const activeCount =
    filters.subjects.length +
    TOGGLE_FILTERS.filter((t) => filters[t.key]).length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.averageMin !== null || filters.averageMax !== null ? 1 : 0) +
    (filters.medianMin !== null || filters.medianMax !== null ? 1 : 0) +
    (filters.minStudents !== null ? 1 : 0);

  const sortValue = `${filters.sortBy}:${filters.sortDirection}`;
  const usesLatest = filters.statisticsSemester === 'latest';

  return (
    <div className="mt-2 border border-gray-200 rounded-xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 md:cursor-default"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          סינון ומיון
          {activeCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">{activeCount}</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {activeCount > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onReset(); } }}
              className="text-xs text-gray-500 hover:text-red-600 underline"
            >
              איפוס סינון
            </span>
          )}
          <span aria-hidden className="md:hidden text-gray-400">{expanded ? '▴' : '▾'}</span>
        </span>
      </button>

      <div className={`${expanded ? 'block' : 'hidden'} md:block px-3 pb-3 pt-1 space-y-3 border-t border-gray-100`}>
        {/* Subjects */}
        <div>
          <GroupLabel>מקצועות</GroupLabel>
          <SubjectsMultiSelect filters={filters} onChange={onChange} />
        </div>

        {/* Academic properties */}
        <div>
          <GroupLabel>תכונות אקדמיות</GroupLabel>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {TOGGLE_FILTERS.map((t) => (
              <span key={t.key} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange({ [t.key]: !filters[t.key] } as Partial<CourseFilters>)}
                  aria-pressed={!!filters[t.key]}
                  className={`text-xs border px-2 py-1 rounded-full transition-colors ${
                    filters[t.key] ? t.active : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                </button>
                {FILTER_LINKS[t.key as string] && (
                  <a href={FILTER_LINKS[t.key as string].href} target="_blank" rel="noopener noreferrer" title={FILTER_LINKS[t.key as string].tooltip ?? FILTER_LINKS[t.key as string].label} className="text-xs text-blue-400 hover:text-blue-600">↗</a>
                )}
              </span>
            ))}
            <select
              value={filters.minRating}
              onChange={(e) => onChange({ minRating: Number(e.target.value) })}
              dir="rtl"
              aria-label="דירוג ציזפורק מינימלי"
              className={`text-xs border rounded-full px-2 py-1 cursor-pointer ${
                filters.minRating > 0 ? 'bg-teal-100 text-teal-700 border-teal-300' : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300'
              }`}
            >
              {RATING_FILTER_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {ratingLoading && <span className="text-xs text-gray-400 animate-pulse" title="טוען דירוגים…">⏳</span>}
          </div>
        </div>

        {/* Grade statistics */}
        <div>
          <GroupLabel>סטטיסטיקת ציונים</GroupLabel>
          {!statsAvailable ? (
            <p className="text-xs text-gray-400 italic">
              {statsLoading ? 'טוען נתוני ציונים…' : 'נתוני הציונים אינם זמינים כעת.'}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <label className="text-xs text-gray-600" htmlFor="stats-semester">סמסטר:</label>
                <select
                  id="stats-semester"
                  value={filters.statisticsSemester}
                  onChange={(e) => onChange({ statisticsSemester: e.target.value })}
                  dir="rtl"
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 cursor-pointer focus:border-blue-400 outline-none"
                >
                  <option value="latest">האחרון הזמין</option>
                  {availableSemesters.map((s) => <option key={s} value={s}>{formatSemester(s)}</option>)}
                </select>
              </div>
              {usesLatest && (
                <p className="text-[11px] text-gray-400 leading-snug">
                  "האחרון הזמין" עשוי להציג סמסטר שונה לכל מקצוע — הסמסטר מוצג לצד הערך.
                </p>
              )}
              <GradeRange
                label="ממוצע"
                min={filters.averageMin} max={filters.averageMax}
                onMin={(v) => onChange({ averageMin: v })} onMax={(v) => onChange({ averageMax: v })}
              />
              <GradeRange
                label="חציון"
                min={filters.medianMin} max={filters.medianMax}
                onMin={(v) => onChange({ medianMin: v })} onMax={(v) => onChange({ medianMax: v })}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-600 w-12 shrink-0">תלמידים</span>
                <input
                  type="number" inputMode="numeric" min={0} placeholder="מינימום"
                  aria-label="מספר תלמידים מינימלי"
                  value={filters.minStudents ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    onChange({ minStudents: v === '' ? null : Math.max(0, Math.floor(Number(v) || 0)) });
                  }}
                  className="w-20 text-xs border border-gray-200 rounded-md px-1.5 py-1 text-center focus:border-blue-400 outline-none"
                />
              </div>
              <p className="text-[11px] text-gray-400 leading-snug">
                נתוני ציונים היסטוריים מ-CheeseFork. הזמינות משתנה לפי מקצוע וסמסטר, וההבדלים בין מועדי בחינה אפשריים. אין לראות בערכים הבטחה לקושי הקורס או לציון עתידי.
              </p>
            </div>
          )}
        </div>

        {/* Sorting */}
        <div>
          <GroupLabel>מיון</GroupLabel>
          <select
            value={sortValue}
            onChange={(e) => {
              const opt = SORT_OPTIONS.find((o) => o.value === e.target.value);
              if (opt) onChange({ sortBy: opt.sortBy, sortDirection: opt.dir });
            }}
            dir="rtl"
            aria-label="מיון קורסים"
            className="text-xs border border-gray-200 rounded-md px-2 py-1 cursor-pointer focus:border-blue-400 outline-none"
          >
            {SORT_OPTIONS.filter((o) => statsAvailable || !o.needsStats).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
