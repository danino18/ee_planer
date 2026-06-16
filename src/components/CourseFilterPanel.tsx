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

const CHIP_BASE = 'text-xs border px-2 py-1 rounded-full transition-colors';
const CHIP_OFF = 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500';

/** A compact chip that opens a popover; closes on outside-click and Escape. */
function ChipPopover({
  label, active, activeClass, children, onClear, panelClassName,
}: {
  label: string;
  active: boolean;
  activeClass: string;
  children: React.ReactNode;
  onClear?: () => void;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

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

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <span className={`inline-flex items-center gap-1 border rounded-full transition-colors ${active ? activeClass : CHIP_OFF}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          className="text-xs px-2 py-1 leading-none"
        >
          {label} <span aria-hidden>{open ? '▴' : '▾'}</span>
        </button>
        {onClear && active && (
          <button type="button" onClick={onClear} aria-label="נקה סינון" className="pe-1.5 -ms-1 leading-none hover:opacity-70">×</button>
        )}
      </span>
      {open && (
        <div id={panelId} role="dialog" className={`absolute z-[60] mt-1 top-full right-0 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg p-2 text-xs ${panelClassName ?? 'min-w-44'}`}>
          {children}
        </div>
      )}
    </span>
  );
}

function SubjectsChip({ filters, onChange }: Pick<Props, 'filters' | 'onChange'>) {
  const selected = filters.subjects;
  const label = selected.length === 0 ? 'מקצועות' : `מקצועות (${selected.length})`;

  function toggle(id: SubjectId) {
    onChange({ subjects: selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id] });
  }

  return (
    <ChipPopover
      label={label}
      active={selected.length > 0}
      activeClass="bg-blue-100 text-blue-700 border-blue-300"
      onClear={() => onChange({ subjects: [] })}
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-1.5 mb-1 border-b border-gray-100 dark:border-slate-700">
        <button type="button" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" onClick={() => onChange({ subjects: SUBJECT_OPTIONS.map((o) => o.id) })}>בחר הכל</button>
        <button type="button" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" onClick={() => onChange({ subjects: [] })}>נקה</button>
      </div>
      <div role="group" aria-label="מקצועות">
        {SUBJECT_OPTIONS.map((opt) => {
          const isOn = selected.includes(opt.id);
          return (
            <button
              type="button"
              aria-pressed={isOn}
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={`flex w-full items-center gap-2 px-2 py-1 rounded text-start ${isOn ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
            >
              <span className={`inline-block w-3.5 h-3.5 border rounded-sm shrink-0 text-center leading-3 ${isOn ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-slate-500'}`} aria-hidden>
                {isOn && <span className="text-[10px]">✓</span>}
              </span>
              <span className={`inline-block w-2 h-2 rounded-full ${opt.dotClass}`} aria-hidden />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </ChipPopover>
  );
}

function MinInput({ label, value, max, onChange }: { label: string; value: number | null; max?: number; onChange: (raw: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <input
        type="number" inputMode="numeric" min={0} max={max} placeholder="מינ׳"
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 text-xs border border-gray-200 dark:border-slate-600 rounded-md px-1.5 py-1 text-center focus:border-blue-400 outline-none bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200"
      />
    </label>
  );
}

function GradeStatsChip({
  filters, onChange, availableSemesters, statsAvailable, statsLoading,
}: Pick<Props, 'filters' | 'onChange' | 'availableSemesters' | 'statsAvailable' | 'statsLoading'>) {
  const mode = filters.statisticsSemester;
  const active = mode !== 'general' || filters.averageMin !== null || filters.medianMin !== null || filters.minStudents !== null;
  const modeLabel = mode === 'general' ? 'כללי' : mode === 'latest' ? 'האחרון' : formatSemester(mode);

  return (
    <ChipPopover
      label={`ציונים: ${modeLabel}`}
      active={active}
      activeClass="bg-emerald-100 text-emerald-700 border-emerald-300"
      onClear={() => onChange({ statisticsSemester: 'general', averageMin: null, medianMin: null, minStudents: null })}
      panelClassName="w-60"
    >
      {!statsAvailable ? (
        <p className="text-gray-400 dark:text-gray-500 italic px-1">{statsLoading ? 'טוען נתוני ציונים…' : 'נתוני הציונים אינם זמינים כעת.'}</p>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center justify-between gap-2">
            <span className="text-gray-600 dark:text-gray-400">סטטיסטיקה</span>
            <select
              value={mode}
              onChange={(e) => onChange({ statisticsSemester: e.target.value })}
              dir="rtl"
              aria-label="מצב סטטיסטיקת ציונים"
              className="text-xs border border-gray-200 dark:border-slate-600 rounded-md px-2 py-1 cursor-pointer focus:border-blue-400 outline-none max-w-36 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200"
            >
              <option value="general">כללי</option>
              <option value="latest">האחרון הזמין</option>
              {availableSemesters.map((s) => <option key={s} value={s}>{formatSemester(s)}</option>)}
            </select>
          </label>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
            {mode === 'general'
              ? 'ממוצע וחציון כלליים מחושבים מכל הסמסטרים עם נתונים (לפחות 3). קורסים עם פחות מ-3 סמסטרים מציגים את הסמסטר האחרון.'
              : mode === 'latest'
                ? '"האחרון הזמין" עשוי להציג סמסטר שונה לכל מקצוע — הסמסטר מוצג לצד הערך.'
                : 'מוצגים נתונים מהסמסטר הנבחר בלבד.'}
          </p>

          <div className="border-t border-gray-100 dark:border-slate-700 pt-2 space-y-1.5">
            <MinInput label="ממוצע מינ׳" value={filters.averageMin} max={100} onChange={(raw) => onChange({ averageMin: clampGrade(raw) })} />
            <MinInput label="חציון מינ׳" value={filters.medianMin} max={100} onChange={(raw) => onChange({ medianMin: clampGrade(raw) })} />
            <MinInput
              label="תלמידים מינ׳"
              value={filters.minStudents}
              onChange={(raw) => {
                const s = raw.trim();
                onChange({ minStudents: s === '' ? null : Math.max(0, Math.floor(Number(s) || 0)) });
              }}
            />
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug border-t border-gray-100 dark:border-slate-700 pt-1.5">
            נתוני ציונים היסטוריים מ-CheeseFork. הזמינות משתנה לפי מקצוע וסמסטר. אין לראות בערכים הבטחה לקושי הקורס או לציון עתידי.
          </p>
        </div>
      )}
    </ChipPopover>
  );
}

export function CourseFilterPanel({
  filters, onChange, onReset, availableSemesters, statsAvailable, statsLoading, ratingLoading,
}: Props) {
  const activeCount =
    filters.subjects.length +
    TOGGLE_FILTERS.filter((t) => filters[t.key]).length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.statisticsSemester !== 'general' ? 1 : 0) +
    (filters.averageMin !== null ? 1 : 0) +
    (filters.medianMin !== null ? 1 : 0) +
    (filters.minStudents !== null ? 1 : 0) +
    (filters.sortBy !== 'default' ? 1 : 0);

  const sortValue = `${filters.sortBy}:${filters.sortDirection}`;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2 px-1" role="group" aria-label="סינון ומיון">
      <SubjectsChip filters={filters} onChange={onChange} />

      {TOGGLE_FILTERS.map((t) => (
        <span key={t.key} className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange({ [t.key]: !filters[t.key] } as Partial<CourseFilters>)}
            aria-pressed={!!filters[t.key]}
            className={`${CHIP_BASE} ${filters[t.key] ? t.active : CHIP_OFF}`}
          >
            {t.label}
          </button>
          {FILTER_LINKS[t.key as string] && (
            <a href={FILTER_LINKS[t.key as string].href} target="_blank" rel="noopener noreferrer" title={FILTER_LINKS[t.key as string].tooltip ?? FILTER_LINKS[t.key as string].label} className="text-xs text-blue-400 hover:text-blue-600 shrink-0">↗</a>
          )}
        </span>
      ))}

      <span className="inline-flex items-center gap-1">
        <select
          value={filters.minRating}
          onChange={(e) => onChange({ minRating: Number(e.target.value) })}
          dir="rtl"
          aria-label="דירוג ציזפורק מינימלי"
          className={`text-xs border rounded-full px-2 py-1 cursor-pointer ${filters.minRating > 0 ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700' : CHIP_OFF}`}
        >
          {RATING_FILTER_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        {ratingLoading && <span className="text-xs text-gray-400 animate-pulse" title="טוען דירוגים…">⏳</span>}
      </span>

      <GradeStatsChip
        filters={filters}
        onChange={onChange}
        availableSemesters={availableSemesters}
        statsAvailable={statsAvailable}
        statsLoading={statsLoading}
      />

      <select
        value={sortValue}
        onChange={(e) => {
          const opt = SORT_OPTIONS.find((o) => o.value === e.target.value);
          if (opt) onChange({ sortBy: opt.sortBy, sortDirection: opt.dir });
        }}
        dir="rtl"
        aria-label="מיון קורסים"
        className={`text-xs border rounded-full px-2 py-1 cursor-pointer ${filters.sortBy !== 'default' ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700' : CHIP_OFF}`}
      >
        {SORT_OPTIONS.filter((o) => statsAvailable || !o.needsStats).map((o) => (
          <option key={o.value} value={o.value}>{`מיון: ${o.label}`}</option>
        ))}
      </select>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 underline px-1"
        >
          איפוס סינון ({activeCount})
        </button>
      )}
    </div>
  );
}
